import { h } from '../dom.js';
import { formatWhole } from '../money.js';
import { liveGifts, totalsByCurrency, byGiver, byYear, formatGiftDate } from '../gifts.js';
import { countUp, growOnView, pop } from './kid-fun.js';

// "Darurile mele": the playful face of the Primite log, inside Iza's screen. A journal of who gave what, not a place
// where money sits (the money is already in her boxes above), so it never says "cutie". Read-only.
const COLORS = ['#5B3FD1', '#FF8A3D', '#2FB67C', '#E9578B', '#38A9F0', '#F5B82E', '#8E5BD9', '#1FA3A3', '#D9534F', '#7A8B3A'];
const OTHERS_COLOR = '#B9B2D6';
const UNIT = { RON: 'lei', EUR: '€', USD: '$' };
const amount = (minor, cur) => `${formatWhole(minor)} ${UNIT[cur] || cur}`;

// a small picture for the reason, by keyword; anything else gets a gift
const ICONS = [[/cr[aă]ciun|sorcova|colind/i, '🎄'], [/pa[sș]te/i, '🐣'], [/ziua/i, '🎂'], [/iunie/i, '🎈'], [/m[aă]r[tț]i[sș]or|martie/i, '🌸'], [/nota|burs/i, '⭐'], [/dob[aâ]nd|randament/i, '🌱'], [/aloca/i, '🏦']];
const iconFor = (reason) => { const hit = ICONS.find(([re]) => re.test(reason || '')); return hit ? hit[1] : '🎁'; };

function giftCard(g, color) {
  return h('div', { class: 'box', style: 'display:flex;gap:12px;align-items:center;margin-top:8px' },
    h('span', { 'aria-hidden': 'true', style: `flex:none;width:40px;height:40px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:20px` }, iconFor(g.reason)),
    h('div', { style: 'flex:1;min-width:0' }, h('b', {}, g.giver), h('p', { style: 'margin:2px 0 0' }, [g.reason, formatGiftDate(g.date)].filter(Boolean).join(' · '))),
    h('span', { class: 'amt' }, '+' + amount(g.amount_minor, g.currency)));
}

export function giftsSection(model, { canAdd = false } = {}) {
  const all = liveGifts(model);
  if (!all.length && !canAdd) return null;
  const totals = totalsByCurrency(all);
  const lei = totals.find((t) => t.currency === 'RON');
  const others = totals.filter((t) => t.currency !== 'RON');
  const people = new Set(all.map((g) => g.giver)).size;

  // the bar: the ten biggest givers (in lei) and the rest together
  const ranked = lei ? byGiver(all, 'RON') : [];
  const top = ranked.slice(0, COLORS.length), rest = ranked.slice(COLORS.length);
  const parts = [...top.map((p, i) => ({ label: p.giver, share: p.share, minor: p.minor, color: COLORS[i] })),
    ...(rest.length ? [{ label: 'Alții', share: rest.reduce((s, p) => s + p.share, 0), minor: rest.reduce((s, p) => s + p.minor, 0), color: OTHERS_COLOR }] : [])];
  const colorOf = new Map(top.map((p, i) => [p.giver, COLORS[i]]));

  const totalEl = h('span', { class: 'v' }, lei ? amount(0, 'RON') : '');
  if (lei) requestAnimationFrame(() => countUp(totalEl, lei.minor, (x) => amount(x, 'RON')));

  const list = h('div', {});
  let open = false;
  const toggle = h('button', { class: 'secondary', style: 'margin:12px 16px 0;width:calc(100% - 32px)' });
  const draw = () => {
    list.replaceChildren();
    if (!open) {
      list.append(...all.slice(0, 5).map((g) => giftCard(g, colorOf.get(g.giver) || OTHERS_COLOR)));
      toggle.textContent = all.length > 5 ? `Arată toate (${all.length})` : '';
    } else {
      for (const y of byYear(all)) {
        list.append(h('h3', { style: 'margin:16px 16px 0;color:var(--kid)' }, `${y.year || 'Mai demult'} · ${y.totals.map((t) => amount(t.minor, t.currency)).join(' + ')}`),
          ...y.list.map((g) => giftCard(g, colorOf.get(g.giver) || OTHERS_COLOR)));
      }
      toggle.textContent = 'Arată mai puține';
    }
    toggle.hidden = all.length <= 5;
  };
  toggle.addEventListener('click', () => { open = !open; draw(); });
  draw();

  return h('section', { 'aria-label': 'Darurile mele' },
    h('h2', { class: 'kidh2' }, '🎁 Darurile mele'),
    h('p', { class: 'kidlead' }, 'Aici e povestea oamenilor care te-au răsfățat. Banii sunt deja în cutiile de mai sus, iar aici păstrăm amintirea.'),
    h('p', { class: 'small', style: 'margin:0 16px 8px' }, 'Aici sunt doar banii primiți și puși în cont, până la 14 ani. Banii primiți în mână, pe care nu i-am pus în cont, nu sunt în listă. Dacă vrei, îi poți adăuga acum, de când avem aplicația.'),
    all.length ? h('div', { class: 'box', role: 'button', tabindex: '0', 'aria-label': 'Atinge pentru confetti', onclick: pop, style: 'text-align:center' },
      h('p', { style: 'margin:0' }, 'De-a lungul anilor ai primit'),
      lei ? h('div', { class: 'amt', style: 'font-size:1.8rem' }, totalEl) : null,
      others.length ? h('p', { style: 'margin:4px 0 0' }, (lei ? 'și încă ' : '') + others.map((t) => amount(t.minor, t.currency)).join(' + ')) : null,
      h('p', { style: 'margin:4px 0 0' }, `de la ${people} ${people === 1 ? 'om' : 'oameni'} dragi`)) : null,
    canAdd ? h('a', { href: '#/iza/primit', class: 'btn', style: 'display:block;margin:10px 16px 0;text-align:center;text-decoration:none' }, '➕ Am primit un dar') : null,
    parts.length ? h('section', { class: 'colors' },
      h('div', { class: 'stackbar', role: 'img', 'aria-label': 'Cât ai primit de la fiecare' },
        ...parts.map((p) => { const seg = h('div', { style: `background:${p.color}` }); growOnView(seg, Math.max(3, p.share * 100) + '%'); return seg; })),
      h('div', { class: 'legend' }, ...parts.map((p) => h('span', {}, h('i', { style: `background:${p.color}` }), `${p.label} · ${Math.round(p.share * 100)}%`, h('b', { class: 'mono' }, amount(p.minor, 'RON')))))) : null,
    list, toggle);
}
