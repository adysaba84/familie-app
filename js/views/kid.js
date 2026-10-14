import { h, mount } from '../dom.js';
import { izaBoxes, projectIza, lastUpdate } from '../iza-plan.js';
import { formatWhole } from '../money.js';
import { fullDate } from '../ui.js';

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

  root.classList.add('kid');
  mount(
    asParent ? h('div', { class: 'kidbar' }, h('a', { href: '#/active', class: 'back' }, '‹ Înapoi'), h('span', {}, 'Așa vede Iza'),
      h('button', { class: 'pdfbtn', onclick: exportPdf }, 'Descarcă PDF')) : null,
    h('header', { class: 'kidhead' }, h('h1', {}, 'Banii tăi pentru viitor'),
      h('p', {}, 'Părinții tăi pun bani deoparte pentru tine de mult timp. Uite ce ai acum, unde sunt banii și cât ar putea să devină.')),
    h('section', { class: 'hero' },
      h('div', { class: 'hero-col' }, h('span', { class: 'k' }, age == null ? 'Acum' : `Acum · ${age} ani`), h('span', { class: 'v' }, eur(boxes.totalEur))),
      plan && plan.atAdult ? [h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→'),
        h('div', { class: 'hero-col' }, h('span', { class: 'k' }, `La ${plan.params.adultAge} ani · estimare`), h('span', { class: 'v' }, approx(plan.atAdult.eur)))] : null),
    h('h2', { class: 'kidh2' }, 'Unde sunt banii tăi'),
    h('p', { class: 'kidlead' }, 'Banii nu stau toți într-un singur loc. Sunt împărțiți în „cutii”, fiecare cu rolul ei.'),
    ...boxes.boxes.filter((b) => b.eur > 0).map((b) => h('section', { class: 'box' },
      h('div', { class: 'between' }, h('b', {}, b.label), h('span', { class: 'amt' }, eur(b.eur))), h('p', {}, b.text))),
    plan && plan.ladder.length > 1 ? h('section', { class: 'ladder' },
      h('h2', { class: 'kidh2' }, 'Cum cresc până la ' + plan.params.adultAge + ' ani'),
      h('p', { class: 'kidlead' }, 'În fiecare lună se mai adaugă bani, iar banii existenți aduc dobândă. Asta e o estimare pentru fiecare zi de naștere.'),
      ...plan.ladder.map((x, i) => h('div', { class: 'rung' },
        h('span', { class: 'age' }, i === 0 ? `Acum` : `${x.age} ani`),
        h('div', { class: 'rbar' }, h('div', { style: `width:${Math.max(6, Math.round((x.eur * 100) / max))}%` })),
        h('span', { class: 'amt' }, i === 0 ? eur(x.eur) : approx(x.eur)))),
      h('p', { class: 'small' }, 'Poate ieși puțin mai mult sau puțin mai puțin: depinde de cum merge bursa și de cursul leului.')) : null,
    h('p', { class: 'small', style: 'margin:16px' }, upd ? `Situația din ${fullDate(upd)}. Cifrele pentru viitor sunt estimări, nu promisiuni.` : 'Cifrele pentru viitor sunt estimări, nu promisiuni.'),
    !asParent ? h('div', { class: 'card' }, h('button', { class: 'secondary', onclick: () => app.logout() }, 'Ieșire')) : null,
  );
}
