# Arhitectură

PWA de finanțe de familie. Fără framework, fără build, fără npm (Node nu e instalat pe calculator). JavaScript ES modules, UI în română, comentariile din cod în engleză.

## Stack

| Piesă | Alegere | De ce |
|---|---|---|
| Frontend | HTML + CSS + JS vanilla (ES modules), zero dependențe | Rulează pe GitHub Pages așa cum e; niciun cod străin în pagină |
| Randare | helperul `h(tag, attrs, ...copii)` din `js/dom.js` (doar `createElement`/text) | Datele nu pot deveni HTML; `innerHTML` și restul sunt interzise (test care caută în sursă) |
| Autentificare | Google Identity Services, scope `drive.file` + `userinfo.email` | Fără parole proprii, fără server; aplicația vede doar fișierele create/alese de utilizator |
| Date | Google Sheets API v4 direct din browser, cu tokenul utilizatorului | Datele circulă doar telefon ↔ Google |
| Joburi în fundal | Google Apps Script (opțional, vezi `apps-script/README.md`) | Curs BNR automat, backup, sincronizare Calendar |
| Grafice | SVG scris de mână (`js/charts.js`) | 4 tipuri simple, fără bibliotecă |
| Offline | service worker care ține în cache doar fișierele aplicației, niciodată datele | Un telefon pierdut nu scurge solduri |
| Teste | `tests/index.html`, runner de aserțiuni care rulează în browser | Funcționează fără instrumente de build |

Respinse: React/Vite (cer Node), Firebase/Supabase (încă un loc cu datele), scope-ul `spreadsheets` (ar deschide toate foile contului).

## Fluxul de pornire

`index.html` → `js/main.js`: autentificare silențioasă (email reținut) → `files.js` caută fișierele „FIN · Părinți” și „FIN · Iza” prin Drive → rolul se decide din permisiunile Google (poate deschide Părinți = `parent`; doar Iza = `kid`) → router pe hash (`#/active` etc.). Cine nu vede niciun fișier ajunge la `#/setup` (Picker o singură dată).

## Hărți de module

| Zonă | Fișiere | Rol |
|---|---|---|
| Boot și rute | `main.js`, `router.js`, `screens.js` | `screens.js` = tabela cale → ecran (partajată cu pagina de previzualizare) |
| Acces la date | `auth.js`, `picker.js`, `files.js`, `sheets.js`, `store.js`, `model.js`, `app.js` | `app.js` e singurul strat pe care îl văd ecranele; testele îl înlocuiesc cu unul în memorie |
| Calcule PURE (fără DOM, fără rețea) | `money.js`, `calc.js`, `situations.js`, `cash.js`, `iza-plan.js`, `ics.js`, `return.js`, `gifts.js` | Fiecare cifră de pe ecran vine de aici; toate sunt testate |
| UI comun | `dom.js`, `ui.js`, `charts.js`, `notify.js`, `views/wealth-ui.js` | cadrul, bara de jos, formatare, grafice, butoanele de Calendar |
| Ecrane | `views/*.js` | câte un fișier pe ecran (vezi `ECRANE.md`) |
| Seed și schemă | `seed.js`, `schema.js`, `config.js` | conturile inițiale, foile și coloanele, cheile publice Google |
| Joburi | `apps-script/Code.gs`, `Plan.js`, `appsscript.json` | opțional |
| Teste | `tests/` | `index.html` rulează `run.js`; `preview.html` e pagina fără date |

## Convenții care trebuie respectate

1. **Bani = întregi în unități minore** (bani/cenți). Cursurile BNR sunt ×10 000, procentele în puncte de bază (`rate_bp`). Niciodată float pe bani; parsare/formatare doar prin `money.js`.
2. **Date ISO** `YYYY-MM-DD`; `calc.js` le tratează ca UTC, fără ora locală.
3. **Doar adăugare.** Aplicația nu șterge niciun rând. Editare = rândul vechi primește `void=1` + motiv, se adaugă unul nou, iar `audit` primește un rând (`store.js`). Orice regulă „ce contează” ignoră rândurile `void`.
4. **O singură regulă de includere a depozitelor** (`depositIncluded` în `calc.js`): contează de la `start_date`, până la `closed_date` (exclusiv), iar ziua închiderii banii sunt deja în contul de destinație.
5. **Ultima înregistrare câștigă**: la aceeași dată, rândul creat mai târziu (apoi cel de mai jos în foaie) înlocuiește pe cel vechi (`latestBy`).
6. **Fiecare total se arată în lei și în euro**; euro-ul la cursul zilei respective, deci diferențele între date sunt creștere reală în euro.
7. **Fără date reale în cod și în teste.** Sumele, data nașterii, parametrii planului lui Iza sunt doar în foi (`settings`). Testele folosesc cifre inventate.
8. **Titlurile evenimentelor și mesajelor nu conțin sume** (ecran blocat); sumele stau în descriere.
9. **Ecranele nu apelează Google direct**; trec prin `app.model/add/addMany/void`.
10. **Text în română** în UI; scris cu diacritice.

## Service worker (`sw.js`)

- Ține în cache doar fișierele din `SHELL` (lista e în `sw.js`). **Când adaugi un fișier JS nou, adaugă-l în `SHELL` și urcă numele cache-ului (`fa-shell-vNN`).**
- Network-first cu `cache: 'no-cache'` (GitHub Pages lasă browserele să țină fișierele 10 minute), cache doar ca rezervă offline. Nu atinge cereri către alte origini.
- După un deploy, primul refresh poate arăta versiunea veche; al doilea o ia pe cea nouă.

## CSP

Meta CSP în `index.html`: scripturi doar din origine + Google Identity/API; fără scripturi inline; `base-uri 'none'`, `form-action 'none'`. Orice dependență nouă trebuie întâi aprobată aici.
