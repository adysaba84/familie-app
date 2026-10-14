import { toRon, depositIncluded, latestBalances, brokerSummary, monthEnd, addMonths, PROPERTY_KINDS } from './calc.js';

// "Situații": the family's position in the three layers the Excel uses. PURE (no DOM, no network).
//   DISPONIBIL   = cash only: current accounts, wallets, vouchers, savings, deposits, cash in the safe,
//                  insurance (surrender value) and credit cards counted as `balance - limit` (<= 0 = what was spent)
//   BURSĂ ȘI AUR = brokers (all instruments) and gold: not cash, not locked; they count only in wealth
//   INDISPONIBIL = money that is not at hand: property (house, car, garage), pillars 2/3, loans given
//   WEALTH       = disponibil + bursă și aur + indisponibil
// Every number is in RON bani at `asOf` (euro is derived by the caller); disponibil also carries the native amount
// per currency (lei / euro / dolari), like the Excel's "cash lei / cash eur / cash usd".
const live = (r) => !r.void;

export const LAYERS = {
  disponibil: [
    ['conturi', 'Conturi, portofele, tichete'], ['economii', 'Economii'], ['depozite', 'Depozite'],
    ['seif', 'Numerar în seif'], ['asigurari', 'Asigurări (valoare de răscumpărare)'], ['carduri', 'Carduri de credit (cheltuit)'],
  ],
  bursa: [['bursa', 'Bursă'], ['aur', 'Aur']],
  indisponibil: [['imobile', 'Casă, mașină, garaj'], ['pensii', 'Pensii (P2, P3)'], ['imprumuturi', 'Împrumuturi date']],
};

function emptyLayer(defs) {
  return { lines: defs.map(([key, label]) => ({ key, label, ron: 0 })), total: 0 };
}
const bump = (layer, key, ron) => { layer.lines.find((l) => l.key === key).ron += ron; layer.total += ron; };

// `settings` rows hold a credit card's limit as `card_limit:<account id>` = bani
function cardLimit(model, accountId) {
  const rows = (model.settings || []).filter(live).filter((r) => r.key === `card_limit:${accountId}`);
  return rows.length ? Number(rows[rows.length - 1].value) : null;
}

// ---- Excel snapshots -------------------------------------------------------------------------------------------
// Totals copied from the old spreadsheet for dates BEFORE the detailed records exist (deposits entered one by one only
// start in mid-2026, so the 31 dec 2025 total comes from here). A group's snapshots count only while asOf is earlier
// than the first detailed record of that group, so they can never be added on top of real records.
const SNAP_LAYER = {
  conturi: ['disponibil', 'conturi'], depozite: ['disponibil', 'depozite'], seif: ['disponibil', 'seif'],
  bursa: ['bursa', 'bursa'], aur: ['bursa', 'aur'],
};

export function detailStart(model, group) {
  const dates = [];
  const take = (rows, f) => { for (const r of rows || []) if (live(r)) { const d = f(r); if (d) dates.push(d); } };
  const kindOf = new Map(model.accounts.map((a) => [a.id, a.kind]));
  const itemKind = new Map((model.physical_items || []).map((i) => [i.id, i.kind]));
  if (group === 'conturi') take(model.balances, (r) => (['current', 'wallet', 'voucher'].includes(kindOf.get(r.account_id)) ? r.date : null));
  else if (group === 'depozite') take(model.deposits, (r) => r.start_date);
  else if (group === 'seif' || group === 'aur') {
    const k = group === 'seif' ? 'cash' : 'gold';
    take(model.physical_items, (r) => (r.kind === k ? r.purchase_date : null));
    take(model.physical_values, (r) => (itemKind.get(r.item_id) === k ? r.date : null));
  } else if (group === 'bursa') { take(model.broker_flows, (r) => r.date); take(model.broker_values, (r) => r.date); }
  return dates.sort()[0] || '9999-12-31';
}

// Latest snapshot per (group, label, currency) on or before asOf. `all` keeps the ones a detailed group already covers.
export function snapshotRows(model, asOf, { all = false } = {}) {
  const best = new Map();
  for (const r of (model.snapshots || []).filter(live)) {
    if (!SNAP_LAYER[r.group] || r.date > asOf) continue;
    const k = `${r.group}|${r.label}|${r.currency}`, cur = best.get(k);
    if (!cur || r.date > cur.date || (r.date === cur.date && (r._row || 0) > (cur._row || 0))) best.set(k, r);
  }
  const starts = {};
  return [...best.values()].map((r) => {
    if (!(r.group in starts)) starts[r.group] = detailStart(model, r.group);
    return { ...r, used: asOf < starts[r.group] };
  }).filter((r) => all || r.used);
}

