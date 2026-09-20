# MDS Emprunts — Phase 2 : Mobile, self-service — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer l'interface mobile des emprunteurs (élèves, intervenants) avec le circuit **self-service** complet : connexion démo, catalogue, scan du QR de l'objet → photo → emprunt immédiat, re-scan → photo → mini-checklist → retour (signalement automatique si problème), écran « mes emprunts » — le tout visible en direct côté admin.

**Architecture :** `mobile.html` est une coquille unique (header + `<main>` + barre de navigation basse avec bouton Scanner central) ; `js/mobile/app.js` initialise le store (même clé `mds-emprunts:v1` → synchronisation entre onglets avec l'admin), protège les routes (utilisateur actif) et monte le routeur `#hash`. Même convention que l'admin : vue = builder HTML pur (`xxxHtml`, testé) + montage DOM (`xxxView`) renvoyant sa fonction de nettoyage. Les mutations d'emprunt vivent dans `js/actions/loans.js` (résolution d'un scan, emprunt, retour) ; la logique d'enchaînement des écrans de scan est un réducteur pur `js/mobile/scanFlow.js` ; la caméra (scan QR via `html5-qrcode`, photo via `getUserMedia` + canvas) est isolée dans `js/scanner.js` avec un mode simulé sans caméra.

**Tech Stack :** HTML5, CSS3 (tokens Figma, mobile-first), JavaScript ES2022 modules natifs, `localStorage`/`sessionStorage`, `html5-qrcode` 2.3.8 (copie locale `vendor/html5-qrcode.min.js`, Apache-2.0), Node ≥ 22 (`node --test`), `python3 -m http.server`.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §3.1 (self-service), §3.4 (un exemplaire par référence), §5.1 (règles self), §5.5 (temps), §7 (interface mobile), §8 (checklists self), §9 (architecture, photos).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md` (Phase 2). **Journaux** : `docs/superpowers/ledgers/2026-09-17-phase-0-ledger.md`, `docs/superpowers/ledgers/2026-09-18-phase-1-ledger.md` (rulings : `applyItemState` sans journal pour les actions d'emprunt ; historiques triés par date métier ; une saisie en cours n'est jamais écrasée par un re-rendu).

## Global Constraints

- Aucun build, aucune dépendance npm installée ; bibliothèques tierces en copie locale dans `vendor/` (jamais de CDN à l'exécution), listées dans `vendor/README.md`.
- Interface 100 % en français ; libellés d'états via `LABELS`/`badge` ; motifs de refus via `REASON_LABELS` (`js/rules.js`).
- Chaînes : délimiteurs simples, apostrophe typographique `’` (U+2019) dans le texte français (code, commentaires, HTML) — jamais `'` ni `\'` dans un mot français. Vérification : `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` doit ne rien renvoyer.
- Aucune couleur en dur hors `css/tokens.css` (le canvas de la photo de démonstration lit ses couleurs via `getComputedStyle(document.documentElement).getPropertyValue('--…')`).
- Toute mutation métier passe par `js/actions/*` et écrit une `LogEntry` via `logAction` ; les changements d'état d'objet faits par les emprunts passent par `applyItemState` (sans journal) et l'action d'emprunt écrit **une** entrée par mutation métier. Les enregistrements du store sont gelés : toujours `store.x.update(id, patch)`.
- Règles temporelles via `rules.now()` (horloge de démo) ; `relativeDay(d, ref)` exige `ref`. Self-service : retrait uniquement aux heures d'ouverture (`isOfficeOpen`), **retour toujours possible** ; un exemplaire maximum par référence et par personne ; `finPrevue` = jour même à `heureRetourSelf` (17h).
- Photos : capture caméra → JPEG ≤ 640 px (grand côté), qualité 0,72, base64 dans `Loan.photoEmprunt` / `Loan.photoRetour`. Sans caméra : image de démonstration générée (canvas), jamais d'emprunt sans photo.
- Session : utilisateur courant en `sessionStorage` `mds-emprunts:currentUser` (par onglet — un onglet admin et un onglet mobile côte à côte gardent des comptes différents). Persistance partagée : clé `mds-emprunts:v1`.
- Codes : objets `MDS-0042` (`isItemCode`), retraits `LOAN-<loanId>-<code6>` (phase 3).
- Vues : `xxxHtml(data)` pur + `xxxView(container, params)` DOM qui renvoie sa fonction de nettoyage (désabonnement store **et** arrêt caméra/scanner). Toute donnée dynamique échappée via `escapeHtml` (sauf fragments déjà échappés : `badge`, `avatar`).
- Viewport cible 360-430 px ; sur desktop, colonne centrée de 480 px max (démo à deux fenêtres).
- Commits fréquents, messages en français, préfixes `feat:`, `fix:`, `test:`, `chore:`, `docs:`.

---

## Structure de fichiers de la phase

| Fichier | Responsabilité |
|---|---|
| `mobile.html` | Coquille : header, `<main id="view">`, `<nav id="nav">`, racines modale/toast, scripts (vendor + module) |
| `css/mobile.css` | Layout mobile-first : header, bottom nav + bouton scan, cartes, chips, scanner, checklist, login |
| `js/mobile/layout.js` | `TABS`, `isActive`, `bottomNavHtml`, `headerHtml` (purs) ; `mountNav`, `setHeader` (DOM) |
| `js/mobile/app.js` | Init store, garde « utilisateur actif », routes, montage nav, démarrage routeur |
| `js/mobile/views/login.js` | Comptes de démo groupés par rôle, filtre texte |
| `js/mobile/views/profil.js` | Identité, promo, « Changer d'utilisateur », déconnexion |
| `js/mobile/views/aVenir.js` | Écran « disponible en phase N » (salle, réservation valeur) |
| `js/rules.js` (modif) | + `REASONS.CODE_INCONNU` / libellé |
| `js/actions/loans.js` | `findOpenLoanForItem`, `resolveScan`, `borrowSelf`, `returnSelf`, `userLoans` |
| `js/scanner.js` | `fitWithin`, `normalizeScanText`, `resizeToJpeg`, `capturePhoto`, `placeholderPhoto`, `hasCamera`, `startCamera`/`stopCamera`, `startScanner`/`stopScanner` |
| `js/mobile/scanFlow.js` | Réducteur pur des étapes scan → photo → confirmation / checklist → terminé / erreur |
| `vendor/html5-qrcode.min.js`, `vendor/README.md` (modif) | html5-qrcode 2.3.8 (Apache-2.0) |
| `js/mobile/catalog.js` | `baseName`, `groupByReference`, `filterCatalog`, `availability` (purs) |
| `js/mobile/views/accueil.js` | Salutation, emprunts en cours, prochaine réservation salle, notifications, CTA scanner |
| `js/mobile/views/catalogue.js` | Recherche + chips catégorie, cartes par référence |
| `js/mobile/views/fiche.js` | Fiche d'une référence : exemplaires, CTA selon circuit |
| `js/mobile/views/scan.js` | Écran scan (caméra / simulation / saisie), photo, confirmation, checklist, résultat |
| `js/mobile/views/emprunts.js` | Onglets En cours / Réservations / Historique, photos |
| `tests/mobile-layout.test.mjs`, `tests/actions-loans-self.test.mjs`, `tests/scanner.test.mjs`, `tests/scan-flow.test.mjs`, `tests/mobile-catalog.test.mjs`, `tests/mobile-views.test.mjs`, `tests/mobile-scan-view.test.mjs`, `tests/mobile-emprunts.test.mjs` | Tests Node |

Rappel des signatures existantes utilisées : `store.<coll>.list/get/create/update`, `store.settings.get()`, `store.subscribe(fn) → off` ; `now()`, `isLate(loan, date)`, `isOfficeOpen(date, horaires)`, `selfReturnDeadline(date, heure)`, `canBorrowSelf({ item, user, loans, items, settings, date }) → { ok, reason }`, `REASONS`, `REASON_LABELS`, `withDefaults`, `sortByDateDesc(rows, pick)` (`js/rules.js`) ; `applyItemState(id, etat)` (`js/actions/items.js`) ; `buildChecklist(reference)`, `hasProblem(checklist)`, `problemLines(checklist)` (`js/checklists.js`) ; `isItemCode(text)` (`js/qr.js`) ; `logAction`, `ACTIONS` (`js/log.js`) ; `auth.currentUser()/currentUserId()/login/logout` ; `escapeHtml`, `badge`, `avatar`, `formatDate`, `formatTime`, `formatDateTime`, `relativeDay(d, ref)`, `formatSlots`, `fullName`, `initials`, `openModal`, `toast` (`js/ui.js`) ; `createRouter`, `navigate`, `currentPath` (`js/router.js`) ; `LABELS`, `CIRCUITS`, `ITEM_STATES`, `LOAN_STATES`, `BOOKING_STATES`, `MAINT_TYPES`, `MAINT_STATES`, `ROLES`, `CATEGORIES` (`js/models.js`).

---

### Task 1 : Coquille mobile — layout, login, profil, routes « à venir »

**Files:**
- Create: `mobile.html`, `css/mobile.css`, `js/mobile/layout.js`, `js/mobile/app.js`, `js/mobile/views/login.js`, `js/mobile/views/profil.js`, `js/mobile/views/aVenir.js`
- Test: `tests/mobile-layout.test.mjs`

**Interfaces:**
- Consumes : `store`, `buildSeed`, `auth`, `createRouter`/`navigate`/`currentPath`, `escapeHtml`/`avatar`/`fullName`/`toast`, `LABELS.role`, `ROLES`.
- Produces : `TABS`, `isActive(tabPath, path)`, `bottomNavHtml(currentPath)`, `headerHtml({ title, user, back })`, `mountNav(el, currentPath)`, `setHeader({ title, back? })` (lit `auth.currentUser()`), `ICONS` ; `groupUsersByRole(users)`, `loginHtml(groups, q)`, `loginView` ; `profilHtml(user)`, `profilView` ; `aVenirHtml(title, phase)`, `aVenirView(title, phase)` ; dans `app.js`, le tableau `routes` avec des lignes placeholder que les tâches 4-6 remplacent.

- [ ] **Step 1 : Écrire le test**

`tests/mobile-layout.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { TABS, isActive, bottomNavHtml, headerHtml } from '../js/mobile/layout.js';
import { groupUsersByRole, loginHtml } from '../js/mobile/views/login.js';
import { profilHtml } from '../js/mobile/views/profil.js';
import { aVenirHtml } from '../js/mobile/views/aVenir.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('TABS : 4 onglets, le scanner est un bouton à part', () => {
  assert.deepEqual(TABS.map((t) => t.path), ['/accueil', '/catalogue', '/salle', '/emprunts']);
});

test('isActive : exact ou sous-route', () => {
  assert.equal(isActive('/catalogue', '/catalogue/multiprise'), true);
  assert.equal(isActive('/catalogue', '/catalogues'), false);
});

test('bottomNavHtml : onglet actif, bouton scan central, libellés', () => {
  const html = bottomNavHtml('/catalogue/multiprise');
  assert.match(html, /m-nav__tab m-nav__tab--active" href="#\/catalogue"/);
  assert.doesNotMatch(html, /m-nav__tab--active" href="#\/accueil"/);
  assert.match(html, /class="m-nav__scan" href="#\/scan" aria-label="Scanner un QR code"/);
  for (const label of ['Accueil', 'Catalogue', 'Salle', 'Emprunts']) assert.match(html, new RegExp(`>${label}<`));
  assert.equal((html.match(/<svg/g) || []).length, 5);
});

test('headerHtml : titre, lien retour optionnel, avatar vers le profil', () => {
  const user = { prenom: 'Léa', nom: 'Pezzetti <b>' };
  const html = headerHtml({ title: 'Catalogue', user });
  assert.match(html, /<h1 class="m-header__title">Catalogue<\/h1>/);
  assert.match(html, /href="#\/profil"/);
  assert.match(html, /LP/);
  assert.doesNotMatch(html, /m-header__back/);
  const withBack = headerHtml({ title: 'Multiprise', user, back: '/catalogue' });
  assert.match(withBack, /class="m-header__back" href="#\/catalogue" aria-label="Retour"/);
  const noUser = headerHtml({ title: 'Connexion', user: null });
  assert.doesNotMatch(noUser, /href="#\/profil"/);
});

test('groupUsersByRole et loginHtml : groupes, filtre, comptes inactifs exclus', () => {
  store.users.update('user_001', { actif: false });
  const groups = groupUsersByRole(store.users.list());
  assert.deepEqual(groups.map((g) => g.role), ['eleve', 'intervenant', 'pedago']);
  assert.equal(groups[0].users.length, 29);
  assert.equal(groups[1].users.length, 10);
  const html = loginHtml(groups, '');
  assert.match(html, /Élèves \(29\)/);
  assert.match(html, /Intervenants \(10\)/);
  assert.equal((html.match(/data-user="/g) || []).length, 44);
  const filtered = loginHtml(groupUsersByRole(store.users.list(), 'guih'), 'guih');
  assert.equal((filtered.match(/data-user="/g) || []).length, 1);
  assert.match(filtered, /Yann Guihard/);
  assert.match(filtered, /value="guih"/);
});

test('profilHtml : identité, promo, actions', () => {
  const html = profilHtml(store.users.get('user_001'));
  assert.match(html, /Léa Pezzetti/);
  assert.match(html, /MBA 2 UX\/UI/);
  assert.match(html, /badge--reserved">Élève/);
  assert.match(html, /data-action="switch-user"/);
  assert.match(html, /data-action="logout"/);
  const inter = profilHtml(store.users.get('user_031'));
  assert.doesNotMatch(inter, /Promo/);
});

test('aVenirHtml mentionne la phase', () => {
  assert.match(aVenirHtml('Salle photo', 4), /phase 4/);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-layout.test.mjs`
