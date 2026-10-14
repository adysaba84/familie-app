// Money is always an integer in minor units (bani/cents). Rates are integers x10 000
// (4,9765 RON per EUR -> 49765); percentages are basis points (4,5% -> 450).

// Integer division rounded half away from zero.
export function roundDiv(n, d) {
  const r = Math.round(Math.abs(n) / Math.abs(d));
  return (n < 0) !== (d < 0) ? -r : r;
}

// Accepts Romanian input ("5.000,25", "5000,25") and plain ("5000.25", "5000"). A dotted integer
// part must be proper thousands groups ("5.000"), as in Romanian. Returns minor units, or null
// when it is not a valid amount with at most 2 decimals.
export function parseAmount(input) {
  const s = String(input).trim().replace(/\s+/g, '');
  const ro = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(s);
  const plain = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  const m = ro || plain;
  if (!m) return null;
  const [, sign, intRaw, frac = ''] = m;
  const minor = Number(intRaw.replace(/\./g, '')) * 100 + Number(frac.padEnd(2, '0'));
  return sign ? -minor : minor;
}

export function formatMinor(minor) {
  const abs = Math.abs(minor);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (minor < 0 ? '-' : '') + whole + ',' + String(abs % 100).padStart(2, '0');
}

export function formatMoney(minor, currency = 'RON') {
  return formatMinor(minor) + ' ' + currency;
}

// Rates: "4,9765" -> 49765 (4 decimals).
export function parseRate(input) {
  const m = /^(\d+)(?:[.,](\d{1,4}))?$/.exec(String(input).trim());
  if (!m) return null;
  return Number(m[1]) * 10000 + Number((m[2] || '').padEnd(4, '0'));
}

export function formatRate(rate) {
  return Math.floor(rate / 10000) + ',' + String(rate % 10000).padStart(4, '0');
}

// Percent -> basis points: "4,5" -> 450.
export function parsePercent(input) {
  const m = /^(\d+)(?:[.,](\d{1,2}))?%?$/.exec(String(input).trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0'));
}

export function formatPercent(bp) {
  return formatMinor(bp) + '%';
}
