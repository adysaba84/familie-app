import { test, ok } from './harness.js';

// Source files shipped to the browser (the service worker's shell list is the master list).
async function sourceFiles() {
  const sw = await (await fetch('../sw.js')).text();
  const shell = [...sw.matchAll(/'((?:js|css)\/[^']+|index\.html|sw\.js)'/g)].map((m) => m[1]);
  return ['sw.js', ...new Set(shell)].filter((f) => /\.(js|html)$/.test(f));
}

const BANNED = [
  [/\binnerHTML\b/, 'innerHTML'], [/\bouterHTML\b/, 'outerHTML'], [/insertAdjacentHTML/, 'insertAdjacentHTML'],
  [/document\.write/, 'document.write'], [/\beval\s*\(/, 'eval('], [/new\s+Function\b/, 'new Function'],
  [/\blocalStorage\.setItem\([^)]*token/i, 'token in localStorage'], [/sessionStorage/, 'sessionStorage'],
  [/document\.cookie/, 'document.cookie'],
];

test('no banned APIs in any shipped source file', async () => {
  const files = await sourceFiles();
  ok(files.length > 10, 'file list looks too short: ' + files.length);
  for (const f of files) {
    const raw = await (await fetch('../' + f)).text();
    // comments may mention the banned names (e.g. "never sessionStorage"); only code counts
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const [re, name] of BANNED) ok(!re.test(text), `${name} found in ${f}`);
  }
});

test('every file in the service worker shell list exists', async () => {
  const sw = await (await fetch('../sw.js')).text();
  const list = [...sw.matchAll(/'([^']+\.(?:js|css|png|html|webmanifest))'/g)].map((m) => m[1]);
  for (const f of list) ok((await fetch('../' + f)).ok, 'missing ' + f);
});

test('index.html has the CSP meta and no inline script', async () => {
  const html = await (await fetch('../index.html')).text();
  ok(/Content-Security-Policy/.test(html), 'no CSP meta');
  ok(/default-src 'self'/.test(html), "default-src 'self' missing");
  ok(!/unsafe-eval/.test(html), 'unsafe-eval present');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'inline <script> found');
});

test('the service worker never caches cross-origin requests', async () => {
  const sw = await (await fetch('../sw.js')).text();
  ok(/origin\s*!==\s*self\.location\.origin/.test(sw), 'cross-origin guard missing');
});

test('the token is never written to storage', async () => {
  const auth = await (await fetch('../js/auth.js')).text();
  ok(!/setItem\([^)]*(token|access)/i.test(auth), 'token stored');
  ok(/localStorage\.setItem\(HINT, email\)/.test(auth), 'only the email hint should be stored');
});