Expected: FAIL — `Cannot find module '../js/mobile/layout.js'`

- [ ] **Step 3 : Écrire `js/mobile/layout.js`**

```js
// js/mobile/layout.js — coquille mobile : header et barre de navigation basse.
// Builders HTML purs (testés) + montage DOM.
import { escapeHtml, avatar } from '../ui.js';
import { auth } from '../auth.js';

// Icônes SVG inline (trait 2px, 24×24), colorées par currentColor.
export const ICONS = {
  accueil: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  catalogue: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  salle: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  emprunts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
};

export const TABS = [
  { path: '/accueil', label: 'Accueil', icon: 'accueil' },
  { path: '/catalogue', label: 'Catalogue', icon: 'catalogue' },
  { path: '/salle', label: 'Salle', icon: 'salle' },
  { path: '/emprunts', label: 'Emprunts', icon: 'emprunts' },
];

export function isActive(tabPath, path) {
  return path === tabPath || path.startsWith(`${tabPath}/`);
}

export function bottomNavHtml(currentPath) {
  const tab = (t) => `<a class="m-nav__tab${isActive(t.path, currentPath) ? ' m-nav__tab--active' : ''}" href="#${t.path}">${ICONS[t.icon]}<span>${escapeHtml(t.label)}</span></a>`;
  return `
    ${tab(TABS[0])}${tab(TABS[1])}
    <a class="m-nav__scan" href="#/scan" aria-label="Scanner un QR code">${ICONS.scan}</a>
    ${tab(TABS[2])}${tab(TABS[3])}`;
}

export function headerHtml({ title, user, back = null }) {
  const backHtml = back ? `<a class="m-header__back" href="#${back}" aria-label="Retour">${ICONS.back}</a>` : '';
  const userHtml = user ? `<a class="m-header__avatar" href="#/profil" aria-label="Mon profil">${avatar(user)}</a>` : '';
  return `${backHtml}<h1 class="m-header__title">${escapeHtml(title)}</h1>${userHtml}`;
}

// ---- DOM ----

export function mountNav(el, currentPath) {
  el.innerHTML = bottomNavHtml(currentPath);
}

export function setHeader({ title, back = null }) {
  const el = document.getElementById('header');
  el.innerHTML = headerHtml({ title, user: auth.currentUser(), back });
}
```

- [ ] **Step 4 : Écrire les vues login, profil, aVenir**

`js/mobile/views/login.js` :

```js
// js/mobile/views/login.js — choix du compte de démo (élèves, intervenants, pédagogie), sans mot de passe.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { ROLES, LABELS } from '../../models.js';
import { escapeHtml, avatar, fullName, toast } from '../../ui.js';

const ROLE_PLURAL = { eleve: 'Élèves', intervenant: 'Intervenants', pedago: 'Pédagogie' };
const ORDER = [ROLES.ELEVE, ROLES.INTERVENANT, ROLES.PEDAGO];

export function groupUsersByRole(users, q = '') {
  const needle = q.trim().toLowerCase();
  const keep = (u) => u.actif !== false && (!needle || [u.prenom, u.nom, u.promo].some((v) => String(v || '').toLowerCase().includes(needle)));
  return ORDER.map((role) => ({
    role,
    label: ROLE_PLURAL[role] || LABELS.role[role],
    users: users.filter((u) => u.role === role && keep(u)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  })).filter((g) => g.users.length > 0);
}

export function loginHtml(groups, q = '') {
  const groupHtml = (g) => `
    <section class="m-section">
      <h2 class="label-caps text-secondary">${escapeHtml(g.label)} (${g.users.length})</h2>
      <div class="m-list">${g.users.map((u) => `
        <button type="button" class="m-item m-item--button" data-user="${escapeHtml(u.id)}">
          ${avatar(u)}
          <span class="m-item__body"><strong>${escapeHtml(fullName(u))}</strong>${u.promo ? `<span class="body-tiny text-secondary">${escapeHtml(u.promo)}</span>` : ''}</span>
        </button>`).join('')}</div>
    </section>`;
  return `
    <div class="m-login">
      <p class="label-caps text-secondary">MDS Emprunts</p>
      <h1 class="h5">Qui êtes-vous ?</h1>
      <p class="body-sm text-secondary">Comptes de démonstration — aucun mot de passe.</p>
      <input class="input input--search" type="search" name="q" placeholder="Nom, prénom, promo…" value="${escapeHtml(q)}" aria-label="Rechercher un compte">
      ${groups.length ? groups.map(groupHtml).join('') : '<div class="empty-state">Aucun compte ne correspond.</div>'}
      <p class="body-tiny text-secondary"><a href="index.html">← Retour à l’accueil</a></p>
    </div>`;
}

export function loginView(container) {
  let q = '';
  const render = () => {
    container.innerHTML = loginHtml(groupUsersByRole(store.users.list(), q), q);
    const input = container.querySelector('[name="q"]');
    input.addEventListener('input', (e) => { q = e.target.value; render(); input.focus(); });
    container.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => {
      try {
        auth.login(b.dataset.user);
        navigate('/accueil');
      } catch (e) {
        toast(e.message, 'error');
      }
    }));
  };
  render();
}
```

Note : `render()` puis `input.focus()` — la valeur est réinjectée via `value="${q}"`, le curseur revient en fin de champ (le champ est recréé). Acceptable pour un filtre de démo.

`js/mobile/views/profil.js` :

```js
// js/mobile/views/profil.js — profil de l’emprunteur, changement d’utilisateur (démo), déconnexion.
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { escapeHtml, avatar, fullName, badge } from '../../ui.js';
import { setHeader } from '../layout.js';

export function profilHtml(user) {
  return `
    <div class="card m-profile">
      <div class="m-profile__head">${avatar(user, 'md')}<div><strong class="label-lg">${escapeHtml(fullName(user))}</strong><div>${badge('role', user.role)}</div></div></div>
      <dl class="m-dl">
        <dt>Email</dt><dd>${escapeHtml(user.email)}</dd>
        ${user.promo ? `<dt>Promo</dt><dd>${escapeHtml(user.promo)}</dd>` : ''}
      </dl>
    </div>
    <div class="card">
      <p class="body-sm text-secondary">Mode démonstration : vous pouvez changer de compte pour tester un autre rôle.</p>
      <div class="m-actions">
        <button type="button" class="btn btn--secondary btn--block" data-action="switch-user">Changer d’utilisateur</button>
        <button type="button" class="btn btn--ghost btn--block" data-action="logout">Se déconnecter</button>
      </div>
    </div>`;
}

export function profilView(container) {
  const user = auth.currentUser();
  setHeader({ title: 'Mon profil', back: '/accueil' });
  container.innerHTML = profilHtml(user);
  const leave = () => { auth.logout(); navigate('/login'); };
  container.querySelector('[data-action="switch-user"]').addEventListener('click', leave);
  container.querySelector('[data-action="logout"]').addEventListener('click', leave);
}
```

`js/mobile/views/aVenir.js` :

```js
// js/mobile/views/aVenir.js — écran de remplacement pour les fonctions des phases suivantes.
import { escapeHtml } from '../../ui.js';
import { setHeader } from '../layout.js';

export function aVenirHtml(title, phase) {
  return `<div class="card"><h2 class="h6">${escapeHtml(title)}</h2><p class="body-sm text-secondary">Cet écran arrive en phase ${phase} du prototype.</p></div>`;
}

export function aVenirView(title, phase, back = '/accueil') {
  return (container) => {
    setHeader({ title, back });
    container.innerHTML = aVenirHtml(title, phase);
  };
}
```

- [ ] **Step 5 : Lancer le test**

Run: `node --test tests/mobile-layout.test.mjs`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 6 : Écrire `js/mobile/app.js`**

```js
// js/mobile/app.js — point d’entrée de l’interface mobile (emprunteurs).
import { store } from '../store.js';
import { buildSeed } from '../seed.js';
import { auth } from '../auth.js';
import { createRouter, navigate, currentPath } from '../router.js';
import { escapeHtml } from '../ui.js';
import { mountNav } from './layout.js';
import { loginView } from './views/login.js';
import { profilView } from './views/profil.js';
import { aVenirView } from './views/aVenir.js';
// Les tâches suivantes ajoutent leurs imports ici :
// import { accueilView } from './views/accueil.js';      (Task 4)
// import { catalogueView } from './views/catalogue.js';  (Task 4)
// import { ficheView } from './views/fiche.js';          (Task 4)
// import { scanView } from './views/scan.js';            (Task 5)
// import { empruntsView } from './views/emprunts.js';    (Task 6)

store.init(buildSeed);

const navEl = document.getElementById('nav');
const viewEl = document.getElementById('view');

// Toute route sauf /login exige un compte actif (élève, intervenant ou pédago).
const guard = (view) => (container, params) => {
  const user = auth.currentUser();
  if (!user || user.actif === false) { auth.logout(); navigate('/login'); return undefined; }
  document.body.classList.remove('is-login');
  mountNav(navEl, currentPath());
  return view(container, params);
};

const routes = [
  { path: '/login', view: (c) => { document.body.classList.add('is-login'); return loginView(c); } },
  { path: '/accueil', view: guard(aVenirView('Accueil', 2)) },                    // remplacé en Task 4
  { path: '/catalogue', view: guard(aVenirView('Catalogue', 2)) },                // remplacé en Task 4
  { path: '/catalogue/:reference', view: guard(aVenirView('Fiche', 2)) },         // remplacé en Task 4
  { path: '/scan', view: guard(aVenirView('Scanner', 2)) },                       // remplacé en Task 5
  { path: '/emprunts', view: guard(aVenirView('Mes emprunts', 2)) },              // remplacé en Task 6
  { path: '/salle', view: guard(aVenirView('Salle photo', 4)) },
  { path: '/reserver/:id', view: guard(aVenirView('Réserver', 3, '/catalogue')) },
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
```

- [ ] **Step 7 : Écrire `mobile.html` et `css/mobile.css`**

`mobile.html` :

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#662483">
  <title>MDS Emprunts</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/mobile.css">
</head>
<body>
  <div class="m-shell">
    <header id="header" class="m-header"></header>
    <main id="view" class="m-main"></main>
    <nav id="nav" class="m-nav" aria-label="Navigation"></nav>
  </div>
  <div id="modal-root"></div>
  <div id="toast-root"></div>
  <script type="module" src="js/mobile/app.js"></script>
</body>
</html>
```

(La couleur `#662483` de `theme-color` est une méta navigateur, pas une couleur de style : acceptée, elle reprend `--brand-primary`.)

`css/mobile.css` :

