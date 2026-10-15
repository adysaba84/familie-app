import { toRon, fromRon, depositIncluded, latestBalances, brokerGroups, monthEnd, addMonths, PROPERTY_KINDS, propertyValue } from './calc.js';

// "Situații": the family position in layers. PURE (no DOM, no network).
//   DISPONIBIL   = cash: current accounts, wallets, vouchers, savings, deposits, cash in the safe, credit cards counted
//                  as `balance - limit` (<= 0 = what was spent), and (Iza) insurance surrender value
//   PENSII       = "disponibili cu vanzare" (brokers - all instruments, physical gold, Gent: can be sold, not cash) and
//                  "indisponibili pana la pensie" (pillars 2 and 3)
//   INDISPONIBIL = property (house, car, garage) and loans given: counted, but cannot be touched right away
//   WEALTH 1     = disponibil + pensii disponibili cu vanzare (bursa, aur, Gent)            [no pillars, no loans, no property]
//   WEALTH 2     = wealth 1 + property (casa, masina, garaj)                                [still no pillars, no loans]
//   The pillars (P2/P3) and the loans given are shown as EXCLUDED: they are in their layers but in neither wealth.
// Every number is in RON bani at `asOf` (euro is derived by the caller); disponibil also carries the native amount
// per currency (lei / euro / dolari), like the Excel "cash lei / cash eur / cash usd".
const live = (r) => !r.void;

// pension accounts that can be sold (surrender value); every other pension account is a locked pillar
export const SELLABLE_PENSION_INSTITUTIONS = ['Gent'];
export const isSellablePension = (a) => SELLABLE_PENSION_INSTITUTIONS.includes(a.institution);

// [key, label, section]; `section` groups the lines of a layer that has sub-sections (Pensii)
export const LAYERS = {
  disponibil: [
    ['conturi', 'Conturi, portofele, tichete'], ['economii', 'Economii'], ['depozite', 'Depozite'],
    ['seif', 'Numerar în seif'], ['asigurari', 'Asigurări (valoare de răscumpărare)'], ['carduri', 'Carduri de credit (cheltuit)'],
  ],
  pensii: [
    ['bursa', 'Bursă', 'vanzare'], ['aur', 'Aur fizic', 'vanzare'], ['gent', 'Gent (valoare de răscumpărare)', 'vanzare'],
    ['piloni', 'Pilon 2 și 3', 'pensie'],
  ],
  indisponibil: [['imobile', 'Casă, mașină, garaj'], ['imprumuturi', 'Împrumuturi date (nu pot fi atinse imediat)']],
};
export const PENSII_SECTIONS = { vanzare: 'Disponibili cu vânzare', pensie: 'Indisponibili până la pensie' };
// Wealth 1 / 2 and the excluded amounts, from the three layers (also used on combined layers: everything is additive).
function wealths(disponibil, pensii, indisponibil) {
  const sellable = pensii.lines.filter((l) => l.section === 'vanzare').reduce((t, l) => t + l.ron, 0);
  const of = (layer, key) => layer.lines.find((l) => l.key === key).ron;
  const wealth1 = disponibil.total + sellable;
  return { wealth1, wealth2: wealth1 + of(indisponibil, 'imobile'), excluded: { piloni: of(pensii, 'piloni'), imprumuturi: of(indisponibil, 'imprumuturi') } };
}


