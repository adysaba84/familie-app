import { roundDiv } from './money.js';

// PURE functions (no DOM, no fetch): every number on screen comes from here.
// Dates are ISO strings 'YYYY-MM-DD'; money is integer minor units; rates are x10 000 RON per unit.

const INSTR_ORDER = ['stocks_etf', 'bonds', 'cash'];
export const BFG_LIMIT_EUR_MINOR = 100000 * 100;
export const STALE_DAYS = 30;
export const INTEREST_TAX_BP = 1000; // 10% on deposit interest

const live = (r) => !r.void;

// ---------- dates ----------
const parts = (d) => d.split('-').map(Number);
const utc = (d) => { const [y, m, day] = parts(d); return Date.UTC(y, m - 1, day); };
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);

export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);

export function addMonths(date, n) {
  const [y, m, d] = parts(date);
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12), nm = idx % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return isoOf(Date.UTC(ny, nm, Math.min(d, last)));
}

export const addDays = (date, n) => isoOf(utc(date) + n * 86400000);

export function monthEnd(date) {
  const [y, m] = parts(date);
  return isoOf(Date.UTC(y, m, 0));
}

// ---------- rates / conversion ----------
// Rate on or before `date`; falls back to the latest known rate (fallback: true so the UI can say
// "curs din <data>"). RON is always 10 000.
export function rateOn(rates, ccy, date) {
  if (ccy === 'RON') return { rate: 10000, date, fallback: false };
  const rows = rates.filter((r) => r[ccy] != null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); // same date: later row wins (a correction)
  if (rows.length === 0) throw new Error('no rate for ' + ccy);
  let hit = null;
  for (const r of rows) if (r.date <= date) hit = r;
  if (hit) return { rate: hit[ccy], date: hit.date, fallback: false };
  const last = rows[rows.length - 1];
  return { rate: last[ccy], date: last.date, fallback: true };
}

export function toRon(minor, ccy, rates, date) {
  return roundDiv(minor * rateOn(rates, ccy, date).rate, 10000);
}

export function fromRon(ronMinor, ccy, rates, date) {
  return roundDiv(ronMinor * 10000, rateOn(rates, ccy, date).rate);
}

// ---------- latest-record helper ----------
// Latest non-void row per key with date <= asOf. Ties: later created_at, then later sheet row.
function latestBy(rows, keyFn, asOf) {
  const cmp = (a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ca = a.created_at || '', cb = b.created_at || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return (a._row || 0) - (b._row || 0);
  };
  const map = new Map();
  for (const r of rows.filter((x) => live(x) && x.date <= asOf).sort(cmp)) map.set(keyFn(r), r);
  return map;
}

// ---------- broker ----------
// Invested per `${account}|${currency}` = sum(in) - sum(out), non-void, up to asOf.
export function investedByAccount(flows, asOf = '9999-12-31') {
  const out = new Map();
  for (const f of flows) {
    if (!live(f) || f.date > asOf) continue;
    const k = f.account_id + '|' + f.currency;
    out.set(k, (out.get(k) || 0) + (f.direction === 'in' ? f.amount_minor : -f.amount_minor));
  }
  return out;
}

// Latest value per (account, currency, instrument) as of a date.
export function latestBrokerValues(values, asOf) {
  return latestBy(values, (v) => `${v.account_id}|${v.currency}|${v.instrument}`, asOf);
}

// Value per `${account}|${currency}` (instruments summed).
export function brokerValueByAccount(values, asOf) {
  const out = new Map();
  for (const v of latestBrokerValues(values, asOf).values()) {
    const k = v.account_id + '|' + v.currency;
    out.set(k, (out.get(k) || 0) + v.value_minor);
  }
  return out;
}

