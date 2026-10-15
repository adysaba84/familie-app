import { h, svg, mount } from './dom.js';
import { formatWhole, formatMinor, CCY_SYMBOL } from './money.js';
import { formatRate } from './money.js';
import { SPACE_LABEL } from './schema.js';
import { SEED } from './seed.js';
import { fromRon } from './calc.js';

// Shared building blocks for screens: page frame, header, tab bar, small formatters.
const ICONS = {
  back: 'M15 18l-6-6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  pie: 'M12 3v9h9a9 9 0 1 1-9-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  list: 'M4 6h16M4 12h16M4 18h10',
  bars: 'M5 20V11M12 20V4M19 20v-6M3 20h18',
  bank: 'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
  safe: 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3M12 15v2',
  card: 'M3 7h18v12H3zM3 11h18M7 15h3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
};

export function icon(name, size = 22, sw = 1.8) {
  return svg('svg', { 'aria-hidden': 'true', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg('path', { d: ICONS[name] }));
}

// ---- number formatting ----
// "10.000 €", "63.500" (RON has no unit in tables), whole units unless exact cents matter.
export function fmtNative(minor, ccy, { unit = ccy !== 'RON', cents = false } = {}) {
  const n = cents ? formatMinor(minor) : formatWhole(minor);
  return unit ? `${n} ${CCY_SYMBOL[ccy] || ccy}` : n;
}
export const lei = (ronMinor) => formatWhole(ronMinor);
export const signed = (minor, f = formatWhole) => (minor > 0 ? '+' : '') + f(minor).replace('-', '−');
// basis points -> "+6,6%" (one decimal, comma)
export const pctText = (bp) => {
  if (bp == null) return '';
  if (Math.abs(bp) < 5) return '0,0%';
  const t = (Math.abs(bp) / 100).toFixed(1).replace('.', ',');
  return (bp > 0 ? '+' : bp < 0 ? '−' : '') + t + '%';
};
const RO_MONTH = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const shortDate = (iso) => `${Number(iso.slice(8, 10))} ${RO_MONTH[Number(iso.slice(5, 7)) - 1]}`;

export function latestRateText(model) {
  const rows = model.rates.filter((r) => r.EUR || r.USD).sort((a, b) => (a.date < b.date ? -1 : 1));
  const r = rows[rows.length - 1];
  if (!r) return 'fără curs BNR';
  return `BNR ${shortDate(r.date)}` + (r.EUR ? ` · € ${formatRate(r.EUR)}` : '') + (r.USD ? ` · $ ${formatRate(r.USD)}` : '');
}

// ---- frame ----
// The bottom bar: the six places of the app plus "Mai mult", one tap each. Seven fit at 375 px (about 52 px per button, icon
// over a 10 px label), so the bar does not scroll; `active` is the key of the current screen.
export const TABS = [
  ['#/active', 'active', 'Active', 'trend'], ['#/bursa', 'bursa', 'Bursă', 'bars'], ['#/depozite', 'depozite', 'Depozite', 'bank'],
  ['#/fizice', 'fizice', 'Seif', 'safe'], ['#/conturi', 'conturi', 'Conturi', 'card'], ['#/situatii', 'situatii', 'Situații', 'pie'],
  ['#/mai-mult', 'more', 'Mai mult', 'dots'],
];
function tabbar(active) {
  return h('nav', { class: 'tabbar', 'aria-label': 'Navigare' }, h('div', {},
    ...TABS.map(([href, key, label, ic]) => h('a', { href, class: active === key ? 'on' : '', 'aria-current': active === key ? 'page' : null }, icon(ic, 20, 1.8), h('span', {}, label)))));
}

export function spaceChip(app) {
  const label = SPACE_LABEL[app.space];
  const multi = app.spaces.length > 1;
  return h('button', {
    class: 'spacechip' + (app.space === 'iza' ? ' iza' : ''), 'aria-label': `Spațiu: ${label}` + (multi ? '. Schimbă' : ''),
    disabled: !multi,
    onclick: () => { app.space = app.spaces[(app.spaces.indexOf(app.space) + 1) % app.spaces.length]; app.rerender(); },
  }, h('i'), label, multi ? icon('chevron', 14, 2) : null);
}

export function frame(app, { head, body, tab }) {
  document.getElementById('app').classList.remove('kid'); // leaving Iza's screen
  mount(head, ...body, tabbar(tab));
}

export function mainHead(app, title, sub) {
  // in Iza's space a parent can open her screen ("modul copil") from every main screen
  const kidLink = app.space === 'iza' && app.spaces.length > 1 ? h('a', { href: '#/iza', class: 'spacechip kidlink' }, 'Modul copil') : null;
  return h('header', { class: 'pagehead' }, h('div', { class: 't' }, h('b', {}, title), sub ? h('span', { class: 'sm muted' }, sub) : null),
    h('div', { style: 'display:flex;gap:6px;align-items:center' }, kidLink, spaceChip(app)));
}

export function backHead(href, title, right) {
  return h('header', { class: 'pagehead back' },
    h('a', { href, class: 'iconbtn', 'aria-label': 'Înapoi' }, icon('back', 22, 2)),
    h('div', { class: 't' }, h('b', {}, title)),
    right || null);
}

export function closeHead(href, title) {
  return h('header', { class: 'pagehead back' },
    h('a', { href, class: 'iconbtn', 'aria-label': 'Închide' }, icon('close', 20, 2.2)),
    h('div', { class: 't' }, h('b', {}, title)));
}

export const loading = () => mount(h('p', { class: 'muted', style: 'margin:24px 16px' }, 'Se încarcă…'));

// ---- shared prompts ----
export function ratesPrompt(app) {
  frame(app, {
    tab: 'active', head: mainHead(app, 'Active'),
    body: [h('div', { class: 'card stack' },
      h('h2', {}, 'Lipsește cursul BNR'),
      h('p', { class: 'muted' }, 'Sumele în euro sau dolari au nevoie de un curs. Până pornește actualizarea automată, îl poți introduce manual.'),
      h('a', { class: 'btn', href: '#/curs' }, 'Introdu cursul'))],
  });
}

export function seedPrompt(app) {
  const list = SEED[app.space] || [];
  const can = app.canEdit();
  frame(app, {
    tab: 'active', head: mainHead(app, 'Active'),
    body: [h('div', { class: 'card stack' },
      h('h2', {}, 'Nu există conturi încă'),
      h('p', { class: 'muted' }, 'Conturile de pornire pentru „' + SPACE_LABEL[app.space] + '”. Verifică lista; poți schimba ulterior.'),
      h('ul', { class: 'sm', style: 'margin:0;padding-left:18px' }, ...list.map((a) => h('li', {}, `${a.name} — ${a.kind}, ${a.currency_default}`))),
      can ? h('button', {
        onclick: async (e) => { e.target.disabled = true; await app.seedAccounts(app.space); app.rerender(); },
      }, 'Adaugă conturile') : h('p', { class: 'muted' }, 'Doar un editor poate adăuga conturile.'))],
  });
}

// Runs a screen; turns "no rate" into the rates prompt and other errors into a plain message.
export async function guarded(app, render) {
  try {
    const m = await app.model();
    if (m.accounts.filter((a) => !a.void).length === 0) return seedPrompt(app);
    return await render(m);
  } catch (e) {
    if (/no rate/.test(e.message)) return ratesPrompt(app);
    mount(h('div', { class: 'card stack' }, h('h2', {}, 'Ceva n-a mers'),
      h('p', { class: 'err' }, e.message.startsWith('schema_mismatch') ? 'Foaia are alt format decât aplicația (' + e.message.split(':')[1] + ').' : 'Nu am putut citi datele. Încearcă din nou.'),
      h('button', { onclick: () => { app.rerender(); } }, 'Reîncearcă')));
  }
}

// "în 3 zile" / "mâine" / "azi" / "scadent de N zile" for a maturity.
export function whenText(daysLeft) {
  if (daysLeft < 0) return `scadent de ${-daysLeft} zile`;
  if (daysLeft === 0) return 'azi';
  if (daysLeft === 1) return 'mâine';
  return `în ${daysLeft} zile`;
}
export const fullDate = (iso) => `${shortDate(iso)} ${iso.slice(0, 4)}`;

// Euro equivalent of an amount in RON bani, at the latest BNR rate on or before `asOf` (every total shows lei and euro).
export const eurOf = (m, ronMinor, asOf) => fromRon(ronMinor, 'EUR', m.rates, asOf);
export const eurApprox = (m, ronMinor, asOf) => `≈ ${formatWhole(eurOf(m, ronMinor, asOf))} €`;
export const eurSigned = (m, ronMinor, asOf) => `≈ ${signed(eurOf(m, ronMinor, asOf))} €`;
// a right-aligned "lei + euro" block for page headers
export function headTotal(m, ronMinor, asOf) {
  return h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end;padding-right:6px;line-height:1.25' },
    h('span', { class: 'mono', style: 'font-size:15px;font-weight:600' }, lei(ronMinor) + ' lei'),
    h('span', { class: 'xs muted mono' }, eurApprox(m, ronMinor, asOf)));
}
