import { h } from '../dom.js';
import { depositRows, totalsByCategory, netInterestPerMonthRon, maturityBuckets, bfgByBankOwner, maturityConcentration } from '../calc.js';
import { formatWhole, formatPercent } from '../money.js';
import { maturityBars } from '../charts.js';
import { icon, frame, backHead, guarded, loading, lei, fmtNative, shortDate, fullDate, whenText, eurApprox } from '../ui.js';
import { startEdit } from './depozit-nou.js';

const MONTH_NAME = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const SHOWN = 4;
let showAll = false;
let open = null; // deposit id whose actions are open
let confirmVoid = null;

const termText = (n) => (n === 1 ? '1 lună' : `${n} luni`);

export async function depoziteView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const rows = depositRows(m, today);
    const total = totalsByCategory(m, today).deposits;
    const netMonth = netInterestPerMonthRon(m.deposits, m.rates, today);
    const buckets = maturityBuckets(m.deposits, m.rates, today, 12);
    const bfg = bfgByBankOwner(m, today);
    const conc = maturityConcentration(m, today);
    const canEdit = app.canEdit();
    const space = app.space;

    const groups = new Map();
    for (const r of rows) {
      const k = r.account ? `${r.account.institution} · ${r.account.owner}` : 'Fără cont';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    let remaining = showAll ? Infinity : SHOWN;
    const hidden = Math.max(0, rows.length - SHOWN);

    const depositRow = (r) => {
      const d = r.deposit;
      const soon = r.daysLeft <= 7;
      const isOpen = open === d.id;
      const actions = isOpen && canEdit ? h('div', { class: 'grid2', style: 'grid-column:span 2;margin-top:6px' },
        h('button', { class: 'secondary', onclick: () => { startEdit(d); app.go('/depozite/nou'); } }, 'Modifică'),
        confirmVoid === d.id
          ? h('button', { onclick: async (e) => { e.target.disabled = true; await app.void(space, 'deposits', d, 'anulat'); open = null; confirmVoid = null; app.rerender(); }, style: 'background:var(--neg)' }, 'Sigur? Anulează')
          : h('button', { class: 'secondary', onclick: () => { confirmVoid = d.id; app.rerender(); } }, 'Anulează depozitul')) : null;
      return h('div', {
        class: 'deprow', role: 'button', tabindex: '0', 'aria-expanded': String(isOpen),
        onclick: (e) => { if (e.target.closest('button')) return; open = isOpen ? null : d.id; confirmVoid = null; app.rerender(); },
      },
      h('span', { class: 'mono', style: 'font-weight:600' }, fmtNative(d.principal_minor, d.currency, { unit: true })),
      h('span', { class: 'mono xs ' + (soon ? 'neg' : ''), style: soon ? 'font-weight:600' : '' },
        soon ? `${shortDate(d.maturity_date)} · ${whenText(r.daysLeft)}` : fullDate(d.maturity_date)),
      h('span', { class: 'xs muted' }, `${formatPercent(d.rate_bp)} · ${termText(d.term_months)} · ${d.capitalization ? 'cu' : 'fără'} capitalizare`),
      h('span', { class: 'xs pos', style: 'text-align:right' }, `+${formatWhole(r.net)}${d.currency === 'RON' ? '' : ' ' + (d.currency === 'EUR' ? '€' : '$')} net`),
      actions);
    };

    frame(app, {
      tab: 'active',
      head: backHead('#/active', 'Depozite', h('span', { class: 'sm muted', style: 'padding-right:6px' }, `${app.space === 'iza' ? 'Iza' : 'Părinți'} · ${rows.length} ${rows.length === 1 ? 'depozit' : 'depozite'}`)),
      body: [
        h('section', { class: 'panel' },
          h('div', { class: 'between', style: 'align-items:flex-end' },
            h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, h('span', { class: 'up xs' }, 'Total'), h('span', { class: 'mono', style: 'font-size:24px;font-weight:600' }, lei(total), ' ', h('small', { class: 'muted', style: 'font-size:14px;font-weight:400' }, 'lei')), h('span', { class: 'xs muted mono' }, eurApprox(m, total, today))),
            h('div', { style: 'display:flex;flex-direction:column;gap:2px;text-align:right' }, h('span', { class: 'up xs' }, 'Dobândă netă'),
              h('span', { class: 'mono pos', style: 'font-size:16px;font-weight:600' }, `${formatWhole(netMonth)} / lună`), h('span', { class: 'xs muted mono' }, `${eurApprox(m, netMonth, today)} / lună`), h('span', { class: 'xs muted' }, 'după impozitul de 10%'))),
          h('span', { class: 'sm muted', style: 'margin-top:4px' }, 'Scadențe pe luni, următoarele 12 luni (lei)'),
          maturityBars(buckets),
          conc && conc.shareBp > 5000
            ? h('span', { class: 'sm neg' }, `${Math.round(conc.shareBp / 100)}% scade în ${MONTH_NAME[Number(conc.month.slice(5, 7)) - 1]} ${conc.month.slice(0, 4)}, toate deodată`) : null),
        bfg.length ? h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Garantat BFG · 100.000 € / bancă / persoană'),
          ...bfg.map((b) => h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
            h('div', { class: 'between sm' }, h('span', {}, `${b.owner} · ${b.institution}`), h('span', { class: 'mono' }, formatWhole(b.eurMinor) + ' €')),
            h('div', { class: 'bar', style: 'height:6px' }, h('div', { style: `height:6px;width:${Math.min(100, b.pctBp / 100)}%;background:${b.over ? '#B3412E' : '#1F6F5C'}` }))))) : null,
        rows.length === 0 ? h('div', { class: 'card' }, h('p', { class: 'muted', style: 'margin:0' }, 'Niciun depozit activ.'))
          : h('section', { class: 'panel flush' },
            ...[...groups.entries()].flatMap(([name, list]) => {
              const visible = list.filter(() => remaining-- > 0);
              if (!visible.length) return [];
              return [h('div', { class: 'ghead' }, h('span', {}, name), h('span', {}, 'scadență')), ...visible.map(depositRow)];
            }),
            hidden > 0 ? h('button', { class: 'secondary', style: 'border:0;border-top:1px solid var(--line2);border-radius:0 0 12px 12px;width:100%', onclick: () => { showAll = !showAll; app.rerender(); } },
              showAll ? 'Arată mai puține' : `Încă ${hidden} ${hidden === 1 ? 'depozit' : 'depozite'}`) : null),
        canEdit ? h('a', { class: 'btn big', href: '#/depozite/nou', style: 'margin:16px' }, icon('plus', 18, 2.2), 'Depozit nou') : null,
      ],
    });
  });
}
