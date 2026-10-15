/**
 * Familie-app background jobs (Google Apps Script, runs as the owner inside Google).
 *  - dailyRates():         BNR rates (bnr.ro has no CORS, so the browser cannot fetch them) -> `rates` tab of both files
 *  - dailyCalendarSync():  Google Calendar events for deposit maturities / overdue deposits (idempotent, see Plan.js)
 *                          + the monthly "update the balances" series (created once by installTriggers)
 *  - weeklyBackup():       copies of both files into Drive "Finanțe/backup", keeps the newest 12 of each
 *
 * No private data lives in this file: file ids and emails are Script Properties (see README.md).
 * Planning logic (what events should exist) is in Plan.js (pure, tested in tests/calendar.test.js).
 * Money is stored in minor units and rates x10 000, exactly like the app (see js/schema.js).
 */

const TZ = 'Europe/Bucharest';
const STALE_DAYS = 30;
const KEEP_BACKUPS = 12;
const FILE_TITLES = { parents: 'FIN · Părinți', iza: 'FIN · Iza' };

// ---------- configuration (Script Properties) ----------
function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const need = (k) => { const v = p.getProperty(k); if (!v) throw new Error('Lipsește proprietatea ' + k); return v; };
  return {
    files: { parents: need('FILE_PARENTS'), iza: p.getProperty('FILE_IZA') || '' },
    owner: p.getProperty('OWNER_EMAIL') || '',                       // no longer used for notifications (Calendar only); kept for later
    ownerEmails: JSON.parse(p.getProperty('OWNER_EMAILS') || '{}'), // {"Carmen":"..@gmail.com","Ady":"..","Iza":".."}
  };
}

// ---------- small helpers ----------
const todayYmd_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

// cells are stored as text 'YYYY-MM-DD'; a hand-typed cell may be a Date: normalise both
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').slice(0, 10);
}

function daysBetween_(a, b) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

function table_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { sh, rows: [] };
  const values = sh.getDataRange().getValues();
  const head = values[0];
  const rows = values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => { o[h] = r[j]; });
    return o;
  });
  return { sh, rows: rows.filter((r) => r.void !== 1 && r.void !== '1' && r.void !== true) };
}

// append one row; text cells (dates, keys) get a text format first so 'YYYY-MM-DD' never becomes a Date,
// numbers stay numbers
function appendText_(sh, values) {
  const r = sh.getLastRow() + 1;
  values.forEach((v, i) => { if (typeof v !== 'number') sh.getRange(r, i + 1).setNumberFormat('@'); });
  sh.getRange(r, 1, 1, values.length).setValues([values]);
}

function openFiles_(c) {
  return Object.entries(c.files).filter(([, id]) => id).map(([space, id]) => ({ space, id, ss: SpreadsheetApp.openById(id) }));
}

// ---------- 1. BNR rates ----------
function dailyRates() {
  const c = cfg_();
  const xml = UrlFetchApp.fetch('https://www.bnr.ro/nbrfxrates.xml', { headers: { 'User-Agent': 'Mozilla/5.0' } }).getContentText();
  // bnr.ro has been seen answering with its HTML home page instead of the XML feed: refuse to parse anything else
  if (xml.indexOf('<DataSet') < 0) throw new Error('BNR nu a întors XML-ul cu cursurile (a întors altceva): ' + xml.slice(0, 80));
  const root = XmlService.parse(xml).getRootElement();
  const ns = root.getNamespace();
  const cube = root.getChild('Body', ns).getChild('Cube', ns);
  const date = cube.getAttribute('date').getValue(); // the publishing date
  const rate = {};
  cube.getChildren('Rate', ns).forEach((r) => {
    const mult = r.getAttribute('multiplier') ? Number(r.getAttribute('multiplier').getValue()) : 1;
    rate[r.getAttribute('currency').getValue()] = Number(r.getText()) / mult;
  });
  const x10k = (v) => (v == null || isNaN(v) ? '' : Math.round(v * 10000));
  const row = [date, x10k(rate.EUR), x10k(rate.USD), x10k(rate.XAU), 'BNR'];
  if (!row[1] || !row[2]) throw new Error('Curs EUR/USD lipsă în răspunsul BNR');

  openFiles_(c).forEach(({ ss }) => {
    const { sh, rows } = table_(ss, 'rates');
    if (!sh) return;
    if (rows.some((r) => ymd_(r.date) === date && r.source === 'BNR')) return; // already have today's official rate
    appendText_(sh, row);
  });
}

