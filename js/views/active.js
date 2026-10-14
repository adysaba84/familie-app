import { h } from '../dom.js';
import { totalsByCategory, monthlyChange, currencyBreakdown, fromRon, staleAccounts, brokerSummary, addMonths, monthEnd } from '../calc.js';
import { formatWhole } from '../money.js';
import { monthlyBars } from '../charts.js';
import { frame, mainHead, catNav, guarded, loading, lei, signed, pctText, latestRateText, fmtNative, shortDate } from '../ui.js';

const CAT_COLOR = { deposits: '#1F6F5C', broker: '#5FA48F', physical: '#C9A24A', accounts: '#A9CFC2', insurance: '#7A5FE6' };
const CCY_COLOR = { RON: '#1F6F5C', EUR: '#4C78A8', USD: '#A9CFC2', AUR: '#C9A24A' };
const CCY_LABEL = { AUR: 'Aur' };
const MONTH_NAME = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

const depositsLabel = (n) => (n === 1 ? '1 depozit activ' : `${n} depozite active`);

export async function activeView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const t = totalsByCategory(m, today);
    const changes = monthlyChange(m, today, 12);
    const last = changes[changes.length - 1];
    const prevTotal = t.total - last.delta;
    const deltaPct = prevTotal > 0 ? Math.round((last.delta * 10000) / prevTotal) : null;
    const eur = fromRon(t.total, 'EUR', m.rates, today);
    const share = (v) => (t.total > 0 ? Math.round((v * 100) / t.total) : 0);
    const monthNameNow = MONTH_NAME[Number(today.slice(5, 7)) - 1];

    const hasInsurance = m.accounts.some((a) => !a.void && a.kind === 'insurance');
    const cats = [
      ['deposits', 'Depozite', depositsLabel(m.deposits.filter((d) => !d.void && d.status === 'active').length), t.deposits, '#/depozite'],
      ['broker', 'Bursă', 'investit vs. valoare', t.broker, '#/bursa'],
      ['physical', 'Seif', 'aur, numerar', t.physical, '#/fizice'],
      ['accounts', 'Conturi și economii', 'conturi, tichete, economii', t.accounts, '#/conturi'],
      ...(hasInsurance ? [['insurance', 'Asigurări', 'valoarea contului (NN)', t.insurance, null]] : []),
    ];
    const stale = staleAccounts(m, today).filter((s) => s.account.kind !== 'broker').length;
    const bs = brokerSummary(m, today);
    cats[1][2] = bs.investedRon ? `câștig ${pctText(Math.round((bs.gainRon * 10000) / bs.investedRon))}` : 'fără sume introduse';

    const maxAbs = Math.max(1, ...Object.values(last.byCategory).map(Math.abs));
    const src = (key, label) => {
      const v = last.byCategory[key];
      return h('div', { class: 'barrow' }, h('span', {}, label),
        h('div', { class: 'bar' }, h('div', { style: `width:${Math.round((Math.abs(v) * 100) / maxAbs)}%;background:${v < 0 ? '#B3412E' : CAT_COLOR[key]}` })),
        h('span', { class: 'mono', style: 'text-align:right' }, signed(v)));
    };

    const cur = currencyBreakdown(m, today);
    const curTotal = cur.reduce((s, c) => s + c.ron, 0) || 1;

    frame(app, {
      tab: 'active',
      head: mainHead(app, 'Active', latestRateText(m)),
      body: [
        catNav('active'),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Total active · ' + (app.space === 'iza' ? 'Iza' : 'părinți')),
          h('div', { class: 'big-num' }, lei(t.total), ' ', h('small', {}, 'lei')),
          h('div', { class: 'between sm' }, h('span', { class: 'muted' }, `≈ ${formatWhole(eur)} €`),
            h('span', { class: last.delta < 0 ? 'neg' : 'pos', style: 'font-weight:600' },
              `${last.delta < 0 ? '▼' : '▲'} ${formatWhole(Math.abs(last.delta))}${deltaPct == null ? '' : ' (' + pctText(deltaPct) + ')'} față de ${shortDate(monthEnd(addMonths(today.slice(0, 7) + '-01', -1)))}`)),
          h('span', { class: 'sm', style: 'font-weight:600;margin-top:12px' }, 'Cu cât a crescut în fiecare lună (mii lei)'),
          monthlyBars(changes),
          h('div', { class: 'sep stack sm', style: 'gap:6px' },
            h('span', { style: 'font-weight:600' }, `Din ce vin cei ${signed(last.delta)} din ${monthNameNow}`),
            src('broker', 'Bursă'), src('deposits', 'Depozite'), src('physical', 'Seif'), src('accounts', 'Conturi'), hasInsurance ? src('insurance', 'Asigurări') : null,
            h('span', { class: 'muted xs' }, last.newMoney
              ? `din care bani noi depuși la bursă: ${formatWhole(last.newMoney)} · restul din randament și curs`
              : 'fără depuneri noi la bursă în această lună'))),
        h('section', { class: 'panel flush' }, ...cats.map(([key, name, sub, val, href]) => {
          const row = h(href ? 'a' : 'div', { class: 'listrow', href: href || null },
            h('span', { class: 'sw', style: `background:${CAT_COLOR[key]}` }),
            h('span', { class: 'nm' }, h('b', {}, name), h('span', { class: 'xs ' + (key === 'accounts' && stale ? 'neg' : 'muted') },
              key === 'accounts' && stale ? `${stale} ${stale === 1 ? 'sold mai vechi' : 'solduri mai vechi'} de 30 zile` : sub)),
            h('span', { class: 'amt' }, lei(val)), h('span', { class: 'pc' }, share(val) + '%'));
          return row;
        })),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Pe valută'),
          h('div', { class: 'split' }, ...cur.map((c) => h('div', { style: `width:${(c.ron * 100) / curTotal}%;background:${CCY_COLOR[c.currency] || '#888'}` }))),
          h('div', { class: 'legend' }, ...cur.map((c) => h('span', {}, h('i', { style: `background:${CCY_COLOR[c.currency] || '#888'}` }),
            CCY_LABEL[c.currency] || c.currency, h('b', {}, c.currency === 'AUR' ? lei(c.native) + ' lei' : fmtNative(c.native, c.currency)))))),
      ],
    });
  });
}
