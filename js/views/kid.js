import { h, mount } from '../dom.js';

// Placeholder for Iza's read-only view (built in M5).
export function kidView({ email, onSignOut }) {
  document.getElementById('app').classList.add('kid');
  mount(
    h('h1', {}, 'Banii tăi'),
    h('p', { class: 'muted' }, 'Conectată ca ' + email),
    h('div', { class: 'card' }, h('p', {}, 'Aici vei vedea cum cresc economiile tale. Revine în curând!')),
    h('div', { class: 'card' }, h('button', { class: 'secondary', onclick: onSignOut }, 'Ieșire')),
  );
}
