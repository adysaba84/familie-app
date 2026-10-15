import { test, eq } from './harness.js';
import { parseGiftDate, formatGiftDate, liveGifts, totalsByCurrency, byGiver, giverShares, byYear, suggestions, giftFromForm, parseCsv, giftsFromCsv, OTHER } from '../js/gifts.js';

// invented people and amounts only
const g = (date, giver, amount_minor, currency = 'RON', extra = {}) => ({ date, giver, amount_minor, currency, reason: '', void: false, ...extra });

test('gift dates: full, month-only and year-only are valid; junk is not', () => {
  eq(parseGiftDate('2025-10-12'), { year: 2025, month: 10, day: 12 });
  eq(parseGiftDate('2025-10'), { year: 2025, month: 10, day: null });
  eq(parseGiftDate('2025'), { year: 2025, month: null, day: null });
  eq(parseGiftDate('2025-13'), null); eq(parseGiftDate('oct 2025'), null); eq(parseGiftDate(''), null);
  eq(formatGiftDate('2025-10-12'), '12 oct 2025'); eq(formatGiftDate('2025-10'), 'oct 2025'); eq(formatGiftDate('2016'), '2016');
});

test('liveGifts: skips void rows, newest first, later row wins on the same date', () => {
  const m = { gifts: [g('2024-05', 'A', 100, 'RON', { _row: 2 }), g('2025-01', 'B', 200, 'RON', { _row: 3 }), g('2025-01', 'C', 300, 'RON', { _row: 4 }), g('2026-01', 'D', 1, 'RON', { _row: 5, void: true })] };
  eq(liveGifts(m).map((x) => x.giver), ['C', 'B', 'A']);
  eq(liveGifts({}), []);
});

test('totals are per currency, never converted; lei first', () => {
  const list = [g('2025-01', 'A', 1000, 'EUR'), g('2025-01', 'A', 5000), g('2025-02', 'B', 2500)];
  eq(totalsByCurrency(list), [{ currency: 'RON', minor: 7500, count: 2 }, { currency: 'EUR', minor: 1000, count: 1 }]);
});

test('byGiver: biggest first with shares of the chosen currency', () => {
  const list = [g('2025-01', 'A', 3000), g('2025-02', 'B', 1000), g('2025-03', 'A', 1000), g('2025-04', 'C', 500, 'EUR')];
  const r = byGiver(list, 'RON');
  eq(r.map((x) => [x.giver, x.minor]), [['A', 4000], ['B', 1000]]);
  eq(r[0].share, 0.8);
  eq(byGiver([], 'RON'), []);
});

test('byYear: newest year first with its own totals', () => {
  const r = byYear([g('2024-05', 'A', 100), g('2025-01', 'B', 200), g('2025-02', 'C', 300)]);
  eq(r.map((y) => y.year), [2025, 2024]); eq(r[0].totals[0].minor, 500);
});

test('suggestions: values already used (most used first), then the defaults not yet used', () => {
  const list = [{ reason: 'Paște' }, { reason: 'Crăciun' }, { reason: 'Crăciun' }, { reason: '' }];
  eq(suggestions(list, 'reason', ['Paște', '1 iunie']), ['Crăciun', 'Paște', '1 iunie']);
});

test('giftFromForm: validates and takes the typed text when "Altele…" is chosen', () => {
  const ok = { date: '2025-10-12', giver: OTHER, giverOther: ' Vecina ', amount: '1.250,50', currency: 'RON', reason: OTHER, reasonOther: 'Notă bună', note: '' };
  eq(giftFromForm(ok).fields, { date: '2025-10-12', giver: 'Vecina', amount_minor: 125050, currency: 'RON', reason: 'Notă bună', note: '' });
  eq(giftFromForm({ ...ok, giverOther: ' ' }).error, 'Spune de la cine a primit.');
  eq(giftFromForm({ ...ok, date: '' }).error, 'Alege data.');
  eq(giftFromForm({ ...ok, amount: '0' }).error.startsWith('Introdu'), true);
  eq(giftFromForm({ ...ok, currency: 'GBP' }).error, 'Alege valuta.');
});

test('parseCsv: quotes, commas and line breaks inside quotes', () => {
  eq(parseCsv('a,b\n"x, y","he said ""hi"""\n'), [['a', 'b'], ['x, y', 'he said "hi"']]);
  eq(parseCsv('﻿a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
});

test('giftsFromCsv: converts rows, turns a period into its last year and reports bad rows', () => {
  const head = 'data,de_la,suma,moneda,motiv,descriere_foaie\n';
  const r = giftsFromCsv(head + '2025-10,A,200,RON,Paște,"un cadou, mic"\n2015-feb 2016,B,82.5,RON,,\n2025-11,C,x,RON,,\n2025-12,D,10,EUR,,');
  eq(r.fields.length, 3); eq(r.errors, ['Rândul 4 nu e valid.']);
  eq(r.fields[0], { date: '2025-10', giver: 'A', amount_minor: 20000, currency: 'RON', reason: 'Paște', note: 'un cadou, mic' });
  eq(r.fields[1], { date: '2016', giver: 'B', amount_minor: 8250, currency: 'RON', reason: '', note: 'perioada 2015-feb 2016' });
  eq(giftsFromCsv('x,y\n1,2').errors.length, 1);
});

test('giverShares: euro counted in lei at the given rate, amounts kept per currency, tiny one-time givers left out', () => {
  const toRon = (minor, c) => (c === 'EUR' ? minor * 5 : minor); // invented rate: 1 EUR = 5 lei
  const list = [g('2025-01', 'A', 10000), g('2025-02', 'A', 1000, 'EUR'), g('2025-03', 'B', 2500), g('2025-04', 'C', 700), g('2025-05', 'D', 600), g('2025-06', 'D', 600)];
  const r = giverShares(list, toRon);
  eq(r.map((x) => x.giver), ['A', 'B', 'D']); // C gave once, 7 lei: out; D gave twice, so it stays
  eq(r[0].parts, [{ currency: 'RON', minor: 10000 }, { currency: 'EUR', minor: 1000 }]);
  eq(r[0].ron, 15000);
  eq(Math.round(r[0].share * 100), 80); // 15000 of 18700 (C is out of the base)
  eq(giverShares([], toRon), []);
});
