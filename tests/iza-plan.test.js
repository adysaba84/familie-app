import { test, eq, ok } from './harness.js';
import { settingsMap, planParams, izaBoxes, projectIza, lastUpdate } from '../js/iza-plan.js';
import { totalsByCategory } from '../js/calc.js';

// An invented child and invented numbers (nothing here is real data). Round numbers on purpose.
const T = '2026-10-14';
const s = (key, value, extra = {}) => ({ key, value: String(value), created_at: '2026-10-14T10:00:00Z', ...extra });
const model = {
  accounts: [
    { id: 'tv', kind: 'broker', institution: 'Broker', owner: 'X', currency_default: 'RON' },
    { id: 'bank', kind: 'deposit_bank', institution: 'Bank', owner: 'X', currency_default: 'RON' },
    { id: 'sav', kind: 'savings', institution: 'Bank', owner: 'X', currency_default: 'RON' },
    { id: 'nn', kind: 'insurance', institution: 'Insurer', owner: 'X', currency_default: 'RON' },
  ],
  rates: [{ date: T, EUR: 50000, USD: 45000 }],
  broker_flows: [{ date: T, account_id: 'tv', currency: 'RON', instrument: 'bonds', amount_minor: 500000, direction: 'in' }],
  broker_values: [
    { date: T, account_id: 'tv', currency: 'RON', instrument: 'stocks_etf', value_minor: 800000 },
    { date: T, account_id: 'tv', currency: 'RON', instrument: 'cash', value_minor: 5000 },
  ],
  deposits: [
    { account_id: 'bank', currency: 'EUR', principal_minor: 600000, rate_bp: 200, term_months: 12, start_date: T, maturity_date: '2027-10-14', status: 'active' },
    { account_id: 'bank', currency: 'USD', principal_minor: 300000, rate_bp: 350, term_months: 12, start_date: T, maturity_date: '2027-10-14', status: 'active' },
  ],
  balances: [
    { account_id: 'sav', date: T, balance_minor: 200000, rate_bp: 450 },
    { account_id: 'nn', date: T, balance_minor: 3000000, rate_bp: null },
  ],
  physical_items: [], physical_values: [],
  settings: [s('birth_date', '2011-03-05'), s('contrib_nn_ron_month', 30000), s('contrib_etf_ron_month', 40000),
    s('contrib_savings_ron_month', 25000), s('contrib_family_eur_year', 60000)],
};

test('settingsMap: latest non-void value per key wins', () => {
  const m = settingsMap({ settings: [s('a', 1, { created_at: '2026-01-01T00:00:00Z' }), s('a', 2, { created_at: '2026-02-01T00:00:00Z' }), s('a', 3, { created_at: '2026-03-01T00:00:00Z', void: true })] });
  eq(m.get('a'), '2');
});
test('planParams: null without a birth date, defaults for the generic assumptions', () => {
  eq(planParams({ settings: [] }), null);
  const p = planParams(model);
  eq(p.birth, '2011-03-05'); eq(p.adultAge, 18); eq(p.etfRateBp, 700); eq(p.nnRonMonth, 30000);
});
test('izaBoxes: the five boxes add up to the total of the space', () => {
  const b = izaBoxes(model, T);
  const get = (k) => b.boxes.find((x) => x.key === k).eur;
  eq(get('foreign'), 870000); // 6.000 EUR + 3.000 USD (= 2.700 EUR)
  eq(get('nn'), 600000);
  eq(get('bursa'), 161000); // 8.050 lei
  eq(get('bond'), 100000); // 5.000 lei at cost
  eq(get('savings'), 40000);
  eq(b.totalEur, 1771000);
  eq(b.boxes.reduce((s2, x) => s2 + x.eur, 0), b.totalEur);
});
test('izaBoxes: matches totalsByCategory (in euro) within rounding', () => {
  const ron = totalsByCategory(model, T).total;
  eq(ron, 8855000);
  eq(izaBoxes(model, T).totalEur, Math.round((ron * 10000) / 50000));
});
test('projectIza: ladder to 18, growing every year', () => {
  const p = projectIza(model, T);
  eq(p.ageNow, 15);
  eq(p.ladder.map((x) => x.age), [15, 16, 17, 18]);
  eq(p.ladder[3].date, '2029-03-05');
  ok(p.atAdult.eur > 1771000 * 1.1 && p.atAdult.eur < 1771000 * 2, 'at 18: ' + p.atAdult.eur);
  for (let i = 1; i < p.ladder.length; i++) ok(p.ladder[i].eur > p.ladder[i - 1].eur, 'monotonic at ' + i);
});
test('projectIza: more monthly savings -> a bigger result; no birth date -> null', () => {
  const more = { ...model, settings: [...model.settings, s('contrib_savings_ron_month', 130000, { created_at: '2026-10-15T00:00:00Z' })] };
  ok(projectIza(more, T).atAdult.eur > projectIza(model, T).atAdult.eur);
  eq(projectIza({ ...model, settings: [] }, T), null);
});
test('lastUpdate: the newest date entered', () => eq(lastUpdate(model), '2026-10-14'));