export function brokerSummary(model, asOf) {
  const per = new Map();
  for (const c of brokerCells(model, asOf)) {
    const k = c.account_id + '|' + c.currency;
    const r = per.get(k) || { account_id: c.account_id, currency: c.currency, invested: 0, value: 0 };
    r.invested += c.invested; r.value += c.value;
    per.set(k, r);
  }
  const rows = [...per.keys()].sort().map((k) => ({ ...per.get(k), gain: per.get(k).value - per.get(k).invested }));
  let investedRon = 0, valueRon = 0;
  for (const r of rows) {
    investedRon += toRon(r.invested, r.currency, model.rates, asOf);
    valueRon += toRon(r.value, r.currency, model.rates, asOf);
  }
  return { rows, investedRon, valueRon, gainRon: valueRon - investedRon };
}

// ---------- deposits ----------
export const maturityFromStart = (start, termMonths) => addMonths(start, termMonths);
export const startFromMaturity = (maturity, termMonths) => addMonths(maturity, -termMonths);

// Gross interest estimate. Simple: principal * rate * days / 365. Capitalised: monthly compounding
// over the whole term. Rounded once at the end.
export function grossInterest({ principal_minor, rate_bp, term_months, start_date, maturity_date, capitalization }) {
  if (capitalization) {
    const r = rate_bp / 10000 / 12;
    return Math.round(principal_minor * (Math.pow(1 + r, term_months) - 1));
  }
  const days = daysBetween(start_date, maturity_date || addMonths(start_date, term_months));
  return roundDiv(principal_minor * rate_bp * days, 10000 * 365);
}

export const netOf = (gross) => gross - roundDiv(gross * INTEREST_TAX_BP, 10000);

export function depositIncluded(d, date) {
  if (!live(d) || d.status === 'broken') return false;
  return d.start_date <= date && (d.status === 'active' || d.maturity_date > date);
}

// Net interest per month across active deposits, in RON: sum(principal * rate * 0.9 / 12).
export function netInterestPerMonthRon(deposits, rates, asOf) {
  let total = 0;
  for (const d of deposits) {
    if (!depositIncluded(d, asOf) || d.status !== 'active') continue;
    const ron = toRon(d.principal_minor, d.currency, rates, asOf);
    total += (ron * d.rate_bp * (10000 - INTEREST_TAX_BP)) / (10000 * 10000 * 12);
  }
  return Math.round(total);
}

// Principal maturing in each of the next `months` calendar months (RON), for the maturity bars.
export function maturityBuckets(deposits, rates, today, months = 12) {
  const out = [];
  for (let i = 0; i < months; i++) {
    const key = addMonths(today.slice(0, 7) + '-01', i).slice(0, 7);
    let total = 0;
    for (const d of deposits) {
      if (live(d) && d.status === 'active' && d.maturity_date.slice(0, 7) === key && d.maturity_date >= today) {
        total += toRon(d.principal_minor, d.currency, rates, today);
      }
    }
    out.push({ month: key, totalRon: total });
  }
  return out;
}

// ---------- BFG ----------
// Covered amount per (institution, owner) in EUR minor: active deposits + savings/current balances.
export function bfgByBankOwner(model, asOf) {
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  const sums = new Map();
  const add = (account, ccy, minor) => {
    if (!account) return;
    const k = account.institution + '|' + account.owner;
    const eur = fromRon(toRon(minor, ccy, model.rates, asOf), 'EUR', model.rates, asOf);
    sums.set(k, (sums.get(k) || 0) + eur);
  };
  for (const d of model.deposits) if (depositIncluded(d, asOf)) add(acc.get(d.account_id), d.currency, d.principal_minor);
  for (const b of latestBy(model.balances, (r) => r.account_id, asOf).values()) {
    const a = acc.get(b.account_id);
    if (a && (a.kind === 'savings' || a.kind === 'current')) add(a, a.currency_default, b.balance_minor);
  }
  return [...sums.entries()].map(([k, eurMinor]) => {
    const [institution, owner] = k.split('|');
    return { institution, owner, eurMinor, pctBp: roundDiv(eurMinor * 10000, BFG_LIMIT_EUR_MINOR), over: eurMinor > BFG_LIMIT_EUR_MINOR };
  }).sort((a, b) => b.eurMinor - a.eurMinor);
}

