import { h, mount } from '../dom.js';

// First run on a device: Ady creates the two spreadsheets; everyone else picks the files
// shared with them (Picker grants the app access to exactly those files).
export function setupView({ email, onCreate, onPick, onSignOut, busy, message }) {
  mount(
    h('div', { class: 'topbar' }, h('h1', {}, 'Configurare'), h('button', { class: 'secondary', onclick: onSignOut }, 'Ieșire')),
    h('p', { class: 'muted' }, 'Conectat ca ' + email),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Alege fișierele'),
      h('p', { class: 'muted' }, 'Alege fișierele „FIN · …” partajate cu tine în Google Drive.'),
      h('button', { onclick: onPick, disabled: busy }, 'Alege fișierele'),
    ),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Prima configurare (doar Ady)'),
      h('p', { class: 'muted' }, 'Creează în Drive-ul tău fișierele „FIN · Părinți” și „FIN · Iza”, cu toate foile.'),
      h('button', { class: 'secondary', onclick: onCreate, disabled: busy }, 'Creează fișierele'),
    ),
    message ? h('p', { class: message.error ? 'err' : 'muted' }, message.text) : null,
  );
}
