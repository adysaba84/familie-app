import { CLIENT_ID } from './config.js';
import { h, mount } from './dom.js';
import { gisReady, signIn, trySilentSignIn, signOut, currentEmail, isSignedIn } from './auth.js';
import { pickSpreadsheets } from './picker.js';
import { createSpreadsheet } from './sheets.js';
import { FILE_NAMES } from './schema.js';
import { resolveRole } from './files.js';
import { createRouter } from './router.js';
import { loginView } from './views/login.js';
import { setupView } from './views/setup.js';
import { homeView } from './views/home.js';
import { kidView } from './views/kid.js';

let files = null; // {parents, iza, role} once resolved

function logout() {
  signOut();
  files = null;
  document.getElementById('app').classList.remove('kid');
  location.hash = '#/';
  router.render();
}

async function doSignIn() {
  try {
    await signIn();
    files = await resolveRole();
    router.go(files.role ? '/active' : '/setup');
  } catch (e) {
    loginView({ onSignIn: doSignIn, error: 'Autentificarea a eșuat. Încearcă din nou.' });
  }
}

function showSetup(message, busy = false) {
  setupView({
    email: currentEmail(),
    busy,
    message,
    onSignOut: logout,
    onPick: async () => {
      showSetup({ text: 'Se deschide Google Drive…' }, true);
      try {
        await pickSpreadsheets(); // picking grants access; the files are then found by name
        files = await resolveRole();
        if (files.role) router.go('/active');
        else showSetup({ error: true, text: 'Nu am găsit fișierele „FIN · …” în alegerea ta.' });
      } catch (e) {
        showSetup({ error: true, text: 'Nu am putut deschide selectorul de fișiere.' });
      }
    },
    onCreate: async () => {
      showSetup({ text: 'Se creează fișierele…' }, true);
      try {
        await createSpreadsheet(FILE_NAMES.parents);
        await createSpreadsheet(FILE_NAMES.iza);
        files = await resolveRole();
        router.go('/active');
      } catch (e) {
        showSetup({ error: true, text: 'Crearea fișierelor a eșuat.' });
      }
    },
  });
}

// Every route first checks the session; Google decides the role (files.role), the UI just follows it.
const guard = (fn) => () => {
  if (!isSignedIn()) return loginView({ onSignIn: doSignIn });
  return fn();
};

const router = createRouter({
  '/': guard(() => router.go(files && files.role ? '/active' : '/setup')),
  '/setup': guard(() => showSetup()),
  '/active': guard(() => {
    if (!files || !files.role) return router.go('/setup');
    if (files.role === 'kid') return kidView({ email: currentEmail(), onSignOut: logout });
    return homeView({ email: currentEmail(), files, onSignOut: logout, onPickMore: () => router.go('/setup') });
  }),
}, '/');

function start() {
  if (!CLIENT_ID) { mount(h('p', { class: 'err' }, 'Lipsește CLIENT_ID în js/config.js')); return; }
  if (!gisReady()) { setTimeout(start, 100); return; }
  trySilentSignIn().then(async (who) => {
    if (who) {
      try { files = await resolveRole(); router.go(files.role ? '/active' : '/setup'); return; } catch { /* fall through to login */ }
    }
    router.render();
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('load', start);