// ---------- 2. Google Calendar: deposit maturities + monthly balances ----------
// Notifications reach the phone through the Calendar app (no email). Events live in the calendar the script runs in.
const BALANCES_TITLE = 'Actualizează soldurile';
const TEST_TAG = 'famTest';

function parseAt_(ymd, hour, minute) { return Utilities.parseDate(`${ymd} ${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`, TZ, 'yyyy-MM-dd HH:mm'); }
function addPopups_(ev, minutes) { ev.removeAllReminders(); minutes.forEach((m) => ev.addPopupReminder(m)); }

// every deposit of both files as the plain objects Plan.js expects (void rows are already left out by table_)
function depositInputs_(c) {
  const out = [];
  openFiles_(c).forEach(({ space, ss }) => {
    const accounts = {};
    table_(ss, 'accounts').rows.forEach((a) => { accounts[a.id] = a; });
    table_(ss, 'deposits').rows.forEach((d) => {
      const a = accounts[d.account_id] || {};
      out.push({ id: String(d.id), space: FILE_TITLES[space], institution: a.institution || '', owner: a.owner || '', currency: String(d.currency),
        principalMinor: Number(d.principal_minor), rateBp: Number(d.rate_bp), maturity: ymd_(d.maturity_date), status: String(d.status),
        closedDate: ymd_(d.closed_date), void: false });
    });
  });
  return out;
}

// events of this script (tag famDep) in a wide window, as { ref: the event, key, date, title, description }
function taggedEvents_(cal, from, to) {
  return cal.getEvents(from, to).filter((ev) => ev.getTag(PLAN_TAG_)).map((ev) => ({
    ref: ev, key: ev.getTag(PLAN_TAG_), date: Utilities.formatDate(ev.getStartTime(), TZ, 'yyyy-MM-dd'), title: ev.getTitle(), description: ev.getDescription(),
  }));
}

function createDepositEvent_(cal, w) {
  const start = parseAt_(w.date, PLAN_HOUR_, 0);
  const ev = cal.createEvent(w.title, start, new Date(start.getTime() + PLAN_MINUTES_ * 60000), { description: w.description });
  ev.setTag(PLAN_TAG_, w.key);
  addPopups_(ev, w.reminders);
}

// Daily 08:00: make the calendar match the sheet. Creates what is missing, updates what changed, deletes what no longer
// applies (closed, rolled over, voided, modified, maturity moved). Safe to run any number of times.
function dailyCalendarSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    const c = cfg_();
    const cal = CalendarApp.getDefaultCalendar();
    const today = todayYmd_();
    const wanted = planDesiredDepositEvents_(today, depositInputs_(c));
    const day = 86400000;
    const existing = taggedEvents_(cal, new Date(Date.now() - 400 * day), new Date(Date.now() + 1100 * day));
    const plan = planReconcile_(wanted, existing);
    plan.remove.forEach((ev) => ev.deleteEvent());
    plan.update.forEach(({ ref, wanted: w }) => {
      ref.setTitle(w.title); ref.setDescription(w.description);
      if (w.kind === 'mat') { const st = parseAt_(w.date, PLAN_HOUR_, 0); ref.setTime(st, new Date(st.getTime() + PLAN_MINUTES_ * 60000)); }
      addPopups_(ref, w.reminders);
    });
    plan.create.forEach((w) => createDepositEvent_(cal, w));
    // test events from testCalendar() are cleaned up the next day
    cal.getEvents(new Date(Date.now() - 7 * day), new Date(Date.now() - day)).filter((ev) => ev.getTag(TEST_TAG)).forEach((ev) => ev.deleteEvent());
    console.log(`calendar: +${plan.create.length} ~${plan.update.length} -${plan.remove.length}`);
  } finally { lock.releaseLock(); }
}

