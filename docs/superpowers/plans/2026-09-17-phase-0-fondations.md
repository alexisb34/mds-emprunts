# MDS Emprunts — Phase 0 : Fondations — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** poser les fondations du prototype — tokens visuels issus du Figma, bibliothèque de composants CSS vérifiable dans `kit.html`, couche de données `store.js`, modèle et règles métier testés, données de démo complètes — sans encore aucun écran applicatif.

**Architecture :** modules ES natifs sous `js/`, sans build. `store.js` est la seule couche qui lit/écrit `localStorage` ; `models.js` porte les constantes et transitions ; `rules.js` porte les règles temporelles et d'éligibilité sous forme de fonctions pures ; `seed.js` construit une base de démo cohérente. Les tests tournent sous Node (`node --test`) grâce à un shim `localStorage`/`sessionStorage`.

**Tech Stack :** HTML5, CSS3 (custom properties), JavaScript ES2022 modules, Node ≥ 22 (`node:test`, `node:assert`), `python3 -m http.server`.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — sections 4 (modèle), 5 (règles), 8 (checklists), 9 (architecture, seed).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

## Global Constraints

- Aucun build, aucune dépendance npm installée ; `package.json` sert uniquement à `"type": "module"` et au script `npm test`.
- Interface et libellés 100 % en français ; libellés d'états dans `js/models.js` (`LABELS`).
- Tokens visuels = variables Figma du kit (fichier `pyMDlyt4X8jot1ZeHcXvtk`) ; aucune couleur en dur hors `css/tokens.css`.
- Polices : Inter (corps) et Bricolage Grotesque (titres) via Google Fonts.
- Clé de persistance `mds-emprunts:v1` ; utilisateur courant en `sessionStorage` clé `mds-emprunts:currentUser`.
- Dates stockées en ISO 8601 (`toISOString()`), jours de réservation salle en `YYYY-MM-DD`, créneaux en heures entières (8 = 8h-9h).
- Toutes les fonctions de `rules.js` reçoivent explicitement les données et la date (pas d'accès au store), sauf `now()`.
- Commits fréquents, messages en français avec préfixe `feat:`, `test:`, `chore:`, `docs:`.

---

## Structure de fichiers de la phase

| Fichier | Responsabilité |
|---|---|
| `package.json` | `"type": "module"`, script `test` |
| `.gitignore` | `.DS_Store` |
| `README.md` | Comment servir et tester |
| `index.html` | Page d'accueil : liens Admin / Mobile / Kit |
| `css/tokens.css` | Variables CSS = variables Figma |
| `css/base.css` | Reset, typographie, classes de texte |
| `css/components.css` | Composants réutilisables |
| `kit.html` | Vitrine des composants pour vérification visuelle |
| `js/models.js` | Constantes, transitions, libellés |
| `js/store.js` | Persistance `localStorage`, collections, abonnement |
| `js/rules.js` | Règles temporelles et d'éligibilité (pures) |
| `js/checklists.js` | Checklists par référence |
| `js/seed.js` | Base de démo |
| `js/log.js` | Écriture du journal |
| `js/auth.js` | Utilisateur courant (sessionStorage) |
| `js/ui.js` | Formatage, badges, modale, toast |
| `js/router.js` | Routing `#hash` |
| `tests/helpers/storage.mjs` | Shim `localStorage`/`sessionStorage` pour Node |
| `tests/*.test.mjs` | Un fichier de test par module |

---

### Task 1 : Squelette du projet, tokens et base CSS

**Files:**
- Create: `package.json`, `.gitignore`, `README.md`, `index.html`, `css/tokens.css`, `css/base.css`, `tests/helpers/storage.mjs`, `tests/smoke.test.mjs`

**Interfaces:**
- Produces : les variables CSS listées dans `tokens.css` (utilisées par tous les CSS suivants) ; le shim `tests/helpers/storage.mjs` importé en premier par chaque test.

- [ ] **Step 1 : Créer `package.json` et `.gitignore`**

```json
{
  "name": "mds-emprunts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Prototype de gestion des emprunts de matériel — MDS",
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "serve": "python3 -m http.server 8000"
  }
}
```

`.gitignore` :

```
.DS_Store
```

- [ ] **Step 2 : Créer le shim de stockage pour Node**

`tests/helpers/storage.mjs` :

```js
// Shim localStorage / sessionStorage pour exécuter les modules js/ sous Node.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
}

export function installStorages() {
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, name, {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}

installStorages();
```

- [ ] **Step 3 : Écrire un test de fumée**

`tests/smoke.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('le shim localStorage fonctionne', () => {
  localStorage.setItem('a', '1');
  assert.equal(localStorage.getItem('a'), '1');
  assert.equal(localStorage.getItem('absent'), null);
});
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test`
Expected: `# pass 1`, `# fail 0`

- [ ] **Step 5 : Créer `css/tokens.css`** (valeurs = variables Figma ; les deux lignes marquées « dérivé » n'existent pas dans le kit)

```css
/* Tokens issus du Figma « MDS — UI Kit — Prêt de matériel ». Ne rien coder en dur ailleurs. */
:root {
  /* Marque */
  --brand-primary: #662483;
  --brand-primary-subtle: #f0e9f3;
  --brand-secondary: #2db8c5;
  --brand-secondary-subtle: #e0f5f7;
  --brand-accent: #e71d73;

  /* Texte */
  --text-primary: #3c3c3b;
  --text-secondary: #757678;
  --text-disabled: #c8c9cc;
  --text-inverse: #ffffff;
  --text-brand: #662483;
  --text-on-brand: #ffffff;

  /* Fonds */
  --bg-canvas: #f2f4f8;
  --bg-surface: #ffffff;
  --bg-muted: #e1e2e6;
  --alpha-white-10: rgba(255, 255, 255, 0.1);

  /* Bordures */
  --border-default: #e1e2e6;
  --border-strong: #c8c9cc;
  --border-brand: #662483;
  --stroke-thin: 1px;

  /* Feedback */
  --feedback-success: #47b036;
  --feedback-warning: #faad14;
  --feedback-error: #e63247;

  /* Statuts */
  --status-available-fg: #47b036;
  --status-available-bg: #e8f6e5; /* dérivé */
  --status-borrowed-fg: #662483;
  --status-borrowed-bg: #f0e9f3;
  --status-reserved-fg: #269ca6;
  --status-reserved-bg: #e0f5f7;
  --status-late-fg: #e63247;
  --status-late-bg: #fce4e7;
  --status-maintenance-fg: #faad14;
  --status-maintenance-bg: #fef3d9;
  --status-hs-fg: #757678;      /* dérivé */
  --status-hs-bg: #e1e2e6;      /* dérivé */

  /* Espacements */
  --space-xxs: 2px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
  --space-3xl: 32px;

  /* Rayons */
  --radius-xs: 3px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-pill: 62px;
  --radius-full: 999px;

  /* Tailles */
  --size-sidebar: 260px;
  --size-topbar: 72px;
  --size-control-md: 44px;
  --size-control-sm: 36px;
  --size-avatar-sm: 32px;

  /* Ombres */
  --shadow-card: 0 0 24px -4px rgba(27, 27, 28, 0.18);

  /* Typographie */
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-heading: 'Bricolage Grotesque', var(--font-body);
}
```

- [ ] **Step 6 : Créer `css/base.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Bricolage+Grotesque:wght@800&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 25px;
  color: var(--text-primary);
  background: var(--bg-canvas);
  -webkit-font-smoothing: antialiased;
}
img, svg, video, canvas { display: block; max-width: 100%; }
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; background: none; border: 0; padding: 0; }
a { color: var(--text-brand); text-decoration: none; }
ul { list-style: none; margin: 0; padding: 0; }
h1, h2, h3, h4, h5, h6, p { margin: 0; }

/* Échelle typographique du kit */
.h5 { font-family: var(--font-heading); font-weight: 800; font-size: 24px; line-height: 30px; letter-spacing: -0.5px; }
.h6 { font-family: var(--font-heading); font-weight: 800; font-size: 18px; line-height: 26px; letter-spacing: -0.2px; }
.kpi-number { font-family: var(--font-heading); font-weight: 800; font-size: 40px; line-height: 44px; letter-spacing: -1px; }
.body { font-size: 16px; line-height: 25px; }
.body-bold { font-size: 16px; line-height: 25px; font-weight: 700; }
.body-sm { font-size: 14px; line-height: 21px; }
.body-sm-bold { font-size: 14px; line-height: 21px; font-weight: 700; }
.body-tiny { font-size: 11px; line-height: 16px; }
.label-lg { font-size: 16px; line-height: 20px; font-weight: 700; }
.label-md { font-size: 14px; line-height: 18px; font-weight: 700; }
.label-sm { font-size: 12px; line-height: 16px; font-weight: 700; }
.label-caps { font-size: 11px; line-height: 14px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
.label-mini-caps { font-size: 10px; line-height: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }

.text-secondary { color: var(--text-secondary); }
.text-brand { color: var(--text-brand); }
.text-error { color: var(--feedback-error); }
.text-success { color: var(--feedback-success); }

.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 7 : Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDS Emprunts</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <style>
    main { max-width: 640px; margin: 64px auto; padding: 0 var(--space-2xl); }
    .links { display: grid; gap: var(--space-lg); margin-top: var(--space-3xl); }
    .links a { display: block; padding: var(--space-2xl); background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); color: var(--text-primary); }
    .links a strong { display: block; color: var(--text-brand); }
  </style>
</head>
<body>
  <main>
    <p class="label-caps text-secondary">Prototype</p>
    <h1 class="h5">MDS Emprunts</h1>
    <p class="body text-secondary">Gestion des emprunts de matériel — école MDS.</p>
    <nav class="links">
      <a href="admin.html"><strong class="label-lg">Interface admin</strong><span class="body-sm">Pédagogie — desktop</span></a>
      <a href="mobile.html"><strong class="label-lg">Interface mobile</strong><span class="body-sm">Élèves et intervenants — téléphone</span></a>
      <a href="kit.html"><strong class="label-lg">Kit de composants</strong><span class="body-sm">Vérification visuelle vs Figma</span></a>
    </nav>
  </main>
</body>
</html>
```

- [ ] **Step 8 : Créer `README.md`**

```markdown
# MDS Emprunts

Prototype de gestion des emprunts de matériel (école MDS). HTML/CSS/JS vanilla, données en `localStorage`.

## Lancer

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 — `admin.html` (pédagogie, desktop) et `mobile.html` (emprunteurs, téléphone). La caméra (scan QR, photo) exige `localhost` ou HTTPS.

## Tester

```bash
npm test
```

Aucune dépendance à installer (Node ≥ 22).

## Documentation

- Spec : `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md`
- Feuille de route : `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`
```

- [ ] **Step 9 : Vérifier le rendu**

Run: `python3 -m http.server 8000` puis ouvrir `http://localhost:8000/` dans le navigateur.
Expected : titre « MDS Emprunts » en Bricolage Grotesque, fond `#f2f4f8`, trois cartes blanches ombrées.

- [ ] **Step 10 : Commit**

```bash
git add package.json .gitignore README.md index.html css/ tests/
git commit -m "chore: squelette du projet, tokens Figma et base CSS"
```

---

### Task 2 : `models.js` — constantes, transitions, libellés

**Files:**
- Create: `js/models.js`
- Test: `tests/models.test.mjs`

**Interfaces:**
- Produces : `ROLES`, `PROMOS`, `CIRCUITS`, `CATEGORIES`, `ITEM_STATES`, `LOAN_STATES`, `BOOKING_STATES`, `MAINT_TYPES`, `MAINT_STATES`, `ITEM_TRANSITIONS`, `LOAN_TRANSITIONS`, `BOOKING_TRANSITIONS`, `MAINT_TRANSITIONS`, `canTransition(table, from, to)`, `assertTransition(table, from, to, label)`, `LABELS` (objets `{ valeur: 'Libellé' }` par famille).

- [ ] **Step 1 : Écrire le test**

`tests/models.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, PROMOS, CIRCUITS, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES,
  ITEM_TRANSITIONS, LOAN_TRANSITIONS, BOOKING_TRANSITIONS, MAINT_TRANSITIONS,
  canTransition, assertTransition, LABELS,
} from '../js/models.js';

test('les 9 promos sont définies', () => {
  assert.equal(PROMOS.length, 9);
  assert.ok(PROMOS.includes('MBA 2 UX/UI'));
  assert.ok(PROMOS.includes('Bachelor 1'));
});

test('transitions d’emprunt : reservee → en_cours autorisée, retournee → en_cours interdite', () => {
  assert.equal(canTransition(LOAN_TRANSITIONS, LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS), true);
  assert.equal(canTransition(LOAN_TRANSITIONS, LOAN_STATES.RETOURNEE, LOAN_STATES.EN_COURS), false);
  assert.equal(canTransition(LOAN_TRANSITIONS, 'inconnu', LOAN_STATES.EN_COURS), false);
});

test('assertTransition lève une erreur en français', () => {
  assert.throws(
    () => assertTransition(ITEM_TRANSITIONS, ITEM_STATES.HS, ITEM_STATES.EMPRUNTE, 'matériel'),
    /Transition matériel interdite : hs → emprunte/,
  );
  assert.doesNotThrow(() => assertTransition(ITEM_TRANSITIONS, ITEM_STATES.DISPONIBLE, ITEM_STATES.EMPRUNTE, 'matériel'));
});

test('chaque état a un libellé', () => {
  for (const s of Object.values(ITEM_STATES)) assert.ok(LABELS.itemState[s], `itemState ${s}`);
  for (const s of Object.values(LOAN_STATES)) assert.ok(LABELS.loanState[s], `loanState ${s}`);
  for (const s of Object.values(BOOKING_STATES)) assert.ok(LABELS.bookingState[s], `bookingState ${s}`);
  for (const s of Object.values(MAINT_STATES)) assert.ok(LABELS.maintState[s], `maintState ${s}`);
  for (const c of Object.values(CIRCUITS)) assert.ok(LABELS.circuit[c], `circuit ${c}`);
  for (const r of Object.values(ROLES)) assert.ok(LABELS.role[r], `role ${r}`);
});

test('toutes les tables de transitions couvrent tous leurs états', () => {
  for (const s of Object.values(ITEM_STATES)) assert.ok(Array.isArray(ITEM_TRANSITIONS[s]), s);
  for (const s of Object.values(LOAN_STATES)) assert.ok(Array.isArray(LOAN_TRANSITIONS[s]), s);
  for (const s of Object.values(BOOKING_STATES)) assert.ok(Array.isArray(BOOKING_TRANSITIONS[s]), s);
  for (const s of Object.values(MAINT_STATES)) assert.ok(Array.isArray(MAINT_TRANSITIONS[s]), s);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/models.test.mjs`
Expected: FAIL — `Cannot find module '../js/models.js'`

- [ ] **Step 3 : Écrire `js/models.js`**

```js
// js/models.js — constantes métier, transitions autorisées, libellés français.

export const ROLES = { ELEVE: 'eleve', INTERVENANT: 'intervenant', PEDAGO: 'pedago' };

export const PROMOS = [
  'MBA 2 UX/UI', 'MBA 2 DEV', 'MBA 2 DAD',
  'Bachelor 1', 'Bachelor 2', 'Bachelor 3',
  'MBA 1 UX/UI', 'MBA 1 DEV', 'MBA 1 DAD',
];

export const CIRCUITS = { SELF: 'self', SALLE: 'salle', VALEUR: 'valeur' };

export const CATEGORIES = ['Bureautique', 'Audio', 'Photo', 'Vidéo', 'Lumière', 'Stockage', 'Accessoire'];

export const ITEM_STATES = {
  DISPONIBLE: 'disponible', EMPRUNTE: 'emprunte', RESERVE: 'reserve', MAINTENANCE: 'maintenance', HS: 'hs',
};

export const LOAN_STATES = {
  RESERVEE: 'reservee', EN_COURS: 'en_cours', RETOURNEE: 'retournee',
  REFUSEE: 'refusee', EXPIREE: 'expiree', ANNULEE: 'annulee',
};

export const BOOKING_STATES = { A_VENIR: 'a_venir', EN_COURS: 'en_cours', TERMINEE: 'terminee', ANNULEE: 'annulee' };

export const MAINT_TYPES = {
  SIGNALEMENT: 'signalement', INTERNE: 'intervention_interne',
  EXTERNE: 'intervention_externe', REMISE_EN_SERVICE: 'remise_en_service',
};

export const MAINT_STATES = { OUVERT: 'ouvert', EN_COURS: 'en_cours', CLOS: 'clos' };

export const ITEM_TRANSITIONS = {
  disponible: ['reserve', 'emprunte', 'maintenance', 'hs'],
  reserve: ['disponible', 'emprunte', 'maintenance', 'hs'],
  emprunte: ['disponible', 'maintenance'],
  maintenance: ['disponible', 'hs'],
  hs: ['maintenance', 'disponible'],
};

export const LOAN_TRANSITIONS = {
  reservee: ['en_cours', 'refusee', 'expiree', 'annulee'],
  en_cours: ['retournee'],
  retournee: [], refusee: [], expiree: [], annulee: [],
};

export const BOOKING_TRANSITIONS = {
  a_venir: ['en_cours', 'annulee'],
  en_cours: ['terminee', 'annulee'],
  terminee: [], annulee: [],
};

export const MAINT_TRANSITIONS = {
  ouvert: ['en_cours', 'clos'],
  en_cours: ['clos'],
  clos: [],
};

export function canTransition(table, from, to) {
  return (table[from] || []).includes(to);
}

export function assertTransition(table, from, to, label) {
  if (!canTransition(table, from, to)) {
    throw new Error(`Transition ${label} interdite : ${from} → ${to}`);
  }
}

export const LABELS = {
  role: { eleve: 'Élève', intervenant: 'Intervenant', pedago: 'Pédagogie' },
  circuit: { self: 'Self-service', salle: 'Salle photo', valeur: 'Sur réservation' },
  itemState: { disponible: 'Disponible', emprunte: 'Emprunté', reserve: 'Réservé', maintenance: 'Maintenance', hs: 'Hors service' },
  loanState: { reservee: 'Réservé', en_cours: 'En cours', retournee: 'Retourné', refusee: 'Refusé', expiree: 'Expiré', annulee: 'Annulé' },
  bookingState: { a_venir: 'À venir', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' },
  maintType: { signalement: 'Signalement', intervention_interne: 'Intervention interne', intervention_externe: 'Intervention externe', remise_en_service: 'Remise en service' },
  maintState: { ouvert: 'Ouvert', en_cours: 'En cours', clos: 'Clos' },
};
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/models.test.mjs`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/models.js tests/models.test.mjs
git commit -m "feat: modèle métier — constantes, transitions et libellés"
```

---

### Task 3 : `store.js` — persistance et abonnement

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.mjs`

**Interfaces:**
- Produces : `STORAGE_KEY`, `COLLECTIONS`, `genId(prefix)`, `store.init(seedFn?)`, `store.reset(seedFn?)`, `store.subscribe(fn) → unsubscribe`, `store.settings.get()/update(patch)`, `store.usage() → { bytes, budget, percent }`, et pour chaque collection (`users`, `items`, `loans`, `bookings`, `maintenance`, `log`) : `list(filterFn?)`, `get(id)`, `create(data)`, `update(id, patch)`, `remove(id)`.
- `seedFn` retourne un objet `{ settings: {}, users: [], items: [], loans: [], bookings: [], maintenance: [], log: [] }`.
- Chaque enregistrement créé reçoit `id` (sauf si fourni), `createdAt`, `updatedAt`.

- [ ] **Step 1 : Écrire le test**

`tests/store.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store, STORAGE_KEY, COLLECTIONS, genId } from '../js/store.js';

beforeEach(() => {
  localStorage.clear();
  store.init();
});

test('init crée une base vide et la persiste', () => {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  for (const c of COLLECTIONS) assert.deepEqual(raw[c], []);
  assert.deepEqual(raw.settings, {});
});

test('init avec seedFn charge le seed une seule fois', () => {
  localStorage.clear();
  const seedFn = () => ({ settings: { a: 1 }, users: [{ id: 'u1', nom: 'X' }], items: [], loans: [], bookings: [], maintenance: [], log: [] });
  store.init(seedFn);
  assert.equal(store.users.get('u1').nom, 'X');
  store.users.update('u1', { nom: 'Y' });
  store.init(seedFn); // ne doit pas écraser
  assert.equal(store.users.get('u1').nom, 'Y');
});

test('create ajoute id, createdAt, updatedAt et persiste', () => {
  const u = store.users.create({ nom: 'Dupont' });
  assert.match(u.id, /^user_/);
  assert.ok(u.createdAt);
  assert.equal(u.createdAt, u.updatedAt);
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(raw.users[0].nom, 'Dupont');
});

test('create respecte un id fourni', () => {
  const u = store.users.create({ id: 'user_fixe', nom: 'A' });
  assert.equal(u.id, 'user_fixe');
  assert.equal(store.users.get('user_fixe').nom, 'A');
});

test('get renvoie null si absent', () => {
  assert.equal(store.users.get('nope'), null);
});

test('list renvoie une copie, filtrable', () => {
  store.items.create({ nom: 'A', etat: 'disponible' });
  store.items.create({ nom: 'B', etat: 'hs' });
  const all = store.items.list();
  assert.equal(all.length, 2);
  all.push({});
  assert.equal(store.items.list().length, 2);
  assert.equal(store.items.list((i) => i.etat === 'hs')[0].nom, 'B');
});

test('update fusionne et met à jour updatedAt ; lève si absent', async () => {
  const it = store.items.create({ nom: 'A', etat: 'disponible' });
  await new Promise((r) => setTimeout(r, 5));
  const up = store.items.update(it.id, { etat: 'hs' });
  assert.equal(up.nom, 'A');
  assert.equal(up.etat, 'hs');
  assert.notEqual(up.updatedAt, it.updatedAt);
  assert.throws(() => store.items.update('nope', {}), /introuvable/);
});

test('remove supprime ; lève si absent', () => {
  const it = store.items.create({ nom: 'A' });
  store.items.remove(it.id);
  assert.equal(store.items.get(it.id), null);
  assert.throws(() => store.items.remove(it.id), /introuvable/);
});

test('settings get/update', () => {
  store.settings.update({ horlogeDemo: '2026-09-17T10:00:00.000Z' });
  assert.equal(store.settings.get().horlogeDemo, '2026-09-17T10:00:00.000Z');
});

test('subscribe est notifié à chaque mutation et désabonnable', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  store.users.create({ nom: 'A' });
  store.settings.update({ x: 1 });
  assert.equal(n, 2);
  off();
  store.users.create({ nom: 'B' });
  assert.equal(n, 2);
});

test('reset recharge le seed', () => {
  store.users.create({ nom: 'A' });
  store.reset(() => ({ settings: {}, users: [], items: [], loans: [], bookings: [], maintenance: [], log: [] }));
  assert.equal(store.users.list().length, 0);
});

test('usage renvoie un pourcentage du budget 5 Mo', () => {
  const u = store.usage();
  assert.equal(u.budget, 5 * 1024 * 1024);
  assert.ok(u.bytes > 0);
  assert.ok(u.percent >= 0 && u.percent <= 100);
});

test('genId préfixe et unicité', () => {
  const a = genId('loan');
  const b = genId('loan');
  assert.match(a, /^loan_/);
  assert.notEqual(a, b);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/store.test.mjs`
Expected: FAIL — `Cannot find module '../js/store.js'`

- [ ] **Step 3 : Écrire `js/store.js`**

```js
// js/store.js — SEULE couche qui lit/écrit localStorage.
// En phase 2, ce fichier sera remplacé par une implémentation Supabase aux mêmes signatures.

export const STORAGE_KEY = 'mds-emprunts:v1';
export const COLLECTIONS = ['users', 'items', 'loans', 'bookings', 'maintenance', 'log'];

const ID_PREFIX = { users: 'user', items: 'item', loans: 'loan', bookings: 'book', maintenance: 'maint', log: 'log' };
const BUDGET_BYTES = 5 * 1024 * 1024;

const listeners = new Set();
let db = null;

export function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDb() {
  const d = { settings: {} };
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  db = raw ? JSON.parse(raw) : null;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function notify() {
  for (const fn of listeners) fn();
}

function commit() {
  persist();
  notify();
}

function collection(name) {
  return {
    list(filter) {
      const rows = db[name];
      return filter ? rows.filter(filter) : [...rows];
    },
    get(id) {
      return db[name].find((r) => r.id === id) || null;
    },
    create(data) {
      const ts = new Date().toISOString();
      const { id = genId(ID_PREFIX[name]), ...rest } = data;
      const record = { id, ...rest, createdAt: rest.createdAt || ts, updatedAt: ts };
      db[name].push(record);
      commit();
      return record;
    },
    update(id, patch) {
      const idx = db[name].findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`${name} : enregistrement introuvable (${id})`);
      const record = { ...db[name][idx], ...patch, updatedAt: new Date().toISOString() };
      db[name][idx] = record;
      commit();
      return record;
    },
    remove(id) {
      const before = db[name].length;
      db[name] = db[name].filter((r) => r.id !== id);
      if (db[name].length === before) throw new Error(`${name} : enregistrement introuvable (${id})`);
      commit();
    },
  };
}

export const store = {
  init(seedFn) {
    load();
    if (!db) {
      db = seedFn ? seedFn() : emptyDb();
      persist();
    }
    return db;
  },
  reset(seedFn) {
    db = seedFn ? seedFn() : emptyDb();
    commit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  settings: {
    get() { return { ...db.settings }; },
    update(patch) {
      db.settings = { ...db.settings, ...patch };
      commit();
      return { ...db.settings };
    },
  },
  usage() {
    const bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; // UTF-16
    return { bytes, budget: BUDGET_BYTES, percent: Math.min(100, Math.round((bytes / BUDGET_BYTES) * 100)) };
  },
};

for (const c of COLLECTIONS) store[c] = collection(c);

// Synchronisation entre onglets/fenêtres du même navigateur : l'événement `storage`
// est émis dans les AUTRES onglets quand localStorage change.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      load();
      notify();
    }
  });
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/store.test.mjs`
Expected: `# pass 13`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/store.js tests/store.test.mjs
git commit -m "feat: store localStorage avec collections, settings et abonnement"
```

---

### Task 4 : `rules.js` — règles temporelles et d'éligibilité

**Files:**
- Create: `js/rules.js`
- Test: `tests/rules.test.mjs`

**Interfaces:**
- Consumes : `store.settings.get()` (uniquement dans `now()`), constantes de `models.js`.
- Produces : `DEFAULT_SETTINGS`, `REASONS`, `REASON_LABELS`, `now(settings?)`, `isWeekday(date)`, `isOfficeOpen(date, horaires)`, `atHour(date, h, m?)`, `addDays(date, n)`, `ymd(date)`, `fromYmd('YYYY-MM-DD', hour?)`, `selfReturnDeadline(date, heure?)`, `isLate(loan, date)`, `pickupWindow(loan, minutes?) → { start, end }`, `isInPickupWindow(loan, date, minutes?)`, `isExpired(loan, date, minutes?)`, `bookingStart(b)`, `bookingEnd(b)`, `isBookingActive(b, date)`, `isExitMissing(b, date)`, `slotsAreContiguous(creneaux)`, `slotsInRoomHours(creneaux, salle?)`, `slotsConflict(bookings, date, creneaux, ignoreId?)`, `activeLoans(loans, userId)`, `hasActiveLoanOfReference(loans, items, userId, reference)`, `userHasLateLoan(loans, userId, date)`, `canBorrowSelf({ item, user, loans, items, settings, date }) → { ok, reason }`, `canReserveValeur({ item, user, loans, items, settings, debutPrevu, finPrevue, date }) → { ok, reason }`.
- Toutes les fonctions acceptent des `Date` ou des chaînes ISO ; les créneaux sont des heures entières.

- [ ] **Step 1 : Écrire le test**

`tests/rules.test.mjs` (le 17/09/2026 est un jeudi, le 19/09/2026 un samedi) :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import {
  DEFAULT_SETTINGS, REASONS, REASON_LABELS, now, isWeekday, isOfficeOpen, atHour, addDays, ymd, fromYmd,
  selfReturnDeadline, isLate, pickupWindow, isInPickupWindow, isExpired,
  bookingStart, bookingEnd, isBookingActive, isExitMissing,
  slotsAreContiguous, slotsInRoomHours, slotsConflict,
  hasActiveLoanOfReference, userHasLateLoan, canBorrowSelf, canReserveValeur,
} from '../js/rules.js';

const jeudi10h = new Date(2026, 8, 17, 10, 0);
const samedi10h = new Date(2026, 8, 19, 10, 0);
const S = DEFAULT_SETTINGS;

test('now() respecte l’horloge de démo', () => {
  localStorage.clear();
  store.init();
  assert.ok(Math.abs(now() - Date.now()) < 1000);
  store.settings.update({ horlogeDemo: '2026-09-17T08:00:00.000Z' });
  assert.equal(now().toISOString(), '2026-09-17T08:00:00.000Z');
  assert.equal(now({ horlogeDemo: null }).getFullYear(), new Date().getFullYear());
});

test('jours ouvrés et horaires d’ouverture', () => {
  assert.equal(isWeekday(jeudi10h), true);
  assert.equal(isWeekday(samedi10h), false);
  assert.equal(isOfficeOpen(jeudi10h, S.horaires), true);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 12, 30), S.horaires), false); // pause
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 16, 59), S.horaires), true);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 17, 0), S.horaires), false);
  assert.equal(isOfficeOpen(samedi10h, S.horaires), false);
});

test('utilitaires de dates', () => {
  assert.equal(ymd(jeudi10h), '2026-09-17');
  assert.equal(fromYmd('2026-09-17', 8).getHours(), 8);
  assert.equal(fromYmd('2026-09-17').getDate(), 17);
  assert.equal(addDays(jeudi10h, 3).getDate(), 20);
  assert.equal(atHour(jeudi10h, 17).getHours(), 17);
  assert.equal(atHour(jeudi10h, 17).getMinutes(), 0);
  assert.equal(selfReturnDeadline(jeudi10h).getHours(), 17);
  assert.equal(selfReturnDeadline('2026-09-17T08:00:00.000Z', 16).getHours(), 16);
});

test('retard = en_cours et date > finPrevue', () => {
  const loan = { statut: 'en_cours', finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() };
  assert.equal(isLate(loan, new Date(2026, 8, 17, 16, 59)), false);
  assert.equal(isLate(loan, new Date(2026, 8, 17, 17, 1)), true);
  assert.equal(isLate({ ...loan, statut: 'retournee' }, new Date(2026, 8, 18)), false);
});

test('fenêtre de retrait = [début, début + 60 min]', () => {
  const loan = { statut: 'reservee', debutPrevu: new Date(2026, 8, 17, 9, 0).toISOString() };
  const w = pickupWindow(loan, S.fenetreRetraitMinutes);
  assert.equal(w.start.getHours(), 9);
  assert.equal(w.end.getHours(), 10);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 8, 59), 60), false);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 9, 30), 60), true);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 10, 0), 60), true);
  assert.equal(isExpired(loan, new Date(2026, 8, 17, 10, 0), 60), false);
  assert.equal(isExpired(loan, new Date(2026, 8, 17, 10, 1), 60), true);
  assert.equal(isExpired({ ...loan, statut: 'en_cours' }, new Date(2026, 8, 18), 60), false);
});

test('réservation salle : début, fin, active, sortie non faite', () => {
  const b = { date: '2026-09-17', creneaux: [8, 9, 10, 11, 12], statut: 'a_venir', etatSortie: null };
  assert.equal(bookingStart(b).getHours(), 8);
  assert.equal(bookingEnd(b).getHours(), 13);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 7, 59)), false);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 12, 59)), true);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 13, 0)), false);
  assert.equal(isBookingActive({ ...b, statut: 'annulee' }, new Date(2026, 8, 17, 10)), false);
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 0)), false);
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 1)), true);
  assert.equal(isExitMissing({ ...b, etatSortie: { date: 'x', lignes: [] } }, new Date(2026, 8, 18)), false);
  assert.equal(isExitMissing({ ...b, statut: 'annulee' }, new Date(2026, 8, 18)), false);
});

test('créneaux : contiguïté, plage horaire, conflits', () => {
  assert.equal(slotsAreContiguous([8, 9, 10]), true);
  assert.equal(slotsAreContiguous([10, 8, 9]), true);
  assert.equal(slotsAreContiguous([8, 10]), false);
  assert.equal(slotsAreContiguous([]), false);
  assert.equal(slotsInRoomHours([8, 16], S.salle), true);
  assert.equal(slotsInRoomHours([7], S.salle), false);
  assert.equal(slotsInRoomHours([17], S.salle), false);
  const bookings = [
    { id: 'b1', date: '2026-09-17', creneaux: [9, 10], statut: 'a_venir' },
    { id: 'b2', date: '2026-09-17', creneaux: [14], statut: 'annulee' },
  ];
  assert.equal(slotsConflict(bookings, '2026-09-17', [10, 11]), true);
  assert.equal(slotsConflict(bookings, '2026-09-17', [11, 12]), false);
  assert.equal(slotsConflict(bookings, '2026-09-17', [14]), false); // annulée
  assert.equal(slotsConflict(bookings, '2026-09-18', [9]), false);
  assert.equal(slotsConflict(bookings, '2026-09-17', [9], 'b1'), false); // ignorée
});

const items = [
  { id: 'i1', reference: 'multiprise', circuit: 'self', etat: 'disponible' },
  { id: 'i2', reference: 'multiprise', circuit: 'self', etat: 'disponible' },
  { id: 'i3', reference: 'canon-r10', circuit: 'valeur', etat: 'disponible' },
  { id: 'i4', reference: 'leofoto-trepied', circuit: 'salle', etat: 'disponible' },
];
const user = { id: 'u1', actif: true };

test('un exemplaire par référence et par personne', () => {
  const loans = [{ userId: 'u1', itemId: 'i1', statut: 'en_cours' }];
  assert.equal(hasActiveLoanOfReference(loans, items, 'u1', 'multiprise'), true);
  assert.equal(hasActiveLoanOfReference(loans, items, 'u1', 'canon-r10'), false);
  assert.equal(hasActiveLoanOfReference(loans, items, 'u2', 'multiprise'), false);
  assert.equal(hasActiveLoanOfReference([{ ...loans[0], statut: 'retournee' }], items, 'u1', 'multiprise'), false);
});

test('canBorrowSelf : cas passant et motifs de refus', () => {
  const base = { item: items[0], user, loans: [], items, settings: S, date: jeudi10h };
  assert.deepEqual(canBorrowSelf(base), { ok: true, reason: null });
  assert.equal(canBorrowSelf({ ...base, date: samedi10h }).reason, REASONS.BUREAU_FERME);
  assert.equal(canBorrowSelf({ ...base, item: items[2] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canBorrowSelf({ ...base, item: { ...items[0], etat: 'maintenance' } }).reason, REASONS.INDISPONIBLE);
  assert.equal(canBorrowSelf({ ...base, loans: [{ userId: 'u1', itemId: 'i2', statut: 'en_cours' }] }).reason, REASONS.DEJA_UN_EXEMPLAIRE);
  const late = [{ userId: 'u1', itemId: 'i3', statut: 'en_cours', finPrevue: new Date(2026, 8, 10).toISOString() }];
  assert.equal(canBorrowSelf({ ...base, loans: late }).reason, REASONS.RETARD_EN_COURS);
  assert.equal(canBorrowSelf({ ...base, loans: late, settings: { ...S, bloquerSiRetard: false } }).ok, true);
  assert.equal(canBorrowSelf({ ...base, user: { ...user, actif: false } }).reason, REASONS.UTILISATEUR_INACTIF);
  assert.equal(userHasLateLoan(late, 'u1', jeudi10h), true);
});

test('canReserveValeur : durée max et circuit', () => {
  const debut = new Date(2026, 8, 18, 9);
  const base = { item: items[2], user, loans: [], items, settings: S, debutPrevu: debut, finPrevue: addDays(debut, 3), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, 6) }).reason, REASONS.DUREE_TROP_LONGUE);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, -1) }).reason, REASONS.DUREE_TROP_LONGUE);
  assert.equal(canReserveValeur({ ...base, item: items[0] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...base, item: items[3] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...base, item: { ...items[2], etat: 'reserve' } }).reason, REASONS.INDISPONIBLE);
});

test('chaque motif a un libellé français', () => {
  for (const r of Object.values(REASONS)) assert.ok(REASON_LABELS[r], r);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/rules.test.mjs`
Expected: FAIL — `Cannot find module '../js/rules.js'`

- [ ] **Step 3 : Écrire `js/rules.js`**

```js
// js/rules.js — règles temporelles et d'éligibilité. Fonctions pures : elles reçoivent
// les données et la date en paramètres. Seule now() lit les settings du store.
import { store } from './store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, BOOKING_STATES } from './models.js';

export const DEFAULT_SETTINGS = {
  horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }],
  dureeMaxReservationJours: 5,
  fenetreRetraitMinutes: 60,
  bloquerSiRetard: true,
  horlogeDemo: null, // ISO string ou null = temps réel
  heureRetourSelf: 17,
  salle: { heureDebut: 8, heureFin: 17 }, // créneaux 8 … 16 (16 = 16h-17h)
};

export const REASONS = {
  BUREAU_FERME: 'bureau_ferme',
  DEJA_UN_EXEMPLAIRE: 'deja_un_exemplaire',
  INDISPONIBLE: 'indisponible',
  RETARD_EN_COURS: 'retard_en_cours',
  MAUVAIS_CIRCUIT: 'mauvais_circuit',
  DUREE_TROP_LONGUE: 'duree_trop_longue',
  UTILISATEUR_INACTIF: 'utilisateur_inactif',
};

export const REASON_LABELS = {
  bureau_ferme: 'Le bureau des pédago est fermé : retrait possible uniquement aux heures d’ouverture.',
  deja_un_exemplaire: 'Vous avez déjà un exemplaire de ce matériel en cours.',
  indisponible: 'Ce matériel n’est pas disponible actuellement.',
  retard_en_cours: 'Vous avez un emprunt en retard : rendez-le avant d’emprunter à nouveau.',
  mauvais_circuit: 'Ce matériel ne s’emprunte pas de cette façon.',
  duree_trop_longue: 'La durée demandée dépasse le maximum autorisé.',
  utilisateur_inactif: 'Ce compte est désactivé.',
};

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const toDate = (d) => (d instanceof Date ? d : new Date(d));

export function now(settings) {
  const s = settings || store.settings.get();
  return s.horlogeDemo ? new Date(s.horlogeDemo) : new Date();
}

export function isWeekday(date) {
  const w = toDate(date).getDay();
  return w >= 1 && w <= 5;
}

export function isOfficeOpen(date, horaires = DEFAULT_SETTINGS.horaires) {
  const d = toDate(date);
  if (!isWeekday(d)) return false;
  const h = d.getHours() + d.getMinutes() / 60;
  return horaires.some((r) => h >= r.debut && h < r.fin);
}

export function atHour(date, hour, minute = 0) {
  const d = new Date(toDate(date));
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(toDate(date));
  d.setDate(d.getDate() + n);
  return d;
}

export function ymd(date) {
  const d = toDate(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromYmd(s, hour = 0) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

export function selfReturnDeadline(date, heureRetourSelf = DEFAULT_SETTINGS.heureRetourSelf) {
  return atHour(date, heureRetourSelf);
}

// ---- Emprunts ----

export function isLate(loan, date) {
  return loan.statut === LOAN_STATES.EN_COURS && toDate(date) > new Date(loan.finPrevue);
}

export function pickupWindow(loan, fenetreRetraitMinutes = DEFAULT_SETTINGS.fenetreRetraitMinutes) {
  const start = new Date(loan.debutPrevu);
  return { start, end: new Date(start.getTime() + fenetreRetraitMinutes * MIN) };
}

export function isInPickupWindow(loan, date, minutes) {
  const { start, end } = pickupWindow(loan, minutes);
  const d = toDate(date);
  return d >= start && d <= end;
}

export function isExpired(loan, date, minutes) {
  return loan.statut === LOAN_STATES.RESERVEE && toDate(date) > pickupWindow(loan, minutes).end;
}

// ---- Salle photo ----

export function bookingStart(b) {
  return fromYmd(b.date, Math.min(...b.creneaux));
}

export function bookingEnd(b) {
  return fromYmd(b.date, Math.max(...b.creneaux) + 1);
}

export function isBookingActive(b, date) {
  if (b.statut === BOOKING_STATES.ANNULEE || b.statut === BOOKING_STATES.TERMINEE) return false;
  const d = toDate(date);
  return d >= bookingStart(b) && d < bookingEnd(b);
}

export function isExitMissing(b, date) {
  if (b.statut === BOOKING_STATES.ANNULEE || b.etatSortie) return false;
  return toDate(date) > new Date(bookingEnd(b).getTime() + 60 * MIN);
}

export function slotsAreContiguous(creneaux) {
  if (!creneaux || creneaux.length === 0) return false;
  const s = [...creneaux].sort((a, b) => a - b);
  return s.every((v, i) => i === 0 || v === s[i - 1] + 1);
}

export function slotsInRoomHours(creneaux, salle = DEFAULT_SETTINGS.salle) {
  return creneaux.every((h) => Number.isInteger(h) && h >= salle.heureDebut && h < salle.heureFin);
}

export function slotsConflict(bookings, date, creneaux, ignoreId = null) {
  return bookings.some(
    (b) => b.id !== ignoreId
      && b.date === date
      && b.statut !== BOOKING_STATES.ANNULEE
      && b.creneaux.some((h) => creneaux.includes(h)),
  );
}

// ---- Éligibilité ----

const ACTIVE_LOAN_STATES = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

export function activeLoans(loans, userId) {
  return loans.filter((l) => l.userId === userId && ACTIVE_LOAN_STATES.includes(l.statut));
}

export function hasActiveLoanOfReference(loans, items, userId, reference) {
  const refOf = new Map(items.map((i) => [i.id, i.reference]));
  return activeLoans(loans, userId).some((l) => refOf.get(l.itemId) === reference);
}

export function userHasLateLoan(loans, userId, date) {
  return loans.some((l) => l.userId === userId && isLate(l, date));
}

function commonChecks({ item, user, loans, items, settings, date, circuit }) {
  if (!user || user.actif === false) return REASONS.UTILISATEUR_INACTIF;
  if (item.circuit !== circuit) return REASONS.MAUVAIS_CIRCUIT;
  if (item.etat !== ITEM_STATES.DISPONIBLE) return REASONS.INDISPONIBLE;
  if (circuit === CIRCUITS.SELF && !isOfficeOpen(date, settings.horaires)) return REASONS.BUREAU_FERME;
  if (hasActiveLoanOfReference(loans, items, user.id, item.reference)) return REASONS.DEJA_UN_EXEMPLAIRE;
  if (settings.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return REASONS.RETARD_EN_COURS;
  return null;
}

export function canBorrowSelf(ctx) {
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.SELF });
  return { ok: reason === null, reason };
}

export function canReserveValeur(ctx) {
  const { debutPrevu, finPrevue, settings } = ctx;
  const days = (toDate(finPrevue) - toDate(debutPrevu)) / DAY;
  if (days < 0 || days > settings.dureeMaxReservationJours) {
    return { ok: false, reason: REASONS.DUREE_TROP_LONGUE };
  }
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.VALEUR });
  return { ok: reason === null, reason };
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/rules.test.mjs`
Expected: `# pass 11`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/rules.js tests/rules.test.mjs
git commit -m "feat: règles temporelles et d'éligibilité (horaires, retards, fenêtre de retrait, salle)"
```

---

### Task 5 : `checklists.js` — checklists par référence

**Files:**
- Create: `js/checklists.js`
- Test: `tests/checklists.test.mjs`

**Interfaces:**
- Produces : `CHECKLISTS` (`{ reference: [lignes] }`), `SALLE_GLOBAL_LINE`, `checklistFor(reference) → string[]`, `buildChecklist(reference) → [{ ligne, ok: true, commentaire: '' }]`, `buildRoomChecklist(itemsSalle) → [{ itemId, ligne, ok, commentaire }]`, `hasProblem(checklist) → bool`, `problemLines(checklist) → lignes en problème`.

- [ ] **Step 1 : Écrire le test**

`tests/checklists.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKLISTS, SALLE_GLOBAL_LINE, checklistFor, buildChecklist, buildRoomChecklist, hasProblem, problemLines } from '../js/checklists.js';

const REFERENCES = [
  'multiprise', 'kit-tableau', 'casque-audio', 'clavier', 'souris',
  'newer-eclairage', 'newer-led', 'leofoto-trepied', 'mini-studio', 'sac-beschoi',
  'canon-r10', 'dji-rsc2', 'tascam-dr70', 'zoom-h5', 'sd-256', 'sd-32', 'lpe17', 'hoya-nd', 'sennheiser', 'at-streaming',
];

test('toutes les références du spec ont une checklist non vide', () => {
  for (const r of REFERENCES) assert.ok(CHECKLISTS[r]?.length > 0, r);
});

test('kit tableau : 4 lignes dont les stylos', () => {
  const lines = checklistFor('kit-tableau');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /4 stylos/);
});

