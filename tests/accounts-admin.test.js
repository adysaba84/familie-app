import { test, eq, ok } from './harness.js';
import { accountName, buildAccount, groupAccounts, ownersOf } from '../js/accounts-admin.js';

const model = { accounts: [
  { id: 'a', kind: 'broker', institution: 'XTB', owner: 'Ana', name: 'XTB · Ana', currency_default: 'RON', status: 'active', void: false },
  { id: 'b', kind: 'wallet', institution: 'Portofel', owner: 'Ana', name: 'Portofel · Ana · RON', currency_default: 'RON', status: 'closed', void: false },
  { id: 'c', kind: 'pension', institution: 'Pilon', owner: 'Ben', name: 'Pilon · Ben', currency_default: 'RON', status: 'active', void: false },
  { id: 'd', kind: 'broker', institution: 'Old', owner: 'Ben', name: 'Old · Ben', currency_default: 'RON', status: 'active', void: true },
] };

test('accountName: wallets carry the currency, others do not', () => {
  eq(accountName('broker', 'XTB', 'Ana', 'RON'), 'XTB · Ana');
  eq(accountName('wallet', 'Portofel', 'Ana', 'EUR'), 'Portofel · Ana · EUR');
});

test('buildAccount: valid form gives the row fields, trimmed, status active', () => {
  const r = buildAccount(model, { kind: 'broker', institution: ' Tradeville ', owner: 'Ana', currency: 'EUR', note: ' x ' });
  eq(r.fields, { kind: 'broker', institution: 'Tradeville', owner: 'Ana', name: 'Tradeville · Ana', currency_default: 'EUR', status: 'active', note: 'x' });
});

test('buildAccount: a custom name wins over the generated one', () => {
  eq(buildAccount(model, { kind: 'savings', institution: 'BT', owner: 'Ana', currency: 'RON', name: 'Economii mari' }).fields.name, 'Economii mari');
});

test('buildAccount: missing or invalid fields are refused', () => {
  ok(buildAccount(model, { kind: 'nope', institution: 'X', owner: 'Ana', currency: 'RON' }).error);
  ok(buildAccount(model, { kind: 'broker', institution: ' ', owner: 'Ana', currency: 'RON' }).error);
  ok(buildAccount(model, { kind: 'broker', institution: 'X', owner: '', currency: 'RON' }).error);
  ok(buildAccount(model, { kind: 'broker', institution: 'X', owner: 'Ana', currency: 'GBP' }).error);
  ok(buildAccount(model, { kind: 'pension', institution: 'X', owner: 'Ana', currency: 'RON' }).error, 'pension is not addable here');
});

test('buildAccount: duplicate name refused (case-insensitive) unless the old one is closed or void', () => {
  ok(buildAccount(model, { kind: 'broker', institution: 'xtb', owner: 'ana', currency: 'RON' }).error);
  ok(buildAccount(model, { kind: 'wallet', institution: 'Portofel', owner: 'Ana', currency: 'RON' }).fields, 'closed account frees the name');
  ok(buildAccount(model, { kind: 'broker', institution: 'Old', owner: 'Ben', currency: 'RON' }).fields, 'void account frees the name');
});

test('groupAccounts: by kind in menu order, void hidden, unknown kinds last', () => {
  eq(groupAccounts(model).map((g) => [g.kind, g.items.map((i) => i.id)]), [['broker', ['a']], ['wallet', ['b']], ['pension', ['c']]]);
});

test('ownersOf: distinct owners of live accounts', () => { eq(ownersOf(model), ['Ana', 'Ben']); });
