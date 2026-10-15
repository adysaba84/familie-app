import { h } from '../dom.js';
import { totalsByCategory, currencyBreakdown, staleAccounts } from '../calc.js';
import { situation, comparisonDates, wealthStructure, wealthSeries, seriesStartsBeforeDeposits, eurGrowth } from '../situations.js';
import { formatWhole } from '../money.js';
import { wealthLine } from '../charts.js';
import { frame, mainHead, catNav, guarded, loading, lei, signed, latestRateText, fmtNative, fullDate, shortDate, eurOf } from '../ui.js';

const CAT_COLOR = { deposits: '#1F6F5C', broker: '#5FA48F', physical: '#C9A24A', accounts: '#A9CFC2', insurance: '#7A5FE6' };
const SEG_COLOR = { disponibil: '#1F6F5C', vanzare: '#5FA48F', pensie: '#A9CFC2', indisponibil: '#C9A24A' };
const CCY_COLOR = { RON: '#1F6F5C', EUR: '#4C78A8', USD: '#A9CFC2', AUR: '#C9A24A' };
const CCY_LABEL = { AUR: 'Aur' };

const depositsLabel = (n) => (n === 1 ? '1 depozit activ' : `${n} depozite active`);

export async function activeView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const t = totalsByCategory(m, today);
    const who = app.space === 'iza' ? 'Iza' : 'părinți';

    // Everything on top comes from situation(), the same source as Situații: one set of totals, not two.
    const cmpDate = comparisonDates(today).month;
    const now = situation(m, today), then = situation(m, cmpDate);
    const segs = wealthStructure(now);
    const segTotal = segs.reduce((s, x) => s + x.ron, 0);
    const pct = (v) => (segTotal > 0 ? Math.round((v * 100) / segTotal) : 0);
    const eurTxt = (ron) => `≈ ${formatWhole(eurOf(m, ron, today))} €`;
    const eurDelta = (a, b) => eurGrowth(m.rates, a, today, b, cmpDate);
    const small = (x) => (Math.abs(x) < 50 ? '0 €' : `${signed(x)} €`);

    const wealthBlock = (title, sub, a, b) => {
      const diff = a - b, cls = diff < 0 ? 'neg' : diff > 0 ? 'pos' : 'muted';
      const p = b !== 0 ? Math.round((diff * 10000) / Math.abs(b)) : null;
      return h('div', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0' },
        h('span', { class: 'up' }, title), h('span', { class: 'xs muted' }, sub),
        h('div', { class: 'big-num', style: 'font-size:21px;white-space:nowrap' }, lei(a), ' ', h('small', {}, 'lei')),
        h('span', { class: 'xs muted mono' }, eurTxt(a)),
        h('span', { class: 'xs ' + cls, style: 'font-weight:600' }, `${diff === 0 ? '0' : signed(diff)} lei${p == null ? '' : ` (${p > 0 ? '+' : p < 0 ? '−' : ''}${(Math.abs(p) / 100).toFixed(1).replace('.', ',')}%)`}`),
        h('span', { class: 'xs mono ' + cls }, small(eurDelta(a, b))));
    };

    const series = wealthSeries(m, today);
    const first = series[0];
    const hasInsurance = m.accounts.some((a) => !a.void && a.kind === 'insurance');
    const cats = [
      ['deposits', 'Depozite', depositsLabel(m.deposits.filter((d) => !d.void && d.status === 'active').length), t.deposits, '#/depozite'],
      ['broker', 'Bursă', 'valoarea conturilor de investiții', t.broker, '#/bursa'],
      ['physical', 'Seif', 'numerar și aur (aurul e la Pensii)', t.physical, '#/fizice'],
      ['accounts', 'Conturi și economii', 'conturi, tichete, economii', t.accounts, '#/conturi'],
      ...(hasInsurance ? [['insurance', 'Asigurări', 'valoarea contului (NN)', t.insurance, null]] : []),
    ];
    const stale = staleAccounts(m, today).filter((s) => s.account.kind !== 'broker').length;

    const cur = currencyBreakdown(m, today);
    const curTotal = cur.reduce((s, c) => s + c.ron, 0) || 1;

    frame(app, {
      tab: 'active',
      head: mainHead(app, 'Active', latestRateText(m)),
      body: [
        catNav('active'),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Structura averii · ' + who),
          h('div', { class: 'split', style: 'height:12px' }, ...segs.filter((x) => x.ron > 0).map((x) => h('div', { style: `width:${(x.ron * 100) / segTotal}%;background:${SEG_COLOR[x.key]}` }))),
          h('div', { class: 'stack', style: 'gap:6px' }, ...segs.map((x) => h('div', { style: 'display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:baseline;font-size:13px' },
            h('i', { style: `width:10px;height:10px;border-radius:3px;background:${SEG_COLOR[x.key]};align-self:center` }),
            h('span', {}, x.label), h('span', { class: 'mono' }, lei(x.ron)),
            h('span', { class: 'xs muted mono', style: 'min-width:92px;text-align:right' }, `${eurTxt(x.ron)} · ${pct(x.ron)}%`)))),
          h('span', { class: 'xs muted' }, 'Procentele sunt din suma celor patru straturi; pilonii și împrumuturile date apar aici, dar nu intră în wealth.'),
          h('div', { class: 'sep', style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:10px' },
            wealthBlock('Wealth 1', 'disponibil + pensii cu vânzare', now.wealth1, then.wealth1),
            wealthBlock('Wealth 2', 'wealth 1 + casă, mașină, garaj', now.wealth2, then.wealth2)),
          h('span', { class: 'xs muted' }, `față de ${shortDate(cmpDate)} · euro la cursul fiecărei date`)),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Wealth 1 în timp'),
          wealthLine(series),
          h('span', { class: 'xs muted' }, `${series.length} ${series.length === 1 ? 'dată' : 'date'} cu înregistrări reale, fără interpolare; lei la cursul fiecărei date.`),
          seriesStartsBeforeDeposits(m, series)
            ? h('span', { class: 'xs neg' }, `La ${fullDate(first.date)} depozitele nu erau introduse pe rând: valoarea vine din conturi de economii sau din Excel, deci diferența până la următoarea dată arată și intrarea datelor, nu doar creștere.`) : null),
        h('section', { class: 'panel flush' }, ...cats.map(([key, name, sub, val, href]) => h(href ? 'a' : 'div', { class: 'listrow', href: href || null },
          h('span', { class: 'sw', style: `background:${CAT_COLOR[key]}` }),
          h('span', { class: 'nm' }, h('b', {}, name), h('span', { class: 'xs ' + (key === 'accounts' && stale ? 'neg' : 'muted') },
            key === 'accounts' && stale ? `${stale} ${stale === 1 ? 'sold mai vechi' : 'solduri mai vechi'} de 30 zile` : sub)),
          h('span', { class: 'amt', style: 'text-align:right' }, lei(val), h('small', { class: 'xs muted', style: 'display:block;font-family:var(--mono)' }, eurTxt(val)))))),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Pe valută'),
          h('div', { class: 'split' }, ...cur.map((c) => h('div', { style: `width:${(c.ron * 100) / curTotal}%;background:${CCY_COLOR[c.currency] || '#888'}` }))),
          h('div', { class: 'legend' }, ...cur.map((c) => h('span', {}, h('i', { style: `background:${CCY_COLOR[c.currency] || '#888'}` }),
            CCY_LABEL[c.currency] || c.currency, h('b', {}, c.currency === 'AUR' ? lei(c.native) + ' lei' : fmtNative(c.native, c.currency)))))),
      ],
    });
  });
}