// The monthly "update the balances" reminder: ONE recurring series (day 15, 09:00, popup at the time), created once.
// An existing series with this title is recognised, so running installTriggers again never creates a second one.
function ensureBalancesSeries_() {
  const cal = CalendarApp.getDefaultCalendar();
  const from = new Date(), to = new Date(Date.now() + 70 * 86400000);
  if (cal.getEvents(from, to, { search: BALANCES_TITLE }).some((ev) => ev.isRecurringEvent() && ev.getTitle() === BALANCES_TITLE)) return false;
  const start = parseAt_(planNextBalancesDate_(todayYmd_(), Number(Utilities.formatDate(new Date(), TZ, 'H'))), PLAN_HOUR_, 0);
  const series = cal.createEventSeries(BALANCES_TITLE, start, new Date(start.getTime() + PLAN_MINUTES_ * 60000),
    CalendarApp.newRecurrence().addMonthlyRule().onlyOnMonthDay(15),
    { description: 'Deschide aplicația → Active (conturile cu sold vechi apar marcate) → +' });
  series.removeAllReminders(); series.addPopupReminder(0);
  return true;
}

// By hand: an event in ~2 minutes with a popup at the time, to see the notification arrive on the phone.
function testCalendar() {
  const cal = CalendarApp.getDefaultCalendar();
  const start = new Date(Date.now() + 2 * 60000);
  const ev = cal.createEvent('Test notificare Finanțe', start, new Date(start.getTime() + 15 * 60000), { description: 'Dacă vezi notificarea pe telefon, Calendar funcționează. Se șterge singur a doua zi.' });
  ev.setTag(TEST_TAG, '1');
  addPopups_(ev, [0]);
  return 'Eveniment creat pentru ' + Utilities.formatDate(start, TZ, 'HH:mm');
}

// ---------- 4. weekly backup ----------
function backupFolder_() {
  const sub = (parent, name) => {
    const it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  };
  return sub(sub(DriveApp.getRootFolder(), 'Finanțe'), 'backup');
}

function weeklyBackup() {
  const c = cfg_();
  const folder = backupFolder_();
  const stamp = todayYmd_();
  openFiles_(c).forEach(({ space, id }) => {
    const title = FILE_TITLES[space];
    DriveApp.getFileById(id).makeCopy(`${title} · ${stamp}`, folder);
    // keep the newest KEEP_BACKUPS copies of this file, trash the rest
    const copies = [];
    const it = folder.getFiles();
    while (it.hasNext()) { const f = it.next(); if (f.getName().indexOf(title + ' · ') === 0) copies.push(f); }
    copies.sort((a, b) => b.getDateCreated() - a.getDateCreated());
    copies.slice(KEEP_BACKUPS).forEach((f) => f.setTrashed(true));
  });
}

// ---------- setup helpers (run by hand) ----------
// Time triggers: rates Mon-Fri 10:30 (BNR publishes around noon: a second run at 13:30 picks up late publications),
// calendar sync daily 08:00, backup Sunday 03:00; plus the monthly balances series in Calendar (created once).
// Every old trigger (including the removed email jobs dailyNotifications / monthlyReminder) is deleted first.
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  const days = [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY];
  days.forEach((d) => {
    ScriptApp.newTrigger('dailyRates').timeBased().onWeekDay(d).atHour(10).nearMinute(30).inTimezone(TZ).create();
    ScriptApp.newTrigger('dailyRates').timeBased().onWeekDay(d).atHour(13).nearMinute(30).inTimezone(TZ).create();
  });
  ScriptApp.newTrigger('dailyCalendarSync').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone(TZ).create();
  const created = ensureBalancesSeries_();
  return created ? 'serie lunară creată' : 'seria lunară exista deja';
}

// A harmless check after setup: reads both files, and creates + deletes one Calendar event (proves Calendar access).
function testSetup() {
  const c = cfg_();
  const names = openFiles_(c).map((f) => f.ss.getName());
  const cal = CalendarApp.getDefaultCalendar();
  const start = new Date(Date.now() + 3600000);
  const ev = cal.createEvent('Test Finanțe (se șterge)', start, new Date(start.getTime() + 900000));
  ev.deleteEvent();
  return names;
}