// ---------- totals ----------
export function totalsByCategory(model, asOf) {
  const rates = model.rates;
  const broker = brokerSummary(model, asOf).valueRon;
  let deposits = 0;
  for (const d of model.deposits) if (depositIncluded(d, asOf)) deposits += toRon(d.principal_minor, d.currency, rates, asOf);

  let physical = 0;
  const pv = latestBy(model.physical_values, (v) => v.item_id, asOf);
  for (const it of model.physical_items) {
    if (!live(it) || it.purchase_date > asOf || !['gold', 'cash'].includes(it.kind)) continue; // property is its own thing (situations)
    const v = pv.get(it.id);
    physical += it.kind === 'gold'
      ? (v ? v.value_minor : it.purchase_value_minor || 0)
      : toRon(v ? v.value_minor : 0, it.currency, rates, asOf);
  }

  // balances: insurance (e.g. NN, value of the account) is its own category, never mixed into accounts/savings
  let accounts = 0, insurance = 0;
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  for (const b of latestBy(model.balances, (r) => r.account_id, asOf).values()) {
    const a = acc.get(b.account_id);
    if (!a) continue;
    const ron = toRon(b.balance_minor, a.currency_default, rates, asOf);
    if (a.kind === 'insurance') insurance += ron; else accounts += ron;
  }
  return { broker, deposits, physical, accounts, insurance, total: broker + deposits + physical + accounts + insurance };
}

// Month-by-month change for the last `months` months (needs months+1 snapshots).
// Each entry: total at month end (today for the current month), delta vs the previous month,
// delta per category, and newMoney = net broker deposits in the month (RON).
export function monthlyChange(model, today, months = 12) {
  const ends = [];
  for (let i = months; i >= 0; i--) {
    ends.push(i === 0 ? today : monthEnd(addMonths(today.slice(0, 7) + '-01', -i)));
  }
  const snaps = ends.map((d) => ({ date: d, ...totalsByCategory(model, d) }));
  const out = [];
  for (let i = 1; i < snaps.length; i++) {
    const p = snaps[i - 1], c = snaps[i];
    let newMoney = 0;
    for (const f of model.broker_flows) {
      if (!live(f) || f.date <= p.date || f.date > c.date) continue;
      newMoney += toRon(f.direction === 'in' ? f.amount_minor : -f.amount_minor, f.currency, model.rates, c.date);
    }
    out.push({
      month: c.date.slice(0, 7), date: c.date, total: c.total, delta: c.total - p.total, newMoney,
      byCategory: {
        broker: c.broker - p.broker, deposits: c.deposits - p.deposits,
        physical: c.physical - p.physical, accounts: c.accounts - p.accounts, insurance: c.insurance - p.insurance,
      },
    });
  }
  return out;
}

// ---------- staleness ----------
// Accounts whose latest record is older than 30 days (or that have none).
export function staleAccounts(model, today, days = STALE_DAYS) {
  const last = new Map();
  const note = (id, date) => { if (!last.has(id) || last.get(id) < date) last.set(id, date); };
  for (const b of model.balances) if (live(b)) note(b.account_id, b.date);
  for (const v of model.broker_values) if (live(v)) note(v.account_id, v.date);
  const out = [];
  for (const a of model.accounts) {
    if (!live(a) || a.status === 'closed' || !['current', 'savings', 'voucher', 'broker'].includes(a.kind)) continue;
    const d = last.get(a.id) || null;
    const age = d ? daysBetween(d, today) : null;
    if (age === null || age > days) out.push({ account: a, lastDate: d, days: age });
  }
  return out;
}

