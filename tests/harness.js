export const tests = [];
let suite = '';
export const setCurrent = (s) => { suite = s; };
export const test = (name, fn) => tests.push({ suite, name, fn });

const show = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));
export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} expected ${e}, got ${a}`.trim());
}
export function ok(cond, msg = 'assertion failed') { if (!cond) throw new Error(msg); }
export function throws(fn, msg = 'expected a throw') {
  try { fn(); } catch { return; }
  throw new Error(msg);
}
void show;
