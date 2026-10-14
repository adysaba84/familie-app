import { fileAccess, ApiError } from './sheets.js';

// Spreadsheet IDs are not secret (useless without Google permission), so they may be remembered
// on the device. The token never is.
const KEY = 'fa.files';

export function loadIds() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function saveIds(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* private mode: just ask again next time */ }
}

export function clearIds() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Role is decided by Google, not by the app: we try to open the files with the user's token.
//   can open Părinți -> 'parent'
//   can only open Iza -> 'kid'   (the UI is cosmetic; Google enforces read-only on the file)
//   neither           -> null    (needs setup / Picker)
export async function resolveRole() {
  const ids = loadIds();
  const out = { parents: null, iza: null, role: null };
  for (const space of ['parents', 'iza']) {
    if (!ids[space]) continue;
    try {
      const f = await fileAccess(ids[space]);
      out[space] = { id: f.id, name: f.name, canEdit: !!(f.capabilities && f.capabilities.canEdit) };
    } catch (e) {
      if (!(e instanceof ApiError) || ![403, 404].includes(e.status)) throw e;
    }
  }
  if (out.parents) out.role = 'parent';
  else if (out.iza) out.role = 'kid';
  return out;
}
