import { toRon, fromRon, brokerGroups, depositIncluded, latestBalances, accountBalance, daysBetween, addMonths } from './calc.js';
import { roundDiv } from './money.js';

// Iza's "boxes" and the estimate at 18. PURE (no DOM, no network). The numbers that identify a person
// (birth date, monthly amounts) are NOT in this public code: they come from the `settings` tab of her file.
// Only generic, public assumptions live here as defaults (moderate scenario).
const live = (r) => !r.void;
const DEFAULTS = { adult_age: 18, etf_rate_bp: 700, nn_rate_bp: 500, bond_rate_bp: 710, fx_drift_bp: 200 };

export const BOXES = [
  { key: 'foreign', label: 'Euro și dolari', text: 'Bani în monede străine, ținuți la bancă. Banca îți plătește dobândă ca să-i țină.' },
  { key: 'nn', label: 'Asigurarea NN', text: 'O pușculiță care se deschide când ai 18 ani. Banii sunt investiți în fonduri și cresc în timp.' },
  { key: 'bursa', label: 'Bursa', text: 'Bucăți mici din companii mari. Când lor le merge bine, și ție îți merge bine. Se adaugă câte puțin în fiecare lună.' },
  { key: 'bond', label: 'Împrumut la stat', text: 'Ai împrumutat bani statului. În schimb, statul îți plătește dobândă în fiecare an.' },
  { key: 'savings', label: 'Contul tău de economii', text: 'Aici intră în fiecare lună alocația ta. Aici ajung și banii de ziua ta.' },
];

// Latest non-void value per key (later created_at, then later row, wins).
export function settingsMap(model) {
  const rows = (model.settings || []).filter(live).sort((a, b) => {
    const ca = a.created_at || '', cb = b.created_at || '';
    return ca !== cb ? (ca < cb ? -1 : 1) : (a._row || 0) - (b._row || 0);
  });
  const m = new Map();
  for (const r of rows) m.set(r.key, r.value);
  return m;
}

// null when there is no birth date (then only "total now" and the boxes can be shown).
export function planParams(model) {
  const s = settingsMap(model);
  if (!s.has('birth_date') || !/^\d{4}-\d{2}-\d{2}$/.test(s.get('birth_date'))) return null;
  const n = (k, d) => (s.has(k) && s.get(k) !== '' && !Number.isNaN(Number(s.get(k))) ? Number(s.get(k)) : d);
  return {
    birth: s.get('birth_date'), adultAge: n('adult_age', DEFAULTS.adult_age),
    nnRonMonth: n('contrib_nn_ron_month', 0), etfRonMonth: n('contrib_etf_ron_month', 0),
    savingsRonMonth: n('contrib_savings_ron_month', 0), familyEurYear: n('contrib_family_eur_year', 0),
    etfRateBp: n('etf_rate_bp', DEFAULTS.etf_rate_bp), nnRateBp: n('nn_rate_bp', DEFAULTS.nn_rate_bp),
    bondRateBp: n('bond_rate_bp', DEFAULTS.bond_rate_bp), fxDriftBp: n('fx_drift_bp', DEFAULTS.fx_drift_bp),
  };
}

// Everything Iza has, split into the five boxes, in EUR minor units at `asOf`.
export function izaBoxes(model, asOf) {
  const ron = { foreign: 0, nn: 0, bursa: 0, bond: 0, savings: 0 };
  const rates = model.rates;
  const add = (box, minor, ccy) => { ron[box] += toRon(minor, ccy, rates, asOf); };
  const accounts = new Map(model.accounts.map((a) => [a.id, a]));

  for (const d of model.deposits) {
    if (!depositIncluded(d, asOf)) continue;
    add(d.currency === 'RON' ? 'savings' : 'foreign', d.principal_minor, d.currency);
  }
  for (const b of latestBalances(model, asOf).values()) {
    const a = accounts.get(b.account_id);
    if (!a) continue;
    const ccy = a.currency_default;
    add(a.kind === 'insurance' ? 'nn' : ccy === 'RON' ? 'savings' : 'foreign', b.balance_minor, ccy);
  }
  for (const g of brokerGroups(model, asOf, 'instrumentCcy')) {
    add(g.instrument === 'bonds' ? 'bond' : 'bursa', g.value, g.currency);
  }
  const pv = new Map();
  for (const v of model.physical_values.filter((x) => live(x) && x.date <= asOf).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) pv.set(v.item_id, v);
  for (const it of model.physical_items) {
    if (!live(it) || it.purchase_date > asOf || !['gold', 'cash'].includes(it.kind)) continue; // property and other goods are not part of the plan
    const v = pv.get(it.id);
    const minor = v ? v.value_minor : it.purchase_value_minor || 0;
    add(it.kind === 'cash' && it.currency !== 'RON' ? 'foreign' : 'savings', minor, it.kind === 'gold' ? 'RON' : it.currency);
  }
  const boxes = BOXES.map((b) => ({ ...b, eur: fromRon(ron[b.key], 'EUR', rates, asOf) }));
  return { boxes, totalEur: boxes.reduce((s, b) => s + b.eur, 0) };
}