test('checklistFor renvoie [] pour une référence inconnue', () => {
  assert.deepEqual(checklistFor('inconnu'), []);
});

test('buildChecklist initialise toutes les lignes à OK', () => {
  const c = buildChecklist('multiprise');
  assert.equal(c.length, 3);
  assert.deepEqual(c[0], { ligne: 'Câble intact', ok: true, commentaire: '' });
  assert.equal(hasProblem(c), false);
});

test('hasProblem et problemLines', () => {
  const c = buildChecklist('souris');
  c[0].ok = false; c[0].commentaire = 'clic gauche mort';
  assert.equal(hasProblem(c), true);
  assert.deepEqual(problemLines(c).map((l) => l.ligne), ['Clic et molette OK']);
});

test('buildRoomChecklist : une ligne par item salle + ligne globale', () => {
  const items = [
    { id: 'i1', reference: 'leofoto-trepied', nom: 'Trépied LeoFoto' },
    { id: 'i2', reference: 'sac-beschoi', nom: 'Sac à dos Beschoi' },
  ];
  const c = buildRoomChecklist(items);
  assert.equal(c.length, 3);
  assert.equal(c[0].itemId, 'i1');
  assert.match(c[0].ligne, /^Trépied LeoFoto — /);
  assert.equal(c[2].itemId, null);
  assert.equal(c[2].ligne, SALLE_GLOBAL_LINE);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/checklists.test.mjs`
Expected: FAIL — `Cannot find module '../js/checklists.js'`

- [ ] **Step 3 : Écrire `js/checklists.js`**

```js
// js/checklists.js — checklists de retour / état des lieux, indexées par référence d'objet.
// Modifiable sans toucher aux vues. En phase 2 produit : éditable depuis Paramètres.

export const CHECKLISTS = {
  // Self-service (mini-checklist mobile)
  'multiprise': ['Câble intact', 'Toutes les prises fonctionnent', 'Interrupteur OK'],
  'kit-tableau': ['4 stylos présents (bleu, noir, vert, rouge)', 'Télécommande vidéoprojecteur présente', 'Brosse présente', 'Boîte fermée'],
  'casque-audio': ['Son des deux côtés', 'Câble / jack intact', 'Mousses présentes'],
  'clavier': ['Toutes les touches présentes', 'Câble / récepteur USB présent'],
  'souris': ['Clic et molette OK', 'Câble / récepteur USB présent'],

  // Salle photo (état des lieux entrée / sortie) — une ligne résumée par objet
  'newer-eclairage': ['2 pieds, 2 softbox, 2 ampoules OK'],
  'newer-led': ['Panneau, batteries (nombre), chargeur'],
  'leofoto-trepied': ['3 sections, tête fluide, plateau rapide'],
  'mini-studio': ['Tente, fonds, éclairage intégré'],
  'sac-beschoi': ['Présent, fermetures OK'],

  // Matériel de valeur (checklist complète admin)
  'canon-r10': ['Boîtier', 'Objectif 18-55', 'Bague', 'Bouchons', 'Batterie', 'Carte SD retirée', 'Capteur / objectif propres', 'Allumage OK', 'Nombre de déclenchements (optionnel)'],
  'dji-rsc2': ['Stabilisateur', 'Plateau', 'Vis / accessoires', 'Batterie chargée', 'Allumage et calibration OK', 'Mallette'],
  'tascam-dr70': ['Enregistreur', 'Capsule / bonnette', 'Câbles', 'Piles / batterie', 'Carte SD retirée', 'Test d’enregistrement OK'],
  'zoom-h5': ['Enregistreur', 'Capsule / bonnette', 'Câbles', 'Piles / batterie', 'Carte SD retirée', 'Test d’enregistrement OK'],
  'sd-256': ['Présente', 'Vidée / formatée', 'Verrou intact'],
  'sd-32': ['Présente', 'Vidée / formatée', 'Verrou intact'],
  'lpe17': ['Présente', 'Chargée', 'Pas de gonflement'],
  'hoya-nd': ['Verre sans rayure', 'Bague tourne', 'Étui'],
  'sennheiser': ['Son', 'Câble', 'Mousses', 'Étui'],
  'at-streaming': ['Micro', 'Bras / pied', 'Câble XLR / USB', 'Interface', 'Test audio OK'],
};

export const SALLE_GLOBAL_LINE = 'Salle rangée, rien d’anormal';

export function checklistFor(reference) {
  return CHECKLISTS[reference] ? [...CHECKLISTS[reference]] : [];
}

export function buildChecklist(reference) {
  return checklistFor(reference).map((ligne) => ({ ligne, ok: true, commentaire: '' }));
}

export function buildRoomChecklist(itemsSalle) {
  const lines = itemsSalle.map((item) => ({
    itemId: item.id,
    ligne: `${item.nom} — ${checklistFor(item.reference).join(', ') || 'présent et OK'}`,
    ok: true,
    commentaire: '',
  }));
  lines.push({ itemId: null, ligne: SALLE_GLOBAL_LINE, ok: true, commentaire: '' });
  return lines;
}

export function hasProblem(checklist) {
  return checklist.some((l) => l.ok === false);
}

export function problemLines(checklist) {
  return checklist.filter((l) => l.ok === false);
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/checklists.test.mjs`
Expected: `# pass 6`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/checklists.js tests/checklists.test.mjs
git commit -m "feat: checklists de retour et d'état des lieux par référence"
```

---

### Task 6 : `seed.js` — données de démo

**Files:**
- Create: `js/seed.js`
- Test: `tests/seed.test.mjs`

**Interfaces:**
- Consumes : `models.js`, `rules.js` (`DEFAULT_SETTINGS`, `addDays`, `atHour`, `ymd`, `isWeekday`), `checklists.js` (`buildChecklist`, `buildRoomChecklist`).
- Produces : `ELEVES`, `INTERVENANTS`, `PEDAGO` (tableaux `[prenom, nom]`), `CATALOG` (tableau `[reference, nom, categorie, circuit, exemplaires, valeurEstimee, localisation]`), `buildSeed(now = new Date()) → db` (objet complet attendu par `store.init`). Déterministe pour un `now` donné.

- [ ] **Step 1 : Écrire le test**

`tests/seed.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed, CATALOG } from '../js/seed.js';
import { PROMOS, ROLES, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES } from '../js/models.js';
import { DEFAULT_SETTINGS, isLate, isWeekday, slotsAreContiguous, slotsInRoomHours, fromYmd } from '../js/rules.js';
import { CHECKLISTS } from '../js/checklists.js';

const NOW = new Date(2026, 8, 17, 10, 0); // jeudi
const db = buildSeed(NOW);

test('45 utilisateurs : 30 élèves, 10 intervenants, 5 pédago, emails uniques', () => {
  assert.equal(db.users.length, 45);
  const by = (r) => db.users.filter((u) => u.role === r);
  assert.equal(by(ROLES.ELEVE).length, 30);
  assert.equal(by(ROLES.INTERVENANT).length, 10);
  assert.equal(by(ROLES.PEDAGO).length, 5);
  for (const u of by(ROLES.ELEVE)) assert.ok(PROMOS.includes(u.promo), u.promo);
  for (const u of [...by(ROLES.INTERVENANT), ...by(ROLES.PEDAGO)]) assert.equal(u.promo, null);
  assert.equal(new Set(db.users.map((u) => u.email)).size, 45);
  assert.ok(db.users.every((u) => u.actif === true && u.createdAt && u.updatedAt));
});

test('inventaire complet : 44 exemplaires, codes uniques, chaque référence a une checklist', () => {
  const expected = CATALOG.reduce((n, c) => n + c[4], 0);
  assert.equal(expected, 44);
  assert.equal(db.items.length, 44);
  assert.equal(new Set(db.items.map((i) => i.code)).size, 44);
  assert.equal(db.items[0].code, 'MDS-0001');
  for (const i of db.items) assert.ok(CHECKLISTS[i.reference], i.reference);
  assert.equal(db.items.filter((i) => i.circuit === 'self').length, 23);
  assert.equal(db.items.filter((i) => i.circuit === 'salle').length, 5);
  assert.equal(db.items.filter((i) => i.circuit === 'valeur').length, 16);
});

test('cohérence emprunts ↔ états du matériel', () => {
  const item = (id) => db.items.find((i) => i.id === id);
  for (const l of db.loans) {
    if (l.statut === LOAN_STATES.EN_COURS) assert.equal(item(l.itemId).etat, ITEM_STATES.EMPRUNTE, l.id);
    if (l.statut === LOAN_STATES.RESERVEE) assert.equal(item(l.itemId).etat, ITEM_STATES.RESERVE, l.id);
    assert.ok(db.users.some((u) => u.id === l.userId), `userId ${l.userId}`);
  }
  const active = db.loans.filter((l) => [LOAN_STATES.EN_COURS, LOAN_STATES.RESERVEE].includes(l.statut));
  assert.equal(new Set(active.map((l) => l.itemId)).size, active.length, 'un seul emprunt actif par objet');
  for (const i of db.items.filter((i) => i.etat === ITEM_STATES.EMPRUNTE)) {
    assert.equal(active.filter((l) => l.itemId === i.id && l.statut === LOAN_STATES.EN_COURS).length, 1, i.code);
  }
});

test('volumes : ~40 retournés, 8 en cours dont 2 en retard, 2 réservés', () => {
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.RETOURNEE).length, 41); // 40 générés + 1 retour avec problème
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length, 10);  // 6 self + 2 valeur + 2 en retard
  assert.equal(db.loans.filter((l) => isLate(l, NOW)).length, 2);
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).length, 2);
  assert.ok(db.loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).every((l) => l.codeRetrait?.length === 6));
});