function emptyLayer(defs) {
  return { lines: defs.map(([key, label, section]) => ({ key, label, section, ron: 0 })), total: 0 };
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
  bursa: ['pensii', 'bursa'], aur: ['pensii', 'aur'],
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

// `rateDate`: convert at the rates of that date instead of asOf (so two dates can be compared at ONE rate: the exchange-rate
// move on unchanged euro / dollar amounts is then not mistaken for growth).
export function situation(model, asOf, { rateDate } = {}) {
  const rates = model.rates;
  const rd = rateDate || asOf;
  const disponibil = emptyLayer(LAYERS.disponibil);
  const pensii = emptyLayer(LAYERS.pensii);
  const indisponibil = emptyLayer(LAYERS.indisponibil);
  const native = { RON: 0, EUR: 0, USD: 0 };
  const addNative = (ccy, minor) => { native[ccy] = (native[ccy] || 0) + minor; };
  const accounts = new Map(model.accounts.map((a) => [a.id, a]));
  // `items`: what each line is made of (one entry per account / deposit / item, native amount + lei), collected while
  // the line is summed, so the expandable lists on the Active screen can never disagree with the totals.
  const items = {};
  const put = (layer, key, ron, item) => { bump(layer, key, ron); (items[key] = items[key] || []).push({ ...item, ron }); };

  // balances: one latest balance per account, put in its layer by the account kind
  for (const b of latestBalances(model, asOf).values()) {
    const a = accounts.get(b.account_id);
    if (!a || a.status === 'closed') continue;
    const ccy = a.currency_default;
    const ron = toRon(b.balance_minor, ccy, rates, rd);
    const it = { label: a.name, sub: a.owner, native: b.balance_minor, currency: ccy, date: b.date, accountId: a.id };
    if (a.kind === 'savings') { put(disponibil, 'economii', ron, it); addNative(ccy, b.balance_minor); }
    else if (a.kind === 'insurance') { put(disponibil, 'asigurari', ron, it); addNative(ccy, b.balance_minor); }
    else if (a.kind === 'card') {
      const limit = cardLimit(model, a.id);
      if (limit != null) { const used = b.balance_minor - limit; put(disponibil, 'carduri', toRon(used, ccy, rates, rd), { ...it, native: used }); addNative(ccy, used); }
    } else if (a.kind === 'pension') put(pensii, isSellablePension(a) ? 'gent' : 'piloni', ron, it);
    else if (a.kind === 'loan') put(indisponibil, 'imprumuturi', ron, it);
    else if (['current', 'wallet', 'voucher'].includes(a.kind)) { put(disponibil, 'conturi', ron, it); addNative(ccy, b.balance_minor); }
  }

  for (const d of model.deposits) {
    if (!depositIncluded(d, asOf)) continue;
    const acc = accounts.get(d.account_id);
    put(disponibil, 'depozite', toRon(d.principal_minor, d.currency, rates, rd), { label: acc ? `${acc.institution} · ${acc.owner}` : 'Depozit',
      sub: `${(d.rate_bp / 100).toFixed(2).replace('.', ',')}%`, native: d.principal_minor, currency: d.currency, date: d.maturity_date, depositId: d.id, overdue: d.status === 'active' && d.maturity_date < asOf });
    addNative(d.currency, d.principal_minor);
  }

  // physical items: cash in the safe (disponibil), gold (bursă și aur), property (indisponibil)
  const pv = new Map();
  const values = model.physical_values.filter((v) => live(v) && v.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at || '') < (b.created_at || '') ? -1 : (a.created_at || '') > (b.created_at || '') ? 1 : (a._row || 0) - (b._row || 0)));
  for (const v of values) pv.set(v.item_id, v);
  for (const it of model.physical_items) {
    if (!live(it) || (it.purchase_date > asOf && !PROPERTY_KINDS.includes(it.kind))) continue; // property counts at every date
    const v = pv.get(it.id);
    const row = { label: it.description || it.kind, sub: '', currency: it.currency, date: v ? v.date : it.purchase_date, itemId: it.id };
    if (it.kind === 'gold') { const n = v ? v.value_minor : it.purchase_value_minor || 0; put(pensii, 'aur', n, { ...row, native: n, currency: 'RON' }); }
    else if (it.kind === 'cash') { const n = v ? v.value_minor : 0; put(disponibil, 'seif', toRon(n, it.currency, rates, rd), { ...row, native: n }); addNative(it.currency, n); }
    else if (PROPERTY_KINDS.includes(it.kind)) { const n = propertyValue(model, it, asOf); put(indisponibil, 'imobile', toRon(n, it.currency, rates, rd), { ...row, native: n }); }
  }

  // one entry per (broker account, currency): the same granularity brokerSummary sums, so the lines add up exactly
  for (const g of brokerGroups(model, asOf, 'platform')) {
    put(pensii, 'bursa', toRon(g.value, g.currency, rates, rd), { label: g.account ? `${g.account.institution} · ${g.account.owner}` : 'Broker', sub: '', native: g.value, currency: g.currency, date: g.valueDate, accountId: g.account ? g.account.id : null });
  }

  for (const s of snapshotRows(model, asOf)) {
    const [which, key] = SNAP_LAYER[s.group];
    const layer = which === 'disponibil' ? disponibil : pensii;
    put(layer, key, toRon(s.amount_minor, s.currency, rates, rd), { label: s.label, sub: 'total din Excel', native: s.amount_minor, currency: s.currency, date: s.date });
    if (which === 'disponibil') addNative(s.currency, s.amount_minor);
  }

  return { asOf, items, disponibil: { ...disponibil, native }, pensii, indisponibil, ...wealths(disponibil, pensii, indisponibil) };
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
  const pensii = merge((x) => x.pensii), indisponibil = merge((x) => x.indisponibil);
  const items = {};
  for (const x of list) for (const [k, v] of Object.entries(x.items || {})) items[k] = (items[k] || []).concat(v);
  return { asOf: list[0].asOf, items, disponibil, pensii, indisponibil, ...wealths(disponibil, pensii, indisponibil) };
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


