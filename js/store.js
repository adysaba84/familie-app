import { TABS, PARENTS_ONLY_TABS } from './schema.js';
import { batchGet, appendRows, updateRange, tabTitles, addTab } from './sheets.js';
import { parseTable, toRow, columnLetter } from './model.js';
import { currentEmail } from './auth.js';

// Loads every tab of one spreadsheet into a typed in-memory model and writes back append-only:
// an edit is "void the old row + append a new one", and every write also appends an audit row.
const TAB_NAMES = Object.keys(TABS);
const nowIso = () => new Date().toISOString();

// The files may have been created with an older schema. Missing tabs are created (editors only; a
// read-only user just skips them) and a tab with no data rows gets its header rewritten to the current
// schema; a tab that already has data and a different header is refused (needs a manual migration).
// Returns the tabs that exist.
const checked = new Map();
async function ensureSchema(fileId, names) {
  if (checked.has(fileId)) return checked.get(fileId);
  const titles = new Set(await tabTitles(fileId));
  for (const tab of names.filter((t) => !titles.has(t))) {
    try { await addTab(fileId, tab, TABS[tab]); titles.add(tab); } catch (e) { /* read-only: leave it out */ }
  }
  const present = names.filter((t) => titles.has(t));
  const heads = await batchGet(fileId, present.map((t) => `${t}!1:2`));
  for (let i = 0; i < present.length; i++) {
    const tab = present[i], want = TABS[tab];
    const have = (heads[i][0] || []).map(String);
    if (have.join('|') === want.join('|')) continue;
    // an older sheet whose header is just the start of the current one (columns were added at the end): extend it, data stays valid
    const grown = have.length > 0 && have.length < want.length && have.every((c, j) => c === want[j]);
    if (heads[i].length > 1 && !grown) throw new Error('schema_mismatch:' + tab);
    try { await updateRange(fileId, `${tab}!A1`, [want]); } catch (e) { /* read-only: fine */ }
  }
  checked.set(fileId, present);
  return present;
}

// `space` = 'parents' | 'iza': Iza's file does not get the parents-only tabs (money pages, salaries)
export async function loadModel(fileId, space = 'parents') {
  const names = space === 'iza' ? TAB_NAMES.filter((t) => !PARENTS_ONLY_TABS.includes(t)) : TAB_NAMES;
  const present = await ensureSchema(fileId, names);
  const tables = await batchGet(fileId, present);
  const model = {};
  for (const t of TAB_NAMES) model[t] = [];
  present.forEach((t, i) => { model[t] = parseTable(tables[i]); });
  // Iza's own wallet entries live in their own tab (the only one she may write); calculations see them as balances
  model.balances = model.balances.concat(model.wallet_balances.map((r) => ({ ...r, _tab: 'wallet_balances' })));
  return model;
}

function auditRow(action, tab, rowId, summary) {
  return toRow('audit', { ts: nowIso(), user: currentEmail(), action, tab, row_id: rowId, summary });
}

// Adds one record; returns it (with its generated id) so the caller can update its model.
export async function addRecord(fileId, tab, fields, summary = '', { audit = true } = {}) {
  const rec = { id: crypto.randomUUID(), ...fields, created_by: currentEmail(), created_at: nowIso(), void: false, void_reason: '' };
  await appendRows(fileId, tab, [toRow(tab, rec)]);
  // Iza cannot write `audit`; her entries carry created_by instead
  if (tab !== 'wallet_balances' && audit) await appendRows(fileId, 'audit', [auditRow('add', tab, rec.id, summary)]);
  return rec;
}

// Marks a record void (never deletes). `rec` must come from loadModel so it has its sheet row.
export async function voidRecord(fileId, tabIn, rec, reason = '') {
  const tab = rec._tab || tabIn; // a merged wallet row is voided in its own tab
  const cols = TABS[tab];
  const voidCol = columnLetter(cols.indexOf('void') + 1);
  const reasonCol = columnLetter(cols.indexOf('void_reason') + 1);
  await updateRange(fileId, `${tab}!${voidCol}${rec._row}:${reasonCol}${rec._row}`, [['1', reason]]);
  if (tab !== 'wallet_balances') await appendRows(fileId, 'audit', [auditRow('void', tab, rec.id, reason)]);
}

// Closes or reopens an account in place (its id must stay: balances and flows point at it). Audited like a void.
export async function setAccountStatus(fileId, rec, status) {
  const col = columnLetter(TABS.accounts.indexOf('status') + 1);
  await updateRange(fileId, `accounts!${col}${rec._row}`, [[status]]);
  await appendRows(fileId, 'audit', [auditRow('update', 'accounts', rec.id, `${status === 'closed' ? 'închis' : 'redeschis'} ${rec.name}`)]);
}

// Adds several records of one tab in a single request (one audit row for the whole batch).
export async function addRecords(fileId, tab, list, summary = '') {
  const recs = list.map((fields) => ({
    id: crypto.randomUUID(), ...fields, created_by: currentEmail(), created_at: nowIso(), void: false, void_reason: '',
  }));
  await appendRows(fileId, tab, recs.map((r) => toRow(tab, r)));
  await appendRows(fileId, 'audit', [auditRow('add', tab, recs.map((r) => r.id).join(','), summary)]);
  return recs;
}
