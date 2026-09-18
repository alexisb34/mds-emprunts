# MDS Emprunts — Phase 1 : Admin, inventaire & utilisateurs — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer l'interface admin navigable de la pédagogie — coquille (sidebar + topbar + login démo), tableau de bord avec KPI et journal, inventaire (table filtrable, ajout, fiche éditable, changement d'état, QR imprimable) et gestion des utilisateurs — sur les fondations de la phase 0.

**Architecture :** `admin.html` est une coquille unique ; `js/admin/app.js` initialise le store, protège les routes (pédago uniquement) et monte le routeur `#hash`. Chaque vue (`js/admin/views/*.js`) exporte un **builder HTML pur** (`xxxHtml(data)`, testé sous Node) et une **fonction de montage DOM** (`xxxView(container, params)`) qui lit le store, rend le HTML, branche les événements et renvoie sa fonction de nettoyage (désabonnement). Toute mutation passe par `js/actions/items.js` et `js/actions/users.js`, qui valident, écrivent le store et le journal. Les calculs du tableau de bord sont dans `js/admin/kpi.js` (pur). La table triable est un composant réutilisable `js/admin/table.js` (pur + `bindTable`).

**Tech Stack :** HTML5, CSS3 (tokens Figma), JavaScript ES2022 modules natifs, `localStorage`, `qrcodejs` 1.0.0 (copie locale `vendor/qrcode.min.js`, MIT), Node ≥ 22 pour `node --test`, `python3 -m http.server`.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §6 (interface admin), §4 (modèle), §5.4 (maintenance : états manuels), §9 (architecture).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md` (Phase 1). **Journal phase 0** (rulings à respecter) : `docs/superpowers/ledgers/2026-09-17-phase-0-ledger.md`.

## Global Constraints

- Aucun build, aucune dépendance npm installée ; `package.json` sert uniquement à `"type": "module"` et au script `npm test`.
- Interface et libellés 100 % en français ; libellés d'états dans `js/models.js` (`LABELS`, y compris `LABELS.derived`) — jamais de libellé d'état en dur dans une vue.
- Tokens visuels = variables Figma ; **aucune couleur en dur hors `css/tokens.css`** (Task 1 tokenise les 6 valeurs héritées de la phase 0).
- Chaînes : délimiteurs simples `'…'`, apostrophe typographique `’` (U+2019) dans le texte français — jamais `'` ni `\'` dans un mot français. Vérification : `grep -nE "[a-zéèà]'[a-zéèà]" js/**/*.js *.html` doit ne rien renvoyer.
- Toute mutation métier passe par `js/actions/*` et écrit une `LogEntry` via `logAction` ; les vues ne touchent jamais `store` en écriture. Les enregistrements du store sont **gelés** : toujours `store.x.update(id, patch)`, jamais de mutation d'objet.
- Règles temporelles via `rules.now()` (horloge de démo) ; `ui.relativeDay(d, ref)` exige `ref` ; `ui.js` ne lit jamais le store.
- Conteneurs DOM requis par `ui.js` : `<div id="modal-root">` et `<div id="toast-root">` (le contrat est `#toast-root`, pas `.toast-stack`).
- Sessions : utilisateur courant en `sessionStorage` clé `mds-emprunts:currentUser` ; recherche globale admin en `sessionStorage` clé `mds-emprunts:adminSearch`.
- Codes QR : objets `MDS-0042` (`ITEM_CODE_RE = /^MDS-(\d{4})$/`), retraits `LOAN-<loanId>-<code6>`.
- Vues : `xxxHtml(data)` pur + `xxxView(container, params)` DOM qui renvoie `store.subscribe(render)` comme nettoyage. Le HTML injecté échappe toute donnée via `escapeHtml` (sauf les fragments produits par `badge`/`avatar`/`renderTable`, déjà échappés).
- Commits fréquents, messages en français, préfixes `feat:`, `fix:`, `test:`, `chore:`, `docs:`.

---

## Structure de fichiers de la phase

| Fichier | Responsabilité |
|---|---|
| `admin.html` | Coquille : sidebar, topbar, `<main id="view">`, racines modale/toast, scripts |
| `css/admin.css` | Layout admin (grille sidebar/main), topbar, login, grilles de détail, formulaires, activité |
| `css/tokens.css` (modif) | + tokens hover/overlay/alpha (remplacent les 6 couleurs en dur de `components.css`) |
| `css/components.css` (modif) | Utilise les nouveaux tokens |
| `js/router.js` (modif) | Garde-fou : une vue qui lève affiche une carte d'erreur au lieu de laisser la page vide |
| `js/models.js` (modif) | + `ITEM_CODE_RE`, `LABELS.role` déjà présent |
| `js/ui.js` (modif) | + variante `role` pour `badge` |
| `js/admin/layout.js` | `NAV`, `isActive`, `sidebarHtml`, `topbarHtml` (purs) ; `mountSidebar`, `setTopbar`, `takeSearch` (DOM) |
| `js/admin/app.js` | Init store, garde pédago, routes, montage sidebar, démarrage routeur |
| `js/admin/views/login.js` | Choix du compte pédago (démo) |
| `js/admin/views/aVenir.js` | Vue « disponible en phase N » pour les routes des phases 3-5 |
| `js/actions/items.js` | `nextItemCode`, `validateItem`, `createItem`, `updateItem`, `setItemState`, `manualTransitions`, `itemHistory`, `slugify` |
| `js/actions/users.js` | `validateUser`, `createUser`, `updateUser`, `setUserActive`, `userStats`, `userHistory` |
| `js/admin/kpi.js` | `computeKpis`, `lateLoans`, `dueTodayReservations`, `openReports`, `joinLoan` (purs) |
| `js/admin/views/dashboard.js` | `dashboardHtml` + `dashboardView` |
| `js/admin/table.js` | `sortRows`, `toggleSort`, `renderTable`, `bindTable` |
| `js/admin/views/materiel.js` | `filterItems`, `COLUMNS`, `materielHtml`, `itemFormHtml`, `readItemForm`, `materielView` (+ sélection → étiquettes) |
| `js/qr.js` | `isItemCode`, `parseLoanCode`, `loanQrPayload`, `renderQr` |
| `vendor/qrcode.min.js`, `vendor/README.md` | qrcodejs 1.0.0 (MIT) |
| `js/admin/views/materielFiche.js` | `ficheHtml` + `materielFicheView` |
| `etiquettes.html` | Page d'impression d'étiquettes QR (`?codes=MDS-0001,MDS-0002`) |
| `js/admin/views/utilisateurs.js` | `filterUsers`, `USER_COLUMNS`, `utilisateursHtml`, `userFormHtml`, `readUserForm`, `utilisateursView` |
| `js/admin/views/utilisateurFiche.js` | `userFicheHtml` + `utilisateurFicheView` |
| `tests/admin-layout.test.mjs`, `tests/actions-items.test.mjs`, `tests/actions-users.test.mjs`, `tests/kpi.test.mjs`, `tests/admin-dashboard.test.mjs`, `tests/admin-table.test.mjs`, `tests/admin-materiel.test.mjs`, `tests/qr.test.mjs`, `tests/admin-fiche.test.mjs`, `tests/admin-utilisateurs.test.mjs` | Tests Node |

Rappel des signatures de la phase 0 utilisées partout : `store.<coll>.list(filterFn?)/get(id)/create(data)/update(id, patch)` ; `store.settings.get()` ; `store.subscribe(fn) → off` ; `now()`, `isLate(loan, date)`, `ymd(date)` (`js/rules.js`) ; `logAction({ auteurId, action, itemId?, loanId?, bookingId?, userId?, detail? })`, `recentLog(limit)`, `logForItem(id)`, `logForUser(id)`, `ACTIONS`, `ACTION_LABELS` (`js/log.js`) ; `auth.currentUser()/currentUserId()/login(id)/logout()/isPedago()` ; `escapeHtml`, `formatDate`, `formatTime`, `formatDateTime`, `relativeDay(d, ref)`, `fullName`, `initials`, `badge(kind, value)`, `avatar(user, size)`, `openModal({ title, body, actions })`, `closeModal()`, `toast(msg, variant)` (`js/ui.js`) ; `createRouter({ routes, container, defaultPath, notFound })`, `navigate(path)`, `currentPath()` (`js/router.js`) ; `LABELS.{role,circuit,itemState,loanState,bookingState,maintType,maintState,derived}`, `ITEM_TRANSITIONS`, `assertTransition` (`js/models.js`).

---

### Task 1 : Coquille admin — tokens, layout, login, routes « à venir »

**Files:**
- Create: `admin.html`, `css/admin.css`, `js/admin/layout.js`, `js/admin/app.js`, `js/admin/views/login.js`, `js/admin/views/aVenir.js`
- Modify: `css/tokens.css` (fin du bloc `:root`), `css/components.css` (6 remplacements), `js/router.js` (fonction `render`)
- Test: `tests/admin-layout.test.mjs`

**Interfaces:**
- Consumes : `store`, `buildSeed`, `auth`, `createRouter`/`navigate`/`currentPath`, `escapeHtml`/`avatar`/`fullName`, `LABELS.role`, `LOAN_STATES`, `MAINT_STATES`, `ROLES`.
- Produces : `NAV`, `isActive(navPath, currentPath)`, `sidebarHtml({ currentPath, counts, user })`, `topbarHtml({ title, subtitle, action, searchValue })`, `mountSidebar({ el, currentPath, counts, user, onLogout })`, `setTopbar({ title, subtitle?, action? })` où `action = { label, onClick }`, `takeSearch() → string`, `SEARCH_KEY` ; `loginHtml(pedagos)`, `loginView(container)` ; `aVenirView(title, phase) → view fn` ; `sidebarCounts()` dans `app.js`. Les vues des tâches suivantes s'enregistrent dans le tableau `routes` de `app.js` (Step 8 montre l'emplacement exact).

- [ ] **Step 1 : Tokeniser les couleurs en dur (phase 0, différé)**

Ajouter à la fin du bloc `:root` de `css/tokens.css` (avant `}`) :

```css
  /* Dérivés (hover, overlays) — introduits en phase 1 */
  --brand-primary-hover: #521d69;
  --feedback-error-hover: #c8253a;
  --overlay: rgba(60, 60, 59, 0.5);
  --alpha-white-80: rgba(255, 255, 255, 0.8);
  --alpha-white-85: rgba(255, 255, 255, 0.85);
  --status-maintenance-text: #7a5300;
```

Puis dans `css/components.css`, remplacer exactement :
- `background: #521d69;` → `background: var(--brand-primary-hover);`
- `background: #c8253a;` → `background: var(--feedback-error-hover);`
- `.kpi--brand .kpi__label, .kpi--brand .kpi__delta { color: rgba(255, 255, 255, .8); }` → `… { color: var(--alpha-white-80); }`
- `.kpi--teal .kpi__label, .kpi--teal .kpi__delta { color: rgba(255, 255, 255, .85); }` → `… { color: var(--alpha-white-85); }`
- `.nav-item { … color: rgba(255, 255, 255, .8); …` → `color: var(--alpha-white-80);`
- `.modal-backdrop { … background: rgba(60, 60, 59, .5); …` → `background: var(--overlay);`
- `.alert--warning { background: var(--status-maintenance-bg); color: #7a5300; }` → `color: var(--status-maintenance-text);`

