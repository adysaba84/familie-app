import { h } from '../js/dom.js';
import { tests, setCurrent } from './harness.js';

const suites = ['money.test.js', 'model.test.js', 'calc.test.js', 'deposits.test.js', 'iza-plan.test.js', 'situations.test.js', 'cash.test.js', 'return.test.js', 'calendar.test.js', 'security.test.js'];
for (const s of suites) {
  setCurrent(s);
  await import('./' + s);
}

let pass = 0, fail = 0;
const out = document.getElementById('results');
for (const t of tests) {
  let err = null;
  try { await t.fn(); } catch (e) { err = e; }
  if (err) fail++; else pass++;
  out.append(h('div', { class: err ? 'err' : 'muted', 'data-status': err ? 'fail' : 'pass' },
    (err ? 'FAIL ' : 'ok   ') + t.suite + ' · ' + t.name + (err ? ' — ' + err.message : '')));
}
const summary = document.getElementById('summary');
summary.textContent = `${pass} trecute, ${fail} eșuate`;
summary.dataset.fail = String(fail);
summary.dataset.done = '1';
