import { test, eq, ok } from './harness.js';
import {
  daysBetween, addMonths, monthEnd, rateOn, toRon, fromRon, investedByAccount, brokerValueByAccount, brokerSummary,
  maturityFromStart, startFromMaturity, grossInterest, netOf, depositIncluded, netInterestPerMonthRon, maturityBuckets,
  bfgByBankOwner, totalsByCategory, monthlyChange, staleAccounts,
} from '../js/calc.js';

const rates = [
  { date: '2026-01-02', EUR: 50000, USD: 45000 },
  { date: '2026-02-02', EUR: 51000, USD: 46000 },
  { date: '2026-03-02', EUR: 52000, USD: 47000 },
];

// ---- dates ----
test('daysBetween', () => { eq(daysBetween('2026-01-01', '2026-01-31'), 30); eq(daysBetween('2026-03-01', '2026-02-01'), -28); });
test('addMonths: clamps to month end', () => { eq(addMonths('2026-01-31', 1), '2026-02-28'); eq(addMonths('2024-01-31', 1), '2024-02-29'); });
test('addMonths: year roll, negative', () => { eq(addMonths('2026-11-15', 3), '2027-02-15'); eq(addMonths('2026-02-15', -3), '2025-11-15'); });
test('monthEnd', () => { eq(monthEnd('2026-02-10'), '2026-02-28'); eq(monthEnd('2026-12-01'), '2026-12-31'); });

// ---- rates ----
test('rateOn: exact and earlier date', () => { eq(rateOn(rates, 'EUR', '2026-02-02').rate, 51000); eq(rateOn(rates, 'EUR', '2026-02-20').date, '2026-02-02'); });
test('rateOn: before the first rate falls back to the latest, flagged', () => {
  const r = rateOn(rates, 'EUR', '2025-12-01');
  eq(r.fallback, true); eq(r.date, '2026-03-02');
});
test('rateOn: RON is 1', () => eq(rateOn([], 'RON', '2026-01-01').rate, 10000));
test('toRon / fromRon', () => { eq(toRon(10000, 'EUR', rates, '2026-02-10'), 51000); eq(fromRon(51000, 'EUR', rates, '2026-02-10'), 10000); eq(toRon(12345, 'RON', rates, '2026-01-01'), 12345); });

// ---- broker ----
const flows = [
  { id: 'f1', date: '2026-01-10', account_id: 'xtb', currency: 'EUR', amount_minor: 100000, direction: 'in' },
  { id: 'f2', date: '2026-02-10', account_id: 'xtb', currency: 'EUR', amount_minor: 30000, direction: 'out' },
  { id: 'f3', date: '2026-02-11', account_id: 'xtb', currency: 'EUR', amount_minor: 99999, direction: 'in', void: true },
  { id: 'f4', date: '2026-03-05', account_id: 'xtb', currency: 'EUR', amount_minor: 50000, direction: 'in' },
];
test('invested = in - out, void ignored', () => eq(investedByAccount(flows).get('xtb|EUR'), 120000));
test('invested respects the date', () => eq(investedByAccount(flows, '2026-02-28').get('xtb|EUR'), 70000));

