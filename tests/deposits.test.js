import { test, eq, ok, throws } from './harness.js';
import {
  depositIncluded, depositOverdue, depositEndDate, depositRows, depositTotalsByCurrency, totalsByCategory, bfgByBankOwner,
  netInterestPerMonthRon, maturityBuckets, maturityConcentration, planClose, planRollover, closeInterestEstimate, destinationAccounts, accountBalance,
} from '../js/calc.js';
import { situation } from '../js/situations.js';

// Invented numbers. 1 EUR = 5 RON.
const rates = [{ date: '2026-01-01', EUR: 50000, USD: 40000 }];
const acc = (id, kind, ccy = 'RON', owner = 'A') => ({ id, kind, institution: id === 'bank' ? 'Banca' : 'X', owner, name: id, currency_default: ccy, status: 'active' });
const dep = (o) => ({ id: 'd', account_id: 'bank', currency: 'RON', principal_minor: 1000000, rate_bp: 600, term_months: 12, capitalization: 0, status: 'active',
  start_date: '2025-10-20', maturity_date: '2026-10-20', ...o });
const base = (deposits, balances = []) => ({
  accounts: [acc('bank', 'deposit_bank'), acc('cur', 'current'), acc('cur-eur', 'current', 'EUR'), acc('other', 'current', 'RON', 'B')],
  deposits, balances, rates, broker_flows: [], broker_values: [], physical_items: [], physical_values: [], snapshots: [], settings: [],
});
const total = (m, d) => totalsByCategory(m, d).deposits;

test('depositEndDate: active none; closed uses closed_date, else maturity', () => {
  eq(depositEndDate(dep({})), null);
  eq(depositEndDate(dep({ status: 'broken', closed_date: '2026-10-15' })), '2026-10-15');
  eq(depositEndDate(dep({ status: 'matured' })), '2026-10-20');
});
test('depositIncluded: broken counts until its closing day (exclusive), not retroactively', () => {
  const d = dep({ status: 'broken', closed_date: '2026-10-15' });
  eq(depositIncluded(d, '2026-09-26'), true);
  eq(depositIncluded(d, '2026-10-14'), true);
  eq(depositIncluded(d, '2026-10-15'), false);
  eq(depositIncluded(d, '2026-12-01'), false);
  eq(depositIncluded(d, '2025-10-19'), false);
});
test('depositIncluded: matured at maturity, and matured late (closed after maturity) counts until closed', () => {
  eq(depositIncluded(dep({ status: 'matured', closed_date: '2026-10-20' }), '2026-10-19'), true);
  eq(depositIncluded(dep({ status: 'matured', closed_date: '2026-10-20' }), '2026-10-20'), false);
  eq(depositIncluded(dep({ status: 'matured', closed_date: '2026-10-25' }), '2026-10-22'), true);
});
test('depositIncluded: old closed rows without closed_date end at maturity; void never counts', () => {
  eq(depositIncluded(dep({ status: 'matured' }), '2026-10-19'), true);
  eq(depositIncluded(dep({ status: 'matured' }), '2026-10-20'), false);
  eq(depositIncluded(dep({ status: 'broken' }), '2026-10-19'), true);
  eq(depositIncluded(dep({ void: true }), '2026-01-01'), false);
});
test('overdue active deposit: still on hand, flagged, out of interest and maturity buckets', () => {
  const d = dep({ maturity_date: '2026-10-10' });
  eq(depositOverdue(d, '2026-10-15'), true);
  eq(depositOverdue(d, '2026-10-10'), false);
  eq(depositOverdue(dep({ status: 'matured' }), '2026-12-01'), false);
  const m = base([d]);
  eq(total(m, '2026-10-15'), 1000000);
  eq(depositTotalsByCurrency(m, '2026-10-15')[0].native, 1000000);
  eq(netInterestPerMonthRon([d], rates, '2026-10-15'), 0);
  eq(maturityBuckets([d], rates, '2026-10-15', 3).map((b) => b.totalRon), [0, 0, 0]);
  eq(maturityConcentration(m, '2026-10-15'), null);
  const rows = depositRows(m, '2026-10-15');
  eq(rows.length, 1); eq(rows[0].overdue, true);
  ok(bfgByBankOwner(m, '2026-10-15').length === 1, 'still counted for BFG');
});

