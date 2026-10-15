# Apps Script: joburile din fundal

Rulează în contul lui Ady (proprietarul fișierelor), în Google. Nu conține date private: ID-urile fișierelor și
emailurile sunt „Script Properties”. **Notificările vin doar prin Google Calendar** (aplicația Calendar de pe telefon);
nu se mai trimite niciun email.

Proiectul are două fișiere de cod: `Code.gs` (joburile) și `Plan` (din `apps-script/Plan.js`: logica de planificare a
evenimentelor, fără acces la Google, testată în `tests/calendar.test.js`), plus manifestul `appsscript.json`.

## Instalare de la zero (~10 minute)

1. Deschide https://script.google.com → **Proiect nou**. Numește-l `familie-app jobs`.
2. Înlocuiește conținutul fișierului `Code.gs` cu cel din `apps-script/Code.gs`.
3. Adaugă un al doilea fișier: **+ → Script**, numește-l `Plan` (editorul adaugă singur `.gs`) și lipește conținutul din
   `apps-script/Plan.js`.
4. **Setări proiect** (rotița) → bifează „Afișează fișierul manifest `appsscript.json`”, apoi înlocuiește-i conținutul cu
   `apps-script/appsscript.json` (fusul orar și permisiunile, inclusiv Calendar).
5. **Setări proiect → Proprietăți script → Adaugă proprietate**:
   | Proprietate | Valoare |
   |---|---|
   | `FILE_PARENTS` | ID-ul fișierului `FIN · Părinți` (partea dintre `/d/` și `/edit` din link) |
   | `FILE_IZA` | ID-ul fișierului `FIN · Iza` |
   | `OWNER_EMAIL`, `OWNER_EMAILS` | nu mai sunt folosite de notificări (nu se trimit emailuri); pot rămâne sau lipsi |
6. În editor alege funcția `testSetup` → **Rulează**. Google cere permisiuni (o singură dată): *Revizuiește
   permisiunile → contul tău → Avansat → Permite* (foi de calcul, Drive, **Calendar**). Funcția citește ambele fișiere și
   creează + șterge un eveniment de test în Calendar; dacă trece fără eroare, accesul e bun.
7. Rulează `testCalendar`: apare în calendarul tău un eveniment „Test notificare Finanțe” peste ~2 minute. **Verifică că
   notificarea ajunge pe telefon** (vezi mai jos). Evenimentul de test se șterge singur a doua zi.
8. Rulează `dailyRates` o dată: în foaia `rates` din ambele fișiere apare rândul BNR de azi.
9. Rulează `dailyCalendarSync` o dată: creează acum evenimentele depozitelor (poți verifica în Calendar).
10. Rulează `installTriggers`: creează programările (curs L–V 10:30 și 13:30, `dailyCalendarSync` zilnic 08:00, backup
    duminică 03:00) și **o singură serie lunară** „Actualizează soldurile” pe 15, la 09:00.

## Actualizare dintr-un script deja instalat (cel cu emailuri)

1. Înlocuiește `Code.gs` cu cel nou, adaugă fișierul `Plan` (pasul 3 de mai sus) și înlocuiește `appsscript.json`
   (scope-ul `script.send_mail` dispare, apare `calendar`).
2. Rulează `testSetup`: Google cere din nou permisiuni (a apărut Calendar). *Permite*.
3. Rulează `testCalendar` (notificare pe telefon), apoi `installTriggers`. Ea șterge **toate** programările vechi
   (inclusiv `dailyNotifications` și `monthlyReminder`, care nu mai există) și le creează pe cele noi.
4. `installTriggers` poate fi rulată oricând din nou: nu creează o a doua serie lunară (o recunoaște după titlu).

## Ce face fiecare

