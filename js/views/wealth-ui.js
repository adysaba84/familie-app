import { h } from '../dom.js';
import { lei, signed } from '../ui.js';

// The three wealths as compact rows (one per line, fit at 375 px): name + what it includes / leaves out on the left,
// lei, euro and the changes on the right. `eurTxt(ron)` and `eurDelta(now, then)` come from the screen (each date at its
// own exchange rate). Used by Situații and Active so both say the same thing.
export const WEALTH_TEXT = {
  1: ['Wealth 1', 'Disponibil + pensii cu vânzare (bursă, aur, Gent). Fără piloni P2/P3, imobile, împrumuturi, alte bunuri.'],
  2: ['Wealth 2', 'Wealth 1 + casă, mașină, garaj. Fără piloni, împrumuturi, alte bunuri.'],
  3: ['Wealth 3', 'Totul: Disponibil + toate Pensiile (și pilonii P2/P3) + tot Indisponibilul (imobile, alte bunuri, împrumuturi).'],
};

const pctText = (p) => (p == null ? '' : ` (${p > 0 ? '+' : p < 0 ? '−' : ''}${(Math.abs(p) / 100).toFixed(1).replace('.', ',')}%)`);
const eurSign = (x) => (Math.abs(x) < 50 ? '0 €' : `${signed(x)} €`);

// items = [{ n: 1|2|3, now, then }]
export function wealthList(items, { eurTxt, eurDelta }) {
  return h('div', { style: 'display:flex;flex-direction:column' }, ...items.map(({ n, now, then }, i) => {
    const diff = now - then, cls = diff < 0 ? 'neg' : diff > 0 ? 'pos' : 'muted';
    const p = then !== 0 ? Math.round((diff * 10000) / Math.abs(then)) : null;
    const [title, sub] = WEALTH_TEXT[n];
    return h('div', { style: `display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;padding:10px 0;${i ? 'border-top:1px solid var(--line2)' : ''}` },
      h('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' }, h('span', { class: 'up' }, title), h('span', { class: 'xs muted', style: 'overflow-wrap:anywhere' }, sub)),
      h('span', { style: 'display:flex;flex-direction:column;align-items:flex-end;gap:1px;white-space:nowrap' },
        h('b', { class: 'mono', style: 'font-size:18px' }, lei(now), ' ', h('small', { class: 'muted', style: 'font-size:11px;font-weight:400' }, 'lei')),
        h('span', { class: 'xs muted mono' }, eurTxt(now)),
        h('span', { class: 'xs ' + cls, style: 'font-weight:600' }, `${diff === 0 ? '0' : signed(diff)} lei${pctText(p)}`),
        h('span', { class: 'xs mono ' + cls }, eurSign(eurDelta(now, then)))));
  }));
}