export function situation(model, asOf) {
  const rates = model.rates;
  const disponibil = emptyLayer(LAYERS.disponibil);
  const bursa = emptyLayer(LAYERS.bursa);
  const indisponibil = emptyLayer(LAYERS.indisponibil);
  const native = { RON: 0, EUR: 0, USD: 0 };
  const addNative = (ccy, minor) => { native[ccy] = (native[ccy] || 0) + minor; };
  const accounts = new Map(model.accounts.map((a) => [a.id, a]));

  // balances: one latest balance per account, put in its layer by the account kind
  for (const b of latestBalances(model, asOf).values()) {
    const a = accounts.get(b.account_id);
    if (!a || a.status === 'closed') continue;
    const ccy = a.currency_default;
    const ron = toRon(b.balance_minor, ccy, rates, asOf);
    if (a.kind === 'savings') { bump(disponibil, 'economii', ron); addNative(ccy, b.balance_minor); }
    else if (a.kind === 'insurance') { bump(disponibil, 'asigurari', ron); addNative(ccy, b.balance_minor); }
    else if (a.kind === 'card') {
      const limit = cardLimit(model, a.id);
      if (limit != null) { const used = b.balance_minor - limit; bump(disponibil, 'carduri', toRon(used, ccy, rates, asOf)); addNative(ccy, used); }
    } else if (a.kind === 'pension') bump(indisponibil, 'pensii', ron);
    else if (a.kind === 'loan') bump(indisponibil, 'imprumuturi', ron);
    else if (['current', 'wallet', 'voucher'].includes(a.kind)) { bump(disponibil, 'conturi', ron); addNative(ccy, b.balance_minor); }
  }

  for (const d of model.deposits) {
    if (!depositIncluded(d, asOf) || d.status !== 'active') continue;
    bump(disponibil, 'depozite', toRon(d.principal_minor, d.currency, rates, asOf));
    addNative(d.currency, d.principal_minor);
  }

  // physical items: cash in the safe (disponibil), gold (bursă și aur), property (indisponibil)
  const pv = new Map();
  const values = model.physical_values.filter((v) => live(v) && v.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at || '') < (b.created_at || '') ? -1 : (a.created_at || '') > (b.created_at || '') ? 1 : (a._row || 0) - (b._row || 0)));
  for (const v of values) pv.set(v.item_id, v);
  for (const it of model.physical_items) {
    if (!live(it) || it.purchase_date > asOf) continue;
    const v = pv.get(it.id);
    if (it.kind === 'gold') bump(bursa, 'aur', v ? v.value_minor : it.purchase_value_minor || 0);
    else if (it.kind === 'cash') { const n = v ? v.value_minor : 0; bump(disponibil, 'seif', toRon(n, it.currency, rates, asOf)); addNative(it.currency, n); }
    else if (PROPERTY_KINDS.includes(it.kind)) bump(indisponibil, 'imobile', toRon(v ? v.value_minor : it.purchase_value_minor || 0, it.currency, rates, asOf));
  }

  bump(bursa, 'bursa', brokerSummary(model, asOf).valueRon);

  for (const s of snapshotRows(model, asOf)) {
    const [which, key] = SNAP_LAYER[s.group];
    const layer = which === 'disponibil' ? disponibil : bursa;
    bump(layer, key, toRon(s.amount_minor, s.currency, rates, asOf));
    if (which === 'disponibil') addNative(s.currency, s.amount_minor);
  }

  return { asOf, disponibil: { ...disponibil, native }, bursa, indisponibil, wealth: disponibil.total + bursa.total + indisponibil.total };
}

// Several spaces (e.g. parents + Iza) added together, line by line.
export function combine(list) {
  if (!list.length) return null;
  const merge = (pick) => {
    const first = pick(list[0]);
    const lines = first.lines.map((l, i) => ({ ...l, ron: list.reduce((s, x) => s + pick(x).lines[i].ron, 0) }));
    return { lines, total: lines.reduce((s, l) => s + l.ron, 0) };
  };
  const native = {};
  for (const x of list) for (const [c, v] of Object.entries(x.disponibil.native)) native[c] = (native[c] || 0) + v;
  const disponibil = { ...merge((x) => x.disponibil), native };
  const bursa = merge((x) => x.bursa), indisponibil = merge((x) => x.indisponibil);
  return { asOf: list[0].asOf, disponibil, bursa, indisponibil, wealth: disponibil.total + bursa.total + indisponibil.total };
}

// The comparison dates: the end of last month and the end of last year (start of this year).
export function comparisonDates(today) {
  return { month: monthEnd(addMonths(today.slice(0, 7) + '-01', -1)), year: `${Number(today.slice(0, 4)) - 1}-12-31` };
}

// Earliest date with any balance / broker / physical record: before it the comparison would only show the data
// arriving (everything was entered at once), so the screen warns.
export function historyStart(model) {
  const dates = [];
  for (const k of ['balances', 'broker_flows', 'broker_values', 'physical_values']) for (const r of model[k] || []) if (live(r) && r.date) dates.push(r.date);
  return dates.sort()[0] || null;
}

