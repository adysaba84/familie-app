# Starea acum și ce urmează

Actualizat la 2026-10-15 (proiect pus pe pauză după „Primite”). Mută o linie din „De făcut” în „Gata” când se termină și actualizează `ECRANE.md` / `MODEL-DATE.md` dacă s-a schimbat comportamentul.

## Gata
M0–M6 (vezi `ISTORIC.md`), Situații cu Wealth 1/2/3, pensii/datorii/carduri, depozite cu închidere și prelungire, Venituri și cheltuieli, Sume investite, ecranul lui Iza (cu educație financiară), „Primite” (jurnal de daruri, adulți și „Darurile mele” în modul copil), notificări Calendar (buton .ics și evenimente puse prin conectorul Google Calendar), previzualizare cu date inventate. Datele reale sunt importate în ambele foi și validate cu Excelul vechi (M7).

## De făcut / deschis
1. **Cheia API din Google Cloud** (verificat în consolă la 2026-10-15, doar citire): cheia „familie-app picker” e limitată la **Google Picker API**, dar „Application restrictions” = **None**. De făcut de utilizator: Credentials → cheia → Application restrictions → **Websites** → `https://adysaba84.github.io/*` și `http://localhost:8080/*` → Save (efect în ~5 minute). Verificate OK: consimțământ In production/External (3 utilizatori), un singur client OAuth cu originile `https://adysaba84.github.io` și `http://localhost:8080`, fără redirect URI, fără conturi de serviciu.
2. **Calendar la depozite noi sau prelungite**: evenimentele din 15 oct sunt statice. Opțiuni: le cere din nou lui Claude când se schimbă un depozit, sau instalează Apps Script (`apps-script/README.md`, opțional, îl instalează Ady) pentru sincronizare automată.
3. **Curs BNR automat**: `bnr.ro` nu dă XML de pe calculatorul de dezvoltare; până atunci, manual. Scriptul Apps Script îl rezolvă dacă e instalat.
4. **`.gitignore`**: adaugă `*.json` exporturi, `.clasp.json`, `.claude/`.
5. **Prenume și bănci din `seed.js`** (repo public): de mutat într-un loc privat dacă deranjează.
6. **Părinții să poată edita sumele lui Iza din „Modul copil”** (acum doar ea, în portofel și card).
7. **Nu sunt în v1**: buget pe categorii de cheltuieli, planuri lunare de investiții într-o atingere, scriere fără internet.
8. **Textele educative din ecranul lui Iza**: revizuite doar de autor; confirmă-le (mai ales detaliile asigurării NN).
9. **Ramuri locale** unite în `main`: de șters (`git branch -d …`).
10. **Calendarul „Familie”** există în contul lui Ady; evenimentele de scadență au mers în calendarul principal. Dacă se vrea partajat cu Carmen, se mută sau se re-creează acolo.

11. **„Primite” — stare (2026-10-15)**: importat din „Situatie KID CONT” în foaia `gifts` din FIN · Iza (210 rânduri; 15 „Randament” anulate, 4.824 lei din aug 2025 rămas la „Părinți”; Lucian/Grazelia = „Bunicul Lucian”/„Bunica Grazelia”). Încă netestat: Iza adaugă un dar cu contul ei (dacă dă „Nu am putut salva”, foaia `gifts` e protejată pentru ea în Drive). De verificat: ortografia numelor, rândurile fără motiv (mai ales oct. 2024), „Deea cu Diko” și „Bunicii Campean” (nume unite din variante). Dacă se vor totaluri unice lei+euro+dolari: conversie la cursul BNR (acum pe valute separate).
12. **Viteza aplicației** (de văzut mai târziu): foile sunt mici, deci nu ele încetinesc. Bănuit: pornirea. Sunt ~55 de fișiere în `SHELL`, iar `sw.js` le cere pe fiecare cu `no-cache` (network-first), iar modulele ES se încarcă în cascadă; fiecare fișier nou adaugă o cerere. Apoi 3 cereri Google în serie la prima încărcare a unui fișier și reîncărcarea datelor după fiecare salvare. Idei: service worker stale-while-revalidate sau cache-first cu `CACHE` urcat la deploy; încărcarea ambelor fișiere în paralel; măsurare pe telefon înainte de orice schimbare.

## Reguli la reluare (pe scurt)
- Citește `CLAUDE.md`, apoi doar documentul care atinge sarcina: `ARHITECTURA.md` (cod), `MODEL-DATE.md` (foi), `ECRANE.md` (ecrane), `OPERARE.md` (rulare, deploy, Calendar, conector), `SECURITATE.md` (reguli).
- Datele reale și ID-urile foilor sunt în folderul privat `C:\Users\adysa\Finante` (nu în repo).
