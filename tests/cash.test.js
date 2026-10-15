import { test, eq, ok } from './harness.js';
import { cashAvailable, depositInterestRon, periodMonths, cashWarnings, periodResult, savedPeriods, defaultStart } from '../js/cash.js';

// Invented family. EUR = 5 RON on 2026-09-15, 6 RON on 2026-10-15 (the rate moves, euro amounts do not).
const rates = [{ date: '2026-09-15', EUR: 50000 }, { date: '2026-10-15', EUR: 60000 }];
const acc = (id, kind, ccy = 'RON', owner = 'A') => ({ id, kind, institution: 'X', owner, name: id, currency_default: ccy, status: 'active' });
const bal = (account_id, date, balance_minor) => ({ account_id, date, balance_minor });
const mk = (o = {}) => ({ accounts: [], balances: [], deposits: [], rates, settings: [], physical_items: [], physical_values: [], broker_flows: [], broker_values: [], snapshots: [], ...o });
const income = (amount_minor, key = 'salar_ady') => ({ kind: 'income', key, amount_minor });
const invested = (amount_minor, key = 'bursa') => ({ kind: 'invested', key, amount_minor });
const D0 = '2026-09-15', D1 = '2026-10-15';

const parents = mk({ accounts: [acc('cur', 'current'), acc('eur', 'savings', 'EUR'), acc('ins', 'insurance')],
  balances: [bal('cur', D0, 100000), bal('cur', D1, 130000), bal('eur', D0, 10000), bal('eur', D1, 10000), bal('ins', D0, 50000), bal('ins', D1, 90000)] });
const iza = mk({ accounts: [acc('w', 'wallet', 'RON', 'I')], balances: [bal('w', D0, 2000), bal('w', D1, 2000)] });