```css
/* Interface mobile — mobile-first, colonne centrée sur desktop. Couleurs via tokens uniquement. */
.m-shell { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg-canvas); }
.is-login .m-header, .is-login .m-nav { display: none; }

/* Header */
.m-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: var(--space-sm); height: 56px; padding: 0 var(--space-lg); background: var(--brand-primary); color: var(--text-on-brand); }
.m-header__title { flex: 1; min-width: 0; font-family: var(--font-heading); font-weight: 800; font-size: 20px; line-height: 24px; letter-spacing: -.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-header__back { display: grid; place-items: center; width: 36px; height: 36px; margin-left: calc(-1 * var(--space-sm)); border-radius: 50%; color: var(--text-on-brand); }
.m-header__back:hover { background: var(--alpha-white-10); }
.m-header__avatar .avatar { background: var(--bg-surface); color: var(--text-brand); }

/* Contenu */
.m-main { flex: 1; padding: var(--space-lg) var(--space-lg) 96px; display: flex; flex-direction: column; gap: var(--space-lg); }
.is-login .m-main { padding-bottom: var(--space-lg); }
.m-section { display: flex; flex-direction: column; gap: var(--space-sm); }
.m-section > h2 { margin-top: var(--space-sm); }
.m-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.m-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); background: var(--bg-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-card); text-align: left; width: 100%; color: var(--text-primary); }
.m-item--button { cursor: pointer; }
.m-item--button:hover { background: var(--brand-primary-subtle); }
.m-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 14px; line-height: 20px; }
.m-item__body strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-item--stacked { flex-direction: column; align-items: stretch; }
.m-item__row { display: flex; align-items: center; gap: var(--space-md); }
.m-item__photos { display: flex; gap: var(--space-sm); }
.m-shell .tabs { overflow-x: auto; scrollbar-width: none; }
.m-shell .tab { white-space: nowrap; padding: var(--space-sm) var(--space-sm); font-size: 13px; }
.m-actions { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: var(--space-md); }
.m-dl { display: grid; grid-template-columns: auto 1fr; gap: var(--space-xs) var(--space-lg); margin-top: var(--space-lg); font-size: 14px; line-height: 21px; }
.m-dl dt { color: var(--text-secondary); }
.m-dl dd { margin: 0; overflow-wrap: anywhere; }
.m-profile__head { display: flex; align-items: center; gap: var(--space-md); }
.m-login { display: flex; flex-direction: column; gap: var(--space-md); padding-top: var(--space-2xl); }
.m-hero { background: var(--brand-primary); color: var(--text-on-brand); border-radius: var(--radius-lg); padding: var(--space-2xl); display: flex; flex-direction: column; gap: var(--space-sm); }
.m-hero .h5 { color: var(--text-on-brand); }
.m-hero .btn--primary { background: var(--bg-surface); color: var(--text-brand); }
.m-hero__sub { color: var(--alpha-white-85); font-size: 14px; line-height: 21px; }
.m-notice { display: flex; gap: var(--space-md); align-items: flex-start; }

/* Cartes catalogue */
.chips { display: flex; gap: var(--space-sm); overflow-x: auto; padding-bottom: var(--space-xs); scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chips .chip { flex: none; }
.m-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); }
.m-card { display: flex; flex-direction: column; background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); overflow: hidden; color: var(--text-primary); }
.m-card__media { aspect-ratio: 4 / 3; background: var(--brand-primary-subtle); display: grid; place-items: center; color: var(--text-brand); font-family: var(--font-heading); font-weight: 800; font-size: 28px; }
.m-card__media img { width: 100%; height: 100%; object-fit: cover; }
.m-card__body { padding: var(--space-md); display: flex; flex-direction: column; gap: var(--space-xs); font-size: 14px; line-height: 20px; }
.m-card__body strong { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.m-card__meta { display: flex; flex-wrap: wrap; gap: var(--space-xs); align-items: center; }
.m-exemplaire { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: var(--stroke-thin) solid var(--border-default); font-size: 14px; }
.m-exemplaire:last-child { border-bottom: 0; }
.m-cta { position: sticky; bottom: 88px; }

/* Scanner */
.reader { position: relative; aspect-ratio: 1; background: var(--text-primary); border-radius: var(--radius-lg); overflow: hidden; display: grid; place-items: center; color: var(--text-inverse); }
.reader video { width: 100% !important; height: 100% !important; object-fit: cover; }
.reader__hint { position: absolute; bottom: var(--space-md); left: var(--space-md); right: var(--space-md); text-align: center; font-size: 12px; color: var(--text-inverse); }
.video-box { aspect-ratio: 4 / 3; background: var(--text-primary); border-radius: var(--radius-lg); overflow: hidden; display: grid; place-items: center; }
.video-box video, .video-box img { width: 100%; height: 100%; object-fit: cover; }
.photo-preview { width: 100%; border-radius: var(--radius-md); }
.step-title { display: flex; align-items: center; gap: var(--space-sm); }
.step-num { width: 28px; height: 28px; border-radius: 50%; background: var(--brand-primary); color: var(--text-on-brand); display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.checklist { display: flex; flex-direction: column; gap: var(--space-sm); }
.checklist__row { display: flex; flex-direction: column; gap: var(--space-xs); padding: var(--space-md); background: var(--bg-canvas); border-radius: var(--radius-md); }
.checklist__line { font-size: 14px; line-height: 20px; }
.seg { display: flex; border: var(--stroke-thin) solid var(--border-default); border-radius: var(--radius-full); overflow: hidden; }
.seg__btn { flex: 1; height: 36px; font-size: 12px; font-weight: 700; color: var(--text-secondary); background: var(--bg-surface); }
.seg__btn--on { background: var(--status-available-bg); color: var(--status-available-fg); }
.seg__btn--problem { background: var(--status-late-bg); color: var(--status-late-fg); }
.checklist__comment { display: none; }
.checklist__row--problem .checklist__comment { display: block; }
.result { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-md); padding: var(--space-2xl) var(--space-lg); }
.result__icon { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; }
.result__icon--ok { background: var(--status-available-bg); color: var(--status-available-fg); }
.result__icon--warn { background: var(--status-maintenance-bg); color: var(--status-maintenance-fg); }
.result__icon--error { background: var(--status-late-bg); color: var(--status-late-fg); }
.thumb-lg { width: 72px; height: 54px; object-fit: cover; border-radius: var(--radius-md); border: var(--stroke-thin) solid var(--border-default); }

/* Navigation basse */
.m-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: min(480px, 100%); height: 72px; padding: 0 var(--space-sm) env(safe-area-inset-bottom); display: grid; grid-template-columns: 1fr 1fr 72px 1fr 1fr; align-items: center; background: var(--bg-surface); border-top: var(--stroke-thin) solid var(--border-default); z-index: 10; }
.m-nav__tab { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: var(--space-sm) 0; }
.m-nav__tab--active { color: var(--text-brand); }
.m-nav__scan { justify-self: center; width: 60px; height: 60px; margin-top: -28px; border-radius: 50%; background: var(--brand-primary); color: var(--text-on-brand); display: grid; place-items: center; box-shadow: var(--shadow-card); }
.m-nav__scan:hover { background: var(--brand-primary-hover); }
.error-card { border-left: 4px solid var(--feedback-error); }
```

- [ ] **Step 8 : Vérifier dans le navigateur**

Run: `python3 -m http.server 8000` (si besoin) puis ouvrir `http://localhost:8000/mobile.html` (outils responsive à 390 px).
Expected : `#/login` avec les groupes Élèves (30) / Intervenants (10) / Pédagogie (5), le filtre réduit la liste ; clic sur Léa Pezzetti → `#/accueil` (« Cet écran arrive en phase 2 »), header violet avec avatar, barre basse avec bouton scan rond centré ; les 4 onglets + scan naviguent ; profil → « Changer d'utilisateur » ramène au login. Aucune erreur console.

- [ ] **Step 9 : Suite complète et commit**

Run: `npm test`
Expected: `# fail 0` (149 tests).

```bash
git add mobile.html css/mobile.css js/mobile/ tests/mobile-layout.test.mjs
git commit -m "feat(mobile): coquille, login démo, header, navigation basse et profil"
```

---

### Task 2 : `actions/loans.js` — résolution d'un scan, emprunt et retour self-service

**Files:**
- Create: `js/actions/loans.js`
- Modify: `js/rules.js` (`REASONS` + `REASON_LABELS` : ajouter `CODE_INCONNU`)
- Test: `tests/actions-loans-self.test.mjs`, `tests/rules.test.mjs` (le test « chaque motif a un libellé » couvre le nouveau motif)

**Interfaces:**
- Consumes : `store`, `now`, `canBorrowSelf`, `selfReturnDeadline`, `withDefaults`, `REASONS`, `REASON_LABELS`, `sortByDateDesc`, `applyItemState`, `buildChecklist`, `hasProblem`, `problemLines`, `isItemCode`, `logAction`, `ACTIONS`, `fullName`, constantes `models`.
- Produces : `findOpenLoanForItem(itemId) → Loan | null` ; `resolveScan(code, userId, date = now()) → { mode: 'emprunt' | 'retour' | 'erreur', item, loan, reason }` ; `borrowSelf({ itemCode, userId, photo }) → Loan` (lève `Error` avec `.reason`) ; `returnSelf({ loanId, userId, photo, checklist }) → { loan, maintenance }` ; `userLoans(userId, date = now()) → { enCours: [{ loan, item, late }], reservations: [{ loan, item }], historique: [{ loan, item }] }`.

- [ ] **Step 1 : Ajouter le motif `code_inconnu` dans `js/rules.js`**

Dans `REASONS`, ajouter `CODE_INCONNU: 'code_inconnu',` (après `UTILISATEUR_INACTIF`) et dans `REASON_LABELS` : `code_inconnu: 'Code non reconnu : scannez l’étiquette MDS-XXXX collée sur l’objet.',`.

- [ ] **Step 2 : Écrire le test**

`tests/actions-loans-self.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES } from '../js/models.js';
import { findOpenLoanForItem, resolveScan, borrowSelf, returnSelf, userLoans } from '../js/actions/loans.js';

const NOW = new Date(2026, 8, 17, 10, 0); // jeudi 10h
const LEA = 'user_001';
const PHOTO = 'data:image/jpeg;base64,AAAA';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

const itemByCode = (code) => store.items.list((i) => i.code === code)[0];
const freeSelf = (ref) => store.items.list((i) => i.reference === ref && i.etat === ITEM_STATES.DISPONIBLE)[0];

test('findOpenLoanForItem : emprunt en cours ou null', () => {
  assert.equal(findOpenLoanForItem('item_001').statut, LOAN_STATES.EN_COURS);
  assert.equal(findOpenLoanForItem(freeSelf('souris').id), null);
});

test('resolveScan : code inconnu ou malformé', () => {
  assert.equal(resolveScan('MDS-9999', LEA).reason, REASONS.CODE_INCONNU);
  assert.equal(resolveScan('bonjour', LEA).mode, 'erreur');
  assert.equal(resolveScan('', LEA).reason, REASONS.CODE_INCONNU);
});

test('resolveScan : objet self disponible → emprunt', () => {
  const kit = freeSelf('kit-tableau');
  const r = resolveScan(kit.code, LEA);
  assert.equal(r.mode, 'emprunt');
  assert.equal(r.item.id, kit.id);
  assert.equal(r.loan, null);
});

test('resolveScan : mon propre emprunt en cours → retour, celui d’un autre → refus', () => {
  const mine = store.loans.get('loan_041'); // 1er emprunt self en cours du seed (Léa)
  assert.equal(mine.userId, LEA);
  const r = resolveScan(store.items.get(mine.itemId).code, LEA);
  assert.equal(r.mode, 'retour');
  assert.equal(r.loan.id, mine.id);
  const other = resolveScan(store.items.get(mine.itemId).code, 'user_002');
  assert.equal(other.mode, 'erreur');
  assert.equal(other.reason, REASONS.EMPRUNTE_PAR_AUTRE);
});

test('resolveScan : circuit valeur ou salle → mauvais_circuit', () => {
  const canon = itemByCode('MDS-0029');
  assert.equal(resolveScan(canon.code, 'user_010').reason, REASONS.MAUVAIS_CIRCUIT);
  const trepied = store.items.list((i) => i.reference === 'leofoto-trepied')[0];
  assert.equal(resolveScan(trepied.code, 'user_010').reason, REASONS.MAUVAIS_CIRCUIT);
});

test('resolveScan : maintenance, bureau fermé, déjà un exemplaire, compte inactif', () => {
  const souris3 = store.items.list((i) => i.reference === 'souris' && i.etat === ITEM_STATES.MAINTENANCE)[0];
  assert.equal(resolveScan(souris3.code, 'user_010').reason, REASONS.EN_MAINTENANCE);
  const kit = freeSelf('kit-tableau');
  assert.equal(resolveScan(kit.code, 'user_010', new Date(2026, 8, 19, 10, 0)).reason, REASONS.BUREAU_FERME);
  assert.equal(resolveScan(kit.code, 'user_010', new Date(2026, 8, 17, 12, 30)).reason, REASONS.BUREAU_FERME);
  const multi = freeSelf('multiprise');
  assert.equal(resolveScan(multi.code, LEA).reason, REASONS.DEJA_UN_EXEMPLAIRE); // Léa a déjà la multiprise #1
  store.users.update('user_010', { actif: false });
  assert.equal(resolveScan(kit.code, 'user_010').reason, REASONS.UTILISATEUR_INACTIF);
});

test('borrowSelf : crée l’emprunt, l’objet passe emprunté, retour prévu 17h, journal, photo', () => {
  const kit = freeSelf('kit-tableau');
  const logsBefore = store.log.list().length;
  const loan = borrowSelf({ itemCode: kit.code, userId: 'user_010', photo: PHOTO });
  assert.equal(loan.statut, LOAN_STATES.EN_COURS);
  assert.equal(loan.itemId, kit.id);
  assert.equal(loan.userId, 'user_010');
  assert.equal(loan.photoEmprunt, PHOTO);
  assert.equal(new Date(loan.finPrevue).getHours(), 17);
  assert.equal(new Date(loan.finPrevue).getDate(), 17);
  assert.equal(loan.dateRetrait, NOW.toISOString());
  assert.equal(store.items.get(kit.id).etat, ITEM_STATES.EMPRUNTE);
  assert.equal(store.log.list().length, logsBefore + 1);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.LOAN_EMPRUNT);
  assert.equal(entry.loanId, loan.id);
  assert.equal(entry.userId, 'user_010');
  assert.match(entry.detail, /Kit tableau blanc #\d — Hugo Bernard/);
});

test('borrowSelf refuse avec le motif en .reason et n’écrit rien', () => {
  const canon = itemByCode('MDS-0029');
  const before = store.loans.list().length;
  assert.throws(() => borrowSelf({ itemCode: canon.code, userId: 'user_010', photo: PHOTO }), (e) => e.reason === REASONS.MAUVAIS_CIRCUIT && /de cette façon/.test(e.message));
  assert.throws(() => borrowSelf({ itemCode: 'MDS-9999', userId: 'user_010', photo: PHOTO }), (e) => e.reason === REASONS.CODE_INCONNU);
  assert.equal(store.loans.list().length, before);
});

test('returnSelf sans problème : retourné, disponible, photo de retour, journal', () => {
  const loan = store.loans.get('loan_041');
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO });
  assert.equal(r.maintenance, null);
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
  assert.equal(r.loan.photoRetour, PHOTO);
  assert.equal(r.loan.dateRetourReelle, NOW.toISOString());
  assert.equal(r.loan.checklistRetour.length, 3);
  assert.ok(r.loan.checklistRetour.every((l) => l.ok));
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_RETOUR);
});

test('returnSelf avec problème : maintenance + signalement ouvert + 2 entrées de journal', () => {
  const loan = store.loans.get('loan_041');
  const item = store.items.get(loan.itemId);
  const logsBefore = store.log.list().length;
  const maintBefore = store.maintenance.list().length;
  const checklist = [{ ligne: 'Câble intact', ok: false, commentaire: 'gaine coupée' }, { ligne: 'Toutes les prises fonctionnent', ok: true, commentaire: '' }, { ligne: 'Interrupteur OK', ok: true, commentaire: '' }];
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO, checklist });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.equal(r.maintenance.loanId, loan.id);
  assert.match(r.maintenance.description, /Câble intact → gaine coupée/);
  assert.equal(store.maintenance.list().length, maintBefore + 1);
  assert.equal(store.log.list().length, logsBefore + 2);
  assert.deepEqual(store.log.list().slice(-2).map((e) => e.action), [ACTIONS.LOAN_RETOUR, ACTIONS.MAINT_SIGNALEMENT]);
});

test('returnSelf : retour possible bureau fermé ; refus si mauvais utilisateur ou emprunt clos', () => {
  const loan = store.loans.get('loan_041');
  assert.throws(() => returnSelf({ loanId: loan.id, userId: 'user_002', photo: PHOTO }), /ne vous appartient pas/);
  store.settings.update({ horlogeDemo: new Date(2026, 8, 19, 10, 0).toISOString() });
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO });
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
  assert.throws(() => returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO }), /plus en cours/);
  assert.throws(() => returnSelf({ loanId: 'nope', userId: LEA, photo: PHOTO }), /introuvable/);
});

test('userLoans : en cours avec retard, réservations, historique trié', () => {
  const lateLoan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && new Date(l.finPrevue) < NOW)[0];
  const u = userLoans(lateLoan.userId, NOW);
  assert.ok(u.enCours.some((x) => x.loan.id === lateLoan.id && x.late === true));
  assert.ok(u.enCours.every((x) => x.item && x.item.id === x.loan.itemId));
  const resUser = store.loans.list((l) => l.statut === LOAN_STATES.RESERVEE)[0].userId;
  assert.equal(userLoans(resUser, NOW).reservations.length, 1);
  const hist = userLoans('user_005', NOW).historique;
  assert.ok(hist.every((x) => x.loan.statut !== LOAN_STATES.EN_COURS && x.loan.statut !== LOAN_STATES.RESERVEE));
  assert.ok(hist.every((x, i, a) => i === 0 || (a[i - 1].loan.dateRetourReelle || '') >= (x.loan.dateRetourReelle || '')));
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/actions-loans-self.test.mjs`
Expected: FAIL — `Cannot find module '../js/actions/loans.js'`

