import { test, eq } from './harness.js';
import { parseTable, toRow, columnLetter } from '../js/model.js';
import { TABS } from '../js/schema.js';

test('parseTable: typed fields, void flag, row numbers', () => {
  const rows = parseTable([
    ['id', 'date', 'amount_minor', 'void'],
    ['a', '2026-01-05', 150000, ''],
    ['b', '2026-02-01', '2500', '1'],
  ]);
  eq(rows.length, 2);
  eq(rows[0], { _row: 2, id: 'a', date: '2026-01-05', amount_minor: 150000, void: false });
  eq(rows[1].amount_minor, 2500);
  eq(rows[1].void, true);
  eq(rows[1]._row, 3);
});

test('parseTable: empty cells and blank rows', () => {
  const rows = parseTable([['id', 'amount_minor'], ['x'], ['', ''], []]);
  eq(rows.length, 1);
  eq(rows[0].amount_minor, null);
});

test('parseTable: header only / nothing', () => { eq(parseTable([['id']]), []); eq(parseTable([]), []); });

test('toRow: column order matches the schema and void serialises', () => {
  const row = toRow('broker_flows', { id: 'i', date: '2026-01-01', account_id: 'a', currency: 'EUR', amount_minor: 100, direction: 'in', void: false });
  eq(row.length, TABS.broker_flows.length);
  eq(row[TABS.broker_flows.indexOf('amount_minor')], 100);
  eq(row[TABS.broker_flows.indexOf('void')], '');
  eq(toRow('broker_flows', { void: true })[TABS.broker_flows.indexOf('void')], '1');
});

test('columnLetter', () => { eq(columnLetter(1), 'A'); eq(columnLetter(26), 'Z'); eq(columnLetter(27), 'AA'); eq(columnLetter(52), 'AZ'); });

test('schema: every data tab ends with the common void columns', () => {
  for (const [tab, cols] of Object.entries(TABS)) {
    if (['rates', 'notify', 'notifications_log', 'audit'].includes(tab)) continue;
    // deposits grew four closing columns after the common ones (sheets made earlier migrate by extending the header)
    const own = tab === 'deposits' ? cols.slice(0, -4) : cols;
    eq(own.slice(-4), ['created_by', 'created_at', 'void', 'void_reason'], tab);
  }
});
