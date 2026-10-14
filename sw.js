// Caches the app shell only. Never touches cross-origin requests, so no Google API
// response (i.e. no financial data) is ever stored on the device.
const CACHE = 'fa-shell-v7';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/dom.js', 'js/auth.js', 'js/picker.js', 'js/sheets.js',
  'js/schema.js', 'js/files.js', 'js/router.js', 'js/money.js', 'js/model.js', 'js/calc.js', 'js/store.js',
  'js/app.js', 'js/seed.js', 'js/iza-plan.js', 'js/situations.js', 'js/ui.js', 'js/charts.js', 'js/screens.js',
  'js/views/login.js', 'js/views/setup.js', 'js/views/kid.js', 'js/views/active.js', 'js/views/bursa.js',
  'js/views/bursa-nou.js', 'js/views/bursa-valoare.js', 'js/views/curs.js', 'js/views/mai-mult.js', 'js/views/situatii.js',
  'js/views/depozite.js', 'js/views/depozit-nou.js', 'js/views/fizice.js', 'js/views/fizice-nou.js', 'js/views/conturi.js', 'js/views/solduri.js', 'js/views/obligatii.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive immediately), cache as the offline fallback.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }) // revalidate with the server every time: GitHub Pages lets browsers keep files for 10 minutes
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
