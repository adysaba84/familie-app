import { h, mount } from '../dom.js';
import { izaBoxes, projectIza, lastUpdate } from '../iza-plan.js';
import { formatWhole, formatMinor, parseAmount } from '../money.js';
import { accountBalance } from '../calc.js';
import { fullDate } from '../ui.js';
import { daysBetween } from '../calc.js';
import { giftsSection } from './kid-daruri.js';
import { pop, countUp, growOnView, plant, colorBar, boxCard, school, didYouKnow, playground } from './kid-fun.js';

// Iza's screen: playful, read-only, one page. Shown to Iza when she signs in (her file is read-only for
// her, enforced by Google) and to a parent as a preview ("Vezi ca Iza", for as long as her own account
// cannot sign in). All numbers come from her file; the plan parameters from its `settings` tab.
const eur = (minor) => `${formatWhole(minor)} €`;
const approx = (minor) => `~${formatWhole(Math.round(minor / 10000) * 10000)} €`; // round to hundreds of euro

// "Descarcă PDF" = the browser's print dialog (choose "Salvează ca PDF"); print.css-style rules hide the controls.
function exportPdf() {
  const old = document.title;
  document.title = 'Banii tăi pentru viitor';
  window.addEventListener('afterprint', () => { document.title = old; }, { once: true });
  window.print();
}

// "Portofelul tău": the two wallets (lei, euro). Iza can type the amounts herself, but only when Google lets her
// write her file's `wallet_balances` tab (she is an editor with every other tab protected); a parent previewing
// sees the numbers read-only.
function walletSection(app, model, canWrite) {
  const today = app.today();
  const isCard = (a) => a.kind === 'current' && a.institution === 'Card';
  const rank = (a) => (isCard(a) ? 2 : a.currency_default === 'RON' ? 0 : 1);
  const wallets = model.accounts.filter((a) => !a.void && (a.kind === 'wallet' || isCard(a)) && a.status !== 'closed').sort((a, b) => rank(a) - rank(b));
  if (!wallets.length) return null;
  const label = (a) => (isCard(a) ? 'Card' : a.currency_default === 'RON' ? 'Lei' : a.currency_default === 'EUR' ? 'Euro' : a.currency_default);
  const unit = (a) => (a.currency_default === 'RON' ? 'lei' : a.currency_default === 'EUR' ? '€' : a.currency_default);
  const rows = wallets.map((a) => ({ a, b: accountBalance(model, a.id, today) }));
  const err = h('p', { class: 'err small', style: 'margin:6px 0 0' });
  const inputs = new Map();
  const save = async (e) => {
    const todo = [];
    for (const { a } of rows) {
      const t = inputs.get(a.id).value.trim();
      if (!t) continue;
      const v = parseAmount(t);
      if (v == null || v < 0) { err.textContent = `Suma de la „${label(a)}” nu e bună.`; return; }
      todo.push({ a, v });
    }
    if (!todo.length) { err.textContent = 'Scrie cel puțin o sumă.'; return; }
    e.target.disabled = true;
    try {
      for (const { a, v } of todo) await app.add('iza', 'wallet_balances', { account_id: a.id, date: today, balance_minor: v, rate_bp: '' }, label(a));
      app.rerender();
    } catch (x) { e.target.disabled = false; err.textContent = 'Nu am putut salva. Încearcă din nou.'; }
  };
  return h('section', { class: 'box' },
    h('div', { class: 'between' }, h('b', {}, 'Portofel și card'), h('span', { class: 'xs muted' }, rows.some((r) => r.b.date) ? 'ultima oară ' + fullDate(rows.map((r) => r.b.date).filter(Boolean).sort().pop()) : '')),
    h('p', {}, canWrite ? 'Scrie câți bani ai acum în portofel și pe card.' : 'Banii pe care îi ai la tine și pe card.'),
    ...rows.map(({ a, b }) => {
      if (!canWrite) return h('div', { class: 'between', style: 'margin-top:6px' }, h('span', {}, label(a)), h('b', { class: 'amt' }, b.balance == null ? '–' : `${formatWhole(b.balance)} ${unit(a)}`));
      const input = h('input', { class: 'input', inputmode: 'decimal', 'aria-label': isCard(a) ? 'Card' : `Portofel ${label(a)}`, placeholder: b.balance == null ? '0' : formatMinor(b.balance) });
      input.addEventListener('input', () => { err.textContent = ''; });
      inputs.set(a.id, input);
      return h('label', { class: 'f', style: 'margin-top:8px' }, `${label(a)} (${unit(a)})`, input);
    }),
    canWrite ? [err, h('button', { style: 'margin-top:10px;width:100%', onclick: save }, 'Actualizează')] : null);
}

