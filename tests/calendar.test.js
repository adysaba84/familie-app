import { test, eq, ok } from './harness.js';

// apps-script/Plan.js is a plain script (Apps Script file "Plan"): load it like a script tag so its functions become globals
await new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = '../apps-script/Plan.js'; s.onload = resolve; s.onerror = () => reject(new Error('Plan.js not loaded'));
  document.head.append(s);
});
const { planDesiredDepositEvents_: desired, planReconcile_: reconcile, planNextBalancesDate_: nextBal, planAddDays_: addDays, planMoney_: money } = window;

// invented deposits
const dep = (o) => ({ id: 'a', space: 'FIN · Test', institution: 'Banca', owner: 'Titular', currency: 'RON', principalMinor: 1027310, rateBp: 530, maturity: '2026-10-16', status: 'active', closedDate: '', void: false, ...o });
const TODAY = '2026-10-15';
// pretend the calendar: existing events as the sync would read them back
const asExisting = (wanted) => wanted.map((w, i) => ({ ref: 'ev' + i, key: w.key, date: w.date, title: w.title, description: w.description }));

test('planMoney_ / planAddDays_', () => {
  eq(money(1027310), '10.273,10'); eq(money(5), '0,05'); eq(money(100000000), '1.000.000,00');
  eq(addDays('2026-10-31', 1), '2026-11-01'); eq(addDays('2026-12-31', 1), '2027-01-01'); eq(addDays('2026-03-01', -1), '2026-02-28');
});
test('maturity event: on the maturity day, 3 days + at-time popups, no amount in the title', () => {
  const [e] = desired(TODAY, [dep({})]);
  eq(e.key, 'a|mat'); eq(e.date, '2026-10-16'); eq(e.title, 'Scade depozitul Banca · Titular'); eq(e.reminders, [4320, 0]);
  ok(!/\d/.test(e.title), 'no digits (amounts) in the title');
  ok(e.description.includes('10.273,10 RON') && e.description.includes('5,30%') && e.description.includes('Prelungește / Închide'));
});
test('maturity today still gets its event; closed / void / matured / broken / rolled-over deposits get none', () => {
  eq(desired(TODAY, [dep({ maturity: TODAY })]).length, 1);
  eq(desired(TODAY, [dep({ status: 'matured', closedDate: '2026-10-15' }), dep({ status: 'broken' }), dep({ void: true }), dep({ closedDate: '2026-10-15' })]), []);
});
test('overdue and still open: ONE event the day after the maturity (never in the past), popup at the time', () => {
  const [e] = desired('2026-10-17', [dep({ maturity: '2026-10-16' })]);
  eq(e.key, 'a|over'); eq(e.kind, 'over'); eq(e.date, '2026-10-17'); eq(e.reminders, [0]);
  eq(e.title, 'Depozit scadent — prelungește sau închide: Banca · Titular');
  eq(desired('2026-10-20', [dep({ maturity: '2026-10-16' })])[0].date, '2026-10-20'); // found late: today, not a past date
});
test('reconcile: empty calendar creates everything; running again on the result changes nothing (idempotent)', () => {
  const w = desired(TODAY, [dep({}), dep({ id: 'b', maturity: '2026-10-18', principalMinor: 1500000, institution: 'BT' }), dep({ id: 'c', maturity: '2026-10-10' })]);
  const first = reconcile(w, []);
  eq(first.create.length, 3); eq(first.update, []); eq(first.remove, []);
  const second = reconcile(desired(TODAY, [dep({}), dep({ id: 'b', maturity: '2026-10-18', principalMinor: 1500000, institution: 'BT' }), dep({ id: 'c', maturity: '2026-10-10' })]), asExisting(w));
  eq(second, { create: [], update: [], remove: [] });
});
test('reconcile: closed, rolled over, voided or modified (new id) deposits lose their event', () => {
  const before = desired(TODAY, [dep({})]);
  const closed = reconcile(desired(TODAY, [dep({ status: 'matured', closedDate: '2026-10-16' })]), asExisting(before));
  eq(closed.remove, ['ev0']); eq(closed.create, []);
  const modified = reconcile(desired(TODAY, [dep({ void: true }), dep({ id: 'a2', principalMinor: 2000000 })]), asExisting(before));
  eq(modified.remove, ['ev0']); eq(modified.create.map((x) => x.key), ['a2|mat']);
});
test('reconcile: a moved maturity or a changed amount updates the event instead of duplicating it', () => {
  const before = desired(TODAY, [dep({})]);
  const moved = reconcile(desired(TODAY, [dep({ maturity: '2026-10-20' })]), asExisting(before));
  eq(moved.update.length, 1); eq(moved.update[0].ref, 'ev0'); eq(moved.update[0].wanted.date, '2026-10-20'); eq(moved.create, []); eq(moved.remove, []);
  const amount = reconcile(desired(TODAY, [dep({ principalMinor: 999999 })]), asExisting(before));
  eq(amount.update.length, 1);
});
test('reconcile: duplicate events of one deposit are cleaned up; a stale overdue event is removed once the deposit is closed', () => {
  const w = desired(TODAY, [dep({})]);
  const dup = asExisting(w).concat([{ ...asExisting(w)[0], ref: 'copy' }]);
  eq(reconcile(w, dup).remove, ['copy']);
  const over = desired('2026-10-17', [dep({})]);
  const gone = reconcile(desired('2026-10-18', [dep({ status: 'matured', closedDate: '2026-10-18' })]), asExisting(over));
  eq(gone.remove, ['ev0']);
});
test('reconcile: an overdue event keeps its original date day after day', () => {
  const day1 = desired('2026-10-17', [dep({})]);
  const day3 = reconcile(desired('2026-10-19', [dep({})]), asExisting(day1));
  eq(day3, { create: [], update: [], remove: [] }); // wanted date moved to today, but the event is not touched
});
test('planNextBalancesDate_: the next day 15 at 09:00 that is still ahead', () => {
  eq(nextBal('2026-10-05', 8), '2026-10-15'); eq(nextBal('2026-10-15', 8), '2026-10-15'); eq(nextBal('2026-10-15', 9), '2026-11-15');
  eq(nextBal('2026-10-20', 12), '2026-11-15'); eq(nextBal('2026-12-20', 12), '2027-01-15');
});

test('planGuestsToInvite_: Carmen and Iza are invited once; the organizer and anyone already invited are skipped', () => {
  const owners = { Ady: 'Ady@example.test', Carmen: 'carmen@example.test', Iza: 'Iza@Example.test' };
  const invite = window.planGuestsToInvite_;
  eq(invite(owners, [], 'ady@example.test'), ['carmen@example.test', 'iza@example.test']);
  eq(invite(owners, ['CARMEN@example.test'], 'ady@example.test'), ['iza@example.test']);
  eq(invite(owners, ['carmen@example.test', 'iza@example.test'], 'ady@example.test'), []); // a rerun sends nothing
  eq(invite({}, [], 'ady@example.test'), []);
  eq(invite({ Iza: '', Carmen: ' c@example.test ' }, [], ''), ['c@example.test']);
});
test('deposit events never carry guests', () => {
  const [e] = desired(TODAY, [dep({})]);
  ok(!('guests' in e) && !('emails' in e));
});
