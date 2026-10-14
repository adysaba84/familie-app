import { h } from '../dom.js';
import { brokerSummary, brokerGroups, brokerSeries, daysBetween, STALE_DAYS } from '../calc.js';
import { investedVsValue } from '../charts.js';
import { icon, frame, backHead, guarded, loading, lei, signed, pctText, fmtNative } from '../ui.js';

export const INSTRUMENT_LABEL = { stocks_etf: 'Acțiuni, ETF', bonds: 'Obligațiuni', cash: 'Cash' };
const INSTR_COLOR = { stocks_etf: '#1F6F5C', bonds: '#4C78A8', cash: '#C9A24A' };
const TABS = [['platform', 'Platformă'], ['instrumentCcy', 'Tip'], ['currency', 'Valută']];
let by = 'platform';

export async function bursaView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const s = brokerSummary(m, today);
    const series = brokerSeries(m, today, 12);
    const rows = brokerGroups(m, today, by);
    const byInstr = brokerGroups(m, today, 'instrument');
    const instrTotal = byInstr.reduce((t, g) => t + g.value, 0);
    const gainBp = s.investedRon > 0 ? Math.round((s.gainRon * 10000) / s.investedRon) : null;

    // sub-line: what the row is made of, with amounts in the row's own currency
    const parts = (g) => g.parts.map((p) => `${INSTRUMENT_LABEL[p.instrument].toLowerCase()} ${fmtNative(p.value, g.currency, { unit: g.currency !== 'RON' })}`).join(' · ');
    const label = (g) => {
      if (by === 'platform') return [`${g.account ? g.account.institution : '?'} · ${g.currency}`, parts(g) + (g.account ? ' · ' + g.account.owner : '')];
      if (by === 'instrumentCcy') return [`${INSTRUMENT_LABEL[g.instrument] || g.instrument} · ${g.currency}`, g.platforms.join(', ')];
      return [g.key, parts(g)];
    };
    const staleDays = (g) => (by === 'platform' && g.valueDate ? daysBetween(g.valueDate, today) : null);

    const tbl = rows.length === 0
      ? h('p', { class: 'muted', style: 'padding:14px' }, 'Nicio sumă introdusă încă. Începe cu „Sumă investită”.')
      : h('div', { class: 'tbl' },
        h('div', { class: 'h' }, h('span', {}, TABS.find((t) => t[0] === by)[1]), h('span', { style: 'text-align:right' }, 'Investit'), h('span', { style: 'text-align:right' }, 'Valoare'), h('span', { style: 'text-align:right' }, '%')),
        ...rows.map((g) => {
          const [name, sub] = label(g);
          const sd = staleDays(g);
          const old = sd != null && sd > STALE_DAYS;
          return h('div', { class: 'r' },
            h('span', { class: 'nm' }, h('b', {}, name), h('span', { class: 'xs ' + (old ? 'neg' : 'muted') }, old ? `valoare veche: ${sd} zile` : sub)),
            h('span', { class: 'n' }, fmtNative(g.invested, g.currency)), h('span', { class: 'n' }, fmtNative(g.value, g.currency)),
            h('span', { class: 'n ' + (g.gain < 0 ? 'neg' : g.gain > 0 ? 'pos' : 'muted') }, g.gainPctBp == null ? '–' : pctText(g.gainPctBp).replace('%', '')));
        }));

    frame(app, {
      tab: 'active',
      head: backHead('#/active', 'Bursă', h('span', { class: 'sm muted', style: 'padding-right:6px' }, (app.space === 'iza' ? 'Iza' : 'Părinți') + ' · valori azi')),
      body: [
        h('section', { class: 'panel' },
          h('div', { class: 'stat3' },
            h('div', {}, h('span', { class: 'up xs' }, 'Investit'), h('b', {}, lei(s.investedRon))),
            h('div', {}, h('span', { class: 'up xs' }, 'Valoare'), h('b', {}, lei(s.valueRon))),
            h('div', {}, h('span', { class: 'up xs' }, 'Câștig'), h('b', { class: s.gainRon < 0 ? 'neg' : 'pos' }, signed(s.gainRon)),
              h('span', { class: 'xs ' + (s.gainRon < 0 ? 'neg' : 'pos') }, pctText(gainBp)))),
          s.investedRon || s.valueRon ? investedVsValue(series) : null,
          h('div', { class: 'between xs muted' },
            h('span', { style: 'display:flex;gap:12px' },
              h('span', { style: 'display:flex;align-items:center;gap:5px' }, h('i', { style: 'width:14px;height:3px;background:#1F6F5C;display:inline-block' }), 'valoare'),
              h('span', { style: 'display:flex;align-items:center;gap:5px' }, h('i', { style: 'width:14px;border-top:2px dashed #5B6661;display:inline-block' }), 'investit')),
            h('span', { class: 'mono' }, 'ultimele 12 luni'))),
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
