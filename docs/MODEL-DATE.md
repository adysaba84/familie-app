# Model de date

Două fișiere Google Sheets, deținute de Ady, cu aceleași foi (exceptând foile doar-părinți). Schema autoritară e în `js/schema.js`; aici e sensul coloanelor. La un fișier mai vechi, `store.js` creează foile lipsă și rescrie antetul foilor goale; o foaie cu date și antet diferit e refuzată (cere migrare manuală).

| Fișier | Cine | Acces |
|---|---|---|
| `FIN · Părinți` | Ady, Carmen | Editor pentru amândoi; Iza nu are acces |
| `FIN · Iza` | Ady, Carmen, Iza | Editor pentru părinți, Viewer pentru Iza (Google impune citirea). Excepție: Iza poate scrie foaia `wallet_balances` (portofelele ei) |

Niciodată „oricine are linkul”. ID-urile fișierelor nu sunt în repo (aplicația le găsește după nume prin Drive).

## Coloane comune
La finalul fiecărei foi de date: `created_by` (email), `created_at` (ISO UTC), `void` (gol sau `1`), `void_reason`. ID-uri: `crypto.randomUUID()`.

## Foi

| Foaie | Conținut | Note |
|---|---|---|
| `accounts` | id, kind, institution, owner, name, currency_default, status, note | `kind`: `broker`, `deposit_bank`, `current`, `savings`, `voucher`, `safe`, `wallet`, `insurance`, `pension`, `loan`, `card` |
| `broker_flows` | date, account_id, currency, instrument, amount_minor, direction (`in`/`out`), note | „sumă investită”; fără `instrument` = `stocks_etf` |
| `broker_values` | date, account_id, currency, instrument, value_minor | „valoare cont la dată”; `instrument`: `stocks_etf`, `bonds`, `cash`; obligațiunile rămân la valoarea investită până se introduce o valoare |
| `deposits` | account_id, currency, principal_minor, rate_bp, term_months, start_date, maturity_date, capitalization, auto_renew, notify_days, status, note, closed_date, interest_received_minor, closed_to_account_id, renewed_from_id | `status`: `active`, `matured`, `broken`. Închiderea = rând vechi `void` + rând nou cu câmpurile de închidere. Prelungirea leagă depozitul nou prin `renewed_from_id` |
| `physical_items` / `physical_values` | bunuri fizice și valorile lor datate | `kind`: `gold`, `cash`, `property`, `vehicle`, `garage`, `other_goods`; imobilele nu intră în totalul Active, ci în stratul Indisponibil |
| `balances` | account_id, date, balance_minor, rate_bp | solduri datate pe conturi (curent, economii, tichete, asigurări, pensii, împrumuturi, carduri) |
| `wallet_balances` | ca `balances` | scrisă de Iza (alături de `gifts`, vezi mai jos); la încărcare se îmbină cu `balances` |
| `snapshots` | date, group, label, currency, amount_minor | totaluri copiate din Excelul vechi pentru date dinaintea înregistrărilor detaliate; se numără doar cât timp data e anterioară primei înregistrări detaliate din grup |
| `cash_periods` / `cash_items` | pagina lunară Venituri și cheltuieli | **doar în fișierul Părinți**; `kind`: `income` sau `invested`, sume în lei cu semn |
| `gifts` | id, date, giver, amount_minor, currency, reason, note | jurnal „Primite”: `date` poate fi parțială (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`), sumele pe valută fără conversie; `giver` include și „Părinți” (alocații, burse, Tradeville), „Randament” (dobânzi, randament) și „Aport propriu Iza” |
| `rates` | date, EUR, USD, XAU, source | curs BNR ×10 000; la aceeași dată rândul mai nou câștigă (corecție) |
| `settings` | key, value | parametri privați; ultimul rând ne-void pe cheie câștigă |
| `notify`, `notifications_log` | rămase din varianta cu emailuri | nefolosite acum (notificările merg prin Calendar) |
| `audit` | ts, user, action, tab, row_id, summary | un rând la fiecare scriere |

## Chei `settings` cunoscute
- Planul lui Iza (în fișierul ei): `birth_date`, `adult_age`, `contrib_nn_ron_month`, `contrib_etf_ron_month`, `contrib_savings_ron_month`, `contrib_family_eur_year`, `etf_rate_bp`, `nn_rate_bp`, `bond_rate_bp`, `fx_drift_bp`. Fără `birth_date` ecranul ei arată doar total și cutii.
- Limita unui card de credit: `card_limit:<id cont>` = bani. Cardurile intră în Disponibil ca `sold − limită` (≤ 0 = cât s-a cheltuit); „sold” înseamnă credit disponibil.

## Reguli de calcul
- Investit = Σ intrări − Σ ieșiri (flows ne-void, până la dată). Valoare = ultima valoare pe (cont, valută, instrument) ≤ data. Câștig = valoare − investit.
- Dobândă depozit: brută = sumă × rată × zile/365 (fără capitalizare) sau lunar compus; netă = brută − 10%. Afișată ca „estimare”.
- BFG: 100.000 € per (bancă, titular), din depozite + economii + conturi curente.
- Sold vechi: cont fără înregistrare de peste 30 zile (`STALE_DAYS`) apare marcat.
- Conversia folosește cursul zilei sau ultimul anterior; ecranul arată „curs din <dată>”.