- [ ] **Step 4 : Écrire `js/actions/loans.js`**

```js
// js/actions/loans.js — emprunts. Phase 2 : circuit self-service (scan → emprunt / retour).
// Phase 3 ajoutera les réservations de matériel de valeur (remise, réception, expiration).
import { store } from '../store.js';
import { ITEM_STATES, LOAN_STATES, MAINT_TYPES, MAINT_STATES } from '../models.js';
import { now, canBorrowSelf, selfReturnDeadline, withDefaults, isLate, sortByDateDesc, REASONS, REASON_LABELS } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { buildChecklist, hasProblem, problemLines } from '../checklists.js';
import { isItemCode } from '../qr.js';
import { fullName } from '../ui.js';

const ACTIVE = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

function refusal(reason) {
  return Object.assign(new Error(REASON_LABELS[reason] || reason), { reason });
}

export function findOpenLoanForItem(itemId) {
  return store.loans.list((l) => l.itemId === itemId && l.statut === LOAN_STATES.EN_COURS)[0] || null;
}

// Que faire de ce code pour cet utilisateur ? retour de son emprunt en cours, nouvel emprunt self, ou refus.
export function resolveScan(code, userId, date = now()) {
  const text = String(code || '').trim();
  const nothing = { item: null, loan: null };
  if (!isItemCode(text)) return { mode: 'erreur', reason: REASONS.CODE_INCONNU, ...nothing };
  const item = store.items.list((i) => i.code === text)[0];
  if (!item) return { mode: 'erreur', reason: REASONS.CODE_INCONNU, ...nothing };
  const loan = findOpenLoanForItem(item.id);
  if (loan && loan.userId === userId) return { mode: 'retour', item, loan, reason: null };
  const user = store.users.get(userId);
  const check = canBorrowSelf({ item, user, loans: store.loans.list(), items: store.items.list(), settings: store.settings.get(), date });
  if (!check.ok) return { mode: 'erreur', item, loan, reason: check.reason };
  return { mode: 'emprunt', item, loan: null, reason: null };
}

export function borrowSelf({ itemCode, userId, photo = null }) {
  const date = now();
  const r = resolveScan(itemCode, userId, date);
  if (r.mode !== 'emprunt') throw refusal(r.reason || REASONS.INDISPONIBLE);
  const { item } = r;
  const user = store.users.get(userId);
  const heure = withDefaults(store.settings.get()).heureRetourSelf;
  applyItemState(item.id, ITEM_STATES.EMPRUNTE);
  const loan = store.loans.create({
    itemId: item.id, userId, statut: LOAN_STATES.EN_COURS, motif: '', motifRefus: '', codeRetrait: null,
    dateReservation: date.toISOString(), debutPrevu: date.toISOString(), finPrevue: selfReturnDeadline(date, heure).toISOString(),
    dateRetrait: date.toISOString(), dateRetourReelle: null, remisPar: null, receptionnePar: null,
    photoEmprunt: photo, photoRetour: null, checklistRetour: null, commentaire: '',
  });
  logAction({ auteurId: userId, action: ACTIONS.LOAN_EMPRUNT, itemId: item.id, loanId: loan.id, userId, detail: `${item.nom} — ${fullName(user)}` });
  return loan;
}

// Le retour est toujours possible (pas de contrôle d’horaires) ; un problème coché crée un signalement.
export function returnSelf({ loanId, userId, photo = null, checklist = null }) {
  const loan = store.loans.get(loanId);
  if (!loan) throw new Error(`Emprunt introuvable (${loanId})`);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  if (loan.userId !== userId) throw new Error('Cet emprunt ne vous appartient pas.');
  const item = store.items.get(loan.itemId);
  const date = now();
  const lines = checklist || buildChecklist(item.reference);
  const problem = hasProblem(lines);
  const updated = store.loans.update(loanId, { statut: LOAN_STATES.RETOURNEE, dateRetourReelle: date.toISOString(), photoRetour: photo, checklistRetour: lines });
  applyItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE);
  logAction({ auteurId: userId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId, detail: `${item.nom} rendu${problem ? ' avec un problème' : ''}` });
  if (!problem) return { loan: updated, maintenance: null };
  const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
  const maintenance = store.maintenance.create({
    itemId: item.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: userId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
    description: `Signalé au retour : ${detail}`, prestataire: '', cout: 0, loanId, bookingId: null,
  });
  logAction({ auteurId: userId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: item.id, loanId, detail: maintenance.description });
  return { loan: updated, maintenance };
}

export function userLoans(userId, date = now()) {
  const items = store.items.list();
  const itemOf = (l) => items.find((i) => i.id === l.itemId) || null;
  const mine = store.loans.list((l) => l.userId === userId);
  return {
    enCours: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.EN_COURS), (l) => l.dateRetrait).map((loan) => ({ loan, item: itemOf(loan), late: isLate(loan, date) })),
    reservations: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.RESERVEE), (l) => l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
    historique: sortByDateDesc(mine.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.finPrevue).map((loan) => ({ loan, item: itemOf(loan) })),
  };
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/actions-loans-self.test.mjs tests/rules.test.mjs`
Expected: `# pass 26`, `# fail 0` (12 + 14)

- [ ] **Step 6 : Commit**

```bash
git add js/rules.js js/actions/loans.js tests/actions-loans-self.test.mjs
git commit -m "feat(actions): emprunts self-service — résolution d'un scan, emprunt, retour avec signalement"
```

---

### Task 3 : `scanner.js` (caméra, QR, photo) et `scanFlow.js` (enchaînement des étapes)

**Files:**
- Create: `js/scanner.js`, `js/mobile/scanFlow.js`, `vendor/html5-qrcode.min.js`
- Modify: `vendor/README.md` (nouvelle ligne), `mobile.html` (script vendor)
- Test: `tests/scanner.test.mjs`, `tests/scan-flow.test.mjs`

**Interfaces:**
- Consumes : `buildChecklist` (checklists), `REASONS`.
- Produces (`js/scanner.js`) : `fitWithin(width, height, maxSide) → { width, height }`, `normalizeScanText(text) → string`, `resizeToJpeg(source, maxSide = 640, quality = 0.72) → dataURL`, `capturePhoto(videoEl) → dataURL`, `placeholderPhoto(label) → dataURL` (image de démonstration), `hasCamera() → Promise<bool>`, `startCamera(videoEl) → Promise`, `stopCamera()`, `startScanner(elementId, onCode) → Promise`, `stopScanner() → Promise`.
- Produces (`js/mobile/scanFlow.js`) : `STEPS`, `initialState()`, `onScanResolved(state, resolution)`, `onPhoto(state, dataUrl)`, `setChecklistLine(state, index, { ok, commentaire })`, `onDone(state, result)`, `onError(state, message)`. État : `{ step, mode, item, loan, reason, photo, checklist, result, error }`.

- [ ] **Step 1 : Récupérer la bibliothèque de scan**

```bash
curl -sL -o vendor/html5-qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js
wc -c vendor/html5-qrcode.min.js      # attendu : 375364
grep -c "Html5Qrcode" vendor/html5-qrcode.min.js   # > 0
```

Ajouter à la table de `vendor/README.md` : `| \`html5-qrcode.min.js\` | html5-qrcode (mebjas) | 2.3.8 | Apache-2.0 | https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js |`. Dans `mobile.html`, avant le script module : `<script src="vendor/html5-qrcode.min.js"></script>`.

- [ ] **Step 2 : Écrire les tests**

`tests/scanner.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, normalizeScanText, resizeToJpeg } from '../js/scanner.js';

test('fitWithin : réduit au grand côté, jamais agrandi, jamais 0', () => {
  assert.deepEqual(fitWithin(1920, 1080, 640), { width: 640, height: 360 });
  assert.deepEqual(fitWithin(1080, 1920, 640), { width: 360, height: 640 });
  assert.deepEqual(fitWithin(320, 240, 640), { width: 320, height: 240 });
  assert.deepEqual(fitWithin(5000, 1, 640), { width: 640, height: 1 });
});

test('normalizeScanText : trim, code objet en majuscules, autres codes intacts', () => {
  assert.equal(normalizeScanText('  mds-0042 '), 'MDS-0042');
  assert.equal(normalizeScanText('LOAN-loan_ab12-XY34ZZ'), 'LOAN-loan_ab12-XY34ZZ');
  assert.equal(normalizeScanText(null), '');
});

test('resizeToJpeg : utilise fitWithin et le canvas fourni par la fabrique', () => {
  const calls = [];
  const ctx = { drawImage: (...a) => calls.push(a) };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: (type, q) => `${type};q=${q};${canvas.width}x${canvas.height}` };
  const out = resizeToJpeg({ videoWidth: 1280, videoHeight: 960 }, 640, 0.5, () => canvas);
  assert.equal(out, 'image/jpeg;q=0.5;640x480');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1), [0, 0, 640, 480]);
});
```

`tests/scan-flow.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, initialState, onScanResolved, onPhoto, setChecklistLine, onDone, onError } from '../js/mobile/scanFlow.js';

const item = { id: 'i1', reference: 'multiprise', nom: 'Multiprise #1' };

test('initialState', () => {
  assert.deepEqual(initialState(), { step: STEPS.SCAN, mode: null, item: null, loan: null, reason: null, photo: null, checklist: null, result: null, error: null });
});

test('emprunt : scan → photo → confirmation → terminé', () => {
  let s = onScanResolved(initialState(), { mode: 'emprunt', item, loan: null, reason: null });
  assert.equal(s.step, STEPS.PHOTO);
  assert.equal(s.mode, 'emprunt');
  s = onPhoto(s, 'data:image/jpeg;base64,AAA');
  assert.equal(s.step, STEPS.CONFIRM);
  assert.equal(s.checklist, null);
  s = onDone(s, { loanId: 'l1' });
  assert.equal(s.step, STEPS.DONE);
  assert.deepEqual(s.result, { loanId: 'l1' });
});

test('retour : scan → photo → checklist pré-remplie → terminé', () => {
  let s = onScanResolved(initialState(), { mode: 'retour', item, loan: { id: 'l1' }, reason: null });
  s = onPhoto(s, 'data:image/jpeg;base64,AAA');
  assert.equal(s.step, STEPS.CHECKLIST);
  assert.equal(s.checklist.length, 3);
  assert.ok(s.checklist.every((l) => l.ok));
  const s2 = setChecklistLine(s, 0, { ok: false, commentaire: 'gaine coupée' });
  assert.equal(s2.checklist[0].ok, false);
  assert.equal(s2.checklist[0].commentaire, 'gaine coupée');
  assert.equal(s.checklist[0].ok, true, 'immutabilité');
  const s3 = setChecklistLine(s2, 0, { ok: true });
  assert.equal(s3.checklist[0].commentaire, '', 'repasser en OK vide le commentaire');
});

test('refus : scan → erreur avec motif', () => {
  const s = onScanResolved(initialState(), { mode: 'erreur', item, loan: null, reason: 'bureau_ferme' });
  assert.equal(s.step, STEPS.ERREUR);
  assert.equal(s.reason, 'bureau_ferme');
  assert.equal(s.item, item);
});

test('onError : erreur technique avec message', () => {
  const s = onError(onScanResolved(initialState(), { mode: 'emprunt', item, loan: null, reason: null }), 'Caméra indisponible');
  assert.equal(s.step, STEPS.ERREUR);
  assert.equal(s.error, 'Caméra indisponible');
  assert.equal(s.reason, null);
});
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/scanner.test.mjs tests/scan-flow.test.mjs`
Expected: FAIL — modules introuvables

- [ ] **Step 4 : Écrire `js/scanner.js`**

