// js/mobile/app.js — point d’entrée de l’interface mobile (emprunteurs).
import { store } from '../store.js';
import { buildSeed } from '../seed.js';
import { auth } from '../auth.js';
import { createRouter, navigate, currentPath } from '../router.js';
import { now } from '../rules.js';
import { escapeHtml } from '../ui.js';
import { sweepExpirations } from '../actions/loans.js';
import { sweepBookings } from '../actions/bookings.js';
import { mountNav } from './layout.js';
import { loginView } from './views/login.js';
import { profilView } from './views/profil.js';
import { aVenirView } from './views/aVenir.js';
import { accueilView } from './views/accueil.js';
import { catalogueView } from './views/catalogue.js';
import { ficheView } from './views/fiche.js';
import { scanView } from './views/scan.js';
import { empruntsView } from './views/emprunts.js';
import { reserverView } from './views/reserver.js';
import { salleView } from './views/salle.js';

store.init(buildSeed);

const navEl = document.getElementById('nav');
const viewEl = document.getElementById('view');

// Toute route sauf /login exige un compte actif (élève, intervenant ou pédago).
const guard = (view) => (container, params) => {
  const user = auth.currentUser();
  if (!user || user.actif === false) { auth.logout(); navigate('/login'); return undefined; }
  document.body.classList.remove('is-login');
  mountNav(navEl, currentPath());
  sweepExpirations(now());
  sweepBookings(now());
  return view(container, params);
};

const routes = [
  { path: '/login', view: (c) => { document.body.classList.add('is-login'); return loginView(c); } },
  { path: '/accueil', view: guard(accueilView) },
  { path: '/catalogue', view: guard(catalogueView) },
  { path: '/catalogue/:reference', view: guard(ficheView) },
  { path: '/scan', view: guard(scanView) },
  { path: '/emprunts', view: guard(empruntsView) },
  { path: '/salle', view: guard(salleView) },
  { path: '/reserver/:id', view: guard(reserverView) },
  { path: '/profil', view: guard(profilView) },
];

const router = createRouter({
  routes,
  container: viewEl,
  defaultPath: '/accueil',
  notFound: (c, path) => {
    c.innerHTML = `<div class="card error-card"><h2 class="h6">Page introuvable</h2><p class="body-sm text-secondary">${escapeHtml(path)}</p></div>`;
  },
});

router.start();
