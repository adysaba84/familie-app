/**
 * Familie-app background jobs (Google Apps Script, runs as the owner inside Google).
 *  - dailyRates():         BNR rates (bnr.ro has no CORS, so the browser cannot fetch them) -> `rates` tab of both files
 *  - dailyNotifications(): email before a deposit matures (idempotent through `notifications_log`)
 *  - monthlyReminder():    email listing accounts whose balance is older than 30 days
 *  - weeklyBackup():       copies of both files into Drive "Finanțe/backup", keeps the newest 12 of each
 *
 * No private data lives in this file: file ids and emails are Script Properties (see README.md).
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
    owner: need('OWNER_EMAIL'),                                   // always receives a copy
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

function ownersToEmails_(c, owner) {
  const to = new Set([c.owner]);
  if (owner && c.ownerEmails[owner]) to.add(c.ownerEmails[owner]);
  return [...to].join(',');
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

// ---------- 2. emails before a deposit matures ----------
function dailyNotifications() {
  const c = cfg_();
  const today = todayYmd_();
  openFiles_(c).forEach(({ space, ss }) => {
    const accounts = {};
    table_(ss, 'accounts').rows.forEach((a) => { accounts[a.id] = a; });
    const log = table_(ss, 'notifications_log');
    const sent = new Set(log.rows.map((r) => String(r.key)));
    table_(ss, 'deposits').rows.forEach((d) => {
      const notify = Number(d.notify_days);
      if (d.status !== 'active' || !(notify > 0)) return;
      const mat = ymd_(d.maturity_date);
      const left = daysBetween_(today, mat);
      if (left < 0 || left > notify) return;
      const key = `maturity:${d.id}:${mat}`;
      if (sent.has(key)) return;
      const acc = accounts[d.account_id] || {};
      const who = acc.owner || '';
      const amount = (Number(d.principal_minor) / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2 });
      // no amounts in the subject (lock screens)
      const subject = left === 0 ? 'Un depozit se termină azi' : left === 1 ? 'Un depozit se termină mâine' : `Un depozit se termină în ${left} zile`;
      const body = [
        `Bancă: ${acc.institution || '?'}${who ? ' · ' + who : ''}`,
        `Sumă: ${amount} ${d.currency}`,
        `Scadență: ${mat}`,
        `Dobândă: ${(Number(d.rate_bp) / 100).toFixed(2)}%`,
        d.auto_renew ? 'Se prelungește automat.' : 'Nu se prelungește automat: decide ce faci cu banii.',
        '',
        `Spațiu: ${FILE_TITLES[space]}`,
      ].join('\n');
      MailApp.sendEmail(ownersToEmails_(c, who), subject, body);
      appendText_(log.sh, [key, new Date().toISOString()]);
      sent.add(key);
    });
  });
}

// ---------- 3. monthly reminder: balances older than 30 days ----------
function monthlyReminder() {
  const c = cfg_();
  const today = todayYmd_();
  const lines = [];
  openFiles_(c).forEach(({ space, ss }) => {
    const last = {};
    const note = (id, d) => { d = ymd_(d); if (d && (!last[id] || last[id] < d)) last[id] = d; };
    table_(ss, 'balances').rows.forEach((b) => note(b.account_id, b.date));
    table_(ss, 'broker_values').rows.forEach((v) => note(v.account_id, v.date));
    table_(ss, 'accounts').rows.forEach((a) => {
      if (a.status === 'closed' || ['current', 'savings', 'voucher', 'broker', 'insurance'].indexOf(a.kind) < 0) return;
      const d = last[a.id];
      const age = d ? daysBetween_(d, today) : null;
      if (age === null || age > STALE_DAYS) lines.push(`${FILE_TITLES[space]} · ${a.name}: ${d ? 'ultimul sold ' + d + ' (acum ' + age + ' zile)' : 'fără sold'}`);
    });
  });
  if (!lines.length) return;
  MailApp.sendEmail(c.owner, 'Soldurile de actualizat', 'Aceste conturi nu au fost actualizate de peste ' + STALE_DAYS + ' de zile:\n\n' + lines.join('\n') + '\n\nDeschide aplicația: Conturi → Actualizează toate soldurile.');
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

// ---------- setup helpers (run once by hand) ----------
// Time triggers: rates Mon-Fri 10:30 (BNR publishes around noon: a second run at 13:30 picks up late publications),
// notifications daily 08:00, reminder on the 1st at 09:00, backup Sunday 03:00.
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  const days = [ScriptApp.WeekDay.MONDAY, ScriptApp.WeekDay.TUESDAY, ScriptApp.WeekDay.WEDNESDAY, ScriptApp.WeekDay.THURSDAY, ScriptApp.WeekDay.FRIDAY];
  days.forEach((d) => {
    ScriptApp.newTrigger('dailyRates').timeBased().onWeekDay(d).atHour(10).nearMinute(30).inTimezone(TZ).create();
    ScriptApp.newTrigger('dailyRates').timeBased().onWeekDay(d).atHour(13).nearMinute(30).inTimezone(TZ).create();
  });
  ScriptApp.newTrigger('dailyNotifications').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  ScriptApp.newTrigger('monthlyReminder').timeBased().onMonthDay(1).atHour(9).inTimezone(TZ).create();
  ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone(TZ).create();
}

// A harmless check after setup: sends one email to OWNER_EMAIL and reads both files.
function testSetup() {
  const c = cfg_();
  const names = openFiles_(c).map((f) => f.ss.getName());
  MailApp.sendEmail(c.owner, 'Test Finanțe', 'Scriptul funcționează. Fișiere citite: ' + names.join(', '));
  return names;
}