// ---------- broker: instrument detail, groupings, series ----------
// Invested per `${account}|${currency}|${instrument}` (flows without an instrument count as stocks_etf).
export function investedByInstrument(flows, asOf = '9999-12-31') {
  const out = new Map();
  for (const f of flows) {
    if (!live(f) || f.date > asOf) continue;
    const k = `${f.account_id}|${f.currency}|${f.instrument || 'stocks_etf'}`;
    out.set(k, (out.get(k) || 0) + (f.direction === 'in' ? f.amount_minor : -f.amount_minor));
  }
  return out;
}

// One record per (account, currency, instrument) with invested, value and the date of the last value.
function brokerCells(model, asOf) {
  const inv = investedByInstrument(model.broker_flows, asOf);
  const vals = latestBrokerValues(model.broker_values, asOf);
  const keys = new Set([...inv.keys(), ...vals.keys()]);
  return [...keys].sort().map((k) => {
    const [account_id, currency, instrument] = k.split('|');
    const v = vals.get(k);
    const invested = inv.get(k) || 0;
    // bonds (incl. titluri de stat) stay at investment value until a value is entered
    const value = v ? v.value_minor : instrument === 'bonds' ? invested : 0;
    return { account_id, currency, instrument, invested, value, valueDate: v ? v.date : null };
  });
}

// Groups for the Bursă table. by: 'platform' (account + currency, native amounts), 'instrument'
// (RON equivalents) or 'currency' (native amounts). `gainPctBp` is gain / invested in basis points.
export function brokerGroups(model, asOf, by) {
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  const groups = new Map();
  for (const c of brokerCells(model, asOf)) {
    const ron = by === 'instrument'; // only this grouping mixes currencies, so it is shown in RON
    const inv = ron ? toRon(c.invested, c.currency, model.rates, asOf) : c.invested;
    const val = ron ? toRon(c.value, c.currency, model.rates, asOf) : c.value;
    const key = by === 'platform' ? `${c.account_id}|${c.currency}` : by === 'instrument' ? c.instrument
      : by === 'instrumentCcy' ? `${c.instrument}|${c.currency}` : c.currency;
    const g = groups.get(key) || { key, currency: ron ? 'RON' : c.currency, instrument: null, invested: 0, value: 0, valueDate: null, instruments: new Set(), platforms: new Set(), parts: new Map() };
    if (by === 'platform') g.account = acc.get(c.account_id) || null;
    if (by === 'instrumentCcy') g.instrument = c.instrument;
    const a = acc.get(c.account_id);
    if (a) g.platforms.add(a.institution);
    g.invested += inv; g.value += val; g.instruments.add(c.instrument);
    const p = g.parts.get(c.instrument) || { invested: 0, value: 0 };
    p.invested += inv; p.value += val; g.parts.set(c.instrument, p);
    if (c.valueDate && (!g.valueDate || g.valueDate < c.valueDate)) g.valueDate = c.valueDate;
    groups.set(key, g);
  }
  return [...groups.values()].map((g) => ({
    ...g, instruments: [...g.instruments].sort(), platforms: [...g.platforms].sort(),
    parts: [...g.parts.entries()].map(([instrument, v]) => ({ instrument, ...v })).sort((x, y) => INSTR_ORDER.indexOf(x.instrument) - INSTR_ORDER.indexOf(y.instrument)),
    gain: g.value - g.invested,
    gainPctBp: g.invested > 0 ? roundDiv((g.value - g.invested) * 10000, g.invested) : null,
  })).sort((a, b) => (a.key < b.key ? -1 : 1));
}

// Invested vs value (RON) at the end of each of the last `months` months (the last point is `today`).
export function brokerSeries(model, today, months = 12) {
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = i === 0 ? today : monthEnd(addMonths(today.slice(0, 7) + '-01', -i));
    const s = brokerSummary(model, d);
    out.push({ date: d, investedRon: s.investedRon, valueRon: s.valueRon });
  }
  return out;
}