// ---- the scenario that started this: active on 26 Sept, closed today ----
test('closing: 26.09 unchanged, today not counted, money in the destination account', () => {
  const d = dep({});
  const m0 = base([d], [{ account_id: 'cur', date: '2026-09-30', balance_minor: 200000 }]);
  const before = total(m0, '2026-09-26');
  const plan = planClose(m0, d, { status: 'broken', date: '2026-10-15', interestMinor: 20000, toAccountId: 'cur' });
  eq(plan.closed.status, 'broken'); eq(plan.closed.closed_date, '2026-10-15'); eq(plan.closed.interest_received_minor, 20000);
  eq(plan.balance, { account_id: 'cur', date: '2026-10-15', balance_minor: 200000 + 1000000 + 20000, rate_bp: '' });
  // apply: old row voided, closed row added, balance row added
  const m1 = base([{ ...d, void: true }, { ...plan.closed, id: 'c1' }], [...m0.balances, plan.balance]);
  eq(total(m1, '2026-09-26'), before);
  eq(total(m1, '2026-10-14'), 1000000);
  eq(total(m1, '2026-10-15'), 0);
  eq(total(m1, '2026-11-01'), 0);
  // the money moved, it did not vanish: deposits + accounts is conserved at the closing day, plus the interest
  const t0 = totalsByCategory(m0, '2026-10-14'), t1 = totalsByCategory(m1, '2026-10-15');
  eq(t1.deposits + t1.accounts, t0.deposits + t0.accounts + 20000);
});
test('closing: without the destination balance the total would drop (what the form prevents)', () => {
  const d = dep({});
  const m = base([{ ...d, void: true }, { ...d, id: 'c1', status: 'broken', closed_date: '2026-10-15' }], [{ account_id: 'cur', date: '2026-09-30', balance_minor: 200000 }]);
  eq(totalsByCategory(m, '2026-10-15').total < totalsByCategory(m, '2026-10-14').total, true);
});
test('planClose: broken must be before maturity, matured not before it, destination required and same currency', () => {
  const d = dep({});
  const m = base([d]);
  throws(() => planClose(m, d, { status: 'broken', date: '2026-10-20', interestMinor: 0, toAccountId: 'cur' }));
  throws(() => planClose(m, d, { status: 'matured', date: '2026-10-19', interestMinor: 0, toAccountId: 'cur' }));
  throws(() => planClose(m, d, { status: 'matured', date: '2026-10-20', interestMinor: 0 }));
  throws(() => planClose(m, d, { status: 'matured', date: '2026-10-20', interestMinor: 0, toAccountId: 'cur-eur' }));
  throws(() => planClose(m, { ...d, status: 'matured' }, { status: 'matured', date: '2026-10-20', interestMinor: 0, toAccountId: 'cur' }));
  throws(() => planClose(m, d, { status: 'matured', date: '2026-10-20', interestMinor: -1, toAccountId: 'cur' }));
});
test('planClose: matured at maturity builds on the latest balance, flags later balances, replaces same-day one', () => {
  const d = dep({});
  const bal = [
    { account_id: 'cur', date: '2026-10-01', balance_minor: 500000, rate_bp: 100 },
    { account_id: 'cur', date: '2026-10-20', balance_minor: 700000 },
    { account_id: 'cur', date: '2026-11-05', balance_minor: 900000 },
  ];
  const p = planClose(base([d], bal), d, { status: 'matured', date: '2026-10-20', interestMinor: 54000, toAccountId: 'cur' });
  eq(p.balance.balance_minor, 700000 + 1054000);
  eq(p.voidBalances.length, 1); eq(p.laterBalances.length, 1); eq(p.laterBalances[0].date, '2026-11-05');
  eq(p.toMinor, 1054000);
});
test('closeInterestEstimate: full term at maturity, simple pro rata before it', () => {
  eq(closeInterestEstimate(dep({}), '2026-10-20'), 54000);
  const half = closeInterestEstimate(dep({}), '2026-04-20'); // 182 days
  eq(half, Math.round(1000000 * 600 * 182 / 3650000) - Math.round(Math.round(1000000 * 600 * 182 / 3650000) * 0.1));
});
test('destinationAccounts: same owner and currency, current/savings/wallet only', () => {
  eq(destinationAccounts(base([dep({})]), dep({})).map((a) => a.id), ['cur']);
});

