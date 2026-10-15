import { h } from '../dom.js';
import { investedByAccount, brokerValueByAccount, lastValueDate } from '../calc.js';
import { parseAmount } from '../money.js';
import { SPACE_LABEL } from '../schema.js';
import { closeHead, frame, guarded, loading, fmtNative, shortDate } from '../ui.js';
import { INSTRUMENT_LABEL } from './bursa.js';
import { finish } from '../return.js';

const INSTRUMENTS = ['stocks_etf', 'bonds', 'cash'];
const CURRENCIES = ['RON', 'EUR', 'USD'];
let form = null; // survives re-renders within the screen; reset on save

const fresh = (app) => ({ space: app.space, accountId: null, instrument: 'stocks_etf', amount: '', currency: null, date: app.today(), direction: 'in', note: '' });

// From Active: open the form on one broker account (or the first one).
export function startNou(app, accountId) { form = { ...fresh(app), accountId: accountId || null }; }

// "Bursă · introducere" (1/2): amount invested (deposit or withdrawal) on a platform.
export async function bursaNouView(app) {
  loading();
  if (!form || !app.spaces.includes(form.space)) form = fresh(app);
  const space = form.space;
  return guarded({ ...app, space, model: (s) => app.model(s || space) }, async (m) => {
    const accounts = m.accounts.filter((a) => !a.void && a.kind === 'broker' && a.status !== 'closed');
    if (!accounts.find((a) => a.id === form.accountId)) { form.accountId = accounts[0] ? accounts[0].id : null; form.currency = null; }
    const acc = accounts.find((a) => a.id === form.accountId);
    if (acc && !form.currency) form.currency = acc.currency_default;
    const canEdit = app.canEdit(space);

    const opt = (on, text, onclick) => h('button', { type: 'button', class: 'opt' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick }, text);
    const set = (patch) => { Object.assign(form, patch); app.rerender(); };
    const accLabel = (a) => (accounts.filter((x) => x.institution === a.institution).length > 1 ? `${a.institution} · ${a.owner}` : a.institution);

    const preview = h('section', { class: 'panel', style: 'border-radius:10px;font-size:13px' });
    const amountInput = h('input', { class: 'input amt', value: form.amount, inputmode: 'decimal', 'aria-label': 'Sumă', placeholder: '0' });
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    const updatePreview = () => {
      form.amount = amountInput.value;
      const minor = parseAmount(form.amount);
      preview.replaceChildren();
      if (!acc) return;
      const key = acc.id + '|' + form.currency;
      const inv = investedByAccount(m.broker_flows).get(key) || 0;
      const delta = minor == null ? 0 : (form.direction === 'in' ? minor : -minor);
      const lastDate = lastValueDate(m, acc.id, form.date);
      const val = brokerValueByAccount(m.broker_values, form.date).get(key);
      preview.append(
        h('span', { class: 'up xs' }, `După salvare · ${acc.institution} ${form.currency}`),
        h('div', { class: 'between' }, h('span', {}, 'Investit'),
          h('span', { class: 'mono' }, fmtNative(inv, form.currency, { unit: false, cents: inv % 100 !== 0 }), ' → ', h('b', {}, fmtNative(inv + delta, form.currency, { unit: false, cents: (inv + delta) % 100 !== 0 })))),
        h('div', { class: 'between muted' }, h('span', {}, lastDate ? `Ultima valoare (${shortDate(lastDate)})` : 'Ultima valoare'),
          h('span', { class: 'mono' }, val == null ? '–' : fmtNative(val, form.currency, { unit: false }))));
    };
    amountInput.addEventListener('input', () => { err.textContent = ''; updatePreview(); });

    const save = async (e) => {
      const minor = parseAmount(form.amount);
      if (minor == null || minor <= 0) { err.textContent = 'Introdu o sumă validă, ex. 5.000 sau 1.250,50.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) { err.textContent = 'Alege data.'; return; }
      e.target.disabled = true;
      try {
        await app.add(space, 'broker_flows', {
          date: form.date, account_id: acc.id, currency: form.currency, instrument: form.instrument,
          amount_minor: minor, direction: form.direction, note: form.note,
        }, `${form.direction === 'in' ? 'depunere' : 'retragere'} ${acc.institution} ${form.currency}`);
        form = null;
        finish(app, '/bursa');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
    };

    frame(app, {
      tab: 'bursa', head: closeHead('#/bursa', 'Bursă · introducere'),
      body: [
        h('div', { class: 'seg tall', role: 'radiogroup', 'aria-label': 'Ce introduci', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
          h('button', { role: 'radio', 'aria-checked': 'true', class: 'on' }, 'Sumă investită'),
          h('a', { role: 'radio', 'aria-checked': 'false', href: '#/bursa/valoare' }, 'Valoare cont la dată')),
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
          app.spaces.length > 1 ? h('fieldset', {}, h('legend', {}, 'Pentru'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
              ...app.spaces.map((s) => opt(form.space === s, SPACE_LABEL[s], () => set({ space: s, accountId: null, currency: null }))))) : null,
          h('fieldset', {}, h('legend', {}, 'Platformă'),
            accounts.length
              ? h('div', { class: 'opts', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' },
                ...accounts.map((a) => opt(a.id === form.accountId, accLabel(a), () => set({ accountId: a.id, currency: a.currency_default }))))
              : h('p', { class: 'muted sm' }, 'Nu există conturi de bursă în acest spațiu.')),
          h('fieldset', {}, h('legend', {}, 'Tip'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' },
              ...INSTRUMENTS.map((i) => opt(form.instrument === i, INSTRUMENT_LABEL[i], () => set({ instrument: i }))))),
          h('div', { style: 'display:grid;grid-template-columns:1fr 110px;gap:10px' },
            h('label', { class: 'f' }, 'Sumă', amountInput),
            h('label', { class: 'f' }, 'Valută',
              h('select', { class: 'input', style: 'min-height:52px;font-weight:600;font-size:16px', 'aria-label': 'Valută', onchange: (e) => set({ currency: e.target.value }) },
                ...CURRENCIES.map((c) => h('option', { value: c, selected: c === form.currency }, c))))),
          h('div', { class: 'grid2' },
            h('label', { class: 'f' }, 'Data', h('input', { class: 'input', type: 'date', value: form.date, onchange: (e) => { form.date = e.target.value; updatePreview(); } })),
            h('label', { class: 'f' }, 'Mișcare',
              h('select', { class: 'input', onchange: (e) => { form.direction = e.target.value; updatePreview(); } },
                h('option', { value: 'in', selected: form.direction === 'in' }, 'Depunere'),
                h('option', { value: 'out', selected: form.direction === 'out' }, 'Retragere')))),
          h('label', { class: 'f' }, 'Notă (opțional)',
            h('input', { class: 'input', value: form.note, placeholder: 'ex. plan lunar, semiconductori', oninput: (e) => { form.note = e.target.value; } }))),
        preview,
        h('div', { class: 'savebar' }, err,
          canEdit ? h('button', { class: 'btn big', disabled: !acc, onclick: save }, 'Salvează')
            : h('p', { class: 'muted' }, 'Ai acces doar de citire la acest spațiu.')),
      ],
    });
    updatePreview();
  });
}
