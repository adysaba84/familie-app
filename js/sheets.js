import { getToken } from './auth.js';
import { TABS } from './schema.js';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function api(url, opts = {}) {
  const t = await getToken();
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!r.ok) throw new ApiError(r.status, `Google API ${r.status}`);
  return r.json();
}

const enc = encodeURIComponent;

// Drive says whether this user may edit the file: this is the real permission, enforced by Google.
export function fileAccess(id) {
  return api(`https://www.googleapis.com/drive/v3/files/${enc(id)}?fields=id,name,capabilities/canEdit`);
}

// With drive.file, Drive lists exactly the files this person has granted the app (created or
// picked once, in any device), so the app finds its files itself on every new device.
export async function listAppSpreadsheets() {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains 'FIN'");
  const r = await api(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=100&fields=files(id,name,capabilities/canEdit)`);
  return r.files || [];
}

// Creates a spreadsheet owned by the signed-in user, with every tab and its header row.
export async function createSpreadsheet(title) {
  const sheets = Object.entries(TABS).map(([name, cols]) => ({
    properties: { title: name, gridProperties: { frozenRowCount: 1 } },
    data: [{
      startRow: 0, startColumn: 0,
      rowData: [{ values: cols.map((c) => ({ userEnteredValue: { stringValue: c } })) }],
    }],
  }));
  const res = await api('https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId', {
    method: 'POST',
    body: JSON.stringify({ properties: { title }, sheets }),
  });
  return res.spreadsheetId;
}

// ---- values API (used by store.js) ----
export async function batchGet(id, tabs) {
  const qs = tabs.map((t) => 'ranges=' + enc(t)).join('&');
  const r = await api(`https://sheets.googleapis.com/v4/spreadsheets/${enc(id)}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`);
  return r.valueRanges.map((v) => v.values || []);
}

// Appends rows at the end of a tab. Append-only: the app never deletes a row.
export function appendRows(id, tab, rows) {
  return api(
    `https://sheets.googleapis.com/v4/spreadsheets/${enc(id)}/values/${enc(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: rows }) },
  );
}

export function updateRange(id, range, rows) {
  return api(
    `https://sheets.googleapis.com/v4/spreadsheets/${enc(id)}/values/${enc(range)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: rows }) },
  );
}

// Tabs of a spreadsheet, and creation of a missing tab (editors only; a read-only user gets a 403 and the caller skips it).
export async function tabTitles(id) {
  const r = await api(`https://sheets.googleapis.com/v4/spreadsheets/${enc(id)}?fields=sheets.properties.title`);
  return (r.sheets || []).map((x) => x.properties.title);
}

export async function addTab(id, title, header) {
  await api(`https://sheets.googleapis.com/v4/spreadsheets/${enc(id)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } }] }),
  });
  await updateRange(id, `${title}!A1`, [header]);
}
