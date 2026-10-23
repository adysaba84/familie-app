import { loadModel, addRecord, addRecords, voidRecord, setAccountStatus } from './store.js';
import { SEED } from './seed.js';


// The data layer the screens talk to. Screens never call Google directly, so a test page can swap
// this for an in-memory version (tests/preview.js).
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function createApp({ files, email }) {
  const cache = {};
  const spaces = ['parents', 'iza'].filter((s) => files[s]);
  const app = {
    email, spaces, space: spaces[0], today: todayIso,
    canEdit: (s = app.space) => !!(files[s] && files[s].canEdit),
    async model(s = app.space) {
      if (!cache[s]) cache[s] = await loadModel(files[s].id, s);
      return cache[s];
    },
    // Edits are void + append, so the model is simply reloaded after any write.
    async add(s, tab, fields, summary, opts) { const r = await addRecord(files[s].id, tab, fields, summary, opts); delete cache[s]; return r; },
    async addMany(s, tab, list, summary) { const r = await addRecords(files[s].id, tab, list, summary); delete cache[s]; return r; },
    async void(s, tab, rec, reason) { await voidRecord(files[s].id, tab, rec, reason); delete cache[s]; },
    async setAccountStatus(s, rec, status) { await setAccountStatus(files[s].id, rec, status); delete cache[s]; },
    async seedAccounts(s) { await app.addMany(s, 'accounts', SEED[s], 'cont inițial'); },
    // Manual BNR fallback until the Apps Script job fills the rates tab: written to every file we can edit.
    async addRate(date, rates) {
      for (const s of spaces) if (app.canEdit(s)) await app.add(s, 'rates', { date, ...rates, source: 'manual' }, 'curs ' + date);
    },
  };
  return app;
}
