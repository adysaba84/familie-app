import { test, eq, ok } from './harness.js';
import { situation, combine, comparisonDates, historyStart, snapshotRows, LAYERS, eurGrowth, wealthStructure, wealthDates, wealthSeries, seriesStartsBeforeDeposits, categoryGroups } from '../js/situations.js';

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
test('LAYERS lists every line the screen shows', () => ok(LAYERS.disponibil.length === 6 && LAYERS.pensii.length === 4 && LAYERS.indisponibil.length === 3));

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

test('wealthStructure: four segments from the same situation, sums to disponibil + pensii + indisponibil, wealth 1 = first two', () => {
  const s = situation(model, '2026-10-14');
  const w = wealthStructure(s);
  eq(w.map((x) => x.key), ['disponibil', 'vanzare', 'pensie', 'indisponibil']);
  eq(w.reduce((t, x) => t + x.ron, 0), s.disponibil.total + s.pensii.total + s.indisponibil.total);
  eq(w[0].ron + w[1].ron, s.wealth1);
  eq(w[2].ron, s.excluded.piloni);
});
test('wealthDates: only days with several real records, plus today; nothing interpolated', () => {
  const rec = (date) => ({ date });
  const m = { balances: [rec('2025-12-31'), rec('2025-12-31'), rec('2026-03-10')], broker_values: [rec('2025-12-31'), rec('2026-03-10')], physical_values: [rec('2026-03-10'), rec('2026-02-01'), { date: '2026-03-10', void: true }, rec('2027-01-01')] };
  eq(wealthDates(m, '2026-04-01'), ['2025-12-31', '2026-03-10', '2026-04-01']); // 02-01 has one record; 2027 is the future
  eq(wealthDates(m, '2026-03-10'), ['2025-12-31', '2026-03-10']); // today is not added twice
  eq(wealthDates({}, '2026-04-01'), ['2026-04-01']);
});
test('wealthSeries / seriesStartsBeforeDeposits: values per date, warning when the first date predates the deposits', () => {
  const ser = wealthSeries(model, '2026-10-14');
  eq(ser[ser.length - 1], { date: '2026-10-14', ron: situation(model, '2026-10-14').wealth1 });
  eq(seriesStartsBeforeDeposits(model, [{ date: '2025-12-31' }]), true); // deposits in the invented model start 2026-01-01
  eq(seriesStartsBeforeDeposits(model, [{ date: '2026-01-01' }]), false);
  eq(seriesStartsBeforeDeposits({ deposits: [] }, [{ date: '2025-12-31' }]), false);
});

test('items: every line is exactly the sum of what it is made of (the expandable lists use the same numbers)', () => {
  const s = situation({ ...model, broker_flows: [], snapshots: [] }, '2026-10-14');
  for (const layer of [s.disponibil, s.pensii, s.indisponibil]) {
    for (const l of layer.lines) eq((s.items[l.key] || []).reduce((t, i) => t + i.ron, 0), l.ron, l.key);
  }
  ok((s.items.depozite || []).length === 2, 'two live deposits listed, the void one left out');
  eq(s.items.carduri[0].native, -20000); // native spent on the card, not the balance
});
test('categoryGroups: subtotals and percentages share one total; groups follow the screen', () => {
  const s = situation(model, '2026-10-14');
  const { total, groups } = categoryGroups(s);
  eq(total, s.disponibil.total + s.pensii.total + s.indisponibil.total);
  eq(groups.map((g) => g.key), ['disponibil', 'pensii', 'indisponibil']);
  const pens = groups[1];
  eq(pens.ron, s.pensii.total);
  eq(pens.blocks.map((b) => b.key), ['vanzare', 'pensie']);
  eq(pens.blocks[0].ron + pens.blocks[1].ron, pens.ron);
  eq(pens.blocks[1].lines[0].groupRon, pens.blocks[1].ron); // % din grupa is against its own block
  eq(groups[0].blocks[0].lines.every((l) => l.groupRon === s.disponibil.total), true);
  eq(groups.reduce((t, g) => t + g.blocks.reduce((u, b) => u + b.ron, 0), 0), total);
});
test('categoryGroups: empty lines are left out (a space without pensions shows no Pensii lines)', () => {
  const s = situation({ ...model, accounts: model.accounts.filter((x) => !['pen', 'gent'].includes(x.id)), broker_values: [], physical_values: model.physical_values.filter((v) => v.item_id !== 'g') }, '2026-10-14');
  const keys = categoryGroups(s).groups.flatMap((g) => g.blocks.flatMap((b) => b.lines.map((l) => l.key)));
  ok(!keys.includes('piloni') && !keys.includes('gent') && !keys.includes('bursa'));
});