const values = [
  { id: 'v1', date: '2026-01-31', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', value_minor: 100000 },
  { id: 'v2', date: '2026-02-28', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', value_minor: 80000 },
  { id: 'v3', date: '2026-02-28', account_id: 'xtb', currency: 'EUR', instrument: 'bonds', value_minor: 5000 },
  { id: 'v4', date: '2026-03-15', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', value_minor: 1, void: true },
];
test('latest value per instrument, summed, void ignored', () => eq(brokerValueByAccount(values, '2026-03-31').get('xtb|EUR'), 85000));
test('latest value respects the date', () => eq(brokerValueByAccount(values, '2026-02-10').get('xtb|EUR'), 100000));
test('same-day tie: later created_at wins', () => {
  const v = [
    { date: '2026-02-01', account_id: 'a', currency: 'RON', instrument: 'cash', value_minor: 1, created_at: '2026-02-01T08:00:00Z' },
    { date: '2026-02-01', account_id: 'a', currency: 'RON', instrument: 'cash', value_minor: 2, created_at: '2026-02-01T09:00:00Z' },
  ];
  eq(brokerValueByAccount(v, '2026-02-01').get('a|RON'), 2);
});

const model = {
  accounts: [
    { id: 'xtb', kind: 'broker', institution: 'XTB', owner: 'Ady', currency_default: 'EUR', status: 'active' },
    { id: 'bt-c', kind: 'deposit_bank', institution: 'BT', owner: 'Carmen', currency_default: 'RON', status: 'active' },
    { id: 'bt-cur', kind: 'current', institution: 'BT', owner: 'Carmen', currency_default: 'RON', status: 'active' },
    { id: 'sav', kind: 'savings', institution: 'Salt', owner: 'Ady', currency_default: 'RON', status: 'active' },
  ],
  broker_flows: flows,
  broker_values: values,
  deposits: [
    { id: 'd1', account_id: 'bt-c', currency: 'RON', principal_minor: 1000000, rate_bp: 600, term_months: 12, start_date: '2026-01-15', maturity_date: '2027-01-15', capitalization: 0, status: 'active' },
    { id: 'd2', account_id: 'bt-c', currency: 'EUR', principal_minor: 200000, rate_bp: 300, term_months: 6, start_date: '2026-02-01', maturity_date: '2026-08-01', capitalization: 0, status: 'active' },
  ],
  physical_items: [
    { id: 'gold', kind: 'gold', currency: 'RON', purchase_value_minor: 500000, purchase_date: '2026-01-05' },
    { id: 'cash', kind: 'cash', currency: 'EUR', purchase_date: '2026-01-05' },
  ],
  physical_values: [
    { item_id: 'gold', date: '2026-02-20', value_minor: 600000 },
    { item_id: 'cash', date: '2026-02-20', value_minor: 100000 },
  ],
  balances: [
    { account_id: 'bt-cur', date: '2026-01-20', balance_minor: 300000 },
    { account_id: 'bt-cur', date: '2026-03-10', balance_minor: 350000 },
    { account_id: 'sav', date: '2026-01-01', balance_minor: 1000000 },
  ],
  rates,
};

test('brokerSummary: per row and RON totals', () => {
  const s = brokerSummary(model, '2026-03-31');
  eq(s.rows[0], { account_id: 'xtb', currency: 'EUR', invested: 120000, value: 85000, gain: -35000 });
  eq(s.investedRon, toRon(120000, 'EUR', rates, '2026-03-31'));
  eq(s.gainRon, s.valueRon - s.investedRon);
});

// ---- deposits ----
test('maturity both ways', () => { eq(maturityFromStart('2026-01-31', 1), '2026-02-28'); eq(startFromMaturity('2027-01-15', 12), '2026-01-15'); });
test('grossInterest simple: 10 000 RON, 6%, 12 months', () =>
  eq(grossInterest({ principal_minor: 1000000, rate_bp: 600, start_date: '2026-01-15', maturity_date: '2027-01-15', capitalization: 0 }), 60000));
test('grossInterest simple: partial term uses days/365', () =>
  eq(grossInterest({ principal_minor: 1000000, rate_bp: 600, start_date: '2026-01-01', maturity_date: '2026-07-01', capitalization: 0 }), 29753));
test('grossInterest capitalised beats simple', () => {
  const g = grossInterest({ principal_minor: 1000000, rate_bp: 600, term_months: 12, start_date: '2026-01-15', capitalization: 1 });
  eq(g, 61678);
});
test('netOf = gross - 10%', () => { eq(netOf(60000), 54000); eq(netOf(0), 0); });
test('depositIncluded', () => {
  const d = model.deposits[0];
  eq(depositIncluded(d, '2026-01-14'), false); eq(depositIncluded(d, '2026-01-15'), true);
  eq(depositIncluded({ ...d, status: 'broken' }, '2026-06-01'), false);
  eq(depositIncluded({ ...d, void: true }, '2026-06-01'), false);
  eq(depositIncluded({ ...d, status: 'matured', maturity_date: '2026-05-01' }, '2026-06-01'), false);
});
test('netInterestPerMonthRon: 10 000 RON at 6% -> 45 RON/month', () =>
  eq(netInterestPerMonthRon([model.deposits[0]], rates, '2026-03-31'), 4500));
test('maturityBuckets', () => {
  const b = maturityBuckets(model.deposits, rates, '2026-03-31', 12);
  eq(b.length, 12); eq(b[0].month, '2026-03');
  eq(b.find((x) => x.month === '2026-08').totalRon, toRon(200000, 'EUR', rates, '2026-03-31'));
  eq(b.find((x) => x.month === '2027-01').totalRon, 1000000);
  eq(b.some((x) => x.month === '2027-03'), false);
});

// ---- BFG ----
test('BFG: per bank+owner in EUR, deposits + current balance, limit flag', () => {
  const r = bfgByBankOwner(model, '2026-03-31');
  const bt = r.find((x) => x.institution === 'BT' && x.owner === 'Carmen');
  const expected = fromRon(toRon(1000000, 'RON', rates, '2026-03-31'), 'EUR', rates, '2026-03-31')
    + 200000 + fromRon(350000, 'EUR', rates, '2026-03-31');
  eq(bt.eurMinor, expected); eq(bt.over, false);
});
test('BFG: over the 100 000 EUR limit', () => {
  const big = { ...model, deposits: [{ ...model.deposits[1], principal_minor: 10100000 }] };
  const r = bfgByBankOwner(big, '2026-03-31').find((x) => x.institution === 'BT');
  eq(r.over, true); ok(r.pctBp > 10000);
});
test('BFG: broker accounts are not covered', () => ok(!bfgByBankOwner(model, '2026-03-31').some((x) => x.institution === 'XTB')));

// ---- totals / monthly change ----
test('totals by category', () => {
  const t = totalsByCategory(model, '2026-03-31');
  eq(t.broker, toRon(85000, 'EUR', rates, '2026-03-31'));
  eq(t.deposits, 1000000 + toRon(200000, 'EUR', rates, '2026-03-31'));
  eq(t.physical, 600000 + toRon(100000, 'EUR', rates, '2026-03-31'));
  eq(t.accounts, 350000 + 1000000);
  eq(t.total, t.broker + t.deposits + t.physical + t.accounts);
});
test('totals: nothing before records exist', () => eq(totalsByCategory(model, '2025-12-31').total, 0));
test('monthlyChange: deltas add up and new money is net broker flow', () => {
  const m = monthlyChange(model, '2026-03-31', 3);
  eq(m.map((x) => x.month), ['2026-01', '2026-02', '2026-03']);
  const first = totalsByCategory(model, '2025-12-31').total;
  eq(m.reduce((s, x) => s + x.delta, 0), totalsByCategory(model, '2026-03-31').total - first);
  eq(m[0].newMoney, toRon(100000, 'EUR', rates, '2026-01-31'));
  eq(m[1].newMoney, toRon(-30000, 'EUR', rates, '2026-02-28'));
  eq(m[2].newMoney, toRon(50000, 'EUR', rates, '2026-03-31'));
  for (const x of m) eq(Object.values(x.byCategory).reduce((a, b) => a + b, 0), x.delta);
});

// ---- staleness ----
test('staleAccounts: older than 30 days or never recorded', () => {
  const s = staleAccounts(model, '2026-03-31');
  const ids = s.map((x) => x.account.id).sort();
  eq(ids, ['sav', 'xtb']);
  eq(s.find((x) => x.account.id === 'sav').days, 89);
  eq(s.find((x) => x.account.id === 'xtb').days, 31);
  eq(staleAccounts(model, '2026-04-10').map((x) => x.account.id).sort(), ['bt-cur', 'sav', 'xtb']);
});
test('staleAccounts: exactly 30 days is not stale', () => eq(staleAccounts({ ...model, accounts: [model.accounts[2]] }, '2026-04-09').length, 0));

// ---- M3 additions ----
import {
  addDays, investedByInstrument, brokerGroups, brokerSeries, accountValueRon, accountNetFlowsRon, lastValueDate, currencyBreakdown,
} from '../js/calc.js';
import { formatWhole } from '../js/money.js';

test('addDays', () => { eq(addDays('2026-03-01', -1), '2026-02-28'); eq(addDays('2026-12-31', 1), '2027-01-01'); });
test('formatWhole', () => { eq(formatWhole(53492049), '534.920'); eq(formatWhole(-150), '-2'); eq(formatWhole(0), '0'); eq(formatWhole(-10), '0'); });

const m3 = {
  ...model,
  broker_flows: [
    { date: '2026-01-10', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', amount_minor: 100000, direction: 'in' },
    { date: '2026-02-01', account_id: 'xtb', currency: 'EUR', instrument: 'bonds', amount_minor: 40000, direction: 'in' },
    { date: '2026-02-10', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', amount_minor: 10000, direction: 'out' },
  ],
  broker_values: [{ date: '2026-02-28', account_id: 'xtb', currency: 'EUR', instrument: 'stocks_etf', value_minor: 95000 }],
};
test('investedByInstrument: instrument split, missing instrument counts as stocks_etf', () => {
  const i = investedByInstrument([...m3.broker_flows, { date: '2026-03-01', account_id: 'xtb', currency: 'EUR', amount_minor: 500, direction: 'in' }]);
  eq(i.get('xtb|EUR|stocks_etf'), 90500); eq(i.get('xtb|EUR|bonds'), 40000);
});
test('bonds without a value row stay at investment value', () => {
  const g = brokerGroups(m3, '2026-03-31', 'platform')[0];
  eq(g.invested, 130000); eq(g.value, 95000 + 40000); eq(g.gain, 5000);
});
test('a bond value row overrides the invested default', () => {
  const m = { ...m3, broker_values: [...m3.broker_values, { date: '2026-03-01', account_id: 'xtb', currency: 'EUR', instrument: 'bonds', value_minor: 41000 }] };
  eq(brokerGroups(m, '2026-03-31', 'platform')[0].value, 95000 + 41000);
});
test('brokerGroups by instrument is in RON, by currency is native', () => {
  const ins = brokerGroups(m3, '2026-03-31', 'instrument');
  eq(ins.map((g) => g.key), ['bonds', 'stocks_etf']); eq(ins[0].currency, 'RON');
  eq(ins[0].value, toRon(40000, 'EUR', rates, '2026-03-31'));
  const cur = brokerGroups(m3, '2026-03-31', 'currency');
  eq(cur.length, 1); eq(cur[0].currency, 'EUR');
});
test('gainPctBp = gain / invested in basis points', () => eq(brokerGroups(m3, '2026-03-31', 'platform')[0].gainPctBp, 385));
test('brokerSummary agrees with the groups (bonds at cost)', () => {
  const s = brokerSummary(m3, '2026-03-31');
  eq(s.rows.length, 1); eq(s.rows[0].value, 135000);
  eq(s.valueRon, toRon(135000, 'EUR', rates, '2026-03-31'));
});
test('brokerSeries: 12 points, last is today, values follow the dates', () => {
  const s = brokerSeries(m3, '2026-03-31', 12);
  eq(s.length, 12); eq(s[11].date, '2026-03-31'); eq(s[0].investedRon, 0);
  eq(s[11].investedRon, toRon(130000, 'EUR', rates, '2026-03-31'));
});
test('accountValueRon / accountNetFlowsRon / lastValueDate', () => {
  eq(accountValueRon(m3, 'xtb', '2026-03-31'), toRon(95000, 'EUR', rates, '2026-03-31'));
  eq(accountNetFlowsRon(m3, 'xtb', '2026-01-31', '2026-02-28'), toRon(40000 - 10000, 'EUR', rates, '2026-02-28'));
  eq(lastValueDate(m3, 'xtb', '2026-03-31'), '2026-02-28'); eq(lastValueDate(m3, 'xtb', '2026-01-01'), null);
});
test('currencyBreakdown adds up to the category total (gold as its own line)', () => {
  const b = currencyBreakdown(model, '2026-03-31');
  eq(b.reduce((s, x) => s + x.ron, 0), totalsByCategory(model, '2026-03-31').total);
  eq(b.find((x) => x.currency === 'AUR').native, 600000);
  eq(b[0].ron >= b[b.length - 1].ron, true);
});