// ---- rollover ----
test('rollover: two linked periods, no double count on the pivot day, interest becomes principal', () => {
  const d = dep({});
  const m0 = base([d]);
  const p = planRollover(m0, d, { interestMinor: 54000, next: { principal_minor: 1054000, rate_bp: 500, term_months: 6, capitalization: 0 } });
  eq(p.toMinor, 0); eq(p.balance, null); eq(p.closed.closed_to_account_id, '');
  eq(p.fresh.start_date, '2026-10-20'); eq(p.fresh.maturity_date, '2027-04-20'); eq(p.fresh.principal_minor, 1054000);
  const m1 = base([{ ...d, void: true }, { ...p.closed, id: 'c1' }, { ...p.fresh, id: 'n1', renewed_from_id: 'c1' }]);
  eq(total(m1, '2026-10-19'), 1000000);
  eq(total(m1, '2026-10-20'), 1054000); // pivot day: only the new one
  eq(total(m1, '2026-12-01'), 1054000);
  eq(depositRows(m1, '2026-12-01').map((r) => r.deposit.id), ['n1']);
  eq(netInterestPerMonthRon(m1.deposits, rates, '2026-12-01'), Math.round(1054000 * 500 * 0.9 / 120000));
});
test('rollover: a different amount sends the difference to the chosen account', () => {
  const d = dep({});
  const m = base([d], [{ account_id: 'cur', date: '2026-10-01', balance_minor: 100000 }]);
  const p = planRollover(m, d, { interestMinor: 54000, toAccountId: 'cur', next: { principal_minor: 1000000, rate_bp: 500, term_months: 12, capitalization: 1 } });
  eq(p.toMinor, 54000); eq(p.balance.balance_minor, 154000); eq(p.fresh.capitalization, 1);
  throws(() => planRollover(m, d, { interestMinor: 54000, next: { principal_minor: 1000000, rate_bp: 500, term_months: 12 } }), 'difference needs an account');
  throws(() => planRollover(m, d, { interestMinor: 54000, next: { principal_minor: 0, rate_bp: 500, term_months: 12 } }));
});
test('rollover: adding money from an account lowers its balance', () => {
  const d = dep({});
  const m = base([d], [{ account_id: 'cur', date: '2026-10-01', balance_minor: 500000 }]);
  const p = planRollover(m, d, { interestMinor: 54000, toAccountId: 'cur', next: { principal_minor: 1254000, rate_bp: 500, term_months: 12 } });
  eq(p.toMinor, -200000); eq(p.balance.balance_minor, 300000);
});

// ---- the other aggregations use the same rule ----
test('aggregations agree on a closed deposit: situations, per-currency, BFG, past dates', () => {
  const d = dep({ status: 'broken', closed_date: '2026-10-15' });
  const m = base([d]);
  eq(depositTotalsByCurrency(m, '2026-10-14')[0].native, 1000000);
  eq(depositTotalsByCurrency(m, '2026-10-15'), []);
  eq(bfgByBankOwner(m, '2026-10-14').length, 1);
  eq(bfgByBankOwner(m, '2026-10-15').length, 0);
  const dl = (day) => situation(m, day).disponibil.lines.find((l) => l.key === 'depozite').ron;
  eq(dl('2026-10-14'), 1000000);
  eq(dl('2026-10-15'), 0);
  eq(depositRows(m, '2026-10-15'), []);
});
test('matured then viewed in the past: still counted (a past date)', () => {
  const d = dep({ status: 'matured', closed_date: '2026-10-20' });
  eq(depositTotalsByCurrency(base([d]), '2026-09-26')[0].native, 1000000);
});
test('accountBalance sanity for the destination', () => {
  eq(accountBalance(base([], [{ account_id: 'cur', date: '2026-10-15', balance_minor: 5 }]), 'cur', '2026-10-15').balance, 5);
});
