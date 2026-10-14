import { CLIENT_ID } from './config.js';

const app = document.getElementById('app');

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids) el.append(kid);
  return el;
}

function show(...nodes) { app.replaceChildren(...nodes); }

// M0 smoke test: sign in with Google (drive.file only) and show which account got in.
// The token stays in this variable only, never in storage.
let token = null;

function signIn() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
    callback: async (resp) => {
      if (resp.error) { show(h('p', { class: 'err' }, 'Autentificare eșuată: ' + resp.error)); return; }
      token = resp.access_token;
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } });
      const u = await r.json();
      show(h('div', { class: 'card' }, h('p', {}, 'Conectat ca ' + u.email), h('button', { onclick: signOut }, 'Ieșire')));
    },
  });
  client.requestAccessToken();
}

function signOut() {
  if (token) google.accounts.oauth2.revoke(token, () => {});
  token = null;
  start();
}

function start() {
  if (!CLIENT_ID) { show(h('p', { class: 'err' }, 'Lipsește CLIENT_ID în js/config.js')); return; }
  show(h('h1', {}, 'Finanțe'), h('button', { onclick: signIn }, 'Intră cu Google'));
}

window.addEventListener('load', start);
