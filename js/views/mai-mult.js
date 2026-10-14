import { h } from '../dom.js';
import { SPACE_LABEL } from '../schema.js';
import { frame } from '../ui.js';

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
        h('a', { class: 'listrow', href: '#/situatii', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Situații'), h('span', { class: 'xs muted' }, 'disponibil, wealth, față de luna trecută sau de început de an')), h('span', {}, '›')),
        h('a', { class: 'listrow', href: '#/obligatii', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Pensii și datorii'), h('span', { class: 'xs muted' }, 'pensii, împrumuturi date, carduri de credit')), h('span', {}, '›')),
        app.spaces.includes('iza') ? h('a', { class: 'listrow', href: '#/iza', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Vezi ca Iza'), h('span', { class: 'xs muted' }, 'ecranul ei, doar de citire')), h('span', {}, '›')) : null,
        h('a', { class: 'listrow', href: '#/curs', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Curs BNR'), h('span', { class: 'xs muted' }, 'introdu cursul manual')), h('span', {}, '›')),
        h('a', { class: 'listrow', href: '#/setup', style: 'grid-template-columns:1fr 20px' }, h('span', { class: 'nm' }, h('b', {}, 'Alege fișierele'), h('span', { class: 'xs muted' }, 'dacă lipsește vreun fișier')), h('span', {}, '›'))),
      h('div', { class: 'savebar' }, h('button', { class: 'secondary', style: 'width:100%', onclick: () => app.logout() }, 'Ieșire')),
    ],
  });
}
