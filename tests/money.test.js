import { test, eq } from './harness.js';
import { roundDiv, parseAmount, formatMinor, formatMoney, parseRate, formatRate, parsePercent, formatPercent } from '../js/money.js';

test('parseAmount: Romanian thousands + decimal comma', () => eq(parseAmount('5.000,25'), 500025));
test('parseAmount: comma decimal', () => eq(parseAmount('5000,25'), 500025));
test('parseAmount: dot decimal', () => eq(parseAmount('5000.25'), 500025));
test('parseAmount: integer', () => eq(parseAmount('5000'), 500000));
test('parseAmount: one decimal digit', () => eq(parseAmount('10,5'), 1050));
test('parseAmount: dotted integer is thousands', () => eq(parseAmount('5.000'), 500000));
test('parseAmount: millions', () => eq(parseAmount('1.234.567,89'), 123456789));
test('parseAmount: spaces ignored', () => eq(parseAmount(' 5 000,25 '), 500025));
test('parseAmount: negative', () => eq(parseAmount('-12,34'), -1234));
test('parseAmount: float-trap value stays exact', () => eq(parseAmount('0,29'), 29));
test('parseAmount: 3 decimals rejected', () => eq(parseAmount('1,234'), null));
test('parseAmount: bad thousands group rejected', () => eq(parseAmount('12.34.567'), null));
test('parseAmount: text rejected', () => eq(parseAmount('abc'), null));
test('parseAmount: empty rejected', () => eq(parseAmount(''), null));

test('formatMinor: groups and comma', () => eq(formatMinor(500025), '5.000,25'));
test('formatMinor: small', () => eq(formatMinor(5), '0,05'));
test('formatMinor: negative', () => eq(formatMinor(-123456789), '-1.234.567,89'));
test('formatMoney: nbsp + currency', () => eq(formatMoney(1050, 'EUR'), '10,50 EUR'));
test('round trip', () => eq(parseAmount(formatMinor(987654321)), 987654321));

test('rates', () => { eq(parseRate('4,9765'), 49765); eq(parseRate('5'), 50000); eq(parseRate('4.97'), 49700); eq(formatRate(49765), '4,9765'); eq(formatRate(50000), '5,0000'); });
test('percent', () => { eq(parsePercent('4,5'), 450); eq(parsePercent('6%'), 600); eq(formatPercent(450), '4,50%'); eq(parsePercent('x'), null); });

test('roundDiv: half away from zero', () => { eq(roundDiv(5, 2), 3); eq(roundDiv(-5, 2), -3); eq(roundDiv(4, 2), 2); eq(roundDiv(1, 3), 0); });
