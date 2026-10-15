// Spreadsheet layout (plan §5). Same tabs in both files. Every data tab ends with the common columns.
const COMMON = ['created_by', 'created_at', 'void', 'void_reason'];
const withCommon = (cols) => [...cols, ...COMMON];

export const TABS = {
  accounts: withCommon(['id', 'kind', 'institution', 'owner', 'name', 'currency_default', 'status', 'note']),
  broker_flows: withCommon(['id', 'date', 'account_id', 'currency', 'instrument', 'amount_minor', 'direction', 'note']),
  broker_values: withCommon(['id', 'date', 'account_id', 'currency', 'instrument', 'value_minor']),
  // status: active | matured (closed at maturity) | broken (closed before maturity). Closing = void + a new row with the
  // closing fields, which sit AFTER the common columns so the sheets created earlier migrate by just extending the header.
  deposits: [...withCommon(['id', 'account_id', 'currency', 'principal_minor', 'rate_bp', 'term_months', 'start_date',
    'maturity_date', 'capitalization', 'auto_renew', 'notify_days', 'status', 'note']),
  'closed_date', 'interest_received_minor', 'closed_to_account_id', 'renewed_from_id'],
  physical_items: withCommon(['id', 'kind', 'currency', 'description', 'quantity', 'purchase_value_minor', 'purchase_date']),
  physical_values: withCommon(['id', 'item_id', 'date', 'value_minor']),
  balances: withCommon(['id', 'account_id', 'date', 'balance_minor', 'rate_bp']),
  // the only tab Iza herself may write (her wallets); same shape as `balances`, merged with it when the file is loaded
  wallet_balances: withCommon(['id', 'account_id', 'date', 'balance_minor', 'rate_bp']),
  // Excel totals for dates before the detailed records exist (e.g. all deposits at 31 dec): group = conturi | depozite | seif | aur | bursa
  snapshots: withCommon(['id', 'date', 'group', 'label', 'currency', 'amount_minor', 'note']),
  // Monthly "income and expenses" page (parents' file only): one row per saved page (date = end of the period, prev_date =
  // its start) and its items. kind = income | invested; key = salar_ady ... nn_iza ... altele; amount_minor = lei, signed
  // (an investment can be negative: withdrawals, sales, redemptions); label only for free-text rows (alte_surse, altele).
  cash_periods: withCommon(['id', 'date', 'prev_date', 'note']),
  cash_items: withCommon(['id', 'period_id', 'kind', 'key', 'amount_minor', 'label']),
  rates: ['date', 'EUR', 'USD', 'XAU', 'source'],
  // key/value settings (private plan parameters live here, never in the public code); latest non-void row per key wins
  settings: withCommon(['key', 'value']),
  notify: ['email', 'kinds', 'days_before_maturity'],
  notifications_log: ['key', 'sent_at'],
  audit: ['ts', 'user', 'action', 'tab', 'row_id', 'summary'],
};

// tabs that exist only in the parents' file (never created in Iza's)
export const PARENTS_ONLY_TABS = ['cash_periods', 'cash_items'];

export const FILE_NAMES = { parents: 'FIN · Părinți', iza: 'FIN · Iza' };

export const SPACE_LABEL = { parents: 'Părinți', iza: 'Iza' };
