import { test, eq, ok } from './harness.js';
import { situation, combine, comparisonDates, historyStart, snapshotRows, LAYERS, eurGrowth } from '../js/situations.js';

// Invented family (round numbers): EUR = 5 RON, USD = 4 RON.
const rates = [{ date: '2026-01-01', EUR: 50000, USD: 40000 }];
const acc = (id, kind, ccy = 'RON') => ({ id, kind, institution: 'X', owner: 'Y', name: id, currency_default: ccy, status: 'active' });
const model = {
  accounts: [acc('cur', 'current'), acc('wal', 'wallet', 'EUR'), acc('sav', 'savings'), acc('ins', 'insurance'), acc('card', 'card'),
    acc('pen', 'pension'), { ...acc('gent', 'pension'), institution: 'Gent' }, acc('loan', 'loan', 'EUR'), acc('tv', 'broker')],
  settings: [{ key: 'card_limit:card', value: '100000' }],
  rates,
  balances: [
    { account_id: 'cur', date: '2026-09-30', balance_minor: 100000 }, { account_id: 'wal', date: '2026-09-30', balance_minor: 20000 },
    { account_id: 'sav', date: '2026-09-30', balance_minor: 50000 }, { account_id: 'ins', date: '2026-09-30', balance_minor: 200000 },
    { account_id: 'card', date: '2026-09-30', balance_minor: 80000 }, { account_id: 'pen', date: '2026-09-30', balance_minor: 1000000 }, { account_id: 'gent', date: '2026-09-30', balance_minor: 30000 },
    { account_id: 'loan', date: '2026-09-30', balance_minor: 10000 },
  ],
  deposits: [
    { id: 'd1', account_id: 'sav', currency: 'RON', principal_minor: 100000, status: 'active', start_date: '2026-01-01', maturity_date: '2027-01-01' },
    { id: 'd2', account_id: 'sav', currency: 'USD', principal_minor: 10000, status: 'active', start_date: '2026-01-01', maturity_date: '2027-01-01' },
    { id: 'd3', account_id: 'sav', currency: 'RON', principal_minor: 999, status: 'active', start_date: '2026-01-01', maturity_date: '2027-01-01', void: true },
  ],
  physical_items: [
    { id: 'g', kind: 'gold', currency: 'RON', purchase_value_minor: 400000, purchase_date: '2026-01-01' },
    { id: 'c', kind: 'cash', currency: 'EUR', purchase_date: '2026-01-01' },
    { id: 'h', kind: 'property', currency: 'EUR', purchase_date: '2026-01-01' },
    { id: 'car', kind: 'vehicle', currency: 'EUR', purchase_date: '2026-01-01' },
  ],
  physical_values: [
    { item_id: 'g', date: '2026-09-30', value_minor: 500000 }, { item_id: 'c', date: '2026-09-30', value_minor: 10000 },
    { item_id: 'h', date: '2026-09-30', value_minor: 2000000 }, { item_id: 'car', date: '2026-09-30', value_minor: 500000 },
  ],
  broker_flows: [], broker_values: [{ date: '2026-09-30', account_id: 'tv', currency: 'RON', instrument: 'stocks_etf', value_minor: 300000 }],
};
const line = (layer, key) => layer.lines.find((l) => l.key === key).ron;

