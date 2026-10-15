import { h } from '../dom.js';
import { currencyBreakdown, staleAccounts, daysBetween, STALE_DAYS } from '../calc.js';
import { situation, comparisonDates, wealthStructure, wealthSeries, seriesStartsBeforeDeposits, eurGrowth, categoryGroups, isSellablePension } from '../situations.js';
import { formatWhole } from '../money.js';
import { wealthLine } from '../charts.js';
import { setReturn, openCats } from '../return.js';
import { startSolduri } from './solduri.js';
import { startEdit } from './depozit-nou.js';
import { startClose } from './depozit-inchide.js';
import { startNou } from './bursa-nou.js';
import { startValoare } from './bursa-valoare.js';
import { startNew } from './fizice-nou.js';
import { startValue } from './fizice.js';
import { frame, mainHead, catNav, guarded, loading, lei, signed, latestRateText, fmtNative, fullDate, shortDate, eurOf } from '../ui.js';

const SEG_COLOR = { disponibil: '#1F6F5C', vanzare: '#5FA48F', pensie: '#A9CFC2', indisponibil: '#C9A24A' };
const CCY_COLOR = { RON: '#1F6F5C', EUR: '#4C78A8', USD: '#A9CFC2', AUR: '#C9A24A' };
const CCY_LABEL = { AUR: 'Aur' };

const depositsLabel = (n) => (n === 1 ? '1 depozit activ' : `${n} depozite active`);

// where each category lives in full (actions: add, close / roll over a deposit, update balances...)
const OPEN_LINK = { conturi: '#/conturi', economii: '#/conturi', depozite: '#/depozite', seif: '#/fizice', carduri: '#/obligatii', bursa: '#/bursa',
  aur: '#/fizice', gent: '#/obligatii', piloni: '#/obligatii', imobile: '#/fizice', imprumuturi: '#/obligatii', asigurari: '#/obligatii' };
const NOUN = { conturi: ['cont', 'conturi'], economii: ['cont', 'conturi'], carduri: ['card', 'carduri'], bursa: ['cont', 'conturi'], seif: ['sumă', 'sume'], aur: ['piesă', 'piese'],
  gent: ['poliță', 'polițe'], piloni: ['pilon', 'piloni'], imobile: ['bun', 'bunuri'], imprumuturi: ['datornic', 'datornici'], asigurari: ['cont', 'conturi'] };
const LINE_COLOR = { disponibil: '#1F6F5C', vanzare: '#5FA48F', pensie: '#A9CFC2', indisponibil: '#C9A24A' };
const BAL_KINDS = { conturi: ['current', 'wallet', 'voucher'], economii: ['savings'], carduri: ['card'], asigurari: ['insurance'], imprumuturi: ['loan'] };

