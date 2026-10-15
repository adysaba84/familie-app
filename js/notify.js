import { h } from './dom.js';
import { icon } from './ui.js';
import { buildIcs, depositEvent, balancesEvent, googleCalendarUrl, icsFileName } from './ics.js';

// "Notificare": a calendar event for a deposit maturity, with no server and no script. Main button = a generated .ics file
// (two alarms: 3 days before and at the time; on a phone it opens in the Calendar app), small link = Google Calendar
// template (no alarms can be set from a link: the calendar's default notifications apply).
const NOTE = 'Alarmele (3 zile înainte și la oră) vin odată cu fișierul. Dacă nu se deschide, folosește linkul Google Calendar și setează alarma în Calendar. '
  + 'Evenimentul vechi din Calendar se șterge de mână după închiderea sau prelungirea depozitului.';

export function downloadIcs(event, now = new Date()) {
  const blob = new Blob([buildIcs([event], now)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = icsFileName(event);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

// the plain deposit object ics.js expects, from a deposits row and its bank account
export const depositInput = (d, account) => ({
  id: d.id, institution: account ? account.institution : '', owner: account ? account.owner : '', currency: d.currency,
  principalMinor: d.principal_minor, rateBp: d.rate_bp, maturity: d.maturity_date,
});

const BTN = 'min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 14px;font-size:13px;white-space:nowrap';

// The button (bell icon + short text) for one deposit.
export function notifyButton(dep, today, { primary = false } = {}) {
  const ev = depositEvent(dep, today);
  return h('button', { type: 'button', class: primary ? '' : 'secondary', style: BTN, 'aria-label': 'Adaugă notificare în Calendar', onclick: () => downloadIcs(ev) }, icon('bell', 18, 1.9), 'Notificare');
}
export function googleLink(dep, today) {
  return h('a', { href: googleCalendarUrl(depositEvent(dep, today)), target: '_blank', rel: 'noopener', class: 'xs', style: 'color:var(--accent);padding:4px 2px' }, 'deschide în Google Calendar ›');
}
// button + small link + the note, for a deposit's expanded row
export function notifyControls(dep, today) {
  return h('div', { style: 'display:flex;flex-direction:column;gap:4px;align-items:flex-start' },
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' }, notifyButton(dep, today), googleLink(dep, today)),
    h('span', { class: 'xs muted' }, NOTE));
}

// ---- the suggestion after saving a new deposit or a rollover: optional, one tap to ignore ----
let suggestion = null;
export const suggest = (dep) => { suggestion = dep; };
export function notifyBanner(app) {
  if (!suggestion) return null;
  const dep = suggestion, today = app.today();
  const close = () => { suggestion = null; app.rerender(); };
  return h('section', { class: 'panel', style: 'gap:6px;border:1px solid var(--accent)' },
    h('div', { class: 'between' }, h('b', { style: 'font-size:14px' }, 'Adaugă notificare în Calendar?'),
      h('button', { type: 'button', class: 'secondary', 'aria-label': 'Ignoră', style: 'min-height:44px;width:44px;padding:0;border:0', onclick: close }, icon('close', 18, 2))),
    h('span', { class: 'xs muted' }, `Scade depozitul ${dep.institution}${dep.owner ? ' · ' + dep.owner : ''}, ${dep.maturity}.`),
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
      h('button', { type: 'button', style: BTN, onclick: () => downloadIcs(depositEvent(dep, today)) }, icon('bell', 18, 1.9), 'Notificare'), googleLink(dep, today)),
    h('span', { class: 'xs muted' }, NOTE));
}
// leaving for another part of the app drops the suggestion (it only follows the save, on Active / Depozite)
window.addEventListener('hashchange', () => {
  const p = location.hash.slice(1).split('?')[0];
  if (suggestion && !['/active', '/depozite'].includes(p)) suggestion = null;
});

// ---- the monthly "update the balances" reminder (recurring .ics) ----
export const downloadBalancesReminder = (today, hourNow) => downloadIcs(balancesEvent(today, hourNow));
export const balancesReminderLink = (today, hourNow) => googleCalendarUrl(balancesEvent(today, hourNow));
