import { h } from '../dom.js';
import { depositRows, depositTotalsByCurrency, totalsByCategory, netInterestPerMonthRon, maturityBuckets, bfgByBankOwner, maturityConcentration } from '../calc.js';
import { formatWhole, formatPercent } from '../money.js';
import { maturityBars } from '../charts.js';
import { icon, frame, backHead, guarded, loading, lei, fmtNative, shortDate, fullDate, whenText, eurApprox } from '../ui.js';
import { startEdit } from './depozit-nou.js';
import { startClose } from './depozit-inchide.js';
import { notifyControls, notifyBanner, depositInput } from '../notify.js';

const MONTH_NAME = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const SHOWN = 4;
const expanded = new Set(); // currencies whose full list is open
const CCY_NAME = { RON: 'Lei', EUR: 'Euro', USD: 'Dolari' };
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
    const byCcy = depositTotalsByCurrency(m, today);
    const canEdit = app.canEdit();
    const space = app.space;

    // grouped by currency (lei, euro, dolari), each list by maturity (depositRows is already sorted by it)
    const rank = (c) => (['RON', 'EUR', 'USD'].indexOf(c) < 0 ? 9 : ['RON', 'EUR', 'USD'].indexOf(c));
    const groups = new Map();
    for (const r of rows) {
      const k = r.deposit.currency;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const ordered = [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]));
    const showOwner = new Set(rows.map((r) => r.account && r.account.owner)).size > 1;

    const depositRow = (r) => {
      const d = r.deposit;
      const soon = r.daysLeft <= 7;
      const isOpen = open === d.id;
      const go = (mode) => { startClose(d, space, mode, today); app.go('/depozite/inchide'); };
      const actions = isOpen && canEdit ? h('div', { class: 'grid2', style: 'grid-column:span 2;margin-top:6px' },
        r.daysLeft <= 0 ? h('button', { onclick: () => go('matured') }, 'Închide la scadență') : null,
        h('button', { class: r.daysLeft <= 0 ? 'secondary' : '', onclick: () => go('extend') }, 'Prelungește'),
        r.daysLeft > 0 ? h('button', { class: 'secondary', onclick: () => go('broken') }, 'Închide înainte de scadență') : null,
        h('button', { class: 'secondary', onclick: () => { startEdit(d); app.go('/depozite/nou'); } }, 'Modifică (corectează o greșeală)'),
        confirmVoid === d.id
          ? h('button', { onclick: async (e) => { e.target.disabled = true; await app.void(space, 'deposits', d, 'anulat'); open = null; confirmVoid = null; app.rerender(); }, style: 'background:var(--neg)' }, 'Sigur? Șterge din toate datele')
          : h('button', { class: 'secondary', onclick: () => { confirmVoid = d.id; app.rerender(); } }, 'Anulează (a fost o greșeală)'),
        h('div', { style: 'grid-column:1 / -1' }, notifyControls(depositInput(d, r.account), today))) : null;
      return h('div', {
        class: 'deprow', role: 'button', tabindex: '0', 'aria-expanded': String(isOpen),
        onclick: (e) => { if (e.target.closest('button')) return; open = isOpen ? null : d.id; confirmVoid = null; app.rerender(); },
      },
      h('span', { class: 'mono', style: 'font-weight:600' }, fmtNative(d.principal_minor, d.currency, { unit: true })),
      h('span', { class: 'mono xs ' + (soon ? 'neg' : ''), style: soon ? 'font-weight:600' : '' },
        r.overdue ? `${shortDate(d.maturity_date)} · scadent – decide ce faci` : soon ? `${shortDate(d.maturity_date)} · ${whenText(r.daysLeft)}` : fullDate(d.maturity_date)),
      h('span', { class: 'xs muted' }, `${r.account ? r.account.institution + (showOwner ? ' ' + r.account.owner : '') + ' · ' : ''}${formatPercent(d.rate_bp)} · ${termText(d.term_months)} · ${d.capitalization ? 'cu' : 'fără'} capitalizare`),
      h('span', { class: 'xs pos', style: 'text-align:right' }, `+${formatWhole(r.net)}${d.currency === 'RON' ? '' : ' ' + (d.currency === 'EUR' ? '€' : '$')} net`),
      actions);
    };

    frame(app, {
      tab: 'active',
      head: backHead('#/active', 'Depozite', h('span', { class: 'sm muted', style: 'padding-right:6px' }, `${app.space === 'iza' ? 'Iza' : 'Părinți'} · ${rows.length} ${rows.length === 1 ? 'depozit' : 'depozite'}`)),
      body: [
        notifyBanner(app),
        h('section', { class: 'panel' },
          h('div', { class: 'between', style: 'align-items:flex-end' },
            h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, h('span', { class: 'up xs' }, 'Total'), h('span', { class: 'mono', style: 'font-size:24px;font-weight:600' }, lei(total), ' ', h('small', { class: 'muted', style: 'font-size:14px;font-weight:400' }, 'lei')), h('span', { class: 'xs muted mono' }, eurApprox(m, total, today))),
            h('div', { style: 'display:flex;flex-direction:column;gap:2px;text-align:right' }, h('span', { class: 'up xs' }, 'Dobândă netă'),
              h('span', { class: 'mono pos', style: 'font-size:16px;font-weight:600' }, `${formatWhole(netMonth)} / lună`), h('span', { class: 'xs muted mono' }, `${eurApprox(m, netMonth, today)} / lună`), h('span', { class: 'xs muted' }, 'după impozitul de 10%'))),
          h('span', { class: 'sm muted', style: 'margin-top:4px' }, 'Scadențe pe luni, următoarele 12 luni (lei)'),
          maturityBars(buckets),
          conc && conc.shareBp > 5000
            ? h('span', { class: 'sm neg' }, `${Math.round(conc.shareBp / 100)}% scade în ${MONTH_NAME[Number(conc.month.slice(5, 7)) - 1]} ${conc.month.slice(0, 4)}, toate deodată`) : null),
        byCcy.length ? h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Total pe valută'),
          h('div', { class: 'stat3', style: `grid-template-columns:repeat(${byCcy.length},minmax(0,1fr))` },
            ...byCcy.map((g) => h('div', {},
              h('span', { class: 'up xs' }, g.currency === 'RON' ? 'Lei' : g.currency === 'EUR' ? 'Euro' : g.currency === 'USD' ? 'Dolari' : g.currency),
              h('b', { style: 'font-size:14px' }, fmtNative(g.native, g.currency, { unit: true })),
              h('span', { class: 'xs muted' }, g.currency === 'RON' ? `${g.count} ${g.count === 1 ? 'depozit' : 'depozite'}` : `≈ ${lei(g.ron)} lei · ${g.count}`))))) : null,
        bfg.length ? h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Garantat BFG · 100.000 € / bancă / persoană'),
          ...bfg.map((b) => h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
            h('div', { class: 'between sm' }, h('span', {}, `${b.owner} · ${b.institution}`), h('span', { class: 'mono' }, formatWhole(b.eurMinor) + ' €')),
            h('div', { class: 'bar', style: 'height:6px' }, h('div', { style: `height:6px;width:${Math.min(100, b.pctBp / 100)}%;background:${b.over ? '#B3412E' : '#1F6F5C'}` }))))) : null,
        rows.length === 0 ? h('div', { class: 'card' }, h('p', { class: 'muted', style: 'margin:0' }, 'Niciun depozit activ.'))
          : h('section', { class: 'panel flush' },
            ...ordered.flatMap(([ccy, list]) => {
              const open_ = expanded.has(ccy);
              const visible = open_ ? list : list.slice(0, SHOWN);
              const more = list.length - SHOWN;
              return [
                h('div', { class: 'ghead' }, h('span', {}, `${CCY_NAME[ccy] || ccy} · ${list.length} ${list.length === 1 ? 'depozit' : 'depozite'}`), h('span', {}, 'scadență')),
                ...visible.map(depositRow),
                more > 0 ? h('button', { class: 'secondary', style: 'border:0;border-top:1px solid var(--line2);border-radius:0;width:100%', onclick: () => { if (open_) expanded.delete(ccy); else expanded.add(ccy); app.rerender(); } },
                  open_ ? 'Arată mai puține' : `Încă ${more} ${more === 1 ? 'depozit' : 'depozite'}`) : null,
              ];
            })),
        canEdit ? h('a', { class: 'btn big', href: '#/depozite/nou', style: 'margin:16px' }, icon('plus', 18, 2.2), 'Depozit nou') : null,
      ],
    });
  });
}
