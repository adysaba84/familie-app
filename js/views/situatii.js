import { h } from '../dom.js';
import { situation, combine, comparisonDates, historyStart, PENSII_SECTIONS } from '../situations.js';
import { formatWhole } from '../money.js';
import { frame, backHead, guarded, loading, lei, signed, eurApprox, eurSigned, fullDate, shortDate } from '../ui.js';

// Situații: DISPONIBIL (cash) / PENSII / INDISPONIBIL / WEALTH, now versus the end of last month or the
// end of last year, for Părinți, Iza or the whole family. Euro next to every lei amount.
let who = 'familie'; // 'parents' | 'iza' | 'familie'
let cmp = 'month'; // 'month' | 'year'

const PERSON = { parents: 'Părinți', iza: 'Iza', familie: 'Total familie' };
const CMP = { month: 'vs luna trecută', year: 'vs început de an' };

export async function situatiiView(app) {
  loading();
  return guarded(app, async () => {
    const today = app.today();
    const models = {};
    for (const s of app.spaces) models[s] = await app.model(s);
    const options = [];
    if (models.parents) options.push('parents');
    if (models.iza) options.push('iza');
    if (models.parents && models.iza) options.push('familie');
    if (!options.includes(who)) who = options[options.length - 1];

    const picked = who === 'familie' ? ['parents', 'iza'] : [who];
    const rm = models[picked[0]]; // for the euro conversion
    const dates = comparisonDates(today);
    const cmpDate = cmp === 'month' ? dates.month : dates.year;
    const at = (d) => combine(picked.map((s) => situation(models[s], d)));
    const cur = at(today), past = at(cmpDate);
    const first = picked.map((s) => historyStart(models[s])).filter(Boolean).sort()[0] || null;
    const incomplete = first && cmpDate < first;

    const delta = (now, then) => {
      const diff = now - then;
      const pct = then !== 0 ? Math.round((diff * 10000) / Math.abs(then)) : null;
      return { diff, pct, cls: diff < 0 ? 'neg' : diff > 0 ? 'pos' : 'muted' };
    };
    const pctText = (p) => (p == null ? '' : ` (${p > 0 ? '+' : p < 0 ? '−' : ''}${(Math.abs(p) / 100).toFixed(1).replace('.', ',')}%)`);
    const deltaLine = (now, then) => {
      const d = delta(now, then);
      return h('span', { class: 'xs ' + d.cls }, `${d.diff === 0 ? '0' : signed(d.diff)} lei${pctText(d.pct)} · ${eurSigned(rm, d.diff, today)}`);
    };

    const seg = (items, current, onPick, cols) => h('div', { class: 'seg', style: `grid-template-columns:repeat(${cols},minmax(0,1fr))` },
      ...items.map(([k, label]) => h('button', { class: current === k ? 'on' : '', 'aria-pressed': String(current === k), onclick: () => onPick(k) }, label)));

    // lines with something at either date, grouped in the layer sub-sections (Pensii) when it has them
    const bySection = (c, p) => {
      const rows = c.lines.map((l, i) => ({ l, was: p.lines[i].ron })).filter(({ l, was }) => l.ron !== 0 || was !== 0);
      if (!c.lines.some((l) => l.section)) return [{ title: null, rows }];
      return Object.entries(PENSII_SECTIONS).map(([k, title]) => {
        const rs = rows.filter(({ l }) => l.section === k);
        return { title, rows: rs, total: rs.reduce((t, { l }) => t + l.ron, 0) };
      }).filter((x) => x.rows.length);
    };

    const layerCard = (title, sub, c, p, extra) => h('section', { class: 'panel', style: 'gap:8px' },
      h('div', { class: 'between' }, h('div', { style: 'display:flex;flex-direction:column' }, h('b', { style: 'font-size:1rem' }, title), h('span', { class: 'xs muted' }, sub)),
        h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end' }, h('span', { class: 'mono', style: 'font-size:18px;font-weight:600;white-space:nowrap' }, lei(c.total) + ' lei'), h('span', { class: 'xs muted mono' }, eurApprox(rm, c.total, today)))),
      deltaLine(c.total, p.total),
      h('div', { class: 'sep stack', style: 'gap:4px;margin-top:4px;padding-top:8px' }, ...bySection(c, p).flatMap((sec) => [
        sec.title ? h('div', { style: 'display:flex;justify-content:space-between;margin-top:6px;font-size:12px;font-weight:600' },
          h('span', { class: 'up' }, sec.title), h('span', { class: 'mono' }, lei(sec.total))) : null,
        ...sec.rows.map(({ l, was }) => {
          const d = delta(l.ron, was);
          return h('div', { style: 'display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:baseline;font-size:13px' },
            h('span', {}, l.label), h('span', { class: 'mono' }, lei(l.ron)),
            h('span', { class: 'xs mono ' + d.cls, style: 'min-width:64px;text-align:right' }, d.diff === 0 ? '·' : signed(d.diff)));
        })]),
        extra));

    const n = cur.disponibil.native;
    const nativeLine = h('div', { class: 'xs muted mono', style: 'margin-top:4px' },
      `Cash pe valute: ${formatWhole(n.RON || 0)} lei · ${formatWhole(n.EUR || 0)} € · ${formatWhole(n.USD || 0)} $`);

    const wd = delta(cur.wealth, past.wealth);
    frame(app, {
      tab: 'situatii',
      head: backHead('#/active', 'Situații', h('span', { class: 'sm muted', style: 'padding-right:6px' }, shortDate(today))),
      body: [
        options.length > 1 ? seg(options.map((o) => [o, PERSON[o]]), who, (k) => { who = k; app.rerender(); }, options.length) : null,
        seg(Object.entries(CMP), cmp, (k) => { cmp = k; app.rerender(); }, 2),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Wealth · ' + PERSON[who]),
          h('div', { class: 'big-num' }, lei(cur.wealth), ' ', h('small', {}, 'lei')),
          h('div', { class: 'between sm' }, h('span', { class: 'muted' }, eurApprox(rm, cur.wealth, today)),
            h('span', { class: wd.cls, style: 'font-weight:600' }, `${wd.diff === 0 ? '0' : signed(wd.diff)} lei${pctText(wd.pct)}`)),
          h('span', { class: 'xs muted' }, `${CMP[cmp]}: ${fullDate(cmpDate)} · ${eurSigned(rm, wd.diff, today)}`),
          incomplete ? h('span', { class: 'xs neg', style: 'margin-top:4px' }, `Istoricul începe la ${fullDate(first)}: diferențele includ intrarea datelor în aplicație, nu doar creșterea.`) : null),
        layerCard('Disponibil', 'cash: conturi, depozite, seif, carduri', cur.disponibil, past.disponibil, nativeLine),
        layerCard('Pensii', 'bursă, aur, Gent (se pot vinde) și pilonii (blocați până la pensie)', cur.pensii, past.pensii, null),
        layerCard('Indisponibil', 'casă, mașină, garaj și împrumuturi date: nu pot fi atinse imediat', cur.indisponibil, past.indisponibil, null),
        h('p', { class: 'xs muted', style: 'margin:12px 16px' }, 'Wealth = disponibil + pensii + indisponibil. Cursul: BNR din ziua respectivă (sau cel mai recent). Pensiile, împrumuturile date și cardurile de credit apar după ce le adăugăm.'),
      ],
    });
  });
}
