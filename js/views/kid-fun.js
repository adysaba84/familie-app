import { h } from '../dom.js';
import { formatWhole } from '../money.js';
import { daysBetween } from '../calc.js';

// Iza's playful layer: motion, colors and the "financial school" texts. No data access, no network.
// Motion is switched off for people who asked for less of it (prefers-reduced-motion).
export const calm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// One color per box, used everywhere (stacked bar, legend, card edge, share bar) so a color always means the same box.
export const BOX_STYLE = {
  savings: { emoji: '💰', color: '#2FB67C', risk: 1 },
  foreign: { emoji: '🌍', color: '#38A9F0', risk: 1 },
  bond: { emoji: '🏰', color: '#F5B82E', risk: 1 },
  nn: { emoji: '🐷', color: '#E9578B', risk: 2 },
  bursa: { emoji: '🚀', color: '#FF8A3D', risk: 3 },
};
const RISK = { 1: ['🟢', 'Risc mic', 'Valoarea se schimbă puțin de la o zi la alta.'], 2: ['🟡', 'Risc mediu', 'Poate urca și coborî de la un an la altul, dar pe termen lung de obicei crește.'], 3: ['🔴', 'Risc mai mare', 'Poate scădea tare într-un an prost, dar pe mulți ani a crescut cel mai mult.'] };
const CONFETTI = ['#5B3FD1', '#F5B82E', '#2FB67C', '#E9578B', '#38A9F0', '#FF8A3D'];

// What each box is, how it makes money, what to watch. Plain words for a child.
const EDU = {
  savings: {
    what: 'Un cont la bancă. Banii sunt acolo, îi poți vedea oricând și nu se pierd.',
    how: 'Banca folosește banii tăi și în schimb îți plătește o dobândă mică.',
    watch: 'E locul sigur, dar dobânda e mică. Dacă banii stau doar aici mulți ani, prețurile cresc (inflația) și cu aceiași bani cumperi tot mai puțin.',
  },
  foreign: {
    what: 'Bani în euro și dolari, puși la bancă pe o perioadă stabilită (un depozit).',
    how: 'Banca îți plătește dobândă. În plus, dacă euro devine mai scump față de leu, banii tăi valorează mai mulți lei.',
    watch: 'Până nu trece perioada, banii sunt „încuiați”. Cursul se schimbă: uneori câștigi din curs, alteori pierzi puțin.',
  },
  bond: {
    what: 'Statul are nevoie de bani și îi împrumută de la oameni. Tu i-ai împrumutat, iar el ți-a dat o hârtie (titlu de stat) ca dovadă.',
    how: 'Statul îți plătește dobândă în fiecare an și la sfârșit îți dă înapoi tot ce ai împrumutat.',
    watch: 'E destul de sigur, dar câștigul e fix: nu devine mai mare dacă piața merge foarte bine.',
  },
  nn: {
    what: 'O asigurare cu economisire de la NN, care se deschide când ai 18 ani. E ca o pușculiță mare, cu lacăt.',
    how: 'Părinții tăi pun bani în fiecare lună, iar firma îi investește în fonduri. Cu cât stă mai mult, cu atât crește mai mult.',
    watch: 'Banii sunt făcuți să stea mult timp. Dacă îi scoți mai devreme, de obicei pierzi din ei. Răbdarea e partea care câștigă.',
  },
  bursa: {
    what: 'Bursa e un fel de piață unde se cumpără bucăți mici din companii (acțiuni). Un fond ETF e un coș cu bucățele din sute de companii deodată.',
    how: 'Dacă firmele câștigă bani și cresc, valoarea bucățelelor tale crește. Se adaugă câte puțin în fiecare lună, deci cumperi și când e scump, și când e ieftin.',
    watch: 'Un an poate fi slab, chiar cu scădere mare. De aceea se ține mulți ani și nu se vinde de frică. Coșul cu multe companii te apără dacă una merge prost.',
  },
};

