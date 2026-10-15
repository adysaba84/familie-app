import { h } from '../dom.js';
import { situation, combine, comparisonDates, historyStart, PENSII_SECTIONS, eurGrowth } from '../situations.js';
import { formatWhole } from '../money.js';
import { wealthList } from './wealth-ui.js';
import { frame, backHead, guarded, loading, lei, signed, eurOf, fullDate, shortDate } from '../ui.js';

// Situații: DISPONIBIL (cash) / PENSII / INDISPONIBIL; WEALTH 1 and 2, now versus the end of last month or the
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
    // Euro: every amount at the rate of ITS OWN date (today's value at today's rate, the old value at the comparison
    // date's rate), so a euro difference is real growth in euro, not a rate move on unchanged euro / dollar amounts.
    const eNow = (ron) => eurOf(rm, ron, today);
    const eurTxt = (ron) => `≈ ${formatWhole(eNow(ron))} €`;
    const eurDelta = (now, then) => eurGrowth(rm.rates, now, today, then, cmpDate);
    const eurSignedTxt = (x) => (Math.abs(x) < 50 ? '0 €' : `${signed(x)} €`);
    const deltaLine = (now, then) => {
      const d = delta(now, then);
      return h('span', { class: 'xs ' + d.cls }, `${d.diff === 0 ? '0' : signed(d.diff)} lei${pctText(d.pct)} · ${eurSignedTxt(eurDelta(now, then))}`);
    };

    const seg = (items, current, onPick, cols) => h('div', { class: 'seg', style: `grid-template-columns:repeat(${cols},minmax(0,1fr))` },
      ...items.map(([k, label]) => h('button', { class: current === k ? 'on' : '', 'aria-pressed': String(current === k), onclick: () => onPick(k) }, label)));

    // lines with something at either date, grouped in the layer sub-sections (Pensii) when it has them
    const bySection = (c, p) => {
      const rows = c.lines.map((l, i) => ({ l, was: p.lines[i].ron })).filter(({ l, was }) => l.ron !== 0 || was !== 0);
      if (!c.lines.some((l) => l.section)) return [{ title: null, rows }];
      return Object.entries(PENSII_SECTIONS).map(([k, title]) => {
        const rs = rows.filter(({ l }) => l.section === k);
        return { title, rows: rs, total: rs.reduce((t, { l }) => t + l.ron, 0), was: rs.reduce((t, { was }) => t + was, 0) };
      }).filter((x) => x.rows.length);
    };

    // one category line: lei and the change in lei, then (small, mono) the euro value and the change in euro
    const lineRows = (label, now, then, strong) => {
      const d = delta(now, then), de = eurDelta(now, then);
      const cell = (text, cls = '', style = '') => h('span', { class: cls, style }, text);
      const grid = 'display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:baseline;';
      return [
        h('div', { style: grid + `font-size:${strong ? 12 : 13}px;${strong ? 'font-weight:600;margin-top:6px' : ''}` },
          cell(label, strong ? 'up' : ''), cell(lei(now), 'mono'), cell(d.diff === 0 ? '·' : signed(d.diff), 'xs mono ' + d.cls, 'min-width:64px;text-align:right')),
        h('div', { class: 'xs muted mono', style: grid + 'margin-top:-3px' },
          cell(''), cell(eurTxt(now)), cell(Math.abs(de) < 50 ? '·' : eurSignedTxt(de), de <= -50 ? 'neg' : de >= 50 ? 'pos' : '', 'min-width:64px;text-align:right')),
      ];
    };

    const layerCard = (title, sub, c, p, extra) => h('section', { class: 'panel', style: 'gap:8px' },
      h('div', { class: 'between' }, h('div', { style: 'display:flex;flex-direction:column' }, h('b', { style: 'font-size:1rem' }, title), h('span', { class: 'xs muted' }, sub)),
        h('div', { style: 'display:flex;flex-direction:column;align-items:flex-end' }, h('span', { class: 'mono', style: 'font-size:18px;font-weight:600;white-space:nowrap' }, lei(c.total) + ' lei'), h('span', { class: 'xs muted mono' }, eurTxt(c.total)))),
      deltaLine(c.total, p.total),
      h('div', { class: 'sep stack', style: 'gap:4px;margin-top:4px;padding-top:8px' }, ...bySection(c, p).flatMap((sec) => [
        ...(sec.title ? lineRows(sec.title, sec.total, sec.was, true) : []),
        ...sec.rows.flatMap(({ l, was }) => lineRows(l.label, l.ron, was, false))]),
        extra));

    const n = cur.disponibil.native;
    const nativeLine = h('div', { class: 'xs muted mono', style: 'margin-top:4px' },
      `Cash pe valute: ${formatWhole(n.RON || 0)} lei · ${formatWhole(n.EUR || 0)} € · ${formatWhole(n.USD || 0)} $`);

    frame(app, {
      tab: 'situatii',
      head: backHead('#/active', 'Situații', h('span', { class: 'sm muted', style: 'padding-right:6px' }, shortDate(today))),
      body: [
        options.length > 1 ? seg(options.map((o) => [o, PERSON[o]]), who, (k) => { who = k; app.rerender(); }, options.length) : null,
        seg(Object.entries(CMP), cmp, (k) => { cmp = k; app.rerender(); }, 2),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Wealth · ' + PERSON[who]),
          wealthList([{ n: 1, now: cur.wealth1, then: past.wealth1 }, { n: 2, now: cur.wealth2, then: past.wealth2 }, { n: 3, now: cur.wealth3, then: past.wealth3 }], { eurTxt, eurDelta }),
          h('span', { class: 'xs muted' }, `${CMP[cmp]}: ${fullDate(cmpDate)} · euro la cursul fiecărei date`),
          h('div', { class: 'sep stack xs muted', style: 'gap:2px;padding-top:6px' },
            h('span', {}, 'Excluse din Wealth 1 și 2 (nu pot fi atinse imediat):'),
            h('span', { class: 'mono' }, `Pilon 2 și 3: ${lei(cur.excluded.piloni)} lei (${eurTxt(cur.excluded.piloni)}) · Împrumuturi date: ${lei(cur.excluded.imprumuturi)} lei (${eurTxt(cur.excluded.imprumuturi)})`)),
          incomplete ? h('span', { class: 'xs neg', style: 'margin-top:4px' }, `Istoricul începe la ${fullDate(first)}: diferențele includ intrarea datelor în aplicație, nu doar creșterea.`) : null),
        layerCard('Disponibil', 'cash: conturi, depozite, seif, carduri', cur.disponibil, past.disponibil, nativeLine),
        layerCard('Pensii', 'bursă, aur, Gent (se pot vinde) și pilonii (blocați până la pensie)', cur.pensii, past.pensii, null),
        layerCard('Indisponibil', 'casă, mașină, garaj, alte bunuri și împrumuturi date: nu pot fi atinse imediat', cur.indisponibil, past.indisponibil, null),
        h('p', { class: 'xs muted', style: 'margin:12px 16px' }, 'Wealth 1 = disponibil + pensii cu vânzare; Wealth 2 = wealth 1 + imobile; Wealth 3 = totul, cu piloni, împrumuturi și alte bunuri. Euro: fiecare sumă la cursul BNR din ziua ei (sau cel mai recent), deci diferența în euro nu include mișcarea cursului. Pensiile, împrumuturile date și cardurile de credit apar după ce le adăugăm.'),
      ],
    });
  });
}
