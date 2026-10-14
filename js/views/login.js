import { h, mount } from '../dom.js';

export function loginView({ onSignIn, error }) {
  mount(
    h('h1', {}, 'Finanțe'),
    h('p', { class: 'muted' }, 'Aplicație privată de familie.'),
    h('div', { class: 'card stack' },
      h('button', { id: 'signin', onclick: onSignIn }, 'Intră cu Google'),
      error ? h('p', { class: 'err' }, error) : null,
    ),
  );
}
