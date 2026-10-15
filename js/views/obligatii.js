import { h } from '../dom.js';
import { accountBalance, toRon } from '../calc.js';
import { parseAmount, formatMinor } from '../money.js';
import { backHead, frame, guarded, loading, lei, fmtNative, shortDate } from '../ui.js';

let editing = null; // id of the card whose limit is being changed

const live = (r) => !r.void;
const cardLimitOf = (m, id) => {
  const rows = (m.settings || []).filter(live).filter((r) => r.key === `card_limit:${id}`);
  return rows.length ? Number(rows[rows.length - 1].value) : null;
};

// "Pensii și datorii": what is not plain cash — pensions (P2/P3, Gent), insurance, loans given, credit cards.
// Balances are updated in "Actualizează toate soldurile"; a card's limit is changed here.
export async function obligatiiView(app) {
  loading();
  return guarded(app, async (m) => {
    const today = app.today();
    const mine = (kind) => m.accounts.filter((a) => live(a) && a.kind === kind && a.status !== 'closed');
    const canEdit = app.canEdit();

    const row = (a, extra) => {
      const b = accountBalance(m, a.id, today);
      const ccy = a.currency_default;
      return h('div', { class: 'acctrow' },
        h('b', {}, a.name),
        h('span', { class: 'mono' }, b.balance == null ? '–' : fmtNative(b.balance, ccy, { unit: ccy !== 'RON', cents: b.balance % 100 !== 0 })),
        h('span', { class: 'xs muted' }, extra ? extra(a, b) : (ccy !== 'RON' && b.balance != null ? `≈ ${lei(toRon(b.balance, ccy, m.rates, today))} lei` : '')),
        h('span', { class: 'xs muted', style: 'text-align:right' }, b.date ? shortDate(b.date) : 'fără sold'));
    };
    const group = (title, kind, extra) => {
      const list = mine(kind);
      if (!list.length) return null;
      return h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, title), h('span', {}, 'sold · la data')), ...list.map((a) => row(a, extra)));
    };

    const cards = mine('card');
    const cardsPanel = cards.length ? h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, 'Carduri de credit'), h('span', {}, 'credit disponibil')),
      ...cards.map((a) => {
        const b = accountBalance(m, a.id, today);
        const limit = cardLimitOf(m, a.id);
        const used = b.balance != null && limit != null ? limit - b.balance : null;
        const err = h('p', { class: 'err sm', style: 'margin:0' });
        const input = h('input', { class: 'input', inputmode: 'decimal', 'aria-label': 'Limită ' + a.name, placeholder: limit != null ? formatMinor(limit) : '0' });
        const save = async (e) => {
          const v = parseAmount(input.value);
          if (v == null || v <= 0) { err.textContent = 'Introdu o limită validă.'; return; }
          e.target.disabled = true;
          try { await app.add(app.space, 'settings', { key: `card_limit:${a.id}`, value: v }, `limită ${a.name}`); editing = null; app.rerender(); }
          catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva.'; }
        };
        return h('div', { class: 'stack', style: 'gap:6px;padding:9px 14px;border-bottom:1px solid var(--line2)' },
          h('div', { class: 'between' }, h('b', {}, a.name), h('span', { class: 'mono' }, b.balance == null ? '–' : formatMinor(b.balance))),
          h('div', { class: 'between xs muted' },
            h('span', {}, limit == null ? 'limită necunoscută: nu intră în totaluri' : `limită ${formatMinor(limit)}`),
            used == null ? h('span', {}, b.date ? shortDate(b.date) : 'fără sold') : h('span', { style: used > 0 ? 'color:var(--neg);font-weight:600' : '' }, `cheltuit ${formatMinor(used)}`)),
          canEdit ? (editing === a.id
            ? h('div', { class: 'stack', style: 'gap:6px' }, input, err, h('div', { class: 'grid2' }, h('button', { onclick: save }, 'Salvează limita'), h('button', { class: 'secondary', onclick: () => { editing = null; app.rerender(); } }, 'Renunță')))
            : h('button', { class: 'secondary', style: 'color:var(--ink)', onclick: () => { editing = a.id; app.rerender(); } }, 'Limită nouă')) : null);
      })) : null;

    const any = ['pension', 'insurance', 'loan', 'card'].some((k) => mine(k).length);
    frame(app, {
      tab: 'more',
      head: backHead('#/mai-mult', 'Pensii și datornici'),
      body: [
        group('Pensii · piloni și Gent', 'pension'),
        group('Asigurări · valoare de răscumpărare', 'insurance'),
        group('Datornici · împrumuturi date', 'loan'),
        cardsPanel,
        any ? null : h('div', { class: 'panel' }, h('p', { class: 'muted', style: 'margin:0' }, 'Nicio pensie, asigurare, datornic sau card adăugat încă.')),
        canEdit && any ? h('a', { class: 'btn big', href: '#/conturi/solduri', style: 'margin:16px' }, 'Actualizează toate soldurile') : null,
      ],
    });
  });
}