| Funcție | Când | Ce |
|---|---|---|
| `dailyRates` | L–V, 10:30 și 13:30 | Citește `bnr.ro/nbrfxrates.xml`, adaugă EUR, USD, XAU (×10 000) în `rates`, în ambele fișiere, dacă data nu există deja cu sursa `BNR`. |
| `dailyCalendarSync` | zilnic 08:00 | Aduce calendarul în acord cu foaia `deposits` (vezi mai jos). Poate rula de câte ori vrei: nu face dubluri. |
| serie „Actualizează soldurile” | pe 15 ale lunii, 09:00 | Eveniment recurent cu notificare la oră; descriere: Active → (conturile cu sold vechi apar marcate) → +. Creat o singură dată de `installTriggers`. |
| `weeklyBackup` | duminică | Copii ale ambelor fișiere în Drive → `Finanțe/backup`, păstrează ultimele 12 din fiecare. |
| `testCalendar` | manual | Eveniment de test peste ~2 minute. |

### Evenimentele depozitelor

Se creează în calendarul principal al lui Ady, doar pentru depozite cu `status = active`, neanulate și fără `closed_date`:

- **Scadență**: în ziua scadenței, 09:00 (30 min), titlu „Scade depozitul BANCĂ · TITULAR” (fără sume, ca să nu se vadă pe
  ecranul blocat), notificări cu **3 zile înainte** și **la oră**. Descrierea are suma, valuta, dobânda, scadența și
  „Deschide aplicația → Active → Depozite → Prelungește / Închide”.
- **Scadent și neprelungit**: dacă un depozit e încă `active` după scadență, apare **un singur** eveniment („Depozit scadent
  — prelungește sau închide: …”) a doua zi la 09:00, cu notificare la oră. Nu se mută zi de zi.
- Fiecare eveniment poartă eticheta internă `famDep` = id depozit, prin care scriptul îl regăsește.

**Ce se întâmplă când se schimbă o dată** (la următoarea rulare de 08:00 sau când rulezi `dailyCalendarSync`):

| În aplicație | În Calendar |
|---|---|
| depozit închis la scadență / înainte de scadență, prelungit | evenimentul dispare; pentru prelungire apare cel al noului depozit |
| depozit anulat sau modificat (aplicația face rând nou) | evenimentul vechi dispare, apare cel nou |
| scadență mutată (dar același depozit) | evenimentul se mută pe noua dată |
| sumă / dobândă schimbată | descrierea se actualizează |
| scadența a trecut, depozitul e încă activ | apare evenimentul „scadent”; dispare când îl închizi / prelungești |

Dacă mută cineva un eveniment de mână în Calendar, scriptul îl readuce pe data din foaie la următoarea rulare. Dacă
ștergi un eveniment de mână, se recreează la următoarea rulare cât timp depozitul e activ.

## Cum verifici pe telefon că notificările Calendar sunt active

- Aplicația **Google Calendar** instalată și autentificată cu contul lui Ady; calendarul principal bifat (afișat).
- Android: *Setări → Aplicații → Calendar → Notificări* permise. În aplicația Calendar: *Setări → [contul tău] →
  Notificări* (notificările pentru evenimente pornite). iPhone: *Setări → Notificări → Calendar* permise.
- Fără „Nu deranja” / mod economisire care oprește aplicația în fundal în jurul orei evenimentului.
- Testul sigur: rulezi `testCalendar` și ai notificarea pe telefon peste ~2 minute.

## Note

- Nu se invită nimeni (Carmen etc.) la evenimente: apar doar în calendarul lui Ady. Invitarea ar trimite emailuri de
  invitație; dacă o vrem mai târziu, e o schimbare separată.
- Un curs introdus manual în aplicație rămâne în foaie; cel `BNR` din aceeași zi are prioritate fiindcă e adăugat după el.
- Dacă un job eșuează, Google trimite un email cu eroarea (Setări proiect → Notificări de eșec; verifică că e activat).
- Datele de la BNR apar de obicei în jurul prânzului: a doua rulare (13:30) acoperă publicările întârziate.
