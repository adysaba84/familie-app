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
