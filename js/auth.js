import { CLIENT_ID } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// The token lives in these variables only: never localStorage, sessionStorage, cookies or URLs.
let token = null;
let expiresAt = 0;
let email = null;
let client = null;

function ensureClient() {
  if (client) return client;
  client = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE, callback: () => {} });
  return client;
}

function request(prompt = '', hint = '') {
  const c = ensureClient();
  return new Promise((resolve, reject) => {
    c.callback = (r) => {
      if (r.error) { reject(new Error(r.error)); return; }
      token = r.access_token;
      expiresAt = Date.now() + (Number(r.expires_in) - 60) * 1000;
      resolve(token);
    };
    c.error_callback = (e) => reject(new Error(e.type || 'popup_failed'));
    c.requestAccessToken(hint ? { prompt, hint } : { prompt });
  });
}

export function gisReady() {
  return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
}

const HINT = 'fa.hint'; // the email only (not secret); never the token
export function rememberedEmail() {
  try { return localStorage.getItem(HINT) || ''; } catch { return ''; }
}

async function finishSignIn() {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + token },
  });
  email = (await r.json()).email || null;
  try { if (email) localStorage.setItem(HINT, email); } catch { /* ignore */ }
  return email;
}

// Silent re-login at app start: works when the Google session lives and consent was given.
export async function trySilentSignIn() {
  const hint = rememberedEmail();
  if (!hint) return null;
  try { await request('none', hint); return await finishSignIn(); } catch { return null; }
}

export async function signIn() {
  await request('', rememberedEmail());
  return finishSignIn();
}

// Returns a valid token, refreshing it (about hourly) while the Google session lives.
export async function getToken() {
  if (token && Date.now() < expiresAt) return token;
  return request();
}

export const currentEmail = () => email;
export const isSignedIn = () => token !== null;

export function signOut() {
  if (token) google.accounts.oauth2.revoke(token, () => {});
  token = null; expiresAt = 0; email = null;
  try { localStorage.removeItem(HINT); } catch { /* ignore */ } // explicit sign-out: no auto-login next time
}
