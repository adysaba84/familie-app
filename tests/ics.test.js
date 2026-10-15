import { test, eq, ok } from './harness.js';
import { buildIcs, icsEscape, icsFold, googleCalendarUrl, depositEvent, balancesEvent, nextDay15, icsFileName } from '../js/ics.js';

const NOW = new Date(Date.UTC(2026, 9, 15, 8, 4, 5)); // 2026-10-15T08:04:05Z
const dep = (o = {}) => ({ id: 'abc-123', institution: 'Banca', owner: 'Titular', currency: 'RON', principalMinor: 1027310, rateBp: 530, maturity: '2026-10-16', ...o });
const TODAY = '2026-10-15';
const unfold = (ics) => ics.split('\r\n ').join(''); // what a calendar app sees after unfolding

test('icsEscape: backslash, semicolon, comma and newlines', () => {
  eq(icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  eq(icsEscape('x\r\ny'), 'x\\ny'); eq(icsEscape(null), '');
});
test('icsFold: lines of at most 75 octets, continuation starts with a space, never cuts a multi-byte character', () => {
  const long = 'DESCRIPTION:' + 'ă'.repeat(60) + ' ' + 'x'.repeat(100);
  const folded = icsFold(long);
  const parts = folded.split('\r\n');
  ok(parts.length > 1);
  for (const p of parts) ok(new TextEncoder().encode(p).length <= 75, 'octets: ' + new TextEncoder().encode(p).length);
  ok(parts.slice(1).every((p) => p.startsWith(' ')));
  eq(parts.map((p, i) => (i ? p.slice(1) : p)).join(''), long); // unfolding gives the original back
  eq(icsFold('SHORT:line'), 'SHORT:line');
});
test('deposit .ics: valid structure, CRLF everywhere, stable UID, 09:00-09:30, two alarms (-P3D and PT0S)', () => {
  const ics = buildIcs([depositEvent(dep(), TODAY)], NOW);
  ok(ics.endsWith('\r\n'));
  ok(!/[^\r]\n/.test(ics), 'every line break is CRLF');
  const lines = ics.split('\r\n').filter(Boolean);
  eq(lines[0], 'BEGIN:VCALENDAR'); eq(lines[lines.length - 1], 'END:VCALENDAR');
  ok(lines.includes('VERSION:2.0'));
  ok(lines.includes('UID:famdep-abc-123@familie-app'));
  ok(lines.includes('DTSTAMP:20261015T080405Z'));
  ok(lines.includes('DTSTART:20261016T090000') && lines.includes('DTEND:20261016T093000'));
  eq(lines.filter((l) => l === 'BEGIN:VALARM').length, 2); eq(lines.filter((l) => l === 'END:VALARM').length, 2);
  ok(lines.includes('TRIGGER:-P3D') && lines.includes('TRIGGER:PT0S'));
  eq(lines.filter((l) => l.startsWith('BEGIN:')).length, lines.filter((l) => l.startsWith('END:')).length);
});
test('deposit event: title without amounts, description with amount, currency, rate, maturity and the path in the app', () => {
  const e = depositEvent(dep(), TODAY);
  eq(e.title, 'Scade depozitul Banca · Titular'); ok(!/\d/.test(e.title));
  ok(e.description.includes('Sumă: 10.273,10 RON') && e.description.includes('Dobândă: 5,30%') && e.description.includes('Scadență: 2026-10-16'));
  ok(e.description.includes('Deschide aplicația → Active → Depozite → Prelungește / Închide.'));
  const ics = unfold(buildIcs([e], NOW));
  ok(ics.includes('SUMMARY:Scade depozitul Banca · Titular')); // the middle dot needs no escaping
  ok(ics.includes('Sumă: 10.273\\,10 RON'.replace('\\,', '\\,')), 'comma in the amount is escaped');
});
test('deposit event: same deposit -> same UID (repeated import does not duplicate where the calendar honours it)', () => {
  eq(depositEvent(dep(), TODAY).uid, depositEvent(dep({ principalMinor: 5 }), TODAY).uid);
  ok(depositEvent(dep({ id: 'other' }), TODAY).uid !== depositEvent(dep(), TODAY).uid);
});
test('overdue deposit: "scadent" title, today as the date, a single alarm at the time', () => {
  const e = depositEvent(dep({ maturity: '2026-10-10' }), TODAY);
  eq(e.title, 'Depozit scadent — prelungește sau închide: Banca · Titular'); eq(e.date, TODAY); eq(e.alarms, ['PT0S']);
  ok(e.description.includes('Scadența a trecut'));
});
test('special characters in bank or owner names stay valid (comma, semicolon)', () => {
  const ics = unfold(buildIcs([depositEvent(dep({ institution: 'Banca, Mare; SA' }), TODAY)], NOW));
  ok(ics.includes('SUMMARY:Scade depozitul Banca\\, Mare\\; SA'));
  ok(!ics.split('\r\n').some((l) => l.startsWith('SUMMARY:') && /[^\\][,;]/.test(l.slice(8))));
});
test('monthly balances .ics: recurring on day 15 at 09:00, alarm at the time, the path in the description', () => {
  const e = balancesEvent('2026-10-20');
  eq(e.date, '2026-11-15'); eq(e.rrule, 'FREQ=MONTHLY;BYMONTHDAY=15'); eq(e.alarms, ['PT0S']);
  const lines = buildIcs([e], NOW).split('\r\n');
  ok(lines.includes('RRULE:FREQ=MONTHLY;BYMONTHDAY=15') && lines.includes('DTSTART:20261115T090000') && lines.includes('TRIGGER:PT0S'));
  ok(lines.includes('UID:fam-solduri@familie-app') && lines.includes('SUMMARY:Actualizează soldurile'));
  ok(unfold(buildIcs([e], NOW)).includes('Active → Venituri și cheltuieli'));
  eq(lines.filter((l) => l === 'BEGIN:VALARM').length, 1);
});
test('nextDay15: this month before the 15th (or the 15th before 09:00), else next month, across the year end', () => {
  eq(nextDay15('2026-10-05'), '2026-10-15'); eq(nextDay15('2026-10-15', 8), '2026-10-15'); eq(nextDay15('2026-10-15', 9), '2026-11-15');
  eq(nextDay15('2026-12-20'), '2027-01-15');
});
test('Google Calendar link: template with text, dates, details, ctz (and recur for the monthly one)', () => {
  const u = new URL(googleCalendarUrl(depositEvent(dep(), TODAY)));
  eq(u.origin + u.pathname, 'https://calendar.google.com/calendar/render');
  eq(u.searchParams.get('action'), 'TEMPLATE'); eq(u.searchParams.get('text'), 'Scade depozitul Banca · Titular');
  eq(u.searchParams.get('dates'), '20261016T090000/20261016T093000'); eq(u.searchParams.get('ctz'), 'Europe/Bucharest');
  ok(u.searchParams.get('details').includes('Sumă: 10.273,10 RON')); eq(u.searchParams.get('recur'), null);
  eq(new URL(googleCalendarUrl(balancesEvent('2026-10-20'))).searchParams.get('recur'), 'RRULE:FREQ=MONTHLY;BYMONTHDAY=15');
});
test('file names', () => { eq(icsFileName(depositEvent(dep(), TODAY)), 'scadenta-depozit.ics'); eq(icsFileName(balancesEvent(TODAY)), 'memento-solduri.ics'); });