Vérifier : `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/components.css` ne renvoie plus que la ligne du `data:image/svg+xml` (`%23757678`, couleur encodée dans l'URL — impossible à tokeniser, acceptée).

- [ ] **Step 2 : Garde-fou du routeur**

Dans `js/router.js`, remplacer le corps de la boucle `for (const route of routes)` de `render()` :

```js
    for (const route of routes) {
      const params = matchRoute(route.path, path);
      if (params) {
        container.innerHTML = '';
        try {
          cleanup = route.view(container, params) || null;
        } catch (err) {
          console.error(err);
          container.innerHTML = `<div class="card error-card"><h2 class="h6">Erreur d’affichage</h2><p class="body-sm text-secondary">${String(err && err.message ? err.message : err).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p></div>`;
        }
        window.scrollTo(0, 0);
        return;
      }
    }
```

(`router.js` n'importe pas `ui.js` pour rester sans dépendance ; l'échappement minimal est inline.)

- [ ] **Step 3 : Écrire le test**

`tests/admin-layout.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { NAV, isActive, sidebarHtml, topbarHtml } from '../js/admin/layout.js';
import { loginHtml } from '../js/admin/views/login.js';
import { aVenirHtml } from '../js/admin/views/aVenir.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('NAV : 7 entrées dans l’ordre du spec', () => {
  assert.deepEqual(NAV.map((n) => n.path), ['/dashboard', '/materiel', '/emprunts', '/salle', '/maintenance', '/utilisateurs', '/parametres']);
});

test('isActive : exact ou sous-route', () => {
  assert.equal(isActive('/materiel', '/materiel'), true);
  assert.equal(isActive('/materiel', '/materiel/item_001'), true);
  assert.equal(isActive('/materiel', '/materiels'), false);
  assert.equal(isActive('/dashboard', '/materiel'), false);
});

test('sidebarHtml : entrée active, compteurs, pied avec utilisateur', () => {
  const user = { prenom: 'Alexis', nom: 'Bengel <b>', role: 'pedago' };
  const html = sidebarHtml({ currentPath: '/materiel/item_001', counts: { emprunts: 10, maintenance: 0 }, user });
  assert.match(html, /nav-item nav-item--active" href="#\/materiel"/);
  assert.doesNotMatch(html, /nav-item--active" href="#\/dashboard"/);
  assert.match(html, /Emprunts<span class="nav-item__count">10<\/span>/);
  assert.doesNotMatch(html, /Maintenance<span class="nav-item__count">/);
  assert.match(html, /Bengel &lt;b&gt;/);
  assert.match(html, /Pédagogie/);
  assert.match(html, /data-action="logout"/);
});

test('sidebarHtml sans utilisateur : pas de pied', () => {
  const html = sidebarHtml({ currentPath: '/login', counts: {}, user: null });
  assert.doesNotMatch(html, /sidebar__footer/);
});

test('topbarHtml : titre, sous-titre, action optionnelle, recherche', () => {
  const withAction = topbarHtml({ title: 'Matériel', subtitle: '44 exemplaires', action: { label: '+ Ajouter' } });
  assert.match(withAction, /<h1>Matériel<\/h1>/);
  assert.match(withAction, /<p>44 exemplaires<\/p>/);
  assert.match(withAction, /data-action="primary">\+ Ajouter</);
  assert.match(withAction, /data-role="global-search"/);
  const without = topbarHtml({ title: 'Tableau de bord' });
  assert.doesNotMatch(without, /data-action="primary"/);
  assert.doesNotMatch(without, /<p>/);
});

test('loginHtml : un bouton par pédago actif, emails affichés', () => {
  const pedagos = store.users.list((u) => u.role === 'pedago');
  const html = loginHtml(pedagos);
  assert.equal((html.match(/data-user="user_0/g) || []).length, 5);
  assert.match(html, /alexis\.bengel@mds-demo\.fr/);
  assert.match(html, /Qui êtes-vous/);
});

test('aVenirHtml : mentionne la phase', () => {
  assert.match(aVenirHtml('Emprunts', 3), /Emprunts/);
  assert.match(aVenirHtml('Emprunts', 3), /phase 3/);
});
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/admin-layout.test.mjs`
Expected: FAIL — `Cannot find module '../js/admin/layout.js'`

- [ ] **Step 5 : Écrire `js/admin/layout.js`**

```js
// js/admin/layout.js — coquille admin : sidebar et topbar.
// Builders HTML purs (testés sous Node) + fonctions de montage DOM.
import { escapeHtml, avatar, fullName } from '../ui.js';
import { LABELS } from '../models.js';
import { navigate, currentPath } from '../router.js';

export const NAV = [
  { path: '/dashboard', label: 'Tableau de bord' },
  { path: '/materiel', label: 'Matériel' },
  { path: '/emprunts', label: 'Emprunts', countKey: 'emprunts' },
  { path: '/salle', label: 'Salle photo' },
  { path: '/maintenance', label: 'Maintenance', countKey: 'maintenance' },
  { path: '/utilisateurs', label: 'Utilisateurs' },
  { path: '/parametres', label: 'Paramètres' },
];

export const SEARCH_KEY = 'mds-emprunts:adminSearch';

export function isActive(navPath, path) {
  return path === navPath || path.startsWith(`${navPath}/`);
}

export function sidebarHtml({ currentPath: path, counts = {}, user }) {
  const items = NAV.map((n) => {
    const count = n.countKey ? counts[n.countKey] || 0 : 0;
    const active = isActive(n.path, path) ? ' nav-item--active' : '';
    const countHtml = count > 0 ? `<span class="nav-item__count">${count}</span>` : '';
    return `<a class="nav-item${active}" href="#${n.path}">${escapeHtml(n.label)}${countHtml}</a>`;
  }).join('');
  const footer = user ? `
    <div class="sidebar__footer">
      ${avatar(user)}
      <div class="sidebar__user"><strong>${escapeHtml(fullName(user))}</strong>${escapeHtml(LABELS.role[user.role] || user.role)}</div>
      <button type="button" class="sidebar__logout" data-action="logout">Déconnexion</button>
    </div>` : '';
  return `
    <div class="sidebar__logo">MDS Emprunts<small>Administration</small></div>
    <div class="sidebar__section">Gestion</div>
    <nav class="sidebar__nav">${items}</nav>
    ${footer}`;
}

export function topbarHtml({ title, subtitle = '', action = null, searchValue = '' }) {
  const actionHtml = action ? `<button type="button" class="btn btn--primary" data-action="primary">${escapeHtml(action.label)}</button>` : '';
  return `
    <div class="topbar__title"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
    <input class="input input--search topbar__search" type="search" placeholder="Rechercher un matériel…" value="${escapeHtml(searchValue)}" data-role="global-search" aria-label="Recherche globale">
    ${actionHtml}`;
}

// ---- DOM ----

export function mountSidebar({ el, currentPath: path, counts, user, onLogout }) {
  el.innerHTML = sidebarHtml({ currentPath: path, counts, user });
  const logout = el.querySelector('[data-action="logout"]');
  if (logout) logout.addEventListener('click', onLogout);
}

// Appelé par chaque vue au montage. La recherche globale envoie vers la liste du matériel.
export function setTopbar({ title, subtitle = '', action = null }) {
  const el = document.getElementById('topbar');
  el.innerHTML = topbarHtml({ title, subtitle, action });
  if (action) el.querySelector('[data-action="primary"]').addEventListener('click', action.onClick);
  el.querySelector('[data-role="global-search"]').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    sessionStorage.setItem(SEARCH_KEY, e.target.value.trim());
    if (currentPath() === '/materiel') window.dispatchEvent(new Event('hashchange'));
    else navigate('/materiel');
  });
}

// La vue Matériel consomme (et efface) la recherche déposée par la topbar.
export function takeSearch() {
  const q = sessionStorage.getItem(SEARCH_KEY) || '';
  sessionStorage.removeItem(SEARCH_KEY);
  return q;
}
```

- [ ] **Step 6 : Écrire `js/admin/views/login.js` et `js/admin/views/aVenir.js`**

`js/admin/views/login.js` :

```js
// js/admin/views/login.js — choix du compte pédago (démo, sans mot de passe).
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { ROLES } from '../../models.js';
import { escapeHtml, avatar, fullName, toast } from '../../ui.js';

export function loginHtml(pedagos) {
  const list = pedagos.map((u) => `
    <button type="button" class="login__user" data-user="${escapeHtml(u.id)}">
      ${avatar(u, 'md')}
      <span><strong class="label-md">${escapeHtml(fullName(u))}</strong><br><span class="body-tiny text-secondary">${escapeHtml(u.email)}</span></span>
    </button>`).join('');
  return `
    <div class="login">
      <div class="card login__card">
        <p class="label-caps text-secondary">MDS Emprunts — Administration</p>
        <h1 class="h5">Qui êtes-vous ?</h1>
        <p class="body-sm text-secondary login__hint">Comptes de démonstration — aucun mot de passe.</p>
        <div class="login__list">${list}</div>
        <p class="body-tiny text-secondary login__back"><a href="index.html">← Retour à l’accueil</a></p>
      </div>
    </div>`;
}

export function loginView(container) {
  const pedagos = store.users.list((u) => u.role === ROLES.PEDAGO && u.actif);
  container.innerHTML = loginHtml(pedagos);
  container.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => {
    try {
      auth.login(b.dataset.user);
      navigate('/dashboard');
    } catch (e) {
      toast(e.message, 'error');
    }
  }));
}
```

`js/admin/views/aVenir.js` :

```js
// js/admin/views/aVenir.js — vue de remplacement pour les écrans des phases suivantes.
import { escapeHtml } from '../../ui.js';
import { setTopbar } from '../layout.js';

export function aVenirHtml(title, phase) {
  return `
    <div class="card">
      <h2 class="h6">${escapeHtml(title)}</h2>
      <p class="body-sm text-secondary">Cet écran arrive en phase ${phase} du prototype.</p>
    </div>`;
}

export function aVenirView(title, phase) {
  return (container) => {
    setTopbar({ title });
    container.innerHTML = aVenirHtml(title, phase);
  };
}
```

- [ ] **Step 7 : Lancer le test**

Run: `node --test tests/admin-layout.test.mjs`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 8 : Écrire `js/admin/app.js`**

```js
// js/admin/app.js — point d'entrée de l'interface admin (pédagogie).
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
// import { dashboardView } from './views/dashboard.js';          (Task 4)
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
  { path: '/dashboard', view: guard(aVenirView('Tableau de bord', 1)) },   // remplacé en Task 4
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
```

- [ ] **Step 9 : Écrire `admin.html` et `css/admin.css`**

`admin.html` :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDS Emprunts — Administration</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body>
  <div class="admin-shell">
    <aside id="sidebar" class="sidebar" aria-label="Navigation principale"></aside>
    <div class="admin-main">
      <header id="topbar" class="topbar"></header>
      <main id="view" class="view"></main>
    </div>
  </div>
  <div id="modal-root"></div>
  <div id="toast-root"></div>
  <script type="module" src="js/admin/app.js"></script>
</body>
</html>
```

`css/admin.css` :

```css
/* Layout de l’interface admin. Couleurs via tokens uniquement. */
.admin-shell { display: grid; grid-template-columns: var(--size-sidebar) 1fr; min-height: 100vh; }
.is-login .admin-shell { grid-template-columns: 1fr; }
.is-login .sidebar, .is-login .topbar { display: none; }

/* Sidebar */
.sidebar { background: var(--brand-primary); color: var(--text-on-brand); padding: var(--space-2xl) var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); position: sticky; top: 0; height: 100vh; }
.sidebar__logo { font-family: var(--font-heading); font-weight: 800; font-size: 20px; line-height: 24px; letter-spacing: -.3px; padding: 0 var(--space-md); }
.sidebar__logo small { display: block; font-family: var(--font-body); font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--alpha-white-80); }
.sidebar__section { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--alpha-white-80); padding: 0 var(--space-md); margin-top: var(--space-sm); }
.sidebar__nav { display: flex; flex-direction: column; gap: var(--space-xs); }
.sidebar__footer { margin-top: auto; display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); border-top: var(--stroke-thin) solid var(--alpha-white-10); }
.sidebar__footer .avatar { background: var(--bg-surface); color: var(--text-brand); }
.sidebar__user { flex: 1; min-width: 0; font-size: 12px; line-height: 16px; color: var(--alpha-white-80); }
.sidebar__user strong { display: block; font-size: 14px; line-height: 18px; color: var(--text-on-brand); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar__logout { color: var(--alpha-white-80); font-size: 12px; font-weight: 700; }
.sidebar__logout:hover { color: var(--text-on-brand); }

/* Zone principale */
.admin-main { display: flex; flex-direction: column; min-width: 0; }
.topbar { height: var(--size-topbar); display: flex; align-items: center; gap: var(--space-lg); padding: 0 var(--space-3xl); background: var(--bg-surface); border-bottom: var(--stroke-thin) solid var(--border-default); position: sticky; top: 0; z-index: 10; }
.topbar__title { flex: 1; min-width: 0; }
.topbar__title h1 { font-family: var(--font-heading); font-weight: 800; font-size: 24px; line-height: 30px; letter-spacing: -.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar__title p { font-size: 12px; line-height: 16px; color: var(--text-secondary); }
.topbar__search { width: 280px; }
.view { padding: var(--space-3xl); display: flex; flex-direction: column; gap: var(--space-2xl); }

/* Éléments de page */
.page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-lg); flex-wrap: wrap; }
.page-header__meta { font-size: 14px; line-height: 21px; color: var(--text-secondary); }
.back-link { font-size: 12px; font-weight: 700; color: var(--text-brand); }
.filters { display: flex; gap: var(--space-md); flex-wrap: wrap; align-items: center; }
.filters .input, .filters .select { width: auto; min-width: 160px; }
.filters .input--search { min-width: 260px; }
.toolbar { display: flex; gap: var(--space-sm); align-items: center; margin-top: var(--space-md); }
.detail-grid { display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-2xl); align-items: start; }
.detail-grid > .stack { min-width: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); }
.form-grid .field--full { grid-column: 1 / -1; }
.form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg); }
.state-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-md); }
.qr-box { display: grid; place-items: center; gap: var(--space-md); padding: var(--space-lg); background: var(--bg-canvas); border-radius: var(--radius-md); text-align: center; }
.qr-box canvas, .qr-box img { image-rendering: pixelated; }
.stat-row { display: flex; gap: var(--space-lg); flex-wrap: wrap; }
.stat { flex: 1; min-width: 120px; padding: var(--space-md); background: var(--bg-canvas); border-radius: var(--radius-md); }
.stat__label { font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--text-secondary); }
.stat__value { font-family: var(--font-heading); font-weight: 800; font-size: 24px; line-height: 30px; }
.stat__value--alert { color: var(--feedback-error); }
.activity { display: flex; flex-direction: column; gap: var(--space-md); }
.activity__item { display: grid; grid-template-columns: 64px 1fr; gap: var(--space-md); font-size: 14px; line-height: 21px; }
.activity__time { color: var(--text-secondary); font-size: 12px; line-height: 21px; }
.activity__detail { display: block; color: var(--text-secondary); font-size: 12px; line-height: 16px; }
.list { display: flex; flex-direction: column; gap: var(--space-sm); }
.list__item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) 0; border-bottom: var(--stroke-thin) solid var(--border-default); font-size: 14px; line-height: 21px; }
.list__item:last-child { border-bottom: 0; }
.list__item[data-href] { cursor: pointer; }
.list__grow { flex: 1; min-width: 0; }
.thumb { width: 48px; height: 36px; object-fit: cover; border-radius: var(--radius-xs); border: var(--stroke-thin) solid var(--border-default); }
.error-card { border-left: 4px solid var(--feedback-error); }
.kpi--alert .kpi__value { color: var(--feedback-error); }

/* Login */
.login { min-height: 100vh; display: grid; place-items: center; padding: var(--space-2xl); }
.login__card { width: min(560px, 100%); }
.login__hint { margin: var(--space-sm) 0 var(--space-lg); }
.login__back { margin-top: var(--space-lg); }
.login__list { display: grid; gap: var(--space-sm); }
.login__user { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); border: var(--stroke-thin) solid var(--border-default); border-radius: var(--radius-md); width: 100%; text-align: left; background: var(--bg-surface); }
.login__user:hover { background: var(--brand-primary-subtle); border-color: var(--border-brand); }

@media (max-width: 900px) {
  .admin-shell { grid-template-columns: 1fr; }
  .sidebar { position: static; height: auto; }
  .detail-grid, .form-grid { grid-template-columns: 1fr; }
  .topbar { padding: 0 var(--space-lg); }
  .topbar__search { width: 160px; }
  .view { padding: var(--space-lg); }
}
```

- [ ] **Step 10 : Vérifier dans le navigateur**

Run: `python3 -m http.server 8000` (si pas déjà lancé) puis ouvrir `http://localhost:8000/admin.html`.
Expected : redirection vers `#/login`, page « Qui êtes-vous ? » avec 5 comptes ; clic sur un compte → `#/dashboard` avec sidebar violette (Tableau de bord actif, compteur « 10 » sur Emprunts, « 1 » sur Maintenance), topbar « Tableau de bord », carte « Cet écran arrive en phase 1 » ; les 7 entrées naviguent ; « Déconnexion » ramène au login ; `#/nimporte` affiche « Page introuvable ». Aucune erreur console.

- [ ] **Step 11 : Suite complète et commit**

Run: `npm test`
Expected: `# fail 0` (85 tests).

```bash
git add admin.html css/admin.css css/tokens.css css/components.css js/router.js js/admin/ tests/admin-layout.test.mjs
git commit -m "feat(admin): coquille, login démo, sidebar/topbar et routes à venir"
```

---

### Task 2 : `actions/items.js` — mutations du matériel

**Files:**
- Create: `js/actions/items.js`
- Modify: `js/models.js` (ajouter `ITEM_CODE_RE` après `CATEGORIES`)
- Test: `tests/actions-items.test.mjs`

**Interfaces:**
- Consumes : `store.items`, `store.loans`, `store.maintenance`, `ITEM_STATES`, `ITEM_TRANSITIONS`, `CIRCUITS`, `CATEGORIES`, `LABELS`, `assertTransition`, `logAction`, `ACTIONS`, `logForItem`.
- Produces : `ITEM_CODE_RE` (models), `slugify(s)`, `nextItemCode()`, `validateItem(data) → string[]`, `createItem(data, auteurId) → Item`, `updateItem(id, patch, auteurId) → Item` (ignore `id/code/etat/createdAt/updatedAt`), `setItemState(id, etat, auteurId, detail?) → Item`, `MANUAL_STATES`, `manualTransitions(item) → etat[]`, `itemHistory(id) → { loans, maintenance, log }` (triés du plus récent au plus ancien).

- [ ] **Step 1 : Ajouter `ITEM_CODE_RE` à `js/models.js`**

Après la ligne `export const CATEGORIES = [...]` :

```js
export const ITEM_CODE_RE = /^MDS-(\d{4})$/;
```

- [ ] **Step 2 : Écrire le test**

