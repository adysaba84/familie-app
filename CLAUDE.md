# familie-app (instrucțiuni pentru Claude)

PWA de finanțe de familie, repo **public**, GitHub Pages, date în Google Sheets. Răspunde în română, scurt și clar. UI în română; comentariile din cod în engleză. Nu există Node: folosește Python pentru server local.

## Reguli care nu se negociază
1. **Nicio dată reală în repo**: sume, data nașterii, parametrii planului lui Iza, ID-urile foilor, emailuri. Testele și previzualizarea folosesc doar cifre inventate. Datele reale se încarcă local din consolă și nu se comit.
2. **Fără dependențe, fără build, fără `innerHTML`/`eval`**; randare doar prin `h()` din `js/dom.js`. CSP-ul din `index.html` rămâne strict.
3. **Bani = întregi în unități minore**, cursuri ×10 000, procente în puncte de bază. Calculele sunt funcții pure în `js/` (testate).
4. **Doar adăugare în foi**: `void=1` + rând nou + rând `audit`. Nu șterge rânduri.
5. Nu modifica foile fără confirmarea utilizatorului; nu ghici sensul unei cifre financiare, întreabă; nu pune protecții pe foile lui Iza fără cerere.
6. Nu da sfaturi de investiții personalizate; doar calcule și verificări.
7. Rulează testele (`tests/index.html`) înainte de push; push direct pe `main` e deploy. Fișier JS nou → în `SHELL` din `sw.js` + urcă `CACHE`.
8. Nu urca niciodată folderul privat `C:\Users\adysa\Finante` (planuri, transcrieri, ID-uri de foi, starea datelor).

## Unde găsești ce (citește doar ce atinge sarcina)
- `docs/ARHITECTURA.md` cod și convenții · `docs/MODEL-DATE.md` foi · `docs/ECRANE.md` ecrane · `docs/OPERARE.md` rulare/deploy/Calendar/conector · `docs/SECURITATE.md` · `docs/ISTORIC.md` · `docs/PLAN-SI-DE-FACUT.md` stare și backlog.
- Privat (în afara repo-ului): `C:\Users\adysa\Finante\CLAUDE.md` și `docs/` de acolo: ID-urile foilor, starea datelor, indexul sesiunilor anterioare, prompt de reluare.

## Când termini o funcție
Actualizează documentul potrivit din `docs/` (nu adăuga narațiune per funcție aici), mută linia în `PLAN-SI-DE-FACUT.md`, apoi commit și push. Acest fișier se schimbă doar pentru reguli generale.
