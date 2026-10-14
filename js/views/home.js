import { h, mount } from '../dom.js';

// Placeholder for the parent overview (built in M3). M1 only proves login, files and role.
export function homeView({ email, files, onSignOut, onPickMore }) {
  const row = (label, f) => h('div', { class: 'row' }, h('span', {}, label),
    h('span', { class: 'muted' }, f ? (f.canEdit ? 'editor' : 'doar citire') : 'fără acces'));
  mount(
    h('div', { class: 'topbar' }, h('h1', {}, 'Active'), h('span', { class: 'badge' }, 'Părinți')),
    h('p', { class: 'muted' }, 'Conectat ca ' + email),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Fișiere'),
      row('FIN · Părinți', files.parents),
      row('FIN · Iza', files.iza),
      (!files.parents || !files.iza) ? h('button', { class: 'secondary', onclick: onPickMore }, 'Alege fișierele') : null,
    ),
    h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Ecranele de active vin în pasul următor.')),
    h('div', { class: 'card' }, h('button', { class: 'secondary', onclick: onSignOut }, 'Ieșire')),
  );
}
