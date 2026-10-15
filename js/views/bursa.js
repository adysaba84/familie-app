import { h } from '../dom.js';
import { brokerSummary, brokerGroups, daysBetween, STALE_DAYS } from '../calc.js';
import { icon, frame, backHead, guarded, loading, lei, fmtNative, eurApprox } from '../ui.js';

export const INSTRUMENT_LABEL = { stocks_etf: 'Acțiuni, ETF', bonds: 'Obligațiuni', cash: 'Cash' };
const INSTR_COLOR = { stocks_etf: '#1F6F5C', bonds: '#4C78A8', cash: '#C9A24A' };
const TABS = [['platform', 'Platformă'], ['instrumentCcy', 'Tip'], ['currency', 'Valută']];
let by = 'platform';

export async function bursaView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const s = brokerSummary(m, today);
    const rows = brokerGroups(m, today, by);
    const byInstr = brokerGroups(m, today, 'instrument');
    const instrTotal = byInstr.reduce((t, g) => t + g.value, 0);

    // sub-line: what the row is made of, with amounts in the row's own currency
    const parts = (g) => g.parts.map((p) => `${INSTRUMENT_LABEL[p.instrument].toLowerCase()} ${fmtNative(p.value, g.currency, { unit: g.currency !== 'RON' })}`).join(' · ');
    const label = (g) => {
      if (by === 'platform') return [`${g.account ? g.account.institution : '?'} · ${g.currency}`, g.parts.length > 1 ? (g.account ? g.account.owner : '') : parts(g) + (g.account ? ' · ' + g.account.owner : '')];
      if (by === 'instrumentCcy') return [`${INSTRUMENT_LABEL[g.instrument] || g.instrument} · ${g.currency}`, g.platforms.join(', ')];
      return [g.key, parts(g)];
    };
    const staleDays = (g) => (by === 'platform' && g.valueDate ? daysBetween(g.valueDate, today) : null);

    const tbl = rows.length === 0
      ? h('p', { class: 'muted', style: 'padding:14px' }, 'Nicio sumă introdusă încă. Începe cu „Sumă investită”.')
      : h('div', { class: 'tbl v2' },
        h('div', { class: 'h' }, h('span', {}, TABS.find((t) => t[0] === by)[1]), h('span', { style: 'text-align:right' }, 'Valoare')),
        ...rows.flatMap((g) => {
          const [name, sub] = label(g);
          const sd = staleDays(g);
          const old = sd != null && sd > STALE_DAYS;
          const main = h('div', { class: 'r' },
            h('span', { class: 'nm' }, h('b', {}, name), h('span', { class: 'xs ' + (old ? 'neg' : 'muted') }, old ? `valoare veche: ${sd} zile` : sub)),
            h('span', { class: 'n' }, fmtNative(g.value, g.currency)));
          // platform rows that hold several instruments get one indented row per instrument
          const subs = by === 'platform' && g.parts.length > 1 ? g.parts.map((p) => h('div', { class: 'r sub' },
            h('span', { class: 'nm' }, h('span', {}, INSTRUMENT_LABEL[p.instrument])),
            h('span', { class: 'n' }, fmtNative(p.value, g.currency)))) : [];
          return [main, ...subs];
        }));

    frame(app, {
      tab: 'active',
      head: backHead('#/active', 'Bursă', h('span', { class: 'sm muted', style: 'padding-right:6px' }, (app.space === 'iza' ? 'Iza' : 'Părinți') + ' · valori azi')),
      body: [
        h('section', { class: 'panel' },
          h('div', {}, h('span', { class: 'up xs' }, 'Valoare'), h('b', { style: 'font-size:22px' }, lei(s.valueRon), ' ', h('small', { class: 'muted', style: 'font-size:13px;font-weight:400' }, 'lei')),
            h('span', { class: 'xs muted mono' }, eurApprox(m, s.valueRon, today)),
            h('span', { class: 'xs muted' }, 'Fără câștig sau randament până avem depunerile cu data reală.'))),
        h('div', { class: 'seg', style: 'grid-template-columns:repeat(3,minmax(0,1fr))', role: 'tablist', 'aria-label': 'Grupare' },
          ...TABS.map(([k, name]) => h('button', { role: 'tab', 'aria-selected': String(by === k), class: by === k ? 'on' : '', onclick: () => { by = k; app.rerender(); } }, name))),
        h('section', { class: 'panel flush' }, tbl),
        instrTotal > 0 ? h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Pe tip de instrument'),
          h('div', { class: 'split', style: 'height:10px' }, ...byInstr.map((g) => h('div', { style: `width:${(g.value * 100) / instrTotal}%;background:${INSTR_COLOR[g.key] || '#888'}` }))),
          h('div', { class: 'between sm' }, ...byInstr.map((g) => h('span', {}, (INSTRUMENT_LABEL[g.key] || g.key) + ' ', h('b', { class: 'mono', style: 'font-weight:500' }, Math.round((g.value * 100) / instrTotal) + '%'))))) : null,
        app.canEdit() ? h('div', { class: 'grid2', style: 'margin:16px' },
          h('a', { class: 'btn', href: '#/bursa/nou' }, icon('plus', 18, 2.2), 'Sumă investită'),
          h('a', { class: 'btn outline', href: '#/bursa/valoare' }, icon('refresh', 18, 2), 'Valoare cont')) : null,
      ],
    });
  });
}