```js
// js/scanner.js — caméra, lecture de QR (vendor/html5-qrcode.min.js, globale Html5Qrcode) et photo.
// Les fonctions pures (fitWithin, normalizeScanText, resizeToJpeg) sont testées sous Node ;
// les autres touchent le DOM/les périphériques et sont vérifiées en navigateur.

export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Les étiquettes objets sont imprimées en majuscules ; les codes de retrait (LOAN-…) contiennent
// un identifiant sensible à la casse et ne sont pas modifiés.
export function normalizeScanText(text) {
  const t = String(text || '').trim();
  return /^mds-\d{4}$/i.test(t) ? t.toUpperCase() : t;
}

const defaultCanvas = () => document.createElement('canvas');

export function resizeToJpeg(source, maxSide = 640, quality = 0.72, makeCanvas = defaultCanvas) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  const { width, height } = fitWithin(sw, sh, maxSide);
  const canvas = makeCanvas();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function capturePhoto(videoEl) {
  return resizeToJpeg(videoEl, 640, 0.72);
}

// Image de démonstration quand aucune caméra n’est disponible (couleurs lues dans les tokens).
export function placeholderPhoto(label) {
  const css = getComputedStyle(document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css.getPropertyValue('--brand-primary-subtle').trim() || '#eee';
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = css.getPropertyValue('--brand-primary').trim() || '#000';
  ctx.font = '700 40px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Photo de démonstration', 320, 220);
  ctx.font = '400 28px Inter, sans-serif';
  ctx.fillText(String(label || ''), 320, 280);
  ctx.font = '400 20px Inter, sans-serif';
  ctx.fillText(new Date().toLocaleString('fr-FR'), 320, 330);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export async function hasCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

let stream = null;

export async function startCamera(videoEl) {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  videoEl.srcObject = stream;
  await videoEl.play();
}

export function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

let scanner = null;

// elementId : id d’un conteneur vide ; onCode reçoit le texte normalisé à chaque lecture.
export async function startScanner(elementId, onCode) {
  const Lib = typeof window !== 'undefined' ? window.Html5Qrcode : null;
  if (!Lib) throw new Error('Bibliothèque de scan indisponible.');
  await stopScanner();
  scanner = new Lib(elementId, { verbose: false });
  await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (text) => onCode(normalizeScanText(text)), () => {});
}

export async function stopScanner() {
  if (!scanner) return;
  const s = scanner;
  scanner = null;
  try { await s.stop(); } catch { /* déjà arrêté */ }
  try { s.clear(); } catch { /* conteneur retiré */ }
}
```

- [ ] **Step 5 : Écrire `js/mobile/scanFlow.js`**

```js
// js/mobile/scanFlow.js — réducteur pur des étapes de l’écran Scanner.
// scan → (erreur) | photo → confirmation (emprunt) | checklist (retour) → terminé.
import { buildChecklist } from '../checklists.js';

export const STEPS = { SCAN: 'scan', PHOTO: 'photo', CONFIRM: 'confirm', CHECKLIST: 'checklist', DONE: 'done', ERREUR: 'erreur' };

export function initialState() {
  return { step: STEPS.SCAN, mode: null, item: null, loan: null, reason: null, photo: null, checklist: null, result: null, error: null };
}

export function onScanResolved(state, { mode, item, loan, reason }) {
  if (mode === 'erreur') return { ...state, step: STEPS.ERREUR, mode, item, loan, reason, error: null };
  return { ...state, step: STEPS.PHOTO, mode, item, loan, reason: null, error: null };
}

export function onPhoto(state, photo) {
  const retour = state.mode === 'retour';
  return { ...state, photo, step: retour ? STEPS.CHECKLIST : STEPS.CONFIRM, checklist: retour ? buildChecklist(state.item.reference) : null };
}

export function setChecklistLine(state, index, { ok, commentaire }) {
  const checklist = state.checklist.map((line, i) => {
    if (i !== index) return line;
    const nextOk = ok === undefined ? line.ok : ok;
    return { ...line, ok: nextOk, commentaire: nextOk ? '' : (commentaire === undefined ? line.commentaire : commentaire) };
  });
  return { ...state, checklist };
}

export function onDone(state, result) {
  return { ...state, step: STEPS.DONE, result };
}

export function onError(state, message) {
  return { ...state, step: STEPS.ERREUR, reason: null, error: message };
}
```

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/scanner.test.mjs tests/scan-flow.test.mjs`
Expected: `# pass 8`, `# fail 0`

- [ ] **Step 7 : Commit**

```bash
git add vendor/html5-qrcode.min.js vendor/README.md mobile.html js/scanner.js js/mobile/scanFlow.js tests/scanner.test.mjs tests/scan-flow.test.mjs
git commit -m "feat(mobile): caméra, lecture QR, photo redimensionnée et enchaînement des étapes de scan"
```

---

### Task 4 : Catalogue — regroupement par référence, accueil, catalogue, fiche

**Files:**
- Create: `js/mobile/catalog.js`, `js/mobile/views/accueil.js`, `js/mobile/views/catalogue.js`, `js/mobile/views/fiche.js`
- Modify: `js/mobile/app.js` (imports + routes `/accueil`, `/catalogue`, `/catalogue/:reference`)
- Test: `tests/mobile-catalog.test.mjs`, `tests/mobile-views.test.mjs`

**Interfaces:**
- Consumes : `store`, `auth`, `now`, `isBookingActive`, `userLoans`, `LABELS`, `CIRCUITS`, `ITEM_STATES`, `BOOKING_STATES`, `CATEGORIES`, helpers `ui`, `setHeader`, `navigate`.
- Produces : `baseName(nom)`, `groupByReference(items) → [{ reference, nom, categorie, circuit, photoUrl, total, disponibles, exemplaires }]` (tri par nom), `filterCatalog(groups, { q, categorie })`, `availability(group) → { kind: 'item', value, text }` ; `accueilHtml({ user, enCours, nextBooking, date })`, `accueilView` ; `catalogueHtml({ groups, filters, categories })`, `catalogueView` ; `ficheHtml({ group, date })`, `ficheView(container, { reference })`.

- [ ] **Step 1 : Écrire les tests**

`tests/mobile-catalog.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { baseName, groupByReference, filterCatalog, availability } from '../js/mobile/catalog.js';

const db = buildSeed(new Date(2026, 8, 17, 10, 0));

test('baseName retire le numéro d’exemplaire', () => {
  assert.equal(baseName('Multiprise #3'), 'Multiprise');
  assert.equal(baseName('Canon R10 + objectif 18-55 + bague'), 'Canon R10 + objectif 18-55 + bague');
});

test('groupByReference : une carte par référence, compteurs, tri par nom', () => {
  const groups = groupByReference(db.items);
  assert.equal(groups.length, 20);
  const multi = groups.find((g) => g.reference === 'multiprise');
  assert.equal(multi.nom, 'Multiprise');
  assert.equal(multi.total, 6);
  assert.equal(multi.disponibles, 4);
  assert.equal(multi.exemplaires.length, 6);
  assert.equal(multi.circuit, 'self');
  const noms = groups.map((g) => g.nom);
  assert.deepEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, 'fr')));
});

test('filterCatalog : recherche et catégorie', () => {
  const groups = groupByReference(db.items);
  assert.equal(filterCatalog(groups, { q: 'sd' }).length, 2);
  assert.equal(filterCatalog(groups, { categorie: 'Audio' }).length, 5);
  assert.equal(filterCatalog(groups, { q: 'zoom', categorie: 'Audio' }).length, 1);
  assert.equal(filterCatalog(groups, { q: 'zoom', categorie: 'Photo' }).length, 0);
});

test('availability : disponible, tout emprunté, maintenance/HS', () => {
  const groups = groupByReference(db.items);
  assert.deepEqual(availability(groups.find((g) => g.reference === 'multiprise')), { kind: 'item', value: 'disponible', text: '4 sur 6 disponibles' });
  assert.deepEqual(availability(groups.find((g) => g.reference === 'canon-r10')), { kind: 'item', value: 'emprunte', text: '' });
  assert.deepEqual(availability(groups.find((g) => g.reference === 'tascam-dr70')), { kind: 'item', value: 'reserve', text: '' });
  const hsOnly = { exemplaires: [{ etat: 'hs' }, { etat: 'maintenance' }], disponibles: 0, total: 2 };
  assert.deepEqual(availability(hsOnly), { kind: 'item', value: 'maintenance', text: 'Indisponible' });
});
```

`tests/mobile-views.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userLoans } from '../js/actions/loans.js';
import { groupByReference } from '../js/mobile/catalog.js';
import { accueilHtml } from '../js/mobile/views/accueil.js';
import { catalogueHtml } from '../js/mobile/views/catalogue.js';
import { ficheHtml } from '../js/mobile/views/fiche.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('accueilHtml : salutation, emprunts en cours avec retard, réservation salle, CTA', () => {
  const late = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  const user = store.users.get(late.userId);
  const html = accueilHtml({ user, enCours: userLoans(user.id, NOW).enCours, nextBooking: null, date: NOW });
  assert.match(html, new RegExp(`Bonjour ${user.prenom}`));
  assert.match(html, /badge--late">En retard/);
  assert.match(html, /href="#\/scan"/);
  assert.match(html, /Aucune réservation de la salle photo/);
  const booking = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html2 = accueilHtml({ user: store.users.get(booking.userId), enCours: [], nextBooking: booking, date: NOW });
  assert.match(html2, /Aucun emprunt en cours/);
  assert.match(html2, /9h-11h/);
  assert.match(html2, /En cours/);
});

test('catalogueHtml : chips, cartes par référence, badge et pastille circuit', () => {
  const groups = groupByReference(store.items.list());
  const html = catalogueHtml({ groups, filters: { q: '', categorie: 'Audio' }, categories: ['Bureautique', 'Audio'] });
  assert.match(html, /chip chip--active" data-categorie="Audio"/);
  assert.match(html, /chip" data-categorie=""/);
  assert.equal((html.match(/class="m-card"/g) || []).length, 20);
  assert.match(html, /href="#\/catalogue\/multiprise"/);
  assert.match(html, /4 sur 6 disponibles/);
  assert.match(html, /badge--available">Self-service/);
  const empty = catalogueHtml({ groups: [], filters: { q: 'zzz', categorie: '' }, categories: [] });
  assert.match(empty, /Aucun matériel ne correspond/);
});

test('ficheHtml : exemplaires et bouton selon le circuit', () => {
  const groups = groupByReference(store.items.list());
  const self = ficheHtml({ group: groups.find((g) => g.reference === 'multiprise'), date: NOW });
  assert.equal((self.match(/m-exemplaire/g) || []).length, 6);
  assert.match(self, /href="#\/scan"[^>]*>Scanner pour emprunter/);
  assert.match(self, /MDS-0001/);
  const salle = ficheHtml({ group: groups.find((g) => g.reference === 'leofoto-trepied'), date: NOW });
  assert.match(salle, /Disponible dans la salle photo/);
  assert.match(salle, /href="#\/salle"/);
  const valeur = ficheHtml({ group: groups.find((g) => g.reference === 'sd-256'), date: NOW });
  assert.match(valeur, /href="#\/reserver\/item_0\d\d"[^>]*>Réserver/);
  const allOut = ficheHtml({ group: groups.find((g) => g.reference === 'canon-r10'), date: NOW });
  assert.match(allOut, /Aucun exemplaire disponible/);
  assert.doesNotMatch(allOut, /href="#\/reserver/);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/mobile-catalog.test.mjs tests/mobile-views.test.mjs`
Expected: FAIL — modules introuvables

- [ ] **Step 3 : Écrire `js/mobile/catalog.js`**

```js
// js/mobile/catalog.js — regroupement du matériel par référence pour le catalogue mobile (pur).
import { ITEM_STATES } from '../models.js';

export function baseName(nom) {
  return String(nom || '').replace(/\s#\d+$/, '');
}

export function groupByReference(items) {
  const map = new Map();
  for (const item of items) {
    if (item.etat === ITEM_STATES.HS) continue; // hors service : masqué du catalogue (spec §5.4)
    let g = map.get(item.reference);
    if (!g) {
      g = { reference: item.reference, nom: baseName(item.nom), categorie: item.categorie, circuit: item.circuit, photoUrl: item.photoUrl || '', total: 0, disponibles: 0, exemplaires: [] };
      map.set(item.reference, g);
    }
    g.total += 1;
    if (item.etat === ITEM_STATES.DISPONIBLE) g.disponibles += 1;
    if (!g.photoUrl && item.photoUrl) g.photoUrl = item.photoUrl;
    g.exemplaires.push(item);
  }
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function filterCatalog(groups, { q = '', categorie = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return groups.filter((g) => (!categorie || g.categorie === categorie)
    && (!needle || [g.nom, g.reference, g.categorie].some((v) => String(v).toLowerCase().includes(needle))));
}

export function availability(group) {
  // `text` complète le badge (jamais redondant avec son libellé) : vide quand le badge suffit.
  if (group.disponibles > 0) {
    return { kind: 'item', value: ITEM_STATES.DISPONIBLE, text: group.total > 1 ? `${group.disponibles} sur ${group.total} disponibles` : '' };
  }
  const etats = group.exemplaires.map((i) => i.etat);
  if (etats.includes(ITEM_STATES.EMPRUNTE)) return { kind: 'item', value: ITEM_STATES.EMPRUNTE, text: '' };
  if (etats.includes(ITEM_STATES.RESERVE)) return { kind: 'item', value: ITEM_STATES.RESERVE, text: '' };
  return { kind: 'item', value: ITEM_STATES.MAINTENANCE, text: 'Indisponible' };
}
```

Note : le groupe `hsOnly` du test n'a pas de `total`/`disponibles` cohérents avec des exemplaires réels — `availability` ne lit que `disponibles`, `total` et les états, ce qui suffit.

- [ ] **Step 4 : Écrire `js/mobile/views/accueil.js`**

