import { test, eq } from './harness.js';
import { setReturn, finish, openCats } from '../js/return.js';

const app = () => { const calls = []; return { calls, go: (p) => calls.push(['go', p]), rerender: () => calls.push(['rerender']) }; };
const at = (hash) => { history.replaceState(null, '', hash); window.dispatchEvent(new HashChangeEvent('hashchange')); };

test('finish: a flow started from Active returns there with the category open, once', () => {
  openCats.clear();
  const a = app();
  setReturn(['/depozite/nou'], 'depozite');
  at('#/depozite/nou');
  finish(a, '/depozite');
  eq(a.calls, [['go', '/active']]); eq([...openCats], ['depozite']);
  const b = app(); finish(b, '/depozite'); // the return was consumed: the next save goes where the form normally goes
  eq(b.calls, [['go', '/depozite']]);
});
test('finish: no flow and no fallback re-renders the current screen', () => {
  const a = app(); finish(a, null); eq(a.calls, [['rerender']]);
});
test('the return is forgotten when the user leaves the flow (closes the form)', () => {
  openCats.clear();
  setReturn(['/conturi/solduri'], 'conturi');
  at('#/conturi/solduri'); // still inside the flow
  at('#/conturi'); // closed the form
  const a = app(); finish(a, '/conturi');
  eq(a.calls, [['go', '/conturi']]); eq([...openCats], []);
});
