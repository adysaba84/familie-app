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
  document.getElementById('app').replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
}

// SVG elements (charts). Same rule: attributes and text only, never markup.
const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) el.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
