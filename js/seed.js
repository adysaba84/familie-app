// Starting accounts (plan §5). Written once, by an editor who confirms the list on screen.
const a = (kind, institution, owner, currency_default = 'RON', label = '') => ({
  kind, institution, owner, currency_default, status: 'active', note: '',
  name: label || `${institution} · ${owner}`,
});

export const SEED = {
  parents: [
    a('broker', 'XTB', 'Ady'), a('broker', 'Tradeville', 'Ady'), a('broker', 'Revolut', 'Carmen', 'EUR'),
    a('deposit_bank', 'BT', 'Carmen'), a('deposit_bank', 'Salt', 'Carmen'), a('deposit_bank', 'Revolut', 'Carmen', 'EUR'),
    a('current', 'BT', 'Ady'), a('current', 'BT', 'Carmen'), a('current', 'Salt', 'Carmen'), a('current', 'Revolut', 'Carmen', 'EUR'),
    a('voucher', 'Edenred', 'Ady', 'RON', 'Tichete · Ady'), a('voucher', 'Edenred', 'Carmen', 'RON', 'Tichete · Carmen'),
    a('savings', 'Economii', 'Ady', 'RON', 'Economii · Ady'), a('savings', 'BT', 'Carmen', 'RON', 'BT economii · Carmen'),
    a('safe', 'Seif', 'Ady', 'RON', 'Seif'),
  ],
  iza: [
    a('broker', 'Tradeville', 'Iza'), a('deposit_bank', 'BT', 'Iza'),
    a('savings', 'KID', 'Iza', 'RON', 'KID cont'),
  ],
};
