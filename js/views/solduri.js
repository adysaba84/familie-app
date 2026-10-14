import { h } from '../dom.js';
import { accountBalance, STALE_DAYS } from '../calc.js';
import { parseAmount, formatMinor } from '../money.js';
import { closeHead, frame, guarded, loading, shortDate } from '../ui.js';

const KINDS = [['current', 'Conturi curente'], ['wallet', 'Portofele'], ['voucher', 'Tichete de masă'], ['savings', 'Economii']];
let entered = {};
let date = null;

// "Actualizează toate soldurile": one form with every account, prefilled with its last balance.
export async function solduriView(app) {
  loading();
  return guarded(app, async (m) => {
    const today = app.today();
    if (!date) date = today;
    const space = app.space;
    const err = h('p', { class: 'err sm', style: 'margin:0' });
    const accounts = KINDS.flatMap(([kind]) => m.accounts.filter((a) => !a.void && a.kind === kind && a.status !== 'closed'));

    const sections = KINDS.map(([kind, label]) => {
      const list = accounts.filter((a) => a.kind === kind);
      if (!list.length) return null;
      return h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, label), h('span', {}, 'sold nou')),
        ...list.map((a) => {
          const b = accountBalance(m, a.id, date);
          const stale = b.days == null || b.days > STALE_DAYS;
          const input = h('input', { class: 'input', style: 'min-height:42px;text-align:right;font-family:var(--mono);font-size:15px', inputmode: 'decimal', 'aria-label': 'Sold ' + a.name,
            value: entered[a.id] || '', placeholder: b.balance == null ? '0' : formatMinor(b.balance) });
          input.addEventListener('input', () => { entered[a.id] = input.value; err.textContent = ''; });
          return h('div', { class: 'valrow' },
            h('span', { style: 'display:flex;flex-direction:column' }, h('span', {}, a.name),
              h('span', { class: 'xs ' + (stale ? 'neg' : 'muted') }, b.date ? `ultimul: ${shortDate(b.date)}${stale ? ' · vechi' : ''}` : 'fără sold anterior')),
            input);
        }));
    });

    const save = async (e) => {
      const rows = [];
      for (const a of accounts) {
        const t = entered[a.id];
        if (t == null || t.trim() === '') continue;
        const v = parseAmount(t);
        if (v == null || v < 0) { err.textContent = `Sold invalid la ${a.name}.`; return; }
        rows.push({ a, v });
      }
      if (!rows.length) { err.textContent = 'Nu ai introdus niciun sold nou.'; return; }
      e.target.disabled = true;
      try {
        for (const { a } of rows) {
          const old = m.balances.find((x) => !x.void && x.account_id === a.id && x.date === date);
          if (old) await app.void(space, 'balances', old, 'corectat');
        }
        await app.addMany(space, 'balances', rows.map(({ a, v }) => {
          const b = accountBalance(m, a.id, date);
          return { account_id: a.id, date, balance_minor: v, rate_bp: b.rateBp == null ? '' : b.rateBp };
        }), `solduri ${date} (${rows.length})`);
        entered = {}; date = null;
        app.go('/conturi');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
    };

    frame(app, {
      tab: 'active', head: closeHead('#/conturi', 'Actualizează soldurile'),
      body: [
        h('label', { class: 'f', style: 'margin:14px 16px 0;font-size:12px;font-weight:600;color:var(--muted)' }, 'La data',
          h('input', { class: 'input', type: 'date', value: date, onchange: (e) => { date = e.target.value; app.rerender(); } })),
        ...sections,
        h('div', { class: 'savebar' }, err, h('button', { class: 'btn big', onclick: save }, 'Salvează soldurile')),
      ],
    });
  });
}

window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/conturi/solduri')) { entered = {}; date = null; } });