test('situation: DISPONIBIL is cash only (accounts, wallets, savings, deposits, safe cash, insurance, cards net)', () => {
  const s = situation(model, '2026-10-14');
  eq(line(s.disponibil, 'conturi'), 200000); // 1.000 lei + wallet 200 euro
  eq(line(s.disponibil, 'economii'), 50000);
  eq(line(s.disponibil, 'depozite'), 140000); // 1.000 lei + 100 USD (void one left out)
  eq(line(s.disponibil, 'seif'), 50000); // 100 euro
  eq(line(s.disponibil, 'asigurari'), 200000);
  eq(line(s.disponibil, 'carduri'), -20000); // 800 left of a 1.000 limit: 200 spent
  eq(s.disponibil.total, 620000);
});
test('situation: disponibil keeps the native amount per currency', () => {
  const n = situation(model, '2026-10-14').disponibil.native;
  eq(n.RON, 430000); eq(n.EUR, 30000); eq(n.USD, 10000);
});
test('situation: PENSII = sellable (broker, gold, Gent) + locked pillars, never in disponibil', () => {
  const s = situation(model, '2026-10-14');
  eq(line(s.pensii, 'bursa'), 300000); eq(line(s.pensii, 'aur'), 500000); eq(line(s.pensii, 'gent'), 30000); eq(line(s.pensii, 'piloni'), 1000000);
  eq(s.pensii.total, 1830000);
  eq(s.pensii.lines.filter((l) => l.section === 'vanzare').reduce((t, l) => t + l.ron, 0), 830000);
  eq(s.pensii.lines.filter((l) => l.section === 'pensie').reduce((t, l) => t + l.ron, 0), 1000000);
  eq(line(s.disponibil, 'asigurari'), 200000); // Iza keeps insurance in disponibil
});
test('situation: INDISPONIBIL = property + loans given (counted, not touchable)', () => {
  const s = situation(model, '2026-10-14');
  eq(line(s.indisponibil, 'imobile'), 12500000); // 20.000 + 5.000 euro
  eq(line(s.indisponibil, 'imprumuturi'), 50000); // 100 euro
  eq(s.indisponibil.total, 12550000);
});
test('situation: WEALTH 1 = disponibil + sellable pensii; WEALTH 2 adds property; pillars and loans in neither', () => {
  const s = situation(model, '2026-10-14');
  eq(s.wealth1, 620000 + 830000);
  eq(s.wealth2, 620000 + 830000 + 12500000);
  eq(s.excluded, { piloni: 1000000, imprumuturi: 50000 });
  eq(s.wealth, undefined, 'the old total is gone');
});
test('situation: a card without a limit is ignored, a past date sees only what existed then', () => {
  const noLimit = situation({ ...model, settings: [] }, '2026-10-14');
  eq(line(noLimit.disponibil, 'carduri'), 0);
  const jan = situation(model, '2026-01-15');
  eq(line(jan.disponibil, 'depozite'), 140000); // deposits started on 1 Jan
  eq(jan.disponibil.total, 140000); eq(jan.pensii.total, 400000); eq(jan.indisponibil.total, 12500000); eq(jan.wealth1, 540000); eq(jan.wealth2, 540000 + 12500000); // deposits and the gold's purchase price existed; property counts at every date
});
test('situation: property never leaks into the cash or gold layers', () => {
  const s = situation({ ...model, physical_items: [model.physical_items[2]] }, '2026-10-14');
  eq(line(s.disponibil, 'seif'), 0); eq(line(s.pensii, 'aur'), 0); eq(line(s.indisponibil, 'imobile'), 10000000);
});
test('combine: two spaces add up line by line, native amounts too', () => {
  const a = situation(model, '2026-10-14');
  const c = combine([a, a]);
  eq(c.wealth1, a.wealth1 * 2); eq(c.wealth2, a.wealth2 * 2); eq(c.excluded.piloni, 2000000); eq(c.disponibil.total, a.disponibil.total * 2);
  eq(line(c.indisponibil, 'imobile'), 25000000); eq(c.disponibil.native.EUR, 60000);
  eq(combine([]), null);
});
test('comparisonDates: end of last month and end of last year', () => {
  eq(comparisonDates('2026-10-14'), { month: '2026-09-30', year: '2025-12-31' });
  eq(comparisonDates('2027-01-05'), { month: '2026-12-31', year: '2026-12-31' });
});
test('historyStart: the earliest balance / broker / physical date', () => {
  eq(historyStart(model), '2026-09-30');
  eq(historyStart({ balances: [], broker_flows: [], broker_values: [], physical_values: [] }), null);
});
test('LAYERS lists every line the screen shows', () => ok(LAYERS.disponibil.length === 6 && LAYERS.pensii.length === 4 && LAYERS.indisponibil.length === 2));

