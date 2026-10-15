# Apps Script: joburile din fundal (OPȚIONAL)

> **Notificările NU depind de acest script.** Se fac direct din aplicație: butonul „Notificare” la fiecare depozit
> (fișier `.ics` sau link Google Calendar) și memento-ul lunar din „Mai mult”. Nu e nevoie de Apps Script, de
> permisiuni noi sau de instalare. Scriptul de aici rămâne în repo doar ca **opțiune**: curs BNR automat, backup
> săptămânal și, dacă îl vrea cineva vreodată, sincronizarea automată cu Calendar. Dacă nu îl instalezi, aplicația
> funcționează la fel.

Rulează în contul lui Ady (proprietarul fișierelor), în Google. Nu conține date private: ID-urile fișierelor și
emailurile sunt „Script Properties”. Nu trimite emailuri; partea de Calendar de mai jos este **opțională**.

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
   | `OWNER_EMAILS` | `{"Ady":"..@gmail.com","Carmen":"..@gmail.com","Iza":"..@gmail.com"}`: adresele la care se invită seria lunară de solduri (Carmen și Iza) |
   | `OWNER_EMAIL` | nu mai e folosită (nu se trimit emailuri de notificare); poate rămâne sau lipsi |
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

Pașii 7 și 9 și seria lunară creată la pasul 10 sunt doar pentru sincronizarea opțională cu Calendar. Pentru curs și backup
sunt de ajuns restul pașilor (`testSetup` cere totuși și permisiunea Calendar, fiindcă manifestul o include).

## Ce face fiecare

| Funcție | Când | Ce |
|---|---|---|
| `dailyRates` | L–V, 10:30 și 13:30 | Citește `bnr.ro/nbrfxrates.xml`, adaugă EUR, USD, XAU (×10 000) în `rates`, în ambele fișiere, dacă data nu există deja cu sursa `BNR`. |
| `dailyCalendarSync` | zilnic 08:00 | Aduce calendarul în acord cu foaia `deposits` (vezi mai jos). Poate rula de câte ori vrei: nu face dubluri. |
| serie „Actualizează soldurile” | pe 15 ale lunii, 09:00 | Eveniment recurent cu notificare la oră, în calendarul lui Ady, cu **Carmen și Iza invitate** (din `OWNER_EMAILS`); descriere: Active → (conturile cu sold vechi apar marcate) → +, apoi Active → Venituri și cheltuieli. Creat o singură dată de `installTriggers`. |
| `syncBalanceGuests` | manual | Adaugă la seria existentă doar invitații care lipsesc (nu retrimite celor deja invitați). |
| `weeklyBackup` | duminică | Copii ale ambelor fișiere în Drive → `Finanțe/backup`, păstrează ultimele 12 din fiecare. |
| `testCalendar` | manual | Eveniment de test peste ~2 minute. |

### Evenimentele depozitelor

Se creează în calendarul principal al lui Ady, doar pentru depozite cu `status = active`, neanulate și fără `closed_date`:

- **Doar Ady**: evenimentele depozitelor nu au invitați, indiferent de titular (titlul spune al cui e depozitul).
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

## Seria de solduri: invitații Carmen și Iza

- Descrierea evenimentului (cu „Active → Venituri și cheltuieli”) se pune doar când seria e **creată**. La o serie deja existentă, schimbă descrierea de mână în Calendar (sau șterge seria și rulează din nou `installTriggers`).

- Seria e creată în calendarul lui Ady (organizator); `installTriggers` adaugă ca invitați adresele Carmen și Iza din
  `OWNER_EMAILS`. Invitația se trimite **doar când o adresă e adăugată prima dată**: la reinstalare sau actualizare, cine
  e deja pe listă nu primește altă invitație. Dacă una din invitații eșuează, se scrie în jurnal (Executări) și
  instalarea continuă. `syncBalanceGuests` repetă doar partea de invitați.
- **Memento-urile ale invitaților nu le controlează Ady**: fiecare primește notificările după propriile setări de Calendar
  (notificările implicite ale calendarului ei/lui). Din script se poate controla doar evenimentul lui Ady (memento la oră)
  și faptul că invitația există. Carmen și Iza trebuie să accepte invitația și să aibă notificările Calendar active.
- **Iza (cont supravegheat, Family Link)**: invitația poate să nu apară sau să ceară aprobarea unui părinte. După
  `installTriggers`, Ady verifică pe telefonul ei că evenimentul „Actualizează soldurile” e în Calendar și că notificările
  Calendar sunt permise; dacă nu apare, se acceptă din contul de părinte sau se adaugă manual.

## Note

- Un curs introdus manual în aplicație rămâne în foaie; cel `BNR` din aceeași zi are prioritate fiindcă e adăugat după el.
- Dacă un job eșuează, Google trimite un email cu eroarea (Setări proiect → Notificări de eșec; verifică că e activat).
- Datele de la BNR apar de obicei în jurul prânzului: a doua rulare (13:30) acoperă publicările întârziate.
