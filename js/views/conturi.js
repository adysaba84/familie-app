import { h } from '../dom.js';
import { accountBalance, totalsByCategory, toRon, monthlyNetInterest, STALE_DAYS } from '../calc.js';
import { parseAmount, parsePercent, formatMinor, formatPercent } from '../money.js';
import { sparkline } from '../charts.js';
import { icon, frame, backHead, guarded, loading, lei, fmtNative, shortDate, headTotal } from '../ui.js';
import { SPACE_LABEL } from '../schema.js';

let tab = null; // `${space}|${accountId}` of the selected savings account
let editing = null; // 'balance' | 'rate' | null

const ageText = (days) => (days == null ? 'fără sold' : days === 0 ? 'azi' : `acum ${days} zile`);

export async function conturiView(app) {
  loading();
  return guarded(app, async (m) => {
    const today = app.today();
    const space = app.space;
    const total = totalsByCategory(m, today).accounts;
    const canEdit = app.canEdit();
    const mine = (kind) => m.accounts.filter((a) => !a.void && a.kind === kind && a.status !== 'closed');

    const currents = mine('current');
    const vouchers = mine('voucher');
    // each space shows only its own accounts (Iza's savings and wallets are not mixed into the parents' screen)
    const savings = mine('savings').map((account) => ({ space, account, model: m }));
    const wallets = mine('wallet').map((account) => ({ space, account, model: m }));
    const walletOwners = [...new Set(wallets.map((w) => w.account.owner))];
    if (!savings.find((x) => `${x.space}|${x.account.id}` === tab)) {
      const first = savings.find((x) => accountBalance(x.model, x.account.id, today).balance != null) || savings[0];
      tab = first ? `${first.space}|${first.account.id}` : null;
    }
    const sel = savings.find((x) => `${x.space}|${x.account.id}` === tab);

    const acctRow = (a) => {
      const b = accountBalance(m, a.id, today);
      const stale = b.days == null || b.days > STALE_DAYS;
      return h('div', { class: 'acctrow' },
        h('b', {}, a.name), h('span', { class: 'mono' }, b.balance == null ? '–' : fmtNative(b.balance, a.currency_default, { unit: a.currency_default !== 'RON', cents: b.balance % 100 !== 0 })),
        h('span', { class: 'xs muted' }, a.currency_default + (a.currency_default !== 'RON' && b.balance != null ? ` · ${lei(toRon(b.balance, a.currency_default, m.rates, today))} lei` : '')),
        h('span', { class: 'xs', style: `text-align:right;${stale ? 'color:var(--neg);font-weight:600' : 'color:var(--muted)'}` }, stale ? ageText(b.days) : shortDate(b.date)));
    };

    let detail = null;
    if (sel) {
      const a = sel.account, b = accountBalance(sel.model, a.id, today);
      const err = h('p', { class: 'err sm', style: 'margin:0' });
      const input = h('input', { class: 'input', inputmode: 'decimal', 'aria-label': editing === 'rate' ? 'Dobândă %' : 'Sold', placeholder: editing === 'rate' ? (b.rateBp != null ? formatMinor(b.rateBp) : '2,85') : (b.balance != null ? formatMinor(b.balance) : '0') });
      const dateIn = h('input', { class: 'input', type: 'date', value: today, 'aria-label': 'Data' });
      const save = async (e) => {
        const rowBase = { account_id: a.id, date: dateIn.value };
        let fields;
        if (editing === 'rate') {
          const r = parsePercent(input.value);
          if (r == null) { err.textContent = 'Introdu dobânda, ex. 2,85.'; return; }
          if (b.balance == null) { err.textContent = 'Introdu mai întâi un sold.'; return; }
          fields = { ...rowBase, balance_minor: b.balance, rate_bp: r };
        } else {
          const v = parseAmount(input.value);
          if (v == null || v < 0) { err.textContent = 'Introdu un sold valid.'; return; }
          fields = { ...rowBase, balance_minor: v, rate_bp: b.rateBp == null ? '' : b.rateBp };
        }
        e.target.disabled = true;
        try {
          const old = sel.model.balances.find((x) => !x.void && x.account_id === a.id && x.date === dateIn.value);
          if (old) await app.void(sel.space, 'balances', old, 'corectat');
          await app.add(sel.space, 'balances', fields, `${editing === 'rate' ? 'dobândă' : 'sold'} ${a.name}`);
          editing = null; app.rerender();
        } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva.'; }
      };
      detail = h('div', { class: 'stack', style: 'gap:8px' },
        h('div', { class: 'between', style: 'align-items:flex-end;margin-top:4px' },
          h('span', { style: 'display:flex;flex-direction:column' }, h('b', {}, a.name),
            h('span', { class: 'mono', style: 'font-size:22px;font-weight:600' }, b.balance == null ? '–' : formatMinor(b.balance)),
            h('span', { class: 'xs muted' }, b.date ? 'sold la ' + shortDate(b.date) : 'niciun sold introdus')),
          h('span', { style: 'display:flex;flex-direction:column;text-align:right' },
            h('span', { class: 'mono', style: 'font-size:16px;font-weight:600' }, b.rateBp == null ? '–' : formatPercent(b.rateBp)),
            b.rateBp != null && b.balance != null ? h('span', { class: 'xs pos' }, `≈ ${Math.round(monthlyNetInterest(b.balance, b.rateBp) / 100)} lei net / lună`) : null)),
        b.history.length ? sparkline(b.history.slice(-6), { color: '#1F6F5C' }) : null,
        editing ? h('div', { class: 'stack', style: 'gap:8px' }, h('div', { class: 'grid2' }, input, dateIn), err,
          h('div', { class: 'grid2' }, h('button', { onclick: save }, 'Salvează'), h('button', { class: 'secondary', onclick: () => { editing = null; app.rerender(); } }, 'Renunță')))
          : (app.canEdit(sel.space) ? h('div', { class: 'grid2' },
            h('button', { style: 'background:#fff;color:var(--accent);border:1px solid var(--accent)', onclick: () => { editing = 'balance'; app.rerender(); } }, 'Sold nou'),
            h('button', { class: 'secondary', style: 'color:var(--ink)', onclick: () => { editing = 'rate'; app.rerender(); } }, 'Dobândă nouă')) : null),
        sel.space !== space ? h('span', { class: 'xs muted' }, `Acest cont e în spațiul „${SPACE_LABEL[sel.space]}”: îl vezi și îl actualizezi de aici, dar nu intră în totalul acestui spațiu.`) : null);
    }

    frame(app, {
      tab: 'conturi',
      head: backHead('#/active', 'Conturi', headTotal(m, total, today)),
      body: [
        h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, 'Conturi curente'), h('span', {}, 'sold · la data')),
          ...(currents.length ? currents.map(acctRow) : [h('p', { class: 'muted', style: 'padding:12px 14px;margin:0' }, 'Niciun cont curent.')])),
        vouchers.length ? h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, 'Tichete de masă')),
          h('div', { class: 'pair2' }, ...vouchers.map((a, i) => {
            const b = accountBalance(m, a.id, today);
            return h('div', { style: `display:flex;flex-direction:column;gap:2px;padding:9px 14px;${i % 2 === 0 ? 'border-right:1px solid var(--line2)' : ''}` },
              h('b', {}, a.owner), h('span', { class: 'mono' }, b.balance == null ? '–' : fmtNative(b.balance, 'RON', { unit: true })), h('span', { class: 'xs muted' }, b.date ? shortDate(b.date) : 'fără sold'));
          }))) : null,
        walletOwners.length ? h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, 'Portofele'), h('span', {}, 'lei · euro')),
          ...walletOwners.map((owner) => {
            const mine = wallets.filter((w) => w.account.owner === owner);
            const bal = (ccy) => { const w = mine.find((x) => x.account.currency_default === ccy); return w ? accountBalance(w.model, w.account.id, today) : null; };
            const ron = bal('RON'), eur = bal('EUR');
            const dates = [ron, eur].filter((b) => b && b.date).map((b) => b.date).sort();
            const oldest = dates[0], other = mine[0].space !== space;
            const stale = !oldest || [ron, eur].filter(Boolean).some((b) => b.days == null || b.days > STALE_DAYS);
            return h('div', { class: 'acctrow' },
              h('b', {}, owner), h('span', { class: 'mono' }, `${ron && ron.balance != null ? lei(ron.balance) : '–'} lei · ${eur && eur.balance != null ? lei(eur.balance) : '–'} €`),
              h('span', { class: 'xs muted' }, other ? `în spațiul ${SPACE_LABEL[mine[0].space]}` : ''),
              h('span', { class: 'xs', style: `text-align:right;${stale ? 'color:var(--neg);font-weight:600' : 'color:var(--muted)'}` }, oldest ? shortDate(oldest) : 'fără sold'));
          })) : null,
        savings.length ? h('section', { class: 'panel', style: 'gap:8px' },
          h('span', { class: 'up' }, 'Conturi de economii'),
          h('div', { class: 'tabs3', role: 'tablist', 'aria-label': 'Al cui cont de economii' }, ...savings.map((x) => {
            const b = accountBalance(x.model, x.account.id, today);
            const on = `${x.space}|${x.account.id}` === tab;
            return h('button', { role: 'tab', 'aria-selected': String(on), class: 'tab3' + (on ? ' on' : '') + (x.space !== space ? ' dash' : ''), onclick: () => { tab = `${x.space}|${x.account.id}`; editing = null; app.rerender(); } },
              h('span', {}, x.space !== space ? `${x.account.owner} · ${x.account.name}` : x.account.owner), h('b', {}, b.balance == null ? '–' : lei(b.balance)));
          })),
          detail) : null,
        canEdit ? h('a', { class: 'btn big', href: '#/conturi/solduri', style: 'margin:16px' }, icon('list', 18, 2), 'Actualizează toate soldurile') : null,
      ],
    });
  });
}