```js
// js/mobile/views/accueil.js — accueil de l’emprunteur : emprunts en cours, salle, scanner.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isBookingActive } from '../../rules.js';
import { BOOKING_STATES } from '../../models.js';
import { escapeHtml, badge, formatTime, formatDate, formatSlots, relativeDay } from '../../ui.js';
import { userLoans } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

function loansCard(enCours, date) {
  if (!enCours.length) return '<div class="empty-state">Aucun emprunt en cours.</div>';
  return `<div class="m-list">${enCours.map(({ loan, item, late }) => `
    <a class="m-item" href="#/catalogue/${escapeHtml(item ? item.reference : '')}">
      <span class="m-item__body"><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong><span class="body-tiny text-secondary">Retour ${escapeHtml(relativeDay(loan.finPrevue, date).toLowerCase())} avant ${escapeHtml(formatTime(loan.finPrevue))}</span></span>
      ${late ? badge('loan', 'en_retard') : badge('loan', loan.statut)}
    </a>`).join('')}</div>`;
}

function bookingCard(nextBooking, date) {
  if (!nextBooking) return '<div class="empty-state">Aucune réservation de la salle photo.</div>';
  const active = isBookingActive(nextBooking, date);
  return `
    <a class="m-item" href="#/salle">
      <span class="m-item__body"><strong>${escapeHtml(relativeDay(nextBooking.date, date))} · ${escapeHtml(formatSlots(nextBooking.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(nextBooking.date))}${active ? ' · créneau en cours' : ''}</span></span>
      ${badge('booking', active ? 'en_cours' : nextBooking.statut)}
    </a>`;
}

export function accueilHtml({ user, enCours, nextBooking, date }) {
  const lateCount = enCours.filter((x) => x.late).length;
  return `
    <section class="m-hero">
      <p class="label-caps">${escapeHtml(formatDate(date))}</p>
      <h2 class="h5">Bonjour ${escapeHtml(user.prenom)} 👋</h2>
      <p class="m-hero__sub">${lateCount ? `${lateCount} emprunt${lateCount > 1 ? 's' : ''} en retard — pensez à le rendre.` : 'Scannez l’étiquette d’un objet pour l’emprunter ou le rendre.'}</p>
      <a class="btn btn--primary btn--block" href="#/scan">Scanner un QR code</a>
    </section>
    <section class="card">
      <div class="card__header"><h3 class="card__title">Mes emprunts en cours</h3><a class="body-sm" href="#/emprunts">Tout voir →</a></div>
      ${loansCard(enCours, date)}
    </section>
    <section class="card">
      <div class="card__header"><h3 class="card__title">Salle photo</h3><a class="body-sm" href="#/salle">Réserver →</a></div>
      ${bookingCard(nextBooking, date)}
    </section>`;
}

export function accueilView(container) {
  const render = () => {
    const user = auth.currentUser();
    const date = now();
    const bookings = store.bookings.list((b) => b.userId === user.id && (b.statut === BOOKING_STATES.A_VENIR || b.statut === BOOKING_STATES.EN_COURS))
      .sort((a, b) => a.date.localeCompare(b.date) || a.creneaux[0] - b.creneaux[0]);
    setHeader({ title: 'MDS Emprunts' });
    container.innerHTML = accueilHtml({ user, enCours: userLoans(user.id, date).enCours, nextBooking: bookings[0] || null, date });
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 5 : Écrire `js/mobile/views/catalogue.js` et `js/mobile/views/fiche.js`**

`js/mobile/views/catalogue.js` :

```js
// js/mobile/views/catalogue.js — catalogue : recherche, chips de catégorie, une carte par référence.
import { store } from '../../store.js';
import { CATEGORIES } from '../../models.js';
import { escapeHtml, badge } from '../../ui.js';
import { groupByReference, filterCatalog, availability } from '../catalog.js';
import { setHeader } from '../layout.js';

function cardHtml(g) {
  const av = availability(g);
  const media = g.photoUrl ? `<img src="${escapeHtml(g.photoUrl)}" alt="">` : escapeHtml(g.nom[0] || '?');
  return `
    <a class="m-card" href="#/catalogue/${escapeHtml(g.reference)}">
      <div class="m-card__media">${media}</div>
      <div class="m-card__body">
        <span class="label-mini-caps text-secondary">${escapeHtml(g.categorie)}</span>
        <strong>${escapeHtml(g.nom)}</strong>
        <span class="m-card__meta">${badge(av.kind, av.value)}${av.text ? `<span class="body-tiny text-secondary">${escapeHtml(av.text)}</span>` : ''}</span>
        <span class="m-card__meta">${badge('circuit', g.circuit)}</span>
      </div>
    </a>`;
}

export function catalogueHtml({ groups, filters, categories }) {
  const chip = (value, label) => `<button type="button" class="chip${filters.categorie === value ? ' chip--active' : ''}" data-categorie="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  return `
    <input class="input input--search" type="search" name="q" placeholder="Rechercher un matériel…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
    <div class="chips">${chip('', 'Tout')}${categories.map((c) => chip(c, c)).join('')}</div>
    ${groups.length ? `<div class="m-grid">${groups.map(cardHtml).join('')}</div>` : '<div class="empty-state">Aucun matériel ne correspond à votre recherche.</div>'}`;
}

export function catalogueView(container) {
  const filters = { q: '', categorie: '' };
  const render = () => {
    const groups = filterCatalog(groupByReference(store.items.list()), filters);
    setHeader({ title: 'Catalogue' });
    container.innerHTML = catalogueHtml({ groups, filters, categories: CATEGORIES });
    const input = container.querySelector('[name="q"]');
    input.addEventListener('input', (e) => { filters.q = e.target.value; render(); container.querySelector('[name="q"]').focus(); });
    container.querySelectorAll('[data-categorie]').forEach((b) => b.addEventListener('click', () => { filters.categorie = b.dataset.categorie; render(); }));
  };
  render();
  return store.subscribe(render);
}
```

`js/mobile/views/fiche.js` :

```js
// js/mobile/views/fiche.js — fiche d’une référence : exemplaires et action selon le circuit.
import { store } from '../../store.js';
import { now } from '../../rules.js';
import { CIRCUITS, ITEM_STATES } from '../../models.js';
import { escapeHtml, badge } from '../../ui.js';
import { groupByReference, availability } from '../catalog.js';
import { setHeader } from '../layout.js';

const CIRCUIT_HELP = {
  self: 'Self-service : scannez l’étiquette de l’exemplaire au bureau des pédago (8h-12h, 13h-17h). Retour le jour même avant 17h.',
  salle: 'Ce matériel reste dans la salle photo : réservez un créneau pour l’utiliser.',
  valeur: 'Matériel sur réservation : la pédago vous le remet à l’heure prévue.',
};

function ctaHtml(group) {
  const free = group.exemplaires.find((i) => i.etat === ITEM_STATES.DISPONIBLE);
  if (group.circuit === CIRCUITS.SALLE) return '<p class="body-sm">Disponible dans la salle photo.</p><a class="btn btn--primary btn--block" href="#/salle">Réserver la salle</a>';
  if (!free) return '<p class="body-sm text-secondary">Aucun exemplaire disponible pour le moment.</p>';
  if (group.circuit === CIRCUITS.SELF) return '<a class="btn btn--primary btn--block" href="#/scan">Scanner pour emprunter</a>';
  return `<a class="btn btn--primary btn--block" href="#/reserver/${escapeHtml(free.id)}">Réserver</a>`;
}

export function ficheHtml({ group, date }) {
  const av = availability(group);
  const media = group.photoUrl ? `<img src="${escapeHtml(group.photoUrl)}" alt="">` : escapeHtml(group.nom[0] || '?');
  return `
    <div class="m-card">
      <div class="m-card__media">${media}</div>
      <div class="m-card__body">
        <span class="label-mini-caps text-secondary">${escapeHtml(group.categorie)}</span>
        <strong class="h6">${escapeHtml(group.nom)}</strong>
        <span class="m-card__meta">${badge(av.kind, av.value)}${av.text ? `<span class="body-tiny text-secondary">${escapeHtml(av.text)}</span>` : ''}${badge('circuit', group.circuit)}</span>
        <p class="body-sm text-secondary">${escapeHtml(CIRCUIT_HELP[group.circuit] || '')}</p>
      </div>
    </div>
    <div class="card">
      <div class="card__header"><h3 class="card__title">Exemplaires</h3><span class="body-sm text-secondary">${group.total}</span></div>
      ${group.exemplaires.map((i) => `<div class="m-exemplaire"><span><strong>${escapeHtml(i.nom)}</strong><br><span class="body-tiny text-secondary">${escapeHtml(i.code)} · ${escapeHtml(i.localisation || '')}</span></span>${badge('item', i.etat)}</div>`).join('')}
    </div>
    <div class="m-cta">${ctaHtml(group)}</div>`;
}

export function ficheView(container, { reference }) {
  const render = () => {
    const group = groupByReference(store.items.list()).find((g) => g.reference === reference);
    if (!group) {
      setHeader({ title: 'Introuvable', back: '/catalogue' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(reference)}</p></div>`;
      return;
    }
    setHeader({ title: group.nom, back: '/catalogue' });
    container.innerHTML = ficheHtml({ group, date: now() });
  };
  render();
  return store.subscribe(render);
}
```

Note : le paramètre `date` de `ficheHtml` est réservé à l'affichage des réservations (phase 3).

- [ ] **Step 6 : Brancher les routes dans `js/mobile/app.js`**

Remplacer les lignes commentées par `import { accueilView } from './views/accueil.js';`, `import { catalogueView } from './views/catalogue.js';`, `import { ficheView } from './views/fiche.js';` et les routes par `{ path: '/accueil', view: guard(accueilView) }`, `{ path: '/catalogue', view: guard(catalogueView) }`, `{ path: '/catalogue/:reference', view: guard(ficheView) }`.

- [ ] **Step 7 : Lancer les tests**

Run: `node --test tests/mobile-catalog.test.mjs tests/mobile-views.test.mjs`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 8 : Vérifier dans le navigateur**

`mobile.html` (390 px) connecté en Léa : accueil « Bonjour Léa », sa multiprise en cours, salle : aucune réservation ; catalogue : 20 cartes, chips filtrent, recherche « sd » → 2 cartes ; fiche Multiprise : 6 exemplaires avec états, bouton « Scanner pour emprunter » ; fiche Trépied → « Réserver la salle » ; fiche Carte SD 256 → « Réserver » (écran « phase 3 »). Aucune erreur console.

- [ ] **Step 9 : Commit**

```bash
git add js/mobile/catalog.js js/mobile/views/accueil.js js/mobile/views/catalogue.js js/mobile/views/fiche.js js/mobile/app.js tests/mobile-catalog.test.mjs tests/mobile-views.test.mjs
git commit -m "feat(mobile): accueil, catalogue par référence et fiche avec action selon le circuit"
```

---

### Task 5 : Écran Scanner — caméra / simulation, photo, confirmation, checklist, résultat

**Files:**
- Create: `js/mobile/views/scan.js`
- Modify: `js/mobile/app.js` (import + route `/scan`)
- Test: `tests/mobile-scan-view.test.mjs`

**Interfaces:**
- Consumes : `resolveScan`, `borrowSelf`, `returnSelf` (actions/loans), `scanner.js` (`hasCamera`, `startScanner`, `stopScanner`, `startCamera`, `stopCamera`, `capturePhoto`, `placeholderPhoto`, `normalizeScanText`), `scanFlow.js`, `REASON_LABELS`, `selfReturnDeadline`, `withDefaults`, `now`, `CIRCUITS`, helpers `ui`, `setHeader`, `auth`, `store`.
- Produces : `scanStepHtml({ codes, camera })`, `photoStepHtml({ mode, item, camera })`, `confirmStepHtml({ item, photo, deadline })`, `checklistStepHtml({ item, photo, checklist })`, `resultHtml({ mode, item, result })`, `errorHtml({ reason, error, item })`, `scanView(container)` (renvoie un nettoyage qui arrête caméra et scanner ; **ne se réabonne pas au store** — le flux possède son état).

- [ ] **Step 1 : Écrire le test**

`tests/mobile-scan-view.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanStepHtml, photoStepHtml, confirmStepHtml, checklistStepHtml, resultHtml, errorHtml } from '../js/mobile/views/scan.js';

const item = { id: 'item_001', code: 'MDS-0001', nom: 'Multiprise #1', reference: 'multiprise', circuit: 'self' };
const PHOTO = 'data:image/jpeg;base64,AAAA';

test('scanStepHtml : lecteur, simulation avec la liste des codes, saisie manuelle', () => {
  const html = scanStepHtml({ codes: [{ code: 'MDS-0001', nom: 'Multiprise #1' }, { code: 'MDS-0029', nom: 'Canon "R10"' }], camera: true });
  assert.match(html, /id="reader"/);
  assert.match(html, /<option value="MDS-0029">MDS-0029 — Canon &quot;R10&quot;<\/option>/);
  assert.match(html, /data-action="simulate"/);
  assert.match(html, /name="code-manual"/);
  assert.match(html, /data-action="manual"/);
  const noCam = scanStepHtml({ codes: [], camera: false });
  assert.match(noCam, /Caméra indisponible/);
  assert.doesNotMatch(noCam, /id="reader"/);
});

test('photoStepHtml : caméra ou image de démonstration selon le contexte', () => {
  const cam = photoStepHtml({ mode: 'emprunt', item, camera: true });
  assert.match(cam, /<video id="video"/);
  assert.match(cam, /data-action="capture"/);
  assert.match(cam, /data-action="placeholder"/);
  assert.match(cam, /Photo de l’objet/);
  const noCam = photoStepHtml({ mode: 'retour', item, camera: false });
  assert.doesNotMatch(noCam, /<video/);
  assert.doesNotMatch(noCam, /data-action="capture"/);
  assert.match(noCam, /avant de le rendre/);
});