test('maintenance : 1 objet en maintenance avec signalement ouvert, 1 HS, 1 intervention externe close', () => {
  const enMaint = db.items.filter((i) => i.etat === ITEM_STATES.MAINTENANCE);
  assert.equal(enMaint.length, 1);
  assert.ok(db.maintenance.some((m) => m.itemId === enMaint[0].id && m.statut === MAINT_STATES.OUVERT));
  assert.equal(db.items.filter((i) => i.etat === ITEM_STATES.HS).length, 1);
  assert.ok(db.maintenance.some((m) => m.type === 'intervention_externe' && m.statut === MAINT_STATES.CLOS && m.prestataire));
});

test('réservations salle : jours ouvrés, créneaux contigus dans la plage, une en cours à 10h le jeudi', () => {
  assert.ok(db.bookings.length >= 5);
  for (const b of db.bookings) {
    assert.ok(isWeekday(fromYmd(b.date)), b.date);
    assert.ok(slotsAreContiguous(b.creneaux), b.id);
    assert.ok(slotsInRoomHours(b.creneaux, DEFAULT_SETTINGS.salle), b.id);
    assert.ok(db.users.some((u) => u.id === b.userId));
  }
  const enCours = db.bookings.filter((b) => b.statut === BOOKING_STATES.EN_COURS);
  assert.equal(enCours.length, 1);
  assert.equal(enCours[0].date, '2026-09-17');
  assert.ok(enCours[0].creneaux.includes(10));
  assert.ok(enCours[0].etatEntree);
  assert.equal(enCours[0].etatSortie, null);
  assert.equal(db.bookings.filter((b) => b.statut === BOOKING_STATES.TERMINEE).length, 2);
  assert.equal(db.bookings.filter((b) => b.statut === BOOKING_STATES.A_VENIR).length, 3);
});