`tests/actions-items.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ITEM_STATES } from '../js/models.js';
import { ACTIONS } from '../js/log.js';
import { slugify, nextItemCode, validateItem, createItem, updateItem, setItemState, manualTransitions, itemHistory } from '../js/actions/items.js';

const PEDAGO = 'user_041';
const valid = { nom: 'Multiprise', reference: 'multiprise', categorie: 'Bureautique', circuit: 'self', valeurEstimee: 15, localisation: 'Bureau pédago' };

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('slugify', () => {
  assert.equal(slugify('Trépied LeoFoto'), 'trepied-leofoto');
  assert.equal(slugify('  Carte SD 256 Go '), 'carte-sd-256-go');
  assert.equal(slugify(''), '');
});

test('nextItemCode suit le plus grand code existant', () => {
  assert.equal(nextItemCode(), 'MDS-0045');
  createItem(valid, PEDAGO);
  assert.equal(nextItemCode(), 'MDS-0046');
});

test('validateItem : messages en français', () => {
  assert.deepEqual(validateItem(valid), []);
  const errors = validateItem({ nom: ' ', reference: '', categorie: 'Nope', circuit: 'x', valeurEstimee: -1 });
  assert.equal(errors.length, 5);
  assert.match(errors[0], /nom est obligatoire/);
  assert.match(errors[4], /nombre positif/);
});

test('createItem : code auto, état disponible, journal', () => {
  const before = store.log.list().length;
  const item = createItem({ ...valid, nom: '  Multiprise 7  ', reference: 'Multi Prise' }, PEDAGO);
  assert.equal(item.code, 'MDS-0045');
  assert.equal(item.etat, ITEM_STATES.DISPONIBLE);
  assert.equal(item.nom, 'Multiprise 7');
  assert.equal(item.reference, 'multi-prise');
  assert.equal(item.notes, '');
  const entry = store.log.list().at(-1);
  assert.equal(store.log.list().length, before + 1);
  assert.equal(entry.action, ACTIONS.ITEM_CREE);
  assert.equal(entry.itemId, item.id);
  assert.equal(entry.auteurId, PEDAGO);
  assert.match(entry.detail, /Multiprise 7 \(MDS-0045\)/);
});

test('createItem refuse des données invalides sans rien écrire', () => {
  const before = store.items.list().length;
  assert.throws(() => createItem({ ...valid, categorie: 'Nope' }, PEDAGO), /catégorie est invalide/);
  assert.equal(store.items.list().length, before);
});

test('updateItem : champs protégés ignorés, validation, journal', () => {
  const item = store.items.get('item_001');
  const up = updateItem('item_001', { nom: 'Multiprise A', code: 'MDS-9999', etat: 'hs', id: 'x', valeurEstimee: '20' }, PEDAGO);
  assert.equal(up.nom, 'Multiprise A');
  assert.equal(up.code, item.code);
  assert.equal(up.etat, item.etat);
  assert.equal(up.id, 'item_001');
  assert.equal(up.valeurEstimee, 20);
  assert.equal(store.log.list().at(-1).action, ACTIONS.ITEM_MODIFIE);
  assert.throws(() => updateItem('item_001', { nom: '' }, PEDAGO), /nom est obligatoire/);
  assert.throws(() => updateItem('nope', { nom: 'x' }, PEDAGO), /introuvable/);
});

test('setItemState : transition autorisée, journal, disponibles décrémentés', () => {
  const dispoAvant = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE).length;
  const free = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const up = setItemState(free.id, ITEM_STATES.HS, PEDAGO, 'cassé');
  assert.equal(up.etat, ITEM_STATES.HS);
  assert.equal(store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE).length, dispoAvant - 1);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.ITEM_ETAT);
  assert.match(entry.detail, /Disponible → Hors service — cassé/);
});

test('setItemState refuse une transition interdite', () => {
  const hs = store.items.list((i) => i.etat === ITEM_STATES.HS)[0];
  assert.throws(() => setItemState(hs.id, ITEM_STATES.EMPRUNTE, PEDAGO), /Transition matériel interdite : hs → emprunte/);
  assert.throws(() => setItemState('nope', ITEM_STATES.HS, PEDAGO), /introuvable/);
});

test('manualTransitions : seulement les états pilotés à la main', () => {
  assert.deepEqual(manualTransitions({ etat: 'disponible' }), ['maintenance', 'hs']);
  assert.deepEqual(manualTransitions({ etat: 'maintenance' }), ['disponible', 'hs']);
  assert.deepEqual(manualTransitions({ etat: 'hs' }), ['maintenance', 'disponible']);
  assert.deepEqual(manualTransitions({ etat: 'emprunte' }), []);
  assert.deepEqual(manualTransitions({ etat: 'reserve' }), []);
});

test('itemHistory : emprunts, maintenance et journal du plus récent au plus ancien', () => {
  const canon = store.items.list((i) => i.reference === 'canon-r10')[0];
  const h = itemHistory(canon.id);
  assert.ok(h.loans.length >= 1);
  assert.ok(h.loans.every((l) => l.itemId === canon.id));
  assert.ok(h.loans.every((l, i, a) => i === 0 || a[i - 1].createdAt >= l.createdAt));
  assert.equal(h.maintenance.length, 1);
  assert.equal(h.maintenance[0].prestataire, 'Optic Services');
  assert.ok(h.log.length >= 2);
  assert.ok(h.log.every((e) => e.itemId === canon.id));
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/actions-items.test.mjs`
Expected: FAIL — `Cannot find module '../js/actions/items.js'`

- [ ] **Step 4 : Écrire `js/actions/items.js`**

```js
// js/actions/items.js — mutations métier sur le matériel. Toute écriture passe ici,
// valide les données, respecte les transitions d’état et écrit le journal.
import { store } from '../store.js';
import { ITEM_STATES, ITEM_TRANSITIONS, ITEM_CODE_RE, CIRCUITS, CATEGORIES, LABELS, assertTransition } from '../models.js';
import { logAction, ACTIONS, logForItem } from '../log.js';

const PROTECTED_FIELDS = ['id', 'code', 'etat', 'createdAt', 'updatedAt'];

// États que la pédago peut fixer à la main ; emprunte/reserve sont pilotés par les emprunts.
export const MANUAL_STATES = [ITEM_STATES.DISPONIBLE, ITEM_STATES.MAINTENANCE, ITEM_STATES.HS];

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function nextItemCode() {
  const max = store.items.list().reduce((m, i) => {
    const n = Number((ITEM_CODE_RE.exec(i.code) || [])[1] || 0);
    return n > m ? n : m;
  }, 0);
  return `MDS-${String(max + 1).padStart(4, '0')}`;
}

export function validateItem(data) {
  const errors = [];
  if (!data.nom || !String(data.nom).trim()) errors.push('Le nom est obligatoire.');
  if (!data.reference || !String(data.reference).trim()) errors.push('La référence est obligatoire.');
  if (!CATEGORIES.includes(data.categorie)) errors.push('La catégorie est invalide.');
  if (!Object.values(CIRCUITS).includes(data.circuit)) errors.push('Le circuit est invalide.');
  if (data.valeurEstimee !== undefined && (Number.isNaN(Number(data.valeurEstimee)) || Number(data.valeurEstimee) < 0)) {
    errors.push('La valeur estimée doit être un nombre positif.');
  }
  return errors;
}

function assertValid(data) {
  const errors = validateItem(data);
  if (errors.length) throw new Error(errors.join(' '));
}

function requireItem(id) {
  const item = store.items.get(id);
  if (!item) throw new Error(`Matériel introuvable (${id})`);
  return item;
}

export function createItem(data, auteurId) {
  const clean = {
    nom: String(data.nom || '').trim(),
    reference: slugify(data.reference),
    categorie: data.categorie,
    circuit: data.circuit,
    localisation: data.localisation || '',
    dateAchat: data.dateAchat || '',
    valeurEstimee: Number(data.valeurEstimee || 0),
    notes: data.notes || '',
    photoUrl: data.photoUrl || '',
  };
  assertValid(clean);
  const item = store.items.create({ ...clean, code: nextItemCode(), etat: ITEM_STATES.DISPONIBLE });
  logAction({ auteurId, action: ACTIONS.ITEM_CREE, itemId: item.id, detail: `${item.nom} (${item.code})` });
  return item;
}

export function updateItem(id, patch, auteurId) {
  const current = requireItem(id);
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => !PROTECTED_FIELDS.includes(k)));
  if (safe.nom !== undefined) safe.nom = String(safe.nom).trim();
  if (safe.reference !== undefined) safe.reference = slugify(safe.reference);
  if (safe.valeurEstimee !== undefined) safe.valeurEstimee = Number(safe.valeurEstimee);
  assertValid({ ...current, ...safe });
  const item = store.items.update(id, safe);
  logAction({ auteurId, action: ACTIONS.ITEM_MODIFIE, itemId: id, detail: `${item.nom} : ${Object.keys(safe).join(', ')}` });
  return item;
}

export function setItemState(id, etat, auteurId, detail = '') {
  const item = requireItem(id);
  assertTransition(ITEM_TRANSITIONS, item.etat, etat, 'matériel');
  const updated = store.items.update(id, { etat });
  const suffix = detail ? ` — ${detail}` : '';
  logAction({
    auteurId, action: ACTIONS.ITEM_ETAT, itemId: id,
    detail: `${item.nom} : ${LABELS.itemState[item.etat]} → ${LABELS.itemState[etat]}${suffix}`,
  });
  return updated;
}

export function manualTransitions(item) {
  if (!MANUAL_STATES.includes(item.etat)) return [];
  return (ITEM_TRANSITIONS[item.etat] || []).filter((s) => MANUAL_STATES.includes(s));
}

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

export function itemHistory(id) {
  return {
    loans: store.loans.list((l) => l.itemId === id).sort(byCreatedDesc),
    maintenance: store.maintenance.list((m) => m.itemId === id).sort(byCreatedDesc),
    log: logForItem(id),
  };
}
```

- [ ] **Step 5 : Lancer le test**

Run: `node --test tests/actions-items.test.mjs`
Expected: `# pass 10`, `# fail 0`

- [ ] **Step 6 : Commit**

```bash
git add js/models.js js/actions/items.js tests/actions-items.test.mjs
git commit -m "feat(actions): mutations du matériel — création, modification, changement d'état, historique"
```

---

### Task 3 : `actions/users.js` — mutations des utilisateurs

**Files:**
- Create: `js/actions/users.js`
- Test: `tests/actions-users.test.mjs`

**Interfaces:**
- Consumes : `store.users/loans/bookings`, `ROLES`, `PROMOS`, `LABELS.role`, `LOAN_STATES`, `isLate`, `logAction`, `ACTIONS`, `logForUser`.
- Produces : `validateUser(data, existingId?) → string[]`, `createUser(data, auteurId) → User`, `updateUser(id, patch, auteurId) → User` (ignore `id/actif/createdAt/updatedAt`), `setUserActive(id, actif, auteurId) → User`, `userStats(userId, date) → { enCours, retards, reservations, total }`, `userHistory(userId) → { loans, bookings, log }`.

- [ ] **Step 1 : Écrire le test**

`tests/actions-users.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS } from '../js/log.js';
import { validateUser, createUser, updateUser, setUserActive, userStats, userHistory } from '../js/actions/users.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';
const valid = { prenom: 'Nina', nom: 'Costa', email: 'Nina.Costa@mds-demo.fr', role: 'eleve', promo: 'Bachelor 2' };

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
});

test('validateUser : champs, email, rôle, promo, unicité', () => {
  assert.deepEqual(validateUser(valid), []);
  const errors = validateUser({ prenom: '', nom: ' ', email: 'pas-un-email', role: 'x', promo: null });
  assert.equal(errors.length, 4);
  assert.match(validateUser({ ...valid, promo: 'Inconnue' }).join(' '), /promo est obligatoire/);
  assert.deepEqual(validateUser({ ...valid, role: 'intervenant', promo: null }), []);
  assert.match(validateUser({ ...valid, email: 'lea.pezzetti@MDS-demo.fr' }).join(' '), /déjà utilisé/);
  assert.deepEqual(validateUser({ ...valid, email: 'lea.pezzetti@mds-demo.fr' }, 'user_001'), []);
});

test('createUser : actif, email normalisé, journal', () => {
  const u = createUser(valid, PEDAGO);
  assert.equal(u.actif, true);
  assert.equal(u.email, 'nina.costa@mds-demo.fr');
  assert.equal(u.promo, 'Bachelor 2');
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.USER_CREE);
  assert.equal(entry.userId, u.id);
  assert.match(entry.detail, /Nina Costa \(Élève\)/);
  assert.throws(() => createUser({ ...valid, email: 'nina.costa@mds-demo.fr' }, PEDAGO), /déjà utilisé/);
});

test('createUser : un intervenant n’a pas de promo', () => {
  const u = createUser({ ...valid, email: 'i@mds-demo.fr', role: 'intervenant', promo: 'Bachelor 2' }, PEDAGO);
  assert.equal(u.promo, null);
});

test('updateUser : champs protégés ignorés, changement de rôle efface la promo', () => {
  const up = updateUser('user_001', { role: 'intervenant', actif: false, id: 'x' }, PEDAGO);
  assert.equal(up.role, 'intervenant');
  assert.equal(up.promo, null);
  assert.equal(up.actif, true);
  assert.equal(up.id, 'user_001');
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_MODIFIE);
  assert.throws(() => updateUser('user_002', { email: 'lea.pezzetti@mds-demo.fr' }, PEDAGO), /déjà utilisé/);
  assert.throws(() => updateUser('nope', { nom: 'x' }, PEDAGO), /introuvable/);
});

test('setUserActive : désactivation journalisée, idempotente', () => {
  const before = store.log.list().length;
  const u = setUserActive('user_002', false, PEDAGO);
  assert.equal(u.actif, false);
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_DESACTIVE);
  setUserActive('user_002', false, PEDAGO);
  assert.equal(store.log.list().length, before + 1);
  const re = setUserActive('user_002', true, PEDAGO);
  assert.equal(re.actif, true);
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_MODIFIE);
  assert.match(store.log.list().at(-1).detail, /réactivé/);
});

test('userStats : retards et emprunts en cours', () => {
  const lateLoan = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  const s = userStats(lateLoan.userId, NOW);
  assert.equal(s.retards, 1);
  assert.ok(s.enCours >= 1);
  assert.ok(s.total >= s.enCours);
  const none = userStats('user_045', NOW);
  assert.deepEqual(none, { enCours: 0, retards: 0, reservations: 0, total: 0 });
});

test('userHistory : emprunts, réservations salle et journal', () => {
  const b = store.bookings.list()[0];
  const h = userHistory(b.userId);
  assert.ok(h.bookings.some((x) => x.id === b.id));
  assert.ok(h.loans.every((l) => l.userId === b.userId));
  assert.ok(h.log.every((e) => e.userId === b.userId || e.auteurId === b.userId));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/actions-users.test.mjs`
Expected: FAIL — `Cannot find module '../js/actions/users.js'`

- [ ] **Step 3 : Écrire `js/actions/users.js`**

