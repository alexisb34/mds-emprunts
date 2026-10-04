// js/admin/app.js — point d’entrée de l’interface admin (pédagogie).
import { store } from '../store.js';
import { buildSeed } from '../seed.js';
import { auth } from '../auth.js';
import { createRouter, navigate, currentPath } from '../router.js';
import { LOAN_STATES, MAINT_STATES } from '../models.js';
import { now } from '../rules.js';
import { escapeHtml } from '../ui.js';
import { sweepExpirations } from '../actions/loans.js';
import { sweepBookings } from '../actions/bookings.js';
import { mountSidebar } from './layout.js';
import { loginView } from './views/login.js';
import { aVenirView } from './views/aVenir.js';
// Les tâches suivantes ajoutent leurs imports ici :
import { dashboardView } from './views/dashboard.js';
import { materielView } from './views/materiel.js';
import { materielFicheView } from './views/materielFiche.js';
import { utilisateursView } from './views/utilisateurs.js';
import { utilisateurFicheView } from './views/utilisateurFiche.js';
import { empruntsView } from './views/emprunts.js';
import { salleView } from './views/salle.js';
import { maintenanceView } from './views/maintenance.js';

store.init(buildSeed);

const sidebarEl = document.getElementById('sidebar');
const viewEl = document.getElementById('view');

export function sidebarCounts() {
  return {
    emprunts: store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS).length,
    maintenance: store.maintenance.list((m) => m.statut !== MAINT_STATES.CLOS).length,
  };
}

function refreshSidebar() {
  mountSidebar({
    el: sidebarEl,
    currentPath: currentPath(),
    counts: sidebarCounts(),
    user: auth.currentUser(),
    onLogout: () => { auth.logout(); navigate('/login'); },
  });
}

// Toute route sauf /login exige un compte pédago.
const guard = (view) => (container, params) => {
  if (!auth.isPedago()) { navigate('/login'); return undefined; }
  document.body.classList.remove('is-login');
  refreshSidebar();
  sweepExpirations(now());
  sweepBookings(now());
  return view(container, params);
};

const routes = [
  { path: '/login', view: (c) => { document.body.classList.add('is-login'); return loginView(c); } },
  { path: '/dashboard', view: guard(dashboardView) },
  { path: '/materiel', view: guard(materielView) },
  { path: '/materiel/:id', view: guard(materielFicheView) },
  { path: '/emprunts', view: guard(empruntsView) },
  { path: '/salle', view: guard(salleView) },
  { path: '/maintenance', view: guard(maintenanceView) },
  { path: '/utilisateurs', view: guard(utilisateursView) },
  { path: '/utilisateurs/:id', view: guard(utilisateurFicheView) },
  { path: '/parametres', view: guard(aVenirView('Paramètres', 5)) },
];

const router = createRouter({
  routes,
  container: viewEl,
  defaultPath: '/dashboard',
  notFound: (c, path) => {
    c.innerHTML = `<div class="card error-card"><h2 class="h6">Page introuvable</h2><p class="body-sm text-secondary">${escapeHtml(path)}</p></div>`;
  },
});

store.subscribe(() => { if (auth.isPedago()) refreshSidebar(); });
router.start();
