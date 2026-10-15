import { TABS } from './schema.js';

// Pure helpers: Sheets values (array of arrays, header first) <-> typed rows. No network here.
const NUMERIC = new Set([
  'amount_minor', 'value_minor', 'principal_minor', 'rate_bp', 'term_months', 'capitalization', 'auto_renew',
  'notify_days', 'purchase_value_minor', 'balance_minor', 'days_before_maturity', 'EUR', 'USD', 'XAU', 'quantity', 'interest_received_minor',
]);

// Each row keeps `_row` (1-based sheet row number) so a later edit can find it.
export function parseTable(values) {
  if (!values || values.length === 0) return [];
  const [header, ...rows] = values;
  const out = [];
  rows.forEach((cells, i) => {
    if (cells.every((c) => c === '' || c == null)) return;
    const o = { _row: i + 2 };
    header.forEach((col, j) => {
      const raw = cells[j] == null ? '' : String(cells[j]);
      if (col === 'void') o.void = raw === '1';
      else if (NUMERIC.has(col)) o[col] = raw === '' ? null : Number(raw);
      else o[col] = raw;
    });
    out.push(o);
  });
  return out;
}

// Object -> array of cells in the tab's column order (void boolean back to ''/'1').
export function toRow(tab, obj) {
  return TABS[tab].map((col) => {
    const v = obj[col];
    if (col === 'void') return v ? '1' : '';
    return v == null ? '' : v;
  });
}

// 1 -> A, 26 -> Z, 27 -> AA
export function columnLetter(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
