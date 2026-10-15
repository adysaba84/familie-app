import { h } from '../dom.js';
import { investedByInstrument, latestBrokerValues, toRon, accountNetFlowsRon, lastValueDate, addDays } from '../calc.js';
import { parseAmount } from '../money.js';
import { SPACE_LABEL } from '../schema.js';
import { closeHead, frame, guarded, loading, lei, signed, fmtNative, shortDate } from '../ui.js';
import { INSTRUMENT_LABEL } from './bursa.js';
import { finish } from '../return.js';

const INSTR_ORDER = ['stocks_etf', 'bonds', 'cash'];
const CURRENCIES = ['RON', 'EUR', 'USD'];
let form = null;
const fresh = (app) => ({ space: app.space, accountId: null, date: app.today(), entered: {}, extra: [] });

// From Active: open the form on one broker account (or the first one).
export function startValoare(app, accountId) { form = { ...fresh(app), accountId: accountId || null }; }

// "Bursă · introducere" (2/2): account value on a date, one input per currency x instrument.
// Bonds (incl. titluri de stat) are entered at investment value, so they are not typed here.
export async function bursaValoareView(app) {
  loading();
  if (!form || !app.spaces.includes(form.space)) form = fresh(app);
  const space = form.space;
  return guarded({ ...app, space, model: (s) => app.model(s || space) }, async (m) => {
    const accounts = m.accounts.filter((a) => !a.void && a.kind === 'broker' && a.status !== 'closed');
    if (!accounts.find((a) => a.id === form.accountId)) { form.accountId = accounts[0] ? accounts[0].id : null; form.entered = {}; form.extra = []; }
    const acc = accounts.find((a) => a.id === form.accountId);
    const canEdit = app.canEdit(space);
    const set = (patch) => { Object.assign(form, patch); app.rerender(); };
    const head = closeHead('#/bursa', 'Bursă · introducere');
    if (!acc) {
      frame(app, { tab: 'active', head, body: [h('p', { class: 'muted', style: 'margin:16px' }, 'Nu există conturi de bursă în acest spațiu.')] });
      return;
    }

    const before = addDays(form.date, -1);
    const invested = investedByInstrument(m.broker_flows, form.date);
    const latest = latestBrokerValues(m.broker_values, form.date);
    // components = everything this account has ever had + defaults + what the user added now
    const pairs = new Map();
    const addPair = (ccy, instr) => pairs.set(ccy + '|' + instr, { ccy, instr });
    for (const k of invested.keys()) { const [a, c, i] = k.split('|'); if (a === acc.id) addPair(c, i); }
    for (const v of m.broker_values) if (!v.void && v.account_id === acc.id) addPair(v.currency, v.instrument);
    addPair(acc.currency_default, 'stocks_etf');
    addPair(acc.currency_default, 'cash');
    for (const e of form.extra) addPair(e.ccy, e.instr);
    const ccyRank = (c) => (c === acc.currency_default ? '0' : '1' + c);
    const list = [...pairs.values()].sort((a, b) => (ccyRank(a.ccy) < ccyRank(b.ccy) ? -1 : ccyRank(a.ccy) > ccyRank(b.ccy) ? 1 : INSTR_ORDER.indexOf(a.instr) - INSTR_ORDER.indexOf(b.instr)));

    const keyOf = (p) => `${acc.id}|${p.ccy}|${p.instr}`;
    const lastOf = (p) => latest.get(keyOf(p));
    const investedOf = (p) => invested.get(keyOf(p)) || 0;
    // value used for the preview: bonds at invested > typed > last known
    const effective = (p) => {
      if (p.instr === 'bonds') return investedOf(p);
      const t = form.entered[keyOf(p)];
      const parsed = t == null || t === '' ? null : parseAmount(t);
      return parsed != null ? parsed : (lastOf(p) ? lastOf(p).value_minor : 0);
    };

    const preview = h('section', { class: 'panel', style: 'border-radius:10px;font-size:13px' });
    const err = h('p', { class: 'err sm', style: 'margin:0' });
    const updatePreview = () => {
      const total = list.reduce((s, p) => s + toRon(effective(p), p.ccy, m.rates, form.date), 0);
      const prevDate = lastValueDate(m, acc.id, before);
      let prevTotal = 0;
      for (const v of latestBrokerValues(m.broker_values, before).values()) {
        if (v.account_id === acc.id) prevTotal += toRon(v.value_minor, v.currency, m.rates, before);
      }
      const flows = prevDate ? accountNetFlowsRon(m, acc.id, prevDate, form.date) : 0;
      preview.replaceChildren(
        h('span', { class: 'up xs' }, 'Sold cont ' + acc.institution),
        h('div', { class: 'between' }, h('span', {}, 'Total în lei'), h('b', { class: 'mono' }, lei(total))),
        prevDate
          ? h('div', { class: 'between muted' }, h('span', {}, 'față de ' + shortDate(prevDate)),
            h('span', { class: 'mono ' + (total - prevTotal < 0 ? 'neg' : 'pos') }, `${signed(total - prevTotal)} · din care depuneri ${lei(flows)}`))
          : h('div', { class: 'muted' }, 'Prima valoare introdusă pentru acest cont.'));
    };

    const rows = [];
    let curCcy = null;
    for (const p of list) {
      if (p.ccy !== curCcy) { rows.push(h('div', { class: 'grp' }, p.ccy)); curCcy = p.ccy; }
      const lv = lastOf(p);
      const sub = p.instr === 'bonds' ? 'la valoarea de investiție'
        : lv ? `ultima: ${fmtNative(lv.value_minor, p.ccy, { unit: false, cents: true })} · ${shortDate(lv.date)}` : 'fără valoare anterioară';
      const left = h('span', { style: 'display:flex;flex-direction:column' }, h('span', {}, INSTRUMENT_LABEL[p.instr]), h('span', { class: 'xs muted' }, sub));
      if (p.instr === 'bonds') {
        rows.push(h('div', { class: 'valrow' }, left, h('span', { class: 'ro' }, fmtNative(investedOf(p), p.ccy))));
      } else {
        const input = h('input', {
          class: 'input', inputmode: 'decimal', 'aria-label': `${INSTRUMENT_LABEL[p.instr]} în ${p.ccy}`, value: form.entered[keyOf(p)] || '',
          placeholder: lv ? fmtNative(lv.value_minor, p.ccy, { unit: false, cents: true }) : '0',
        });
        input.addEventListener('input', () => { form.entered[keyOf(p)] = input.value; err.textContent = ''; updatePreview(); });
        rows.push(h('div', { class: 'valrow' }, left, input));
      }
    }

    const addCcy = h('select', { class: 'input', 'aria-label': 'Valută' }, ...CURRENCIES.map((c) => h('option', { value: c }, c)));
    const addInstr = h('select', { class: 'input', 'aria-label': 'Tip' }, ...INSTR_ORDER.map((i) => h('option', { value: i }, INSTRUMENT_LABEL[i])));
    const adder = h('div', { class: 'grid2', style: 'padding:10px 14px;border-top:1px solid var(--line2)' }, addCcy, addInstr,
      h('button', { type: 'button', class: 'secondary', style: 'grid-column:span 2', onclick: () => set({ extra: [...form.extra, { ccy: addCcy.value, instr: addInstr.value }] }) }, '+ Adaugă valută sau tip'));

    const save = async (e) => {
      const writes = [];
      for (const p of list) {
        if (p.instr === 'bonds') {
          const inv = investedOf(p), lv = lastOf(p);
          if (inv !== 0 && (!lv || lv.value_minor !== inv || lv.date !== form.date)) writes.push({ p, value: inv });
          continue;
        }
        const t = form.entered[keyOf(p)];
        if (t == null || t === '') continue;
        const v = parseAmount(t);
        if (v == null || v < 0) { err.textContent = `Valoare invalidă la ${INSTRUMENT_LABEL[p.instr]} ${p.ccy}.`; return; }
        writes.push({ p, value: v });
      }
      if (!writes.length) { err.textContent = 'Nu ai introdus nicio valoare nouă.'; return; }
      e.target.disabled = true;
      try {
        // edit = void the old row for the same day, then append the new one
        for (const w of writes) {
          const old = m.broker_values.find((v) => !v.void && v.account_id === acc.id && v.currency === w.p.ccy && v.instrument === w.p.instr && v.date === form.date);
          if (old) await app.void(space, 'broker_values', old, 'corectat');
        }
        await app.addMany(space, 'broker_values', writes.map((w) => ({
          date: form.date, account_id: acc.id, currency: w.p.ccy, instrument: w.p.instr, value_minor: w.value,
        })), `valoare ${acc.institution} ${form.date}`);
        form = null;
        finish(app, '/bursa');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
    };

    const opt = (on, text, onclick) => h('button', { type: 'button', class: 'opt' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick }, text);
    frame(app, {
      tab: 'active', head,
      body: [
        h('div', { class: 'seg tall', role: 'radiogroup', 'aria-label': 'Ce introduci', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
          h('a', { role: 'radio', 'aria-checked': 'false', href: '#/bursa/nou' }, 'Sumă investită'),
          h('button', { role: 'radio', 'aria-checked': 'true', class: 'on' }, 'Valoare cont la dată')),
        app.spaces.length > 1 ? h('div', { class: 'opts', style: 'grid-template-columns:repeat(2,minmax(0,1fr));margin:14px 16px 0' },
          ...app.spaces.map((s) => opt(form.space === s, SPACE_LABEL[s], () => set({ space: s, accountId: null, entered: {}, extra: [] })))) : null,
        h('div', { style: 'margin:14px 16px 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px' },
          h('label', { class: 'f', style: 'grid-column:span 2' }, 'Cont',
            h('select', { class: 'input', style: 'font-weight:600', onchange: (e) => { form.accountId = e.target.value; form.entered = {}; form.extra = []; app.rerender(); } },
              ...accounts.map((a) => h('option', { value: a.id, selected: a.id === acc.id }, `${a.institution} · ${a.owner}`)))),
          h('label', { class: 'f' }, 'La data',
            h('input', { class: 'input', type: 'date', value: form.date, style: 'padding:0 6px;font-size:13px', onchange: (e) => set({ date: e.target.value }) }))),
        h('section', { class: 'panel flush', style: 'margin-top:14px' },
          h('div', { class: 'valrow', style: 'font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--line)' },
            h('span', {}, 'Componentă'), h('span', { style: 'text-align:right' }, 'Valoare azi')),
          ...rows, adder),
        preview,
        h('div', { class: 'savebar' }, err,
          canEdit ? h('button', { class: 'btn big', onclick: save }, 'Salvează valorile') : h('p', { class: 'muted' }, 'Ai acces doar de citire la acest spațiu.')),
      ],
    });
    updatePreview();
  });
}
