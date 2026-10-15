/**
 * Calendar planning: PURE functions (no Apps Script services, no dates from the clock), so they can be tested in the
 * browser test page (tests/calendar.test.js loads this file as a plain script). In the Apps Script project this file is
 * added as a second script file named "Plan" (Code.gs calls these functions; all names end in "_").
 * Dates are 'YYYY-MM-DD' strings, money is in minor units, like the rest of the app.
 */

var PLAN_HOUR_ = 9;          // every event starts at 09:00
var PLAN_MINUTES_ = 30;      // and lasts 30 minutes
var PLAN_TAG_ = 'famDep';    // event tag key; the value is `${depositId}|mat` or `${depositId}|over`

function planAddDays_(ymd, n) {
  var p = ymd.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function planMoney_(minor) {
  var neg = minor < 0, v = Math.abs(Math.round(minor));
  var whole = String(Math.floor(v / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + whole + ',' + String(v % 100).padStart(2, '0');
}

// A deposit that should have a reminder: still active, not void, not closed. `closed_date` only exists once the app
// closed it, but status alone already says matured/broken; both are checked so a half-written row never reminds.
function planIsOpen_(d) {
  return !d.void && d.status === 'active' && !d.closedDate;
}

function planLabel_(d) {
  return (d.institution || 'Depozit') + (d.owner ? ' · ' + d.owner : '');
}

function planDescription_(d, extra) {
  var lines = [
    'Bancă: ' + planLabel_(d),
    'Sumă: ' + planMoney_(d.principalMinor) + ' ' + d.currency,
    'Dobândă: ' + (d.rateBp / 100).toFixed(2).replace('.', ',') + '%',
    'Scadență: ' + d.maturity,
  ];
  if (extra) lines.push(extra);
  lines.push('', 'Deschide aplicația → Active → Depozite → Prelungește / Închide.');
  if (d.space) lines.push('Spațiu: ' + d.space);
  return lines.join('\n');
}

/**
 * The events that should exist today for these deposits.
 *  - maturity: on the maturity day, popup 3 days before and at the time (only maturity >= today)
 *  - overdue : an open deposit past its maturity gets ONE event (the day after the maturity, never earlier than today),
 *              popup at the time; it stays until the deposit is closed or rolled over
 * Titles never carry amounts (lock screens); the description does.
 * deposit = { id, space, institution, owner, currency, principalMinor, rateBp, maturity, status, closedDate, void }
 */
function planDesiredDepositEvents_(today, deposits) {
  var out = [];
  deposits.forEach(function (d) {
    if (!planIsOpen_(d) || !d.maturity) return;
    var label = planLabel_(d);
    if (d.maturity >= today) {
      out.push({ key: d.id + '|mat', kind: 'mat', date: d.maturity, title: 'Scade depozitul ' + label,
        description: planDescription_(d), reminders: [3 * 24 * 60, 0] });
    } else {
      var due = planAddDays_(d.maturity, 1);
      out.push({ key: d.id + '|over', kind: 'over', date: due < today ? today : due, title: 'Depozit scadent — prelungește sau închide: ' + label,
        description: planDescription_(d, 'Scadența a trecut și depozitul nu a fost prelungit sau închis.'), reminders: [0] });
    }
  });
  return out;
}

/**
 * Reconcile the wanted events with the ones already in the calendar (carrying our tag).
 * existing = [{ ref, key, date, title, description }]; ref is whatever the caller needs to find the event again.
 * Returns { create: [wanted], update: [{ ref, wanted }], remove: [ref] }:
 *  - no matching event             -> create
 *  - matching event, data changed  -> update (title, description and, for maturity events, the date)
 *  - a duplicate of the same key   -> remove the extra copies
 *  - an event nobody wants any more (closed, rolled over, voided, modified = new id, maturity moved) -> remove
 * Running it again right after applying the result yields nothing to do (idempotent).
 * An overdue event keeps the date it was created with (it must not slide forward every day).
 */
function planReconcile_(wanted, existing) {
  var byKey = {};
  existing.forEach(function (e) { (byKey[e.key] = byKey[e.key] || []).push(e); });
  var res = { create: [], update: [], remove: [] };
  var wantedKeys = {};
  wanted.forEach(function (w) {
    wantedKeys[w.key] = true;
    var have = byKey[w.key] || [];
    if (!have.length) { res.create.push(w); return; }
    var keep = have[0];
    have.slice(1).forEach(function (e) { res.remove.push(e.ref); });
    var dateChanged = w.kind === 'mat' && keep.date !== w.date;
    if (dateChanged || keep.title !== w.title || keep.description !== w.description) res.update.push({ ref: keep.ref, wanted: w });
  });
  existing.forEach(function (e) { if (!wantedKeys[e.key]) res.remove.push(e.ref); });
  return res;
}

// The next day-15 at 09:00 that is still ahead: this month if today is before the 15th (or the 15th before 09:00).
function planNextBalancesDate_(today, hourNow) {
  var p = today.split('-').map(Number);
  var thisMonth = today.slice(0, 7) + '-15';
  if (p[2] < 15 || (p[2] === 15 && hourNow < PLAN_HOUR_)) return thisMonth;
  var d = new Date(Date.UTC(p[0], p[1], 15)); // month index p[1] = next month
  return d.toISOString().slice(0, 10);
}

/**
 * Who still has to be invited to the monthly balances series: the people in OWNER_EMAILS (Ady, Carmen, Iza) minus the
 * organizer (the calendar owner, who has the event anyway) and minus whoever is already on the guest list. Comparing
 * lower-cased addresses keeps the invitation from being sent twice. Deposit events never use this: they are Ady's only.
 */
function planGuestsToInvite_(ownerEmails, existingGuests, organizer) {
  var have = {};
  (existingGuests || []).forEach(function (e) { have[String(e).toLowerCase()] = true; });
  if (organizer) have[String(organizer).toLowerCase()] = true;
  var out = [];
  Object.keys(ownerEmails || {}).forEach(function (name) {
    var e = String(ownerEmails[name] || '').trim().toLowerCase();
    if (e && !have[e]) { have[e] = true; out.push(e); }
  });
  return out;
}
