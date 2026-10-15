import { h } from '../dom.js';
import { periodResult, savedPeriods, defaultStart, periodMonths, INCOME_ROWS, EXTRA_INCOME_KEY, INVESTED_ROWS, INVESTED_OPTIONAL, depositInterestRon } from '../cash.js';
import { parseAmount, formatMinor, formatWhole } from '../money.js';
import { closeHead, frame, guarded, loading, lei, signed, eurOf, fullDate, shortDate } from '../ui.js';
import { setReturn } from '../return.js';
import { startSolduri } from './solduri.js';

// "Venituri și cheltuieli": the monthly page (day 15), for the whole family. 1 update the balances, 2 income and invested,
// 3 the estimated expenses (a remainder, see cash.js). Saved as one cash_periods row + its cash_items rows in the parents' file;
// an edit is void + append like everywhere else.
let form = null;

const fresh = (d1, d0) => ({ editId: null, date: d1, prev: d0, prevTouched: false, amounts: {}, extras: [{ label: '', amount: '' }], altele: '' });

export async function venituriView(app) {
  loading();
  return guarded(app, async () => {
    if (!app.spaces.includes('parents')) { frame(app, { tab: 'active', head: closeHead('#/active', 'Venituri și cheltuieli'), body: [h('p', { class: 'muted', style: 'margin:16px' }, 'Pagina lunară e în fișierul „FIN · Părinți”, la care nu ai acces.')] }); return; }
    app.space = 'parents'; // a family-level page; the buttons below switch to Iza's balances on purpose
    const today = app.today();
    const models = [];
    for (const s of app.spaces) models.push(await app.model(s));
    const parents = await app.model('parents');
    if (!form) form = fresh(today, defaultStart(models, parents, today));
    const canEdit = app.canEdit('parents');
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    // ---- form <-> items ----
    const itemsOf = (strict) => {
      const out = [];
      const add = (kind, key, str, label = '') => {
        const t = String(str || '').trim();
        if (t === '') return;
        const v = parseAmount(t);
        if (v == null) { if (strict) throw new Error(`Sumă invalidă: ${label || key}.`); return; }
        out.push({ kind, key, amount_minor: v, label });
      };
      for (const [k, name] of INCOME_ROWS) add('income', k, form.amounts[k], name);
      form.extras.forEach((e) => add('income', EXTRA_INCOME_KEY, e.amount, e.label || 'Alte surse'));
      for (const [k, name] of [...INVESTED_ROWS, ...INVESTED_OPTIONAL]) add('invested', k, form.amounts[k], name);
      const alt = out.find((i) => i.key === 'altele');
      if (alt) alt.label = form.altele.trim();
      return out;
    };

    const result = h('section', { class: 'panel', style: 'gap:6px;font-size:13px' });
    const periodNote = h('span', { class: 'xs muted' });
    const compute = () => {
      const d0 = form.prev, d1 = form.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d0) || !/^\d{4}-\d{2}-\d{2}$/.test(d1) || d0 >= d1) return { error: 'Data de început trebuie să fie înaintea celei de sfârșit.' };
      try { return { r: periodResult(models, { d0, d1, items: itemsOf(false) }) }; } catch (e) { return { error: /no rate/.test(e.message) ? 'Lipsește cursul BNR pentru această dată.' : 'Nu am putut calcula.' }; }
    };
    const row = (label, value, cls = '', strong = false) => h('div', { class: 'between', style: strong ? 'font-weight:700;border-top:1px solid var(--line);padding-top:6px;margin-top:2px' : '' },
      h('span', { class: cls === 'muted' ? 'muted' : '' }, label), h('span', { class: 'mono ' + (cls === 'muted' ? '' : cls), style: 'white-space:nowrap' }, value));
    const update = () => {
      err.textContent = '';
      result.replaceChildren();
      periodNote.textContent = '';
      const { r, error } = compute();
      if (error) { result.append(h('span', { class: 'xs neg' }, error)); return; }
      periodNote.textContent = `${r.days} zile · ${String(r.months).replace('.', ',')} ${r.months === 1 ? 'lună' : 'luni'}${r.months >= 1.5 ? ' (s-a sărit o lună)' : ''}`;
      periodNote.className = 'xs ' + (r.months >= 1.5 ? 'neg' : 'muted');
      result.append(...[
        h('span', { class: 'up' }, '3 · Cheltuieli estimate'),
        row('Venituri', signed(r.income) + ' lei', 'pos'),
        row('Dobânzi depozite (automat)', signed(r.interest) + ' lei', 'pos'),
        row('Investit', signed(-r.invested) + ' lei', r.invested > 0 ? 'neg' : r.invested < 0 ? 'pos' : 'muted'),
        row(`Variația Disponibilului (la cursul din ${shortDate(r.d1)})`, signed(-r.delta) + ' lei', r.delta ? '' : 'muted'),
        h('span', { class: 'xs muted' }, `Disponibil fără asigurări: ${lei(r.available0)} → ${lei(r.available1)} lei`),
        row('= Cheltuieli estimate', lei(r.expenses) + ' lei', r.expenses < 0 ? 'neg' : '', true),
        h('span', { class: 'xs muted mono', style: 'text-align:right' }, `≈ ${formatWhole(eurOf(models[0], r.expenses, r.d1))} €`),
        r.monthlyAvg != null ? h('span', { class: 'sm', style: 'font-weight:600' }, `≈ ${lei(r.monthlyAvg)} lei / lună (media pe ${String(r.months).replace('.', ',')} luni)`) : null,
        r.expenses < 0 ? h('span', { class: 'xs neg' }, 'Rezultat negativ: ai mai multe venituri decât ce arată soldurile; verifică sumele sau soldurile.') : null,
        ...(r.warnings.length ? [h('span', { class: 'xs neg', style: 'font-weight:600;margin-top:4px' }, 'Atenție: rezultatul poate fi greșit'),
          ...r.warnings.map((w) => h('span', { class: 'xs neg' }, `${w.name}: ${w.issue}`))] : [])].filter(Boolean)); // append() would print null
    };

    // ---- inputs ----
    const amountInput = (key, placeholder = '0') => {
      const el = h('input', { class: 'input', inputmode: 'decimal', value: form.amounts[key] || '', placeholder, 'aria-label': key,
        style: 'min-height:44px;text-align:right;font-family:var(--mono);font-size:15px' });
      el.addEventListener('input', () => { form.amounts[key] = el.value; update(); });
      return el;
    };
    const rowGrid = 'display:grid;grid-template-columns:minmax(0,1fr) 128px;gap:8px;align-items:center';
    const amountRow = (key, name) => h('div', { style: rowGrid }, h('span', { style: 'font-size:14px' }, name), amountInput(key));

    const d1In = h('input', { class: 'input', type: 'date', value: form.date, 'aria-label': 'Până la', style: 'min-height:44px' });
    const d0In = h('input', { class: 'input', type: 'date', value: form.prev, 'aria-label': 'De la', style: 'min-height:44px' });
    d1In.addEventListener('change', () => {
      form.date = d1In.value;
      if (!form.prevTouched && !form.editId) form.prev = defaultStart(models, parents, form.date);
      app.rerender();
    });
    d0In.addEventListener('change', () => { form.prev = d0In.value; form.prevTouched = true; app.rerender(); });

    const lastBalance = (m) => {
      const ds = (m.balances || []).filter((b) => !b.void && b.date <= form.date).map((b) => b.date).sort();
      return ds.length ? ds[ds.length - 1] : null;
    };
    const openBalances = (space) => {
      setReturn(['/conturi/solduri'], null, '/venituri');
      app.space = space;
      startSolduri(null, 'Soldurile pentru ' + (space === 'iza' ? 'Iza' : 'părinți'), form.date);
      app.go('/conturi/solduri');
    };
    const spaceNames = { parents: 'Părinți', iza: 'Iza' };

    // ---- save / edit / history ----
    const save = async (e) => {
      let items;
      try { items = itemsOf(true); } catch (x) { err.textContent = x.message; return; }
      const { r, error } = compute();
      if (error) { err.textContent = error; return; }
      if (!items.length) { err.textContent = 'Introdu cel puțin o sumă (venituri sau investit).'; return; }
      e.target.disabled = true;
      try {
        if (form.editId) {
          for (const it of (parents.cash_items || []).filter((i) => !i.void && i.period_id === form.editId)) await app.void('parents', 'cash_items', it, 'modificat');
          const old = (parents.cash_periods || []).find((p) => p.id === form.editId);
          if (old) await app.void('parents', 'cash_periods', old, 'modificat');
        }
        const p = await app.add('parents', 'cash_periods', { date: form.date, prev_date: form.prev, note: '' }, `venituri și cheltuieli ${form.date}`);
        await app.addMany('parents', 'cash_items', items.map((i) => ({ period_id: p.id, kind: i.kind, key: i.key, amount_minor: i.amount_minor, label: i.label })), `sume ${form.date} (${items.length})`);
        form = null;
        app.rerender();
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Verifică în foaie înainte să repeți.'; }
    };
    const edit = (p) => {
      const amounts = {}, extras = [];
      let altele = '';
      for (const i of p.items) {
        if (i.key === EXTRA_INCOME_KEY) extras.push({ label: i.label || '', amount: formatMinor(i.amount_minor) });
        else { amounts[i.key] = formatMinor(i.amount_minor); if (i.key === 'altele') altele = i.label || ''; }
      }
      form = { editId: p.id, date: p.date, prev: p.prev_date, prevTouched: true, amounts, extras: extras.length ? extras : [{ label: '', amount: '' }], altele };
      app.rerender();
    };
    const history = savedPeriods(parents).map((p) => {
      let text = '–';
      try { text = lei(periodResult(models, { d0: p.prev_date, d1: p.date, items: p.items }).expenses) + ' lei'; } catch (x) { /* no rate for that date */ }
      const months = periodMonths(p.prev_date, p.date);
      return h('div', { class: 'listrow', role: 'button', tabindex: '0', style: 'grid-template-columns:minmax(0,1fr) auto;cursor:pointer', onclick: () => edit(p) },
        h('span', { class: 'nm' }, h('b', {}, fullDate(p.date)), h('span', { class: 'xs muted' }, `de la ${fullDate(p.prev_date)} · ${String(months).replace('.', ',')} ${months === 1 ? 'lună' : 'luni'}`)),
        h('span', { class: 'amt', style: 'text-align:right' }, text, h('small', { class: 'xs muted', style: 'display:block' }, 'cheltuieli estimate')));
    });

    const extraRows = form.extras.map((x, i) => {
      const label = h('input', { class: 'input', value: x.label, placeholder: 'Alte surse: ce a fost', 'aria-label': 'Etichetă', style: 'min-height:44px' });
      label.addEventListener('input', () => { x.label = label.value; });
      const amt = h('input', { class: 'input', inputmode: 'decimal', value: x.amount, placeholder: '0', 'aria-label': 'Sumă', style: 'min-height:44px;text-align:right;font-family:var(--mono);font-size:15px' });
      amt.addEventListener('input', () => { x.amount = amt.value; update(); });
      return h('div', { style: rowGrid }, label, amt);
    });
    const alteleLabel = h('input', { class: 'input', value: form.altele, placeholder: 'Altele: ce a fost', 'aria-label': 'Etichetă altele', style: 'min-height:44px' });
    alteleLabel.addEventListener('input', () => { form.altele = alteleLabel.value; });

    const interestNow = (() => { try { return depositInterestRon(models, form.prev, form.date); } catch (x) { return 0; } })();

    frame(app, {
      tab: 'active', head: closeHead('#/active', 'Venituri și cheltuieli'),
      body: [
        h('section', { class: 'panel', style: 'gap:8px' },
          h('span', { class: 'up' }, 'Perioada'),
          h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'De la', d0In), h('label', { class: 'f' }, 'Până la (data paginii)', d1In)),
          periodNote,
          form.editId ? h('span', { class: 'xs', style: 'color:var(--accent);font-weight:600' }, 'Modifici o pagină salvată; la salvare se înlocuiește.') : null),
        h('section', { class: 'panel', style: 'gap:8px' },
          h('span', { class: 'up' }, '1 · Soldurile'),
          h('span', { class: 'xs muted' }, `Actualizează soldurile la ${fullDate(form.date)}, pentru ambele spații: venitul din luna asta se compară cu ele.`),
          ...app.spaces.map((s, i) => {
            const last = lastBalance(models[i]);
            return h('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center' },
              h('span', { style: 'display:flex;flex-direction:column' }, h('b', { style: 'font-size:14px' }, spaceNames[s] || s), h('span', { class: 'xs ' + (last && last >= form.date ? 'muted' : 'neg') }, last ? `ultimul sold: ${shortDate(last)}` : 'fără solduri')),
              app.canEdit(s) ? h('button', { type: 'button', class: 'secondary', style: 'min-height:44px', onclick: () => openBalances(s) }, 'Actualizează') : h('span', { class: 'xs muted' }, 'doar citire'));
          })),
        h('section', { class: 'panel', style: 'gap:8px' },
          h('span', { class: 'up' }, '2 · Venituri (lei, nete, cât a intrat)'),
          ...INCOME_ROWS.map(([k, name]) => amountRow(k, name)),
          ...extraRows,
          h('button', { type: 'button', class: 'secondary', style: 'min-height:44px', onclick: () => { form.extras.push({ label: '', amount: '' }); app.rerender(); } }, '+ Altă sursă'),
          h('div', { class: 'between sm' }, h('span', { class: 'muted' }, 'Dobânzi depozite (automat, din depozitele închise în perioadă)'), h('b', { class: 'mono' }, lei(interestNow) + ' lei'))),
        h('section', { class: 'panel', style: 'gap:8px' },
          h('span', { class: 'up' }, 'Investit în perioadă (lei, minus = retras / vândut)'),
          ...INVESTED_ROWS.map(([k, name]) => amountRow(k, name)),
          h('span', { class: 'xs muted', style: 'margin-top:4px' }, 'Opțional, ca să nu apară drept cheltuială:'),
          ...INVESTED_OPTIONAL.map(([k, name]) => (k === 'altele' ? h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, alteleLabel, amountRow(k, '')) : amountRow(k, name)))),
        result,
        h('div', { class: 'savebar' }, err, canEdit
          ? h('div', { style: 'display:flex;gap:8px' },
            form.editId ? h('button', { class: 'secondary', style: 'flex:0 0 auto', onclick: () => { form = null; app.rerender(); } }, 'Renunță') : null,
            h('button', { class: 'btn big', style: 'flex:1', onclick: save }, form.editId ? 'Salvează modificarea' : 'Salvează luna'))
          : h('p', { class: 'muted' }, 'Ai acces doar de citire.')),
        history.length ? h('section', { class: 'panel flush' }, h('div', { class: 'ghead' }, h('span', {}, 'Lunile salvate'), h('span', {}, 'atinge ca să modifici')), ...history) : null,
      ].filter(Boolean),
    });
    update();
  });
}

// leaving the page without saving must not leak into the next visit
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/venituri') && !location.hash.startsWith('#/conturi/solduri')) form = null; });