test('confirmStepHtml : récapitulatif, photo, échéance', () => {
  const html = confirmStepHtml({ item, photo: PHOTO, deadline: new Date(2026, 8, 17, 17, 0) });
  assert.match(html, /Multiprise #1/);
  assert.match(html, /<img class="photo-preview" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /aujourd’hui avant 17h00/);
  assert.match(html, /data-action="confirm-borrow"/);
  assert.match(html, /data-action="cancel"/);
});

test('checklistStepHtml : une ligne par point, état OK/Problème, commentaire', () => {
  const checklist = [{ ligne: 'Câble intact', ok: true, commentaire: '' }, { ligne: 'Interrupteur OK', ok: false, commentaire: 'cassé <b>' }];
  const html = checklistStepHtml({ item, photo: PHOTO, checklist });
  assert.equal((html.match(/checklist__row/g) || []).length, 3); // 2 lignes + 1 modificateur --problem
  assert.match(html, /data-line="0" data-ok="1" class="seg__btn seg__btn--on"/);
  assert.match(html, /checklist__row checklist__row--problem" data-row="1"/);
  assert.match(html, /data-line="1" data-ok="0" class="seg__btn seg__btn--problem"/);
  assert.match(html, /<textarea[^>]*data-comment="1"[^>]*>cassé &lt;b&gt;<\/textarea>/);
  assert.match(html, /data-action="confirm-return"/);
});

test('resultHtml et errorHtml', () => {
  assert.match(resultHtml({ mode: 'emprunt', item, result: { finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() } }), /Emprunt enregistré/);
  assert.match(resultHtml({ mode: 'retour', item, result: { problem: true } }), /la pédago est prévenue/);
  assert.match(resultHtml({ mode: 'retour', item, result: { problem: false } }), /Merci !/);
  const closed = errorHtml({ reason: 'bureau_ferme', error: null, item });
  assert.match(closed, /heures d’ouverture/);
  assert.match(closed, /data-action="restart"/);
  const valeur = errorHtml({ reason: 'mauvais_circuit', error: null, item: { ...item, circuit: 'valeur', reference: 'canon-r10' } });
  assert.match(valeur, /href="#\/catalogue\/canon-r10"/);
  const tech = errorHtml({ reason: null, error: 'Caméra indisponible.', item: null });
  assert.match(tech, /Caméra indisponible\./);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-scan-view.test.mjs`
Expected: FAIL — `Cannot find module '../js/mobile/views/scan.js'`

- [ ] **Step 3 : Écrire `js/mobile/views/scan.js`**

```js
// js/mobile/views/scan.js — écran Scanner : lecture du QR (caméra ou simulation), photo,
// confirmation d’emprunt ou checklist de retour, résultat. Le flux est piloté par scanFlow.js.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, selfReturnDeadline, withDefaults, REASON_LABELS } from '../../rules.js';
import { CIRCUITS, ITEM_STATES } from '../../models.js';
import { escapeHtml, badge, formatTime, relativeDay, toast } from '../../ui.js';
import { resolveScan, borrowSelf, returnSelf } from '../../actions/loans.js';
import { hasCamera, startScanner, stopScanner, startCamera, stopCamera, capturePhoto, placeholderPhoto, normalizeScanText } from '../../scanner.js';
import { STEPS, initialState, onScanResolved, onPhoto, setChecklistLine, onDone, onError } from '../scanFlow.js';
import { setHeader } from '../layout.js';

const stepTitle = (n, text) => `<h2 class="step-title"><span class="step-num">${n}</span><span class="h6">${escapeHtml(text)}</span></h2>`;
const itemLine = (item) => `<div class="m-item"><span class="m-item__body"><strong>${escapeHtml(item.nom)}</strong><span class="body-tiny text-secondary">${escapeHtml(item.code)}</span></span>${badge('circuit', item.circuit)}</div>`;

export function scanStepHtml({ codes, camera }) {
  const reader = camera
    ? '<div id="reader" class="reader"><p class="reader__hint">Visez l’étiquette QR de l’objet</p></div>'
    : '<div class="reader"><p class="body-sm">Caméra indisponible — utilisez la simulation ci-dessous.</p></div>';
  return `
    ${stepTitle(1, 'Scannez l’étiquette de l’objet')}
    ${reader}
    <div class="card">
      <div class="card__header"><h3 class="card__title">Simuler un scan</h3></div>
      <div class="stack">
        <label class="field"><span class="field__label">Objet</span><select class="select" name="code-sim">${codes.map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)} — ${escapeHtml(c.nom)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn--secondary btn--block" data-action="simulate">Simuler le scan</button>
        <label class="field"><span class="field__label">Ou saisir un code</span><input class="input" name="code-manual" placeholder="MDS-0001" autocapitalize="characters"></label>
        <button type="button" class="btn btn--ghost btn--block" data-action="manual">Valider le code</button>
      </div>
    </div>`;
}

export function photoStepHtml({ mode, item, camera }) {
  const why = mode === 'retour' ? 'Photographiez l’objet avant de le rendre : elle atteste de son état.' : 'Photographiez l’objet : elle atteste de son état au moment de l’emprunt.';
  const capture = camera ? '<div class="video-box"><video id="video" playsinline muted></video></div><button type="button" class="btn btn--primary btn--block" data-action="capture">Prendre la photo</button>' : '';
  return `
    ${stepTitle(2, 'Photo de l’objet')}
    ${itemLine(item)}
    <p class="body-sm text-secondary">${why}</p>
    ${capture}
    <button type="button" class="btn ${camera ? 'btn--ghost' : 'btn--primary'} btn--block" data-action="placeholder">${camera ? 'Sans caméra : image de démonstration' : 'Utiliser une image de démonstration'}</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function confirmStepHtml({ item, photo, deadline }) {
  return `
    ${stepTitle(3, 'Confirmer l’emprunt')}
    ${itemLine(item)}
    <img class="photo-preview" src="${escapeHtml(photo)}" alt="Photo de l’objet à l’emprunt">
    <div class="alert alert--info">Retour attendu ${escapeHtml(relativeDay(deadline, deadline).toLowerCase())} avant ${escapeHtml(formatTime(deadline))}, au bureau des pédago.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-borrow">Confirmer l’emprunt</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function checklistStepHtml({ item, photo, checklist }) {
  const rows = checklist.map((line, i) => `
    <div class="checklist__row${line.ok ? '' : ' checklist__row--problem'}" data-row="${i}">
      <span class="checklist__line">${escapeHtml(line.ligne)}</span>
      <div class="seg">
        <button type="button" data-line="${i}" data-ok="1" class="seg__btn${line.ok ? ' seg__btn--on' : ''}">OK</button>
        <button type="button" data-line="${i}" data-ok="0" class="seg__btn${line.ok ? '' : ' seg__btn--problem'}">Problème</button>
      </div>
      <textarea class="textarea checklist__comment" data-comment="${i}" placeholder="Décrivez le problème (optionnel)">${escapeHtml(line.commentaire)}</textarea>
    </div>`).join('');
  return `
    ${stepTitle(3, 'État de l’objet')}
    ${itemLine(item)}
    <img class="photo-preview" src="${escapeHtml(photo)}" alt="Photo de l’objet au retour">
    <div class="checklist">${rows}</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-return">Confirmer le retour</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel">Annuler</button>`;
}

export function resultHtml({ mode, item, result }) {
  let icon = 'ok';
  let title = 'Emprunt enregistré';
  let text = `Retour attendu ${result && result.finPrevue ? `${relativeDay(result.finPrevue, result.finPrevue).toLowerCase()} avant ${formatTime(result.finPrevue)}` : 'aujourd’hui'}. Bon travail !`;
  if (mode === 'retour') {
    if (result && result.problem) { icon = 'warn'; title = 'Retour enregistré — problème signalé'; text = 'Merci, la pédago est prévenue et l’objet passe en maintenance.'; }
    else { title = 'Retour enregistré'; text = 'Merci ! L’objet est de nouveau disponible.'; }
  }
  return `
    <div class="card result">
      <div class="result__icon result__icon--${icon}">${icon === 'ok' ? '✓' : '!'}</div>
      <h2 class="h6">${escapeHtml(title)}</h2>
      <p class="body-sm text-secondary">${escapeHtml(item.nom)} · ${escapeHtml(text)}</p>
      <button type="button" class="btn btn--primary btn--block" data-action="restart">Scanner un autre objet</button>
      <a class="btn btn--ghost btn--block" href="#/accueil">Retour à l’accueil</a>
    </div>`;
}

export function errorHtml({ reason, error, item }) {
  const message = reason ? (REASON_LABELS[reason] || reason) : (error || 'Une erreur est survenue.');
  let hint = '';
  if (item && item.circuit === CIRCUITS.VALEUR) hint = `<a class="btn btn--secondary btn--block" href="#/catalogue/${escapeHtml(item.reference)}">Réserver depuis le catalogue</a>`;
  if (item && item.circuit === CIRCUITS.SALLE) hint = '<a class="btn btn--secondary btn--block" href="#/salle">Réserver la salle photo</a>';
  return `
    <div class="card result">
      <div class="result__icon result__icon--error">✕</div>
      <h2 class="h6">Impossible</h2>
      ${item ? `<p class="body-sm">${escapeHtml(item.nom)}</p>` : ''}
      <p class="body-sm text-secondary">${escapeHtml(message)}</p>
      ${hint}
      <button type="button" class="btn btn--primary btn--block" data-action="restart">Scanner à nouveau</button>
      <a class="btn btn--ghost btn--block" href="#/accueil">Retour à l’accueil</a>
    </div>`;
}

export function scanView(container) {
  const user = auth.currentUser();
  let state = initialState();
  let camera = false;
  let alive = true;

  const codes = () => store.items.list((i) => i.etat !== ITEM_STATES.HS).sort((a, b) => a.code.localeCompare(b.code)).map((i) => ({ code: i.code, nom: i.nom }));
  const set = (next) => { state = next; render(); };
  const on = (selector, fn) => { const el = container.querySelector(selector); if (el) el.addEventListener('click', fn); };
  const handleCode = (text) => { stopScanner(); set(onScanResolved(state, resolveScan(normalizeScanText(text), user.id, now()))); };

  const bindScan = async () => {
    stopCamera();
    on('[data-action="simulate"]', () => handleCode(container.querySelector('[name="code-sim"]').value));
    on('[data-action="manual"]', () => handleCode(container.querySelector('[name="code-manual"]').value));
    if (!camera) return;
    try {
      await startScanner('reader', (text) => handleCode(text));
      if (!alive) stopScanner();
    } catch (e) {
      const hint = container.querySelector('.reader__hint');
      if (hint) hint.textContent = 'Caméra indisponible — utilisez la simulation.';
    }
  };

  const bindPhoto = async () => {
    await stopScanner();
    on('[data-action="cancel"]', () => { stopCamera(); set(initialState()); });
    on('[data-action="placeholder"]', () => { stopCamera(); set(onPhoto(state, placeholderPhoto(state.item.code))); });
    const capture = container.querySelector('[data-action="capture"]');
    if (!capture) return;
    const video = container.querySelector('#video');
    try {
      await startCamera(video);
      if (!alive) { stopCamera(); return; }
      capture.addEventListener('click', () => { const photo = capturePhoto(video); stopCamera(); set(onPhoto(state, photo)); });
    } catch (e) {
      capture.disabled = true;
      container.querySelector('.video-box').hidden = true;
      toast('Caméra indisponible : utilisez l’image de démonstration.', 'warning');
    }
  };

  const bindConfirm = () => {
    on('[data-action="cancel"]', () => set(initialState()));
    on('[data-action="confirm-borrow"]', () => {
      try {
        const loan = borrowSelf({ itemCode: state.item.code, userId: user.id, photo: state.photo });
        set(onDone(state, { loanId: loan.id, finPrevue: loan.finPrevue }));
      } catch (e) {
        set(e.reason ? onScanResolved(state, { mode: 'erreur', item: state.item, loan: null, reason: e.reason }) : onError(state, e.message));
      }
    });
  };

  const bindChecklist = () => {
    on('[data-action="cancel"]', () => set(initialState()));
    container.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => set(setChecklistLine(state, Number(b.dataset.line), { ok: b.dataset.ok === '1' }))));
    container.querySelectorAll('[data-comment]').forEach((t) => t.addEventListener('input', () => { state = setChecklistLine(state, Number(t.dataset.comment), { commentaire: t.value }); }));
    on('[data-action="confirm-return"]', () => {
      try {
        const r = returnSelf({ loanId: state.loan.id, userId: user.id, photo: state.photo, checklist: state.checklist });
        set(onDone(state, { loanId: r.loan.id, problem: !!r.maintenance }));
      } catch (e) {
        set(onError(state, e.message));
      }
    });
  };

  const render = () => {
    setHeader({ title: 'Scanner', back: '/accueil' });
    switch (state.step) {
      case STEPS.SCAN: container.innerHTML = scanStepHtml({ codes: codes(), camera }); bindScan(); break;
      case STEPS.PHOTO: container.innerHTML = photoStepHtml({ mode: state.mode, item: state.item, camera }); bindPhoto(); break;
      case STEPS.CONFIRM: {
        const deadline = selfReturnDeadline(now(), withDefaults(store.settings.get()).heureRetourSelf);
        container.innerHTML = confirmStepHtml({ item: state.item, photo: state.photo, deadline }); bindConfirm(); break;
      }
      case STEPS.CHECKLIST: container.innerHTML = checklistStepHtml({ item: state.item, photo: state.photo, checklist: state.checklist }); bindChecklist(); break;
      case STEPS.DONE: container.innerHTML = resultHtml({ mode: state.mode, item: state.item, result: state.result }); on('[data-action="restart"]', () => set(initialState())); break;
      default: container.innerHTML = errorHtml({ reason: state.reason, error: state.error, item: state.item }); on('[data-action="restart"]', () => set(initialState()));
    }
  };

  hasCamera().then((c) => { if (!alive) return; camera = c; if (state.step === STEPS.SCAN) render(); });
  render();
  return () => { alive = false; stopScanner(); stopCamera(); };
}
```

- [ ] **Step 4 : Brancher la route dans `js/mobile/app.js`**

`import { scanView } from './views/scan.js';` et `{ path: '/scan', view: guard(scanView) }`.

- [ ] **Step 5 : Lancer le test**

Run: `node --test tests/mobile-scan-view.test.mjs`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 6 : Vérifier dans le navigateur (le scénario clé du prototype)**

Deux fenêtres : A = `admin.html` (Alexis, `#/dashboard`), B = `mobile.html` 390 px (Yann Guihard, `user_002` — sans emprunt en cours). Si le jour réel n’est pas un jour ouvré 8h-17h, régler d’abord l’horloge de démo depuis la console de A : `(await import('./js/store.js')).store.settings.update({ horlogeDemo: '2026-09-21T08:00:00.000Z' })` (les 6 emprunts self du seed apparaissent alors en retard : c’est attendu).
1. B → Scanner → « Simuler le scan » sur `MDS-0008` (Kit tableau #2, libre ; le #1 est déjà emprunté dans le seed) → étape Photo → « Sans caméra : image de démonstration » (ou « Prendre la photo » si webcam autorisée) → confirmation « Retour attendu aujourd’hui avant 17h00 » → Confirmer → « Emprunt enregistré ». A : KPI « Emprunts en cours » passe à 11 et la dernière activité « Emprunt · Hugo Bernard » apparaît **sans rechargement**.
2. B → « Scanner un autre objet » → même code `MDS-0008` → mode retour → photo → checklist « Kit tableau blanc » (4 lignes) → « 4 stylos… » en Problème + commentaire « stylo rouge manquant » → Confirmer le retour → « problème signalé ». A : signalement ouvert sur le dashboard, sidebar Maintenance « 2 », fiche `MDS-0008` en Maintenance avec les deux photos.
3. B → scanner `MDS-0029` (Canon) → « Impossible … ne s’emprunte pas de cette façon » + bouton « Réserver depuis le catalogue ».
4. A → (phase 5 fournira l'UI ; pour le test) console : `(await import('./js/store.js')).store.settings.update({ horlogeDemo: '2026-09-19T10:00:00.000Z' })` → B scanne un objet libre → « bureau des pédago est fermé ». Remettre `horlogeDemo: null`.
5. Avec une webcam : « Prendre la photo » produit une vraie image ; un QR `MDS-0003` imprimé depuis `etiquettes.html` est lu par la caméra.
Aucune erreur console dans les deux fenêtres ; quitter l'écran Scanner arrête la caméra (le voyant s'éteint).

- [ ] **Step 7 : Commit**

```bash
git add js/mobile/views/scan.js js/mobile/app.js tests/mobile-scan-view.test.mjs
git commit -m "feat(mobile): écran scanner — QR, photo, emprunt et retour avec checklist"
```

---

### Task 6 : Mes emprunts

**Files:**
- Create: `js/mobile/views/emprunts.js`
- Modify: `js/mobile/app.js` (import + route `/emprunts`)
- Test: `tests/mobile-emprunts.test.mjs`

**Interfaces:**
- Consumes : `userLoans`, `now`, helpers `ui`, `setHeader`, `auth`, `store`.
- Produces : `TABS_EMPRUNTS`, `empruntsHtml({ tab, data, date })`, `empruntsView(container)`.

- [ ] **Step 1 : Écrire le test**

`tests/mobile-emprunts.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userLoans } from '../js/actions/loans.js';
import { TABS_EMPRUNTS, empruntsHtml } from '../js/mobile/views/emprunts.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('TABS_EMPRUNTS', () => {
  assert.deepEqual(TABS_EMPRUNTS.map((t) => t.key), ['enCours', 'reservations', 'historique']);
});

test('empruntsHtml : onglets avec compteurs, en cours avec photo et retard, aide au retour', () => {
  const late = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  store.loans.update(late.id, { photoEmprunt: 'data:image/jpeg;base64,AAAA' });
  const data = userLoans(late.userId, NOW);
  const html = empruntsHtml({ tab: 'enCours', data, date: NOW });
  assert.match(html, /tab tab--active" data-tab="enCours">En cours <span class="tab__count">1<\/span>/);
  assert.match(html, /data-tab="historique">Historique <span class="tab__count">\d+</);
  assert.match(html, /badge--late">En retard/);
  assert.match(html, /<img class="thumb-lg" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /scannez son étiquette/);
});

test('empruntsHtml : réservations et historique', () => {
  const res = store.loans.list((l) => l.statut === 'reservee')[0];
  const html = empruntsHtml({ tab: 'reservations', data: userLoans(res.userId, NOW), date: NOW });
  assert.match(html, /Retrait prévu/);
  assert.match(html, /badge--reserved">Réservé/);
  const hist = empruntsHtml({ tab: 'historique', data: userLoans('user_006', NOW), date: NOW }); // user_006 a rendu la souris #3
  assert.match(hist, /badge--available">Retourné/);
  const empty = empruntsHtml({ tab: 'reservations', data: userLoans('user_006', NOW), date: NOW });
  assert.match(empty, /Aucune réservation/);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-emprunts.test.mjs`
Expected: FAIL — `Cannot find module '../js/mobile/views/emprunts.js'`

- [ ] **Step 3 : Écrire `js/mobile/views/emprunts.js`**

```js
// js/mobile/views/emprunts.js — mes emprunts : en cours, réservations, historique.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now } from '../../rules.js';
import { escapeHtml, badge, formatDate, formatTime, formatDateTime, relativeDay } from '../../ui.js';
import { userLoans } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

export const TABS_EMPRUNTS = [
  { key: 'enCours', label: 'En cours' },
  { key: 'reservations', label: 'Réservations' },
  { key: 'historique', label: 'Historique' },
];

const photo = (src, alt) => (src ? `<img class="thumb-lg" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : '');
const nameOf = (item, loan) => escapeHtml(item ? item.nom : loan.itemId);

function enCoursHtml(rows, date) {
  if (!rows.length) return '<div class="empty-state">Aucun emprunt en cours.</div>';
  return `<div class="m-list">${rows.map(({ loan, item, late }) => `
    <div class="m-item m-item--stacked">
      <div class="m-item__row"><span class="m-item__body"><strong>${nameOf(item, loan)}</strong><span class="body-tiny text-secondary">Retiré ${escapeHtml(formatDateTime(loan.dateRetrait || loan.debutPrevu))}</span><span class="body-tiny text-secondary">Retour ${escapeHtml(relativeDay(loan.finPrevue, date).toLowerCase())} avant ${escapeHtml(formatTime(loan.finPrevue))}</span></span>${late ? badge('loan', 'en_retard') : badge('loan', loan.statut)}</div>
      ${loan.photoEmprunt ? `<div class="m-item__photos">${photo(loan.photoEmprunt, 'Photo à l’emprunt')}</div>` : ''}
    </div>`).join('')}</div>
    <p class="body-tiny text-secondary">Pour rendre un objet, scannez son étiquette depuis le bouton Scanner.</p>`;
}

function reservationsHtml(rows, date) {
  if (!rows.length) return '<div class="empty-state">Aucune réservation.</div>';
  return `<div class="m-list">${rows.map(({ loan, item }) => `
    <div class="m-item">
      <span class="m-item__body"><strong>${nameOf(item, loan)}</strong><span class="body-tiny text-secondary">Retrait prévu ${escapeHtml(relativeDay(loan.debutPrevu, date).toLowerCase())} à ${escapeHtml(formatTime(loan.debutPrevu))} · retour le ${escapeHtml(formatDate(loan.finPrevue))}</span></span>
      ${badge('loan', loan.statut)}
    </div>`).join('')}</div>
    <p class="body-tiny text-secondary">Le QR de retrait s’affichera ici à l’heure prévue (phase 3).</p>`;
}

function historiqueHtml(rows) {
  if (!rows.length) return '<div class="empty-state">Aucun emprunt passé.</div>';
  return `<div class="m-list">${rows.map(({ loan, item }) => `
    <div class="m-item m-item--stacked">
      <div class="m-item__row"><span class="m-item__body"><strong>${nameOf(item, loan)}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(loan.dateRetrait || loan.debutPrevu))}${loan.dateRetourReelle ? ` → ${escapeHtml(formatDate(loan.dateRetourReelle))}` : ''}</span></span>${badge('loan', loan.statut)}</div>
      ${loan.photoEmprunt || loan.photoRetour ? `<div class="m-item__photos">${photo(loan.photoEmprunt, 'Photo à l’emprunt')}${photo(loan.photoRetour, 'Photo au retour')}</div>` : ''}
    </div>`).join('')}</div>`;
}

