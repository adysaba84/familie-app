import { h } from '../dom.js';
import { accountBalance, accountValueRon, depositTotalsByCurrency, safeCash, goldItems, propertyItems, toRon } from '../calc.js';
import { situation, snapshotRows, LAYERS, LAYER_TITLES } from '../situations.js';
import { formatMinor } from '../money.js';
import { frame, backHead, guarded, loading, lei, eurApprox, shortDate } from '../ui.js';

// Internal check page: every balance as the app sees it at 31 dec 2025, 26 sept 2026 and today, side by side,
// so the numbers can be compared with the Excel by eye. Nothing is edited here.
const DATES = ['2025-12-31', '2026-09-26'];
const live = (r) => !r.void;
const KINDS = [
  ['current', 'Conturi curente'], ['wallet', 'Portofele'], ['voucher', 'Tichete de masă'], ['savings', 'Economii'],
  ['insurance', 'Asigurări (răscumpărare)'], ['pension', 'Pensii'], ['loan', 'Datornici (împrumuturi date)'], ['card', 'Carduri · credit disponibil'],
];
const CCY = { RON: 'lei', EUR: '€', USD: '$' };
const money = (minor, ccy) => (ccy === 'RON' ? formatMinor(minor) : `${formatMinor(minor)} ${CCY[ccy] || ccy}`);

export async function verificareView(app) {
  loading();
  return guarded(app, async (m) => {
    const today = app.today();
    const dates = [...DATES, today];
    const sec = (title, rows) => (rows.length ? h('section', { class: 'panel flush' },
      h('div', { class: 'ghead vhead' }, h('span', {}, title), ...dates.map((d) => h('span', {}, d === today ? 'azi' : shortDate(d) + ' ' + d.slice(2, 4)))),
      ...rows) : null);
    const row = (label, cells, { sub, dim } = {}) => h('div', { class: 'vrow' + (dim ? ' dim' : '') },
      h('span', { class: 'vl' }, label, sub ? h('small', {}, sub) : null),
      ...cells.map((c) => h('span', { class: 'mono vc' }, c == null ? '–' : c)));

    const accts = (kind) => m.accounts.filter((a) => live(a) && a.kind === kind && a.status !== 'closed');
    const sections = KINDS.map(([kind, title]) => sec(title, accts(kind).map((a) => row(a.name, dates.map((d) => {
      const b = accountBalance(m, a.id, d);
      return b.balance == null ? null : money(b.balance, a.currency_default);
    }), { sub: a.currency_default !== 'RON' ? a.currency_default : '' }))));

    // brokers: value in lei per account
    const brokers = m.accounts.filter((a) => live(a) && a.kind === 'broker');
    const brokerRows = brokers.map((a) => row(a.name, dates.map((d) => { const v = accountValueRon(m, a.id, d); return v ? money(v, 'RON') : null; })));

    // deposits: native total per currency
    const depRows = ['RON', 'EUR', 'USD'].map((c) => row(`Depozite ${CCY[c]}`, dates.map((d) => {
      const t = depositTotalsByCurrency(m, d).find((x) => x.currency === c);
      return t ? money(t.native, c) : null;
    }), { sub: 'din depozitele introduse' }));

    // physical
    const safeRows = (() => {
      const items = m.physical_items.filter((i) => live(i) && i.kind === 'cash');
      return items.map((it) => row(it.currency === 'RON' ? 'Seif lei' : `Seif ${CCY[it.currency]}`, dates.map((d) => {
        const s = safeCash(m, d).find((x) => x.item.id === it.id);
        return s && s.valueDate ? money(s.native, it.currency) : null;
      })));
    })();
    const goldRows = goldItems(m, today).map(({ item }) => row(item.description || 'Aur', dates.map((d) => {
      const g = goldItems(m, d).find((x) => x.item.id === item.id);
      return g && g.item.purchase_date <= d ? money(g.value, 'RON') : null;
    })));
    const propRows = propertyItems(m, today).map(({ item }) => row(item.description || item.kind, dates.map((d) => {
      const p = propertyItems(m, d).find((x) => x.item.id === item.id);
      return p ? money(p.native, item.currency) : null;
    })));

    // Excel snapshots (totals copied from the old sheet): "folosit" = counted in the totals at that date
    const snaps = new Map();
    for (const d of dates) for (const s of snapshotRows(m, d, { all: true })) {
      const k = `${s.group}|${s.label}|${s.currency}`;
      if (!snaps.has(k)) snaps.set(k, { s, cells: [] });
    }
    const snapRows = [...snaps.entries()].map(([k, { s }]) => row(`${s.label}`, dates.map((d) => {
      const x = snapshotRows(m, d, { all: true }).find((y) => `${y.group}|${y.label}|${y.currency}` === k);
      return x ? money(x.amount_minor, x.currency) + (x.used ? ' ✓' : '') : null;
    }), { sub: `${s.group} · din Excel`, dim: true }));

    // totals: the layers of Situații, in lei
    const sits = dates.map((d) => situation(m, d));
    const totalRows = [];
    for (const [layer, title] of LAYER_TITLES) {
      totalRows.push(row(title, sits.map((s) => lei(s[layer].total) + ' lei'), { sub: 'total' }));
      LAYERS[layer].forEach(([key, label], i) => totalRows.push(row('· ' + label, sits.map((s) => { const v = s[layer].lines[i].ron; return v ? lei(v) : null; }), { dim: true })));
    }
    totalRows.push(row('WEALTH', sits.map((s) => lei(s.wealth) + ' lei')));
    totalRows.push(row('≈ în euro', dates.map((d, i) => eurApprox(m, sits[i].wealth, d)), { dim: true }));
    const missingRate = dates.some((d) => !m.rates.length || m.rates[0].date > d);

    frame(app, {
      tab: 'more',
      head: backHead('#/mai-mult', 'Verificare date'),
      body: [
        h('p', { class: 'muted sm', style: 'margin:12px 16px 0' }, 'Ce vede aplicația la fiecare dată. Sumele sunt în moneda contului (fără simbol = lei); ✓ = total din Excel, folosit în Situații la acea dată. „–” = nicio înregistrare până la acea dată.'
          + (missingRate ? ' Pentru datele vechi cursul BNR cel mai apropiat poate lipsi: se folosește cel mai vechi curs introdus.' : '')),
        ...sections,
        sec('Bursă (în lei)', brokerRows), sec('Depozite', depRows), sec('Seif', safeRows), sec('Aur', goldRows), sec('Imobile', propRows),
        sec('Totaluri din Excel', snapRows),
        sec('Situații (lei)', totalRows),
      ],
    });
  });
}
