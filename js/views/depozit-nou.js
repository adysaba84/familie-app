import { h } from '../dom.js';
import { addMonths, startFromMaturity, grossInterest, netOf, bfgByBankOwner, daysBetween } from '../calc.js';
import { parseAmount, parsePercent, formatMinor, formatWhole } from '../money.js';
import { SPACE_LABEL } from '../schema.js';
import { closeHead, frame, guarded, loading, fullDate } from '../ui.js';
import { finish } from '../return.js';
import { suggest } from '../notify.js';

const TERMS = [1, 3, 6, 12, 24, 36];
const CURRENCIES = ['RON', 'EUR', 'USD'];
let form = null;
let editing = null; // the deposit being modified: saving voids it and appends the new version

const fresh = (app) => ({ pair: null, bank: null, amount: '', currency: null, rate: '', term: 12, mode: 'start', date: app.today(), cap: false, renew: false, email: true });

// Called from the deposits list: prefill the form from an existing deposit.
export function startEdit(d) {
  editing = d;
  form = { pair: null, bank: null, amount: formatMinor(d.principal_minor), currency: d.currency, rate: formatMinor(d.rate_bp), term: d.term_months,
    mode: 'start', date: d.start_date, cap: !!d.capitalization, renew: !!d.auto_renew, email: d.notify_days > 0, accountId: d.account_id };
}