test('journal non vide, entrées datées et référencées ; settings = défauts', () => {
  assert.ok(db.log.length > 80);
  for (const e of db.log) {
    assert.ok(e.date && e.action && e.auteurId, e.id);
    assert.ok(e.itemId || e.loanId || e.bookingId || e.userId, `${e.id} sans référence`);
  }
  assert.deepEqual(db.settings, DEFAULT_SETTINGS);
});

test('buildSeed est déterministe pour un même now', () => {
  assert.equal(JSON.stringify(buildSeed(NOW)), JSON.stringify(db));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/seed.test.mjs`
Expected: FAIL — `Cannot find module '../js/seed.js'`

- [ ] **Step 3 : Écrire `js/seed.js`**

```js
// js/seed.js — base de démo cohérente, construite relativement à `now`.
// Tous les noms sont fictifs (sauf la personne pédago n°1, propriétaire du prototype).
import { ROLES, PROMOS, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_TYPES, MAINT_STATES } from './models.js';
import { DEFAULT_SETTINGS, addDays, atHour, ymd, isWeekday } from './rules.js';
import { buildChecklist, buildRoomChecklist } from './checklists.js';

export const ELEVES = [
  ['Léa', 'Pezzetti'], ['Yann', 'Guihard'], ['Camille', 'Dubois'], ['Nathan', 'Lefebvre'], ['Inès', 'Moreau'],
  ['Lucas', 'Fontaine'], ['Chloé', 'Martin'], ['Théo', 'Garnier'], ['Manon', 'Roux'], ['Hugo', 'Bernard'],
  ['Sarah', 'Lambert'], ['Enzo', 'Petit'], ['Jade', 'Morel'], ['Louis', 'Girard'], ['Emma', 'Rousseau'],
  ['Mathis', 'Leroy'], ['Zoé', 'Fournier'], ['Tom', 'Mercier'], ['Lina', 'Blanc'], ['Adam', 'Guérin'],
  ['Anaïs', 'Muller'], ['Rayan', 'Henry'], ['Clara', 'Perrin'], ['Noah', 'Faure'], ['Maëlle', 'André'],
  ['Sacha', 'Lemoine'], ['Romane', 'Chevalier'], ['Ethan', 'Robin'], ['Lucie', 'Gauthier'], ['Mehdi', 'Benali'],
];

export const INTERVENANTS = [
  ['Sophie', 'Marchand'], ['Julien', 'Caron'], ['Nadia', 'Ferreira'], ['Marc', 'Delorme'], ['Aurélie', 'Vidal'],
  ['Karim', 'Haddad'], ['Céline', 'Baptiste'], ['Olivier', 'Renard'], ['Isabelle', 'Toussaint'], ['Frédéric', 'Lacombe'],
];

export const PEDAGO = [
  ['Alexis', 'Bengel'], ['Amandine', 'Leclerc'], ['Bastien', 'Morin'], ['Élodie', 'Rey'], ['Thomas', 'Picard'],
];

export const CATALOG = [
  // [reference, nom, categorie, circuit, exemplaires, valeurEstimee, localisation]
  ['multiprise', 'Multiprise', 'Bureautique', 'self', 6, 15, 'Bureau pédago'],
  ['kit-tableau', 'Kit tableau blanc', 'Bureautique', 'self', 4, 40, 'Bureau pédago'],
  ['casque-audio', 'Casque audio', 'Audio', 'self', 5, 35, 'Bureau pédago'],
  ['clavier', 'Clavier', 'Bureautique', 'self', 4, 25, 'Bureau pédago'],
  ['souris', 'Souris', 'Bureautique', 'self', 4, 15, 'Bureau pédago'],
  ['newer-eclairage', 'Newer kit éclairage', 'Lumière', 'salle', 1, 180, 'Salle photo'],
  ['newer-led', 'Newer pack LED + batteries', 'Lumière', 'salle', 1, 120, 'Salle photo'],
  ['leofoto-trepied', 'Trépied et tête fluide LeoFoto', 'Vidéo', 'salle', 1, 350, 'Salle photo'],
  ['mini-studio', 'Mini studio photo produit', 'Photo', 'salle', 1, 90, 'Salle photo'],
  ['sac-beschoi', 'Sac à dos Beschoi', 'Accessoire', 'salle', 1, 60, 'Salle photo'],
  ['canon-r10', 'Canon R10 + objectif 18-55 + bague', 'Photo', 'valeur', 1, 1100, 'Armoire sécurisée'],
  ['dji-rsc2', 'DJI Ronin RSC2 stabilisateur', 'Vidéo', 'valeur', 1, 450, 'Armoire sécurisée'],
  ['tascam-dr70', 'Tascam DR-70 enregistreur', 'Audio', 'valeur', 1, 280, 'Armoire sécurisée'],
  ['zoom-h5', 'Zoom H5 enregistreur', 'Audio', 'valeur', 1, 300, 'Armoire sécurisée'],
  ['sd-256', 'Carte SD 256 Go', 'Stockage', 'valeur', 3, 45, 'Armoire sécurisée'],
  ['sd-32', 'Carte SD 32 Go', 'Stockage', 'valeur', 3, 15, 'Armoire sécurisée'],
  ['lpe17', 'Batterie Canon LP-E17', 'Accessoire', 'valeur', 3, 60, 'Armoire sécurisée'],
  ['hoya-nd', 'Filtre variable Hoya', 'Photo', 'valeur', 1, 80, 'Armoire sécurisée'],
  ['sennheiser', 'Casque Sennheiser', 'Audio', 'valeur', 1, 120, 'Armoire sécurisée'],
  ['at-streaming', 'Audio-Technica kit de streaming', 'Audio', 'valeur', 1, 250, 'Armoire sécurisée'],
];

const iso = (d) => d.toISOString();
const pad = (n, w) => String(n).padStart(w, '0');

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Dernier jour ouvré ≤ date (à 9h)
function lastWeekday(date) {
  let d = atHour(date, 9);
  while (!isWeekday(d)) d = addDays(d, -1);
  return d;
}

// n-ième jour ouvré strictement après date (à 9h)
function nextWeekday(date, n) {
  let d = atHour(date, 9);
  let count = 0;
  while (count < n) {
    d = addDays(d, 1);
    if (isWeekday(d)) count++;
  }
  return d;
}

function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildSeed(now = new Date()) {
  const rand = makeRandom(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(rand() * 31)]).join('');

  const db = { settings: { ...DEFAULT_SETTINGS, salle: { ...DEFAULT_SETTINGS.salle }, horaires: DEFAULT_SETTINGS.horaires.map((h) => ({ ...h })) },
    users: [], items: [], loans: [], bookings: [], maintenance: [], log: [] };

  const t0 = iso(addDays(now, -90));
  const base = lastWeekday(now); // jour ouvré de référence pour « aujourd'hui »

  const addLog = (date, auteurId, action, refs, detail) => {
    db.log.push({
      id: `log_${pad(db.log.length + 1, 4)}`, date: iso(date), auteurId, action,
      itemId: null, loanId: null, bookingId: null, userId: null, ...refs, detail,
      createdAt: iso(date), updatedAt: iso(date),
    });
  };

  // ---- Utilisateurs ----
  const mkUser = (n, [prenom, nom], role, promo) => ({
    id: `user_${pad(n, 3)}`, prenom, nom, email: `${slug(prenom)}.${slug(nom)}@mds-demo.fr`,
    role, promo, actif: true, createdAt: t0, updatedAt: t0,
  });
  ELEVES.forEach((p, i) => db.users.push(mkUser(i + 1, p, ROLES.ELEVE, PROMOS[i % PROMOS.length])));
  INTERVENANTS.forEach((p, i) => db.users.push(mkUser(31 + i, p, ROLES.INTERVENANT, null)));
  PEDAGO.forEach((p, i) => db.users.push(mkUser(41 + i, p, ROLES.PEDAGO, null)));
  const pedagos = db.users.filter((u) => u.role === ROLES.PEDAGO);
  const emprunteurs = db.users.filter((u) => u.role !== ROLES.PEDAGO);
  const ped0 = pedagos[0];

  // ---- Matériel ----
  let n = 0;
  for (const [reference, nom, categorie, circuit, count, valeurEstimee, localisation] of CATALOG) {
    for (let k = 1; k <= count; k++) {
      n++;
      db.items.push({
        id: `item_${pad(n, 3)}`, code: `MDS-${pad(n, 4)}`, nom: count > 1 ? `${nom} #${k}` : nom,
        reference, categorie, circuit, etat: ITEM_STATES.DISPONIBLE, localisation,
        dateAchat: '2025-09-01', valeurEstimee, notes: '', photoUrl: '', createdAt: t0, updatedAt: t0,
      });
    }
  }
  const byRef = (ref) => db.items.filter((i) => i.reference === ref);
  const item = (ref, k = 0) => byRef(ref)[k];
  const selfRefs = CATALOG.filter((c) => c[3] === 'self').map((c) => c[0]);
  const valeurRefs = CATALOG.filter((c) => c[3] === 'valeur').map((c) => c[0]);
  const salleItems = db.items.filter((i) => i.circuit === 'salle');

  // ---- Emprunts ----
  const addLoan = (fields) => {
    const l = {
      id: `loan_${pad(db.loans.length + 1, 3)}`, motif: '', motifRefus: '', codeRetrait: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
      remisPar: null, receptionnePar: null, dateRetrait: null, dateRetourReelle: null, ...fields,
    };
    db.loans.push(l);
    return l;
  };
  const who = (u) => `${u.prenom} ${u.nom}`;

  // 40 emprunts passés, retournés sans problème (30 self, 10 valeur) sur les 60 derniers jours
  for (let i = 0; i < 40; i++) {
    const isSelf = i % 4 !== 0;
    const ref = isSelf ? pick(selfRefs) : pick(valeurRefs);
    const it = pick(byRef(ref));
    const user = pick(emprunteurs);
    const day = lastWeekday(addDays(base, -(60 - i)));
    const start = atHour(day, 9 + Math.floor(rand() * 3), 15);
    const end = isSelf ? atHour(day, 16, 30) : atHour(addDays(day, 1 + Math.floor(rand() * 3)), 15);
    const ped = pick(pedagos);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RETOURNEE,
      dateReservation: iso(isSelf ? start : addDays(start, -2)), debutPrevu: iso(start),
      finPrevue: iso(isSelf ? atHour(day, 17) : end), dateRetrait: iso(start), dateRetourReelle: iso(end),
      remisPar: isSelf ? null : ped.id, receptionnePar: isSelf ? null : ped.id,
      checklistRetour: buildChecklist(ref), createdAt: iso(start), updatedAt: iso(end),
    });
    addLog(start, isSelf ? user.id : ped.id, isSelf ? 'loan.emprunt' : 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(end, isSelf ? user.id : ped.id, 'loan.retour', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} rendu`);
  }

  // 6 emprunts self en cours aujourd'hui
  [['multiprise', 0], ['multiprise', 1], ['kit-tableau', 0], ['casque-audio', 0], ['clavier', 0], ['souris', 0]].forEach(([ref, k], i) => {
    const it = item(ref, k);
    const user = emprunteurs[i * 3];
    const start = atHour(base, 8 + (i % 4), 5 + i * 7);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(base, 17)), dateRetrait: iso(start), createdAt: iso(start), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  });

  // 2 emprunts valeur en cours (dans les temps)
  [['canon-r10', -1, 2, 'Tournage projet MBA'], ['zoom-h5', -2, 1, 'Interview podcast']].forEach(([ref, dStart, dEnd, motif], i) => {
    const it = item(ref);
    const user = emprunteurs[20 + i];
    const start = atHour(addDays(base, dStart), 10);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, motif, codeRetrait: code6(),
      dateReservation: iso(addDays(start, -3)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(base, dEnd), 15)),
      dateRetrait: iso(atHour(start, 10, 12)), remisPar: ped0.id, createdAt: iso(addDays(start, -3)), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(addDays(start, -3), user.id, 'loan.reservee', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(start, ped0.id, 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} remis à ${who(user)}`);
  });

  // 2 emprunts en retard : un valeur (DJI, fin il y a 3 jours), un self (casque #2, hier 17h)
  {
    const it = item('dji-rsc2');
    const user = emprunteurs[25];
    const start = atHour(addDays(base, -6), 9);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, motif: 'Clip vidéo association', codeRetrait: code6(),
      dateReservation: iso(addDays(start, -4)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(base, -3), 17)),
      dateRetrait: iso(atHour(start, 9, 20)), remisPar: pedagos[1].id, createdAt: iso(addDays(start, -4)), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, pedagos[1].id, 'loan.remise', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} remis à ${who(user)}`);
  }
  {
    const it = item('casque-audio', 1);
    const user = emprunteurs[27];
    const day = lastWeekday(addDays(base, -1));
    const start = atHour(day, 9, 40);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.EN_COURS, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(day, 17)), dateRetrait: iso(start), createdAt: iso(start), updatedAt: iso(start),
    });
    it.etat = ITEM_STATES.EMPRUNTE;
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  }

  // 2 réservations valeur à venir
  [['tascam-dr70', 1, 2, 'Captation conférence'], ['sennheiser', 2, 1, 'Montage son']].forEach(([ref, nStart, dLen, motif], i) => {
    const it = item(ref);
    const user = emprunteurs[10 + i];
    const start = atHour(nextWeekday(base, nStart), 9 + i);
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RESERVEE, motif, codeRetrait: code6(),
      dateReservation: iso(atHour(base, 9, 30 + i)), debutPrevu: iso(start), finPrevue: iso(atHour(addDays(start, dLen), 17)),
      createdAt: iso(atHour(base, 9, 30 + i)), updatedAt: iso(atHour(base, 9, 30 + i)),
    });
    it.etat = ITEM_STATES.RESERVE;
    addLog(atHour(base, 9, 30 + i), user.id, 'loan.reservee', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
  });

  // ---- Maintenance ----
  const addMaint = (fields) => {
    const m = { id: `maint_${pad(db.maintenance.length + 1, 3)}`, prestataire: '', cout: 0, loanId: null, bookingId: null, ...fields };
    db.maintenance.push(m);
    return m;
  };

  // Souris #3 : rendue avec un problème il y a 2 jours → maintenance + signalement ouvert
  {
    const it = item('souris', 2);
    const user = emprunteurs[5];
    const day = lastWeekday(addDays(base, -2));
    const start = atHour(day, 10, 10);
    const end = atHour(day, 15, 45);
    const checklist = buildChecklist('souris');
    checklist[0].ok = false;
    checklist[0].commentaire = 'Clic gauche ne répond plus';
    const l = addLoan({
      itemId: it.id, userId: user.id, statut: LOAN_STATES.RETOURNEE, dateReservation: iso(start), debutPrevu: iso(start),
      finPrevue: iso(atHour(day, 17)), dateRetrait: iso(start), dateRetourReelle: iso(end), checklistRetour: checklist,
      createdAt: iso(start), updatedAt: iso(end),
    });
    it.etat = ITEM_STATES.MAINTENANCE;
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: user.id, date: iso(end), statut: MAINT_STATES.OUVERT,
      description: 'Signalé au retour : Clic et molette OK → Clic gauche ne répond plus', loanId: l.id, createdAt: iso(end), updatedAt: iso(end),
    });
    addLog(start, user.id, 'loan.emprunt', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} — ${who(user)}`);
    addLog(end, user.id, 'loan.retour', { itemId: it.id, loanId: l.id, userId: user.id }, `${it.nom} rendu avec un problème`);
    addLog(end, user.id, 'maintenance.signalement', { itemId: it.id, loanId: l.id }, m.description);
  }

  // Clavier #3 : hors service depuis 20 jours
  {
    const it = item('clavier', 2);
    const d = atHour(addDays(base, -20), 11);
    it.etat = ITEM_STATES.HS;
    it.notes = 'Hors service : touches arrachées, non réparable.';
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: ped0.id, date: iso(d), statut: MAINT_STATES.CLOS,
      description: 'Touches arrachées, non réparable — passé hors service.', createdAt: iso(d), updatedAt: iso(d),
    });
    addLog(d, ped0.id, 'item.etat', { itemId: it.id }, `${it.nom} passé hors service`);
    addLog(d, ped0.id, 'maintenance.clos', { itemId: it.id }, m.description);
  }

  // Canon R10 : intervention externe close il y a 30 jours
  {
    const it = item('canon-r10');
    const d = atHour(addDays(base, -30), 14);
    const m = addMaint({
      itemId: it.id, type: MAINT_TYPES.EXTERNE, auteurId: ped0.id, date: iso(d), statut: MAINT_STATES.CLOS,
      prestataire: 'Optic Services', cout: 90, description: 'Nettoyage capteur et révision annuelle.',
      createdAt: iso(addDays(d, -5)), updatedAt: iso(d),
    });
    addLog(addDays(d, -5), ped0.id, 'maintenance.intervention', { itemId: it.id }, `${m.prestataire} — ${m.description}`);
    addLog(d, ped0.id, 'maintenance.clos', { itemId: it.id }, 'Intervention close, matériel remis en service');
  }

  // ---- Salle photo ----
  const addBooking = (fields) => {
    const b = { id: `book_${pad(db.bookings.length + 1, 3)}`, etatEntree: null, etatSortie: null, ...fields };
    db.bookings.push(b);
    return b;
  };
  const etat = (date) => ({ date: iso(date), lignes: buildRoomChecklist(salleItems) });

  // 2 réservations passées terminées
  [[-7, [9, 10, 11], 12], [-3, [14, 15], 16]].forEach(([dOff, creneaux, uIdx]) => {
    const day = lastWeekday(addDays(base, dOff));
    const user = emprunteurs[uIdx];
    const start = atHour(day, creneaux[0]);
    const end = atHour(day, creneaux[creneaux.length - 1] + 1);
    const b = addBooking({
      userId: user.id, date: ymd(day), creneaux, statut: BOOKING_STATES.TERMINEE,
      etatEntree: etat(atHour(day, creneaux[0], 3)), etatSortie: etat(atHour(day, creneaux[creneaux.length - 1], 55)),
      createdAt: iso(addDays(start, -2)), updatedAt: iso(end),
    });
    addLog(addDays(start, -2), user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
    addLog(atHour(day, creneaux[0], 3), user.id, 'booking.entree', { bookingId: b.id, userId: user.id }, 'État des lieux d’entrée OK');
    addLog(atHour(day, creneaux[creneaux.length - 1], 55), user.id, 'booking.sortie', { bookingId: b.id, userId: user.id }, 'État des lieux de sortie OK');
  });

  // 1 réservation en cours maintenant (si jour ouvré et dans la plage)
  if (isWeekday(now) && now.getHours() >= db.settings.salle.heureDebut && now.getHours() < db.settings.salle.heureFin) {
    const h = now.getHours();
    const creneaux = h > db.settings.salle.heureDebut ? [h - 1, h] : [h];
    const user = emprunteurs[3];
    const start = atHour(now, creneaux[0]);
    const b = addBooking({
      userId: user.id, date: ymd(now), creneaux, statut: BOOKING_STATES.EN_COURS,
      etatEntree: etat(atHour(now, creneaux[0], 2)), createdAt: iso(addDays(start, -1)), updatedAt: iso(start),
    });
    addLog(addDays(start, -1), user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
    addLog(atHour(now, creneaux[0], 2), user.id, 'booking.entree', { bookingId: b.id, userId: user.id }, 'État des lieux d’entrée OK');
  }

  // 3 réservations à venir
  [[1, [8, 9, 10, 11, 12], 7], [2, [14, 15], 18], [3, [9, 10], 32]].forEach(([nOff, creneaux, uIdx]) => {
    const day = nextWeekday(base, nOff);
    const user = emprunteurs[uIdx];
    const created = atHour(base, 8, 30);
    const b = addBooking({
      userId: user.id, date: ymd(day), creneaux, statut: BOOKING_STATES.A_VENIR, createdAt: iso(created), updatedAt: iso(created),
    });
    addLog(created, user.id, 'booking.creee', { bookingId: b.id, userId: user.id }, `Salle photo ${creneaux[0]}h-${creneaux[creneaux.length - 1] + 1}h — ${who(user)}`);
  });

  db.log.sort((a, b) => a.date.localeCompare(b.date));
  return db;
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/seed.test.mjs`
Expected: `# pass 8`, `# fail 0`. Si le test « volumes » échoue sur le nombre d'objets `emprunte` vs emprunts actifs, vérifier que le générateur aléatoire des 40 emprunts passés ne touche pas `it.etat` (les emprunts passés ne modifient jamais l'état).

- [ ] **Step 5 : Lancer toute la suite**

Run: `npm test`
Expected: `# fail 0`

- [ ] **Step 6 : Commit**

```bash
git add js/seed.js tests/seed.test.mjs
git commit -m "feat: données de démo — 45 utilisateurs, inventaire complet, historique cohérent"
```

---

### Task 7 : `log.js` et `auth.js` — journal et utilisateur courant

**Files:**
- Create: `js/log.js`, `js/auth.js`
- Test: `tests/log.test.mjs`, `tests/auth.test.mjs`

**Interfaces:**
- Consumes : `store`, `rules.now()`, `ROLES`.
- Produces : `ACTIONS` (constantes `'domaine.evenement'`), `ACTION_LABELS`, `logAction({ auteurId, action, itemId?, loanId?, bookingId?, userId?, detail? }) → LogEntry`, `recentLog(limit = 20)`, `logForItem(itemId)`, `logForUser(userId)` ; `SESSION_KEY`, `auth.currentUserId()`, `auth.currentUser()`, `auth.login(userId) → User`, `auth.logout()`, `auth.isPedago()`.

- [ ] **Step 1 : Écrire les tests**

`tests/log.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS, ACTION_LABELS, logAction, recentLog, logForItem, logForUser } from '../js/log.js';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('toutes les actions du seed sont des ACTIONS connues et ont un libellé', () => {
  const known = new Set(Object.values(ACTIONS));
  for (const e of store.log.list()) assert.ok(known.has(e.action), e.action);
  for (const a of known) assert.ok(ACTION_LABELS[a], a);
});

test('logAction écrit une entrée datée par now() (horloge de démo)', () => {
  store.settings.update({ horlogeDemo: '2026-09-18T09:00:00.000Z' });
  const e = logAction({ auteurId: 'user_041', action: ACTIONS.ITEM_ETAT, itemId: 'item_001', detail: 'test' });
  assert.equal(e.date, '2026-09-18T09:00:00.000Z');
  assert.equal(store.log.get(e.id).detail, 'test');
  assert.equal(e.loanId, null);
});

test('logAction refuse une action inconnue ou sans auteur', () => {
  assert.throws(() => logAction({ auteurId: 'user_041', action: 'nimporte.quoi' }), /action inconnue/);
  assert.throws(() => logAction({ action: ACTIONS.ITEM_ETAT }), /auteurId/);
});

test('recentLog renvoie les plus récentes en premier, limitées', () => {
  const r = recentLog(5);
  assert.equal(r.length, 5);
  assert.ok(r[0].date >= r[4].date);
});

test('logForItem et logForUser filtrent', () => {
  assert.ok(logForItem('item_001').every((e) => e.itemId === 'item_001'));
  assert.ok(logForItem('item_001').length > 0);
  const u = logForUser('user_001');
  assert.ok(u.length > 0);
  assert.ok(u.every((e) => e.userId === 'user_001' || e.auteurId === 'user_001'));
});
```

`tests/auth.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { auth, SESSION_KEY } from '../js/auth.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('aucun utilisateur par défaut', () => {
  assert.equal(auth.currentUserId(), null);
  assert.equal(auth.currentUser(), null);
  assert.equal(auth.isPedago(), false);
});

test('login stocke l’id en sessionStorage et renvoie l’utilisateur', () => {
  const u = auth.login('user_041');
  assert.equal(u.role, 'pedago');
  assert.equal(sessionStorage.getItem(SESSION_KEY), 'user_041');
  assert.equal(auth.currentUser().id, 'user_041');
  assert.equal(auth.isPedago(), true);
});

test('login refuse un inconnu ou un compte désactivé', () => {
  assert.throws(() => auth.login('nope'), /introuvable/);
  store.users.update('user_001', { actif: false });
  assert.throws(() => auth.login('user_001'), /désactivé/);
});

test('logout efface la session', () => {
  auth.login('user_001');
  auth.logout();
  assert.equal(auth.currentUser(), null);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/log.test.mjs tests/auth.test.mjs`
Expected: FAIL — modules introuvables

- [ ] **Step 3 : Écrire `js/log.js`**

```js
// js/log.js — journal de traçabilité. Chaque mutation métier passe par logAction().
import { store } from './store.js';
import { now } from './rules.js';

export const ACTIONS = {
  ITEM_CREE: 'item.cree', ITEM_MODIFIE: 'item.modifie', ITEM_ETAT: 'item.etat',
  USER_CREE: 'user.cree', USER_MODIFIE: 'user.modifie', USER_DESACTIVE: 'user.desactive',
  LOAN_EMPRUNT: 'loan.emprunt', LOAN_RETOUR: 'loan.retour', LOAN_RESERVEE: 'loan.reservee',
  LOAN_REMISE: 'loan.remise', LOAN_REFUSEE: 'loan.refusee', LOAN_EXPIREE: 'loan.expiree',
  LOAN_ANNULEE: 'loan.annulee', LOAN_PROLONGEE: 'loan.prolongee',
  BOOKING_CREEE: 'booking.creee', BOOKING_ANNULEE: 'booking.annulee',
  BOOKING_ENTREE: 'booking.entree', BOOKING_SORTIE: 'booking.sortie',
  MAINT_SIGNALEMENT: 'maintenance.signalement', MAINT_INTERVENTION: 'maintenance.intervention', MAINT_CLOS: 'maintenance.clos',
  SETTINGS_MODIFIES: 'settings.modifies', DEMO_RESET: 'demo.reset',
};

export const ACTION_LABELS = {
  'item.cree': 'Matériel ajouté', 'item.modifie': 'Matériel modifié', 'item.etat': 'Changement d’état',
  'user.cree': 'Utilisateur ajouté', 'user.modifie': 'Utilisateur modifié', 'user.desactive': 'Utilisateur désactivé',
  'loan.emprunt': 'Emprunt', 'loan.retour': 'Retour', 'loan.reservee': 'Réservation',
  'loan.remise': 'Remise', 'loan.refusee': 'Réservation refusée', 'loan.expiree': 'Réservation expirée',
  'loan.annulee': 'Réservation annulée', 'loan.prolongee': 'Emprunt prolongé',
  'booking.creee': 'Salle réservée', 'booking.annulee': 'Réservation de salle annulée',
  'booking.entree': 'État des lieux d’entrée', 'booking.sortie': 'État des lieux de sortie',
  'maintenance.signalement': 'Signalement', 'maintenance.intervention': 'Intervention', 'maintenance.clos': 'Maintenance close',
  'settings.modifies': 'Paramètres modifiés', 'demo.reset': 'Données de démo réinitialisées',
};

const KNOWN = new Set(Object.values(ACTIONS));

export function logAction({ auteurId, action, itemId = null, loanId = null, bookingId = null, userId = null, detail = '' }) {
  if (!auteurId) throw new Error('logAction : auteurId obligatoire');
  if (!KNOWN.has(action)) throw new Error(`logAction : action inconnue (${action})`);
  return store.log.create({ date: now().toISOString(), auteurId, action, itemId, loanId, bookingId, userId, detail });
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date);

export function recentLog(limit = 20) {
  return store.log.list().sort(byDateDesc).slice(0, limit);
}

export function logForItem(itemId) {
  return store.log.list((e) => e.itemId === itemId).sort(byDateDesc);
}

export function logForUser(userId) {
  return store.log.list((e) => e.userId === userId || e.auteurId === userId).sort(byDateDesc);
}
```

- [ ] **Step 4 : Écrire `js/auth.js`**

```js
// js/auth.js — utilisateur courant, stocké par onglet (sessionStorage) pour permettre
// une fenêtre admin et une fenêtre mobile côte à côte avec des comptes différents.
import { store } from './store.js';
import { ROLES } from './models.js';

export const SESSION_KEY = 'mds-emprunts:currentUser';

function currentUserId() {
  return sessionStorage.getItem(SESSION_KEY);
}

function currentUser() {
  const id = currentUserId();
  return id ? store.users.get(id) : null;
}

function login(userId) {
  const u = store.users.get(userId);
  if (!u) throw new Error(`Utilisateur introuvable (${userId})`);
  if (u.actif === false) throw new Error('Ce compte est désactivé.');
  sessionStorage.setItem(SESSION_KEY, userId);
  return u;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

function isPedago() {
  return currentUser()?.role === ROLES.PEDAGO;
}

export const auth = { currentUserId, currentUser, login, logout, isPedago };
```

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/log.test.mjs tests/auth.test.mjs`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 6 : Commit**

```bash
git add js/log.js js/auth.js tests/log.test.mjs tests/auth.test.mjs
git commit -m "feat: journal de traçabilité et utilisateur courant par onglet"
```

---

### Task 8 : `ui.js` — formatage, badges, modale, toast

**Files:**
- Create: `js/ui.js`
- Test: `tests/ui.test.mjs`

**Interfaces:**
- Consumes : `LABELS` de `models.js`.
- Produces (pures, testées) : `escapeHtml(s)`, `formatDate(d)`, `formatTime(d)`, `formatDateTime(d)`, `relativeDay(d, ref)`, `formatSlots(creneaux)`, `initials(user)`, `fullName(user)`, `badge(kind, value) → html` avec `kind ∈ 'item' | 'loan' | 'booking' | 'maint' | 'circuit'` (et `value 'en_retard'` pour `loan`).
- Produces (DOM, vérifiées dans `kit.html`) : `openModal({ title, body, actions: [{ label, variant, onClick, close = true }] }) → close()`, `closeModal()`, `toast(message, variant = 'info', ms = 3000)`, `avatar(user, size = 'sm') → html`. Requiert `<div id="modal-root">` et `<div id="toast-root">` dans la page.

- [ ] **Step 1 : Écrire le test**

`tests/ui.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatTime, formatDateTime, relativeDay, formatSlots, initials, fullName, badge } from '../js/ui.js';

const d = new Date(2026, 8, 17, 9, 5);

test('escapeHtml neutralise les caractères spéciaux', () => {
  assert.equal(escapeHtml('<a href="x">Léa & co</a>'), '&lt;a href=&quot;x&quot;&gt;Léa &amp; co&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
});

test('formats de date en français', () => {
  assert.equal(formatDate(d), '17 sept. 2026');
  assert.equal(formatTime(d), '09h05');
  assert.equal(formatDateTime(d), '17 sept. 2026 à 09h05');
  assert.equal(formatDate(d.toISOString()), '17 sept. 2026');
});

test('relativeDay', () => {
  const ref = new Date(2026, 8, 17, 15, 0);
  assert.equal(relativeDay(d, ref), 'Aujourd’hui');
  assert.equal(relativeDay(new Date(2026, 8, 18, 8), ref), 'Demain');
  assert.equal(relativeDay(new Date(2026, 8, 16, 23), ref), 'Hier');
  assert.equal(relativeDay(new Date(2026, 8, 20), ref), '20 sept. 2026');
});

test('formatSlots', () => {
  assert.equal(formatSlots([8, 9, 10, 11, 12]), '8h-13h');
  assert.equal(formatSlots([14]), '14h-15h');
});

test('initials et fullName', () => {
  const u = { prenom: 'Léa', nom: 'Pezzetti' };
  assert.equal(initials(u), 'LP');
  assert.equal(fullName(u), 'Léa Pezzetti');
});

test('badge : variante et libellé', () => {
  assert.equal(badge('item', 'disponible'), '<span class="badge badge--available">Disponible</span>');
  assert.equal(badge('loan', 'en_retard'), '<span class="badge badge--late">En retard</span>');
  assert.equal(badge('circuit', 'valeur'), '<span class="badge badge--borrowed">Sur réservation</span>');
  assert.equal(badge('maint', 'ouvert'), '<span class="badge badge--late">Ouvert</span>');
  assert.equal(badge('item', 'inconnu'), '<span class="badge badge--hs">inconnu</span>');
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/ui.test.mjs`
Expected: FAIL — `Cannot find module '../js/ui.js'`

- [ ] **Step 3 : Écrire `js/ui.js`**

```js
// js/ui.js — helpers d'affichage. Partie pure (formatage, badges) + partie DOM (modale, toast).
import { LABELS } from './models.js';

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const pad2 = (n) => String(n).padStart(2, '0');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatDate(d) {
  return dateFmt.format(toDate(d));
}

export function formatTime(d) {
  const x = toDate(d);
  return `${pad2(x.getHours())}h${pad2(x.getMinutes())}`;
}

export function formatDateTime(d) {
  return `${formatDate(d)} à ${formatTime(d)}`;
}

export function relativeDay(d, ref = new Date()) {
  const a = toDate(d); const b = toDate(ref);
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((dayA - dayB) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return formatDate(a);
}

export function formatSlots(creneaux) {
  const s = [...creneaux].sort((a, b) => a - b);
  return `${s[0]}h-${s[s.length - 1] + 1}h`;
}

export function fullName(user) {
  return `${user.prenom} ${user.nom}`;
}

export function initials(user) {
  return `${user.prenom[0] || ''}${user.nom[0] || ''}`.toUpperCase();
}

// Variante visuelle (tokens --status-*) par famille et valeur
const VARIANTS = {
  item: { disponible: 'available', emprunte: 'borrowed', reserve: 'reserved', maintenance: 'maintenance', hs: 'hs' },
  loan: { reservee: 'reserved', en_cours: 'borrowed', retournee: 'available', refusee: 'hs', expiree: 'hs', annulee: 'hs', en_retard: 'late' },
  booking: { a_venir: 'reserved', en_cours: 'borrowed', terminee: 'available', annulee: 'hs' },
  maint: { ouvert: 'late', en_cours: 'maintenance', clos: 'available' },
  circuit: { self: 'available', salle: 'reserved', valeur: 'borrowed' },
};
const LABEL_FAMILY = { item: 'itemState', loan: 'loanState', booking: 'bookingState', maint: 'maintState', circuit: 'circuit' };

export function badge(kind, value) {
  const variant = VARIANTS[kind]?.[value] || 'hs';
  const label = value === 'en_retard' ? 'En retard' : (LABELS[LABEL_FAMILY[kind]]?.[value] || value);
  return `<span class="badge badge--${variant}">${escapeHtml(label)}</span>`;
}

export function avatar(user, size = 'sm') {
  return `<span class="avatar avatar--${size}" title="${escapeHtml(fullName(user))}">${escapeHtml(initials(user))}</span>`;
}

// ---- DOM ----

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('has-modal');
}

export function openModal({ title, body, actions = [] }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal__header">
          <h2 id="modal-title" class="h6">${escapeHtml(title)}</h2>
          <button class="modal__close" type="button" aria-label="Fermer" data-close>&times;</button>
        </header>
        <div class="modal__body">${body}</div>
        <footer class="modal__footer">
          ${actions.map((a, i) => `<button type="button" class="btn btn--${a.variant || 'secondary'}" data-action="${i}">${escapeHtml(a.label)}</button>`).join('')}
        </footer>
      </div>
    </div>`;
  document.body.classList.add('has-modal');
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', (e) => { if (e.target === el) closeModal(); }));
  root.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', async () => {
    const a = actions[Number(btn.dataset.action)];
    const keepOpen = a.onClick ? (await a.onClick(root.querySelector('.modal'))) === false : false;
    if (a.close !== false && !keepOpen) closeModal();
  }));
  return closeModal;
}

export function toast(message, variant = 'info', ms = 3000) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.classList.add('toast--leaving'), ms - 300);
  setTimeout(() => el.remove(), ms);
}
```

Convention pour `onClick` : renvoyer `false` garde la modale ouverte (ex. formulaire invalide).

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/ui.test.mjs`
Expected: `# pass 6`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/ui.js tests/ui.test.mjs
git commit -m "feat: helpers d'affichage — formatage FR, badges, modale, toast"
```

---

### Task 9 : `router.js` — routing par hash

**Files:**
- Create: `js/router.js`
- Test: `tests/router.test.mjs`

**Interfaces:**
- Produces : `matchRoute(pattern, path) → params | null`, `currentPath()`, `navigate(path)`, `createRouter({ routes, container, defaultPath = '/', notFound }) → { start(), stop(), render() }`. Une route est `{ path: '/materiel/:id', view: (container, params) => cleanupFn | void }`.

- [ ] **Step 1 : Écrire le test**

`tests/router.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../js/router.js';

test('matchRoute : exact, paramètres, échec', () => {
  assert.deepEqual(matchRoute('/', '/'), {});
  assert.deepEqual(matchRoute('/materiel', '/materiel'), {});
  assert.deepEqual(matchRoute('/materiel/:id', '/materiel/item_001'), { id: 'item_001' });
  assert.deepEqual(matchRoute('/a/:x/b/:y', '/a/1/b/2'), { x: '1', y: '2' });
  assert.equal(matchRoute('/materiel/:id', '/materiel'), null);
  assert.equal(matchRoute('/materiel', '/emprunts'), null);
  assert.equal(matchRoute('/materiel', '/materiel/x'), null);
});

test('matchRoute décode les segments et tolère le slash final', () => {
  assert.deepEqual(matchRoute('/u/:name', '/u/L%C3%A9a'), { name: 'Léa' });
  assert.deepEqual(matchRoute('/materiel', '/materiel/'), {});
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/router.test.mjs`
Expected: FAIL — `Cannot find module '../js/router.js'`

- [ ] **Step 3 : Écrire `js/router.js`**

```js
// js/router.js — routing par #hash. Une vue = fonction (container, params) qui peut
// renvoyer une fonction de nettoyage (désabonnement du store, arrêt de caméra…).

export function matchRoute(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function currentPath() {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : `/${h}`;
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}

export function createRouter({ routes, container, defaultPath = '/', notFound }) {
  let cleanup = null;

  function render() {
    const path = currentPath();
    if (path === '/' && defaultPath !== '/') { navigate(defaultPath); return; }
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    for (const route of routes) {
      const params = matchRoute(route.path, path);
      if (params) {
        container.innerHTML = '';
        cleanup = route.view(container, params) || null;
        window.scrollTo(0, 0);
        return;
      }
    }
    container.innerHTML = '';
    if (notFound) notFound(container, path);
  }

  return {
    start() { window.addEventListener('hashchange', render); render(); },
    stop() { window.removeEventListener('hashchange', render); if (typeof cleanup === 'function') cleanup(); },
    render,
  };
}
```

- [ ] **Step 4 : Lancer le test**

Run: `node --test tests/router.test.mjs`
Expected: `# pass 2`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/router.js tests/router.test.mjs
git commit -m "feat: routeur par hash avec paramètres et nettoyage de vue"
```

---

### Task 10 : `components.css` et `kit.html` — bibliothèque de composants

**Files:**
- Create: `css/components.css`, `kit.html`

**Interfaces:**
- Produces : classes CSS utilisées par toutes les vues des phases suivantes : `.btn` (+ `--primary`, `--secondary`, `--ghost`, `--danger`, `--sm`, `--icon`), `.badge` (+ `--available`, `--borrowed`, `--reserved`, `--late`, `--maintenance`, `--hs`), `.chip` (+ `--active`), `.card`, `.card__header`, `.card__title`, `.kpi` (+ `--brand`, `--teal`), `.kpi__label`, `.kpi__value`, `.kpi__delta`, `.table`, `.field`, `.field__label`, `.input`, `.select`, `.textarea`, `.checkbox`, `.toggle`, `.avatar` (+ `--sm`, `--md`), `.nav-item` (+ `--active`), `.tabs`, `.tab` (+ `--active`), `.empty-state`, `.modal-backdrop`, `.modal`, `.modal__header`, `.modal__body`, `.modal__footer`, `.modal__close`, `.toast-stack`, `.toast` (+ `--info`, `--success`, `--error`, `--warning`, `--leaving`), `.stack`, `.row`, `.grid-2`, `.grid-4`.
- Vérification visuelle contre les pages Figma : Button `2:107`, Badge & Tag `2:108`, Avatar `2:109`, Form Controls `2:110`, Table `2:111`, KPI Card `2:112`, Cards `2:113`, Navigation `2:114`, Modal & Feedback `2:115`.

- [ ] **Step 1 : Écrire `css/components.css`**

```css
/* Composants du kit MDS. Toutes les couleurs viennent de tokens.css. */

/* ---- Layout utilitaires ---- */
.stack { display: flex; flex-direction: column; gap: var(--space-lg); }
.row { display: flex; align-items: center; gap: var(--space-md); }
.row--between { justify-content: space-between; }
.row--wrap { flex-wrap: wrap; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-lg); }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-lg); }
@media (max-width: 900px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .grid-2, .grid-4 { grid-template-columns: 1fr; } }

/* ---- Boutons ---- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-sm);
  height: var(--size-control-md); padding: 0 var(--space-xl);
  border-radius: var(--radius-pill); font-size: 14px; font-weight: 700; line-height: 18px;
  border: var(--stroke-thin) solid transparent; white-space: nowrap;
  transition: background-color .15s, border-color .15s, color .15s, opacity .15s;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn--primary { background: var(--brand-primary); color: var(--text-on-brand); }
.btn--primary:hover:not(:disabled) { background: #521d69; }
.btn--secondary { background: var(--bg-surface); color: var(--text-brand); border-color: var(--border-brand); }
.btn--secondary:hover:not(:disabled) { background: var(--brand-primary-subtle); }
.btn--ghost { background: transparent; color: var(--text-brand); }
.btn--ghost:hover:not(:disabled) { background: var(--brand-primary-subtle); }
.btn--danger { background: var(--feedback-error); color: var(--text-inverse); }
.btn--danger:hover:not(:disabled) { background: #c8253a; }
.btn--sm { height: var(--size-control-sm); padding: 0 var(--space-lg); font-size: 12px; }
.btn--icon { width: var(--size-control-md); padding: 0; }
.btn--block { width: 100%; }

/* ---- Badges et chips ---- */
.badge {
  display: inline-flex; align-items: center; gap: var(--space-xs);
  height: 22px; padding: 0 var(--space-sm); border-radius: var(--radius-full);
  font-size: 11px; font-weight: 700; line-height: 14px; letter-spacing: .3px; white-space: nowrap;
}
.badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.badge--available { color: var(--status-available-fg); background: var(--status-available-bg); }
.badge--borrowed { color: var(--status-borrowed-fg); background: var(--status-borrowed-bg); }
.badge--reserved { color: var(--status-reserved-fg); background: var(--status-reserved-bg); }
.badge--late { color: var(--status-late-fg); background: var(--status-late-bg); }
.badge--maintenance { color: var(--status-maintenance-fg); background: var(--status-maintenance-bg); }
.badge--hs { color: var(--status-hs-fg); background: var(--status-hs-bg); }

.chip {
  display: inline-flex; align-items: center; height: 28px; padding: 0 var(--space-md);
  border-radius: var(--radius-full); border: var(--stroke-thin) solid var(--border-default);
  background: var(--bg-surface); color: var(--text-secondary); font-size: 11px; font-weight: 700;
  letter-spacing: .8px; text-transform: uppercase; cursor: pointer;
}
.chip--active { background: var(--brand-primary); border-color: var(--brand-primary); color: var(--text-on-brand); }

/* ---- Cartes ---- */
.card { background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--space-2xl); }
.card--flat { box-shadow: none; border: var(--stroke-thin) solid var(--border-default); }
.card__header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); margin-bottom: var(--space-lg); }
.card__title { font-family: var(--font-heading); font-weight: 800; font-size: 18px; line-height: 26px; letter-spacing: -.2px; }
.card--item { padding: 0; overflow: hidden; }
.card--item .card__media { aspect-ratio: 4 / 3; background: var(--brand-primary-subtle); display: grid; place-items: center; color: var(--text-brand); }
.card--item .card__body { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }

/* ---- KPI ---- */
.kpi { background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--space-xl) var(--space-2xl); display: flex; flex-direction: column; gap: var(--space-sm); }
.kpi__label { font-size: 12px; font-weight: 700; line-height: 16px; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; }
.kpi__value { font-family: var(--font-heading); font-weight: 800; font-size: 40px; line-height: 44px; letter-spacing: -1px; }
.kpi__delta { font-size: 11px; line-height: 16px; color: var(--text-secondary); }
.kpi--brand { background: var(--brand-primary); color: var(--text-on-brand); }
.kpi--brand .kpi__label, .kpi--brand .kpi__delta { color: rgba(255, 255, 255, .8); }
.kpi--teal { background: var(--brand-secondary); color: var(--text-on-brand); }
.kpi--teal .kpi__label, .kpi--teal .kpi__delta { color: rgba(255, 255, 255, .85); }

/* ---- Table ---- */
.table { width: 100%; border-collapse: collapse; font-size: 14px; line-height: 21px; }
.table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; color: var(--text-secondary); padding: var(--space-sm) var(--space-md); border-bottom: var(--stroke-thin) solid var(--border-default); }
.table th[data-sortable] { cursor: pointer; user-select: none; }
.table td { padding: var(--space-md); border-bottom: var(--stroke-thin) solid var(--border-default); vertical-align: middle; }
.table tbody tr:hover { background: var(--bg-canvas); }
.table tr[data-href] { cursor: pointer; }
.table__actions { display: flex; gap: var(--space-xs); justify-content: flex-end; }

