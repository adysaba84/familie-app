import { h } from '../dom.js';
import { addMonths, closeInterestEstimate, destinationAccounts, planClose, planRollover, accountBalance, daysBetween } from '../calc.js';
import { parseAmount, parsePercent, formatMinor } from '../money.js';
import { closeHead, frame, guarded, loading, fmtNative, fullDate } from '../ui.js';

const TERMS = [1, 3, 6, 12, 24, 36];
let st = null; // { id, space, mode: 'matured' | 'broken' | 'extend', date, interest, to, amount, rate, term, cap }

// Called from the deposits list. mode: matured = closed at maturity, broken = closed before it, extend = rolled over.
export function startClose(d, space, mode, today) {
  const date = mode === 'extend' ? d.maturity_date : mode === 'matured' ? (today >= d.maturity_date ? today : d.maturity_date) : today;
  const interest = closeInterestEstimate(d, date);
  st = { id: d.id, space, mode, date, interest: formatMinor(interest), to: '', amount: formatMinor(d.principal_minor + interest),
    rate: formatMinor(d.rate_bp), term: d.term_months, cap: !!d.capitalization };
}

const TITLE = { matured: 'Închide la scadență', broken: 'Închide înainte de scadență', extend: 'Prelungește depozitul' };

export async function depozitInchideView(app) {
  loading();
  if (!st) { app.go('/depozite'); return; }
  return guarded({ ...app, space: st.space, model: () => app.model(st.space) }, async (m) => {
    const d = m.deposits.find((x) => x.id === st.id && !x.void && x.status === 'active');
    if (!d) { st = null; app.go('/depozite'); return; }
    const canEdit = app.canEdit(st.space);
    const sym = d.currency === 'RON' ? 'lei' : d.currency;
    const dests = destinationAccounts(m, d);
    const bank = m.accounts.find((a) => a.id === d.account_id);
    const set = (patch) => { Object.assign(st, patch); app.rerender(); };
    const opt = (on, text, onclick) => h('button', { type: 'button', class: `opt ${on ? 'on' : ''} chip-term`, 'aria-pressed': String(on), onclick }, text);

    const dateIn = h('input', { class: 'input', type: 'date', value: st.date, 'aria-label': 'Data închiderii', disabled: st.mode === 'extend' });
    const interestIn = h('input', { class: 'input amt', style: 'min-height:50px;font-family:var(--mono);font-size:16px', value: st.interest, inputmode: 'decimal', 'aria-label': 'Dobândă netă primită' });
    const amountIn = h('input', { class: 'input amt', style: 'min-height:50px;font-family:var(--mono);font-size:16px', value: st.amount, inputmode: 'decimal', 'aria-label': 'Suma noului depozit' });
    const rateIn = h('input', { class: 'input', style: 'min-height:50px;font-family:var(--mono);font-size:16px', value: st.rate, inputmode: 'decimal', 'aria-label': 'Dobândă nouă %' });
    const toSel = h('select', { class: 'input', style: 'min-height:50px;font-weight:600', 'aria-label': 'Cont de destinație' },
      h('option', { value: '' }, 'Alege contul…'),
      ...dests.map((a) => h('option', { value: a.id, selected: a.id === st.to }, a.name)));
    const preview = h('section', { class: 'panel', style: 'border-radius:10px;font-size:13px;gap:6px' });
    const err = h('p', { class: 'err sm', style: 'margin:0' });

    const compute = () => {
      st.date = dateIn.value || st.date; st.interest = interestIn.value; st.amount = amountIn.value; st.rate = rateIn.value; st.to = toSel.value;
      const interestMinor = st.interest.trim() === '' ? 0 : parseAmount(st.interest);
      if (interestMinor == null) throw new Error('Dobândă invalidă.');
      if (st.mode === 'extend') {
        const principal = parseAmount(st.amount), rateBp = parsePercent(st.rate);
        if (principal == null || principal <= 0) throw new Error('Introdu suma noului depozit.');
        if (rateBp == null) throw new Error('Introdu dobânda nouă, ex. 5,40.');
        return planRollover(m, d, { interestMinor, toAccountId: st.to, next: { principal_minor: principal, rate_bp: rateBp, term_months: st.term, capitalization: st.cap } });
      }
      return planClose(m, d, { status: st.mode, date: st.date, interestMinor, toAccountId: st.to });
    };

    const update = () => {
      err.textContent = '';
      preview.replaceChildren();
      let plan;
      try { plan = compute(); } catch (x) { preview.append(h('span', { class: 'xs neg' }, x.message)); return; }
      const row = (a, b, cls = '') => h('div', { class: 'between ' + cls }, h('span', {}, a), h('span', { class: 'mono' }, b));
      const money = (n) => `${formatMinor(n)} ${sym}`;
      const kids = [row('Principal', money(d.principal_minor)), row('+ dobândă netă', money(plan.closed.interest_received_minor))];
      if (plan.fresh) kids.push(row('− rămâne în depozitul nou', money(plan.fresh.principal_minor)));
      kids.push(row(plan.toMinor < 0 ? 'Se scade din cont' : 'Intră în cont', money(Math.abs(plan.toMinor)), 'pos'));
      if (plan.balance) {
        const acc = dests.find((a) => a.id === st.to), prev = accountBalance(m, st.to, st.date).balance || 0;
        kids.push(h('div', { class: 'between', style: 'border-top:1px solid var(--line);padding-top:6px' }, h('span', {}, acc ? acc.name : ''),
          h('span', { class: 'mono' }, `${formatMinor(prev)} → ${formatMinor(plan.balance.balance_minor)}`)));
        if (plan.balance.balance_minor < 0) kids.push(h('span', { class: 'xs neg' }, 'Soldul contului ar ieși negativ.'));
      }
      if (plan.laterBalances.length) {
        const last = plan.laterBalances.reduce((a, b) => (a.date > b.date ? a : b));
        kids.push(h('span', { class: 'xs neg' }, `Contul are ${plan.laterBalances.length === 1 ? 'un sold' : plan.laterBalances.length + ' solduri'} după ${fullDate(st.date)} (ultimul: ${fullDate(last.date)}). Acelea nu includ banii de aici; actualizează-le după salvare.`));
      }
      if (plan.voidBalances.length) kids.push(h('span', { class: 'xs muted' }, 'Soldul deja introdus în contul acesta la aceeași dată este înlocuit.'));
      if (plan.fresh) kids.push(h('span', { class: 'xs muted' }, `Depozit nou: ${fullDate(plan.fresh.start_date)} → ${fullDate(plan.fresh.maturity_date)}`));
      preview.append(...kids);
    };
    for (const el of [dateIn, rateIn]) el.addEventListener('input', update);
    interestIn.addEventListener('input', () => {
      const i = parseAmount(interestIn.value);
      if (!st.amountTouched && i != null && i >= 0) amountIn.value = formatMinor(d.principal_minor + i); // the new deposit follows until the user types its amount
      update();
    });
    amountIn.addEventListener('input', () => { st.amountTouched = true; update(); });
    toSel.addEventListener('change', update);
    // the date drives the suggested interest, but only until the user types their own
    dateIn.addEventListener('change', () => {
      const date = dateIn.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) set({ date, interest: formatMinor(closeInterestEstimate(d, date))});
    });

    const save = async (e) => {
      let plan;
      try { plan = compute(); } catch (x) { err.textContent = x.message; return; }
      e.target.disabled = true;
      try {
        // the new row goes in first and the old one is voided after: a failure in between leaves a visible duplicate, never a loss
        const closed = await app.add(st.space, 'deposits', plan.closed, `${st.mode === 'broken' ? 'închis înainte de scadență' : st.mode === 'extend' ? 'prelungit' : 'închis la scadență'} ${bank ? bank.institution : ''} ${d.currency}`);
        await app.void(st.space, 'deposits', d, 'închis');
        if (plan.fresh) await app.add(st.space, 'deposits', { ...plan.fresh, renewed_from_id: closed.id }, `depozit nou din prelungire ${bank ? bank.institution : ''} ${d.currency}`);
        if (plan.balance) {
          for (const old of plan.voidBalances) await app.void(st.space, 'balances', old, 'corectat');
          await app.add(st.space, 'balances', plan.balance, `din depozit închis ${st.date}`);
        }
        st = null;
        app.go('/depozite');
      } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva complet. Verifică în foaie înainte să repeți.'; }
    };

    const lbl = (t, el) => h('label', { class: 'f' }, t, el);
    const days = daysBetween(app.today(), d.maturity_date);
    frame(app, {
      tab: 'active', head: closeHead('#/depozite', TITLE[st.mode]),
      body: [
        h('form', { class: 'form', onsubmit: (ev) => ev.preventDefault() },
          h('section', { class: 'panel', style: 'border-radius:10px;font-size:13px' },
            h('div', { class: 'between' }, h('b', {}, `${bank ? bank.institution + ' · ' + bank.owner : 'Depozit'}`), h('b', { class: 'mono' }, fmtNative(d.principal_minor, d.currency, { unit: true }))),
            h('span', { class: 'xs muted' }, `${fullDate(d.start_date)} → ${fullDate(d.maturity_date)} · ${formatMinor(d.rate_bp)}%${days < 0 ? ` · scadent de ${-days} zile` : ''}`)),
          st.mode === 'extend' ? null : lbl(st.mode === 'broken' ? 'Data închiderii (înainte de scadență)' : 'Data închiderii', dateIn),
          lbl(`Dobândă netă primită (${sym})`, interestIn),
          st.mode === 'extend' ? h('div', { style: 'display:flex;flex-direction:column;gap:10px' },
            h('div', { style: 'display:grid;grid-template-columns:1fr 100px;gap:8px' },
              lbl(`Suma noului depozit (${sym})`, amountIn), lbl('Dobândă %', rateIn)),
            h('fieldset', {}, h('legend', {}, 'Perioadă nouă'),
              h('div', { class: 'opts', style: 'grid-template-columns:repeat(6,minmax(0,1fr));gap:6px' },
                ...TERMS.map((t) => opt(st.term === t, t === 1 ? '1 lună' : `${t} luni`, () => set({ term: t }))))),
            h('label', { style: 'display:flex;align-items:center;justify-content:space-between;min-height:44px;font-size:14px' }, 'Cu capitalizare',
              h('input', { type: 'checkbox', checked: st.cap, style: 'width:22px;height:22px;accent-color:var(--accent)', onchange: (ev) => { st.cap = ev.target.checked; update(); } })),
            h('span', { class: 'xs muted' }, `Noul depozit pornește pe ${fullDate(d.maturity_date)} și scade pe ${fullDate(addMonths(d.maturity_date, st.term))}. Dacă suma diferă de principal + dobândă, diferența merge în contul ales mai jos.`)) : null,
          lbl(st.mode === 'extend' ? 'Cont pentru diferență (dacă există)' : 'Cont în care au intrat banii', toSel),
          dests.length ? null : h('span', { class: 'xs neg' }, `Nu există un cont curent / economii / portofel în ${d.currency} pentru acest titular.`)),
        preview,
        h('div', { class: 'savebar' }, err,
          canEdit ? h('button', { class: 'btn big', onclick: save }, TITLE[st.mode]) : h('p', { class: 'muted' }, 'Ai acces doar de citire la acest spațiu.')),
      ].filter(Boolean),
    });
    update();
  });
}

// leaving the form without saving must not leak into the next one
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/depozite/inchide')) st = null; });