// Change in euro between two dates, each amount converted at the rate of ITS OWN date: an unchanged euro amount is a
// change of 0, whatever the rate did in between (dividing a lei difference by today's rate would count the rate move).
export const eurGrowth = (rates, nowRon, nowDate, thenRon, thenDate) =>
  fromRon(nowRon, 'EUR', rates, nowDate) - fromRon(thenRon, 'EUR', rates, thenDate);

// The four segments of the wealth structure, from the SAME situation(): disponibil, pensii disponibili cu vanzare,
// pensii indisponibili pana la pensie (pillars), indisponibil (property + loans). They add up to the old "everything" total.
export function wealthStructure(sit) {
  const sellable = sit.pensii.lines.filter((l) => l.section === 'vanzare').reduce((t, l) => t + l.ron, 0);
  const pillars = sit.pensii.lines.filter((l) => l.section === 'pensie').reduce((t, l) => t + l.ron, 0);
  return [
    { key: 'disponibil', label: 'Disponibil', ron: sit.disponibil.total },
    { key: 'vanzare', label: 'Pensii · cu vânzare', ron: sellable },
    { key: 'pensie', label: 'Pensii · până la pensie', ron: pillars },
    { key: 'indisponibil', label: 'Indisponibil', ron: sit.indisponibil.total },
  ];
}

// Dates for the Wealth 1 evolution: only days with real entries (at least `min` balance / broker value / physical value
// records dated exactly that day: a full update, not one stray value) plus today. No interpolation, no invented months.
export function wealthDates(model, today, min = 3) {
  const count = new Map();
  for (const k of ['balances', 'broker_values', 'physical_values']) {
    for (const r of model[k] || []) if (live(r) && r.date && r.date <= today) count.set(r.date, (count.get(r.date) || 0) + 1);
  }
  const dates = [...count].filter(([, n]) => n >= min).map(([d]) => d);
  if (!dates.includes(today)) dates.push(today);
  return dates.sort();
}
export const wealthSeries = (model, today) => wealthDates(model, today).map((date) => ({ date, ron: situation(model, date).wealth1 }));

// True when the first point predates the first deposit entered one by one: there the deposits come from savings accounts
// or Excel totals, so the step to the next point partly reflects the data arriving, not growth.
export function seriesStartsBeforeDeposits(model, series) {
  const starts = (model.deposits || []).filter((d) => !d.void && d.start_date).map((d) => d.start_date).sort();
  return !!series.length && !!starts.length && series[0].date < starts[0];
}

// The Active list: every line of situation() grouped as the screen shows it, each with its subtotal. `total` is the sum of
// ALL lines (disponibil + pensii + indisponibil, pillars and loans included): the same total as the structure bar, so the
// "% din total" of every row and subtotal shares one base. `groupRon` is the subtotal of the row's own group.
// Groups: Disponibil / Pensii cu vanzare / Pensii pana la pensie / Indisponibil, then the two Pensii sections are
// wrapped in a "Pensii" block that has its own total.
export function categoryGroups(sit) {
  const total = sit.disponibil.total + sit.pensii.total + sit.indisponibil.total;
  const mk = (key, title, lines) => {
    const sub = lines.reduce((t, l) => t + l.ron, 0);
    return { key, title, ron: sub, lines: lines.filter((l) => l.ron !== 0 || (sit.items[l.key] || []).length).map((l) => ({ ...l, groupRon: sub, items: sit.items[l.key] || [] })) };
  };
  const pl = (section) => sit.pensii.lines.filter((l) => l.section === section);
  const groups = [
    { key: 'disponibil', blocks: [mk('disponibil', 'Disponibil', sit.disponibil.lines)] },
    { key: 'pensii', title: 'Pensii', ron: sit.pensii.total, blocks: [mk('vanzare', PENSII_SECTIONS.vanzare, pl('vanzare')), mk('pensie', PENSII_SECTIONS.pensie, pl('pensie'))] },
    { key: 'indisponibil', blocks: [mk('indisponibil', 'Indisponibil', sit.indisponibil.lines)] },
  ];
  return { total, groups: groups.filter((g) => g.blocks.some((b) => b.lines.length)) };
}