/* ---- Formulaires ---- */
.field { display: flex; flex-direction: column; gap: var(--space-xs); }
.field__label { font-size: 12px; font-weight: 700; line-height: 16px; color: var(--text-secondary); }
.field__hint { font-size: 11px; line-height: 16px; color: var(--text-secondary); }
.field__error { font-size: 11px; line-height: 16px; color: var(--feedback-error); }
.input, .select, .textarea {
  width: 100%; min-height: var(--size-control-md); padding: 0 var(--space-md);
  border: var(--stroke-thin) solid var(--border-default); border-radius: var(--radius-md);
  background: var(--bg-surface); font-size: 14px; line-height: 21px; color: var(--text-primary);
}
.textarea { padding: var(--space-sm) var(--space-md); min-height: 88px; resize: vertical; }
.input:focus, .select:focus, .textarea:focus { outline: 2px solid var(--brand-primary); outline-offset: -1px; border-color: var(--brand-primary); }
.input::placeholder, .textarea::placeholder { color: var(--text-disabled); }
.input[aria-invalid="true"], .select[aria-invalid="true"] { border-color: var(--feedback-error); }
.input--search { padding-left: 36px; background: var(--bg-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23757678' stroke-width='2'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='m11 11 4 4'/%3E%3C/svg%3E") no-repeat 12px center; }
.checkbox { display: flex; align-items: center; gap: var(--space-sm); font-size: 14px; line-height: 21px; cursor: pointer; }
.checkbox input { width: 20px; height: 20px; accent-color: var(--brand-primary); margin: 0; }
.toggle { position: relative; display: inline-flex; align-items: center; gap: var(--space-sm); cursor: pointer; font-size: 14px; }
.toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle__track { width: 40px; height: 22px; border-radius: var(--radius-full); background: var(--bg-muted); position: relative; transition: background .15s; }
.toggle__track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--bg-surface); transition: transform .15s; }
.toggle input:checked + .toggle__track { background: var(--brand-primary); }
.toggle input:checked + .toggle__track::after { transform: translateX(18px); }

