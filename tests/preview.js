import { createRouter } from '../js/router.js';
import { SCREENS } from '../js/screens.js';
import { SEED } from '../js/seed.js';
import { addMonths, monthEnd } from '../js/calc.js';

// Offline preview: the real screens running against an in-memory model with made-up data.
// Nothing here talks to Google; it exists to look at layouts and exercise the forms.
const TODAY = '2026-10-14';
const empty = () => ({ accounts: [], broker_flows: [], broker_values: [], deposits: [], physical_items: [], physical_values: [], balances: [], rates: [], notify: [], notifications_log: [], audit: [] });
const model = empty();
let seq = 0;
const stamp = (r) => ({ id: 'id' + ++seq, created_by: 'demo', created_at: '2026-01-01T00:00:00Z', void: false, void_reason: '', ...r });

SEED.parents.forEach((a) => model.accounts.push(stamp({ ...a })));
const acc = (inst, owner) => model.accounts.find((a) => a.institution === inst && a.owner === owner && a.kind === 'broker');
const xtb = acc('XTB', 'Ady'), tv = acc('Tradeville', 'Ady'), rev = acc('Revolut', 'Carmen');

const params = new URLSearchParams(location.search);
if (params.get('empty') !== '1') {
  model.rates.push({ date: '2026-10-14', EUR: 50800, USD: 43700, source: 'demo' }, { date: '2025-10-01', EUR: 49800, USD: 42500, source: 'demo' });
  for (let i = 11; i >= 0; i--) {
    const d = i === 0 ? TODAY : monthEnd(addMonths('2026-10-01', -i));
    const k = 12 - i;
    model.broker_flows.push(stamp({ date: d, account_id: xtb.id, currency: 'RON', instrument: 'stocks_etf', amount_minor: 200000, direction: 'in' }));
    model.broker_values.push(stamp({ date: d, account_id: xtb.id, currency: 'RON', instrument: 'stocks_etf', value_minor: 200000 * k + k * 9000 + (k % 3 === 0 ? -25000 : 8000) }));
    if (i % 2 === 0) model.broker_flows.push(stamp({ date: d, account_id: tv.id, currency: 'RON', instrument: 'stocks_etf', amount_minor: 500000, direction: 'in' }));
    model.broker_values.push(stamp({ date: d, account_id: tv.id, currency: 'RON', instrument: 'stocks_etf', value_minor: 500000 * (Math.floor(k / 2) + 1) + k * 31000 }));
  }
  model.broker_flows.push(stamp({ date: '2026-02-01', account_id: tv.id, currency: 'EUR', instrument: 'bonds', amount_minor: 1000000, direction: 'in' }));
  model.broker_flows.push(stamp({ date: '2026-02-01', account_id: tv.id, currency: 'RON', instrument: 'bonds', amount_minor: 2500000, direction: 'in' }));
  model.broker_values.push(stamp({ date: '2026-10-14', account_id: tv.id, currency: 'RON', instrument: 'cash', value_minor: 821 }));
  model.broker_flows.push(stamp({ date: '2026-03-01', account_id: rev.id, currency: 'EUR', instrument: 'stocks_etf', amount_minor: 26700, direction: 'in' }));
  model.broker_values.push(stamp({ date: '2026-09-03', account_id: rev.id, currency: 'EUR', instrument: 'stocks_etf', value_minor: 26400 }));
  const btC = model.accounts.find((a) => a.kind === 'deposit_bank' && a.institution === 'BT');
  const salt = model.accounts.find((a) => a.kind === 'deposit_bank' && a.institution === 'Salt');
  const D = (acc, ccy, p, bp, term, start, mat) => model.deposits.push(stamp({ account_id: acc.id, currency: ccy, principal_minor: p, rate_bp: bp, term_months: term, start_date: start, maturity_date: mat, capitalization: 0, auto_renew: 0, notify_days: 3, status: 'active' }));
  D(btC, 'RON', 1000000, 400, 1, '2026-09-15', '2026-10-15'); D(btC, 'RON', 1500000, 450, 3, '2026-07-18', '2026-10-18');
  D(btC, 'RON', 5000000, 525, 12, '2026-07-16', '2027-07-16'); D(btC, 'EUR', 2500000, 130, 12, '2026-07-16', '2027-07-16');
  D(btC, 'EUR', 100000, 130, 12, '2026-07-17', '2027-07-17'); D(btC, 'USD', 567565, 325, 12, '2026-06-02', '2027-06-02');
  D(salt, 'RON', 1027310, 530, 6, '2026-04-16', '2026-10-16'); D(salt, 'RON', 526661, 550, 6, '2026-08-13', '2027-02-13');
  model.physical_items.push(stamp({ kind: 'gold', currency: 'RON', description: '1 oz', quantity: 1, purchase_value_minor: 700000, purchase_date: '2026-01-05' }));
  model.physical_values.push(stamp({ item_id: model.physical_items[0].id, date: '2026-10-01', value_minor: 810000 }));
  const cur = model.accounts.find((a) => a.kind === 'current' && a.owner === 'Carmen' && a.institution === 'BT');
  model.balances.push(stamp({ account_id: cur.id, date: '2026-08-20', balance_minor: 2163800 }));
  const sav = model.accounts.find((a) => a.kind === 'savings' && a.owner === 'Carmen');
  [['2026-05-10', 1210000, 300], ['2026-07-10', 1310000, 300], ['2026-09-02', 1330000, 285], ['2026-10-02', 1398768, 285]].forEach(([d, b, r]) => model.balances.push(stamp({ account_id: sav.id, date: d, balance_minor: b, rate_bp: r })));
  model.physical_values.push(stamp({ item_id: model.physical_items[0].id, date: '2026-04-01', value_minor: 750000 }), stamp({ item_id: model.physical_items[0].id, date: '2026-07-01', value_minor: 790000 }));
  [['EUR', 500000], ['USD', 500000], ['RON', 1000000]].forEach(([c, v]) => { const it = stamp({ kind: 'cash', currency: c, description: 'Seif ' + c, quantity: 1, purchase_date: '2026-10-01' }); model.physical_items.push(it); model.physical_values.push(stamp({ item_id: it.id, date: '2026-10-01', value_minor: v })); });
}

const app = {
  email: 'demo@test', spaces: ['parents'], space: 'parents', today: () => TODAY, canEdit: () => true,
  model: async () => model,
  add: async (s, tab, fields) => { const r = stamp({ ...fields, _row: model[tab].length + 2 }); model[tab].push(r); return r; },
  addMany: async (s, tab, list) => list.map((f) => { const r = stamp({ ...f, _row: model[tab].length + 2 }); model[tab].push(r); return r; }),
  void: async (s, tab, rec) => { rec.void = true; },
  seedAccounts: async (s) => { SEED[s].forEach((a) => model.accounts.push(stamp({ ...a }))); },
  addRate: async (date, rates) => { model.rates.push({ date, ...rates, source: 'manual' }); },
  logout: () => {},
};
const router = createRouter(Object.fromEntries(Object.entries(SCREENS).map(([p, v]) => [p, () => v(app)])), '/active');
app.go = (p) => router.go(p);
app.rerender = () => router.render();
window.__model = model;
router.render();
