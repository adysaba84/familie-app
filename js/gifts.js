import { parseAmount } from './money.js';

// "Primite": a plain log of money Iza received (who, when, how much, why). Pure helpers, no DOM, no network.
// It is not tied to the other statistics: amounts are kept per currency and never converted.
export const CURRENCIES = ['RON', 'EUR', 'USD'];
export const OTHER = 'Altele…';
// generic reasons offered before the file has any; the ones already used in the file come first
export const DEFAULT_REASONS = ['Ziua Izei', 'Crăciun', 'Paște', '1 iunie', 'Mărțișor', 'Notă bună'];

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Dates are ISO but may be partial, because the old sheet only knew the month: YYYY, YYYY-MM or YYYY-MM-DD.
export function parseGiftDate(s) {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(s || '').trim());
  if (!m) return null;
  const month = m[2] ? Number(m[2]) : null, day = m[3] ? Number(m[3]) : null;
  if ((month != null && (month < 1 || month > 12)) || (day != null && (day < 1 || day > 31))) return null;
  return { year: Number(m[1]), month, day };
}

export function formatGiftDate(s) {
  const d = parseGiftDate(s);
  if (!d) return String(s || '');
  return [d.day, d.month ? MONTHS[d.month - 1] : null, d.year].filter((x) => x != null).join(' ');
}

// sortable key: a month-only date sorts after the days of that month's start, which is good enough for a log
const sortKey = (s) => { const d = parseGiftDate(s); return d ? `${String(d.year).padStart(4, '0')}-${String(d.month || 0).padStart(2, '0')}-${String(d.day || 0).padStart(2, '0')}` : '0000'; };

// Live gifts, newest first (same date: the one entered later first).
export function liveGifts(model) {
  return (model.gifts || []).filter((g) => !g.void)
    .sort((a, b) => (sortKey(a.date) !== sortKey(b.date) ? (sortKey(a.date) < sortKey(b.date) ? 1 : -1) : (b._row || 0) - (a._row || 0)));
}

// [{ currency, minor, count }], lei first
export function totalsByCurrency(gifts) {
  const map = new Map();
  for (const g of gifts) {
    const t = map.get(g.currency) || { currency: g.currency, minor: 0, count: 0 };
    t.minor += g.amount_minor; t.count++; map.set(g.currency, t);
  }
  return [...map.values()].sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency));
}

// Who gave how much in one currency, biggest first, with the share of that currency's total (0..1).
export function byGiver(gifts, currency = 'RON') {
  const map = new Map();
  for (const g of gifts) if (g.currency === currency) map.set(g.giver, (map.get(g.giver) || 0) + g.amount_minor);
  const total = [...map.values()].reduce((s, x) => s + x, 0);
  return [...map.entries()].map(([giver, minor]) => ({ giver, minor, share: total ? minor / total : 0 }))
    .sort((a, b) => b.minor - a.minor || (a.giver < b.giver ? -1 : 1));
}

// Share of each giver in the whole, counting every currency in lei at the rate `toRon(minor, currency)` returns.
// A giver who appears once with less than `minSingle` (10 lei) is left out of the shares. Each row also keeps the amounts
// per currency ("23.500 lei + 500 €"). Biggest first.
export function giverShares(gifts, toRon, minSingle = 1000) {
  const map = new Map();
  for (const g of gifts) {
    const r = map.get(g.giver) || { giver: g.giver, count: 0, ron: 0, parts: new Map() };
    r.count++; r.ron += toRon(g.amount_minor, g.currency);
    r.parts.set(g.currency, (r.parts.get(g.currency) || 0) + g.amount_minor);
    map.set(g.giver, r);
  }
  const kept = [...map.values()].filter((r) => !(r.count === 1 && r.ron < minSingle));
  const total = kept.reduce((s, r) => s + r.ron, 0);
  return kept.map((r) => ({
    giver: r.giver, ron: r.ron, share: total ? r.ron / total : 0,
    parts: [...r.parts.entries()].map(([currency, minor]) => ({ currency, minor })).sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency)),
  })).sort((a, b) => b.ron - a.ron || (a.giver < b.giver ? -1 : 1));
}

export function byYear(gifts) {
  const years = new Map();
  for (const g of gifts) {
    const d = parseGiftDate(g.date), y = d ? d.year : 0;
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(g);
  }
  return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, list, totals: totalsByCurrency(list) }));
}

// Distinct values of a field already in the file, most used first: the dropdown suggestions.
export function suggestions(gifts, field, defaults = []) {
  const count = new Map();
  for (const g of gifts) if (g[field]) count.set(g[field], (count.get(g[field]) || 0) + 1);
  const used = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([v]) => v);
  return [...used, ...defaults.filter((d) => !count.has(d))];
}

// Form -> record fields, or { error }. giver/reason: the dropdown value, or the typed text when "Altele…" was chosen.
export function giftFromForm(f) {
  const giver = (f.giver === OTHER ? f.giverOther : f.giver || '').trim();
  const reason = (f.reason === OTHER ? f.reasonOther : f.reason || '').trim();
  if (!giver) return { error: 'Spune de la cine a primit.' };
  if (!parseGiftDate(f.date)) return { error: 'Alege data.' };
  const minor = parseAmount(f.amount);
  if (minor == null || minor <= 0) return { error: 'Introdu o sumă validă, ex. 200 sau 1.250,50.' };
  if (!CURRENCIES.includes(f.currency)) return { error: 'Alege valuta.' };
  return { fields: { date: f.date.trim(), giver, amount_minor: minor, currency: f.currency, reason, note: (f.note || '').trim() } };
}

// Minimal CSV reader (quotes, commas and line breaks inside quotes), enough for the import file.
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

// Import file columns: data, de_la, suma, moneda, motiv, descriere_foaie. A period like "2015-feb 2016" is not a date:
// it becomes the last month and the original text goes into the note. Returns { fields: [...], errors: [...] }.
export function giftsFromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  const want = ['data', 'de_la', 'suma', 'moneda', 'motiv', 'descriere_foaie'];
  if (!head || want.some((c, i) => head[i] !== c)) return { fields: [], errors: ['Antetul fișierului nu e cel așteptat.'] };
  const fields = [], errors = [];
  rows.forEach((r, i) => {
    let [date, giver, suma, currency, reason, note] = r.map((x) => (x || '').trim());
    let extra = '';
    if (!parseGiftDate(date)) {
      const per = /(\d{4}).*?(\d{4})/.exec(date);
      if (per) { extra = `perioada ${date}`; date = per[2]; } // "2015-feb 2016" -> 2016
    }
    const minor = parseAmount(suma);
    if (!parseGiftDate(date) || !giver || minor == null || minor <= 0 || !CURRENCIES.includes(currency)) { errors.push(`Rândul ${i + 2} nu e valid.`); return; }
    fields.push({ date, giver, amount_minor: minor, currency, reason, note: [extra, note].filter(Boolean).join(' · ') });
  });
  return { fields, errors };
}
