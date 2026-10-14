import { h } from '../dom.js';
import { parseRate, formatRate } from '../money.js';
import { backHead, frame, loading, shortDate } from '../ui.js';

// Manual BNR rate entry: a fallback until the Apps Script job (M6) fills the rates tab daily.
export async function cursView(app) {
  loading();
  const m = await app.model();
  const recent = [...m.rates].filter((r) => !r.void).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  const date = h('input', { class: 'input', type: 'date', value: app.today() });
  const eur = h('input', { class: 'input', inputmode: 'decimal', placeholder: 'ex. 5,0800', 'aria-label': 'Curs EUR' });
  const usd = h('input', { class: 'input', inputmode: 'decimal', placeholder: 'ex. 4,3700', 'aria-label': 'Curs USD' });
  const err = h('p', { class: 'err sm', style: 'margin:0' });
  const save = async (e) => {
    const rates = { EUR: parseRate(eur.value), USD: parseRate(usd.value) };
    if (rates.EUR == null || rates.USD == null || rates.EUR <= 0 || rates.USD <= 0) { err.textContent = 'Introdu cursurile EUR și USD, ex. 5,0800.'; return; }
    e.target.disabled = true;
    try { await app.addRate(date.value, rates); app.go('/active'); } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva.'; }
  };
  frame(app, {
    tab: 'more', head: backHead('#/mai-mult', 'Curs BNR'),
    body: [
      h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
        h('label', { class: 'f' }, 'Data cursului', date),
        h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'RON / EUR', eur), h('label', { class: 'f' }, 'RON / USD', usd))),
      h('div', { class: 'savebar' }, err, h('button', { class: 'btn big', disabled: !app.canEdit(), onclick: save }, 'Salvează cursul')),
      recent.length ? h('section', { class: 'panel' }, h('span', { class: 'up' }, 'Ultimele cursuri'),
        ...recent.map((r) => h('div', { class: 'between sm' }, h('span', {}, shortDate(r.date) + ' · ' + (r.source || '')),
          h('span', { class: 'mono' }, (r.EUR ? '€ ' + formatRate(r.EUR) : '') + (r.USD ? '  $ ' + formatRate(r.USD) : ''))))) : null,
    ],
  });
}