export async function kidView(app, { asParent = false } = {}) {
  const root = document.getElementById('app');
  mount(h('p', { class: 'muted', style: 'margin:24px 16px' }, 'Se încarcă…'));
  let model;
  try { model = await app.model('iza'); } catch (e) {
    mount(h('div', { class: 'card stack' }, h('p', { class: 'err' }, 'Nu am putut citi datele.'), h('button', { onclick: () => app.rerender() }, 'Reîncearcă')));
    return;
  }
  let boxes, plan;
  try {
    boxes = izaBoxes(model, app.today());
    plan = projectIza(model, app.today());
  } catch (e) {
    mount(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Lipsește cursul de schimb, nu pot calcula încă.')));
    return;
  }
  const upd = lastUpdate(model);
  const age = plan ? plan.ageNow : null;
  const max = plan ? Math.max(...plan.ladder.map((x) => x.eur)) : 1;

  const nowEl = h('span', { class: 'v' }, eur(0));
  const futEl = h('span', { class: 'v' }, '~0 €');
  const nextB = plan && plan.ladder.length > 1 ? plan.ladder[1] : null;
  const days = nextB ? Math.max(0, daysBetween(app.today(), nextB.date)) : null;
  const shown = boxes.boxes.filter((b) => b.eur > 0);
  root.classList.add('kid');
  requestAnimationFrame(() => {
    countUp(nowEl, boxes.totalEur, eur);
    if (plan && plan.atAdult) countUp(futEl, plan.atAdult.eur, approx);
  });
  mount(
    asParent ? h('div', { class: 'kidbar' }, h('a', { href: '#/active', class: 'back' }, '‹ Înapoi'), h('span', {}, 'Așa vede Iza'),
      h('button', { class: 'pdfbtn', onclick: exportPdf }, 'Descarcă PDF')) : null,
    h('header', { class: 'kidhead' }, h('h1', {}, 'Banii tăi pentru viitor ✨'),
      h('p', {}, 'Părinții tăi pun bani deoparte pentru tine de mult timp. Uite ce ai acum, unde sunt banii și cât ar putea să devină.')),
    h('section', { class: 'hero', role: 'button', tabindex: '0', 'aria-label': 'Atinge pentru confetti', onclick: pop },
      h('div', { class: 'hero-col' }, h('span', { class: 'k' }, age == null ? 'Acum' : `Acum · ${age} ani`), nowEl),
      plan && plan.atAdult ? [h('span', { class: 'arrow', 'aria-hidden': 'true' }, '🚀'),
        h('div', { class: 'hero-col' }, h('span', { class: 'k' }, `La ${plan.params.adultAge} ani · estimare`), futEl)] : null),
    nextB ? h('div', { class: 'bday' }, h('span', { 'aria-hidden': 'true' }, days === 0 ? '🎂' : '🎈'),
      h('span', {}, days === 0 ? 'La mulți ani! Azi e ziua ta!' : `Mai sunt ${days} ${days === 1 ? 'zi' : 'zile'} până la ziua ta`)) : null,
    walletSection(app, model, !asParent && app.canEdit('iza')),
    h('h2', { class: 'kidh2' }, 'Unde sunt banii tăi'),
    h('p', { class: 'kidlead' }, 'Banii nu stau toți într-un singur loc. Sunt împărțiți în „cutii”, fiecare cu rolul ei.'),
    shown.length ? colorBar(shown) : null,
    ...shown.map((b) => boxCard(b, boxes.totalEur || 1, eur)),
    plan && plan.ladder.length > 1 ? playground(plan) : null,
    plan && plan.ladder.length > 1 ? h('section', { class: 'ladder' },
      h('h2', { class: 'kidh2' }, 'Cum cresc până la ' + plan.params.adultAge + ' ani'),
      h('p', { class: 'kidlead' }, 'În fiecare lună se mai adaugă bani, iar banii existenți aduc dobândă. Asta e o estimare pentru fiecare zi de naștere.'),
      ...plan.ladder.map((x, i, all) => {
        const fill = h('div', {});
        growOnView(fill, Math.max(6, Math.round((x.eur * 100) / max)) + '%');
        return h('div', { class: 'rung' },
          h('span', { class: 'age' }, `${plant(i, all.length)} ${i === 0 ? 'Acum' : x.age}`),
          h('div', { class: 'rbar' }, fill),
          h('span', { class: 'amt' }, i === 0 ? eur(x.eur) : approx(x.eur)));
      }),
      h('p', { class: 'small' }, 'Poate ieși puțin mai mult sau puțin mai puțin: depinde de cum merge bursa și de cursul leului.')) : null,
    giftsSection(model),
    school(plan ? plan.params.etfRateBp : 700),
    didYouKnow(),
    h('p', { class: 'small', style: 'margin:16px' }, upd ? `Situația din ${fullDate(upd)}. Cifrele pentru viitor sunt estimări, nu promisiuni.` : 'Cifrele pentru viitor sunt estimări, nu promisiuni.'),
    !asParent ? h('div', { class: 'card' }, h('button', { class: 'secondary', onclick: () => app.logout() }, 'Ieșire')) : null,
  );
}
