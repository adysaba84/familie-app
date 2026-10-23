// Pure logic of the "Conturi · administrare" screen: which kinds can be added, how a new account is named and
// validated, and how the existing ones are grouped by section. No I/O here (tested in tests/accounts-admin.test.js).

// Pensions are left out on purpose: whether one is sellable (Gent) or locked (Piloni) is decided by its institution
// in situations.js, so adding them needs that rule extended first.
export const KIND_OPTIONS = [
  { kind: 'broker', label: 'Bursă (broker)', hint: 'ex. XTB, Tradeville' },
  { kind: 'deposit_bank', label: 'Bancă pentru depozite', hint: 'ex. BT, Salt' },
  { kind: 'current', label: 'Cont curent / card', hint: 'ex. BT, Revolut' },
  { kind: 'savings', label: 'Economii', hint: 'ex. BT, Economii' },
  { kind: 'voucher', label: 'Tichete', hint: 'ex. Edenred' },
  { kind: 'wallet', label: 'Portofel', hint: 'ex. Portofel' },
  { kind: 'safe', label: 'Seif', hint: 'ex. Seif' },
  { kind: 'insurance', label: 'Asigurare', hint: 'ex. NN' },
  { kind: 'loan', label: 'Împrumut dat', hint: 'ex. numele datornicului' },
  { kind: 'card', label: 'Card de credit', hint: 'ex. BT' },
];
export const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((k) => [k.kind, k.label]));
export const ADMIN_CURRENCIES = ['RON', 'EUR', 'USD'];

const live = (a) => !a.void;

// "XTB · Iza"; wallets also carry the currency ("Portofel · Iza · EUR") since one person has one per currency.
export function accountName(kind, institution, owner, currency) {
  const base = `${institution} · ${owner}`;
  return kind === 'wallet' ? `${base} · ${currency}` : base;
}

// Validates the form and returns { fields } ready for app.add(space, 'accounts', fields), or { error }.
export function buildAccount(model, f) {
  const institution = (f.institution || '').trim();
  const owner = (f.owner || '').trim();
  const kind = f.kind;
  if (!KIND_LABEL[kind]) return { error: 'Alege tipul contului.' };
  if (!institution) return { error: 'Scrie instituția (ex. XTB).' };
  if (!owner) return { error: 'Alege titularul.' };
  if (!ADMIN_CURRENCIES.includes(f.currency)) return { error: 'Alege moneda.' };
  const name = (f.name || '').trim() || accountName(kind, institution, owner, f.currency);
  const clash = model.accounts.some((a) => live(a) && a.status !== 'closed' && a.name.trim().toLowerCase() === name.toLowerCase());
  if (clash) return { error: `Există deja un cont „${name}”. Schimbă numele sau instituția.` };
  return { fields: { kind, institution, owner, name, currency_default: f.currency, status: 'active', note: (f.note || '').trim() } };
}

// Existing accounts grouped by kind, in the order of KIND_OPTIONS, then any kind not in the list (e.g. pension) last.
export function groupAccounts(model) {
  const groups = new Map(KIND_OPTIONS.map((k) => [k.kind, { kind: k.kind, label: k.label, items: [] }]));
  for (const a of model.accounts.filter(live)) {
    if (!groups.has(a.kind)) groups.set(a.kind, { kind: a.kind, label: a.kind, items: [] });
    groups.get(a.kind).items.push(a);
  }
  return [...groups.values()].filter((g) => g.items.length > 0);
}

// Owners already present in the space, so a new account is offered the same people (no free typos).
export const ownersOf = (model) => [...new Set(model.accounts.filter(live).map((a) => a.owner).filter(Boolean))];
