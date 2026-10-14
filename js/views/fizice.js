import { h } from '../dom.js';
import { goldItems, safeCash, totalsByCategory } from '../calc.js';
import { parseAmount, formatMinor } from '../money.js';
import { sparkline } from '../charts.js';
import { icon, frame, backHead, guarded, loading, lei, fmtNative, shortDate, pctText } from '../ui.js';

let valueFor = null; // gold item id whose "valoare de azi" form is open
let editCash = null; // cash item id being edited
const CCY_COLOR = { EUR: '#4C78A8', USD: '#A9CFC2', RON: '#1F6F5C' };
const CCY_NOTE = { RON: 'lei pentru zile fără bănci' };

export async function fiziceView(app) {
  loading();
  return guarded(app, (m) => {
    const today = app.today();
    const total = totalsByCategory(m, today).physical;
    const golds = goldItems(m, today);
    const cash = safeCash(m, today);
    const cashRon = cash.reduce((s, c) => s + c.ron, 0);
    const canEdit = app.canEdit();
    const space = app.space;
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    const saveValue = async (itemId, input, dateIn, e) => {
      const v = parseAmount(input.value);
      if (v == null || v < 0) { err.textContent = 'Introdu o valoare validă.'; return; }
      e.target.disabled = true;
      try {
        // same item + same day = a correction: void the old row, append the new one
        const old = m.physical_values.find((x) => !x.void && x.item_id === itemId && x.date === dateIn.value);
        if (old) await app.void(space, 'physical_values', old, 'corectat');
        await app.add(space, 'physical_values', { item_id: itemId, date: dateIn.value, value_minor: v }, 'valoare obiect ' + dateIn.value);
        valueFor = null; editCash = null; app.rerender();
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva.'; }
    };
    const valueForm = (itemId, label, placeholder) => {
      const input = h('input', { class: 'input', inputmode: 'decimal', 'aria-label': label, placeholder });
      const dateIn = h('input', { class: 'input', type: 'date', value: today, 'aria-label': 'Data' });
      return h('div', { class: 'stack', style: 'gap:8px' },
        h('div', { class: 'grid2' }, input, dateIn), err,
        h('div', { class: 'grid2' }, h('button', { onclick: (e) => saveValue(itemId, input, dateIn, e) }, 'Salvează'),
          h('button', { class: 'secondary', onclick: () => { valueFor = null; editCash = null; app.rerender(); } }, 'Renunță')));
    };

    const goldCard = (g) => h('section', { class: 'panel', style: 'gap:10px' },
      h('div', { class: 'between', style: 'align-items:flex-start' },
        h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, h('span', { class: 'up' }, 'Aur'), h('span', { style: 'font-size:15px;font-weight:600' }, g.item.description),
          h('span', { class: 'sm muted' }, g.item.quantity ? `${g.item.quantity} buc.` : '')),
        h('span', { style: 'width:40px;height:40px;border-radius:20px;background:var(--gold);color:var(--ink);font:700 12px var(--mono);display:flex;align-items:center;justify-content:center' }, 'Au')),
      h('div', { class: 'stat3' },
        h('div', {}, h('span', { class: 'xs muted' }, 'Cumpărare'), h('span', { class: 'mono', style: 'font-size:15px' }, lei(g.purchase))),
        h('div', {}, h('span', { class: 'xs muted' }, 'Valoare · ' + shortDate(g.valueDate)), h('span', { class: 'mono', style: 'font-size:15px' }, lei(g.value))),
        h('div', {}, h('span', { class: 'xs muted' }, 'Câștig'), h('span', { class: 'mono ' + (g.gainBp < 0 ? 'neg' : 'pos'), style: 'font-size:15px' }, pctText(g.gainBp)))),
      sparkline(g.history, { baseline: g.purchase || null }),
      h('span', { class: 'xs muted' }, `${g.history.length} valori introduse · linia punctată = prețul de cumpărare`),
      valueFor === g.item.id ? valueForm(g.item.id, 'Valoarea de azi', formatMinor(g.value))
        : canEdit ? h('div', { class: 'grid2' },
          h('button', { class: 'outline', style: 'background:#fff;color:var(--accent);border:1px solid var(--accent)', onclick: () => { valueFor = g.item.id; app.rerender(); } }, 'Valoare de azi'),
          h('a', { class: 'btn secondary', href: '#/fizice/nou', style: 'color:var(--ink)' }, '+ Alt obiect')) : null);

    const cashRow = (c) => editCash === c.item.id
      ? h('div', { style: 'padding:8px 0;border-bottom:1px solid var(--line2)' }, h('b', {}, c.item.currency), valueForm(c.item.id, 'Suma în ' + c.item.currency, formatMinor(c.native)))
      : h('div', { class: 'cashrow' },
        h('i', { style: `width:10px;height:10px;border-radius:3px;background:${CCY_COLOR[c.item.currency] || '#888'}` }),
        h('b', {}, c.item.currency === 'RON' ? 'LEI' : c.item.currency),
        h('span', { style: 'display:flex;flex-direction:column;text-align:right' },
          h('span', { class: 'mono' }, fmtNative(c.native, c.item.currency, { unit: true })),
          h('span', { class: 'xs muted' }, c.item.currency === 'RON' ? (CCY_NOTE.RON) : `${lei(c.ron)} lei`)),
        canEdit ? h('button', { class: 'iconbtn secondary', style: 'width:40px;height:40px;min-height:40px;padding:0;color:var(--muted);border:0;background:transparent', 'aria-label': 'Modifică ' + c.item.currency, onclick: () => { editCash = c.item.id; app.rerender(); } },
          icon('edit', 18, 1.9)) : h('span'));

    frame(app, {
      tab: 'active',
      head: backHead('#/active', 'Seif', h('span', { class: 'mono', style: 'font-size:15px;font-weight:600;padding-right:6px' }, lei(total) + ' lei')),
      body: [
        ...golds.map(goldCard),
        golds.length === 0 ? h('div', { class: 'card' }, h('p', { class: 'muted', style: 'margin:0 0 12px' }, 'Niciun obiect de aur înregistrat.'), canEdit ? h('a', { class: 'btn', href: '#/fizice/nou' }, 'Adaugă obiect') : null) : null,
        cash.length ? h('section', { class: 'panel', style: 'gap:10px' },
          h('div', { class: 'between' }, h('span', { class: 'up' }, 'Numerar în seif'), h('span', { class: 'mono', style: 'font-weight:600' }, lei(cashRon) + ' lei')),
          h('div', { class: 'split', style: 'height:10px' }, ...cash.filter((c) => c.ron > 0).map((c) => h('div', { style: `width:${(c.ron * 100) / (cashRon || 1)}%;background:${CCY_COLOR[c.item.currency] || '#888'}` }))),
          ...cash.map(cashRow)) : null,
      ],
    });
  });
}