const LESSONS = (rateBp) => [
  { icon: '🌱', title: 'Dobânda compusă', body: (() => {
    const r = rateBp / 10000, f = (y) => formatWhole(Math.round(1000 * Math.pow(1 + r, y)) * 100);
    return [h('p', {}, 'Dobânda își face și ea dobândă. Câștigul de anul trecut începe să câștige și el, ca o bulgăre de zăpadă care se rostogolește.'),
      h('p', {}, `Exemplu: 1.000 € cu ${(rateBp / 100).toString().replace('.', ',')}% pe an devin ~${f(10)} € în 10 ani și ~${f(20)} € în 20 de ani, fără să mai pui nimic. Al doilea deceniu aduce mai mult decât primul.`)];
  })() },
  { icon: '🎈', title: 'Inflația', body: [h('p', {}, 'Prețurile cresc încet în fiecare an. O înghețată care azi costă 10 lei poate costa peste ani 12. Banii ținuți în buzunar nu cresc, deci cumperi tot mai puțin cu ei.'),
    h('p', {}, 'De aceea banii pe termen lung se pun în locuri care cresc cel puțin cât prețurile.')] },
  { icon: '🧺', title: 'Nu pune toate ouăle într-un coș', body: [h('p', {}, 'Banii tăi sunt împărțiți în cutii diferite: bancă, stat, bursă, asigurare. Dacă o cutie are un an prost, celelalte te țin pe linia de plutire. Asta se numește diversificare (culorile din bara de sus).')] },
  { icon: '⚖️', title: 'Risc și răsplată', body: [h('p', {}, 'Locurile foarte sigure plătesc puțin, iar cele care pot scădea pe drum plătesc mai mult pe termen lung. Nu există câștig mare fără puțin risc, și nici „bani ușori” fără pericol.'),
    h('p', {}, 'Semafoarele 🟢🟡🔴 de pe cutii îți arată cât de mult se poate mișca valoarea.')] },
  { icon: '⏳', title: 'Cel mai bun prieten: timpul', body: [h('p', {}, 'Cine începe devreme are nevoie de mult mai puțini bani ca să ajungă la aceeași sumă. Tu ai început de mică, asta e cea mai mare putere pe care o ai.')] },
  { icon: '🏷️', title: 'Nevoie sau dorință?', body: [h('p', {}, 'Înainte să cheltuiești, întreabă-te: am nevoie de asta sau mi-o doresc doar acum? Dacă e o dorință, așteaptă o zi. Dacă tot o vrei și mâine, poate merită.')] },
];

const FACTS = [
  'Cea mai veche bancă din lume, Monte dei Paschi din Siena, funcționează din anul 1472.',
  'Prima bursă modernă a fost în Amsterdam, acum peste 400 de ani.',
  'Un ETF poate conține sute sau mii de companii într-o singură bucată.',
  'Moneda euro are 8 monede și 7 bancnote diferite.',
  'Aurul e păstrat de oameni ca avere de mii de ani.',
];

export function confetti(x, y) {
  if (calm()) return;
  for (let i = 0; i < 34; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 140;
    c.style.cssText = `left:${x}px;top:${y}px;background:${CONFETTI[i % CONFETTI.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 60}px;--r:${Math.random() * 720 - 360}deg`;
    document.body.append(c);
    setTimeout(() => c.remove(), 1300);
  }
}
export const pop = (e) => confetti(e.clientX, e.clientY);

export function countUp(el, to, fmt) {
  if (calm() || !to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// bars grow when scrolled into view
export function growOnView(el, width) {
  if (calm() || !('IntersectionObserver' in window)) { el.style.width = width; return; }
  el.style.width = '0%';
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { el.style.width = width; io.disconnect(); } }, { threshold: 0.4 });
  io.observe(el);
}

export const plant = (i, n) => (i === 0 ? '🌱' : i >= n - 1 ? '🌳' : i >= n / 2 ? '🪴' : '🌿');

// One stacked bar for the whole amount + a legend that says what each color is.
export function colorBar(boxes, fmt) {
  const total = boxes.reduce((s, b) => s + b.eur, 0) || 1;
  const bar = h('div', { class: 'stackbar', role: 'img', 'aria-label': 'Cum sunt împărțiți banii pe cutii' },
    ...boxes.map((b) => { const seg = h('div', { style: `background:${BOX_STYLE[b.key].color}` }); growOnView(seg, Math.max(3, (b.eur * 100) / total) + '%'); return seg; }));
  const legend = h('div', { class: 'legend' }, ...boxes.map((b) => h('span', {}, h('i', { style: `background:${BOX_STYLE[b.key].color}` }),
    `${BOX_STYLE[b.key].emoji} ${b.label} · ${Math.round((b.eur * 100) / total)}%`)));
  return h('section', { class: 'colors' }, h('b', {}, '🎨 Ce înseamnă culorile'),
    h('p', {}, 'Fiecare culoare e o cutie în care sunt banii tăi. Cu cât bucata e mai lungă, cu atât ai mai mulți bani acolo.'), bar, legend);
}

