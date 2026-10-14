// Spreadsheet layout (plan §5). Same tabs in both files. Every data tab ends with the common columns.
const COMMON = ['created_by', 'created_at', 'void', 'void_reason'];
const withCommon = (cols) => [...cols, ...COMMON];

export const TABS = {
  accounts: withCommon(['id', 'kind', 'institution', 'owner', 'name', 'currency_default', 'status', 'note']),
  broker_flows: withCommon(['id', 'date', 'account_id', 'currency', 'instrument', 'amount_minor', 'direction', 'note']),
  broker_values: withCommon(['id', 'date', 'account_id', 'currency', 'instrument', 'value_minor']),
  deposits: withCommon(['id', 'account_id', 'currency', 'principal_minor', 'rate_bp', 'term_months', 'start_date',
    'maturity_date', 'capitalization', 'auto_renew', 'notify_days', 'status', 'note']),
  physical_items: withCommon(['id', 'kind', 'currency', 'description', 'quantity', 'purchase_value_minor', 'purchase_date']),
  physical_values: withCommon(['id', 'item_id', 'date', 'value_minor']),
  balances: withCommon(['id', 'account_id', 'date', 'balance_minor', 'rate_bp']),
  rates: ['date', 'EUR', 'USD', 'XAU', 'source'],
  // key/value settings (private plan parameters live here, never in the public code); latest non-void row per key wins
  settings: withCommon(['key', 'value']),
  notify: ['email', 'kinds', 'days_before_maturity'],
  notifications_log: ['key', 'sent_at'],
  audit: ['ts', 'user', 'action', 'tab', 'row_id', 'summary'],
};

export const FILE_NAMES = { parents: 'FIN · Părinți', iza: 'FIN · Iza' };

export const SPACE_LABEL = { parents: 'Părinți', iza: 'Iza' };
