import { h } from '../dom.js';
import { SPACE_LABEL } from '../schema.js';
import { frame, icon } from '../ui.js';
import { downloadBalancesReminder, balancesReminderLink } from '../notify.js';

export async function maiMultView(app) {
  frame(app, {
    tab: 'more',
    head: h('header', { class: 'pagehead' }, h('div', { class: 't' }, h('b', {}, 'Mai mult'), h('span', { class: 'sm muted' }, app.email))),
    body: [
      h('section', { class: 'panel' },
        h('span', { class: 'up' }, 'Fișiere'),
        ...['parents', 'iza'].map((s) => h('div', { class: 'between sm' }, h('span', {}, 'FIN · ' + SPACE_LABEL[s]),
          h('span', { class: 'muted' }, app.spaces.includes(s) ? (app.canEdit(s) ? 'editor' : 'doar citire') : 'fără acces')))),
      h('section', { class: 'panel flush' },
        h('a', { class: 'listrow', href: '#/investit', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Sume investite'), h('span', { class: 'xs muted' }, 'cât ați băgat la bursă și în depozite, nu cât valorează')), h('span', {}, '›')),
        app.spaces.includes('iza') ? h('a', { class: 'listrow', href: '#/primite', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Primite'), h('span', { class: 'xs muted' }, 'istoric: cine a dat, când, cât și de ce')), h('span', {}, '›')) : null,
        h('a', { class: 'listrow', href: '#/obligatii', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Pensii și datornici'), h('span', { class: 'xs muted' }, 'pensii, datornici (împrumuturi date), carduri de credit')), h('span', {}, '›')),
        app.spaces.includes('iza') ? h('a', { class: 'listrow', href: '#/iza', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Vezi ca Iza'), h('span', { class: 'xs muted' }, 'ecranul ei, doar de citire')), h('span', {}, '›')) : null,
        h('a', { class: 'listrow', href: '#/conturi/admin', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Administrare conturi'), h('span', { class: 'xs muted' }, 'adaugă, închide sau redeschide conturi (bursă, bănci, portofele…)')), h('span', {}, '›')),
        h('a', { class: 'listrow', href: '#/curs', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Curs BNR'), h('span', { class: 'xs muted' }, 'introdu cursul manual')), h('span', {}, '›')),
        h('a', { class: 'listrow', href: '#/setup', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Alege fișierele'), h('span', { class: 'xs muted' }, 'dacă lipsește vreun fișier')), h('span', {}, '›'))),
      h('section', { class: 'panel', style: 'gap:8px' },
        h('span', { class: 'up' }, 'Memento lunar: soldurile'),
        h('span', { class: 'sm' }, 'O singură dată, în Google Calendar:'),
        h('ol', { class: 'xs', style: 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px' },
          h('li', {}, 'Creează un eveniment cu titlul „Actualizează soldurile”.'),
          h('li', {}, 'Repetă-l lunar, în ziua 15, la 09:00.'),
          h('li', {}, 'Adaugă o notificare la ora evenimentului.'),
          h('li', {}, 'Adaugă invitați: Carmen și Iza.')),
        h('span', { class: 'xs muted' }, 'Sau apasă butonul: se descarcă un eveniment recurent (ziua 15, 09:00, alarmă la oră) pe care îl deschizi în Calendar. Invitații nu se pot pune din fișier: îi adaugi tu din Calendar, deschizând evenimentul.'),
        h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
          h('button', { type: 'button', style: 'min-height:44px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;font-size:13px', onclick: () => downloadBalancesReminder(app.today(), new Date().getHours()) }, icon('bell', 18, 1.9), 'Adaugă memento lunar în Calendar'),
          h('a', { href: balancesReminderLink(app.today(), new Date().getHours()), target: '_blank', rel: 'noopener', class: 'xs', style: 'color:var(--accent)' }, 'deschide în Google Calendar ›')),
        h('span', { class: 'xs muted' }, 'Dacă apare de două ori în Calendar, șterge unul: aplicația nu poate vedea ce ai deja.')),
      h('div', { class: 'savebar' }, h('button', { class: 'secondary', style: 'width:100%', onclick: () => app.logout() }, 'Ieșire')),
    ],
  });
}
