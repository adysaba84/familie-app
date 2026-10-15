import { h, mount } from '../dom.js';
import { CURRENCIES, OTHER, DEFAULT_REASONS, liveGifts, suggestions, giftFromForm } from '../gifts.js';
import { confetti } from './kid-fun.js';

// Iza's own "Am primit un dar" screen: a short form on its own page so her main screen stays light. Same rules as the
// parents' "Primite" form (gifts.js). She cannot write the `audit` tab, so her entries carry created_by instead.
// Labels the app itself uses for money that is not a person: not offered as "from whom".
const NOT_PEOPLE = ['Părinți', 'Randament', 'Aport propriu Iza'];
const UNIT = { RON: 'lei', EUR: 'euro', USD: 'dolari' };
let form = null;
const fresh = (app) => ({ date: app.today(), giver: '', giverOther: '', amount: '', currency: 'RON', reason: '', reasonOther: '', note: '' });

export async function kidPrimitView(app, { asParent = false } = {}) {
  const root = document.getElementById('app');
  root.classList.add('kid');
  mount(h('p', { class: 'muted', style: 'margin:24px 16px' }, 'Se încarcă…'));
  let model;
  try { model = await app.model('iza'); } catch (e) {
    mount(h('div', { class: 'card stack' }, h('p', { class: 'err' }, 'Nu am putut citi datele.'), h('button', { onclick: () => app.rerender() }, 'Reîncearcă')));
    return;
  }
  if (!form) form = fresh(app);
  const all = liveGifts(model);
  const givers = suggestions(all, 'giver').filter((g) => !NOT_PEOPLE.includes(g));
  const reasons = suggestions(all.filter((g) => !NOT_PEOPLE.includes(g.giver)), 'reason', DEFAULT_REASONS);
  if (!form.giver) form.giver = givers[0] || OTHER;

  const err = h('p', { class: 'err', style: 'margin:0' });
  const set = (patch) => { Object.assign(form, patch); app.rerender(); };
  const pick = (label, value, options, key, extraKey, placeholder, withEmpty) => h('div', {},
    h('label', { class: 'f' }, label,
      h('select', { class: 'input', onchange: (e) => set({ [key]: e.target.value }) },
        withEmpty ? h('option', { value: '', selected: value === '' }, '(nu știu)') : null,
        ...options.map((o) => h('option', { value: o, selected: o === value }, o)),
        h('option', { value: OTHER, selected: value === OTHER }, OTHER))),
    value === OTHER ? h('input', { class: 'input', style: 'margin-top:6px', value: form[extraKey], placeholder, 'aria-label': label + ' (nou)', oninput: (e) => { form[extraKey] = e.target.value; err.textContent = ''; } }) : null);

  const save = async (e) => {
    const r = giftFromForm(form);
    if (r.error) { err.textContent = r.error; return; }
    e.target.disabled = true;
    try {
      await app.add('iza', 'gifts', r.fields, 'primit (Iza)', { audit: asParent });
      confetti(e.clientX || window.innerWidth / 2, e.clientY || 200);
      form = null;
      setTimeout(() => app.go('/iza'), 600);
    } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
  };

  mount(
    h('div', { class: 'kidbar' }, h('a', { href: '#/iza', class: 'back' }, '‹ Înapoi'), h('span', {}, 'Am primit un dar')),
    h('header', { class: 'kidhead' }, h('h1', {}, 'Cine te-a răsfățat? 🎁'), h('p', {}, 'Scrie cine ți-a dat, cât și de ce, ca să rămână în povestea ta.')),
    h('form', { class: 'box', style: 'display:flex;flex-direction:column;gap:12px', onsubmit: (e) => e.preventDefault() },
      pick('De la cine', form.giver, givers, 'giver', 'giverOther', 'Numele'),
      h('div', { style: 'display:grid;grid-template-columns:1fr 120px;gap:10px' },
        h('label', { class: 'f' }, 'Cât', h('input', { class: 'input', value: form.amount, inputmode: 'decimal', placeholder: '0', oninput: (e) => { form.amount = e.target.value; err.textContent = ''; } })),
        h('label', { class: 'f' }, 'În ce',
          h('select', { class: 'input', onchange: (e) => { form.currency = e.target.value; } }, ...CURRENCIES.map((c) => h('option', { value: c, selected: c === form.currency }, UNIT[c]))))),
      h('label', { class: 'f' }, 'Când', h('input', { class: 'input', type: 'date', value: form.date, onchange: (e) => { form.date = e.target.value; } })),
      pick('De ce', form.reason, reasons, 'reason', 'reasonOther', 'Motivul', true),
      h('label', { class: 'f' }, 'Povestește pe scurt (nu e obligatoriu)', h('input', { class: 'input', value: form.note, placeholder: 'ex. pentru vacanță', oninput: (e) => { form.note = e.target.value; } })),
      err,
      h('button', { type: 'button', style: 'width:100%', onclick: save }, 'Adaugă darul')),
    h('p', { class: 'small', style: 'margin:16px' }, 'Părinții tăi pot corecta dacă te-ai încurcat la ceva.'),
  );
}