export async function depozitNouView(app) {
  loading();
  if (!form) form = fresh(app);
  const spaceNow = app.spaces.includes(form.space) ? form.space : app.space;
  return guarded({ ...app, space: spaceNow, model: (s) => app.model(s || spaceNow) }, async () => {
    // every (space, owner) that has a deposit bank account
    const models = {};
    for (const s of app.spaces) models[s] = await app.model(s);
    const pairs = [];
    for (const s of app.spaces) {
      for (const owner of [...new Set(models[s].accounts.filter((a) => !a.void && a.kind === 'deposit_bank' && a.status !== 'closed').map((a) => a.owner))]) {
        pairs.push({ key: `${s}|${owner}`, space: s, owner, label: s === 'iza' ? 'Iza' : `${SPACE_LABEL[s]} · ${owner}` });
      }
    }
    if (editing && form.accountId && !form.pair) {
      const acc = Object.values(models).flatMap((m) => m.accounts).find((a) => a.id === form.accountId);
      const p = acc && pairs.find((x) => x.owner === acc.owner && models[x.space].accounts.some((a) => a.id === acc.id));
      if (p) { form.pair = p.key; form.bank = acc.institution; }
    }
    if (!pairs.find((p) => p.key === form.pair)) { form.pair = pairs[0] ? pairs[0].key : null; form.bank = null; }
    const pair = pairs.find((p) => p.key === form.pair);
    if (!pair) { frame(app, { tab: 'depozite', head: closeHead('#/depozite', 'Depozit nou'), body: [h('p', { class: 'muted', style: 'margin:16px' }, 'Nu există conturi de depozit. Adaugă mai întâi conturile.')] }); return; }
    const m = models[pair.space];
    const banks = m.accounts.filter((a) => !a.void && a.kind === 'deposit_bank' && a.owner === pair.owner && a.status !== 'closed');
    if (!banks.find((b) => b.institution === form.bank)) form.bank = banks[0].institution;
    const account = banks.find((b) => b.institution === form.bank);
    if (!form.currency) form.currency = account.currency_default;
    const canEdit = app.canEdit(pair.space);
    const set = (patch) => { Object.assign(form, patch); app.rerender(); };
    const opt = (on, text, onclick, cls = '') => h('button', { type: 'button', class: `opt ${on ? 'on' : ''} ${cls}`, 'aria-pressed': String(on), onclick }, text);

    const amount = h('input', { class: 'input amt', style: 'font-size:20px;min-height:50px', value: form.amount, inputmode: 'decimal', 'aria-label': 'Sumă', placeholder: '0' });
    const rate = h('input', { class: 'input', style: 'min-height:50px;font-family:var(--mono);font-size:16px', value: form.rate, inputmode: 'decimal', 'aria-label': 'Dobândă %', placeholder: '5,40' });
    const dateIn = h('input', { class: 'input', type: 'date', value: form.date, 'aria-label': form.mode === 'start' ? 'Data constituirii' : 'Data scadenței' });
    const matText = h('b', { class: 'mono' });
    const preview = h('section', { class: 'panel', style: 'border-radius:10px;font-size:13px' });
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    const dates = () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return null;
      return form.mode === 'start' ? { start: form.date, maturity: addMonths(form.date, form.term) } : { start: startFromMaturity(form.date, form.term), maturity: form.date };
    };
    const update = () => {
      form.amount = amount.value; form.rate = rate.value; form.date = dateIn.value;
      const d = dates();
      matText.textContent = d ? (form.mode === 'start' ? fullDate(d.maturity) : 'constituit ' + fullDate(d.start)) : '–';
      preview.replaceChildren();
      const principal = parseAmount(form.amount), rateBp = parsePercent(form.rate);
      if (principal == null || principal <= 0 || rateBp == null || !d) return;
      const gross = grossInterest({ principal_minor: principal, rate_bp: rateBp, term_months: form.term, start_date: d.start, maturity_date: d.maturity, capitalization: form.cap ? 1 : 0 });
      const tax = gross - netOf(gross);
      const sym = form.currency === 'RON' ? 'lei' : form.currency;
      const hypo = { ...m, deposits: [...m.deposits.filter((x) => !editing || x.id !== editing.id),
        { id: 'new', account_id: account.id, currency: form.currency, principal_minor: principal, status: 'active', start_date: d.start, maturity_date: d.maturity }] };
      const after = bfgByBankOwner(hypo, d.start > app.today() ? d.start : app.today()).find((b) => b.institution === account.institution && b.owner === account.owner);
      preview.append(...[
        h('div', { class: 'between' }, h('span', {}, 'Dobândă brută (estimare)'), h('span', { class: 'mono' }, formatMinor(gross))),
        h('div', { class: 'between muted' }, h('span', {}, '− impozit 10%'), h('span', { class: 'mono' }, formatMinor(tax))),
        h('div', { class: 'between', style: 'font-weight:600;border-top:1px solid var(--line);padding-top:4px' }, h('span', {}, 'La scadență'), h('span', { class: 'mono pos' }, `${formatMinor(principal + netOf(gross))} ${sym}`)),
        after ? h('span', { class: 'xs ' + (after.over ? 'neg' : 'muted') }, `${account.owner} la ${account.institution} după depozit: ${formatWhole(after.eurMinor)} € din 100.000 € garantați`) : null,
        daysBetween(app.today(), d.maturity) < 0 ? h('span', { class: 'xs neg' }, 'Scadența e în trecut.') : null].filter(Boolean));
    };
    for (const el of [amount, rate, dateIn]) el.addEventListener('input', () => { err.textContent = ''; update(); });

    const save = async (e) => {
      const principal = parseAmount(form.amount), rateBp = parsePercent(form.rate), d = dates();
      if (principal == null || principal <= 0) { err.textContent = 'Introdu o sumă validă.'; return; }
      if (rateBp == null) { err.textContent = 'Introdu dobânda, ex. 5,40.'; return; }
      if (!d) { err.textContent = 'Alege data.'; return; }
      e.target.disabled = true;
      try {
        if (editing) await app.void(pair.space, 'deposits', editing, 'modificat');
        const saved = await app.add(pair.space, 'deposits', {
          account_id: account.id, currency: form.currency, principal_minor: principal, rate_bp: rateBp, term_months: form.term,
          start_date: d.start, maturity_date: d.maturity, capitalization: form.cap ? 1 : 0, auto_renew: form.renew ? 1 : 0,
          notify_days: form.email ? 3 : 0, status: 'active', note: '',
        }, `depozit ${account.institution} ${form.currency}`);
        suggest({ id: saved.id, institution: account.institution, owner: account.owner, currency: form.currency, principalMinor: principal, rateBp, maturity: d.maturity });
        form = null; editing = null;
        finish(app, '/depozite');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
    };

    const toggle = (label, key, first) => h('label', { style: `display:flex;align-items:center;justify-content:space-between;min-height:44px;font-size:14px;${first ? '' : 'border-top:1px solid var(--line)'}` }, label,
      h('input', { type: 'checkbox', checked: form[key], style: 'width:22px;height:22px;accent-color:var(--accent)', onchange: (e) => { form[key] = e.target.checked; update(); } }));

    frame(app, {
      tab: 'depozite', head: closeHead('#/depozite', editing ? 'Modifică depozitul' : 'Depozit nou'),
      body: [
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
          h('div', { class: 'grid2' },
            h('label', { class: 'f' }, 'Pentru', h('select', { class: 'input', style: 'font-weight:600', onchange: (e) => set({ pair: e.target.value, bank: null, currency: null }) },
              ...pairs.map((p) => h('option', { value: p.key, selected: p.key === form.pair }, p.label)))),
            h('fieldset', {}, h('legend', {}, 'Bancă'),
              h('div', { class: 'opts', style: `grid-template-columns:repeat(${Math.min(3, banks.length)},minmax(0,1fr));gap:4px` },
                ...banks.map((b) => opt(b.institution === form.bank, b.institution, () => set({ bank: b.institution, currency: b.currency_default }), 'tall'))))),
          h('div', { style: 'display:grid;grid-template-columns:1fr 90px 90px;gap:8px' },
            h('label', { class: 'f' }, 'Sumă', amount),
            h('label', { class: 'f' }, 'Valută', h('select', { class: 'input', style: 'min-height:50px;font-weight:600', onchange: (e) => { form.currency = e.target.value; update(); } },
              ...CURRENCIES.map((c) => h('option', { value: c, selected: c === form.currency }, c)))),
            h('label', { class: 'f' }, 'Dobândă %', rate)),
          h('fieldset', {}, h('legend', {}, 'Perioadă'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(6,minmax(0,1fr));gap:6px' },
              ...TERMS.map((t) => opt(form.term === t, t === 1 ? '1 lună' : `${t} luni`, () => set({ term: t }), 'chip-term')))),
          h('div', { class: 'panel', style: 'margin:0;border-radius:10px;padding:10px 12px;gap:8px' },
            h('div', { class: 'seg', style: 'margin:0;grid-template-columns:repeat(2,minmax(0,1fr))', role: 'radiogroup', 'aria-label': 'Ce dată știi' },
              h('button', { type: 'button', role: 'radio', 'aria-checked': String(form.mode === 'start'), class: form.mode === 'start' ? 'on' : '', style: form.mode === 'start' ? 'background:var(--ink)' : '', onclick: () => set({ mode: 'start' }) }, 'Data constituirii'),
              h('button', { type: 'button', role: 'radio', 'aria-checked': String(form.mode === 'maturity'), class: form.mode === 'maturity' ? 'on' : '', style: form.mode === 'maturity' ? 'background:var(--ink)' : '', onclick: () => set({ mode: 'maturity' }) }, 'Data scadenței')),
            h('div', { style: 'display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center' }, dateIn,
              h('span', { class: 'sm muted' }, form.mode === 'start' ? 'scadență ' : '', matText))),
          toggle('Cu capitalizare', 'cap', true), toggle('Se prelungește automat', 'renew'), toggle('Email cu 3 zile înainte de scadență', 'email')),
        preview,
        h('div', { class: 'savebar' }, err,
          canEdit ? h('button', { class: 'btn big', onclick: save }, editing ? 'Salvează modificarea' : 'Salvează depozitul') : h('p', { class: 'muted' }, 'Ai acces doar de citire la acest spațiu.')),
      ],
    });
    update();
  });
}

// leaving the form without saving (e.g. via the tab bar) must not leak an edit into the next "new deposit"
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/depozite/nou')) { form = null; editing = null; } });