test('cashAvailable: the whole family, insurance (NN) left out', () => {
  eq(cashAvailable([parents, iza], D0, D0), 100000 + 10000 * 5 + 2000); // 1.000 + 100 EUR at 5 + Iza wallet
  eq(cashAvailable([parents], D1, D1), 130000 + 10000 * 6); // the insurance 900 is not cash
});
test('sanity: cash grows by X, income Y, invested 0 -> expenses = Y - X (one month, constant rate)', () => {
  const r = periodResult([parents, iza], { d0: D0, d1: D1, items: [income(500000)] });
  // at d1 rates: before 1.000 + 100 EUR*6 + 20 ; after 1.300 + 600 + 20 -> X = 300 lei
  eq(r.delta, 30000); eq(r.expenses, 500000 - 30000); eq(r.interest, 0); eq(r.monthlyAvg, null);
});
test('exchange rate neutral: an unchanged euro account creates neither income nor expense', () => {
  const quiet = mk({ accounts: [acc('eur', 'savings', 'EUR')], balances: [bal('eur', D0, 10000), bal('eur', D1, 10000)] });
  const r = periodResult([quiet], { d0: D0, d1: D1, items: [] });
  eq(r.delta, 0); eq(r.expenses, 0);
  // each date at its own rate the 100 EUR would be 500 then 600 lei: +100 lei of fake income
  eq(cashAvailable([quiet], D1, D1) - cashAvailable([quiet], D0, D0), 10000);
});
test('NN of Iza (insurance) never counts as cash, even when its balance jumps', () => {
  const r = periodResult([parents], { d0: D0, d1: D1, items: [] });
  eq(r.delta, 30000); // only the current account moved; the insurance +400 did not
});
test('investment: a bank-to-broker move is not an expense; a negative investment (sale) is not income either', () => {
  const m = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', D0, 500000), bal('cur', D1, 400000)] });
  eq(periodResult([m], { d0: D0, d1: D1, items: [invested(100000)] }).expenses, 0); // 1.000 left cash into the broker
  const sale = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', D0, 400000), bal('cur', D1, 500000)] });
  eq(periodResult([sale], { d0: D0, d1: D1, items: [invested(-100000)] }).expenses, 0); // sold 1.000, cash +1.000
});
test('income minus investment minus cash growth, with several rows', () => {
  const m = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', D0, 100000), bal('cur', D1, 200000)] });
  const r = periodResult([m], { d0: D0, d1: D1, items: [income(900000), income(100000, 'alte_surse'), invested(300000, 'p3_ady'), invested(50000, 'nn_iza')] });
  eq(r.income, 1000000); eq(r.invested, 350000); eq(r.expenses, 1000000 - 350000 - 100000);
});
test('deposit interest: only deposits closed in the period, at the rates of d1', () => {
  const dep = (o) => ({ id: 'd', account_id: 'cur', currency: 'RON', status: 'matured', closed_date: '2026-10-01', interest_received_minor: 5400, ...o });
  const m = mk({ accounts: [acc('cur', 'current')], deposits: [dep({}), dep({ id: 'e', closed_date: D0 }), dep({ id: 'f', closed_date: '2026-11-01' }),
    dep({ id: 'g', void: true }), dep({ id: 'h', status: 'active', closed_date: '' }), dep({ id: 'i', currency: 'EUR', interest_received_minor: 1000, status: 'broken', closed_date: D1 })] });
  eq(depositInterestRon([m], D0, D1), 5400 + 1000 * 6); // d inside, i on d1 (EUR at 6); not e (on d0), f (later), g (void), h (open)
  eq(periodResult([m], { d0: D0, d1: D1, items: [] }).interest, 11400);
});
test('two-month period: shown as such, with a monthly average; one month has none', () => {
  eq(periodMonths('2026-08-15', '2026-10-15'), 2); eq(periodMonths(D0, D1), 1);
  const m = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', '2026-08-15', 100000), bal('cur', D1, 100000)] });
  const r = periodResult([m], { d0: '2026-08-15', d1: D1, items: [income(2000000)] });
  eq(r.months, 2); eq(r.expenses, 2000000); eq(r.monthlyAvg, 1000000);
});
test('warnings: accounts without a balance, without a new one in the period, or without an opening balance', () => {
  const m = mk({ accounts: [acc('ok', 'current'), acc('none', 'current'), acc('old', 'savings'), acc('new', 'wallet')],
    balances: [bal('ok', D0, 1), bal('ok', D1, 1), bal('old', '2026-08-01', 1), bal('new', D1, 1)] });
  const w = cashWarnings([m], D0, D1);
  eq(w.map((x) => x.name).sort(), ['new', 'none', 'old']);
  ok(w.find((x) => x.name === 'old').issue.includes('2026-08-01'));
  eq(cashWarnings([parents, iza], D0, D1), []);
});
test('savedPeriods / defaultStart: newest first with their items; the next page starts where the last one ended', () => {
  const p = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', '2026-09-20', 1), bal('cur', D1, 1)],
    cash_periods: [{ id: 'p1', date: '2026-08-15', prev_date: '2026-07-15' }, { id: 'p2', date: D0, prev_date: '2026-08-15' }, { id: 'p3', date: '2026-10-01', void: true }],
    cash_items: [{ id: 'i1', period_id: 'p2', kind: 'income', key: 'salar_ady', amount_minor: 5 }, { id: 'i2', period_id: 'p2', kind: 'income', key: 'x', amount_minor: 6, void: true }] });
  const sp = savedPeriods(p);
  eq(sp.map((x) => x.id), ['p2', 'p1']); eq(sp[0].items.map((i) => i.id), ['i1']);
  eq(defaultStart([p], p, D1), D0);
  const first = mk({ accounts: [acc('cur', 'current')], balances: [bal('cur', '2026-09-20', 1), bal('cur', D1, 1)] });
  eq(defaultStart([first], first, D1), '2026-09-20'); // first time: the latest earlier day with balances
  eq(defaultStart([mk()], mk(), D1), '2026-09-15'); // nothing at all: a month back
});