export async function activeView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
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
    const stale = staleAccounts(m, today).filter((s) => s.account.kind !== 'broker').length;
    // the list below: every category of situation(), grouped, with subtotals; "total" = all lines, as in the bar above
    const { total: listTotal, groups } = categoryGroups(now);
    const pc = (v, base) => (base ? Math.round((v * 100) / base) : 0);

    const subHead = (title, ron, { strong = false } = {}) => h('div', { style: `display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:${strong ? '10px' : '8px'} 14px 6px;background:${strong ? '#EEF1EE' : 'transparent'};border-top:1px solid var(--line2)` },
      h('span', { class: 'up', style: strong ? 'font-weight:700' : '' }, title),
      h('span', { style: 'text-align:right;white-space:nowrap' }, h('b', { class: 'mono', style: 'font-size:14px' }, lei(ron)),
        h('small', { class: 'xs muted mono', style: 'display:block' }, `${eurTxt(ron)} · ${pc(ron, listTotal)}%`)));

    // + and the per-item buttons open the EXISTING forms (no copies); saving returns here with the category open
    const canEdit = app.canEdit(app.space);
    const space = app.space;
    const go = (routes, key, prepare, path) => { setReturn(routes, key); prepare(); app.go(path); };
    const balanceIds = (key) => m.accounts.filter((a) => !a.void && a.status !== 'closed'
      && (BAL_KINDS[key] ? BAL_KINDS[key].includes(a.kind) : a.kind === 'pension' && (key === 'gent') === isSellablePension(a))).map((a) => a.id);
    const soldNou = (key, ids, title) => go(['/conturi/solduri'], key, () => startSolduri(ids, title), '/conturi/solduri');
    const plusFor = (line) => {
      const k = line.key;
      if (BAL_KINDS[k] || k === 'gent' || k === 'piloni') return () => soldNou(k, balanceIds(k), line.label);
      if (k === 'depozite') return () => go(['/depozite/nou'], k, () => {}, '/depozite/nou');
      if (k === 'bursa') return () => go(['/bursa/valoare', '/bursa/nou'], k, () => startValoare(app, null), '/bursa/valoare');
      if (k === 'seif') return () => go(['/fizice/nou'], k, () => startNew(app, 'cash'), '/fizice/nou');
      if (k === 'aur') return () => go(['/fizice/nou'], k, () => startNew(app, 'gold'), '/fizice/nou');
      if (k === 'imobile') return () => go(['/fizice/nou'], k, () => startNew(app, 'property'), '/fizice/nou');
      return null;
    };
    const btn = (text, onclick) => h('button', { type: 'button', class: 'secondary', style: 'flex:0 1 auto;min-width:96px;min-height:40px;padding:0 14px;font-size:12px;white-space:nowrap', onclick }, text);
    const itemActions = (line, it) => {
      if (!canEdit) return null;
      const k = line.key;
      let buttons = [];
      if (it.depositId) {
        const d = m.deposits.find((x) => x.id === it.depositId);
        if (!d) return null;
        const due = daysBetween(today, d.maturity_date) <= 0;
        const closing = (mode) => go(['/depozite/inchide'], k, () => startClose(d, space, mode, today), '/depozite/inchide');
        buttons = [btn(due ? 'Închide' : 'Închide înainte', () => closing(due ? 'matured' : 'broken')), btn('Prelungește', () => closing('extend')),
          btn('Modifică', () => go(['/depozite/nou'], k, () => startEdit(d), '/depozite/nou'))];
      } else if (it.itemId) {
        buttons = [btn('Valoare nouă', () => go(['/fizice'], k, () => startValue(it.itemId, k === 'aur'), '/fizice'))];
      } else if (k === 'bursa' && it.accountId) {
        buttons = [btn('Valoare cont', () => go(['/bursa/valoare', '/bursa/nou'], k, () => startValoare(app, it.accountId), '/bursa/valoare')),
          btn('Depunere', () => go(['/bursa/valoare', '/bursa/nou'], k, () => startNou(app, it.accountId), '/bursa/nou'))];
      } else if (it.accountId) {
        buttons = [btn('Sold nou', () => soldNou(k, [it.accountId], it.label))];
      }
      return buttons.length ? h('div', { style: 'grid-column:1 / -1;display:flex;gap:6px;margin-top:4px' }, ...buttons) : null;
    };

    const itemRow = (line, it) => {
      const foreign = it.currency !== 'RON';
      const old = it.date && ['conturi', 'economii', 'asigurari', 'carduri', 'gent', 'piloni', 'imprumuturi'].includes(line.key) && daysBetween(it.date, today) > STALE_DAYS;
      const sub = line.key === 'depozite' ? `${it.sub} · ${it.overdue ? 'scadent – decide ce faci' : 'scadență ' + fullDate(it.date)}`
        : [it.sub, it.date && !['seif', 'aur', 'imobile'].includes(line.key) ? `din ${shortDate(it.date)}${old ? ' · vechi' : ''}` : ''].filter(Boolean).join(' · ');
      return h('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;padding:6px 14px 6px 38px;font-size:12px;background:#FAFBFA;border-top:1px solid var(--line2)' },
        h('span', { style: 'min-width:0;display:flex;flex-direction:column' }, h('span', { style: 'overflow-wrap:anywhere' }, it.label),
          sub ? h('span', { class: 'xs ' + (old || it.overdue ? 'neg' : 'muted'), style: 'overflow-wrap:anywhere' }, sub) : null),
        h('span', { style: 'text-align:right;white-space:nowrap' }, foreign ? h('b', { class: 'mono' }, fmtNative(it.native, it.currency, { unit: true })) : h('b', { class: 'mono' }, lei(it.ron)),
          h('small', { class: 'xs muted mono', style: 'display:block' }, foreign ? `${lei(it.ron)} lei · ${eurTxt(it.ron)}` : eurTxt(it.ron))),
        itemActions(line, it));
    };

    const catRow = (line, blockKey) => {
      const isOpen = openCats.has(line.key);
      const plus = canEdit ? plusFor(line) : null;
      const n = line.items.length;
      const noun = NOUN[line.key];
      const sub = line.key === 'conturi' && stale ? `${stale} ${stale === 1 ? 'sold mai vechi' : 'solduri mai vechi'} de 30 zile`
        : line.key === 'depozite' ? depositsLabel(m.deposits.filter((d) => !d.void && d.status === 'active').length)
          : noun ? `${n} ${n === 1 ? noun[0] : noun[1]}` : '';
      const head = h('div', {
        class: 'listrow', role: 'button', tabindex: '0', 'aria-expanded': String(isOpen), style: 'grid-template-columns:auto minmax(0,1fr) auto auto;cursor:pointer',
        onclick: (e) => { if (e.target.closest('button')) return; if (isOpen) openCats.delete(line.key); else openCats.add(line.key); app.rerender(); },
      },
      h('span', { class: 'sw', style: `background:${LINE_COLOR[blockKey]}` }),
      h('span', { class: 'nm', style: 'min-width:0' }, h('b', {}, line.label), h('span', { class: 'xs ' + (line.key === 'conturi' && stale ? 'neg' : 'muted') }, sub)),
      h('span', { class: 'amt', style: 'text-align:right;white-space:nowrap' }, lei(line.ron),
        h('small', { class: 'xs muted', style: 'display:block;font-family:var(--mono)' }, eurTxt(line.ron)),
        h('small', { class: 'xs muted', style: 'display:block;font-family:var(--mono)' }, `${pc(line.ron, listTotal)}% · ${pc(line.ron, line.groupRon)}%`)),
      plus ? h('button', { type: 'button', 'aria-label': `Adaugă sau actualizează: ${line.label}`, onclick: plus,
        style: 'width:44px;height:44px;min-height:44px;padding:0;border-radius:22px;font-size:26px;line-height:1;display:flex;align-items:center;justify-content:center' }, '+') : null);
      if (!isOpen) return [head];
      return [head, ...line.items.map((it) => itemRow(line, it)),
        h('a', { href: OPEN_LINK[line.key] || '#/active', class: 'xs', style: 'display:block;text-align:right;padding:6px 14px;background:#FAFBFA;border-top:1px solid var(--line2);color:var(--accent)' }, 'Deschide pentru acțiuni ›')];
    };

    const listBody = groups.flatMap((g) => {
      const blockViews = g.blocks.filter((b) => b.lines.length).flatMap((b) => [subHead(b.title, b.ron), ...b.lines.flatMap((l) => catRow(l, b.key))]);
      return g.title ? [subHead('Total ' + g.title, g.ron, { strong: true }), ...blockViews] : blockViews;
    });

    const cur = currencyBreakdown(m, today);
    const curTotal = cur.reduce((s, c) => s + c.ron, 0) || 1;

    frame(app, {
      tab: 'active',
      head: mainHead(app, 'Active', latestRateText(m)),
      body: [
        catNav('active'),
        h('a', { class: 'listrow', href: '#/venituri', style: 'grid-template-columns:minmax(0,1fr) 20px;background:var(--card, #fff);border-radius:12px;margin:0 16px' },
          h('span', { class: 'nm' }, h('b', {}, 'Venituri și cheltuieli'), h('span', { class: 'xs muted' }, 'pagina lunară de pe 15: soldurile, veniturile, ce s-a cheltuit')), h('span', {}, '›')),
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
        h('section', { class: 'panel flush' },
          h('div', { class: 'xs muted', style: 'padding:10px 14px 4px' }, `Totalul de referință: ${lei(listTotal)} lei (toate straturile, cu piloni și împrumuturi). Pe fiecare rând: % din total · % din grupă. Atinge un rând ca să vezi conturile.`),
          ...listBody),
        h('section', { class: 'panel' },
          h('span', { class: 'up' }, 'Pe valută'),
          h('div', { class: 'split' }, ...cur.map((c) => h('div', { style: `width:${(c.ron * 100) / curTotal}%;background:${CCY_COLOR[c.currency] || '#888'}` }))),
          h('div', { class: 'legend' }, ...cur.map((c) => h('span', {}, h('i', { style: `background:${CCY_COLOR[c.currency] || '#888'}` }),
            CCY_LABEL[c.currency] || c.currency, h('b', {}, c.currency === 'AUR' ? lei(c.native) + ' lei' : fmtNative(c.native, c.currency)))))),
      ],
    });
  });
}
