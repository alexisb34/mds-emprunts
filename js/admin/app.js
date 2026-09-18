// js/admin/app.js — point d’entrée de l’interface admin (pédagogie).
import { store } from '../store.js';
import { buildSeed } from '../seed.js';
import { auth } from '../auth.js';
import { createRouter, navigate, currentPath } from '../router.js';
import { LOAN_STATES, MAINT_STATES } from '../models.js';
import { escapeHtml } from '../ui.js';
import { mountSidebar } from './layout.js';
import { loginView } from './views/login.js';
import { aVenirView } from './views/aVenir.js';
// Les tâches suivantes ajoutent leurs imports ici :
import { dashboardView } from './views/dashboard.js';
// import { materielView } from './views/materiel.js';            (Task 5)
// import { materielFicheView } from './views/materielFiche.js';  (Task 6)
// import { utilisateursView } from './views/utilisateurs.js';    (Task 7)
// import { utilisateurFicheView } from './views/utilisateurFiche.js'; (Task 7)

store.init(buildSeed);

const sidebarEl = document.getElementById('sidebar');
const viewEl = document.getElementById('view');

export function sidebarCounts() {
  return {
    emprunts: store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS).length,
    maintenance: store.maintenance.list((m) => m.statut === MAINT_STATES.OUVERT).length,
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
  return view(container, params);
};

const routes = [
  { path: '/login', view: (c) => { document.body.classList.add('is-login'); return loginView(c); } },
  { path: '/dashboard', view: guard(dashboardView) },
  { path: '/materiel', view: guard(aVenirView('Matériel', 1)) },           // remplacé en Task 5
  { path: '/materiel/:id', view: guard(aVenirView('Fiche matériel', 1)) }, // remplacé en Task 6
  { path: '/emprunts', view: guard(aVenirView('Emprunts', 3)) },
  { path: '/salle', view: guard(aVenirView('Salle photo', 4)) },
  { path: '/maintenance', view: guard(aVenirView('Maintenance', 5)) },
  { path: '/utilisateurs', view: guard(aVenirView('Utilisateurs', 1)) },   // remplacé en Task 7
  { path: '/utilisateurs/:id', view: guard(aVenirView('Fiche utilisateur', 1)) }, // remplacé en Task 7
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
