# Securitate

Repo-ul e **public** (Pages gratuit cere asta): conține doar cod. Datele sunt în două Google Sheets accesibile doar celor trei conturi.

## Ce e public și de ce e în regulă
- `js/config.js`: `CLIENT_ID` OAuth și `API_KEY` (Picker). Sunt publice prin natura lor, dar **trebuie restricționate în Google Cloud** (vezi mai jos).
- `js/seed.js`: lista conturilor inițiale (bănci, prenume ale titularilor). Fără numere de cont, fără solduri.
- Testele și `tests/preview.js?demo`: doar cifre inventate.
- Nu e în repo: sume reale, data nașterii, parametrii planului lui Iza, ID-urile fișierelor, emailuri (în afară de autorul commit-urilor), tokenuri.

## Modelul de securitate (toate trebuie să rămână adevărate)
1. Nicio dată reală în repo. `.gitignore`: `*.csv`, `*.xlsx`, `.env` (de adăugat și exporturi JSON, `.clasp.json`).
2. Două fișiere deținute de Ady; Părinți: Editor pentru Carmen, Iza fără acces; Iza: Editor părinți, Viewer Iza. Niciodată „oricine are linkul”.
3. Pe cele trei conturi Google: passkey + verificare în doi pași.
4. Ecranul de consimțământ OAuth: **In production** (publicat 2026-10-15, ca autorizarea să nu expire la 7 zile cât a fost în „Testing”). Scope-urile `drive.file` și email sunt nesensibile, deci fără verificare Google. Oricine are un cont Google poate deschide pagina, dar aplicația vede doar fișierele pe care i le dă utilizatorul; protecția reală e partajarea fișierelor „FIN” (doar cele 3 conturi). Politica de confidențialitate e `privacy.html` (publică, fără emailuri). Origini JavaScript autorizate: `https://adysaba84.github.io` și `http://localhost:8080` (sau portul folosit local).
5. Cheia API restricționată la referreri HTTP (`https://adysaba84.github.io/*`, `http://localhost:*`) și doar la Picker API.
6. Tokenul stă doar în memorie (variabilă JS): niciodată `localStorage`, `sessionStorage`, cookie-uri sau URL. Expiră în ~1 oră; „Ieșire” îl revocă. Se reține doar emailul ca indiciu de autentificare.
7. CSP în `index.html`; fără scripturi inline.
8. Fără `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval`/`new Function`: `tests/security.test.js` caută în sursă și pică.
9. Rolul îl decide Google, nu aplicația. Ascunderea din UI e doar cosmetică.
10. Doar adăugare (`void` + rând nou) și un rând `audit` la fiecare scriere.
11. Backup săptămânal în Drive doar dacă se instalează Apps Script (opțional).
12. Folderul local privat (`C:\Users\adysa\Finante`) nu se urcă niciodată.
13. Scope `drive.file`: aplicația ajunge doar la fișierele create sau alese de utilizator.

## Verificări de făcut periodic (pașii îi face utilizatorul în Google Cloud Console)
- Cheia API: Credentials → cheia → restricții de aplicație (referreri) și de API (doar Picker).
- Clientul OAuth: la „Authorized JavaScript origins” doar originile de mai sus.
- Ecranul de consimțământ: stare „In production”, doar scope-urile `drive.file` și email (la „Data Access”); linkul de politică de confidențialitate duce la `privacy.html`.
- Fișierele: Partajează → verifică lista de persoane și că linkul nu e public.

## Recenzie de securitate (2026-10-15)
Rulat `security-review` pe cod și pe ce e public în repo: nicio vulnerabilitate cu încredere mare. Rămân de verificat doar restricțiile cheii API (de mai sus) și igiena `.gitignore`. Istoricul git (47 de commit-uri la acea dată) nu conține secrete.

## Reguli pentru modificări
- Nu adăuga dependențe externe sau scripturi din alte origini fără a actualiza și CSP, și această listă.
- Înainte de fiecare push: rulează testele și treci prin lista de mai sus.
- Nu pune date reale în teste, în `preview.js` sau în comentarii. Pagina de previzualizare primește date reale doar din consolă (`__setModels`), local, necomise.
