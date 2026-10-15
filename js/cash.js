import { toRon, accountBalance, daysBetween, addMonths } from './calc.js';
import { situation } from './situations.js';

// "Venituri și cheltuieli": the monthly page. PURE (no DOM, no network). Everything is for the WHOLE family (parents + Iza),
// so a transfer between their accounts cancels out on its own. Amounts are RON bani.
//
//   cheltuieli estimate = venituri + dobânzi depozite − investit − (Disponibil_cash(d1) − Disponibil_cash(d0))
//
// Disponibil_cash = the Disponibil layer of situation() summed over the spaces, MINUS the "Asigurări" line (Iza's NN is an
// investment, not cash). Both Disponibil_cash values use the rates of d1, so the exchange-rate move on euro / dollar
// amounts is neither income nor expense. The result is a remainder: whatever left the cash and was not an investment.
const live = (r) => !r.void;

export const INCOME_ROWS = [
  ['salar_ady', 'Salar Ady'], ['salar_carmen', 'Salar Carmen'], ['tichete_ady', 'Tichete Ady'], ['tichete_carmen', 'Tichete Carmen'],
  ['alocatie_iza', 'Alocație Iza'], ['cadouri_iza', 'Cadouri Iza'], ['cadouri_parinti', 'Cadouri părinți'],
];
export const EXTRA_INCOME_KEY = 'alte_surse'; // free label, several rows allowed
export const INVESTED_ROWS = [
  ['nn_iza', 'NN (Iza)'], ['gent_carmen', 'Gent (Carmen)'], ['bursa', 'Bursă'], ['aur', 'Aur'], ['p3_ady', 'Pilon 3 (Ady)'], ['p3_carmen', 'Pilon 3 (Carmen)'],
];
// optional, empty by default: keep them from showing up as spending
export const INVESTED_OPTIONAL = [['imprumuturi', 'Împrumuturi date / rambursate'], ['imobile', 'Imobile (achiziții, renovări mari)'], ['altele', 'Altele']];
export const FREE_LABEL_KEYS = [EXTRA_INCOME_KEY, 'altele'];

const CASH_KINDS = ['current', 'wallet', 'voucher', 'savings', 'card'];

// Disponibil without insurance, summed over the given space models, at the data of `d` and the rates of `rateDate`.
export function cashAvailable(models, d, rateDate = d) {
  let total = 0;
  for (const m of models) {
    const s = situation(m, d, { rateDate });
    total += s.disponibil.total - s.disponibil.lines.find((l) => l.key === 'asigurari').ron;
  }
  return total;
}

// Interest actually received: deposits closed or rolled over with a closed_date in (d0, d1], in RON at the rates of d1
// (cash basis: Disponibil counts a deposit at the amount deposited, so the interest becomes income when it is paid out).
export function depositInterestRon(models, d0, d1) {
  let total = 0;
  for (const m of models) {
    for (const d of m.deposits || []) {
      if (!live(d) || !['matured', 'broken'].includes(d.status) || !d.closed_date || d.closed_date <= d0 || d.closed_date > d1) continue;
      if (d.interest_received_minor) total += toRon(d.interest_received_minor, d.currency, m.rates, d1);
    }
  }
  return total;
}

// Length of the period in months (days / 30.4375, one decimal): a skipped month shows up as ~2.
export const periodMonths = (d0, d1) => Math.round((daysBetween(d0, d1) / 30.4375) * 10) / 10;

// Accounts that make the result unreliable: no balance at the end, none entered in the period, none at the start.
export function cashWarnings(models, d0, d1) {
  const out = [];
  for (const m of models) {
    for (const a of m.accounts) {
      if (a.void || a.status === 'closed' || !CASH_KINDS.includes(a.kind)) continue;
      const b1 = accountBalance(m, a.id, d1), b0 = accountBalance(m, a.id, d0);
      if (b1.balance == null) out.push({ name: a.name, issue: 'fără sold' });
      else if (b1.date <= d0) out.push({ name: a.name, issue: `fără sold nou în perioadă (ultimul: ${b1.date})` });
      else if (b0.balance == null) out.push({ name: a.name, issue: 'fără sold la începutul perioadei' });
    }
  }
  return out;
}

const sum = (list) => list.reduce((t, x) => t + (x.amount_minor || 0), 0);

// items = [{ kind: 'income' | 'invested', key, amount_minor, label }]
export function periodResult(models, { d0, d1, items }) {
  const income = sum(items.filter((i) => i.kind === 'income'));
  const invested = sum(items.filter((i) => i.kind === 'invested'));
  const interest = depositInterestRon(models, d0, d1);
  const available0 = cashAvailable(models, d0, d1), available1 = cashAvailable(models, d1, d1);
  const delta = available1 - available0;
  const expenses = income + interest - invested - delta;
  const days = daysBetween(d0, d1), months = periodMonths(d0, d1);
  // a monthly average only when the period is not (about) one month
  const monthlyAvg = months > 0 && (months < 0.9 || months > 1.1) ? Math.round(expenses / months) : null;
  return { d0, d1, income, interest, invested, available0, available1, delta, expenses, days, months, monthlyAvg, warnings: cashWarnings(models, d0, d1) };
}

// Saved periods of the parents' model, newest first, each with its (live) items.
export function savedPeriods(parents) {
  const items = (parents.cash_items || []).filter(live);
  return (parents.cash_periods || []).filter(live)
    .map((p) => ({ ...p, items: items.filter((i) => i.period_id === p.id) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b._row || 0) - (a._row || 0)));
}

// Where a new page starts: the end of the last saved period; the first time, the latest day with balances before `d1`
// (or a month earlier when there are none).
export function defaultStart(models, parents, d1) {
  const last = savedPeriods(parents).find((p) => p.date < d1);
  if (last) return last.date;
  const dates = [];
  for (const m of models) for (const b of m.balances || []) if (live(b) && b.date < d1) dates.push(b.date);
  return dates.sort().pop() || addMonths(d1, -1);
}
