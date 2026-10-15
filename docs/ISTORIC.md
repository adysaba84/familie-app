# Istoric și decizii

Proiect început pe 2026-10-14, în câteva zile intense, în sesiuni Claude Code. Planul inițial (privat) a fost împărțit în jaloane M0–M7; după ele au venit funcții cerute pe parcurs.

## Jaloane (din git)

| Data | Ce a intrat |
|---|---|
| 14 oct | **M0** schelet + autentificare Google, cheie publică restricționată. **M1** shell: auth, fișiere prin Drive (fără Picker per dispozitiv), rol din permisiuni, router, PWA, service worker, CSP. **M2** `money`, `calc`, `model`, `store` + runner de teste (63 de teste, inclusiv grep de securitate). **M3** Active, Bursă, sumă investită, valoare cont, curs manual, pagină de previzualizare. **M4** Depozite, Seif, Conturi, „Actualizează toate soldurile”. **M5** ecranul lui Iza (cinci cutii, estimare la 18 ani, scara de creștere, PDF, parametri privați în `settings`). **M6** joburi Apps Script. Apoi: portofele, asigurare NN ca categorie proprie, totaluri în lei și euro, depozite pe valută, card + portofele editabile de Iza, **Situații** (disponibil / bursă și aur / indisponibil / wealth), Pensii și datorii, imobile |
| 14–15 oct | Foaia `snapshots` (totaluri din Excel pentru date vechi) și o pagină „Verificare date” (31 dec / 26 sept / azi); folosită la validarea cifrelor cu Excelul, apoi **ștearsă** (validarea s-a terminat) |
| 15 oct | **Depozite**: închidere la scadență / înainte / prelungire, regulă unică de includere, scadente marcate. **Straturi**: Disponibil / Pensii / Indisponibil, Wealth 1 și 2; apoi Active reproiectat (o singură listă pe categorii, „+” pe categorie, întoarcere la Active după salvare). **Apps Script** doar prin Calendar (fără emailuri) și apoi marcat opțional. **Venituri și cheltuieli** (pagină lunară pentru toată familia). **Buton Notificare** (.ics / Google Calendar). **Bară jos** cu cele 6 locuri + Mai mult. **Wealth 3** (tot) + categoria „Alte bunuri”. **Modul copil „fun”** și educație financiară. **Sume investite** în Mai mult. 17 evenimente de scadență puse în Calendar prin conectorul Google Calendar |

## Decizii care nu se văd din cod
- **Google Sheets ca bază de date, fără backend**: simplu, în contul familiei, datele nu ies din Google.
- **Doar adăugare**: istoricul rămâne complet; o corecție e un rând nou.
- **Rolul îl dă Google**: permisiunea pe fișier, nu o setare a aplicației.
- **Portofelele nu se preiau din Excel**: conturile există, soldurile le introduc Ady sau Iza.
- **Fără protecții pe foile lui Iza**: „e responsabilă”. Nu se schimbă fără cerere explicită.
- **„Primite” e un jurnal separat**: nu intră în niciun total, fără conversii valutare; dobânzile nu sunt daruri; modul copil îl numește „Darurile mele”, nu „cutie” (banii stau deja în cutii). Iza scrie rânduri fără audit (nu poate scrie `audit`).
- **Cardurile de credit** se numără în Disponibil ca `sold − limită`.
- **Gent Carmen** = asigurare cu acumulare, la valoarea de răscumpărare; contează ca disponibil (cu vânzare) în Pensii. **Gent Ady** intră în partea lui Iza.
- **Obligațiunile** (inclusiv titluri de stat) rămân la valoarea investită până se introduce o valoare.
- **Grafice simple și etichetate**: graficele stivuite nu s-au înțeles; s-au păstrat bare și linii cu valori scrise.
- **Notificările**: inițial emailuri, apoi doar Calendar, apoi direct din aplicație (buton .ics). Fără emailuri.
- **Contul lui Iza e supravegheat (Family Link)**: autentificarea ei poate să nu meargă; părinții folosesc „Modul copil”.
- **Wealth 1/2/3** au definiții fixe (vezi `ECRANE.md`); „fără hidden” din Excel a rămas neclar și nu s-a replicat.

## Ramuri locale
Lucrul s-a făcut pe ramuri tematice, toate unite în `main`: `depozite-inchidere`, `straturi-pensii`, `notificari-calendar`, `notificare-buton`, `venituri-cheltuieli`, `bara-jos`, `wealth-3`, `modul-copil-fun`. Pot fi șterse local fără pierderi. Convenție de lucru: ramură per temă, apoi merge fast-forward în `main` și push.
