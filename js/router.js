import { h, mount } from './dom.js';

// Hash router: '#/active' -> routes['/active'](). One handler per screen; a screen that throws
// shows a plain message instead of a blank page.
export function createRouter(routes, fallback) {
  const current = () => location.hash.replace(/^#/, '') || '/';
  const render = () => {
    const handler = routes[current()] || routes[fallback];
    Promise.resolve()
      .then(handler)
      .catch(() => mount(h('div', { class: 'card stack' }, h('p', { class: 'err' }, 'Ceva n-a mers.'), h('button', { onclick: render }, 'Reîncearcă'))));
  };
  window.addEventListener('hashchange', render);
  return {
    render,
    go(path) { if (current() === path) render(); else location.hash = '#' + path; },
  };
}
