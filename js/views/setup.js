import { h, mount } from '../dom.js';

// First run on a device: pick the files shared with you (Picker grants the app access to exactly those files).
// The app never creates files: a stranger who signs in cannot start a copy pre-filled with the family's account names.
export function setupView({ email, onPick, onSignOut, busy, message }) {
  mount(
    h('div', { class: 'topbar' }, h('h1', {}, 'Configurare'), h('button', { class: 'secondary', onclick: onSignOut }, 'Ieșire')),
    h('p', { class: 'muted' }, 'Conectat ca ' + email),
    h('div', { class: 'card stack' },
      h('h2', {}, 'Alege fișierele'),
      h('p', { class: 'muted' }, 'Alege fișierele „FIN · …” partajate cu tine în Google Drive. Dacă nu le găsești, cere să-ți fie partajate.'),
      h('button', { onclick: onPick, disabled: busy }, 'Alege fișierele'),
    ),
    message ? h('p', { class: message.error ? 'err' : 'muted' }, message.text) : null,
  );
}
