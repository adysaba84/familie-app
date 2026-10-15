# Operare: rulare, teste, deploy, Google, Calendar

## Rulare locală
Din folderul proiectului (Python e instalat, Node nu):

```bash
python -m http.server 8080
```

- Aplicația reală: `http://localhost:8080` (autentificarea Google merge doar de pe origini autorizate în Google Cloud, deci `8080`).
- Pagina fără date: `http://localhost:8080/tests/preview.html`. Cu `?demo` se încarcă singură cifre inventate și deschide ecranul lui Iza: `tests/preview.html?demo`. Pentru alte ecrane, încarci un model din consolă: `__setModels({ parents: { tab: [[antet],[rând],…] }, iza: {…} })` (rândurile ca în Sheets). Date reale se încarcă doar local, niciodată în fișiere comise.
- Dacă portul e ocupat, alt port merge pentru previzualizare și teste (nu pentru autentificare).

## Teste
Deschide `http://localhost:8080/tests/` într-un browser: rulează `tests/run.js` (suitele: money, model, calc, deposits, iza-plan, situations, charts, cash, return, calendar, ics, security; ~180 de teste). Rezumatul e în elementul `#summary` (`data-fail` = numărul de teste picate). **Rulează-le înainte de fiecare push.** Fișier de test nou → adaugă-l în lista `suites` din `tests/run.js`.

## Verificare în panoul Browser al aplicației Claude
- Panoul nu are service workers. Modulele pot rămâne în cache: înainte de reload rulează `fetch(url, { cache: 'reload' })` pe fișierele schimbate (lista e în `sw.js`).
- Verifică vizual la 390 px (`resize_window` mobile), apoi readu la `desktop`.
- Animațiile (numărare, bare) stau pe loc cât timp panoul e ascuns; fă-l vizibil înainte de captură.

## Deploy
Push direct pe `main` = deploy pe GitHub Pages (1–3 minute): `https://adysaba84.github.io/familie-app/`. Verifică apoi cu `curl` că fișierul nou e servit. Commit-urile poartă linia `Co-Authored-By` cerută de sesiune. Fișier JS nou → în `SHELL` din `sw.js` și urcă `CACHE` (`fa-shell-vNN`; acum v21).

## Configurare Google (o singură dată, pașii îi face Ady)
1. Google Cloud: proiect „familie-app”, activate Sheets API, Drive API, Picker API.
2. Ecran de consimțământ: External, **In production** (altfel autorizarea expiră la 7 zile), scope `drive.file` (+ email), politică de confidențialitate `https://adysaba84.github.io/familie-app/privacy.html`. Ca să poți publica, Google cere pe Branding: nume, email de suport, home page, politică de confidențialitate, domeniu autorizat și email de contact.
3. OAuth client Web cu originile din `SECURITATE.md` → `CLIENT_ID` în `js/config.js`.
4. Cheie API restricționată (referreri + doar Picker) → `API_KEY` în `js/config.js`.
5. Prima rulare: fișierele „FIN · …” există deja (create de Ady, partajate cu Carmen și Iza); fiecare le alege o dată cu „Alege fișierele” (Picker). Butonul „Creează fișierele” a fost scos din aplicație, ca un cont străin să nu poată crea fișiere pre-umplute cu conturile familiei (`seed.js`). Dacă fișierele s-ar pierde, se recreează din cod (istoric git) sau manual din Sheets.
6. Carmen și Iza deschid aplicația o dată → „Alege fișierele” (Picker). Contul lui Iza e supravegheat (Family Link), deci autentificarea ei poate eșua: părinții folosesc „Modul copil”.
7. Passkey + 2SV pe cele trei conturi.

## Notificări în Calendar
Trei căi, de la cea mai simplă:
1. **Buton în aplicație**: „Notificare” la fiecare depozit (Depozite, rând extins; și în Active) descarcă un `.ics` (alarmă la 3 zile și la oră) sau deschide un link Google Calendar. După un depozit nou sau o prelungire apare o sugestie. În „Mai mult” e memento-ul lunar „Actualizează soldurile” (ziua 15, 09:00). Fără instalare, fără permisiuni noi.
2. **Prin conectorul Google Calendar al lui Claude** (cum s-au creat evenimentele din 15 oct 2026): Claude citește foaia `deposits` din ambele fișiere (conectorul Google Sheets), ia depozitele `active`, ne-`void`, fără `closed_date`, și creează în calendarul principal câte un eveniment per depozit: titlu „Scade depozitul BANCĂ · TITULAR” (fără sumă), 09:00–09:30, disponibilitate liberă, alarme popup la 4320 min și la 0; descrierea are banca, suma, dobânda, scadența și „Deschide aplicația → Active → Depozite → Prelungește / Închide”. Nu se actualizează singur: la un depozit nou, prelungit sau închis se cere din nou (evită dublurile verificând întâi calendarul).
3. **Apps Script** (opțional, `apps-script/README.md`): sincronizare automată zilnică, curs BNR, backup săptămânal.

## Scrierea în foi cu conectorul Google Sheets (Claude)
- ID-urile fișierelor se află în folderul privat (`Finante`), nu în repo.
- Datele ISO se scriu cu prefix `'` (altfel Sheets le face date seriale); numerele ca numere; verifică valorile după scriere.
- Niciodată ștergere: `void=1` + motiv, apoi rând nou, plus rând în `audit`.
- Nu ghici sensul unei cifre; întreabă (ex. „sold” la carduri).
- Nu modifica nimic în foi fără confirmarea utilizatorului. Nu pune protecții pe foile lui Iza fără să ceară (decizie: „e responsabilă”).

## Curs BNR
`bnr.ro/nbrfxrates.xml` nu răspunde cu XML de pe calculatorul de dezvoltare. Până merge scriptul Apps Script, cursul se introduce de mână în „Mai mult → Curs BNR”. Totalurile cer un curs valabil la data respectivă.