/* ---- Avatar ---- */
.avatar { display: inline-grid; place-items: center; border-radius: 50%; background: var(--brand-primary); color: var(--text-on-brand); font-weight: 700; flex: none; }
.avatar--sm { width: var(--size-avatar-sm); height: var(--size-avatar-sm); font-size: 12px; }
.avatar--md { width: 44px; height: 44px; font-size: 14px; }

/* ---- Navigation (sidebar) ---- */
.nav-item { display: flex; align-items: center; gap: var(--space-md); height: 40px; padding: 0 var(--space-md); border-radius: var(--radius-md); color: rgba(255, 255, 255, .8); font-size: 14px; font-weight: 700; }
.nav-item:hover { background: var(--alpha-white-10); color: var(--text-inverse); }
.nav-item--active { background: var(--bg-surface); color: var(--text-brand); }
.nav-item__count { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--radius-full); background: var(--brand-accent); color: var(--text-inverse); font-size: 11px; display: grid; place-items: center; }

/* ---- Onglets ---- */
.tabs { display: flex; gap: var(--space-xs); border-bottom: var(--stroke-thin) solid var(--border-default); }
.tab { padding: var(--space-sm) var(--space-md); font-size: 14px; font-weight: 700; color: var(--text-secondary); border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab--active { color: var(--text-brand); border-bottom-color: var(--brand-primary); }
.tab__count { margin-left: var(--space-xs); font-weight: 400; }

/* ---- État vide ---- */
.empty-state { text-align: center; padding: var(--space-3xl); color: var(--text-secondary); font-size: 14px; }

/* ---- Modale ---- */
.has-modal { overflow: hidden; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(60, 60, 59, .5); display: grid; place-items: center; padding: var(--space-lg); z-index: 100; }
.modal { width: min(560px, 100%); max-height: 90vh; overflow: auto; background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); display: flex; flex-direction: column; }
.modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2xl) var(--space-2xl) var(--space-lg); }
.modal__close { width: 32px; height: 32px; border-radius: 50%; font-size: 22px; line-height: 1; color: var(--text-secondary); }
.modal__close:hover { background: var(--bg-canvas); }
.modal__body { padding: 0 var(--space-2xl) var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); }
.modal__footer { display: flex; justify-content: flex-end; gap: var(--space-sm); padding: var(--space-lg) var(--space-2xl) var(--space-2xl); }

