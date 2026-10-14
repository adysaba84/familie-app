import { TABS } from './schema.js';
import { batchGet, appendRows, updateRange } from './sheets.js';
import { parseTable, toRow, columnLetter } from './model.js';
import { currentEmail } from './auth.js';

// Loads every tab of one spreadsheet into a typed in-memory model and writes back append-only:
// an edit is "void the old row + append a new one", and every write also appends an audit row.
const TAB_NAMES = Object.keys(TABS);
const nowIso = () => new Date().toISOString();

// The two files may have been created with an older header. If a tab has no data rows yet, its
// header is rewritten to the current schema; if it has data, we refuse (needs a manual migration).
const checked = new Set();
async function ensureHeaders(fileId) {
  if (checked.has(fileId)) return;
  const heads = await batchGet(fileId, TAB_NAMES.map((t) => `${t}!1:2`));
  for (let i = 0; i < TAB_NAMES.length; i++) {
    const tab = TAB_NAMES[i], want = TABS[tab];
    const have = (heads[i][0] || []).map(String);
    if (have.join('|') === want.join('|')) continue;
    if (heads[i].length > 1) throw new Error('schema_mismatch:' + tab);
    await updateRange(fileId, `${tab}!A1`, [want]);
  }
  checked.add(fileId);
}

export async function loadModel(fileId) {
  await ensureHeaders(fileId);
  const tables = await batchGet(fileId, TAB_NAMES);
  const model = {};
  TAB_NAMES.forEach((t, i) => { model[t] = parseTable(tables[i]); });
  return model;
}

function auditRow(action, tab, rowId, summary) {
  return toRow('audit', { ts: nowIso(), user: currentEmail(), action, tab, row_id: rowId, summary });
}

// Adds one record; returns it (with its generated id) so the caller can update its model.
export async function addRecord(fileId, tab, fields, summary = '') {
  const rec = { id: crypto.randomUUID(), ...fields, created_by: currentEmail(), created_at: nowIso(), void: false, void_reason: '' };
  await appendRows(fileId, tab, [toRow(tab, rec)]);
  await appendRows(fileId, 'audit', [auditRow('add', tab, rec.id, summary)]);
  return rec;
}

// Marks a record void (never deletes). `rec` must come from loadModel so it has its sheet row.
export async function voidRecord(fileId, tab, rec, reason = '') {
  const cols = TABS[tab];
  const voidCol = columnLetter(cols.indexOf('void') + 1);
  const reasonCol = columnLetter(cols.indexOf('void_reason') + 1);
  await updateRange(fileId, `${tab}!${voidCol}${rec._row}:${reasonCol}${rec._row}`, [['1', reason]]);
  await appendRows(fileId, 'audit', [auditRow('void', tab, rec.id, reason)]);
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