// A cutie card: emoji, amount, share, short text, then a tap-to-open "learn more" with what/how/watch + risk light.
export function boxCard(b, totalEur, fmt) {
  const st = BOX_STYLE[b.key], edu = EDU[b.key], risk = RISK[st.risk];
  const share = h('div', { style: `background:${st.color}` });
  growOnView(share, Math.max(4, Math.round((b.eur * 100) / totalEur)) + '%');
  const card = h('section', { class: 'box', style: `border-left:6px solid ${st.color}` },
    h('div', { class: 'between' }, h('b', {}, `${st.emoji} ${b.label}`), h('span', { class: 'amt' }, fmt(b.eur))),
    h('div', { class: 'share', 'aria-hidden': 'true' }, share),
    h('p', {}, b.text),
    h('div', { class: 'risk' }, h('span', {}, `${risk[0]} ${risk[1]}`), h('span', { class: 'xs muted' }, risk[2])),
    edu ? h('details', { class: 'more', ontoggle: (e) => { if (e.target.open) { const r = e.target.getBoundingClientRect(); confetti(r.left + 24, r.top); } } },
      h('summary', {}, 'Vrei să afli mai mult?'),
      h('p', {}, h('b', {}, '📖 Ce este? '), edu.what), h('p', {}, h('b', {}, '⚙️ Cum câștigă? '), edu.how), h('p', {}, h('b', {}, '👀 La ce să te uiți: '), edu.watch)) : null);
  return card;
}

export function school(rateBp) {
  return h('section', { class: 'school' },
    h('h2', { class: 'kidh2' }, '🎓 Școala banilor'),
    h('p', { class: 'kidlead' }, 'Șase lucruri pe care mulți adulți le află târziu. Atinge ca să se deschidă.'),
    ...LESSONS(rateBp).map((l) => h('details', { class: 'lesson' }, h('summary', {}, `${l.icon} ${l.title}`), l.body)));
}

export function didYouKnow() {
  let i = Math.floor(Math.random() * FACTS.length);
  const t = h('p', {}, FACTS[i]);
  const btn = h('button', { class: 'secondary', style: 'width:100%', onclick: (e) => { i = (i + 1) % FACTS.length; t.textContent = FACTS[i]; pop(e); } }, 'Alt fapt 🎲');
  return h('section', { class: 'fact' }, h('b', {}, '💡 Știai că?'), t, btn);
}

// "Joacă-te": what would a little extra every month turn into by the adult age? (invested like the bursa box)
export function playground(plan) {
  const last = plan.ladder[plan.ladder.length - 1];
  const months = Math.max(1, Math.round(daysBetween(plan.ladder[0].date, last.date) / 30.4375));
  const net = (1 + plan.params.etfRateBp / 10000) / (1 + plan.params.fxDriftBp / 10000);
  const m = Math.pow(net, 1 / 12);
  const factor = Math.abs(m - 1) < 1e-9 ? months : (Math.pow(m, months) - 1) / (m - 1);
  const out = h('b', { class: 'play-out' }, '0 €');
  const sub = h('span', { class: 'xs muted' }, 'Mută butonul și vezi.');
  const val = h('span', { class: 'play-val' }, '0 € pe lună');
  const range = h('input', { type: 'range', min: 0, max: 100, step: 5, value: 0, 'aria-label': 'Cât pui în plus pe lună, în euro' });
  range.addEventListener('input', () => {
    const x = Number(range.value), got = Math.round(x * factor);
    val.textContent = `${x} € pe lună`;
    out.textContent = x ? `+ ~${formatWhole(got * 100)} €` : '0 €';
    const put = x * months, gain = Math.max(0, got - put);
    sub.textContent = x ? `Tu pui ${formatWhole(put * 100)} €, iar ~${formatWhole(gain * 100)} € îi aduce timpul (dobânda compusă). 🎉` : 'Mută butonul și vezi.';
  });
  range.addEventListener('change', () => { if (Number(range.value) >= 50) { const r = range.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top); } });
  return h('section', { class: 'play' },
    h('h2', { class: 'kidh2', style: 'margin:0 0 4px' }, '🎮 Joacă-te cu banii'),
    h('p', { class: 'kidlead', style: 'margin:0 0 10px' }, `Dacă ai pune în plus bani în fiecare lună până la ${plan.params.adultAge} ani, cât ar mai crește suma? (estimare, ca la bursă)`),
    h('div', { class: 'between' }, val, out), range, sub);
}
