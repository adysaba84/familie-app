# Ecrane și logica lor

Bara de jos (`ui.js`, `TABS`): **Active · Bursă · Depozite · Seif · Conturi · Situații · Mai mult**. Rutele sunt în `js/screens.js` (partajate cu pagina de previzualizare); `main.js` adaugă `/` și `/setup`. Un utilizator cu rol `kid` vede doar ecranul lui Iza, indiferent de rută.

| Rută | Fișier | Ce arată / face |
|---|---|---|
| `#/` , `#/setup` | `login.js`, `setup.js` | Autentificare Google; prima rulare: alege fișierele (Picker) sau creează cele două fișiere (cu confirmare, ca să nu apară fișiere asemănătoare) |
| `#/active` | `active.js` | Totalul în lei și euro, evoluția Wealth 1 pe date reale, structura pe categorii într-o singură listă cu subtotaluri, % din total / % din grupă, rânduri extensibile (sumă nativă + lei + euro), „+” mare pe fiecare categorie. Salvarea din orice formular întoarce la Active cu categoria deschisă (`return.js`) |
| `#/bursa`, `/bursa/nou`, `/bursa/valoare` | `bursa*.js` | Valoarea pe platformă / tip / valută; formularul „sumă investită” și „valoare cont la dată” (câte un câmp pe valută × instrument) |
| `#/depozite`, `/depozite/nou`, `/depozite/inchide` | `depozite.js`, `depozit-nou.js`, `depozit-inchide.js` | Listă grupată pe valută (lei, euro, dolari), ordonată după scadență; bare de scadențe pe 12 luni; BFG; adăugare/modificare/anulare; **închidere la scadență / înainte de scadență / prelungire**, cu `closed_date`, soldul contului de destinație și legătura `renewed_from_id`; depozitele scadente și neînchise sunt marcate. Butonul „Notificare” = eveniment Calendar (.ics sau link) |
| `#/fizice`, `/fizice/nou` | `fizice*.js` | „Seif”: aur, numerar, imobile (casă, mașină, garaj), alte bunuri; valori datate |
| `#/conturi`, `/conturi/solduri` | `conturi.js`, `solduri.js` | Conturi curente, tichete, economii, portofele (per spațiu, fără amestec); „Actualizează toate soldurile” = un formular cu toate conturile, precompletat |
| `#/situatii` | `situatii.js`, `wealth-ui.js` | Poziția familiei pe straturi, vezi mai jos; Părinți / Iza / Total familie; față de sfârșitul lunii trecute sau al anului trecut |
| `#/obligatii` | `obligatii.js` | Pensii (P2, P3, Gent), asigurări, împrumuturi date, carduri de credit (limita se editează aici); nu intră în „Total active” |
| `#/venituri` | `venituri.js`, `cash.js` | Pagina lunară (ziua 15): venituri, investit, cheltuieli estimate pentru toată familia (vezi mai jos) |
| `#/investit` | `investit.js` | „Sume investite”: totalul pus deoparte (depuneri − retrageri la bursă + suma depusă în depozite), pe platformă, pe instrument, depozite pe valută, ultimele 12 mișcări |
| `#/primite` | `primite.js` | „Primite”: jurnal cu banii primiți de Iza (data, de la cine, sumă, valută, motiv, descriere). Listele „De la cine” și „Motiv” vin din ce e deja în foaie, plus „Altele…” cu text liber; filtru pe persoană, istoric pe ani cu totaluri pe valută (fără conversie), „anulează” (void), import local din CSV cu confirmare. Nu e legat de nicio altă statistică |
| `#/iza/primit` | `kid-primit.js` | „Am primit un dar”: formularul lui Iza, pe pagină separată (de la cine, cât, valută, când, motiv, poveste scurtă; liste din foaie + „Altele…”). Butonul „➕ Am primit un dar” e în „Darurile mele”. Iza nu poate scrie `audit`, deci rândurile ei se salvează fără rând de audit (`created_by` e contul ei); părinții o văd și o pot corecta din „Primite” |
| `#/curs` | `curs.js` | Curs BNR introdus manual (rezervă până merge scriptul) |
| `#/iza` | `kid.js`, `kid-fun.js` | Ecranul lui Iza (și previzualizarea pentru părinți, „Modul copil”) |
| `#/mai-mult` | `mai-mult.js` | Fișierele și rolul, linkuri către Sume investite, Pensii și datornici, Vezi ca Iza, Curs BNR, Alege fișierele; memento lunar „Actualizează soldurile” în Calendar |