test('snapshots: Excel totals count only before the group has detailed records, never on top of them', () => {
  const snap = (group, label, currency, amount_minor, date = '2025-12-31') => ({ group, label, currency, amount_minor, date });
  const m = { ...model, snapshots: [snap('depozite', 'Depozite lei', 'RON', 777700), snap('depozite', 'Depozite euro', 'EUR', 10000),
    snap('bursa', 'Tradeville', 'RON', 123400, '2025-12-31'), snap('bursa', 'Tradeville', 'RON', 150000, '2026-03-01'), snap('seif', 'Seif euro', 'EUR', 2000)] };
  // deposits start 2026-01-01 in the invented model: before that day the snapshots count, from that day they do not
  const early = situation(m, '2025-12-31');
  eq(line(early.disponibil, 'depozite'), 777700 + 50000); // 100 euro = 500 lei
  eq(early.disponibil.native.EUR, 10000 + 2000); // snapshot deposits euro + safe euro
  eq(line(early.pensii, 'bursa'), 123400);
  eq(line(situation(m, '2026-03-15').pensii, 'bursa'), 150000); // the latest snapshot on or before the date
  eq(line(situation(m, '2026-10-14').disponibil, 'depozite'), 100000 + 40000); // real deposits only
  eq(snapshotRows(m, '2026-10-14').some((r) => r.group === 'depozite'), false);
  ok(snapshotRows(m, '2026-10-14', { all: true }).some((r) => r.group === 'depozite' && !r.used), 'all=true keeps unused ones, flagged');
});

test('property counts at every date (house/car/garage existed before they were entered): a comparison never shows it as growth', () => {
  const m = { ...model, physical_items: model.physical_items.map((i) => ({ ...i, purchase_date: '2026-10-14' })),
    physical_values: model.physical_values.map((v) => ({ ...v, date: '2026-10-14' })) };
  const early = line(situation(m, '2025-12-31').indisponibil, 'imobile'), now = line(situation(m, '2026-10-14').indisponibil, 'imobile');
  eq(early, now); ok(now > 0, 'property is counted');
  eq(line(situation(m, '2025-12-31').pensii, 'aur'), 0); // gold is not property: still only from its date
});

test('situation: Iza-like model (insurance, no pillars) still works, and combine adds the Pensii lines', () => {
  const a = situation(model, '2026-10-14');
  const iza = situation({ ...model, accounts: model.accounts.filter((x) => !['pen', 'gent'].includes(x.id)) }, '2026-10-14');
  eq(line(iza.pensii, 'piloni'), 0); eq(line(iza.disponibil, 'asigurari'), 200000);
  const c = combine([a, iza]);
  eq(line(c.pensii, 'piloni'), 1000000); eq(c.pensii.total, a.pensii.total + iza.pensii.total);
  eq(c.wealth1, a.wealth1 + iza.wealth1); eq(c.wealth2, a.wealth2 + iza.wealth2);
});
test('a pension account is a locked pillar unless its institution is a sellable one', () => {
  const m = { ...model, accounts: model.accounts.map((x) => (x.id === 'gent' ? { ...x, institution: 'Pilon 3' } : x)) };
  const s = situation(m, '2026-10-14');
  eq(line(s.pensii, 'gent'), 0); eq(line(s.pensii, 'piloni'), 1030000);
});

test('eurGrowth: euro change uses each date\'s own rate (unchanged euro = 0, not a rate effect)', () => {
  const r = [{ date: '2026-09-26', EUR: 50000 }, { date: '2026-10-14', EUR: 55000 }];
  eq(eurGrowth(r, 550000, '2026-10-14', 500000, '2026-09-26'), 0); // 100 euro both times; 50.000 -> 55.000 lei is only the rate
  eq(eurGrowth(r, 605000, '2026-10-14', 500000, '2026-09-26'), 10000); // +10 euro
});
