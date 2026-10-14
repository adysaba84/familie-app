import { roundDiv } from './money.js';

// PURE functions (no DOM, no fetch): every number on screen comes from here.
// Dates are ISO strings 'YYYY-MM-DD'; money is integer minor units; rates are x10 000 RON per unit.

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

export function monthEnd(date) {
  const [y, m] = parts(date);
  return isoOf(Date.UTC(y, m, 0));
}

// ---------- rates / conversion ----------
// Rate on or before `date`; falls back to the latest known rate (fallback: true so the UI can say
// "curs din <data>"). RON is always 10 000.
export function rateOn(rates, ccy, date) {
  if (ccy === 'RON') return { rate: 10000, date, fallback: false };
  const rows = rates.filter((r) => r[ccy] != null).sort((a, b) => (a.date < b.date ? -1 : 1));
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
  const invested = investedByAccount(model.broker_flows, asOf);
  const value = brokerValueByAccount(model.broker_values, asOf);
  const keys = new Set([...invested.keys(), ...value.keys()]);
  const rows = [...keys].sort().map((k) => {
    const [account_id, currency] = k.split('|');
    const inv = invested.get(k) || 0, val = value.get(k) || 0;
    return { account_id, currency, invested: inv, value: val, gain: val - inv };
  });
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
    if (!live(it) || it.purchase_date > asOf) continue;
    const v = pv.get(it.id);
    physical += it.kind === 'gold'
      ? (v ? v.value_minor : it.purchase_value_minor || 0)
      : toRon(v ? v.value_minor : 0, it.currency, rates, asOf);
  }

  let accounts = 0;
  const acc = new Map(model.accounts.map((a) => [a.id, a]));
  for (const b of latestBy(model.balances, (r) => r.account_id, asOf).values()) {
    const a = acc.get(b.account_id);
    if (a) accounts += toRon(b.balance_minor, a.currency_default, rates, asOf);
  }
  return { broker, deposits, physical, accounts, total: broker + deposits + physical + accounts };
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
        physical: c.physical - p.physical, accounts: c.accounts - p.accounts,
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