// ---- Wealth 3 and "Alte bunuri" ----
const withGoods = (extra = {}) => ({ ...model,
  physical_items: [...model.physical_items, { id: 'og', kind: 'other_goods', currency: 'RON', description: 'Estimare alte bunuri', purchase_date: '2026-10-14' }],
  physical_values: [...model.physical_values, { item_id: 'og', date: '2026-10-14', value_minor: 700000 }], ...extra });

test('WEALTH 3 = disponibil + all of pensii (pillars too) + all of indisponibil; 1 and 2 keep their definitions', () => {
  const s = situation(model, '2026-10-14');
  eq(s.wealth3, s.disponibil.total + s.pensii.total + s.indisponibil.total);
  eq(s.wealth3, s.wealth2 + s.excluded.piloni + s.indisponibil.lines.find((l) => l.key === 'alte_bunuri').ron + s.excluded.imprumuturi);
  eq(s.wealth1, s.disponibil.total + 830000); eq(s.wealth2, s.wealth1 + 12500000); // unchanged
});
test('Alte bunuri: only in Wealth 3 and in Indisponibil; never in Disponibil, Wealth 1 or 2', () => {
  const base = situation(model, '2026-10-14'), s = situation(withGoods(), '2026-10-14');
  eq(s.indisponibil.lines.find((l) => l.key === 'alte_bunuri').ron, 700000);
  eq(s.indisponibil.total, base.indisponibil.total + 700000);
  eq(s.wealth3, base.wealth3 + 700000);
  eq(s.wealth1, base.wealth1); eq(s.wealth2, base.wealth2); eq(s.disponibil.total, base.disponibil.total); eq(s.pensii.total, base.pensii.total);
  eq(s.items.alte_bunuri.map((i) => [i.label, i.native, i.currency]), [['Estimare alte bunuri', 700000, 'RON']]);
});
test('Alte bunuri count at every date (entered today, no fake growth) and use the latest value on or before the date', () => {
  const m = withGoods({ physical_values: [...model.physical_values, { item_id: 'og', date: '2026-10-14', value_minor: 700000 }, { item_id: 'og', date: '2026-12-01', value_minor: 900000 }] });
  const at = (d) => situation(m, d).indisponibil.lines.find((l) => l.key === 'alte_bunuri').ron;
  eq(at('2025-12-31'), 700000); eq(at('2026-10-14'), 700000); eq(at('2026-12-01'), 900000);
  eq(situation(m, '2025-12-31').wealth3 - situation(model, '2025-12-31').wealth3, 700000); // a constant add-on: a comparison shows no growth from it
});
test('Alte bunuri in euro are converted at the rate of the date; rows of an unknown kind are ignored (old sheets)', () => {
  const eur = withGoods({ physical_items: [...model.physical_items, { id: 'og', kind: 'other_goods', currency: 'EUR', purchase_date: '2026-10-14' }, { id: 'old', kind: '', currency: 'RON', purchase_date: '2026-01-01' }],
    physical_values: [...model.physical_values, { item_id: 'og', date: '2026-10-14', value_minor: 10000 }, { item_id: 'old', date: '2026-10-14', value_minor: 999 }] });
  eq(situation(eur, '2026-10-14').indisponibil.lines.find((l) => l.key === 'alte_bunuri').ron, 50000); // 100 euro at 5
  eq(situation(eur, '2026-10-14').wealth1, situation(model, '2026-10-14').wealth1);
});
test('combine keeps Wealth 3 additive', () => {
  const a = situation(withGoods(), '2026-10-14'), b = situation(model, '2026-10-14');
  eq(combine([a, b]).wealth3, a.wealth3 + b.wealth3);
});