const eurRate = (rates, asOf) => toRon(100, 'EUR', rates, asOf) / 100; // RON per EUR

// Month-by-month projection to each coming birthday (moderate scenario). Euro terms: lei-based boxes lose
// `fx_drift` per year against the euro; foreign deposits do not. Returns the ladder [{age, date, eur}].
export function projectIza(model, asOf) {
  const p = planParams(model);
  if (!p) return null;
  const { boxes, totalEur } = izaBoxes(model, asOf);
  const val = Object.fromEntries(boxes.map((b) => [b.key, b.eur]));
  const rates = model.rates;
  const drift = p.fxDriftBp / 10000;
  const ronPerEur = eurRate(rates, asOf);

  // rates: foreign = principal-weighted net deposit rate; savings = the savings account's own rate
  let wRate = 0, wSum = 0;
  for (const d of model.deposits) {
    if (!depositIncluded(d, asOf) || d.currency === 'RON') continue;
    const w = toRon(d.principal_minor, d.currency, rates, asOf);
    wRate += w * d.rate_bp * 0.9; wSum += w;
  }
  const foreignRate = wSum ? wRate / wSum / 10000 : 0.018;
  const sav = model.accounts.find((a) => live(a) && a.kind === 'savings');
  const savRate = (sav && accountBalance(model, sav.id, asOf).rateBp != null ? accountBalance(model, sav.id, asOf).rateBp : 450) / 10000;
  const monthly = (annual, lei) => Math.pow((1 + annual) / (lei ? 1 + drift : 1), 1 / 12);
  const g = {
    foreign: monthly(foreignRate, false), nn: monthly(p.nnRateBp / 10000, true), bursa: monthly(p.etfRateBp / 10000, true),
    bond: monthly(p.bondRateBp / 10000, true), savings: monthly(savRate, true),
  };

  const ageNow = Math.floor(daysBetween(p.birth, asOf) / 365.2425);
  const ladder = [{ age: ageNow, date: asOf, eur: totalEur }];
  const targets = [];
  for (let age = ageNow + 1; age <= p.adultAge; age++) {
    const date = addMonths(p.birth, 12 * age);
    targets.push({ age, date, months: Math.max(1, Math.round(daysBetween(asOf, date) / 30.4375)) });
  }
  const last = targets.length ? targets[targets.length - 1].months : 0;
  let t = 0;
  for (let m = 1; m <= last; m++) {
    const lei = Math.pow(1 + drift, m / 12) * ronPerEur; // RON per EUR, drifting
    val.foreign *= g.foreign;
    val.nn = val.nn * g.nn + p.nnRonMonth / lei;
    val.bursa = val.bursa * g.bursa + p.etfRonMonth / lei;
    val.bond *= g.bond;
    val.savings = val.savings * g.savings + p.savingsRonMonth / lei + p.familyEurYear / 12;
    while (t < targets.length && targets[t].months === m) {
      ladder.push({ age: targets[t].age, date: targets[t].date, eur: roundDiv(Object.values(val).reduce((s, x) => s + x, 0) * 1, 1) });
      t++;
    }
  }
  return { ageNow, ladder, atAdult: ladder.length > 1 ? ladder[ladder.length - 1] : null, params: p };
}

// The most recent date anything was entered (for "ultima actualizare").
export function lastUpdate(model) {
  const dates = [];
  for (const k of ['broker_flows', 'broker_values', 'balances', 'physical_values']) for (const r of model[k] || []) if (live(r) && r.date) dates.push(r.date);
  for (const d of model.deposits || []) if (live(d) && d.start_date) dates.push(d.start_date);
  return dates.sort().pop() || null;
}
