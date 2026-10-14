// Hash router: '#/active' -> routes['/active'](). One handler per screen.
export function createRouter(routes, fallback) {
  const current = () => location.hash.replace(/^#/, '') || '/';
  const render = () => (routes[current()] || routes[fallback])();
  window.addEventListener('hashchange', render);
  return {
    render,
    go(path) { if (current() === path) render(); else location.hash = '#' + path; },
  };
}