```js
// js/actions/users.js — mutations métier sur les utilisateurs (gestion par la pédago).
import { store } from '../store.js';
import { ROLES, PROMOS, LABELS, LOAN_STATES } from '../models.js';
import { isLate } from '../rules.js';
import { logAction, ACTIONS, logForUser } from '../log.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROTECTED_FIELDS = ['id', 'actif', 'createdAt', 'updatedAt'];

function normalize(data) {
  return {
    prenom: String(data.prenom || '').trim(),
    nom: String(data.nom || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    role: data.role,
    promo: data.role === ROLES.ELEVE ? data.promo || null : null,
  };
}

export function validateUser(data, existingId = null) {
  const errors = [];
  const d = normalize(data);
  if (!d.prenom) errors.push('Le prénom est obligatoire.');
  if (!d.nom) errors.push('Le nom est obligatoire.');
  if (!EMAIL_RE.test(d.email)) errors.push('L’email est invalide.');
  if (!Object.values(ROLES).includes(d.role)) errors.push('Le rôle est invalide.');
  if (d.role === ROLES.ELEVE && !PROMOS.includes(d.promo)) errors.push('La promo est obligatoire pour un élève.');
  if (d.email && store.users.list((u) => u.id !== existingId && u.email.toLowerCase() === d.email).length) {
    errors.push('Cet email est déjà utilisé.');
  }
  return errors;
}

function assertValid(data, existingId) {
  const errors = validateUser(data, existingId);
  if (errors.length) throw new Error(errors.join(' '));
}

function requireUser(id) {
  const user = store.users.get(id);
  if (!user) throw new Error(`Utilisateur introuvable (${id})`);
  return user;
}

export function createUser(data, auteurId) {
  const clean = normalize(data);
  assertValid(clean);
  const user = store.users.create({ ...clean, actif: true });
  logAction({ auteurId, action: ACTIONS.USER_CREE, userId: user.id, detail: `${user.prenom} ${user.nom} (${LABELS.role[user.role]})` });
  return user;
}

export function updateUser(id, patch, auteurId) {
  const current = requireUser(id);
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => !PROTECTED_FIELDS.includes(k)));
  const merged = normalize({ ...current, ...safe });
  assertValid(merged, id);
  const user = store.users.update(id, merged);
  logAction({ auteurId, action: ACTIONS.USER_MODIFIE, userId: id, detail: `${user.prenom} ${user.nom} : ${Object.keys(safe).join(', ')}` });
  return user;
}

export function setUserActive(id, actif, auteurId) {
  const current = requireUser(id);
  if (current.actif === actif) return current;
  const user = store.users.update(id, { actif });
  const name = `${user.prenom} ${user.nom}`;
  if (actif) logAction({ auteurId, action: ACTIONS.USER_MODIFIE, userId: id, detail: `${name} : compte réactivé` });
  else logAction({ auteurId, action: ACTIONS.USER_DESACTIVE, userId: id, detail: `${name} : compte désactivé` });
  return user;
}

export function userStats(userId, date) {
  const loans = store.loans.list((l) => l.userId === userId);
  return {
    enCours: loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length,
    retards: loans.filter((l) => isLate(l, date)).length,
    reservations: loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).length,
    total: loans.length,
  };
}

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

export function userHistory(userId) {
  return {
    loans: store.loans.list((l) => l.userId === userId).sort(byCreatedDesc),
    bookings: store.bookings.list((b) => b.userId === userId).sort((a, b) => b.date.localeCompare(a.date)),
    log: logForUser(userId),
  };
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/actions-users.test.mjs`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/actions/users.js tests/actions-users.test.mjs
git commit -m "feat(actions): mutations des utilisateurs — création, modification, activation, statistiques"
```

---

### Task 4 : Tableau de bord — `kpi.js` et vue dashboard

**Files:**
- Create: `js/admin/kpi.js`, `js/admin/views/dashboard.js`
- Modify: `js/admin/app.js` (import + route `/dashboard`)
- Test: `tests/kpi.test.mjs`, `tests/admin-dashboard.test.mjs`

**Interfaces:**
- Consumes : `ITEM_STATES`, `LOAN_STATES`, `BOOKING_STATES`, `MAINT_STATES`, `isLate`, `ymd`, `now`, `recentLog`, `ACTION_LABELS`, `setTopbar`, `badge`, `avatar`, `formatDate`, `formatTime`, `relativeDay`, `fullName`, `escapeHtml`, `navigate`.
- Produces : `computeKpis({ items, loans, bookings, maintenance }, date) → { disponibles, enCours, retards, reservationsSalle, signalements, aRemettre }`, `joinLoan(loan, items, users) → { loan, item, user }`, `lateLoans({ loans, items, users }, date) → [{ loan, item, user, joursRetard }]` (tri retard décroissant), `dueTodayReservations({ loans, items, users }, date)`, `openReports({ maintenance, items, users }) → [{ event, item, auteur }]` ; `dashboardHtml(data)`, `dashboardView(container)`.

- [ ] **Step 1 : Écrire les tests**

`tests/kpi.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, joinLoan, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('computeKpis sur le seed du jeudi 10h', () => {
  assert.deepEqual(computeKpis(db, NOW), {
    disponibles: 30, enCours: 10, retards: 2, reservationsSalle: 3, signalements: 1, aRemettre: 0,
  });
});

test('aRemettre compte les réservations dont le retrait est prévu le jour donné', () => {
  const first = db.loans.find((l) => l.statut === 'reservee');
  const day = new Date(first.debutPrevu);
  assert.equal(computeKpis(db, day).aRemettre, 1);
  assert.equal(dueTodayReservations(db, day).length, 1);
  assert.equal(dueTodayReservations(db, day)[0].user.id, first.userId);
});

test('lateLoans : jointure, jours de retard, tri décroissant', () => {
  const late = lateLoans(db, NOW);
  assert.equal(late.length, 2);
  assert.equal(late[0].item.reference, 'dji-rsc2');
  assert.equal(late[0].joursRetard, 3);
  assert.equal(late[1].item.reference, 'casque-audio');
  assert.equal(late[1].joursRetard, 1);
  assert.ok(late.every((x) => x.user && x.user.id === x.loan.userId));
});

test('joinLoan tolère un objet ou un utilisateur manquant', () => {
  const j = joinLoan({ itemId: 'nope', userId: 'nope' }, db.items, db.users);
  assert.equal(j.item, null);
  assert.equal(j.user, null);
});

