import { h, mount } from '../dom.js';
import { formatMinor } from '../money.js';
import { backHead, frame, loading } from '../ui.js';
import { CURRENCIES, OTHER, DEFAULT_REASONS, liveGifts, totalsByCurrency, byYear, suggestions, giftFromForm, formatGiftDate, giftsFromCsv } from '../gifts.js';

// "Primite": a plain log of money Iza received (when, from whom, how much, why). Lives in her file, separate from
// every other statistic. Dropdowns offer what the file already contains, plus "Altele…" for something new.
const SPACE = 'iza';
const UNIT = { RON: 'lei', EUR: '€', USD: '$' };
const money = (minor, cur) => `${formatMinor(minor).replace(/,00$/, '')} ${UNIT[cur] || cur}`;
let form = null, onlyGiver = '', importing = null;
const fresh = (app) => ({ date: app.today(), giver: '', giverOther: '', amount: '', currency: 'RON', reason: '', reasonOther: '', note: '' });

export async function primiteView(app) {
  loading();
  if (!form) form = fresh(app);
  let m;
  try { m = await app.model(SPACE); } catch (e) {
    mount(h('div', { class: 'card stack' }, h('p', { class: 'err' }, 'Nu am putut citi datele.'), h('button', { onclick: () => app.rerender() }, 'Reîncearcă')));
    return;
  }
  const all = liveGifts(m);
  const canEdit = app.canEdit(SPACE);
  const givers = suggestions(all, 'giver');
  const reasons = suggestions(all, 'reason', DEFAULT_REASONS);
  if (!form.giver) form.giver = givers[0] || OTHER;
  const shown = onlyGiver ? all.filter((g) => g.giver === onlyGiver) : all;

  const err = h('p', { class: 'err sm', style: 'margin:0' });
  const set = (patch) => { Object.assign(form, patch); app.rerender(); };
  const sel = (label, value, options, key, extraKey, otherPlaceholder, withEmpty) => h('div', { class: 'f' }, h('label', { class: 'f', style: 'gap:4px' }, label,
    h('select', { class: 'input', onchange: (e) => set({ [key]: e.target.value }) },
      withEmpty ? h('option', { value: '', selected: value === '' }, '(fără motiv)') : null,
      ...options.map((o) => h('option', { value: o, selected: o === value }, o)),
      h('option', { value: OTHER, selected: value === OTHER }, OTHER))),
    value === OTHER ? h('input', { class: 'input', style: 'margin-top:6px', value: form[extraKey], placeholder: otherPlaceholder, 'aria-label': label + ' (nou)', oninput: (e) => { form[extraKey] = e.target.value; err.textContent = ''; } }) : null);

  const save = async (e) => {
    const r = giftFromForm(form);
    if (r.error) { err.textContent = r.error; return; }
    e.target.disabled = true;
    try {
      await app.add(SPACE, 'gifts', r.fields, `primit ${r.fields.currency}`);
      form = { ...fresh(app), date: form.date, currency: form.currency };
      app.rerender();
    } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
  };

  const voidGift = async (g) => {
    if (!window.confirm(`Anulezi darul de la ${g.giver} (${formatGiftDate(g.date)})? Rândul rămâne în foaie, marcat anulat.`)) return;
    try { await app.void(SPACE, 'gifts', g, 'anulat din aplicație'); app.rerender(); } catch (x) { err.textContent = 'Nu am putut anula. Încearcă din nou.'; }
  };

  const row = (g) => h('div', { class: 'r' },
    h('span', { class: 'nm' }, h('b', {}, g.giver),
      h('span', { class: 'xs muted' }, [formatGiftDate(g.date), g.reason, g.note].filter(Boolean).join(' · '))),
    h('span', { class: 'n' }, h('b', { class: 'pos' }, '+' + money(g.amount_minor, g.currency)),
      canEdit ? h('button', { type: 'button', class: 'linkbtn xs muted', style: 'display:block;margin-left:auto;background:none;border:0;padding:2px 0', onclick: () => voidGift(g) }, 'anulează') : null));

  const totals = totalsByCurrency(shown);

  // Local import of the private CSV (chosen from disk, read in the browser only, written only after the user confirms).
  const importBox = () => {
    const pick = h('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': 'Alege fișierul CSV' });
    pick.addEventListener('change', async () => {
      const f = pick.files && pick.files[0];
      if (!f) return;
      importing = giftsFromCsv(await f.text());
      app.rerender();
    });
    return h('section', { class: 'panel' },
      h('span', { class: 'up' }, 'Import din fișier'),
      h('span', { class: 'xs muted' }, 'Alege un CSV cu coloanele data, de_la, suma, moneda, motiv, descriere_foaie. Fișierul se citește doar în acest browser.'),
      pick,
      importing ? h('div', { class: 'stack', style: 'gap:6px' },
        h('span', { class: 'sm' }, `${importing.fields.length} rânduri valide, ${importing.errors.length} cu probleme.`),
        ...importing.errors.slice(0, 5).map((t) => h('span', { class: 'err xs' }, t)),
        importing.fields.length ? h('button', { class: 'btn', onclick: async (e) => {
          e.target.disabled = true;
          try { await app.addMany(SPACE, 'gifts', importing.fields, `import ${importing.fields.length} primite`); importing = null; app.rerender(); } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut importa. Încearcă din nou.'; }
        } }, `Adaugă ${importing.fields.length} rânduri în foaie`) : null) : null);
  };

  frame(app, {
    tab: 'more',
    head: backHead('#/mai-mult', 'Primite'),
    body: [
      h('section', { class: 'panel' },
        h('span', { class: 'up xs' }, onlyGiver ? `Total de la ${onlyGiver}` : 'Total primit'),
        totals.length ? h('div', { class: 'between' }, ...totals.map((t) => h('b', { style: 'font-size:20px' }, money(t.minor, t.currency)))) : h('span', { class: 'muted sm' }, 'Nimic înregistrat încă.'),
        h('span', { class: 'xs muted' }, 'Sumele sunt pe valute, fără conversie. Nu intră în niciun alt total din aplicație.'),
        h('span', { class: 'xs muted' }, 'Istoricul de până la 14 ani are doar banii primiți în conturi, nu și cei primiți în mână. Cei primiți fizic, chiar dacă nu au ajuns în cont, se pot adăuga de acum.')),
      canEdit ? h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
        h('div', { class: 'grid2' },
          h('label', { class: 'f' }, 'Data', h('input', { class: 'input', type: 'date', value: form.date, onchange: (e) => { form.date = e.target.value; } })),
          h('label', { class: 'f' }, 'Sumă', h('input', { class: 'input amt', value: form.amount, inputmode: 'decimal', placeholder: '0', oninput: (e) => { form.amount = e.target.value; err.textContent = ''; } }))),
        h('div', { class: 'seg tall', role: 'radiogroup', 'aria-label': 'Valută', style: `margin:0;grid-template-columns:repeat(${CURRENCIES.length},minmax(0,1fr))` },
          ...CURRENCIES.map((c) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(form.currency === c), class: form.currency === c ? 'on' : '', onclick: () => set({ currency: c }) }, c))),
        sel('De la cine', form.giver, givers, 'giver', 'giverOther', 'Nume nou'),
        sel('Motiv', form.reason, reasons, 'reason', 'reasonOther', 'Motiv nou', true),
        h('label', { class: 'f' }, 'Descriere (opțional)', h('input', { class: 'input', value: form.note, placeholder: 'ex. pentru vacanță', oninput: (e) => { form.note = e.target.value; } })),
        h('div', { class: 'savebar' }, err, h('button', { class: 'btn big', onclick: save }, 'Adaugă')))
        : h('p', { class: 'muted sm', style: 'margin:12px 16px' }, 'Ai acces doar de citire.'),
      all.length ? h('section', { class: 'panel', style: 'gap:6px' },
        h('label', { class: 'f' }, 'Arată doar de la',
          h('select', { class: 'input', 'aria-label': 'Filtru persoană', onchange: (e) => { onlyGiver = e.target.value; app.rerender(); } },
            h('option', { value: '', selected: !onlyGiver }, 'toți'),
            ...givers.map((gv) => h('option', { value: gv, selected: gv === onlyGiver }, gv))))) : null,
      ...byYear(shown).map((y) => h('section', { class: 'panel flush' },
        h('div', { class: 'ghead' }, h('span', {}, y.year || 'Fără an'), h('span', {}, y.totals.map((t) => money(t.minor, t.currency)).join(' · '))),
        h('div', { class: 'tbl v2' }, ...y.list.map(row)))),
      canEdit ? importBox() : null,
    ],
  });
}