// Value of one broker account in RON at a date (instruments and currencies summed).
export function accountValueRon(model, accountId, asOf) {
  let total = 0;
  for (const v of latestBrokerValues(model.broker_values, asOf).values()) {
    if (v.account_id === accountId) total += toRon(v.value_minor, v.currency, model.rates, asOf);
  }
  return total;
}

// Net deposits (in - out) of one account in RON in (after, upTo].
export function accountNetFlowsRon(model, accountId, after, upTo) {
  let total = 0;
  for (const f of model.broker_flows) {
    if (!live(f) || f.account_id !== accountId || f.date <= after || f.date > upTo) continue;
    total += toRon(f.direction === 'in' ? f.amount_minor : -f.amount_minor, f.currency, model.rates, upTo);
  }
  return total;
}

// Latest date on or before asOf that has a value for the account (or null).
export function lastValueDate(model, accountId, asOf) {
  let last = null;
  for (const v of model.broker_values) {
    if (live(v) && v.account_id === accountId && v.date <= asOf && (!last || last < v.date)) last = v.date;
  }
  return last;
}

// ---------- currency split ----------
// Native total per currency (EUR in euro, USD in dollars...), plus the RON equivalent; gold is its own line.
export function currencyBreakdown(model, asOf) {
  const native = new Map();
  const add = (k, minor) => native.set(k, (native.get(k) || 0) + minor);
  for (const c of brokerCells(model, asOf)) add(c.currency, c.value);
  for (const d of model.deposits) if (depositIncluded(d, asOf)) add(d.currency, d.principal_minor);
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  for (const b of latestBy(model.balances, (r) => r.account_id, asOf).values()) {
    const a = acc.get(b.account_id);
    if (a) add(a.currency_default, b.balance_minor);
  }
  const pv = latestBy(model.physical_values, (v) => v.item_id, asOf);
  for (const it of model.physical_items) {
    if (!live(it) || it.purchase_date > asOf || !['gold', 'cash'].includes(it.kind)) continue;
    const v = pv.get(it.id);
    if (it.kind === 'gold') add('AUR', v ? v.value_minor : it.purchase_value_minor || 0);
    else add(it.currency, v ? v.value_minor : 0);
  }
  return [...native.entries()].filter(([, n]) => n !== 0).map(([currency, n]) => ({
    currency, native: n, ron: currency === 'AUR' ? n : toRon(n, currency, model.rates, asOf),
  })).sort((a, b) => b.ron - a.ron);
}

// ---------- M4: deposits list, concentration, physical, accounts ----------
export const latestBalances = (model, asOf) => latestBy(model.balances, (r) => r.account_id, asOf);

// Net interest per month (RON or any currency) on a savings balance: balance * rate * 0.9 / 12.
export const monthlyNetInterest = (balanceMinor, rateBp) =>
  roundDiv(balanceMinor * rateBp * (10000 - INTEREST_TAX_BP), 10000 * 10000 * 12);

// Active deposits by maturity, each with estimated gross/net interest and days left (negative = overdue).
export function depositRows(model, asOf) {
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  return model.deposits.filter((d) => live(d) && d.status === 'active').map((d) => {
    const gross = grossInterest(d);
    return { deposit: d, account: acc.get(d.account_id) || null, gross, net: netOf(gross), daysLeft: daysBetween(asOf, d.maturity_date) };
  }).sort((a, b) => (a.deposit.maturity_date < b.deposit.maturity_date ? -1 : a.deposit.maturity_date > b.deposit.maturity_date ? 1 : 0));
}

// The month where the biggest share of active deposits (in RON) matures: { month, totalRon, shareBp }.
export function maturityConcentration(model, asOf) {
  const byMonth = new Map();
  let all = 0;
  for (const d of model.deposits) {
    if (!live(d) || d.status !== 'active') continue;
    const ron = toRon(d.principal_minor, d.currency, model.rates, asOf);
    const m = d.maturity_date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) || 0) + ron); all += ron;
  }
  let best = null;
  for (const [month, totalRon] of byMonth) if (!best || totalRon > best.totalRon) best = { month, totalRon };
  return best ? { ...best, shareBp: roundDiv(best.totalRon * 10000, all) } : null;
}