export function empruntsHtml({ tab, data, date }) {
  const tabs = TABS_EMPRUNTS.map((t) => `<button type="button" class="tab${t.key === tab ? ' tab--active' : ''}" data-tab="${t.key}">${escapeHtml(t.label)} <span class="tab__count">${data[t.key].length}</span></button>`).join('');
  const body = tab === 'reservations' ? reservationsHtml(data.reservations, date) : tab === 'historique' ? historiqueHtml(data.historique) : enCoursHtml(data.enCours, date);
  return `<div class="card"><div class="tabs">${tabs}</div><div class="stack" data-role="list">${body}</div></div>`;
}

export function empruntsView(container) {
  let tab = 'enCours';
  const render = () => {
    const user = auth.currentUser();
    setHeader({ title: 'Mes emprunts' });
    container.innerHTML = empruntsHtml({ tab, data: userLoans(user.id, now()), date: now() });
    container.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 4 : Brancher la route**

`import { empruntsView } from './views/emprunts.js';` et `{ path: '/emprunts', view: guard(empruntsView) }`. Si `aVenirView` n'est plus utilisé que pour `/salle` et `/reserver/:id`, il reste importé.

- [ ] **Step 5 : Lancer le test**

Run: `node --test tests/mobile-emprunts.test.mjs`
Expected: `# pass 3`, `# fail 0`

- [ ] **Step 6 : Vérifier dans le navigateur**

Léa : onglet En cours → sa multiprise ; après un emprunt via scan (photo de démo), la vignette apparaît ; Historique après un retour montre les deux photos. Hugo (retardataire) : badge En retard.

- [ ] **Step 7 : Commit**

```bash
git add js/mobile/views/emprunts.js js/mobile/app.js tests/mobile-emprunts.test.mjs
git commit -m "feat(mobile): mes emprunts — en cours, réservations, historique avec photos"
```

---

### Task 7 : Vérification de fin de phase

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

- [ ] **Step 1 : Suite complète et greps**

Run: `npm test`
Expected: `# fail 0`, 142 + 7 + 12 + 8 + 7 + 5 + 3 = **184 tests**.
Run: `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` → rien. `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/mobile.css` → rien.

- [ ] **Step 2 : Scénario de vérification de phase (contrôleur, navigateur)** — celui de la Task 5 Step 6, plus : deux onglets mobile avec deux comptes différents (sessions séparées) ; `index.html` → « Interface mobile » ouvre `mobile.html`.

- [ ] **Step 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 2 — Mobile : self-service` ; remplacer « `mobile.html` (emprunteurs, téléphone) arrive en phase 2 » par « `mobile.html` (emprunteurs, téléphone) est disponible — ouvrir les deux côte à côte pour la démo (sessions séparées par onglet) ». Ajouter sous « Lancer » : « Le scan et la photo utilisent la caméra (autorisation demandée) ; sans caméra, l’écran Scanner propose une simulation et une image de démonstration. » Roadmap : ligne Phase 2 → `` `2026-09-20-phase-2-mobile-self-service.md` (exécuté) ``.

- [ ] **Step 4 : Commit et étiquette**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 2 terminée"
git tag phase-2
```

- [ ] **Step 5 : Rédiger le plan de la phase 3** (`superpowers:writing-plans`, roadmap section Phase 3, spec §5.2 et §6/§7, code réel des phases 0-2) → `docs/superpowers/plans/<date>-phase-3-materiel-valeur.md`.

---

## Auto-revue du plan

**Couverture du spec** — §7 mobile : login (comptes de démo par rôle) → T1 ; accueil (emprunts en cours + retard, prochaine réservation salle, CTA) → T4 (notifications dérivées : retard dans le hero ; expiration/refus arrivent en phase 3 avec les réservations) ; catalogue (recherche, chips, cartes avec badge d'état et pastille circuit) → T4 ; fiche (bouton contextuel par circuit) → T4 ; scanner (caméra + simuler, détection emprunt/retour, photo, confirmation ou mini-checklist, messages d'erreur explicites) → T3 + T5 ; mes emprunts (onglets, photo d'emprunt) → T6 ; profil (changer d'utilisateur, déconnexion) → T1 ; salle et réservation valeur → vues « à venir » (phases 3-4). §5.1 : horaires au retrait, retour toujours possible, 1 exemplaire/référence, photo obligatoire, checklist → signalement + maintenance, refus explicites → T2/T5. §9 photos JPEG 640 px → T3. `manifest.json` → phase 5 (spec §7, dernier paragraphe) — inchangé.

**Placeholders** : aucun.

**Cohérence des noms** : `resolveScan/borrowSelf/returnSelf/userLoans` (T2) ↔ T4 (`userLoans`), T5 (`resolveScan`, `borrowSelf`, `returnSelf`), T6 (`userLoans`) ✔ ; `scanner.js` exports (T3) ↔ T5 ✔ ; `scanFlow` exports (T3) ↔ T5 ✔ ; `setHeader({ title, back })` (T1) ↔ T4-T6 ✔ ; `groupByReference/filterCatalog/availability` (T4) ↔ vues catalogue/fiche ✔ ; `REASONS.CODE_INCONNU` (T2) ↔ tests T2 et `errorHtml` (T5, via `REASON_LABELS`) ✔ ; routes placeholder de `app.js` (T1) remplacées par T4-T6 aux lignes commentées ✔.
