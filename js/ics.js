// Calendar events without a server or an Apps Script: an .ics file generated in the browser (RFC 5545) and a Google
// Calendar "template" link. PURE: no DOM, no clock (the caller passes `now`), so it can be tested. Times are "floating"
// local times (the family lives in one time zone), which every calendar app places on the device's local clock.
import { formatMinor } from './money.js';

const CRLF = '\r\n';
export const EVENT_HOUR = 9; // events start at 09:00 and last 30 minutes
export const EVENT_MINUTES = 30;
export const TZ = 'Europe/Bucharest'; // only for the Google Calendar link (ctz)

// TEXT values: backslash, semicolon, comma and newlines are escaped (RFC 5545 3.3.11)
export const icsEscape = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

// Content lines are folded at 75 octets (UTF-8), continuation lines start with one space
export function icsFold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) { // by code point, so a multi-byte character is never cut in two
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; } // the leading space of a continuation takes one octet
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join(CRLF + ' ');
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = (ymd, minutesOfDay) => `${ymd.replace(/-/g, '')}T${pad(Math.floor(minutesOfDay / 60))}${pad(minutesOfDay % 60)}00`;
// DTSTAMP is UTC: `now` is a Date
const utcStamp = (now) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// event = { uid, title, description, date 'YYYY-MM-DD', alarms: [ISO duration like '-P3D' | 'PT0S'], rrule? }
export function buildIcs(events, now) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//familie-app//ro//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    const start = EVENT_HOUR * 60, end = start + EVENT_MINUTES;
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utcStamp(now)}`, `DTSTART:${stamp(e.date, start)}`, `DTEND:${stamp(e.date, end)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`, `DESCRIPTION:${icsEscape(e.description)}`, 'TRANSP:TRANSPARENT');
    for (const trigger of e.alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(e.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join(CRLF) + CRLF;
}

// Google Calendar "create event" link: no alarms can be set from it (the calendar's default notifications apply)
export function googleCalendarUrl(e) {
  const d = (m) => stamp(e.date, m);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${d(EVENT_HOUR * 60)}/${d(EVENT_HOUR * 60 + EVENT_MINUTES)}`, details: e.description, ctz: TZ });
  if (e.rrule) q.set('recur', `RRULE:${e.rrule}`);
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

// ---- the two events of the app ----
// deposit = { id, institution, owner, currency, principalMinor, rateBp, maturity }. The title never carries an amount
// (lock screens); the description does. An open deposit past its maturity gets "scadent" and today's date.
export function depositEvent(deposit, today) {
  const label = (deposit.institution || 'Depozit') + (deposit.owner ? ' · ' + deposit.owner : '');
  const overdue = deposit.maturity < today;
  const lines = [`Bancă: ${label}`, `Sumă: ${formatMinor(deposit.principalMinor)} ${deposit.currency}`,
    `Dobândă: ${(deposit.rateBp / 100).toFixed(2).replace('.', ',')}%`, `Scadență: ${deposit.maturity}`];
  if (overdue) lines.push('Scadența a trecut și depozitul nu a fost prelungit sau închis.');
  lines.push('', 'Deschide aplicația → Active → Depozite → Prelungește / Închide.');
  const description = lines.join('\n');
  return {
    uid: `famdep-${deposit.id}@familie-app`, date: overdue ? today : deposit.maturity,
    title: overdue ? `Depozit scadent — prelungește sau închide: ${label}` : `Scade depozitul ${label}`,
    description, alarms: overdue ? ['PT0S'] : ['-P3D', 'PT0S'],
  };
}

// The monthly "update the balances" reminder: day 15, 09:00, alarm at the time. The first occurrence is the next 15th.
export function nextDay15(today, hourNow = 0) {
  const [y, m, d] = today.split('-').map(Number);
  if (d < 15 || (d === 15 && hourNow < EVENT_HOUR)) return `${y}-${pad(m)}-15`;
  const next = new Date(Date.UTC(y, m, 15)); // month index m = the next month
  return next.toISOString().slice(0, 10);
}
export function balancesEvent(today, hourNow = 0) {
  return {
    uid: 'fam-solduri@familie-app', date: nextDay15(today, hourNow), title: 'Actualizează soldurile', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15',
    description: 'Deschide aplicația → Active (conturile cu sold vechi apar marcate) → +. Apoi: Active → Venituri și cheltuieli.', alarms: ['PT0S'],
  };
}

export const icsFileName = (e) => (e.uid.startsWith('famdep-') ? 'scadenta-depozit' : 'memento-solduri') + '.ics';
