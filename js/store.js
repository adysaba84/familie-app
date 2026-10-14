import { TABS } from './schema.js';
import { batchGet, appendRows, updateRange } from './sheets.js';
import { parseTable, toRow, columnLetter } from './model.js';
import { currentEmail } from './auth.js';

// Loads every tab of one spreadsheet into a typed in-memory model and writes back append-only:
// an edit is "void the old row + append a new one", and every write also appends an audit row.
const TAB_NAMES = Object.keys(TABS);
const nowIso = () => new Date().toISOString();

export async function loadModel(fileId) {
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