## Straturile din Situații (`situations.js`)

- **DISPONIBIL**: conturi curente, portofele, tichete, economii, depozite, numerar din seif, carduri de credit ca `sold − limită`, și (la Iza) asigurarea la valoarea de răscumpărare.
- **PENSII**: „disponibile cu vânzare” (bursă, aur, Gent) și „indisponibile până la pensie” (pilonii P2, P3).
- **INDISPONIBIL**: imobile, alte bunuri, împrumuturi date.
- **WEALTH 1** = disponibil + pensii cu vânzare (fără piloni, fără împrumuturi, fără imobile).
- **WEALTH 2** = Wealth 1 + imobile.
- **WEALTH 3** = tot (inclusiv piloni, împrumuturi, alte bunuri).
- Valorile în lei, euro la cursul fiecărei date. Imobilele au aceeași valoare în euro la toate datele, ca să nu apară drept creștere.
- Totalurile din Excel pentru date vechi vin din foaia `snapshots`, doar cât nu există înregistrări detaliate.

## Venituri și cheltuieli (`cash.js`)

`cheltuieli estimate = venituri + dobânzi depozite − investit − (Disponibil_cash(d1) − Disponibil_cash(d0))`, pentru toată familia (un transfer între conturile lor se anulează singur). Disponibil_cash exclude linia „Asigurări” (NN-ul lui Iza e investiție). Ambele solduri folosesc cursul din d1, deci mișcarea cursului nu e venit sau cheltuială. E un rest, nu o evidență a cheltuielilor; paginile cu conturi fără sold la capete sunt marcate „nesigur”.

## Ecranul lui Iza (`kid.js`, `kid-fun.js`)

Doar citire (Google impune; UI-ul e cosmetic). Cifre: total acum, estimare la 18 ani (`iza-plan.js`, scenariu moderat, parametrii din `settings`), cinci „cutii”: Euro și dolari, Asigurarea NN, Bursa, Împrumut la stat, Contul de economii. Portofelul și cardul sunt editabile de ea (foaia `wallet_balances`). Partea jucăușă (`kid-fun.js`): bară colorată cu legendă (aceeași culoare per cutie peste tot), semafor de risc 🟢🟡🔴, „Vrei să afli mai mult?” (ce este / cum câștigă / la ce să te uiți), „Joacă-te cu banii” (cursor lunar → cât ar crește până la 18 ani), „Darurile mele” (`kid-daruri.js`, din foaia `gifts`: notă că sunt doar banii primiți în conturi până la 14 ani, total cu numărare animată, bară și legendă cu top 10 persoane: procentul numără euro și dolarii în lei la ultimul curs din fișier, suma se arată pe valute („23.500 lei + 500 €”), iar cine a dat o singură dată sub 25 lei e lăsat afară din bară, buton „➕ Am primit un dar”, ultimele 5 daruri ca fișe cu iconiță după motiv, „Arată toate” pe ani; nu spune „cutie”, banii sunt deja în cutii), „Școala banilor” (6 lecții), „Știai că?”, confetti și numărare animată; animațiile se opresc la `prefers-reduced-motion`. „Descarcă PDF” = dialogul de tipărire. Textele educative sunt generale (nu conțin date personale); verifică-le înainte de a le schimba, mai ales la asigurarea NN.

## Estimarea la 18 ani (`iza-plan.js`)
Proiecție lunară până la fiecare zi de naștere: euro; cutiile în lei pierd `fx_drift` pe an față de euro; depozitele în valută nu. Rate: depozite = media netă ponderată; economii = rata contului; bursă/NN/obligațiuni din `settings` (cu valori implicite publice). Fără `birth_date` nu se calculează.
