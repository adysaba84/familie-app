# familie-app

PWA de finanțe de familie (Ady, Carmen, Iza). **Doar cod în acest repo, nicio dată**: datele stau în două Google Sheets accesibile doar celor trei conturi Google. Fără framework, fără build, fără npm. JavaScript ES modules, UI în română.

- Aplicația: https://adysaba84.github.io/familie-app/ (GitHub Pages; push pe `main` = deploy în 1–3 minute)
- Rulare locală: `python -m http.server 8080`, apoi http://localhost:8080
- Teste: http://localhost:8080/tests/ (rulează în browser)
- Previzualizare fără date: http://localhost:8080/tests/preview.html?demo (cifre inventate, ecranul lui Iza)

## Documentație (`docs/`)

| Document | Când îl citești |
|---|---|
| [ARHITECTURA](docs/ARHITECTURA.md) | modifici cod: stack, hartă de module, convenții (bani, void, CSP, service worker) |
| [MODEL-DATE](docs/MODEL-DATE.md) | atingi foile: coloane, tipuri de conturi, chei `settings`, reguli de calcul |
| [ECRANE](docs/ECRANE.md) | atingi un ecran: rute, straturile din Situații, Venituri și cheltuieli, ecranul lui Iza |
| [OPERARE](docs/OPERARE.md) | rulezi, testezi, publici, configurezi Google, pui evenimente în Calendar, scrii în foi |
| [SECURITATE](docs/SECURITATE.md) | orice modificare cu date, autentificare sau dependențe |
| [ISTORIC](docs/ISTORIC.md) | vrei contextul și deciziile |
| [PLAN-SI-DE-FACUT](docs/PLAN-SI-DE-FACUT.md) | ce e gata și ce urmează |

Joburile opționale din fundal (curs BNR, backup, sincronizare Calendar) sunt în [`apps-script/README.md`](apps-script/README.md).

Pentru sesiuni Claude Code: [`CLAUDE.md`](CLAUDE.md).