test('openReports : signalements ouverts joints', () => {
  const r = openReports(db);
  assert.equal(r.length, 1);
  assert.equal(r[0].item.reference, 'souris');
  assert.ok(r[0].auteur);
  assert.match(r[0].event.description, /Clic gauche/);
});
```

`tests/admin-dashboard.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';
import { dashboardHtml } from '../js/admin/views/dashboard.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('dashboardHtml : KPI, retards, signalements, activités', () => {
  const activity = [...db.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const html = dashboardHtml({
    kpis: computeKpis(db, NOW), late: lateLoans(db, NOW), due: dueTodayReservations(db, NOW),
    reports: openReports(db), activity, users: db.users, date: NOW,
  });
  assert.match(html, /kpi__value">30</);
  assert.match(html, /kpi__value">10</);
  assert.match(html, /kpi--alert[^>]*>[\s\S]*?kpi__value">2</);
  assert.match(html, /DJI Ronin RSC2/);
  assert.match(html, /3 jours/);
  assert.match(html, /1 jour</);
  assert.match(html, /Clic gauche/);
  assert.match(html, /Aucune remise prévue aujourd’hui/);
  assert.equal((html.match(/activity__item/g) || []).length, 15);
  assert.match(html, /data-href="\/materiel\/item_/);
});

test('dashboardHtml : états vides', () => {
  const html = dashboardHtml({ kpis: computeKpis({ items: [], loans: [], bookings: [], maintenance: [] }, NOW), late: [], due: [], reports: [], activity: [], users: [], date: NOW });
  assert.match(html, /Aucun retard/);
  assert.match(html, /Aucun signalement ouvert/);
  assert.match(html, /Aucune activité/);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/kpi.test.mjs tests/admin-dashboard.test.mjs`
Expected: FAIL — modules introuvables

- [ ] **Step 3 : Écrire `js/admin/kpi.js`**

```js
// js/admin/kpi.js — calculs du tableau de bord (fonctions pures sur des tableaux).
import { ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES } from '../models.js';
import { isLate, ymd } from '../rules.js';

const DAY = 24 * 60 * 60 * 1000;

export function computeKpis({ items, loans, bookings, maintenance }, date) {
  const today = ymd(date);
  return {
    disponibles: items.filter((i) => i.etat === ITEM_STATES.DISPONIBLE).length,
    enCours: loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length,
    retards: loans.filter((l) => isLate(l, date)).length,
    reservationsSalle: bookings.filter((b) => b.statut === BOOKING_STATES.A_VENIR && b.date >= today).length,
    signalements: maintenance.filter((m) => m.statut === MAINT_STATES.OUVERT).length,
    aRemettre: loans.filter((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === today).length,
  };
}

export function joinLoan(loan, items, users) {
  return {
    loan,
    item: items.find((i) => i.id === loan.itemId) || null,
    user: users.find((u) => u.id === loan.userId) || null,
  };
}

export function lateLoans({ loans, items, users }, date) {
  return loans
    .filter((l) => isLate(l, date))
    .map((l) => ({ ...joinLoan(l, items, users), joursRetard: Math.max(1, Math.ceil((date - new Date(l.finPrevue)) / DAY)) }))
    .sort((a, b) => b.joursRetard - a.joursRetard);
}

export function dueTodayReservations({ loans, items, users }, date) {
  const today = ymd(date);
  return loans
    .filter((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === today)
    .map((l) => joinLoan(l, items, users))
    .sort((a, b) => a.loan.debutPrevu.localeCompare(b.loan.debutPrevu));
}

export function openReports({ maintenance, items, users }) {
  return maintenance
    .filter((m) => m.statut === MAINT_STATES.OUVERT)
    .map((event) => ({
      event,
      item: items.find((i) => i.id === event.itemId) || null,
      auteur: users.find((u) => u.id === event.auteurId) || null,
    }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date));
}
```

- [ ] **Step 4 : Écrire `js/admin/views/dashboard.js`**

```js
// js/admin/views/dashboard.js — tableau de bord : KPI, retards, remises du jour, signalements, journal.
import { store } from '../../store.js';
import { now } from '../../rules.js';
import { recentLog, ACTION_LABELS } from '../../log.js';
import { navigate } from '../../router.js';
import { escapeHtml, badge, avatar, formatDate, formatTime, relativeDay, fullName } from '../../ui.js';
import { setTopbar } from '../layout.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports } from '../kpi.js';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function kpiCard(label, value, extra = '', variant = '') {
  return `<div class="kpi ${variant}"><span class="kpi__label">${escapeHtml(label)}</span><span class="kpi__value">${value}</span><span class="kpi__delta">${escapeHtml(extra)}</span></div>`;
}

function lateRows(late, date) {
  if (!late.length) return '<div class="empty-state">Aucun retard. 🎉</div>';
  return `<table class="table"><thead><tr><th>Matériel</th><th>Emprunteur</th><th>Retour prévu</th><th>Retard</th></tr></thead><tbody>${late.map(({ loan, item, user, joursRetard }) => `
    <tr data-href="/materiel/${escapeHtml(loan.itemId)}">
      <td><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong></td>
      <td>${user ? `<span class="row">${avatar(user)}${escapeHtml(fullName(user))}</span>` : '—'}</td>
      <td>${escapeHtml(relativeDay(loan.finPrevue, date))}</td>
      <td>${badge('loan', 'en_retard')} <span class="body-tiny text-secondary">${plural(joursRetard, 'jour', 'jours')}</span></td>
    </tr>`).join('')}</tbody></table>`;
}

function dueList(due) {
  if (!due.length) return '<div class="empty-state">Aucune remise prévue aujourd’hui.</div>';
  return `<div class="list">${due.map(({ loan, item, user }) => `
    <div class="list__item" data-href="/materiel/${escapeHtml(loan.itemId)}">
      ${user ? avatar(user) : ''}
      <div class="list__grow"><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong><span class="activity__detail">${user ? escapeHtml(fullName(user)) : '—'} · retrait à ${escapeHtml(formatTime(loan.debutPrevu))} · code ${escapeHtml(loan.codeRetrait || '')}</span></div>
      ${badge('loan', loan.statut)}
    </div>`).join('')}</div>
    <p class="body-tiny text-secondary">La remise se fait depuis l’écran Emprunts (phase 3).</p>`;
}

function reportsList(reports) {
  if (!reports.length) return '<div class="empty-state">Aucun signalement ouvert.</div>';
  return `<div class="list">${reports.map(({ event, item, auteur }) => `
    <div class="list__item" data-href="/materiel/${escapeHtml(event.itemId)}">
      <div class="list__grow"><strong>${escapeHtml(item ? item.nom : event.itemId)}</strong><span class="activity__detail">${escapeHtml(event.description)}</span><span class="activity__detail">${escapeHtml(formatDate(event.date))}${auteur ? ` · ${escapeHtml(fullName(auteur))}` : ''}</span></div>
      ${badge('maint', event.statut)}
    </div>`).join('')}</div>`;
}

function activityList(activity, users, date) {
  if (!activity.length) return '<div class="empty-state">Aucune activité.</div>';
  const nameOf = (id) => { const u = users.find((x) => x.id === id); return u ? fullName(u) : id; };
  return `<div class="activity">${activity.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong> <span class="text-secondary">· ${escapeHtml(nameOf(e.auteurId))}</span><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function dashboardHtml({ kpis, late, due, reports, activity, users, date }) {
  return `
    <div class="grid-4">
      ${kpiCard('Matériel disponible', kpis.disponibles, 'exemplaires prêts à être empruntés')}
      ${kpiCard('Emprunts en cours', kpis.enCours, `${plural(kpis.aRemettre, 'remise prévue', 'remises prévues')} aujourd’hui`, 'kpi--brand')}
      ${kpiCard('Retards', kpis.retards, kpis.retards ? 'à relancer' : 'tout est rentré', kpis.retards ? 'kpi--alert' : '')}
      ${kpiCard('Réservations salle à venir', kpis.reservationsSalle, `${plural(kpis.signalements, 'signalement ouvert', 'signalements ouverts')}`, 'kpi--teal')}
    </div>
    <div class="grid-2">
      <div class="stack">
        <div class="card"><div class="card__header"><h2 class="card__title">Retards</h2><a class="body-sm" href="#/emprunts">Tout voir →</a></div>${lateRows(late, date)}</div>
        <div class="card"><div class="card__header"><h2 class="card__title">À remettre aujourd’hui</h2></div>${dueList(due)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card__header"><h2 class="card__title">Signalements ouverts</h2><a class="body-sm" href="#/maintenance">Tout voir →</a></div>${reportsList(reports)}</div>
        <div class="card"><div class="card__header"><h2 class="card__title">Dernières activités</h2></div>${activityList(activity, users, date)}</div>
      </div>
    </div>`;
}

export function dashboardView(container) {
  const render = () => {
    const date = now();
    const data = {
      items: store.items.list(), loans: store.loans.list(), bookings: store.bookings.list(),
      maintenance: store.maintenance.list(), users: store.users.list(),
    };
    setTopbar({ title: 'Tableau de bord', subtitle: formatDate(date) });
    container.innerHTML = dashboardHtml({
      kpis: computeKpis(data, date), late: lateLoans(data, date), due: dueTodayReservations(data, date),
      reports: openReports(data), activity: recentLog(15), users: data.users, date,
    });
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.href)));
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 5 : Brancher la route dans `js/admin/app.js`**

Remplacer la ligne commentée `// import { dashboardView } …` par `import { dashboardView } from './views/dashboard.js';` et la route `{ path: '/dashboard', view: guard(aVenirView('Tableau de bord', 1)) }` par `{ path: '/dashboard', view: guard(dashboardView) }`.

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/kpi.test.mjs tests/admin-dashboard.test.mjs`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 7 : Vérifier dans le navigateur**

`http://localhost:8000/admin.html#/dashboard` : 4 KPI (30 / 42… non : 30, 10, 2 en rouge, 3), tableau Retards avec DJI Ronin (3 jours) et Casque audio #2 (1 jour), « Aucune remise prévue aujourd’hui », signalement Souris #3, 15 activités. Clic sur une ligne de retard → `#/materiel/item_…` (vue « à venir » pour l'instant). Aucune erreur console.

- [ ] **Step 8 : Commit**

```bash
git add js/admin/kpi.js js/admin/views/dashboard.js js/admin/app.js tests/kpi.test.mjs tests/admin-dashboard.test.mjs
git commit -m "feat(admin): tableau de bord — KPI, retards, remises du jour, signalements, journal"
```

---

### Task 5 : Table réutilisable et vue Matériel (liste, filtres, ajout)

**Files:**
- Create: `js/admin/table.js`, `js/admin/views/materiel.js`
- Modify: `js/admin/app.js` (import + route `/materiel`)
- Test: `tests/admin-table.test.mjs`, `tests/admin-materiel.test.mjs`

**Interfaces:**
- Consumes : `store.items`, `createItem`, `auth.currentUserId()`, `CATEGORIES`, `CIRCUITS`, `ITEM_STATES`, `LABELS`, `escapeHtml`, `badge`, `openModal`, `toast`, `navigate`, `setTopbar`, `takeSearch`.
- Produces : `sortRows(rows, sort, columns)`, `toggleSort(sort, key) → { key, dir }`, `renderTable({ columns, rows, sort?, rowHref?, emptyText? }) → html`, `bindTable(root, { onSort, onRow })` ; `filterItems(items, { q, categorie, circuit, etat })`, `COLUMNS`, `materielHtml({ items, total, disponibles, filters, sort })`, `itemFormHtml(item?, references?)`, `readItemForm(root)`, `materielView(container)`. Une colonne : `{ key, label, sortable?, align?, render?(row) → html déjà échappé, sortValue?(row) }`.

- [ ] **Step 1 : Écrire les tests**

`tests/admin-table.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, toggleSort, renderTable } from '../js/admin/table.js';

const columns = [
  { key: 'nom', label: 'Nom', sortable: true },
  { key: 'valeur', label: 'Valeur', sortable: true, align: 'right' },
  { key: 'etat', label: 'État', sortValue: (r) => ({ a: 1, b: 2 }[r.etat]) },
];
const rows = [
  { id: '1', nom: 'Écran', valeur: 10, etat: 'b' },
  { id: '2', nom: 'câble', valeur: 200, etat: 'a' },
  { id: '3', nom: 'Batterie 10', valeur: null, etat: 'a' },
  { id: '4', nom: 'Batterie 9', valeur: 5, etat: 'b' },
];

test('sortRows : texte (locale fr, numérique), nombres, null en dernier, desc', () => {
  assert.deepEqual(sortRows(rows, { key: 'nom', dir: 'asc' }, columns).map((r) => r.id), ['4', '3', '2', '1']);
  assert.deepEqual(sortRows(rows, { key: 'valeur', dir: 'asc' }, columns).map((r) => r.id), ['4', '1', '2', '3']);
  assert.deepEqual(sortRows(rows, { key: 'valeur', dir: 'desc' }, columns).map((r) => r.id), ['2', '1', '4', '3']);
  assert.deepEqual(sortRows(rows, { key: 'etat', dir: 'asc' }, columns).map((r) => r.etat), ['a', 'a', 'b', 'b']);
  assert.deepEqual(sortRows(rows, null, columns).map((r) => r.id), ['1', '2', '3', '4']);
  assert.notEqual(sortRows(rows, null, columns), rows);
});

test('toggleSort : asc → desc → asc, nouvelle clé → asc', () => {
  assert.deepEqual(toggleSort(null, 'nom'), { key: 'nom', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'asc' }, 'nom'), { key: 'nom', dir: 'desc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'desc' }, 'nom'), { key: 'nom', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'desc' }, 'valeur'), { key: 'valeur', dir: 'asc' });
});

test('renderTable : en-têtes triables avec flèche, cellules échappées, lien de ligne', () => {
  const html = renderTable({ columns, rows: [{ id: '1', nom: '<b>x</b>', valeur: 1, etat: 'a' }], sort: { key: 'valeur', dir: 'desc' }, rowHref: (r) => `/materiel/${r.id}` });
  assert.match(html, /<th data-sortable data-key="nom">Nom<\/th>/);
  assert.match(html, /<th data-sortable data-key="valeur" style="text-align:right">Valeur ↓<\/th>/);
  assert.match(html, /<th>État<\/th>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<tr data-href="\/materiel\/1">/);
});

test('renderTable : render personnalisé et état vide', () => {
  const cols = [{ key: 'nom', label: 'Nom', render: (r) => `<em>${r.nom}</em>` }];
  assert.match(renderTable({ columns: cols, rows: [{ nom: 'A' }] }), /<td><em>A<\/em><\/td>/);
  const empty = renderTable({ columns: cols, rows: [], emptyText: 'Rien.' });
  assert.match(empty, /empty-state">Rien\.</);
  assert.doesNotMatch(empty, /<tbody>/);
});
```

`tests/admin-materiel.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { filterItems, COLUMNS, materielHtml, itemFormHtml } from '../js/admin/views/materiel.js';
import { sortRows } from '../js/admin/table.js';

const db = buildSeed(new Date(2026, 8, 17, 10, 0));

test('filterItems : recherche, catégorie, circuit, état combinés', () => {
  assert.equal(filterItems(db.items, {}).length, 44);
  assert.equal(filterItems(db.items, { q: 'canon r10' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'canon' }).length, 4); // + 3 batteries Canon LP-E17
  assert.equal(filterItems(db.items, { q: 'MDS-0001' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'armoire' }).length, 16);
  assert.equal(filterItems(db.items, { categorie: 'Audio' }).length, 9);
  assert.equal(filterItems(db.items, { circuit: 'salle' }).length, 5);
  assert.equal(filterItems(db.items, { etat: 'hs' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'multi', etat: 'emprunte' }).length, 2);
});

test('COLUMNS : clés attendues, rendus échappés', () => {
  assert.deepEqual(COLUMNS.map((c) => c.key), ['code', 'nom', 'categorie', 'circuit', 'etat', 'localisation', 'valeurEstimee']);
  const item = { ...db.items[0], nom: '<x>' };
  assert.match(COLUMNS[1].render(item), /&lt;x&gt;/);
  assert.match(COLUMNS[3].render(item), /badge--available">Self-service/);
  assert.match(COLUMNS[6].render(item), /15 €/);
});

test('materielHtml : compteurs, filtres, table triée', () => {
  const filters = { q: 'sd', categorie: '', circuit: 'valeur', etat: '' };
  const items = sortRows(filterItems(db.items, filters), { key: 'code', dir: 'asc' }, COLUMNS);
  const html = materielHtml({ items, total: 44, disponibles: 30, filters, sort: { key: 'code', dir: 'asc' } });
  assert.match(html, /44 exemplaires · 30 disponibles/);
  assert.match(html, /6 résultats/);
  assert.match(html, /value="sd"/);
  assert.match(html, /<option value="valeur" selected>Sur réservation/);
  assert.match(html, /Carte SD 256 Go #1/);
  assert.match(html, /data-key="code">Code ↑/);
});

test('itemFormHtml : champs nommés, datalist des références, valeurs pré-remplies', () => {
  const html = itemFormHtml({ nom: 'Canon "R10"', reference: 'canon-r10', categorie: 'Photo', circuit: 'valeur', valeurEstimee: 1100, localisation: 'Armoire', dateAchat: '2025-09-01', notes: '' }, ['canon-r10', 'zoom-h5']);
  for (const name of ['nom', 'reference', 'categorie', 'circuit', 'valeurEstimee', 'localisation', 'dateAchat', 'notes']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /value="Canon &quot;R10&quot;"/);
  assert.match(html, /<option value="Photo" selected>/);
  assert.match(html, /<option value="valeur" selected>/);
  assert.match(html, /<datalist id="ref-list"><option value="canon-r10"><option value="zoom-h5"><\/datalist>/);
  assert.match(itemFormHtml(), /<option value="self" selected>/);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/admin-table.test.mjs tests/admin-materiel.test.mjs`
Expected: FAIL — modules introuvables

- [ ] **Step 3 : Écrire `js/admin/table.js`**

```js
// js/admin/table.js — table triable réutilisable : tri pur, rendu HTML pur, branchement DOM.
import { escapeHtml } from '../ui.js';

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export function sortRows(rows, sort, columns) {
  if (!sort || !sort.key) return [...rows];
  const col = columns.find((c) => c.key === sort.key);
  const value = (r) => (col && col.sortValue ? col.sortValue(r) : r[sort.key]);
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return collator.compare(String(x), String(y)) * dir;
  });
}

export function toggleSort(sort, key) {
  if (sort && sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: 'asc' };
}

export function renderTable({ columns, rows, sort = null, rowHref = null, emptyText = 'Aucun résultat.' }) {
  const head = columns.map((c) => {
    const arrow = sort && sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
    const attrs = `${c.sortable ? ` data-sortable data-key="${c.key}"` : ''}${c.align ? ` style="text-align:${c.align}"` : ''}`;
    return `<th${attrs}>${escapeHtml(c.label)}${arrow}</th>`;
  }).join('');
  const table = (body) => `<table class="table"><thead><tr>${head}</tr></thead>${body}</table>`;
  if (!rows.length) return `${table('')}<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  const body = rows.map((r) => {
    const href = rowHref ? rowHref(r) : null;
    const cells = columns.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('');
    return `<tr${href ? ` data-href="${escapeHtml(href)}"` : ''}>${cells}</tr>`;
  }).join('');
  return table(`<tbody>${body}</tbody>`);
}

// Branche le tri (clic sur en-tête) et la navigation (clic sur ligne, sauf sur un contrôle).
export function bindTable(root, { onSort, onRow }) {
  root.querySelectorAll('th[data-sortable]').forEach((th) => th.addEventListener('click', () => onSort(th.dataset.key)));
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, label, select')) return;
    onRow(tr.dataset.href);
  }));
}
```

- [ ] **Step 4 : Écrire `js/admin/views/materiel.js`**

```js
// js/admin/views/materiel.js — inventaire : liste filtrable/triable, ajout d’un exemplaire.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { CATEGORIES, CIRCUITS, ITEM_STATES, LABELS } from '../../models.js';
import { escapeHtml, badge, openModal, toast } from '../../ui.js';
import { createItem } from '../../actions/items.js';
import { setTopbar, takeSearch } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';

export function filterItems(items, { q = '', categorie = '', circuit = '', etat = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return items.filter((i) => (!categorie || i.categorie === categorie)
    && (!circuit || i.circuit === circuit)
    && (!etat || i.etat === etat)
    && (!needle || [i.nom, i.code, i.reference, i.localisation].some((v) => String(v || '').toLowerCase().includes(needle))));
}

export const COLUMNS = [
  { key: 'code', label: 'Code', sortable: true },
  { key: 'nom', label: 'Matériel', sortable: true, render: (i) => `<strong>${escapeHtml(i.nom)}</strong>` },
  { key: 'categorie', label: 'Catégorie', sortable: true },
  { key: 'circuit', label: 'Circuit', sortable: true, render: (i) => badge('circuit', i.circuit) },
  { key: 'etat', label: 'État', sortable: true, render: (i) => badge('item', i.etat) },
  { key: 'localisation', label: 'Localisation', sortable: true },
  { key: 'valeurEstimee', label: 'Valeur', sortable: true, align: 'right', render: (i) => `${escapeHtml(i.valeurEstimee)} €` },
];

const options = (values, labelOf, selected, emptyLabel) => `<option value="">${escapeHtml(emptyLabel)}</option>${values.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(labelOf(v))}</option>`).join('')}`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function materielHtml({ items, total, disponibles, filters, sort }) {
  return `
    <div class="page-header">
      <div><h2 class="h6">Inventaire</h2><p class="page-header__meta">${total} exemplaires · ${disponibles} disponibles</p></div>
      <p class="page-header__meta" data-role="count">${plural(items.length, 'résultat', 'résultats')}</p>
    </div>
    <div class="card">
      <div class="filters">
        <input class="input input--search" type="search" name="q" placeholder="Nom, code, référence, localisation…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
        <select class="select" name="categorie" aria-label="Catégorie">${options(CATEGORIES, (v) => v, filters.categorie, 'Toutes les catégories')}</select>
        <select class="select" name="circuit" aria-label="Circuit">${options(Object.values(CIRCUITS), (v) => LABELS.circuit[v], filters.circuit, 'Tous les circuits')}</select>
        <select class="select" name="etat" aria-label="État">${options(Object.values(ITEM_STATES), (v) => LABELS.itemState[v], filters.etat, 'Tous les états')}</select>
      </div>
      <div class="toolbar" data-role="toolbar"></div>
      <div data-role="table">${renderTable({ columns: COLUMNS, rows: items, sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel ne correspond à ces filtres.' })}</div>
    </div>`;
}

export function itemFormHtml(item = {}, references = []) {
  const field = (label, name, input) => `<label class="field"><span class="field__label">${label}</span>${input}</label>`;
  return `
    <div class="form-grid">
      ${field('Nom', 'nom', `<input class="input" name="nom" value="${escapeHtml(item.nom || '')}" placeholder="Canon R10 + 18-55" required>`)}
      ${field('Référence (regroupe les exemplaires identiques)', 'reference', `<input class="input" name="reference" list="ref-list" value="${escapeHtml(item.reference || '')}" placeholder="canon-r10" required>`)}
      ${field('Catégorie', 'categorie', `<select class="select" name="categorie">${CATEGORIES.map((c) => `<option value="${escapeHtml(c)}"${c === (item.categorie || CATEGORIES[0]) ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>`)}
      ${field('Circuit', 'circuit', `<select class="select" name="circuit">${Object.values(CIRCUITS).map((c) => `<option value="${c}"${c === (item.circuit || CIRCUITS.SELF) ? ' selected' : ''}>${escapeHtml(LABELS.circuit[c])}</option>`).join('')}</select>`)}
      ${field('Valeur estimée (€)', 'valeurEstimee', `<input class="input" name="valeurEstimee" type="number" min="0" step="1" value="${escapeHtml(item.valeurEstimee ?? 0)}">`)}
      ${field('Localisation', 'localisation', `<input class="input" name="localisation" value="${escapeHtml(item.localisation || '')}" placeholder="Armoire sécurisée">`)}
      ${field('Date d’achat', 'dateAchat', `<input class="input" name="dateAchat" type="date" value="${escapeHtml(item.dateAchat || '')}">`)}
      <label class="field field--full"><span class="field__label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(item.notes || '')}</textarea></label>
    </div>
    <datalist id="ref-list">${references.map((r) => `<option value="${escapeHtml(r)}">`).join('')}</datalist>`;
}

export function readItemForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  return {
    nom: value('nom'), reference: value('reference'), categorie: value('categorie'), circuit: value('circuit'),
    valeurEstimee: value('valeurEstimee'), localisation: value('localisation'), dateAchat: value('dateAchat'), notes: value('notes'),
  };
}

export function materielView(container) {
  const filters = { q: takeSearch(), categorie: '', circuit: '', etat: '' };
  let sort = { key: 'code', dir: 'asc' };

  const currentRows = () => sortRows(filterItems(store.items.list(), filters), sort, COLUMNS);
  const references = () => [...new Set(store.items.list().map((i) => i.reference))].sort();

  // Ne re-rend que la table (et le compteur) pour garder le focus dans les filtres.
  const renderTableOnly = () => {
    const rows = currentRows();
    container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: COLUMNS, rows, sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel ne correspond à ces filtres.' });
    container.querySelector('[data-role="count"]').textContent = plural(rows.length, 'résultat', 'résultats');
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const render = () => {
    const all = store.items.list();
    container.innerHTML = materielHtml({
      items: currentRows(), total: all.length, disponibles: all.filter((i) => i.etat === ITEM_STATES.DISPONIBLE).length,
      filters, sort,
    });
    container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
    for (const name of ['categorie', 'circuit', 'etat']) {
      container.querySelector(`[name="${name}"]`).addEventListener('change', (e) => { filters[name] = e.target.value; renderTableOnly(); });
    }
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const openAddModal = () => openModal({
    title: 'Ajouter du matériel',
    body: itemFormHtml({}, references()),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: 'Ajouter', variant: 'primary',
        onClick: (modal) => {
          try {
            const item = createItem(readItemForm(modal), auth.currentUserId());
            toast(`${item.nom} ajouté (${item.code})`, 'success');
            navigate(`/materiel/${item.id}`);
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        },
      },
    ],
  });

  setTopbar({ title: 'Matériel', subtitle: 'Inventaire complet', action: { label: '+ Ajouter du matériel', onClick: openAddModal } });
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 5 : Brancher la route dans `js/admin/app.js`**

Import `import { materielView } from './views/materiel.js';` et route `{ path: '/materiel', view: guard(materielView) }`.

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/admin-table.test.mjs tests/admin-materiel.test.mjs`
Expected: `# pass 8`, `# fail 0`

- [ ] **Step 7 : Vérifier dans le navigateur**

`#/materiel` : 44 exemplaires · 30 disponibles ; taper « canon » filtre en direct sans perdre le focus ; filtre État = Hors service → Clavier #3 ; clic sur « Valeur » trie (flèche) ; clic ligne → `#/materiel/item_…`. Topbar : recherche globale « ronin » + Entrée depuis le dashboard → arrive sur Matériel filtré. « + Ajouter du matériel » → modale ; « Ajouter » avec nom vide → toast d'erreur, modale ouverte ; formulaire valide → toast « … ajouté (MDS-0045) » et navigation vers la fiche (vue « à venir » pour l'instant) ; retour sur la liste : 45 exemplaires.

- [ ] **Step 8 : Commit**

```bash
git add js/admin/table.js js/admin/views/materiel.js js/admin/app.js tests/admin-table.test.mjs tests/admin-materiel.test.mjs
git commit -m "feat(admin): inventaire — table triable, filtres, ajout de matériel"
```

---

### Task 6 : QR codes, fiche matériel, étiquettes imprimables, sélection multiple

**Files:**
- Create: `js/qr.js`, `vendor/qrcode.min.js`, `vendor/README.md`, `js/admin/views/materielFiche.js`, `etiquettes.html`
- Modify: `admin.html` (script vendor), `js/admin/views/materiel.js` (colonne de sélection + bouton d'impression), `js/admin/app.js` (route `/materiel/:id`)
- Test: `tests/qr.test.mjs`, `tests/admin-fiche.test.mjs`, `tests/admin-materiel.test.mjs` (ajout d'un test)

**Interfaces:**
- Consumes : `ITEM_CODE_RE` (models), `updateItem`, `setItemState`, `manualTransitions`, `itemHistory`, `itemFormHtml`, `readItemForm`, `isLate`, `now`, `ACTION_LABELS`, `LABELS`, helpers `ui`, `setTopbar`, `navigate`, `store`, `auth`.
- Produces : `isItemCode(text) → bool`, `parseLoanCode(text) → { loanId, code6 } | null`, `loanQrPayload(loan) → string`, `renderQr(container, text, size = 128) → bool` (false = repli texte, bibliothèque absente) ; `ficheHtml({ item, history, users, transitions, references, date })`, `materielFicheView(container, { id })` ; `SELECT_COLUMN` (materiel.js) ; page `etiquettes.html?codes=MDS-0001,MDS-0002`.

- [ ] **Step 1 : Récupérer la bibliothèque QR (copie locale, pas de CDN à l'exécution)**

```bash
mkdir -p vendor
curl -sL -o vendor/qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
head -c 20 vendor/qrcode.min.js   # attendu : "var QRCode;!function"
wc -c vendor/qrcode.min.js         # attendu : 19927
```

`vendor/README.md` :

```markdown
# Bibliothèques tierces (copies locales)

| Fichier | Projet | Version | Licence | Source |
|---|---|---|---|---|
| `qrcode.min.js` | qrcodejs (davidshimjs) | 1.0.0 | MIT | https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js |

Chargées via `<script src>` (globales), jamais depuis un CDN à l’exécution.
```

Dans `admin.html`, ajouter avant `<script type="module" src="js/admin/app.js"></script>` :

```html
  <script src="vendor/qrcode.min.js"></script>
```

- [ ] **Step 2 : Écrire les tests**

`tests/qr.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isItemCode, parseLoanCode, loanQrPayload, renderQr } from '../js/qr.js';

test('isItemCode', () => {
  assert.equal(isItemCode('MDS-0042'), true);
  assert.equal(isItemCode(' MDS-0042 '), true);
  assert.equal(isItemCode('MDS-42'), false);
  assert.equal(isItemCode('LOAN-x-ABCDEF'), false);
  assert.equal(isItemCode(null), false);
});

test('loanQrPayload et parseLoanCode sont symétriques', () => {
  const payload = loanQrPayload({ id: 'loan_001', codeRetrait: 'AB12CD' });
  assert.equal(payload, 'LOAN-loan_001-AB12CD');
  assert.deepEqual(parseLoanCode(payload), { loanId: 'loan_001', code6: 'AB12CD' });
  assert.deepEqual(parseLoanCode(' LOAN-loan_kx9abc-ZZ9999 '), { loanId: 'loan_kx9abc', code6: 'ZZ9999' });
  assert.equal(parseLoanCode('LOAN-abc'), null);
  assert.equal(parseLoanCode('MDS-0001'), null);
});

test('renderQr sans bibliothèque : repli texte, renvoie false', () => {
  const calls = [];
  const c = { innerHTML: 'x', textContent: '', setAttribute: (k, v) => calls.push([k, v]) };
  assert.equal(renderQr(c, 'MDS-0001'), false);
  assert.equal(c.innerHTML, '');
  assert.equal(c.textContent, 'MDS-0001');
});
```

`tests/admin-fiche.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { itemHistory, manualTransitions } from '../js/actions/items.js';
import { ficheHtml } from '../js/admin/views/materielFiche.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

const build = (item, extra = {}) => ficheHtml({
  item, history: itemHistory(item.id), users: store.users.list(), transitions: manualTransitions(item),
  references: ['canon-r10'], date: NOW, ...extra,
});

test('ficheHtml d’un objet emprunté : en-tête, badges, formulaire, pas de bouton d’état', () => {
  const canon = store.items.list((i) => i.reference === 'canon-r10')[0];
  const html = build(canon);
  assert.match(html, /<h2 class="h5">Canon R10 \+ objectif 18-55 \+ bague<\/h2>/);
  assert.match(html, /badge--borrowed">Sur réservation/);
  assert.match(html, /badge--borrowed">Emprunté/);
  assert.match(html, /name="nom" value="Canon R10 \+ objectif 18-55 \+ bague"/);
  assert.doesNotMatch(html, /data-state=/);
  assert.match(html, /piloté par l’emprunt/);
  assert.match(html, /Optic Services/);
  assert.match(html, /id="qr" data-code="MDS-0029"/);
  assert.match(html, /etiquettes\.html\?codes=MDS-0029/);
  assert.match(html, /Historique des emprunts<\/h3><span class="body-sm text-secondary">\d+</);
});

test('ficheHtml d’un objet disponible : boutons de transition', () => {
  const free = store.items.list((i) => i.etat === 'disponible')[0];
  const html = build(free);
  assert.match(html, /data-state="maintenance">Passer en « Maintenance »/);
  assert.match(html, /data-state="hs">Passer en « Hors service »/);
});

test('ficheHtml : retard affiché et photos d’emprunt', () => {
  const dji = store.items.list((i) => i.reference === 'dji-rsc2')[0];
  const late = build(dji);
  assert.match(late, /badge--late">En retard/);
  const loan = store.loans.list((l) => l.itemId === dji.id && l.statut === 'en_cours')[0];
  store.loans.update(loan.id, { photoEmprunt: 'data:image/jpeg;base64,AAAA' });
  const withPhoto = build(store.items.get(dji.id));
  assert.match(withPhoto, /<img class="thumb" src="data:image\/jpeg;base64,AAAA" alt="Photo à l’emprunt">/);
});
```

Ajouter à `tests/admin-materiel.test.mjs` :

```js
import { SELECT_COLUMN } from '../js/admin/views/materiel.js';

test('SELECT_COLUMN : case à cocher portant le code', () => {
  assert.equal(SELECT_COLUMN.key, 'select');
  assert.match(SELECT_COLUMN.render({ code: 'MDS-0007' }), /<input type="checkbox" data-select="MDS-0007"/);
});
```

(fusionner l'import avec la ligne d'import existante de `materiel.js`).

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/qr.test.mjs tests/admin-fiche.test.mjs tests/admin-materiel.test.mjs`
Expected: FAIL — modules/exports introuvables

- [ ] **Step 4 : Écrire `js/qr.js`**

```js
// js/qr.js — codes QR : formats des charges utiles et rendu via vendor/qrcode.min.js
// (bibliothèque globale `QRCode`, chargée par <script> dans les pages qui en ont besoin).
import { ITEM_CODE_RE } from './models.js';

export const LOAN_CODE_RE = /^LOAN-([^-\s]+)-([A-Z0-9]{6})$/;

export function isItemCode(text) {
  return ITEM_CODE_RE.test(String(text || '').trim());
}

export function parseLoanCode(text) {
  const m = LOAN_CODE_RE.exec(String(text || '').trim());
  return m ? { loanId: m[1], code6: m[2] } : null;
}

export function loanQrPayload(loan) {
  return `LOAN-${loan.id}-${loan.codeRetrait}`;
}

// Renvoie false (et affiche le texte brut) si la bibliothèque n’est pas chargée.
export function renderQr(container, text, size = 128) {
  container.innerHTML = '';
  const QR = typeof window !== 'undefined' ? window.QRCode : null;
  if (!QR) {
    container.textContent = text;
    return false;
  }
  new QR(container, { text, width: size, height: size, correctLevel: QR.CorrectLevel.M });
  container.setAttribute('aria-label', `QR code ${text}`);
  return true;
}
```

- [ ] **Step 5 : Écrire `js/admin/views/materielFiche.js`**

```js
// js/admin/views/materielFiche.js — fiche d’un exemplaire : infos éditables, état, QR, historiques.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isLate } from '../../rules.js';
import { navigate } from '../../router.js';
import { LABELS, ITEM_STATES } from '../../models.js';
import { ACTION_LABELS } from '../../log.js';
import { escapeHtml, badge, formatDate, formatDateTime, formatTime, relativeDay, fullName, openModal, toast } from '../../ui.js';
import { updateItem, setItemState, manualTransitions, itemHistory } from '../../actions/items.js';
import { renderQr } from '../../qr.js';
import { setTopbar } from '../layout.js';
import { itemFormHtml, readItemForm } from './materiel.js';

const nameOf = (users, id) => { const u = users.find((x) => x.id === id); return u ? fullName(u) : (id || '—'); };

function loansTable(loans, users, date) {
  if (!loans.length) return '<div class="empty-state">Aucun emprunt enregistré.</div>';
  const photo = (src, alt) => (src ? `<img class="thumb" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : '');
  const rows = loans.map((l) => `
    <tr data-href="/utilisateurs/${escapeHtml(l.userId)}">
      <td>${escapeHtml(nameOf(users, l.userId))}</td>
      <td>${escapeHtml(l.dateRetrait ? formatDateTime(l.dateRetrait) : formatDate(l.debutPrevu))}</td>
      <td>${escapeHtml(formatDate(l.finPrevue))}</td>
      <td>${l.dateRetourReelle ? escapeHtml(formatDate(l.dateRetourReelle)) : '—'}</td>
      <td>${badge('loan', isLate(l, date) ? 'en_retard' : l.statut)}</td>
      <td>${photo(l.photoEmprunt, 'Photo à l’emprunt')} ${photo(l.photoRetour, 'Photo au retour')}</td>
    </tr>`).join('');
  return `<table class="table"><thead><tr><th>Emprunteur</th><th>Retrait</th><th>Retour prévu</th><th>Retour réel</th><th>Statut</th><th>Photos</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function maintenanceList(events) {
  if (!events.length) return '<div class="empty-state">Aucune intervention.</div>';
  return `<div class="list">${events.map((m) => `
    <div class="list__item">
      <div class="list__grow">
        <strong>${escapeHtml(LABELS.maintType[m.type] || m.type)}</strong>${m.prestataire ? ` · ${escapeHtml(m.prestataire)}` : ''}${m.cout ? ` · ${escapeHtml(m.cout)} €` : ''}
        <span class="activity__detail">${escapeHtml(m.description)}</span>
        <span class="activity__detail">${escapeHtml(formatDate(m.date))}</span>
      </div>
      ${badge('maint', m.statut)}
    </div>`).join('')}</div>`;
}

function journal(entries, users, date) {
  if (!entries.length) return '<div class="empty-state">Aucune activité.</div>';
  return `<div class="activity">${entries.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong> <span class="text-secondary">· ${escapeHtml(nameOf(users, e.auteurId))}</span><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function ficheHtml({ item, history, users, transitions, references, date }) {
  const stateButtons = transitions.length
    ? `<div class="state-actions">${transitions.map((s) => `<button type="button" class="btn btn--secondary btn--sm" data-state="${s}">Passer en « ${escapeHtml(LABELS.itemState[s])} »</button>`).join('')}</div>`
    : '<p class="body-tiny text-secondary">L’état est piloté par l’emprunt ou la réservation en cours.</p>';
  return `
    <div class="page-header">
      <div>
        <a class="back-link" href="#/materiel">← Matériel</a>
        <h2 class="h5">${escapeHtml(item.nom)}</h2>
        <p class="page-header__meta">${escapeHtml(item.code)} · ${escapeHtml(item.categorie)} · ${badge('circuit', item.circuit)} ${badge('item', item.etat)}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Informations</h3></div>
          <form data-role="item-form">${itemFormHtml(item, references)}<div class="form-actions"><button type="submit" class="btn btn--primary">Enregistrer</button></div></form>
        </div>
        <div class="card"><div class="card__header"><h3 class="card__title">Historique des emprunts</h3><span class="body-sm text-secondary">${history.loans.length}</span></div>${loansTable(history.loans, users, date)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Maintenance</h3></div>${maintenanceList(history.maintenance)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Journal</h3></div>${journal(history.log, users, date)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card__header"><h3 class="card__title">État</h3>${badge('item', item.etat)}</div>${stateButtons}</div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">QR code</h3></div>
          <div class="qr-box">
            <div id="qr" data-code="${escapeHtml(item.code)}"></div>
            <strong class="label-lg">${escapeHtml(item.code)}</strong>
            <a class="btn btn--secondary btn--sm" href="etiquettes.html?codes=${encodeURIComponent(item.code)}" target="_blank" rel="noopener">Imprimer l’étiquette</a>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">Détails</h3></div>
          <div class="stat-row">
            <div class="stat"><div class="stat__label">Valeur</div><div class="stat__value">${escapeHtml(item.valeurEstimee)} €</div></div>
            <div class="stat"><div class="stat__label">Emprunts</div><div class="stat__value">${history.loans.length}</div></div>
          </div>
          <p class="body-tiny text-secondary form-actions">Ajouté le ${escapeHtml(formatDate(item.createdAt))} · modifié le ${escapeHtml(formatDate(item.updatedAt))}</p>
        </div>
      </div>
    </div>`;
}

export function materielFicheView(container, { id }) {
  const askStateChange = (item, etat) => openModal({
    title: `Passer « ${item.nom} » en ${LABELS.itemState[etat]}`,
    body: '<label class="field"><span class="field__label">Motif (optionnel)</span><textarea class="textarea" name="motif" placeholder="Ex. : câble sectionné, envoyé chez le prestataire…"></textarea></label>',
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: 'Confirmer', variant: etat === ITEM_STATES.HS ? 'danger' : 'primary',
        onClick: (modal) => {
          try {
            setItemState(item.id, etat, auth.currentUserId(), modal.querySelector('[name="motif"]').value.trim());
            toast(`État mis à jour : ${LABELS.itemState[etat]}`, 'success');
          } catch (err) {
            toast(err.message, 'error');
            return false;
          }
        },
      },
    ],
  });

  const render = () => {
    const item = store.items.get(id);
    if (!item) {
      setTopbar({ title: 'Matériel introuvable' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
      return;
    }
    const date = now();
    const users = store.users.list();
    const references = [...new Set(store.items.list().map((i) => i.reference))].sort();
    setTopbar({ title: item.nom, subtitle: `${item.code} · ${LABELS.itemState[item.etat]}` });
    container.innerHTML = ficheHtml({ item, history: itemHistory(id), users, transitions: manualTransitions(item), references, date });
    renderQr(container.querySelector('#qr'), item.code, 160);
    container.querySelector('[data-role="item-form"]').addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        updateItem(id, readItemForm(e.target), auth.currentUserId());
        toast('Modifications enregistrées', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    container.querySelectorAll('[data-state]').forEach((btn) => btn.addEventListener('click', () => askStateChange(item, btn.dataset.state)));
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('a, button, img')) return;
      navigate(el.dataset.href);
    }));
  };

  render();
  return store.subscribe(render);
}
```

- [ ] **Step 6 : Sélection multiple et impression dans `js/admin/views/materiel.js`**

Ajouter après `COLUMNS` :

```js
// Colonne de sélection (impression d’étiquettes) — hors COLUMNS pour ne pas être triable.
export const SELECT_COLUMN = {
  key: 'select', label: '',
  render: (i) => `<input type="checkbox" data-select="${escapeHtml(i.code)}" aria-label="Sélectionner ${escapeHtml(i.code)}">`,
};
```

Dans `materielHtml`, remplacer `<div class="toolbar" data-role="toolbar"></div>` par :

```js
      <div class="toolbar"><button type="button" class="btn btn--secondary btn--sm" data-action="print-selected" disabled>Imprimer les QR sélectionnés (0)</button></div>
```

et dans les deux appels `renderTable({ columns: COLUMNS, …` (dans `materielHtml` et dans `renderTableOnly`), utiliser `columns: [SELECT_COLUMN, ...COLUMNS]`.

Dans `materielView`, ajouter avant `renderTableOnly` :

```js
  const selected = new Set();
  const syncSelection = () => {
    container.querySelectorAll('[data-select]').forEach((cb) => {
      cb.checked = selected.has(cb.dataset.select);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(cb.dataset.select); else selected.delete(cb.dataset.select);
        syncPrintButton();
      });
    });
    syncPrintButton();
  };
  const syncPrintButton = () => {
    const btn = container.querySelector('[data-action="print-selected"]');
    btn.disabled = selected.size === 0;
    btn.textContent = `Imprimer les QR sélectionnés (${selected.size})`;
  };
```

Appeler `syncSelection()` à la fin de `renderTableOnly` et à la fin de `render` (après `bindTable`), et dans `render` brancher le bouton :

```js
    container.querySelector('[data-action="print-selected"]').addEventListener('click', () => {
      window.open(`etiquettes.html?codes=${encodeURIComponent([...selected].join(','))}`, '_blank', 'noopener');
    });
```

- [ ] **Step 7 : Écrire `etiquettes.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDS Emprunts — Étiquettes QR</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <style>
    .labels { max-width: 1100px; margin: 0 auto; padding: var(--space-2xl); }
    .labels__toolbar { display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-2xl); }
    .labels__toolbar h1 { flex: 1; }
    .labels__grid { display: grid; grid-template-columns: repeat(auto-fill, 62mm); gap: 6mm; }
    .label { width: 62mm; height: 48mm; border: 1px dashed var(--border-strong); border-radius: var(--radius-xs); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm; background: var(--bg-surface); page-break-inside: avoid; break-inside: avoid; }
    .label__code { font-size: 14px; line-height: 18px; font-weight: 700; }
    .label__name { font-size: 11px; line-height: 14px; color: var(--text-secondary); max-width: 56mm; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label__brand { font-size: 9px; line-height: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-brand); }
    @media print {
      body { background: var(--bg-surface); }
      .no-print { display: none; }
      .labels { padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <main class="labels">
    <header class="labels__toolbar no-print">
      <h1 class="h6">Étiquettes QR</h1>
      <a class="btn btn--ghost btn--sm" href="admin.html#/materiel">← Retour au matériel</a>
      <button type="button" class="btn btn--primary btn--sm" id="print">Imprimer</button>
    </header>
    <div id="grid" class="labels__grid"></div>
  </main>
  <script src="vendor/qrcode.min.js"></script>
  <script type="module">
    import { store } from './js/store.js';
    import { buildSeed } from './js/seed.js';
    import { renderQr } from './js/qr.js';
    import { escapeHtml } from './js/ui.js';

    store.init(buildSeed);
    const codes = (new URLSearchParams(window.location.search).get('codes') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const items = codes.map((code) => store.items.list((i) => i.code === code)[0]).filter(Boolean);
    const grid = document.getElementById('grid');
    grid.innerHTML = items.length
      ? items.map((i) => `<div class="label"><div class="label__qr" data-code="${escapeHtml(i.code)}"></div><strong class="label__code">${escapeHtml(i.code)}</strong><span class="label__name">${escapeHtml(i.nom)}</span><span class="label__brand">MDS Emprunts</span></div>`).join('')
      : '<p class="empty-state">Aucun code fourni (paramètre <code>?codes=MDS-0001,MDS-0002</code>).</p>';
    grid.querySelectorAll('[data-code]').forEach((el) => renderQr(el, el.dataset.code, 96));
    document.getElementById('print').addEventListener('click', () => window.print());
  </script>
</body>
</html>
```

- [ ] **Step 8 : Brancher la route dans `js/admin/app.js`**

Import `import { materielFicheView } from './views/materielFiche.js';` et route `{ path: '/materiel/:id', view: guard(materielFicheView) }`.

- [ ] **Step 9 : Lancer les tests**

Run: `node --test tests/qr.test.mjs tests/admin-fiche.test.mjs tests/admin-materiel.test.mjs`
Expected: `# pass 11`, `# fail 0` (3 + 3 + 5)

- [ ] **Step 10 : Vérifier dans le navigateur**

`#/materiel/item_029` (Canon R10) : en-tête avec badges, formulaire pré-rempli, QR rendu (image, pas seulement le texte), historique avec badge « En retard » pour le DJI sur sa fiche, maintenance « Optic Services », journal. Modifier la localisation → Enregistrer → toast + journal « Matériel modifié ». Sur un objet disponible : « Passer en Maintenance » → modale motif → badge Maintenance, journal, KPI disponibles -1 sur le dashboard. « Imprimer l'étiquette » ouvre `etiquettes.html?codes=MDS-0029` avec un QR. Liste : cocher 3 objets → bouton « (3) » → page d'étiquettes à 3 vignettes ; aperçu impression sans la barre d'outils. `#/materiel/nope` → « Matériel introuvable ».

- [ ] **Step 11 : Commit**

```bash
git add vendor/ admin.html js/qr.js js/admin/views/materielFiche.js js/admin/views/materiel.js js/admin/app.js etiquettes.html tests/qr.test.mjs tests/admin-fiche.test.mjs tests/admin-materiel.test.mjs
git commit -m "feat(admin): fiche matériel, QR codes, étiquettes imprimables et sélection multiple"
```

---

### Task 7 : Utilisateurs — liste, ajout, fiche, activation

**Files:**
- Create: `js/admin/views/utilisateurs.js`, `js/admin/views/utilisateurFiche.js`
- Modify: `js/ui.js` (variante `role` de `badge`), `js/admin/app.js` (routes `/utilisateurs`, `/utilisateurs/:id`)
- Test: `tests/admin-utilisateurs.test.mjs`, `tests/ui.test.mjs` (ajout d'une assertion)

**Interfaces:**
- Consumes : `createUser`, `updateUser`, `setUserActive`, `userStats`, `userHistory`, `ROLES`, `PROMOS`, `LABELS`, `formatSlots`, `renderTable`/`sortRows`/`toggleSort`/`bindTable`, `now`, `isLate`, helpers `ui`, `setTopbar`, `navigate`, `store`, `auth`.
- Produces : `badge('role', value)` ; `filterUsers(users, { q, role, promo, actifs })`, `withStats(users, date) → [{ ...user, stats }]`, `USER_COLUMNS`, `utilisateursHtml({ rows, total, filters, sort })`, `userFormHtml(user?)`, `readUserForm(root)`, `utilisateursView(container)` ; `userFicheHtml({ user, stats, history, items, date })`, `utilisateurFicheView(container, { id })`.

- [ ] **Step 1 : Écrire les tests**

Ajouter dans `tests/ui.test.mjs`, dans le test « badge : variante et libellé » :

```js
  assert.equal(badge('role', 'eleve'), '<span class="badge badge--reserved">Élève</span>');
  assert.equal(badge('role', 'pedago'), '<span class="badge badge--available">Pédagogie</span>');
```

`tests/admin-utilisateurs.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userStats, userHistory } from '../js/actions/users.js';
import { filterUsers, withStats, USER_COLUMNS, utilisateursHtml, userFormHtml } from '../js/admin/views/utilisateurs.js';
import { userFicheHtml } from '../js/admin/views/utilisateurFiche.js';
import { sortRows } from '../js/admin/table.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('filterUsers : recherche, rôle, promo, actifs', () => {
  const users = store.users.list();
  assert.equal(filterUsers(users, {}).length, 45);
  assert.equal(filterUsers(users, { q: 'pezz' }).length, 1);
  assert.equal(filterUsers(users, { q: 'mds-demo' }).length, 45);
  assert.equal(filterUsers(users, { role: 'intervenant' }).length, 10);
  assert.equal(filterUsers(users, { promo: 'MBA 2 UX/UI' }).length, 4);
  store.users.update('user_001', { actif: false });
  assert.equal(filterUsers(store.users.list(), { actifs: true }).length, 44);
  assert.equal(filterUsers(store.users.list(), { actifs: false }).length, 45);
});

test('withStats et USER_COLUMNS', () => {
  const rows = withStats(store.users.list(), NOW);
  const late = rows.find((r) => r.stats.retards > 0);
  assert.ok(late);
  assert.deepEqual(USER_COLUMNS.map((c) => c.key), ['nom', 'role', 'promo', 'email', 'enCours', 'retards', 'actif']);
  assert.match(USER_COLUMNS[0].render(late), /avatar/);
  assert.match(USER_COLUMNS[5].render(late), /badge--late">1</);
  assert.match(USER_COLUMNS[5].render({ stats: { retards: 0 } }), /^0$/);
  assert.match(USER_COLUMNS[6].render({ actif: false }), /Désactivé/);
  const sorted = sortRows(rows, { key: 'retards', dir: 'desc' }, USER_COLUMNS);
  assert.ok(sorted[0].stats.retards >= sorted[1].stats.retards);
});

test('utilisateursHtml : compteur, filtres, table', () => {
  const filters = { q: '', role: 'pedago', promo: '', actifs: true };
  const rows = sortRows(withStats(filterUsers(store.users.list(), filters), NOW), { key: 'nom', dir: 'asc' }, USER_COLUMNS);
  const html = utilisateursHtml({ rows, total: 45, filters, sort: { key: 'nom', dir: 'asc' } });
  assert.match(html, /5 résultats/);
  assert.match(html, /<option value="pedago" selected>Pédagogie/);
  assert.match(html, /Alexis Bengel/);
  assert.match(html, /name="actifs"[^>]*checked/);
});

test('userFormHtml : champs, promo pré-sélectionnée', () => {
  const html = userFormHtml({ prenom: 'Léa', nom: 'Pezzetti', email: 'lea@x.fr', role: 'eleve', promo: 'MBA 2 DEV' });
  for (const name of ['prenom', 'nom', 'email', 'role', 'promo']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /<option value="eleve" selected>/);
  assert.match(html, /<option value="MBA 2 DEV" selected>/);
  assert.match(userFormHtml(), /<option value="eleve" selected>/);
});

test('userFicheHtml : identité, statistiques, historique, bouton d’activation', () => {
  const booking = store.bookings.list()[0];
  const user = store.users.get(booking.userId);
  const html = userFicheHtml({ user, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW });
  assert.match(html, new RegExp(`${user.prenom} ${user.nom}`));
  assert.match(html, /stat__label">Retards/);
  assert.match(html, /Réservations de la salle photo/);
  assert.match(html, new RegExp(`${booking.creneaux[0]}h-${booking.creneaux.at(-1) + 1}h`));
  assert.match(html, /data-action="toggle-active">Désactiver le compte/);
  const inactive = userFicheHtml({ user: { ...user, actif: false }, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW });
  assert.match(inactive, /data-action="toggle-active">Réactiver le compte/);
  assert.match(inactive, /badge--hs">Désactivé/);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/admin-utilisateurs.test.mjs tests/ui.test.mjs`
Expected: FAIL — modules introuvables / assertion `badge('role', …)`

- [ ] **Step 3 : Variante `role` dans `js/ui.js`**

Dans `VARIANTS`, ajouter la ligne `role: { eleve: 'reserved', intervenant: 'borrowed', pedago: 'available' },` et dans `LABEL_FAMILY` ajouter `role: 'role'`.

- [ ] **Step 4 : Écrire `js/admin/views/utilisateurs.js`**

```js
// js/admin/views/utilisateurs.js — liste des utilisateurs, filtres, ajout.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now } from '../../rules.js';
import { ROLES, PROMOS, LABELS } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, openModal, toast } from '../../ui.js';
import { createUser, userStats } from '../../actions/users.js';
import { setTopbar } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';

export function filterUsers(users, { q = '', role = '', promo = '', actifs = false } = {}) {
  const needle = q.trim().toLowerCase();
  return users.filter((u) => (!role || u.role === role)
    && (!promo || u.promo === promo)
    && (!actifs || u.actif !== false)
    && (!needle || [u.prenom, u.nom, u.email].some((v) => String(v || '').toLowerCase().includes(needle))));
}

export function withStats(users, date) {
  return users.map((u) => ({ ...u, stats: userStats(u.id, date) }));
}

export const USER_COLUMNS = [
  { key: 'nom', label: 'Utilisateur', sortable: true, sortValue: (u) => `${u.nom} ${u.prenom}`, render: (u) => `<span class="row">${avatar(u)}<strong>${escapeHtml(fullName(u))}</strong></span>` },
  { key: 'role', label: 'Rôle', sortable: true, render: (u) => badge('role', u.role) },
  { key: 'promo', label: 'Promo', sortable: true, render: (u) => escapeHtml(u.promo || '—') },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'enCours', label: 'En cours', sortable: true, align: 'right', sortValue: (u) => u.stats.enCours, render: (u) => String(u.stats.enCours) },
  { key: 'retards', label: 'Retards', sortable: true, align: 'right', sortValue: (u) => u.stats.retards, render: (u) => (u.stats.retards ? `<span class="badge badge--late">${u.stats.retards}</span>` : '0') },
  { key: 'actif', label: 'Compte', sortable: true, sortValue: (u) => (u.actif === false ? 0 : 1), render: (u) => (u.actif === false ? badge('derived', 'desactive') : badge('derived', 'actif')) },
];

const options = (values, labelOf, selected, emptyLabel) => `<option value="">${escapeHtml(emptyLabel)}</option>${values.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(labelOf(v))}</option>`).join('')}`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function utilisateursHtml({ rows, total, filters, sort }) {
  return `
    <div class="page-header">
      <div><h2 class="h6">Utilisateurs</h2><p class="page-header__meta">${total} comptes</p></div>
      <p class="page-header__meta" data-role="count">${plural(rows.length, 'résultat', 'résultats')}</p>
    </div>
    <div class="card">
      <div class="filters">
        <input class="input input--search" type="search" name="q" placeholder="Nom, prénom, email…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
        <select class="select" name="role" aria-label="Rôle">${options(Object.values(ROLES), (v) => LABELS.role[v], filters.role, 'Tous les rôles')}</select>
        <select class="select" name="promo" aria-label="Promo">${options(PROMOS, (v) => v, filters.promo, 'Toutes les promos')}</select>
        <label class="toggle"><input type="checkbox" name="actifs"${filters.actifs ? ' checked' : ''}><span class="toggle__track"></span> Comptes actifs uniquement</label>
      </div>
      <div data-role="table">${renderTable({ columns: USER_COLUMNS, rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' })}</div>
    </div>`;
}

export function userFormHtml(user = {}) {
  const role = user.role || ROLES.ELEVE;
  const field = (label, input, full = false) => `<label class="field${full ? ' field--full' : ''}"><span class="field__label">${label}</span>${input}</label>`;
  return `
    <div class="form-grid">
      ${field('Prénom', `<input class="input" name="prenom" value="${escapeHtml(user.prenom || '')}" required>`)}
      ${field('Nom', `<input class="input" name="nom" value="${escapeHtml(user.nom || '')}" required>`)}
      ${field('Email', `<input class="input" name="email" type="email" value="${escapeHtml(user.email || '')}" placeholder="prenom.nom@mds-demo.fr" required>`, true)}
      ${field('Rôle', `<select class="select" name="role">${Object.values(ROLES).map((r) => `<option value="${r}"${r === role ? ' selected' : ''}>${escapeHtml(LABELS.role[r])}</option>`).join('')}</select>`)}
      ${field('Promo (élèves)', `<select class="select" name="promo"${role === ROLES.ELEVE ? '' : ' disabled'}><option value="">—</option>${PROMOS.map((p) => `<option value="${escapeHtml(p)}"${p === user.promo ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('')}</select>`)}
    </div>`;
}

export function readUserForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  return { prenom: value('prenom'), nom: value('nom'), email: value('email'), role: value('role'), promo: value('promo') || null };
}

// Active/désactive le sélecteur de promo selon le rôle choisi.
export function bindUserForm(root) {
  const roleEl = root.querySelector('[name="role"]');
  const promoEl = root.querySelector('[name="promo"]');
  roleEl.addEventListener('change', () => { promoEl.disabled = roleEl.value !== ROLES.ELEVE; if (promoEl.disabled) promoEl.value = ''; });
}

export function utilisateursView(container) {
  const filters = { q: '', role: '', promo: '', actifs: true };
  let sort = { key: 'nom', dir: 'asc' };

  const currentRows = () => sortRows(withStats(filterUsers(store.users.list(), filters), now()), sort, USER_COLUMNS);

  const renderTableOnly = () => {
    const rows = currentRows();
    container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: USER_COLUMNS, rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' });
    container.querySelector('[data-role="count"]').textContent = plural(rows.length, 'résultat', 'résultats');
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const render = () => {
    container.innerHTML = utilisateursHtml({ rows: currentRows(), total: store.users.list().length, filters, sort });
    container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
    for (const name of ['role', 'promo']) {
      container.querySelector(`[name="${name}"]`).addEventListener('change', (e) => { filters[name] = e.target.value; renderTableOnly(); });
    }
    container.querySelector('[name="actifs"]').addEventListener('change', (e) => { filters.actifs = e.target.checked; renderTableOnly(); });
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const openAddModal = () => {
    openModal({
      title: 'Ajouter un utilisateur',
      body: userFormHtml(),
      actions: [
        { label: 'Annuler', variant: 'ghost' },
        {
          label: 'Ajouter', variant: 'primary',
          onClick: (modal) => {
            try {
              const user = createUser(readUserForm(modal), auth.currentUserId());
              toast(`${fullName(user)} ajouté`, 'success');
              navigate(`/utilisateurs/${user.id}`);
            } catch (e) {
              toast(e.message, 'error');
              return false;
            }
          },
        },
      ],
    });
    bindUserForm(document.getElementById('modal-root'));
  };

  setTopbar({ title: 'Utilisateurs', subtitle: 'Élèves, intervenants et pédagogie', action: { label: '+ Ajouter un utilisateur', onClick: openAddModal } });
  render();
  return store.subscribe(render);
}
```

Ajouter dans `js/models.js`, dans `LABELS.derived` : `actif: 'Actif', desactive: 'Désactivé'`. Et dans `js/ui.js` `VARIANTS`, ajouter `derived: { en_retard: 'late', sortie_non_faite: 'late', actif: 'available', desactive: 'hs' }` (la famille `derived` lit ses libellés dans `LABELS.derived`, déjà consulté en premier par `badge`).

- [ ] **Step 5 : Écrire `js/admin/views/utilisateurFiche.js`**

```js
// js/admin/views/utilisateurFiche.js — fiche d’un utilisateur : identité, statistiques, historiques, activation.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isLate } from '../../rules.js';
import { navigate } from '../../router.js';
import { LABELS } from '../../models.js';
import { ACTION_LABELS } from '../../log.js';
import { escapeHtml, badge, avatar, formatDate, formatDateTime, formatTime, formatSlots, relativeDay, fullName, openModal, toast } from '../../ui.js';
import { updateUser, setUserActive, userStats, userHistory } from '../../actions/users.js';
import { setTopbar } from '../layout.js';
import { userFormHtml, readUserForm, bindUserForm } from './utilisateurs.js';

const itemName = (items, id) => { const i = items.find((x) => x.id === id); return i ? i.nom : id; };

function loansTable(loans, items, date) {
  if (!loans.length) return '<div class="empty-state">Aucun emprunt.</div>';
  return `<table class="table"><thead><tr><th>Matériel</th><th>Retrait</th><th>Retour prévu</th><th>Retour réel</th><th>Statut</th></tr></thead><tbody>${loans.map((l) => `
    <tr data-href="/materiel/${escapeHtml(l.itemId)}">
      <td><strong>${escapeHtml(itemName(items, l.itemId))}</strong></td>
      <td>${escapeHtml(l.dateRetrait ? formatDateTime(l.dateRetrait) : formatDate(l.debutPrevu))}</td>
      <td>${escapeHtml(formatDate(l.finPrevue))}</td>
      <td>${l.dateRetourReelle ? escapeHtml(formatDate(l.dateRetourReelle)) : '—'}</td>
      <td>${badge('loan', isLate(l, date) ? 'en_retard' : l.statut)}</td>
    </tr>`).join('')}</tbody></table>`;
}

function bookingsList(bookings) {
  if (!bookings.length) return '<div class="empty-state">Aucune réservation.</div>';
  return `<div class="list">${bookings.map((b) => `
    <div class="list__item">
      <div class="list__grow"><strong>${escapeHtml(formatDate(b.date))}</strong> · ${escapeHtml(formatSlots(b.creneaux))}<span class="activity__detail">${b.etatEntree ? 'État des lieux d’entrée fait' : 'Pas d’état des lieux d’entrée'}${b.etatSortie ? ' · sortie faite' : ''}</span></div>
      ${badge('booking', b.statut)}
    </div>`).join('')}</div>`;
}

function journal(entries, date) {
  if (!entries.length) return '<div class="empty-state">Aucune activité.</div>';
  return `<div class="activity">${entries.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function userFicheHtml({ user, stats, history, items, date }) {
  const active = user.actif !== false;
  return `
    <div class="page-header">
      <div>
        <a class="back-link" href="#/utilisateurs">← Utilisateurs</a>
        <h2 class="h5 row">${avatar(user, 'md')}${escapeHtml(fullName(user))}</h2>
        <p class="page-header__meta">${badge('role', user.role)} ${user.promo ? escapeHtml(user.promo) + ' · ' : ''}${escapeHtml(user.email)} ${active ? badge('derived', 'actif') : badge('derived', 'desactive')}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Informations</h3></div>
          <form data-role="user-form">${userFormHtml(user)}<div class="form-actions"><button type="submit" class="btn btn--primary">Enregistrer</button></div></form>
        </div>
        <div class="card"><div class="card__header"><h3 class="card__title">Emprunts</h3><span class="body-sm text-secondary">${history.loans.length}</span></div>${loansTable(history.loans, items, date)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Réservations de la salle photo</h3></div>${bookingsList(history.bookings)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Journal</h3></div>${journal(history.log, date)}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Statistiques</h3></div>
          <div class="stat-row">
            <div class="stat"><div class="stat__label">En cours</div><div class="stat__value">${stats.enCours}</div></div>
            <div class="stat"><div class="stat__label">Retards</div><div class="stat__value${stats.retards ? ' stat__value--alert' : ''}">${stats.retards}</div></div>
            <div class="stat"><div class="stat__label">Réservations</div><div class="stat__value">${stats.reservations}</div></div>
            <div class="stat"><div class="stat__label">Total</div><div class="stat__value">${stats.total}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">Compte</h3></div>
          <p class="body-sm text-secondary">${active ? 'Ce compte peut emprunter et réserver.' : 'Ce compte est désactivé : aucune connexion ni emprunt possible.'}</p>
          <div class="form-actions"><button type="button" class="btn ${active ? 'btn--danger' : 'btn--primary'} btn--sm" data-action="toggle-active">${active ? 'Désactiver le compte' : 'Réactiver le compte'}</button></div>
        </div>
      </div>
    </div>`;
}

export function utilisateurFicheView(container, { id }) {
  const render = () => {
    const user = store.users.get(id);
    if (!user) {
      setTopbar({ title: 'Utilisateur introuvable' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Utilisateur introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
      return;
    }
    const date = now();
    setTopbar({ title: fullName(user), subtitle: `${LABELS.role[user.role]}${user.promo ? ` · ${user.promo}` : ''}` });
    container.innerHTML = userFicheHtml({ user, stats: userStats(id, date), history: userHistory(id), items: store.items.list(), date });
    const form = container.querySelector('[data-role="user-form"]');
    bindUserForm(form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        updateUser(id, readUserForm(form), auth.currentUserId());
        toast('Modifications enregistrées', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    container.querySelector('[data-action="toggle-active"]').addEventListener('click', () => {
      const activate = user.actif === false;
      openModal({
        title: activate ? `Réactiver ${fullName(user)}` : `Désactiver ${fullName(user)}`,
        body: `<p class="body-sm">${activate ? 'Le compte pourra de nouveau emprunter et réserver.' : 'Le compte ne pourra plus se connecter ni emprunter. Les emprunts en cours restent visibles.'}</p>`,
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: activate ? 'Réactiver' : 'Désactiver', variant: activate ? 'primary' : 'danger', onClick: () => { setUserActive(id, activate, auth.currentUserId()); toast(activate ? 'Compte réactivé' : 'Compte désactivé', 'success'); } },
        ],
      });
    });
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      navigate(el.dataset.href);
    }));
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 6 : Brancher les routes dans `js/admin/app.js`**

Imports `import { utilisateursView } from './views/utilisateurs.js';` et `import { utilisateurFicheView } from './views/utilisateurFiche.js';` ; routes `{ path: '/utilisateurs', view: guard(utilisateursView) }` et `{ path: '/utilisateurs/:id', view: guard(utilisateurFicheView) }`. Supprimer l'import de `aVenirView` seulement s'il n'est plus utilisé (il l'est encore pour emprunts/salle/maintenance/parametres).

- [ ] **Step 7 : Lancer les tests**

Run: `node --test tests/admin-utilisateurs.test.mjs tests/ui.test.mjs`
Expected: `# pass 11`, `# fail 0` (5 + 6)

- [ ] **Step 8 : Vérifier dans le navigateur**

`#/utilisateurs` : 45 comptes, filtre « actifs » coché ; rôle = Intervenant → 10 ; tri sur Retards ↓ → les deux retardataires en tête avec badge rouge ; clic ligne → fiche : statistiques, emprunts (dont « En retard »), réservations salle « 9h-12h » pour le testeur du booking, journal. Modifier l'email → Enregistrer → toast. « Désactiver le compte » → modale → badge « Désactivé », bouton devient « Réactiver » ; retour à la liste : l'utilisateur disparaît quand « actifs uniquement » est coché. « + Ajouter un utilisateur » : rôle Intervenant désactive la promo ; email en double → toast d'erreur ; valide → fiche du nouveau compte.

- [ ] **Step 9 : Commit**

```bash
git add js/ui.js js/models.js js/admin/views/utilisateurs.js js/admin/views/utilisateurFiche.js js/admin/app.js tests/admin-utilisateurs.test.mjs tests/ui.test.mjs
git commit -m "feat(admin): utilisateurs — liste filtrable, ajout, fiche, activation"
```

---

### Task 8 : Vérification de fin de phase

**Files:**
- Modify: `README.md` (état d'avancement), `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md` (ligne Phase 1 → « rédigé et exécuté »)

- [ ] **Step 1 : Suite complète et grep anti-régression**

Run: `npm test`
Expected: `# fail 0`, 78 + 7 + 10 + 7 + 7 + 8 + 7 + 5 = **129 tests**.

Run: `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html`
Expected : aucune sortie.

Run: `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/components.css css/admin.css`
Expected : uniquement la ligne du `data:image/svg+xml` dans `components.css`.

- [ ] **Step 2 : Scénario de vérification de phase (navigateur, fait par le contrôleur)**

1. `admin.html` → login Alexis Bengel → dashboard : KPI 30 / 10 / 2 / 3, retards DJI (3 jours) et casque (1 jour), signalement souris, 15 activités.
2. Matériel → « + Ajouter » : « Multiprise #7 », référence `multiprise`, Bureautique, Self-service, 15 € → fiche `MDS-0045` avec QR.
3. Fiche → « Imprimer l'étiquette » → `etiquettes.html?codes=MDS-0045` (QR + code + nom).
4. Fiche → « Passer en Hors service » motif « test » → badge Hors service, journal « Changement d’état ».
5. Dashboard : KPI disponibles inchangé à 30 (l'objet ajouté puis mis HS ne compte pas), sidebar Emprunts « 10 », Maintenance « 1 ».
6. Utilisateurs → ajouter « Nina Costa », Bachelor 2 → fiche → Désactiver → liste (actifs) ne la montre plus.
7. Recherche globale « ronin » depuis le dashboard → Matériel filtré sur le DJI.
8. Deux onglets : modifier un nom d'objet dans l'un → l'autre (sur la liste) se met à jour sans rechargement.

- [ ] **Step 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 1 — Admin : inventaire & utilisateurs` et remplacer la phrase « `admin.html` … arrivent en phases 1 et 2 » par « `admin.html` (pédagogie, desktop) est disponible ; `mobile.html` (emprunteurs, téléphone) arrive en phase 2 ». Roadmap : ligne Phase 1 → `2026-09-18-phase-1-admin-inventaire.md` (exécuté).

- [ ] **Step 4 : Commit et étiquette**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 1 terminée"
git tag phase-1
```

- [ ] **Step 5 : Rédiger le plan de la phase 2**

Invoquer `superpowers:writing-plans` avec la feuille de route (section Phase 2), le spec (§5.1, §7) et le code réel des phases 0-1 pour produire `docs/superpowers/plans/2026-09-18-phase-2-mobile-self-service.md`.

---

## Auto-revue du plan

**Couverture du spec §6 (admin)** — `#/dashboard` : 4 KPI, Retards, À remettre aujourd'hui (liste, bouton Remettre en phase 3), Signalements ouverts, Dernières activités → Task 4 ✔. `#/materiel` : table triable/filtrable, Ajouter (modale : nom, catégorie, référence, circuit, code auto, valeur, localisation), sélection multiple → Imprimer les QR → Tasks 5-6 ✔. `#/materiel/:id` : infos éditables, changement d'état (disponible/maintenance/HS), QR imprimable, historique emprunts (avec photos) et interventions → Task 6 ✔. `#/utilisateurs` + `#/utilisateurs/:id` : table (nom, rôle, promo, emprunts en cours, retards), ajouter/modifier/désactiver, historique complet → Task 7 ✔. Recherche globale topbar → Task 1 (`setTopbar`) + Task 5 (`takeSearch`) ✔. Modales et toasts du kit → `ui.js` ✔. `#/emprunts`, `#/salle`, `#/maintenance`, `#/parametres` → vues « à venir » (phases 3-5), sidebar complète ✔. Login pédago (spec §2 : comptes de démo en un clic) → Task 1 ✔.

**Différés de la phase 0 traités** : couleurs en dur → Task 1 Step 1 ✔ ; error boundary du routeur → Task 1 Step 2 ✔ ; `.toast-stack` → jamais référencé, `#toast-root` partout ✔. Non traités (toujours différés) : `ACTIONS` manquantes (phase 5), query strings du routeur (pas nécessaire : la recherche passe par `sessionStorage`).

**Placeholders** : aucun ; chaque étape porte son code.

**Cohérence des noms** : `setTopbar({ title, subtitle, action: { label, onClick } })` (T1) utilisé par T4-T7 ✔ ; `takeSearch()` (T1) par T5 ✔ ; `createItem/updateItem/setItemState/manualTransitions/itemHistory` (T2) par T5-T6 ✔ ; `createUser/updateUser/setUserActive/userStats/userHistory` (T3) par T7 ✔ ; `renderTable/sortRows/toggleSort/bindTable` (T5) par T5-T7 ✔ ; `itemFormHtml/readItemForm` (T5) par T6 ✔ ; `userFormHtml/readUserForm/bindUserForm` (T7 liste) par T7 fiche ✔ ; `badge('derived', 'actif'|'desactive')` exige `LABELS.derived.actif/desactive` et `VARIANTS.derived` (T7 Step 4, fin) ✔ ; `renderQr` (T6) par fiche et étiquettes ✔ ; `guard(view)` et le tableau `routes` (T1) modifiés par T4-T7 aux emplacements commentés ✔.
