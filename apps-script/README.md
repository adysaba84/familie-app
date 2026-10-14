# Apps Script: joburile din fundal

Rulează în contul lui Ady (proprietarul fișierelor), în Google. Nu conține date private: ID-urile fișierelor și
emailurile sunt „Script Properties”.

## Instalare (o singură dată, ~10 minute)

1. Deschide https://script.google.com → **Proiect nou**. Numește-l `familie-app jobs`.
2. Înlocuiește conținutul fișierului `Code.gs` cu cel din `apps-script/Code.gs`.
3. **Setări proiect** (rotița) → bifează „Afișează fișierul manifest `appsscript.json`”, apoi înlocuiește-i conținutul cu
   `apps-script/appsscript.json` (fusul orar și permisiunile).
4. **Setări proiect → Proprietăți script → Adaugă proprietate**:
   | Proprietate | Valoare |
   |---|---|
   | `FILE_PARENTS` | ID-ul fișierului `FIN · Părinți` (partea dintre `/d/` și `/edit` din link) |
   | `FILE_IZA` | ID-ul fișierului `FIN · Iza` |
   | `OWNER_EMAIL` | emailul lui Ady (primește mereu o copie) |
   | `OWNER_EMAILS` | `{"Ady":"..@gmail.com","Carmen":"..@gmail.com","Iza":"..@gmail.com"}` |
5. În editor alege funcția `testSetup` → **Rulează**. Google cere permisiuni (o singură dată): *Revizuiește
   permisiunile → contul tău → Avansat → Permite*. Ar trebui să primești un email „Test Finanțe”.
6. Rulează `dailyRates` o dată: în foaia `rates` din ambele fișiere apare rândul BNR de azi.
7. Rulează `installTriggers`: creează programările (curs L–V 10:30 și 13:30, notificări zilnic 08:00, reminder pe 1 ale
   lunii 09:00, backup duminică 03:00).

## Ce face fiecare

| Funcție | Când | Ce |
|---|---|---|
| `dailyRates` | L–V, 10:30 și 13:30 | Citește `bnr.ro/nbrfxrates.xml`, adaugă EUR, USD, XAU (×10 000) în `rates`, în ambele fișiere, dacă data nu există deja cu sursa `BNR`. |
| `dailyNotifications` | zilnic 08:00 | Depozitele active ale căror `notify_days` au venit: email proprietarului contului + lui Ady, o singură dată (cheia din `notifications_log`). Fără sume în subiect. |
| `monthlyReminder` | 1 ale lunii | Email cu conturile fără sold de peste 30 de zile. |
| `weeklyBackup` | duminică | Copii ale ambelor fișiere în Drive → `Finanțe/backup`, păstrează ultimele 12 din fiecare. |

## Note

- Un curs introdus manual în aplicație rămâne în foaie; cel `BNR` din aceeași zi are prioritate fiindcă e adăugat după el.
- Dacă un job eșuează, Google trimite un email cu eroarea (Setări proiect → Notificări de eșec; verifică că e activat).
- Datele de la BNR apar de obicei în jurul prânzului: a doua rulare (13:30) acoperă publicările întârziate.