/* ---- Toasts ---- */
#toast-root { position: fixed; bottom: var(--space-2xl); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: var(--space-sm); z-index: 200; pointer-events: none; }
.toast { padding: var(--space-md) var(--space-xl); border-radius: var(--radius-md); background: var(--text-primary); color: var(--text-inverse); font-size: 14px; font-weight: 700; box-shadow: var(--shadow-card); animation: toast-in .2s ease-out; }
.toast--success { background: var(--feedback-success); }
.toast--error { background: var(--feedback-error); }
.toast--warning { background: var(--feedback-warning); color: var(--text-primary); }
.toast--leaving { opacity: 0; transition: opacity .3s; }
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ---- Alerte inline ---- */
.alert { display: flex; gap: var(--space-md); padding: var(--space-md) var(--space-lg); border-radius: var(--radius-md); font-size: 14px; line-height: 21px; }
.alert--warning { background: var(--status-maintenance-bg); color: #7a5300; }
.alert--error { background: var(--status-late-bg); color: var(--status-late-fg); }
.alert--info { background: var(--brand-secondary-subtle); color: var(--status-reserved-fg); }
```

- [ ] **Step 2 : Écrire `kit.html`**

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MDS Emprunts — Kit de composants</title>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
  <style>
    main { max-width: 1100px; margin: 0 auto; padding: var(--space-3xl) var(--space-2xl); display: flex; flex-direction: column; gap: var(--space-3xl); }
    section > h2 { margin-bottom: var(--space-lg); }
    .swatches { display: flex; flex-wrap: wrap; gap: var(--space-md); }
    .swatch { width: 120px; padding: var(--space-sm); border-radius: var(--radius-md); background: var(--bg-surface); box-shadow: var(--shadow-card); font-size: 11px; }
    .swatch i { display: block; height: 40px; border-radius: var(--radius-xs); margin-bottom: var(--space-xs); }
    .sidebar-demo { width: 260px; background: var(--brand-primary); padding: var(--space-lg); border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: var(--space-xs); }
  </style>
</head>
<body>
<main>
  <header>
    <p class="label-caps text-secondary">Kit de composants</p>
    <h1 class="h5">MDS Emprunts — vérification vs Figma</h1>
  </header>

  <section>
    <h2 class="h6">Couleurs</h2>
    <div class="swatches">
      <div class="swatch"><i style="background:var(--brand-primary)"></i>brand/primary</div>
      <div class="swatch"><i style="background:var(--brand-secondary)"></i>brand/secondary</div>
      <div class="swatch"><i style="background:var(--brand-accent)"></i>brand/accent</div>
      <div class="swatch"><i style="background:var(--brand-primary-subtle)"></i>primary-subtle</div>
      <div class="swatch"><i style="background:var(--brand-secondary-subtle)"></i>secondary-subtle</div>
      <div class="swatch"><i style="background:var(--bg-canvas)"></i>bg/canvas</div>
      <div class="swatch"><i style="background:var(--feedback-success)"></i>success</div>
      <div class="swatch"><i style="background:var(--feedback-warning)"></i>warning</div>
      <div class="swatch"><i style="background:var(--feedback-error)"></i>error</div>
    </div>
  </section>

  <section>
    <h2 class="h6">Typographie</h2>
    <div class="stack">
      <p class="h5">Heading H5 — Tableau de bord</p>
      <p class="h6">Heading H6 — Emprunts en cours</p>
      <p class="kpi-number">128</p>
      <p class="body">Body Regular — Le matériel est disponible au bureau des pédago.</p>
      <p class="body-sm">Body Small — Retour attendu aujourd’hui avant 17h.</p>
      <p class="label-caps">Label Caps — Matériel</p>
      <p class="body-tiny text-secondary">Body Tiny — Mercredi 17 septembre 2026</p>
    </div>
  </section>

  <section>
    <h2 class="h6">Boutons</h2>
    <div class="row row--wrap">
      <button class="btn btn--primary">+ Nouvelle demande</button>
      <button class="btn btn--secondary">Exporter</button>
      <button class="btn btn--ghost">Voir tout →</button>
      <button class="btn btn--danger">Refuser</button>
      <button class="btn btn--primary btn--sm">Valider</button>
      <button class="btn btn--secondary btn--sm">Emprunter →</button>
      <button class="btn btn--primary" disabled>Désactivé</button>
    </div>
  </section>

  <section>
    <h2 class="h6">Badges et chips</h2>
    <div class="row row--wrap">
      <span class="badge badge--available">Disponible</span>
      <span class="badge badge--borrowed">Emprunté</span>
      <span class="badge badge--reserved">Réservé</span>
      <span class="badge badge--late">En retard</span>
      <span class="badge badge--maintenance">Maintenance</span>
      <span class="badge badge--hs">Hors service</span>
    </div>
    <div class="row row--wrap" style="margin-top: var(--space-md)">
      <button class="chip chip--active">Tout</button>
      <button class="chip">Photo</button>
      <button class="chip">Audio</button>
      <button class="chip">Bureautique</button>
      <button class="chip">Lumière</button>
    </div>
  </section>

  <section>
    <h2 class="h6">KPI</h2>
    <div class="grid-4">
      <div class="kpi"><span class="kpi__label">Matériel disponible</span><span class="kpi__value">128</span><span class="kpi__delta">↑ +12 % vs semaine dernière</span></div>
      <div class="kpi kpi--brand"><span class="kpi__label">Emprunts en cours</span><span class="kpi__value">42</span><span class="kpi__delta">↑ +5 vs semaine dernière</span></div>
      <div class="kpi"><span class="kpi__label">Retards</span><span class="kpi__value">3</span><span class="kpi__delta">↓ -1 vs semaine dernière</span></div>
      <div class="kpi kpi--teal"><span class="kpi__label">Réservations à venir</span><span class="kpi__value">17</span><span class="kpi__delta">↑ +8 vs semaine dernière</span></div>
    </div>
  </section>

  <section>
    <h2 class="h6">Cartes</h2>
    <div class="grid-4">
      <div class="card card--item">
        <div class="card__media">📷</div>
        <div class="card__body">
          <span class="badge badge--available">Disponible</span>
          <span class="label-mini-caps text-secondary">Photo</span>
          <strong class="label-md">Canon R10 + 18-55</strong>
          <span class="body-tiny text-secondary">Réf. MDS-0029 · Armoire sécurisée</span>
          <button class="btn btn--secondary btn--sm">Réserver →</button>
        </div>
      </div>
      <div class="card">
        <div class="card__header"><h3 class="card__title">À valider</h3><a href="#" class="body-sm">Tout voir →</a></div>
        <p class="body-sm text-secondary">Contenu de carte standard.</p>
      </div>
    </div>
  </section>

  <section>
    <h2 class="h6">Table</h2>
    <div class="card">
      <table class="table">
        <thead><tr><th data-sortable>Matériel</th><th>Emprunteur</th><th>Retour</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          <tr data-href="#"><td>Canon R10</td><td><span class="row"><span class="avatar avatar--sm">LP</span>Léa Pezzetti</span></td><td>19/09</td><td><span class="badge badge--borrowed">Emprunté</span></td><td class="table__actions"><button class="btn btn--ghost btn--sm">Réceptionner</button></td></tr>
          <tr><td>DJI Ronin RSC2</td><td><span class="row"><span class="avatar avatar--sm">YG</span>Yann Guihard</span></td><td>14/09</td><td><span class="badge badge--late">En retard</span></td><td class="table__actions"><button class="btn btn--ghost btn--sm">Relancer</button></td></tr>
          <tr><td>Multiprise #2</td><td><span class="row"><span class="avatar avatar--sm">CD</span>Camille Dubois</span></td><td>Aujourd’hui</td><td><span class="badge badge--available">Retourné</span></td><td></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <h2 class="h6">Formulaires</h2>
    <div class="card grid-2">
      <label class="field"><span class="field__label">Nom</span><input class="input" placeholder="Canon R10"></label>
      <label class="field"><span class="field__label">Recherche</span><input class="input input--search" placeholder="Rechercher un matériel…"></label>
      <label class="field"><span class="field__label">Catégorie</span><select class="select"><option>Photo</option><option>Audio</option></select></label>
      <label class="field"><span class="field__label">Erreur</span><input class="input" aria-invalid="true" value="MDS-"><span class="field__error">Code déjà utilisé</span></label>
      <label class="field" style="grid-column: 1 / -1"><span class="field__label">Motif</span><textarea class="textarea" placeholder="Tournage projet MBA"></textarea></label>
      <label class="checkbox"><input type="checkbox" checked> Câble intact</label>
      <label class="toggle"><input type="checkbox" checked><span class="toggle__track"></span> Bloquer si retard</label>
    </div>
  </section>

  <section>
    <h2 class="h6">Navigation et onglets</h2>
    <div class="row" style="align-items: flex-start">
      <nav class="sidebar-demo">
        <a class="nav-item nav-item--active" href="#">Tableau de bord</a>
        <a class="nav-item" href="#">Matériel</a>
        <a class="nav-item" href="#">Emprunts <span class="nav-item__count">3</span></a>
        <a class="nav-item" href="#">Utilisateurs</a>
      </nav>
      <div class="card" style="flex: 1">
        <div class="tabs">
          <button class="tab tab--active">Tous <span class="tab__count">42</span></button>
          <button class="tab">En retard <span class="tab__count">3</span></button>
          <button class="tab">Historique</button>
        </div>
        <div class="empty-state">Aucun emprunt pour ce filtre.</div>
      </div>
    </div>
  </section>

  <section>
    <h2 class="h6">Modale, toasts, alertes</h2>
    <div class="row row--wrap">
      <button class="btn btn--primary" id="demo-modal">Ouvrir une modale</button>
      <button class="btn btn--secondary" id="demo-toast">Toast succès</button>
      <button class="btn btn--danger" id="demo-toast-err">Toast erreur</button>
    </div>
    <div class="stack" style="margin-top: var(--space-lg)">
      <div class="alert alert--warning">⚠ 3 retours en retard — relance automatique envoyée aux étudiants.</div>
      <div class="alert alert--error">Le bureau des pédago est fermé.</div>
      <div class="alert alert--info">Réservation à retirer dans l’heure suivant le début.</div>
    </div>
  </section>
</main>

<div id="modal-root"></div>
<div id="toast-root"></div>

<script type="module">
  import { openModal, toast } from './js/ui.js';
  document.getElementById('demo-modal').addEventListener('click', () => openModal({
    title: 'Refuser la réservation',
    body: '<label class="field"><span class="field__label">Motif</span><textarea class="textarea" id="motif"></textarea></label>',
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Refuser', variant: 'danger', onClick: (m) => { if (!m.querySelector('#motif').value.trim()) { toast('Le motif est obligatoire', 'error'); return false; } toast('Réservation refusée', 'success'); } },
    ],
  }));
  document.getElementById('demo-toast').addEventListener('click', () => toast('Emprunt enregistré', 'success'));
  document.getElementById('demo-toast-err').addEventListener('click', () => toast('Vous avez déjà un exemplaire', 'error'));
</script>
</body>
</html>
```

- [ ] **Step 3 : Vérification visuelle contre le Figma**

Run: `python3 -m http.server 8000` puis ouvrir `http://localhost:8000/kit.html`.

Comparer section par section avec les pages Figma (outil `get_screenshot` sur les nœuds `2:107` à `2:115`, ou le fichier ouvert dans Figma) :
- Boutons : pilule, hauteur 44, primaire violet plein, secondaire contour violet.
- Badges : fond pastel + texte coloré + point, 6 variantes.
- KPI : carte blanche / violette / teal, chiffre en Bricolage 40px.
- Table : en-têtes en majuscules 11px gris, lignes séparées par un filet.
- Modale : ouverture, fermeture par la croix et le fond, bouton *Refuser* garde la modale ouverte si le motif est vide.
- Toasts : apparaissent en bas, disparaissent après 3 s.

Ajuster les valeurs de `components.css` (jamais celles de `tokens.css`, sauf erreur de transcription avérée) jusqu'à correspondance raisonnable.

- [ ] **Step 4 : Commit**

```bash
git add css/components.css kit.html
git commit -m "feat: bibliothèque de composants CSS et page kit de vérification"
```

---

### Task 11 : Vérification de fin de phase

**Files:**
- Modify: `README.md` (section « État d'avancement »)

- [ ] **Step 1 : Suite complète**

Run: `npm test`
Expected: `# fail 0`, 61 tests passés (1 + 5 + 13 + 11 + 6 + 8 + 5 + 4 + 6 + 2).

- [ ] **Step 2 : Vérification du store dans le navigateur (propagation entre onglets)**

Ouvrir `http://localhost:8000/kit.html` dans deux onglets. Dans la console du premier :

```js
const { store } = await import('./js/store.js');
const { buildSeed } = await import('./js/seed.js');
store.init(buildSeed);
store.subscribe(() => console.log('changement reçu', store.items.list().length));
```

Dans la console du second, la même chose puis `store.items.create({ nom: 'Test', reference: 'multiprise', circuit: 'self', etat: 'disponible' })`.
Expected : le premier onglet affiche « changement reçu 45 » sans rechargement. Puis dans l'un des deux : `localStorage.clear()` pour repartir propre.

- [ ] **Step 3 : Mettre à jour le README**

Ajouter à la fin de `README.md` :

```markdown
## État d'avancement

- [x] Phase 0 — Fondations (tokens, composants, store, règles, seed)
- [ ] Phase 1 — Admin : inventaire & utilisateurs
- [ ] Phase 2 — Mobile : self-service
- [ ] Phase 3 — Matériel de valeur
- [ ] Phase 4 — Salle photo
- [ ] Phase 5 — Maintenance & paramètres
- [ ] Phase 6 — Déploiement test
```

- [ ] **Step 4 : Commit et étiquette**

```bash
git add README.md
git commit -m "docs: phase 0 terminée"
git tag phase-0
```

- [ ] **Step 5 : Rédiger le plan de la phase 1**

Invoquer le skill `superpowers:writing-plans` avec la feuille de route (`docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`, section Phase 1) et le code réel de la phase 0 comme entrées, pour produire `docs/superpowers/plans/2026-09-17-phase-1-admin-inventaire.md`.

---

## Auto-revue du plan

**Couverture du spec (sections 4, 5, 8, 9 pour cette phase)**
- §4 Modèle : entités et champs → `seed.js` (structure des enregistrements), `store.js` (persistance), `models.js` (états). Les états dérivés (`en_retard`, « sortie non faite ») → `rules.isLate`, `rules.isExitMissing`. ✔
- §5.1 Self : horaires, retour toujours possible, 1 exemplaire, refus → `rules.canBorrowSelf` + `REASONS`. La logique de mutation (photo, checklist, signalement) est en phase 2 (`actions/loans.js`). ✔
- §5.2 Valeur : fenêtre de retrait, expiration, durée max → `rules.pickupWindow/isInPickupWindow/isExpired/canReserveValeur`. Mutations en phase 3. ✔
- §5.3 Salle : contiguïté, conflits, plage horaire, actif, sortie non faite → `rules.slots*`, `bookingStart/End`, `isBookingActive`, `isExitMissing`. Mutations en phase 4. ✔
- §5.4 Maintenance : états et transitions → `models.MAINT_*`. Mutations en phase 5. ✔
- §5.5 Temps : `rules.now()` + `Settings.horlogeDemo`. ✔
- §8 Checklists : toutes les références → `checklists.js`, testé contre la liste du spec. ✔
- §9 Architecture : tokens, base, components, kit, store, seed, models, rules, checklists, log, auth, ui, router, package.json, tests → Tasks 1-10. `scanner.js`, `actions/`, vues, `vendor/`, `manifest.json` → phases suivantes. ✔
- §9 Seed : 45 utilisateurs, inventaire complet, historique (40 passés, 6-8 en cours, 2 retards, 2 réservations, salle en cours + 3 à venir, 1 maintenance ouverte, 1 externe close, 1 HS) → Task 6, testé. ✔

**Placeholders** : aucun « TBD/TODO » ; chaque étape de code contient le code complet.

**Cohérence des noms entre tâches** : `store.<collection>.list/get/create/update/remove` (T3) utilisés par T7 (`store.log.create`, `store.users.get`) ; `now()` (T4) utilisé par T7 ; `buildChecklist`/`buildRoomChecklist` (T5) utilisés par T6 ; `LABELS` (T2) utilisé par T8 ; actions du seed (T6) ⊂ `ACTIONS` (T7), vérifié par test ; `DEFAULT_SETTINGS` (T4) utilisé par T6 et comparé par test.
