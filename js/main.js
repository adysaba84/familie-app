import { CLIENT_ID } from './config.js';
import { h, mount } from './dom.js';
import { gisReady, signIn, trySilentSignIn, signOut, currentEmail, isSignedIn } from './auth.js';
import { pickSpreadsheets } from './picker.js';
import { createSpreadsheet } from './sheets.js';
import { FILE_NAMES } from './schema.js';
import { resolveRole } from './files.js';
import { createApp } from './app.js';
import { createRouter } from './router.js';
import { SCREENS } from './screens.js';
import { loginView } from './views/login.js';
import { setupView } from './views/setup.js';
import { kidView } from './views/kid.js';

let files = null; // {parents, iza, role} once resolved
let app = null;

function logout() {
  signOut();
  files = null;
  app = null;
  document.getElementById('app').classList.remove('kid');
  location.hash = '#/';
  router.render();
}

// Called once we know which files this person can open.
function ready(resolved) {
  files = resolved;
  app = createApp({ files, email: currentEmail() });
  app.go = (path) => router.go(path);
  app.rerender = () => router.render();
  app.logout = logout;
  router.go(files.role ? '/active' : '/setup');
}

async function doSignIn() {
  try {
    await signIn();
    ready(await resolveRole());
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
        const r = await resolveRole();
        if (r.role) ready(r);
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
        ready(await resolveRole());
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

const routes = {
  '/': guard(() => router.go(files && files.role ? '/active' : '/setup')),
  '/setup': guard(() => (files && files.role === 'kid' ? router.go('/active') : showSetup())), // Iza goes straight to her screen
};
for (const [path, view] of Object.entries(SCREENS)) {
  routes[path] = guard(() => {
    if (!app || !files.role) return router.go('/setup');
    if (files.role === 'kid') return kidView(app);
    return view(app);
  });
}
const router = createRouter(routes, '/');

function start() {
  if (!CLIENT_ID) { mount(h('p', { class: 'err' }, 'Lipsește CLIENT_ID în js/config.js')); return; }
  if (!gisReady()) { setTimeout(start, 100); return; }
  trySilentSignIn().then(async (who) => {
    if (who) {
      try { ready(await resolveRole()); return; } catch { /* fall through to login */ }
    }
    router.render();
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('load', start);
