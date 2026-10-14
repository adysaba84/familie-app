// Starting accounts (plan §5). Written once, by an editor who confirms the list on screen.
const a = (kind, institution, owner, currency_default = 'RON', label = '') => ({
  kind, institution, owner, currency_default, status: 'active', note: '',
  name: label || `${institution} · ${owner}`,
});

export const SEED = {
  parents: [
    a('broker', 'XTB', 'Ady'), a('broker', 'Tradeville', 'Ady'), a('broker', 'Revolut', 'Ady'),
    a('deposit_bank', 'BT', 'Carmen'), a('deposit_bank', 'Salt', 'Carmen'), a('deposit_bank', 'Revolut', 'Carmen'),
    a('current', 'BT', 'Ady'), a('current', 'BT', 'Carmen'), a('current', 'Salt', 'Carmen'), a('current', 'Revolut', 'Carmen'), a('current', 'Revolut', 'Ady'),
    a('voucher', 'Edenred', 'Ady', 'RON', 'Tichete · Ady'), a('voucher', 'Edenred', 'Carmen', 'RON', 'Tichete · Carmen'),
    a('savings', 'Economii', 'Ady', 'RON', 'Economii · Ady'), a('savings', 'BT', 'Carmen', 'RON', 'BT economii · Carmen'),
    a('wallet', 'Portofel', 'Ady', 'RON', 'Portofel · Ady · RON'), a('wallet', 'Portofel', 'Ady', 'EUR', 'Portofel · Ady · EUR'),
    a('wallet', 'Portofel', 'Carmen', 'RON', 'Portofel · Carmen · RON'), a('wallet', 'Portofel', 'Carmen', 'EUR', 'Portofel · Carmen · EUR'),
    a('safe', 'Seif', 'Ady', 'RON', 'Seif'),
  ],
  iza: [
    a('broker', 'Tradeville', 'Iza'), a('deposit_bank', 'BT', 'Iza'),
    a('savings', 'KID', 'Iza', 'RON', 'KID cont'),
    a('current', 'Card', 'Iza', 'RON', 'Card · Iza'), a('wallet', 'Portofel', 'Iza', 'RON', 'Portofel · Iza · RON'), a('wallet', 'Portofel', 'Iza', 'EUR', 'Portofel · Iza · EUR'),
  ],
};