// Gold items: purchase vs latest value, gain, and the value history (purchase point first).
export function goldItems(model, asOf) {
  return model.physical_items.filter((it) => live(it) && it.kind === 'gold').map((it) => {
    const hist = model.physical_values.filter((v) => live(v) && v.item_id === it.id && v.date <= asOf)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((v) => ({ date: v.date, value: v.value_minor }));
    const last = hist[hist.length - 1];
    const purchase = it.purchase_value_minor || 0;
    const value = last ? last.value : purchase;
    return { item: it, purchase, value, valueDate: last ? last.date : it.purchase_date,
      gainBp: purchase > 0 ? roundDiv((value - purchase) * 10000, purchase) : null,
      history: purchase > 0 ? [{ date: it.purchase_date, value: purchase }, ...hist] : hist };
  });
}

// Cash in the safe: latest amount per cash item (native) and its RON equivalent.
export function safeCash(model, asOf) {
  const pv = latestBy(model.physical_values, (v) => v.item_id, asOf);
  return model.physical_items.filter((it) => live(it) && it.kind === 'cash').map((it) => {
    const v = pv.get(it.id);
    const native = v ? v.value_minor : 0;
    return { item: it, native, ron: toRon(native, it.currency, model.rates, asOf), valueDate: v ? v.date : null };
  });
}

// Latest balance, its date, the age in days, and the current rate for one account.
export function accountBalance(model, accountId, asOf) {
  const rows = model.balances.filter((b) => live(b) && b.account_id === accountId && b.date <= asOf)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.created_at || '') < (b.created_at || '') ? -1 : (a.created_at || '') > (b.created_at || '') ? 1 : (a._row || 0) - (b._row || 0)));
  const last = rows[rows.length - 1];
  const withRate = [...rows].reverse().find((r) => r.rate_bp != null);
  return {
    balance: last ? last.balance_minor : null, date: last ? last.date : null,
    days: last ? daysBetween(last.date, asOf) : null, rateBp: withRate ? withRate.rate_bp : null,
    history: rows.map((r) => ({ date: r.date, value: r.balance_minor })),
  };
}

// Active deposits summed per currency in their own currency (+ RON equivalent and count), RON, EUR, USD first.
export function depositTotalsByCurrency(model, asOf) {
  const by = new Map();
  for (const d of model.deposits) {
    if (!depositIncluded(d, asOf) || d.status !== 'active') continue;
    const g = by.get(d.currency) || { currency: d.currency, native: 0, ron: 0, count: 0 };
    g.native += d.principal_minor; g.ron += toRon(d.principal_minor, d.currency, model.rates, asOf); g.count++;
    by.set(d.currency, g);
  }
  const rank = (c) => ['RON', 'EUR', 'USD'].indexOf(c);
  return [...by.values()].sort((a, b) => (rank(a.currency) < 0 ? 9 : rank(a.currency)) - (rank(b.currency) < 0 ? 9 : rank(b.currency)));
}

// Property-like items (house, car, garage): latest value in its own currency + RON equivalent. Not part of the
// "Active" totals (they are not financial assets); they live in the indisponibil layer of the situations.
export const PROPERTY_KINDS = ['property', 'vehicle', 'garage'];
export function propertyItems(model, asOf) {
  const pv = latestBy(model.physical_values, (v) => v.item_id, asOf);
  return model.physical_items.filter((it) => live(it) && PROPERTY_KINDS.includes(it.kind)).map((it) => {
    const v = pv.get(it.id);
    const native = v ? v.value_minor : it.purchase_value_minor || 0;
    return { item: it, native, ron: toRon(native, it.currency, model.rates, asOf), valueDate: v ? v.date : it.purchase_date };
  });
}
