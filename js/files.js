import { listAppSpreadsheets } from './sheets.js';
import { FILE_NAMES } from './schema.js';

// Role is decided by Google, not by the app: we look at which of the two files this person's
// token can reach (nothing is remembered on the device).
//   can open Părinți -> 'parent'
//   can only open Iza -> 'kid'   (the UI is cosmetic; Google enforces read-only on the file)
//   neither           -> null    (needs the one-time Picker)
export async function resolveRole() {
  const list = await listAppSpreadsheets();
  const find = (name) => {
    const f = list.find((x) => x.name === name);
    return f ? { id: f.id, name: f.name, canEdit: !!(f.capabilities && f.capabilities.canEdit) } : null;
  };
  const out = { parents: find(FILE_NAMES.parents), iza: find(FILE_NAMES.iza), role: null };
  if (out.parents) out.role = 'parent';
  else if (out.iza) out.role = 'kid';
  return out;
}
