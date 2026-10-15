import { h } from '../dom.js';
import { parseAmount } from '../money.js';
import { closeHead, frame, guarded, loading } from '../ui.js';
import { finish } from '../return.js';

let form = null;
const fresh = (app) => ({ kind: 'gold', sub: 'property', description: '', quantity: '1', amount: '', currency: 'EUR', date: app.today() });

// From Active: the same form with the kind pre-selected ('gold' | 'cash' | 'property' | 'other').
export function startNew(app, kind) { form = { ...fresh(app), kind, currency: kind === 'other' ? 'RON' : 'EUR' }; }

// "+ Alt obiect": a gold item (purchase value in lei) or a cash currency kept in the safe.
export async function fiziceNouView(app) {
  loading();
  if (!form) form = fresh(app);
  return guarded(app, async () => {
    const space = app.space;
    const set = (patch) => { Object.assign(form, patch); app.rerender(); };
    const err = h('p', { class: 'err sm', style: 'margin:0' });
    const desc = h('input', { class: 'input', value: form.description, placeholder: form.kind === 'gold' ? 'ex. 1 uncie Filarmonica Viena' : form.kind === 'other' ? 'ex. Estimare alte bunuri (mobilier, electronice)' : 'ex. Seif: rezervă euro', 'aria-label': 'Descriere', oninput: (e) => { form.description = e.target.value; } });
    const qty = h('input', { class: 'input', value: form.quantity, inputmode: 'decimal', 'aria-label': 'Cantitate', oninput: (e) => { form.quantity = e.target.value; } });
    const amount = h('input', { class: 'input amt', value: form.amount, inputmode: 'decimal', 'aria-label': form.kind === 'gold' ? 'Valoare de cumpărare în lei' : 'Suma', placeholder: '0', oninput: (e) => { form.amount = e.target.value; } });
    const dateIn = h('input', { class: 'input', type: 'date', value: form.date, onchange: (e) => { form.date = e.target.value; } });

    const save = async (e) => {
      const v = parseAmount(form.amount);
      if (!form.description.trim()) { err.textContent = 'Scrie o descriere.'; return; }
      if (v == null || v < 0) { err.textContent = 'Introdu o sumă validă.'; return; }
      const q = Number(String(form.quantity).replace(',', '.'));
      if (!(q > 0)) { err.textContent = 'Cantitate invalidă.'; return; }
      e.target.disabled = true;
      try {
        const gold = form.kind === 'gold';
        const kind = form.kind === 'property' ? form.sub : form.kind === 'other' ? 'other_goods' : form.kind; // house / car / garage / other goods
        const item = await app.add(space, 'physical_items', {
          kind, currency: gold ? 'RON' : form.currency, description: form.description.trim(), quantity: q,
          purchase_value_minor: gold ? v : '', purchase_date: form.date,
        }, form.description.trim());
        // cash: the amount is its first value; gold: the purchase price is the first point of the history
        await app.add(space, 'physical_values', { item_id: item.id, date: form.date, value_minor: v }, 'valoare inițială');
        form = null;
        finish(app, '/fizice');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva.'; }
    };

    const opt = (on, text, onclick) => h('button', { type: 'button', class: 'opt' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick }, text);
    frame(app, {
      tab: 'fizice', head: closeHead('#/fizice', 'Obiect nou'),
      body: [
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
          h('fieldset', {}, h('legend', {}, 'Ce adaugi'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
              opt(form.kind === 'gold', 'Aur', () => set({ kind: 'gold' })), opt(form.kind === 'cash', 'Numerar', () => set({ kind: 'cash' })), opt(form.kind === 'property', 'Imobil', () => set({ kind: 'property' })), opt(form.kind === 'other', 'Alte bunuri', () => set({ kind: 'other', currency: 'RON' })))),
          form.kind === 'property' ? h('fieldset', {}, h('legend', {}, 'Ce fel'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' },
              ...[['property', 'Locuință'], ['vehicle', 'Mașină'], ['garage', 'Garaj']].map(([k, t]) => opt(form.sub === k, t, () => set({ sub: k }))))) : null,
          h('label', { class: 'f' }, 'Descriere', desc),
          form.kind === 'gold' ? h('label', { class: 'f' }, 'Cantitate (bucăți)', qty) : h('label', { class: 'f' }, 'Valută',
            h('select', { class: 'input', onchange: (e) => { form.currency = e.target.value; } }, ...['EUR', 'USD', 'RON'].map((c) => h('option', { value: c, selected: c === form.currency }, c)))),
          h('label', { class: 'f' }, form.kind === 'gold' ? 'Valoare de cumpărare (lei)' : form.kind === 'property' || form.kind === 'other' ? 'Valoare estimată' : 'Suma în seif', amount),
          h('label', { class: 'f' }, form.kind === 'gold' ? 'Data cumpărării' : 'La data', dateIn)),
        h('div', { class: 'savebar' }, err, app.canEdit() ? h('button', { class: 'btn big', onclick: save }, 'Salvează') : h('p', { class: 'muted' }, 'Ai acces doar de citire.')),
      ],
    });
  });
}

window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/fizice/nou')) form = null; });
