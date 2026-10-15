// "Come back to Active": the + buttons and the expanded rows on the Active screen open the existing forms; when one of
// them is saved it calls finish(), which sends the user back to Active with that category open (instead of the form's
// own screen). The return is forgotten as soon as the user navigates anywhere that is not one of the routes of that flow
// (e.g. closes the form), so a later save elsewhere never jumps to Active by surprise.
export const openCats = new Set(); // Active categories expanded in place (read by the Active screen)
let ret = null;

export function setReturn(allowedRoutes, openKey) { ret = { allowed: allowedRoutes, openKey }; }

// After a successful save: back to Active (category open) if a flow started there, else where the form normally goes.
// fallback null = stay on the current screen and re-render.
export function finish(app, fallback) {
  if (ret) { openCats.add(ret.openKey); ret = null; app.go('/active'); return; }
  if (fallback) app.go(fallback); else app.rerender();
}

window.addEventListener('hashchange', () => {
  if (ret && !ret.allowed.includes(location.hash.slice(1).split('?')[0])) ret = null;
});
