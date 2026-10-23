import { h } from '../dom.js';
import { SPACE_LABEL } from '../schema.js';
import { backHead, frame, guarded, loading } from '../ui.js';
import { ADMIN_CURRENCIES, KIND_OPTIONS, buildAccount, groupAccounts, ownersOf } from '../accounts-admin.js';

let form = null; // survives re-renders within the screen; reset on save

const fresh = (space) => ({ space, kind: 'broker', institution: '', owner: null, currency: 'RON', name: '', note: '' });

// "Administrare conturi": add accounts of any section/kind, close or reopen existing ones. Editors only.
export async function conturiAdminView(app) {
  loading();
  if (!form || !app.spaces.includes(form.space)) form = fresh(app.space);
  const space = form.space;
  return guarded({ ...app, space, model: (s) => app.model(s || space) }, async (m) => {
    const canEdit = app.canEdit(space);
    const owners = ownersOf(m);
    if (!owners.includes(form.owner)) form.owner = owners[0] || null;
    const kindInfo = KIND_OPTIONS.find((k) => k.kind === form.kind);

    const opt = (on, text, onclick) => h('button', { type: 'button', class: 'opt' + (on ? ' on' : ''), 'aria-pressed': String(on), onclick }, text);
    const set = (patch) => { Object.assign(form, patch); app.rerender(); };
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    const save = async (e) => {
      const r = buildAccount(m, form);
      if (r.error) { err.textContent = r.error; return; }
      e.target.disabled = true;
      try {
        await app.add(space, 'accounts', r.fields, `cont nou ${r.fields.name}`);
        form = fresh(space);
        app.rerender();
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
    };
    const toggle = async (a, e) => {
      e.target.disabled = true;
      try { await app.setAccountStatus(space, a, a.status === 'closed' ? 'active' : 'closed'); app.rerender(); }
      catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut modifica. Încearcă din nou.'; }
    };

    const row = (a) => h('div', { class: 'between sm', style: 'padding:8px 0;gap:8px' },
      h('span', { style: a.status === 'closed' ? 'opacity:.55' : '' }, h('b', {}, a.name), h('span', { class: 'xs muted' }, ` · ${a.currency_default}${a.status === 'closed' ? ' · închis' : ''}`)),
      canEdit ? h('button', { type: 'button', class: 'secondary', style: 'min-height:36px;padding:0 12px;font-size:13px', onclick: (e) => toggle(a, e) }, a.status === 'closed' ? 'Redeschide' : 'Închide') : null);

    frame(app, {
      tab: 'more', head: backHead('#/mai-mult', 'Administrare conturi'),
      body: [
        h('form', { class: 'form', onsubmit: (e) => e.preventDefault() },
          app.spaces.length > 1 ? h('fieldset', {}, h('legend', {}, 'În fișierul'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
              ...app.spaces.map((s) => opt(form.space === s, SPACE_LABEL[s], () => { form = fresh(s); app.rerender(); })))) : null,
          h('fieldset', {}, h('legend', {}, 'Tip cont'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(2,minmax(0,1fr))' },
              ...KIND_OPTIONS.map((k) => opt(form.kind === k.kind, k.label, () => set({ kind: k.kind }))))),
          h('label', { class: 'f' }, 'Instituția', h('input', { class: 'input', value: form.institution, placeholder: kindInfo.hint, oninput: (e) => { form.institution = e.target.value; err.textContent = ''; } })),
          h('fieldset', {}, h('legend', {}, 'Titular'),
            h('div', { class: 'opts', style: `grid-template-columns:repeat(${Math.min(3, Math.max(1, owners.length))},minmax(0,1fr))` },
              ...owners.map((o) => opt(form.owner === o, o, () => set({ owner: o }))))),
          h('fieldset', {}, h('legend', {}, 'Monedă implicită'),
            h('div', { class: 'opts', style: 'grid-template-columns:repeat(3,minmax(0,1fr))' },
              ...ADMIN_CURRENCIES.map((c) => opt(form.currency === c, c, () => set({ currency: c }))))),
          h('label', { class: 'f' }, 'Nume (opțional, altfel se generează)', h('input', { class: 'input', value: form.name, oninput: (e) => { form.name = e.target.value; err.textContent = ''; } })),
          h('label', { class: 'f' }, 'Notă (opțional)', h('input', { class: 'input', value: form.note, oninput: (e) => { form.note = e.target.value; } }))),
        h('div', { class: 'savebar' }, err,
          canEdit ? h('button', { class: 'btn big', onclick: save }, 'Adaugă contul') : h('p', { class: 'muted' }, 'Ai acces doar de citire la acest fișier.')),
        ...groupAccounts(m).map((g) => h('section', { class: 'panel' }, h('span', { class: 'up' }, g.label), ...g.items.map(row))),
      ],
    });
  });
}
