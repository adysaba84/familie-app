import { h } from '../dom.js';
import { brokerSummary, brokerGroups, depositTotalsByCurrency } from '../calc.js';
import { backHead, frame, guarded, loading, lei, fmtNative, eurApprox, headTotal, signed, shortDate } from '../ui.js';
import { INSTRUMENT_LABEL } from './bursa.js';

// "Sume investite": how much money was put in (not what it is worth today). Broker deposits minus withdrawals
// per platform and per instrument, plus the principal sitting in deposits, and the latest movements.
const INSTR_COLOR = { stocks_etf: '#1F6F5C', bonds: '#4C78A8', cash: '#C9A24A' };
const live = (r) => !r.void;

export async function investitView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const s = brokerSummary(m, today);
    const platforms = brokerGroups(m, today, 'platform').filter((g) => g.invested !== 0 || g.value !== 0);
    const byInstr = brokerGroups(m, today, 'instrument').filter((g) => g.invested > 0);
    const instrTotal = byInstr.reduce((t, g) => t + g.invested, 0);
    const deps = depositTotalsByCurrency(m, today);
    const depRon = deps.reduce((t, d) => t + d.ron, 0);
    const totalRon = s.investedRon + depRon;
    const acc = new Map(m.accounts.map((a) => [a.id, a]));

    const flows = m.broker_flows.filter((f) => live(f) && f.date <= today)
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b._row || 0) - (a._row || 0))).slice(0, 12);

    const row = (name, sub, right, rightSub) => h('div', { class: 'r' },
      h('span', { class: 'nm' }, h('b', {}, name), sub ? h('span', { class: 'xs muted' }, sub) : null),
      h('span', { class: 'n' }, right, rightSub ? h('span', { class: 'xs muted', style: 'display:block;text-align:right' }, rightSub) : null));

    frame(app, {
      tab: 'more',
      head: backHead('#/mai-mult', 'Sume investite', headTotal(m, totalRon, today)),
      body: [
        h('section', { class: 'panel' },
          h('span', { class: 'up xs' }, 'Total pus deoparte'),
          h('b', { style: 'font-size:22px' }, lei(totalRon), ' ', h('small', { class: 'muted', style: 'font-size:13px;font-weight:400' }, 'lei')),
          h('span', { class: 'xs muted mono' }, eurApprox(m, totalRon, today)),
          h('div', { class: 'between sm', style: 'margin-top:8px' }, h('span', {}, 'La bursă (depuneri − retrageri)'), h('b', { class: 'mono' }, lei(s.investedRon))),
          h('div', { class: 'between sm' }, h('span', {}, 'În depozite (suma depusă)'), h('b', { class: 'mono' }, lei(depRon))),
          h('span', { class: 'xs muted' }, 'Sume în lei, la cursul de azi. Contează banii băgați de voi, nu cât valorează acum.')),

        platforms.length ? h('section', { class: 'panel flush' },
          h('div', { class: 'ghead' }, h('span', {}, 'La bursă, pe platformă'), h('span', {}, 'Investit')),
          h('div', { class: 'tbl v2' }, ...platforms.map((g) => {
            const diff = g.value - g.invested;
            return row(`${g.account ? g.account.institution : '?'} · ${g.currency}`, g.account ? g.account.owner : '',
              fmtNative(g.invested, g.currency), g.value ? `valoare ${fmtNative(g.value, g.currency)} · ${signed(diff, (x) => fmtNative(x, g.currency, { unit: false }))}` : 'fără valoare introdusă');
          }))) : h('section', { class: 'panel' }, h('span', { class: 'muted sm' }, 'Nicio sumă investită la bursă încă.')),

        instrTotal > 0 ? h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Pe tip de instrument (investit)'),
          h('div', { class: 'split', style: 'height:10px' }, ...byInstr.map((g) => h('div', { style: `width:${(g.invested * 100) / instrTotal}%;background:${INSTR_COLOR[g.key] || '#888'}` }))),
          h('div', { class: 'between sm' }, ...byInstr.map((g) => h('span', {}, (INSTRUMENT_LABEL[g.key] || g.key) + ' ', h('b', { class: 'mono', style: 'font-weight:500' }, `${lei(g.invested)} lei`))))) : null,

        deps.length ? h('section', { class: 'panel flush' },
          h('div', { class: 'ghead' }, h('span', {}, 'În depozite'), h('span', {}, 'Suma depusă')),
          h('div', { class: 'tbl v2' }, ...deps.map((d) => row(d.currency, `${d.count} ${d.count === 1 ? 'depozit' : 'depozite'}`, fmtNative(d.native, d.currency), d.currency === 'RON' ? '' : `≈ ${lei(d.ron)} lei`)))) : null,

        flows.length ? h('section', { class: 'panel flush' },
          h('div', { class: 'ghead' }, h('span', {}, 'Ultimele mișcări la bursă'), h('span', {}, '')),
          h('div', { class: 'tbl v2' }, ...flows.map((f) => {
            const a = acc.get(f.account_id), inn = f.direction === 'in';
            return row(`${a ? a.institution : '?'} · ${INSTRUMENT_LABEL[f.instrument || 'stocks_etf'] || f.instrument}`, `${shortDate(f.date)} ${f.date.slice(0, 4)}${a ? ' · ' + a.owner : ''}`,
              h('span', { class: inn ? 'pos' : 'neg' }, `${inn ? '+' : '−'}${fmtNative(f.amount_minor, f.currency)}`));
          }))) : null,
      ],
    });
  });
}
