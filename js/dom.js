// The only way the app puts anything on screen. Children are appended as text nodes or
// elements, never parsed as HTML, so data can never be injected as markup.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid != null && kid !== false) el.append(kid);
  }
  return el;
}

export function mount(...nodes) {
  document.getElementById('app').replaceChildren(...nodes);
}
