import { createRouter } from '../js/router.js';
import { SCREENS } from '../js/screens.js';
import { SEED } from '../js/seed.js';

// Developer preview: the real screens running against an in-memory model. It contains NO data. To look at a
// layout, load a model from the console: `__setModels({ parents: {tab: values}, iza: {...} })` (rows as arrays
// of cells, header first, exactly as the app reads them from Sheets). Private data is read from the Sheets
// connector by hand and is never stored in this repo.
const TODAY = new URLSearchParams(location.search).get('today') || new Date().toISOString().slice(0, 10);
const empty = () => ({ accounts: [], broker_flows: [], broker_values: [], deposits: [], physical_items: [], physical_values: [], balances: [], wallet_balances: [], cash_periods: [], cash_items: [], rates: [], settings: [], notify: [], notifications_log: [], audit: [] });
const models = { parents: empty(), iza: empty() };
let seq = 0;
const stamp = (r) => ({ id: 'id' + ++seq, created_by: 'dev', created_at: '2026-01-01T00:00:00Z', void: false, void_reason: '', ...r });

const app = {
  email: 'dev@local', spaces: ['parents', 'iza'], space: 'parents', today: () => TODAY, canEdit: () => true,
  model: async (sp) => models[sp || app.space],
  add: async (s, tab, fields) => {
    const r = stamp({ ...fields, _row: models[s][tab].length + 2 }); models[s][tab].push(r);
    if (tab === 'wallet_balances') models[s].balances.push({ ...r, _tab: tab }); // the app merges this tab into balances on load
    return r;
  },
  addMany: async (s, tab, list) => list.map((f) => { const r = stamp({ ...f, _row: models[s][tab].length + 2 }); models[s][tab].push(r); return r; }),
  void: async (s, tab, rec) => { rec.void = true; },
  seedAccounts: async (s) => { SEED[s].forEach((a) => models[s].accounts.push(stamp({ ...a }))); },
  addRate: async (date, rates) => { for (const s of Object.keys(models)) models[s].rates.push(stamp({ date, ...rates, source: 'manual' })); },
  logout: () => {},
};
const router = createRouter(Object.fromEntries(Object.entries(SCREENS).map(([p, v]) => [p, () => v(app)])), '/active');
app.go = (p) => router.go(p);
app.rerender = () => router.render();

window.__setModels = async (tables) => {
  const { parseTable } = await import('../js/model.js');
  for (const [space, tabs] of Object.entries(tables)) {
    models[space] = empty();
    for (const [tab, values] of Object.entries(tabs)) models[space][tab] = parseTable(values);
  }
  router.render();
};
window.__models = models;
window.__app = app;
router.render();
