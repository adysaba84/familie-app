import { activeView } from './views/active.js';
import { bursaView } from './views/bursa.js';
import { bursaNouView } from './views/bursa-nou.js';
import { bursaValoareView } from './views/bursa-valoare.js';
import { cursView } from './views/curs.js';
import { depoziteView } from './views/depozite.js';
import { depozitNouView } from './views/depozit-nou.js';
import { depozitInchideView } from './views/depozit-inchide.js';
import { fiziceView } from './views/fizice.js';
import { fiziceNouView } from './views/fizice-nou.js';
import { conturiView } from './views/conturi.js';
import { solduriView } from './views/solduri.js';
import { kidView } from './views/kid.js';
import { situatiiView } from './views/situatii.js';
import { obligatiiView } from './views/obligatii.js';
import { maiMultView } from './views/mai-mult.js';
import { venituriView } from './views/venituri.js';
import { investitView } from './views/investit.js';
import { primiteView } from './views/primite.js';

// Parent-facing screens: path -> view(app). Shared by main.js and the offline preview page.
export const SCREENS = {
  '/active': activeView,
  '/bursa': bursaView,
  '/bursa/nou': bursaNouView,
  '/bursa/valoare': bursaValoareView,
  '/depozite': depoziteView,
  '/depozite/nou': depozitNouView,
  '/depozite/inchide': depozitInchideView,
  '/fizice': fiziceView,
  '/fizice/nou': fiziceNouView,
  '/conturi': conturiView,
  '/conturi/solduri': solduriView,
  '/iza': (app) => kidView(app, { asParent: true }), // a parent previews Iza's screen
  '/situatii': situatiiView,
  '/curs': cursView,
  '/obligatii': obligatiiView,
  '/mai-mult': maiMultView,
  '/venituri': venituriView,
  '/investit': investitView,
  '/primite': primiteView,
};
