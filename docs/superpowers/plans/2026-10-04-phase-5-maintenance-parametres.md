# Phase 5 — Maintenance & paramètres : plan d’exécution

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** donner à la pédagogie le suivi des pannes (signalement → intervention → remise en service) et la maîtrise des réglages (horaires, durées, horloge de démo, espace occupé, réinitialisation), puis rendre le mobile installable sur un téléphone.

**Architecture :** une couche d’actions pure de plus (`js/actions/maintenance.js`) au-dessus du même `store`, deux écrans admin qui remplacent les deux derniers `aVenirView`, et un lot de reprises accumulées depuis la phase 3. Aucune nouvelle dépendance, aucune étape de build : la PWA se résume à un `manifest.json`, deux icônes et des `<meta>`.

**Pile :** HTML/CSS/JS vanilla, modules ES natifs, `localStorage` derrière `js/store.js`, tests `node --test` (Node ≥ 22).

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §5.4 (maintenance), §5.5 (temps), §6 (écrans admin `#/maintenance` et `#/parametres`), §9 (architecture).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`, Phase 5.

**Base :** `main` après l’étiquette `phase-4` (299 tests au vert dans `Europe/Paris` et `TZ=America/New_York`).

## Contraintes globales

- **Aucune dépendance npm, aucune étape de build.** Toute bibliothèque tierce est une copie locale dans `vendor/`.
- Tests : `node --test "tests/**/*.test.mjs"` (glob entre guillemets — `node --test tests/` ne fonctionne pas ici). Node ≥ 22. La suite doit passer aussi sous `TZ=America/New_York`.
- **Toute chaîne destinée à l’utilisateur est en français et utilise l’apostrophe typographique `’` (U+2019), jamais `'` (U+0027).** Les commentaires français aussi. Vérification : `grep -rn "[a-zA-Zàéèêçûô]'[a-zA-Zàéèêçûô]" js/ tests/ --include='*.js' --include='*.mjs'` ne doit rien afficher.
- Persistance uniquement via `js/store.js` (clé `mds-emprunts:v1`), pour pouvoir basculer sur Supabase plus tard. Les enregistrements du store sont gelés : on ne modifie que par `store.x.update(id, patch)`.
- Séparation pur/DOM : `xxxHtml(data)` est pure et testée sous Node ; `xxxView(container, params)` touche le DOM et renvoie une fonction de nettoyage.
- **Aucun timer.** Le temps vient de `now()` (`js/rules.js`), piloté par `settings.horlogeDemo`. Les échéances passent par des balayages idempotents appelés au rendu et dans les gardes de route.
- Couleurs : uniquement des variables de `css/tokens.css`. `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/admin.css css/mobile.css` ne doit rien afficher.
- Chaque écriture passe par `logAction` avec une action déclarée dans `js/log.js`, et chaque action a un libellé dans `ACTION_LABELS`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/actions/maintenance.js` (nouveau) | Signaler, créer une intervention, la faire avancer, la clore ; décide de l’état de l’objet à la clôture du dernier événement ouvert. |
| `js/admin/views/maintenance.js` (nouveau) | Écran `#/maintenance` : les événements par statut, la création d’intervention, la clôture, la liste du matériel immobilisé. |
| `js/admin/views/parametres.js` (nouveau) | Écran `#/parametres` : horaires, durées, règle anti-retard, horloge de démo, jauge d’espace, réinitialisation. |
| `js/admin/demoClock.js` (nouveau) | La carte « horloge de démo », extraite du tableau de bord pour être partagée avec Paramètres sans la dupliquer. |
| `js/scanModal.js` (nouveau) | `openScanModal({ title, hint, label, onCode })` : la modale « scanner ou saisir un code », extraite de `handoverModal.js`. |
| `js/actions/settings.js` | Gagne `updateSettings` (validation des horaires et des durées). |
| `js/admin/kpi.js` | Accueille `exitMissingRows`, qui vivait dans une vue. |
| `js/rules.js` | `openHours` tolérant, libellé `hors_ouverture` dérivé des réglages, `isExitMissing` verrouillé sur `en_cours`. |
| `manifest.json`, `assets/icon-192.png`, `assets/icon-512.png` | PWA : installation sur l’écran d’accueil. |

Chaque tâche se termine par un livrable testable indépendamment.

---

### Task 1 : Actions de maintenance

**Fichiers :**
- Créer : `js/actions/maintenance.js`
- Modifier : `js/log.js` (action `maintenance.en_cours`)
- Test : `tests/actions-maintenance.test.mjs`

**Interfaces :**
- Consomme : `store` (`js/store.js`) ; `MAINT_TYPES`, `MAINT_STATES`, `MAINT_TRANSITIONS`, `ITEM_STATES`, `LABELS` (`js/models.js`) ; `now` (`js/rules.js`) ; `logAction`, `ACTIONS` (`js/log.js`) ; `applyItemState` (`js/actions/items.js`).
- Produit : `openEvents(itemId)`, `reportIssue({ itemId, auteurId, description, loanId, bookingId })`, `createIntervention({ itemId, type, prestataire, cout, description, pedagoId })`, `startIntervention(id, pedagoId)`, `closeEvent(id, pedagoId, { remettreEnService })`, `maintenanceRows(date)`, `immobilises()`.

Spec §5.4 : clore **le dernier** événement ouvert d’un objet le remet `disponible`, ou `hs` si la pédago le décide. Tant qu’il reste un autre événement ouvert, l’objet ne bouge pas.

- [ ] **Étape 1 : écrire le test**

`tests/actions-maintenance.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, MAINT_STATES, MAINT_TYPES } from '../js/models.js';
import {
  openEvents, reportIssue, createIntervention, startIntervention, closeEvent,
  maintenanceRows, immobilises,
} from '../js/actions/maintenance.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';

// Un objet disponible, choisi sans dépendre d’un identifiant du seed.
const itemDispo = () => store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('reportIssue : crée un signalement ouvert et immobilise un objet disponible', () => {
  const item = itemDispo();
  const avant = store.log.list().length;
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Câble d’alimentation manquant' });
  assert.equal(ev.type, MAINT_TYPES.SIGNALEMENT);
  assert.equal(ev.statut, MAINT_STATES.OUVERT);
  assert.equal(ev.itemId, item.id);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(store.log.list().length, avant + 1);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_SIGNALEMENT);
});

test('reportIssue : un objet emprunté n’est pas immobilisé tout de suite', () => {
  const emprunte = store.items.list((i) => i.etat === ITEM_STATES.EMPRUNTE)[0];
  assert.ok(emprunte, 'le seed contient un objet emprunté');
  reportIssue({ itemId: emprunte.id, auteurId: PEDAGO, description: 'Signalé par un tiers' });
  assert.equal(store.items.get(emprunte.id).etat, ITEM_STATES.EMPRUNTE, 'il repartira en maintenance au retour');
});

test('reportIssue : description obligatoire', () => {
  const item = itemDispo();
  assert.throws(() => reportIssue({ itemId: item.id, auteurId: PEDAGO, description: '   ' }), /description/i);
});

test('createIntervention : interne et externe, coût et prestataire', () => {
  const item = itemDispo();
  const interne = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Nettoyage du capteur', pedagoId: PEDAGO });
  assert.equal(interne.statut, MAINT_STATES.OUVERT);
  assert.equal(interne.prestataire, '');
  assert.equal(interne.cout, 0);
  const externe = createIntervention({
    itemId: item.id, type: MAINT_TYPES.EXTERNE, prestataire: 'Objectif Service',
    cout: 120.5, description: 'Révision de la bague', pedagoId: PEDAGO,
  });
  assert.equal(externe.prestataire, 'Objectif Service');
  assert.equal(externe.cout, 120.5);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_INTERVENTION);
  assert.equal(openEvents(item.id).length, 2);
});

test('createIntervention : une externe exige un prestataire, un coût négatif est refusé', () => {
  const item = itemDispo();
  assert.throws(() => createIntervention({ itemId: item.id, type: MAINT_TYPES.EXTERNE, description: 'Révision', pedagoId: PEDAGO }), /prestataire/i);
  assert.throws(() => createIntervention({
    itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Révision', cout: -5, pedagoId: PEDAGO,
  }), /coût/i);
});

test('startIntervention : ouvert → en cours, puis refus de recommencer', () => {
  const item = itemDispo();
  const ev = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Nettoyage', pedagoId: PEDAGO });
  const encours = startIntervention(ev.id, PEDAGO);
  assert.equal(encours.statut, MAINT_STATES.EN_COURS);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_EN_COURS);
  assert.throws(() => startIntervention(ev.id, PEDAGO), /en cours/i);
});

test('closeEvent : le dernier événement ouvert remet l’objet disponible', () => {
  const item = itemDispo();
  const a = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const b = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Démontage', pedagoId: PEDAGO });
  closeEvent(a.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE, 'il reste un événement ouvert');
  const clos = closeEvent(b.id, PEDAGO, { remettreEnService: true });
  assert.equal(clos.statut, MAINT_STATES.CLOS);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_CLOS);
});

test('closeEvent : remettreEnService false passe l’objet hors service', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Écran fendu' });
  closeEvent(ev.id, PEDAGO, { remettreEnService: false });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.HS);
  assert.match(store.log.list().at(-1).detail, /hors service/i);
});

test('closeEvent : un événement sans objet (état des lieux de salle) se clôt sans toucher au matériel', () => {
  const ev = store.maintenance.create({
    itemId: null, bookingId: 'book_0001', type: MAINT_TYPES.SIGNALEMENT, auteurId: PEDAGO,
    date: NOW.toISOString(), statut: MAINT_STATES.OUVERT, description: 'Salle rangée → chaises renversées',
    prestataire: '', cout: 0, loanId: null,
  });
  const clos = closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  assert.equal(clos.statut, MAINT_STATES.CLOS);
});

test('closeEvent : un événement déjà clos est refusé', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test' });
  closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  assert.throws(() => closeEvent(ev.id, PEDAGO, { remettreEnService: true }), /déjà clos/i);
});

test('closeEvent : une seule notification pour la clôture et le changement d’état', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test' });
  let n = 0;
  const off = store.subscribe(() => { n += 1; });
  closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  off();
  assert.equal(n, 1);
});

test('maintenanceRows : joint objet et auteur, ouverts d’abord, plus récents en tête', () => {
  const item = itemDispo();
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Récent' });
  const rows = maintenanceRows();
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].event.description, 'Récent');
  assert.equal(rows[0].item.id, item.id);
  assert.equal(rows[0].auteur.id, PEDAGO);
  const statuts = rows.map((r) => r.event.statut);
  const dernierOuvert = statuts.lastIndexOf(MAINT_STATES.OUVERT);
  const premierClos = statuts.indexOf(MAINT_STATES.CLOS);
  if (premierClos !== -1) assert.ok(dernierOuvert < premierClos, 'les clos passent après les ouverts');
});

test('immobilises : matériel en maintenance ou hors service, avec ses événements ouverts', () => {
  const item = itemDispo();
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const rows = immobilises();
  const ligne = rows.find((r) => r.item.id === item.id);
  assert.ok(ligne, 'l’objet immobilisé est listé');
  assert.equal(ligne.ouverts.length, 1);
  assert.ok(rows.every((r) => r.item.etat === ITEM_STATES.MAINTENANCE || r.item.etat === ITEM_STATES.HS));
});
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

Run: `node --test tests/actions-maintenance.test.mjs`
Attendu : `ERR_MODULE_NOT_FOUND` sur `js/actions/maintenance.js`.

- [ ] **Étape 3 : déclarer l’action manquante**

`js/log.js` — la ligne des actions de maintenance devient :

```js
  MAINT_SIGNALEMENT: 'maintenance.signalement', MAINT_INTERVENTION: 'maintenance.intervention',
  MAINT_EN_COURS: 'maintenance.en_cours', MAINT_CLOS: 'maintenance.clos',
```

et `ACTION_LABELS` gagne, à côté des autres :

```js
  'maintenance.en_cours': 'Intervention en cours',
```

- [ ] **Étape 4 : écrire `js/actions/maintenance.js`**

```js
// js/actions/maintenance.js — cycle de vie des pannes : signalement, intervention, clôture.
// Spec §5.4 : clore le DERNIER événement ouvert d’un objet le remet en service (ou hors service).
import { store } from '../store.js';
import { MAINT_TYPES, MAINT_STATES, ITEM_STATES, LABELS } from '../models.js';
import { now } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';

function requireEvent(id) {
  const event = store.maintenance.get(id);
  if (!event) throw new Error('Événement de maintenance introuvable.');
  return event;
}

function requireItem(id) {
  const item = store.items.get(id);
  if (!item) throw new Error('Matériel introuvable.');
  return item;
}

function cleanText(value, champ) {
  const texte = String(value ?? '').trim();
  if (!texte) throw new Error(`La ${champ} est obligatoire.`);
  return texte;
}

// Les événements encore à traiter d’un objet : ouverts ou en cours.
export function openEvents(itemId) {
  return store.maintenance.list((m) => m.itemId === itemId && m.statut !== MAINT_STATES.CLOS);
}

// Un objet disponible part en maintenance dès le signalement ; emprunté ou réservé, il
// y partira à son retour (c’est `receiveLoan` qui s’en charge). Hors service, on n’y touche pas.
function immobiliser(itemId) {
  if (!itemId) return;
  const item = store.items.get(itemId);
  if (item && item.etat === ITEM_STATES.DISPONIBLE) applyItemState(itemId, ITEM_STATES.MAINTENANCE);
}

export function reportIssue({ itemId, auteurId, description, loanId = null, bookingId = null }) {
  const texte = cleanText(description, 'description');
  if (itemId) requireItem(itemId);
  const date = now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId: itemId || null, type: MAINT_TYPES.SIGNALEMENT, auteurId, date: date.toISOString(),
      statut: MAINT_STATES.OUVERT, description: texte, prestataire: '', cout: 0,
      loanId, bookingId,
    });
    immobiliser(itemId);
    logAction({ auteurId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: itemId || null, loanId, bookingId, detail: texte });
    return event;
  });
}

export function createIntervention({ itemId, type, prestataire = '', cout = 0, description, pedagoId }) {
  const item = requireItem(itemId);
  const texte = cleanText(description, 'description');
  if (type !== MAINT_TYPES.INTERNE && type !== MAINT_TYPES.EXTERNE) throw new Error('Type d’intervention inconnu.');
  const fournisseur = String(prestataire || '').trim();
  if (type === MAINT_TYPES.EXTERNE && !fournisseur) throw new Error('Une intervention externe demande un prestataire.');
  const montant = Number(cout) || 0;
  if (montant < 0) throw new Error('Le coût ne peut pas être négatif.');
  const date = now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId, type, auteurId: pedagoId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description: texte, prestataire: type === MAINT_TYPES.EXTERNE ? fournisseur : '', cout: montant,
      loanId: null, bookingId: null,
    });
    immobiliser(itemId);
    const suffixe = type === MAINT_TYPES.EXTERNE ? ` — ${fournisseur}${montant ? ` (${montant} €)` : ''}` : '';
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_INTERVENTION, itemId, detail: `${item.nom} : ${texte}${suffixe}` });
    return event;
  });
}

export function startIntervention(id, pedagoId) {
  const event = requireEvent(id);
  if (event.statut !== MAINT_STATES.OUVERT) {
    throw new Error(event.statut === MAINT_STATES.EN_COURS ? 'Cette intervention est déjà en cours.' : 'Cet événement est déjà clos.');
  }
  return store.transaction(() => {
    const updated = store.maintenance.update(id, { statut: MAINT_STATES.EN_COURS });
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_EN_COURS, itemId: event.itemId, detail: event.description });
    return updated;
  });
}

// Depuis quels états la clôture peut décider du sort de l’objet : un objet emprunté ou réservé
// n’est pas à nous — son retour le remettra dans le circuit.
const MAINT_RESOLVABLE = [ITEM_STATES.MAINTENANCE, ITEM_STATES.HS];

// `remettreEnService: false` → l’objet passe `hs` (définitif, masqué du catalogue, gardé à l’inventaire).
export function closeEvent(id, pedagoId, { remettreEnService = true } = {}) {
  const event = requireEvent(id);
  if (event.statut === MAINT_STATES.CLOS) throw new Error('Cet événement est déjà clos.');
  return store.transaction(() => {
    const updated = store.maintenance.update(id, { statut: MAINT_STATES.CLOS });
    let suffixe = '';
    // Le dernier événement ouvert de l’objet décide de son sort ; sinon on ne touche à rien.
    if (event.itemId && openEvents(event.itemId).length === 0) {
      const item = store.items.get(event.itemId);
      const cible = remettreEnService ? ITEM_STATES.DISPONIBLE : ITEM_STATES.HS;
      if (item && item.etat !== cible && MAINT_RESOLVABLE.includes(item.etat)) {
        applyItemState(event.itemId, cible);
        suffixe = ` — ${LABELS.itemState[cible].toLowerCase()}`;
      }
    }
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_CLOS, itemId: event.itemId, detail: `${event.description}${suffixe}` });
    return updated;
  });
}


const RANG = { [MAINT_STATES.OUVERT]: 0, [MAINT_STATES.EN_COURS]: 1, [MAINT_STATES.CLOS]: 2 };

// Lignes de l’écran Maintenance : à traiter d’abord, plus récentes en tête.
export function maintenanceRows() {
  const items = store.items.list();
  const users = store.users.list();
  return store.maintenance.list()
    .map((event) => ({
      event,
      item: items.find((i) => i.id === event.itemId) || null,
      auteur: users.find((u) => u.id === event.auteurId) || null,
    }))
    .sort((a, b) => (RANG[a.event.statut] - RANG[b.event.statut]) || b.event.date.localeCompare(a.event.date));
}

// Matériel immobilisé : en maintenance ou hors service, avec ce qui reste à traiter.
export function immobilises() {
  return store.items
    .list((i) => i.etat === ITEM_STATES.MAINTENANCE || i.etat === ITEM_STATES.HS)
    .map((item) => ({ item, ouverts: openEvents(item.id) }))
    .sort((a, b) => a.item.nom.localeCompare(b.item.nom, 'fr'));
}
```


- [ ] **Étape 5 : lancer les tests**

Run: `node --test tests/actions-maintenance.test.mjs`
Attendu : 0 échec, 13 tests.

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 6 : commit**

```bash
git add js/actions/maintenance.js js/log.js tests/actions-maintenance.test.mjs
git commit -m "feat(actions): signalements, interventions et clôture de la maintenance"
```

---

### Task 2 : Écran admin Maintenance

**Fichiers :**
- Créer : `js/admin/views/maintenance.js`
- Modifier : `js/admin/app.js` (route `/maintenance`), `js/admin/kpi.js` (accueille `exitMissingRows`), `js/admin/views/salle.js` (réexporte depuis `kpi.js`), `js/admin/views/dashboard.js` (import déplacé), `css/admin.css`
- Test : `tests/admin-maintenance.test.mjs`, `tests/admin-salle.test.mjs` (import mis à jour)

**Interfaces :**
- Consomme : `maintenanceRows`, `immobilises`, `createIntervention`, `startIntervention`, `closeEvent` (`js/actions/maintenance.js`) ; `renderTable`, `bindTable`, `sortRows`, `toggleSort` (`js/admin/table.js`) ; `escapeHtml`, `badge`, `avatar`, `fullName`, `formatDate`, `openModal`, `toast` (`js/ui.js`) ; `setTopbar` (`js/admin/layout.js`) ; `MAINT_STATES`, `MAINT_TYPES`, `LABELS` (`js/models.js`) ; `auth`, `navigate`, `store`, `now`.
- Produit : `eventsTableHtml({ rows, filtre })`, `immobilisesHtml(rows)`, `maintenanceHtml({ rows, bloques, filtre })`, `interventionFormHtml(item)`, `readInterventionForm(root)`, `maintenanceView(container)`.

Spec §6 : « Liste des événements par statut · *Créer une intervention* · *Clôturer* · vue “Matériel en maintenance / HS” ».

Reprise de la phase 4 : `exitMissingRows` quitte `js/admin/views/salle.js` pour `js/admin/kpi.js`, où vivent déjà `openReports`, `lateLoans` et `dueTodayReservations`. Le tableau de bord importait un module de **vue** pour un sélecteur pur, ce qui traînait `auth` et `layout` dans son graphe.

- [ ] **Étape 1 : déplacer `exitMissingRows` vers `kpi.js`**

Couper la fonction de `js/admin/views/salle.js` et la coller à la fin de `js/admin/kpi.js`, en y ajoutant les imports nécessaires (`BOOKING_STATES` depuis `../models.js` et `isExitMissing` depuis `../rules.js` — `ymd` et `isLate` y sont déjà) :

```js
// Créneaux dont l’état des lieux de sortie manque depuis plus d’une heure (spec §6).
export function exitMissingRows(bookings, users, date) {
  return bookings
    .filter((b) => b.statut === BOOKING_STATES.EN_COURS && isExitMissing(b, date))
    .map((booking) => ({ booking, user: users.find((u) => u.id === booking.userId) || null }))
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date));
}
```

Dans `js/admin/views/salle.js` : retirer la fonction et importer `exitMissingRows` depuis `../kpi.js` (la vue l’utilise toujours pour son bandeau). Dans `js/admin/views/dashboard.js` : remplacer `import { exitMissingRows } from './salle.js';` par un ajout à l’import existant de `../kpi.js`. Dans `tests/admin-salle.test.mjs` : importer `exitMissingRows` depuis `../js/admin/kpi.js` au lieu de la vue.

Après ce déplacement, `js/admin/views/salle.js` n’utilise plus `BOOKING_STATES` que pour `bookingDetailHtml` — vérifie avant de toucher aux imports, et ne retire que ce qui est réellement inutilisé.

- [ ] **Étape 2 : écrire le test**

`tests/admin-maintenance.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ITEM_STATES, MAINT_STATES, MAINT_TYPES } from '../js/models.js';
import { maintenanceRows, immobilises, reportIssue } from '../js/actions/maintenance.js';
import { eventsTableHtml, immobilisesHtml, maintenanceHtml, interventionFormHtml } from '../js/admin/views/maintenance.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('eventsTableHtml : une ligne par événement, badge de statut, actions selon le statut', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const html = eventsTableHtml({ rows: maintenanceRows(), filtre: 'tous' });
  assert.match(html, /Bague grippée/);
  assert.match(html, new RegExp(`data-start="${ev.id}"`), 'un événement ouvert peut démarrer');
  assert.match(html, new RegExp(`data-close="${ev.id}"`), 'un événement ouvert peut être clos');
  const clos = maintenanceRows().filter((r) => r.event.statut === MAINT_STATES.CLOS);
  assert.ok(clos.length, 'le seed contient des événements clos');
  assert.doesNotMatch(html, new RegExp(`data-close="${clos[0].event.id}"`), 'un événement clos n’a plus d’action');
});

test('eventsTableHtml : le filtre ne garde que le statut demandé', () => {
  const rows = maintenanceRows();
  const html = eventsTableHtml({ rows, filtre: MAINT_STATES.OUVERT });
  const ouverts = rows.filter((r) => r.event.statut === MAINT_STATES.OUVERT);
  const clos = rows.filter((r) => r.event.statut === MAINT_STATES.CLOS);
  assert.ok(ouverts.length && clos.length, 'le seed a des deux');
  assert.match(html, new RegExp(ouverts[0].event.id));
  assert.doesNotMatch(html, new RegExp(clos[0].event.id));
});

test('eventsTableHtml : état vide explicite', () => {
  assert.match(eventsTableHtml({ rows: [], filtre: 'tous' }), /Aucun événement/);
});

test('eventsTableHtml : un signalement sans objet reste lisible', () => {
  const ev = store.maintenance.create({
    itemId: null, bookingId: 'book_0001', type: MAINT_TYPES.SIGNALEMENT, auteurId: PEDAGO,
    date: NOW.toISOString(), statut: MAINT_STATES.OUVERT, description: 'Salle rangée → chaises renversées',
    prestataire: '', cout: 0, loanId: null,
  });
  const html = eventsTableHtml({ rows: maintenanceRows(), filtre: 'tous' });
  assert.match(html, /Salle photo — état des lieux/);
  assert.doesNotMatch(html, /\/materiel\/null/);
  assert.match(html, new RegExp(`data-close="${ev.id}"`));
});

test('immobilisesHtml : objets en maintenance et hors service, avec le nombre à traiter', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const html = immobilisesHtml(immobilises());
  assert.match(html, new RegExp(item.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /1 à traiter/);
  assert.match(html, new RegExp(`/materiel/${item.id}`));
});

test('immobilisesHtml : état vide', () => {
  assert.match(immobilisesHtml([]), /Aucun matériel immobilisé/);
});

test('maintenanceHtml : onglets de statut, compteur et les deux sections', () => {
  const html = maintenanceHtml({ rows: maintenanceRows(), bloques: immobilises(), filtre: MAINT_STATES.OUVERT });
  assert.match(html, /data-filtre="tous"/);
  assert.match(html, /data-filtre="ouvert" class="[^"]*is-active/);
  assert.match(html, /Matériel immobilisé/);
  assert.match(html, /data-action="new-intervention"/);
});

test('interventionFormHtml : type, prestataire, coût, description', () => {
  const item = store.items.list()[0];
  const html = interventionFormHtml(item);
  assert.match(html, new RegExp(item.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /name="type"/);
  assert.match(html, new RegExp(`value="${MAINT_TYPES.EXTERNE}"`));
  assert.match(html, /name="prestataire"/);
  assert.match(html, /name="cout"/);
  assert.match(html, /name="description"/);
});
```

- [ ] **Étape 3 : lancer le test pour le voir échouer**

Run: `node --test tests/admin-maintenance.test.mjs`
Attendu : `ERR_MODULE_NOT_FOUND` sur `js/admin/views/maintenance.js`.

- [ ] **Étape 4 : écrire `js/admin/views/maintenance.js`**

```js
// js/admin/views/maintenance.js — écran Maintenance : les événements par statut,
// la création et la clôture d’interventions, et le matériel immobilisé.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now } from '../../rules.js';
import { navigate } from '../../router.js';
import { MAINT_STATES, MAINT_TYPES, LABELS } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, formatDate, openModal, toast } from '../../ui.js';
import { createIntervention, startIntervention, closeEvent, maintenanceRows, immobilises } from '../../actions/maintenance.js';
import { setTopbar } from '../layout.js';

const FILTRES = [
  { key: 'tous', label: 'Tous' },
  { key: MAINT_STATES.OUVERT, label: 'Ouverts' },
  { key: MAINT_STATES.EN_COURS, label: 'En cours' },
  { key: MAINT_STATES.CLOS, label: 'Clos' },
];

// Un signalement d’état des lieux de salle n’a pas d’objet : il garde un titre lisible
// et pointe vers le planning plutôt que vers une fiche matériel inexistante.
function titreEtLien({ event, item }) {
  if (item) return { titre: item.nom, href: `/materiel/${item.id}` };
  if (event.bookingId) return { titre: 'Salle photo — état des lieux', href: '/salle' };
  return { titre: 'Sans objet', href: null };
}

function coutHtml(event) {
  if (!event.cout) return '';
  return `<span class="body-tiny text-secondary">${escapeHtml(String(event.cout))} €</span>`;
}

export function eventsTableHtml({ rows, filtre }) {
  const visibles = filtre === 'tous' ? rows : rows.filter((r) => r.event.statut === filtre);
  if (!visibles.length) return '<div class="empty-state">Aucun événement pour ce filtre.</div>';
  const lignes = visibles.map((row) => {
    const { event, auteur } = row;
    const { titre, href } = titreEtLien(row);
    const actions = [
      event.statut === MAINT_STATES.OUVERT ? `<button type="button" class="btn btn--secondary btn--sm" data-start="${escapeHtml(event.id)}">Démarrer</button>` : '',
      event.statut !== MAINT_STATES.CLOS ? `<button type="button" class="btn btn--primary btn--sm" data-close="${escapeHtml(event.id)}">Clôturer</button>` : '',
    ].join('');
    return `
      <tr${href ? ` data-href="${escapeHtml(href)}"` : ''}>
        <td><strong>${escapeHtml(titre)}</strong><span class="activity__detail">${escapeHtml(event.description)}</span></td>
        <td>${escapeHtml(LABELS.maintType?.[event.type] || event.type)}${event.prestataire ? `<span class="activity__detail">${escapeHtml(event.prestataire)}</span>` : ''}${coutHtml(event)}</td>
        <td>${escapeHtml(formatDate(event.date))}${auteur ? `<span class="activity__detail">${escapeHtml(fullName(auteur))}</span>` : ''}</td>
        <td>${badge('maint', event.statut)}</td>
        <td><div class="table__actions">${actions}</div></td>
      </tr>`;
  }).join('');
  return `
    <table class="table">
      <thead><tr><th>Objet</th><th>Type</th><th>Date</th><th>Statut</th><th></th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>`;
}

export function immobilisesHtml(rows) {
  if (!rows.length) return '<div class="empty-state">Aucun matériel immobilisé.</div>';
  return `<div class="list">${rows.map(({ item, ouverts }) => `
    <div class="list__item" data-href="/materiel/${escapeHtml(item.id)}">
      <div class="list__grow"><strong>${escapeHtml(item.nom)}</strong><span class="activity__detail">${ouverts.length ? `${ouverts.length} à traiter` : 'rien à traiter'}</span></div>
      ${badge('item', item.etat)}
    </div>`).join('')}</div>`;
}

export function maintenanceHtml({ rows, bloques, filtre }) {
  const onglets = FILTRES.map((f) => {
    const n = f.key === 'tous' ? rows.length : rows.filter((r) => r.event.statut === f.key).length;
    return `<button type="button" data-filtre="${f.key}" class="tab${f.key === filtre ? ' is-active' : ''}">${escapeHtml(f.label)} <span class="tab__count">${n}</span></button>`;
  }).join('');
  return `
    <div class="grid-2">
      <div class="card">
        <div class="card__header">
          <div class="tabs">${onglets}</div>
          <button type="button" class="btn btn--primary btn--sm" data-action="new-intervention">Créer une intervention</button>
        </div>
        <div data-role="events">${eventsTableHtml({ rows, filtre })}</div>
      </div>
      <div class="card">
        <div class="card__header"><h2 class="card__title">Matériel immobilisé</h2><span class="body-sm text-secondary">${bloques.length}</span></div>
        ${immobilisesHtml(bloques)}
      </div>
    </div>`;
}

const TYPES = [
  { value: MAINT_TYPES.INTERNE, label: 'Interne' },
  { value: MAINT_TYPES.EXTERNE, label: 'Externe (prestataire)' },
];

// `item` null = l’objet reste à choisir dans la liste.
export function interventionFormHtml(item = null, items = []) {
  const choixObjet = item
    ? `<p class="body-sm"><strong>${escapeHtml(item.nom)}</strong></p><input type="hidden" name="itemId" value="${escapeHtml(item.id)}">`
    : `<label class="field"><span class="field__label">Matériel</span><select class="select" name="itemId">${items.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.nom)}</option>`).join('')}</select></label>`;
  return `
    <div class="stack">
      ${choixObjet}
      <label class="field"><span class="field__label">Type</span><select class="select" name="type">${TYPES.map((t) => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('')}</select></label>
      <label class="field"><span class="field__label">Prestataire (intervention externe)</span><input class="input" name="prestataire" placeholder="Objectif Service"></label>
      <label class="field"><span class="field__label">Coût en euros</span><input class="input" name="cout" type="number" min="0" step="0.01" value="0"></label>
      <label class="field"><span class="field__label">Description</span><textarea class="textarea" name="description" placeholder="Révision de la bague"></textarea></label>
    </div>`;
}

export function readInterventionForm(root) {
  const val = (name) => root.querySelector(`[name="${name}"]`)?.value ?? '';
  return {
    itemId: val('itemId'),
    type: val('type'),
    prestataire: val('prestataire').trim(),
    cout: Number(val('cout')) || 0,
    description: val('description').trim(),
  };
}

export function maintenanceView(container) {
  let filtre = MAINT_STATES.OUVERT;
  const render = () => {
    const rows = maintenanceRows();
    const bloques = immobilises();
    setTopbar({ title: 'Maintenance', subtitle: `${rows.filter((r) => r.event.statut !== MAINT_STATES.CLOS).length} à traiter` });
    container.innerHTML = maintenanceHtml({ rows, bloques, filtre });
    container.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; render(); }));
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      navigate(el.dataset.href);
    }));
    container.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { startIntervention(b.dataset.start, auth.currentUserId()); toast('Intervention démarrée', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    }));
    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.close;
      const event = store.maintenance.get(id);
      const avecObjet = !!(event && event.itemId);
      openModal({
        title: 'Clôturer l’événement',
        body: avecObjet
          ? '<p class="body-sm">Si c’est le dernier événement ouvert de cet objet, il repart dans le circuit. Choisissez « Hors service » s’il ne doit plus être emprunté.</p>'
          : '<p class="body-sm">Cet événement ne porte sur aucun objet : la clôture ne change rien à l’inventaire.</p>',
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          ...(avecObjet ? [{ label: 'Hors service', variant: 'danger', onClick: () => {
            try { closeEvent(id, auth.currentUserId(), { remettreEnService: false }); toast('Matériel passé hors service', 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } }] : []),
          { label: avecObjet ? 'Remettre en service' : 'Clôturer', variant: 'primary', onClick: () => {
            try { closeEvent(id, auth.currentUserId(), { remettreEnService: true }); toast('Événement clos', 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    }));
    container.querySelector('[data-action="new-intervention"]').addEventListener('click', () => {
      const items = store.items.list().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      openModal({
        title: 'Créer une intervention',
        body: interventionFormHtml(null, items),
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Créer', variant: 'primary', onClick: (modal) => {
            try {
              createIntervention({ ...readInterventionForm(modal), pedagoId: auth.currentUserId() });
              toast('Intervention créée', 'success');
            } catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    });
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Étape 5 : libellés, route et CSS**

`js/models.js` — `LABELS` gagne la famille des types de maintenance, à côté de `maintState` :

```js
  maintType: {
    signalement: 'Signalement', intervention_interne: 'Interne',
    intervention_externe: 'Externe', remise_en_service: 'Remise en service',
  },
```

`js/admin/app.js` : `import { maintenanceView } from './views/maintenance.js';` et la route devient `{ path: '/maintenance', view: guard(maintenanceView) }`.

`css/admin.css`, à la suite des règles existantes :

```css
.tabs { display: flex; gap: var(--space-xs); }
.tab { border: var(--stroke-thin) solid var(--border-default); background: var(--bg-surface); border-radius: var(--radius-pill); padding: var(--space-xs) var(--space-md); font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.tab:hover { border-color: var(--border-brand); }
.tab.is-active { background: var(--brand-primary); border-color: var(--brand-primary); color: var(--text-on-brand); }
.tab__count { opacity: 0.7; font-variant-numeric: tabular-nums; }
```

- [ ] **Étape 6 : lancer les tests**

Run: `node --test tests/admin-maintenance.test.mjs tests/admin-salle.test.mjs tests/admin-dashboard.test.mjs`
Attendu : 0 échec.

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 7 : vérifier dans le navigateur** (contrôleur)

Admin → Maintenance : les onglets filtrent, « Créer une intervention » enregistre et la ligne apparaît en tête, « Démarrer » passe le badge en *En cours*, « Clôturer » propose *Remettre en service* / *Hors service* et l’objet change d’état dans la colonne de droite. Le signalement de salle sans objet affiche « Salle photo — état des lieux » et mène au planning.

- [ ] **Étape 8 : commit**

```bash
git add js/admin/views/maintenance.js js/admin/views/salle.js js/admin/views/dashboard.js js/admin/kpi.js js/admin/app.js js/models.js css/admin.css tests/admin-maintenance.test.mjs tests/admin-salle.test.mjs
git commit -m "feat(admin): écran de maintenance, interventions et matériel immobilisé"
```

---

### Task 3 : Écran admin Paramètres, horloge partagée, horaires robustes

**Fichiers :**
- Créer : `js/admin/demoClock.js`, `js/admin/views/parametres.js`
- Modifier : `js/rules.js` (`openHours`, libellé `hors_ouverture` dérivé), `js/actions/settings.js` (`updateSettings`), `js/admin/views/dashboard.js` (consomme le module partagé), `js/admin/app.js` (route), `css/admin.css`
- Test : `tests/admin-parametres.test.mjs`, `tests/rules.test.mjs` (horaires), `tests/actions-settings.test.mjs`

**Interfaces :**
- Produit : `demoClockHtml({ date, horlogeDemo, status })` et `bindDemoClock(root, { date })` (`js/admin/demoClock.js`) ; `openHours(settings)` et `reasonLabel(reason, settings)` (`js/rules.js`) ; `updateSettings(patch, pedagoId)` (`js/actions/settings.js`) ; `usageHtml(usage)`, `settingsFormHtml(settings)`, `readSettingsForm(root)`, `parametresHtml({ settings, usage, date, horlogeDemo, status })`, `parametresView(container)` (`js/admin/views/parametres.js`).

Deux reprises **doivent** venir avec cette tâche, parce que c’est elle qui rend leur défaut atteignable : dès que la pédago peut modifier les horaires, `isOfficeOpen` peut recevoir une liste vide ou des heures fractionnaires, et le message « Le retrait doit tomber pendant les heures d’ouverture du bureau (jours ouvrés, 8h-12h et 13h-17h) » devient faux.

La carte « horloge de démo » n’est pas dupliquée : elle sort du tableau de bord dans `js/admin/demoClock.js` et les deux écrans l’affichent. Spec §6 la demande dans `#/parametres` ; l’expérience de la phase 4 dit qu’elle doit rester sur le tableau de bord, où on la cherche en pleine démonstration.

- [ ] **Étape 1 : écrire les tests**

`tests/admin-parametres.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS } from '../js/rules.js';
import { officeStatus } from '../js/actions/settings.js';
import { usageHtml, settingsFormHtml, parametresHtml } from '../js/admin/views/parametres.js';
import { demoClockHtml } from '../js/admin/demoClock.js';

const NOW = new Date(2026, 8, 17, 10, 0);

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('usageHtml : jauge, pourcentage et taille lisible', () => {
  const html = usageHtml({ bytes: 1024 * 1024, budget: 5 * 1024 * 1024, percent: 20 });
  assert.match(html, /20 ?%/);
  assert.match(html, /1(,0)? Mo/);
  assert.match(html, /value="20"|style="[^"]*20%/, 'la jauge reflète le pourcentage');
});

test('usageHtml : alerte au-delà de 80 %', () => {
  assert.doesNotMatch(usageHtml({ bytes: 1, budget: 100, percent: 50 }), /alert--warning/);
  assert.match(usageHtml({ bytes: 90, budget: 100, percent: 90 }), /alert--warning/);
});

test('settingsFormHtml : les champs portent les valeurs courantes', () => {
  const html = settingsFormHtml({ ...DEFAULT_SETTINGS, dureeMaxReservationJours: 7, bloquerSiRetard: false });
  assert.match(html, /name="matinDebut"[^>]*value="8"/);
  assert.match(html, /name="matinFin"[^>]*value="12"/);
  assert.match(html, /name="apresMidiDebut"[^>]*value="13"/);
  assert.match(html, /name="apresMidiFin"[^>]*value="17"/);
  assert.match(html, /name="dureeMaxReservationJours"[^>]*value="7"/);
  assert.match(html, /name="fenetreRetraitMinutes"[^>]*value="60"/);
  assert.match(html, /name="bloquerSiRetard"(?![^>]*checked)/, 'la case suit le réglage');
  assert.match(html, /name="salleHeureDebut"[^>]*value="8"/);
  assert.match(html, /name="salleHeureFin"[^>]*value="17"/);
});

test('parametresHtml : les trois cartes et le bouton de réinitialisation', () => {
  const html = parametresHtml({
    settings: DEFAULT_SETTINGS, usage: { bytes: 10, budget: 100, percent: 10 },
    date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, DEFAULT_SETTINGS),
  });
  assert.match(html, /Horloge de démonstration/);
  assert.match(html, /Règles d’emprunt/);
  assert.match(html, /Espace occupé/);
  assert.match(html, /data-action="save-settings"/);
  assert.match(html, /data-action="reset-demo"/);
});

test('demoClockHtml : badge, état du bureau et champ pré-rempli', () => {
  const html = demoClockHtml({ date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, DEFAULT_SETTINGS) });
  assert.match(html, /Horloge simulée/);
  assert.match(html, /value="2026-09-17T10:00"/);
  assert.match(html, /data-action="set-clock"/);
  const reel = demoClockHtml({ date: NOW, horlogeDemo: null, status: officeStatus(NOW, DEFAULT_SETTINGS) });
  assert.match(reel, /Temps réel/);
  assert.match(reel, /data-action="real-clock"[^>]*disabled/);
});
```

`tests/actions-settings.test.mjs` — ajouter `updateSettings` à l’import existant depuis `../js/actions/settings.js`, puis ajouter à la fin du fichier :

```js
test('updateSettings : enregistre des horaires valides et journalise', () => {
  const avant = store.log.list().length;
  const s = updateSettings({ horaires: [{ debut: 9, fin: 12 }, { debut: 14, fin: 18 }], dureeMaxReservationJours: 7 }, PEDAGO);
  assert.deepEqual(s.horaires, [{ debut: 9, fin: 12 }, { debut: 14, fin: 18 }]);
  assert.equal(s.dureeMaxReservationJours, 7);
  assert.equal(store.log.list().length, avant + 1);
  assert.equal(store.log.list().at(-1).action, ACTIONS.SETTINGS_MODIFIES);
});

test('updateSettings : refuse une plage inversée, une liste vide et une durée nulle', () => {
  assert.throws(() => updateSettings({ horaires: [{ debut: 12, fin: 9 }] }, PEDAGO), /plage horaire/i);
  assert.throws(() => updateSettings({ horaires: [] }, PEDAGO), /au moins une plage/i);
  assert.throws(() => updateSettings({ dureeMaxReservationJours: 0 }, PEDAGO), /durée/i);
  assert.throws(() => updateSettings({ fenetreRetraitMinutes: 0 }, PEDAGO), /fenêtre/i);
  assert.throws(() => updateSettings({ salle: { heureDebut: 17, heureFin: 8 } }, PEDAGO), /salle/i);
});

test('updateSettings : ne touche pas à l’horloge de démo', () => {
  const horloge = store.settings.get().horlogeDemo;
  updateSettings({ dureeMaxReservationJours: 4 }, PEDAGO);
  assert.equal(store.settings.get().horlogeDemo, horloge);
});
```

`tests/rules.test.mjs` — ajouter `openHours`, `reasonLabel` et `formatOpenHours` à l’import groupé depuis `../js/rules.js`, puis ajouter à la fin :

```js
test('openHours : tolère une liste nulle, vide ou mal formée', () => {
  assert.deepEqual(openHours(null), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [] }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: null }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [{ debut: 9, fin: 'midi' }] }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [{ debut: 9.5, fin: 12 }] }), [{ debut: 9.5, fin: 12 }]);
});

test('isOfficeOpen : horaires fractionnaires et réglages cassés', () => {
  const S = { horaires: [{ debut: 9.5, fin: 12 }] };
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 9, 20), S.horaires), false);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 9, 40), S.horaires), true);
  // Une liste vide retombe sur les horaires par défaut au lieu de fermer le bureau pour toujours.
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 10, 0), []), true);
});

test('reasonLabel : le message hors ouverture reprend les horaires réglés', () => {
  const S = { horaires: [{ debut: 9, fin: 12 }, { debut: 14, fin: 18 }] };
  const texte = reasonLabel(REASONS.HORS_OUVERTURE, S);
  assert.match(texte, /9h-12h/);
  assert.match(texte, /14h-18h/);
  assert.doesNotMatch(texte, /8h-12h/);
  // Sans réglages, le libellé statique reste celui de REASON_LABELS.
  assert.equal(reasonLabel(REASONS.BUREAU_FERME), REASON_LABELS[REASONS.BUREAU_FERME]);
});
```

- [ ] **Étape 2 : lancer les tests pour les voir échouer**

Run: `node --test tests/admin-parametres.test.mjs tests/rules.test.mjs tests/actions-settings.test.mjs`
Attendu : `ERR_MODULE_NOT_FOUND` pour `parametres.js`/`demoClock.js`, et des exports manquants (`openHours`, `reasonLabel`, `updateSettings`).

- [ ] **Étape 3 : `js/rules.js` — horaires robustes et libellé dérivé**

Ajouter, à côté de `withDefaults` :

```js
// Les horaires viennent des réglages, que la pédago peut modifier : une liste absente,
// vide ou mal formée retombe sur la valeur par défaut plutôt que de fermer le bureau pour toujours.
export function openHours(settings) {
  const brut = (settings && settings.horaires) || null;
  if (!Array.isArray(brut) || !brut.length) return DEFAULT_SETTINGS.horaires;
  const plages = brut.filter((r) => r && Number.isFinite(Number(r.debut)) && Number.isFinite(Number(r.fin)) && Number(r.debut) < Number(r.fin))
    .map((r) => ({ debut: Number(r.debut), fin: Number(r.fin) }));
  return plages.length ? plages : DEFAULT_SETTINGS.horaires;
}
```

`isOfficeOpen` s’appuie dessus :

```js
export function isOfficeOpen(date, horaires) {
  const h0 = openHours({ horaires });
  const d = toDate(date);
  if (!isWeekday(d)) return false;
  const h = d.getHours() + d.getMinutes() / 60;
  return h0.some((r) => h >= r.debut && h < r.fin);
}
```

Et le libellé de refus cesse de mentir sur les horaires :

```js
// Les heures réglées, écrites comme on les lit : « 8h-12h et 13h-17h », « 9h30-12h ».
function formatHeure(h) {
  const entier = Math.floor(h);
  const minutes = Math.round((h - entier) * 60);
  return minutes ? `${entier}h${String(minutes).padStart(2, '0')}` : `${entier}h`;
}

export function formatOpenHours(settings) {
  return openHours(settings).map((r) => `${formatHeure(r.debut)}-${formatHeure(r.fin)}`).join(' et ');
}

// Le message d’un refus. `hors_ouverture` et `bureau_ferme` citent les horaires RÉGLÉS ;
// les autres gardent le texte figé de REASON_LABELS.
export function reasonLabel(reason, settings = null) {
  if (!settings) return REASON_LABELS[reason] || '';
  if (reason === REASONS.HORS_OUVERTURE) {
    return `Le retrait doit tomber pendant les heures d’ouverture du bureau (jours ouvrés, ${formatOpenHours(settings)}).`;
  }
  if (reason === REASONS.BUREAU_FERME) {
    return `Le bureau de la pédagogie est fermé (jours ouvrés, ${formatOpenHours(settings)}) : le self-service reprendra à l’ouverture.`;
  }
  return REASON_LABELS[reason] || '';
}
```

Les vues qui affichent un refus continuent d’utiliser `REASON_LABELS[reason]` ; seules celles qui ont les réglages sous la main passent à `reasonLabel(reason, settings)`. Ne change pas les appels existants dans cette tâche : la tâche 4 s’en charge pour les écrans concernés.

- [ ] **Étape 4 : `js/actions/settings.js` — `updateSettings`**

```js
// Réglages modifiables par la pédago. L’horloge de démo n’est jamais touchée ici :
// elle a son propre chemin (`setDemoClock`), pour qu’un enregistrement de formulaire
// ne la remette pas au temps réel par surprise.
export function updateSettings(patch, pedagoId) {
  const actuel = withDefaults(store.settings.get());
  const suivant = { ...actuel, ...patch };
  delete suivant.horlogeDemo;

  if (patch.horaires !== undefined) {
    if (!Array.isArray(patch.horaires) || !patch.horaires.length) throw new Error('Il faut au moins une plage horaire.');
    for (const r of patch.horaires) {
      const debut = Number(r?.debut);
      const fin = Number(r?.fin);
      if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut >= fin || debut < 0 || fin > 24) {
        throw new Error('Plage horaire invalide : l’heure de fin doit suivre l’heure de début.');
      }
    }
    suivant.horaires = patch.horaires.map((r) => ({ debut: Number(r.debut), fin: Number(r.fin) }));
  }
  if (patch.dureeMaxReservationJours !== undefined) {
    const jours = Number(patch.dureeMaxReservationJours);
    if (!Number.isInteger(jours) || jours < 1 || jours > 60) throw new Error('La durée maximale doit être un nombre de jours entre 1 et 60.');
    suivant.dureeMaxReservationJours = jours;
  }
  if (patch.fenetreRetraitMinutes !== undefined) {
    const minutes = Number(patch.fenetreRetraitMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) throw new Error('La fenêtre de retrait doit être comprise entre 5 et 480 minutes.');
    suivant.fenetreRetraitMinutes = minutes;
  }
  if (patch.salle !== undefined) {
    const debut = Number(patch.salle?.heureDebut);
    const fin = Number(patch.salle?.heureFin);
    if (!Number.isInteger(debut) || !Number.isInteger(fin) || debut < 0 || fin > 24 || debut >= fin) {
      throw new Error('Horaires de la salle invalides : la fin doit suivre le début.');
    }
    suivant.salle = { heureDebut: debut, heureFin: fin };
  }
  suivant.bloquerSiRetard = !!suivant.bloquerSiRetard;

  const { horlogeDemo } = store.settings.get();
  return store.transaction(() => {
    const enregistre = store.settings.update({ ...suivant, horlogeDemo });
    logAction({ auteurId: pedagoId, action: ACTIONS.SETTINGS_MODIFIES, detail: 'Règles d’emprunt mises à jour' });
    return enregistre;
  });
}
```

- [ ] **Étape 5 : `js/admin/demoClock.js` — la carte partagée**

Couper `demoClockHtml`, `nextOpenDay` et leur câblage de `js/admin/views/dashboard.js` vers ce nouveau module :

```js
// js/admin/demoClock.js — la carte « horloge de démonstration », partagée par le tableau
// de bord (où on la cherche en pleine démo) et l’écran Paramètres (spec §6).
import { auth } from '../auth.js';
import { isWeekday } from '../rules.js';
import { escapeHtml, badge, formatDateTime, openModal, toast } from '../ui.js';
import { setDemoClock, resetDemoData, toDatetimeLocal, fromDatetimeLocal } from '../actions/settings.js';

// Prochain jour ouvré à 9h (aujourd’hui si c’est un jour ouvré avant 9h).
export function nextOpenDay(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  if (d <= date) d.setDate(d.getDate() + 1);
  while (!isWeekday(d)) d.setDate(d.getDate() + 1);
  return d;
}

export function demoClockHtml({ date, horlogeDemo, status }) {
  return `
    <div class="card demo-clock">
      <div class="card__header">
        <h2 class="card__title">Horloge de démonstration</h2>
        ${horlogeDemo ? badge('derived', 'horloge_demo') : badge('derived', 'temps_reel')}
      </div>
      <p class="body-sm text-secondary">Maintenant : <strong>${escapeHtml(formatDateTime(date))}</strong></p>
      <div class="alert alert--${status.open ? 'info' : 'warning'}">${escapeHtml(status.text)}</div>
      <div class="demo-clock__row">
        <label class="field"><span class="field__label">Date et heure simulées</span><input class="input" type="datetime-local" name="horloge" value="${escapeHtml(toDatetimeLocal(date))}"></label>
        <button type="button" class="btn btn--primary" data-action="set-clock">Appliquer</button>
        <button type="button" class="btn btn--ghost" data-action="next-open" title="Prochain jour ouvré à 9h">Jour ouvré 9h</button>
        <button type="button" class="btn btn--ghost" data-action="real-clock"${horlogeDemo ? '' : ' disabled'}>Temps réel</button>
        <button type="button" class="btn btn--secondary" data-action="reset-demo" title="Recharge l’inventaire et les emprunts autour de la date ci-dessus">Régénérer les données</button>
      </div>
      <p class="body-tiny text-secondary">Les emprunts du jeu de démonstration sont calés sur la date de génération : après un grand saut dans le temps, régénérez les données pour retrouver un état cohérent.</p>
    </div>`;
}

// `root` : l’élément qui contient la carte. À rappeler après chaque rendu.
export function bindDemoClock(root, { date }) {
  const champ = () => root.querySelector('[name="horloge"]');
  const apply = (value) => {
    try {
      setDemoClock(value, auth.currentUserId());
      toast(value ? 'Horloge de démo appliquée' : 'Retour au temps réel', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  root.querySelector('[data-action="set-clock"]').addEventListener('click', () => {
    const value = fromDatetimeLocal(champ().value);
    if (!value) { toast('Date invalide.', 'error'); return; }
    apply(value);
  });
  root.querySelector('[data-action="next-open"]').addEventListener('click', () => apply(nextOpenDay(date)));
  root.querySelector('[data-action="real-clock"]').addEventListener('click', () => apply(null));
  root.querySelector('[data-action="reset-demo"]').addEventListener('click', () => {
    const value = fromDatetimeLocal(champ().value);
    openModal({
      title: 'Régénérer les données de démonstration',
      body: `<p class="body-sm">L’inventaire, les emprunts, les réservations et le journal seront remplacés par un jeu neuf calé sur le ${escapeHtml(formatDateTime(value || date))}. Les photos prises pendant la démonstration seront perdues.</p>`,
      actions: [
        { label: 'Annuler', variant: 'ghost' },
        { label: 'Régénérer', variant: 'danger', onClick: () => {
          try {
            resetDemoData(value, auth.currentUserId());
            toast('Données de démonstration régénérées', 'success');
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        } },
      ],
    });
  });
}
```

`js/admin/views/dashboard.js` : retirer `demoClockHtml`, `nextOpenDay` et les quatre `addEventListener` correspondants ; importer `{ demoClockHtml, bindDemoClock }` depuis `../demoClock.js` ; appeler `bindDemoClock(container, { date })` après le `innerHTML`. Les imports devenus inutiles (`setDemoClock`, `resetDemoData`, `toDatetimeLocal`, `fromDatetimeLocal`, `isWeekday`, peut-être `openModal`) sont à retirer **après vérification** que plus rien d’autre ne les utilise dans le fichier. `demoClockHtml` reste exporté pour `tests/admin-dashboard.test.mjs` — mets à jour cet import de test vers `../js/admin/demoClock.js`.

- [ ] **Étape 6 : écrire `js/admin/views/parametres.js`**

```js
// js/admin/views/parametres.js — réglages de la pédagogie : horaires et durées, horloge
// de démonstration, espace occupé et réinitialisation.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, withDefaults } from '../../rules.js';
import { escapeHtml, toast } from '../../ui.js';
import { officeStatus, updateSettings } from '../../actions/settings.js';
import { demoClockHtml, bindDemoClock } from '../demoClock.js';
import { setTopbar } from '../layout.js';

const MO = 1024 * 1024;
const taille = (bytes) => (bytes >= MO ? `${(bytes / MO).toFixed(1).replace('.', ',')} Mo` : `${Math.round(bytes / 1024)} Ko`);

export function usageHtml(usage) {
  const alerte = usage.percent >= 80
    ? '<div class="alert alert--warning">L’espace du navigateur est presque plein : régénérez les données pour repartir d’un jeu léger (les photos de démonstration seront perdues).</div>'
    : '';
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Espace occupé</h2><span class="body-sm text-secondary">${usage.percent} %</span></div>
      <progress class="gauge" max="100" value="${usage.percent}"></progress>
      <p class="body-sm text-secondary">${escapeHtml(taille(usage.bytes))} sur ${escapeHtml(taille(usage.budget))} — les photos d’emprunt et de retour pèsent l’essentiel.</p>
      ${alerte}
    </div>`;
}

const nombre = (label, name, value, attrs = '') =>
  `<label class="field"><span class="field__label">${escapeHtml(label)}</span><input class="input" type="number" name="${name}" value="${escapeHtml(String(value))}"${attrs}></label>`;

export function settingsFormHtml(settings) {
  const S = withDefaults(settings);
  const [matin, apresMidi] = [S.horaires[0] || { debut: 8, fin: 12 }, S.horaires[1] || { debut: 13, fin: 17 }];
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Règles d’emprunt</h2></div>
      <div class="form-grid">
        ${nombre('Ouverture du matin', 'matinDebut', matin.debut, ' min="0" max="24" step="0.5"')}
        ${nombre('Fermeture du matin', 'matinFin', matin.fin, ' min="0" max="24" step="0.5"')}
        ${nombre('Ouverture de l’après-midi', 'apresMidiDebut', apresMidi.debut, ' min="0" max="24" step="0.5"')}
        ${nombre('Fermeture de l’après-midi', 'apresMidiFin', apresMidi.fin, ' min="0" max="24" step="0.5"')}
        ${nombre('Durée maximale d’une réservation (jours)', 'dureeMaxReservationJours', S.dureeMaxReservationJours, ' min="1" max="60" step="1"')}
        ${nombre('Fenêtre de retrait (minutes)', 'fenetreRetraitMinutes', S.fenetreRetraitMinutes, ' min="5" max="480" step="5"')}
        ${nombre('Premier créneau de la salle', 'salleHeureDebut', S.salle.heureDebut, ' min="0" max="23" step="1"')}
        ${nombre('Dernier créneau de la salle (fin)', 'salleHeureFin', S.salle.heureFin, ' min="1" max="24" step="1"')}
      </div>
      <label class="checkbox"><input type="checkbox" name="bloquerSiRetard"${S.bloquerSiRetard ? ' checked' : ''}> Empêcher d’emprunter quand une personne est en retard</label>
      <div class="form-actions"><button type="button" class="btn btn--primary" data-action="save-settings">Enregistrer</button></div>
    </div>`;
}

export function readSettingsForm(root) {
  const num = (name) => Number(root.querySelector(`[name="${name}"]`).value);
  return {
    horaires: [
      { debut: num('matinDebut'), fin: num('matinFin') },
      { debut: num('apresMidiDebut'), fin: num('apresMidiFin') },
    ],
    dureeMaxReservationJours: num('dureeMaxReservationJours'),
    fenetreRetraitMinutes: num('fenetreRetraitMinutes'),
    salle: { heureDebut: num('salleHeureDebut'), heureFin: num('salleHeureFin') },
    bloquerSiRetard: root.querySelector('[name="bloquerSiRetard"]').checked,
  };
}

export function parametresHtml({ settings, usage, date, horlogeDemo, status }) {
  return `
    ${demoClockHtml({ date, horlogeDemo, status })}
    <div class="grid-2">
      ${settingsFormHtml(settings)}
      ${usageHtml(usage)}
    </div>`;
}

export function parametresView(container) {
  // Un ré-rendu pendant la saisie écraserait les champs : on ne redessine pas
  // tant que le formulaire est modifié et non enregistré.
  let dirty = false;
  const render = () => {
    if (dirty) return;
    const date = now();
    const settings = store.settings.get();
    setTopbar({ title: 'Paramètres', subtitle: 'Règles, horloge de démonstration et espace' });
    container.innerHTML = parametresHtml({
      settings, usage: store.usage(), date,
      horlogeDemo: settings.horlogeDemo || null, status: officeStatus(date, settings),
    });
    bindDemoClock(container, { date });
    container.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
      if (el.name !== 'horloge') dirty = true;
    }));
    container.querySelector('[data-action="save-settings"]').addEventListener('click', () => {
      try {
        updateSettings(readSettingsForm(container), auth.currentUserId());
        dirty = false;
        toast('Réglages enregistrés', 'success');
        render();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Étape 7 : route et CSS**

`js/admin/app.js` : `import { parametresView } from './views/parametres.js';` et `{ path: '/parametres', view: guard(parametresView) }`.

`css/admin.css` :

```css
.gauge { width: 100%; height: 10px; border: 0; border-radius: var(--radius-pill); background: var(--bg-muted); overflow: hidden; }
.gauge::-webkit-progress-bar { background: var(--bg-muted); border-radius: var(--radius-pill); }
.gauge::-webkit-progress-value { background: var(--brand-primary); border-radius: var(--radius-pill); }
.gauge::-moz-progress-bar { background: var(--brand-primary); border-radius: var(--radius-pill); }
```

- [ ] **Étape 8 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 9 : vérifier dans le navigateur** (contrôleur)

Admin → Paramètres : la carte horloge se comporte comme sur le tableau de bord ; passer la fermeture du matin à 11h puis enregistrer → le tableau de bord annonce « Bureau fermé » à 11h30 et le mobile refuse un emprunt self-service avec le message citant **11h**, pas 12h ; une plage inversée affiche une erreur sans rien enregistrer ; la jauge d’espace bouge après quelques photos.

- [ ] **Étape 10 : commit**

```bash
git add js/admin/demoClock.js js/admin/views/parametres.js js/admin/views/dashboard.js js/admin/app.js js/rules.js js/actions/settings.js css/admin.css tests/admin-parametres.test.mjs tests/admin-dashboard.test.mjs tests/rules.test.mjs tests/actions-settings.test.mjs
git commit -m "feat(admin): écran de paramètres, horloge partagée et horaires réglables"
```

---

### Task 4 : Reprises — modale de scan partagée, remise pré-remplie, recherche par code

**Fichiers :**
- Créer : `js/scanModal.js`
- Modifier : `js/admin/handoverModal.js`, `js/admin/views/emprunts.js`, `js/admin/layout.js`, `js/admin/views/materiel.js`, `js/ui.js` (jeton d’identité des modales), `js/rules.js` (`isExitMissing`), `js/store.js` (commentaire de contrat), `js/admin/views/utilisateurFiche.js`, `js/mobile/views/salle.js`
- Test : `tests/scan-modal.test.mjs`, `tests/ui.test.mjs`, `tests/rules.test.mjs`, `tests/admin-layout.test.mjs`, `tests/mobile-salle.test.mjs`

Ce lot vide la dette accumulée depuis la phase 3. Chaque point a été tranché lors d’une revue ; aucun n’est une idée neuve.

**Interfaces :**
- Produit : `openScanModal({ title, hint, label, placeholder, readerId, onCode, onSubmit })` (`js/scanModal.js`) ; `parseAdminSearch(q)` (`js/admin/layout.js`) ; `openHandoverModal({ loan, onDone })` accepte désormais un emprunt de départ.

- [ ] **Étape 1 : écrire les tests**

`tests/scan-modal.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanModalBodyHtml } from '../js/scanModal.js';

test('scanModalBodyHtml : lecteur, champ de saisie et texte d’aide', () => {
  const html = scanModalBodyHtml({ hint: 'Scannez le QR affiché par l’emprunteur.', label: 'Code de retrait', placeholder: 'AB12CD', readerId: 'handover-reader' });
  assert.match(html, /id="handover-reader"/);
  assert.match(html, /Scannez le QR affiché par l’emprunteur\./);
  assert.match(html, /name="code"/);
  assert.match(html, /placeholder="AB12CD"/);
  assert.match(html, /Code de retrait/);
});

test('scanModalBodyHtml : la valeur de départ pré-remplit le champ', () => {
  const html = scanModalBodyHtml({ hint: 'x', label: 'Code', placeholder: '', readerId: 'r', value: 'AB12CD' });
  assert.match(html, /value="AB12CD"/);
});
```

`tests/admin-layout.test.mjs` — ajouter `parseAdminSearch` à l’import et à la fin du fichier :

```js
test('parseAdminSearch : distingue un code de retrait d’une recherche de matériel', () => {
  assert.deepEqual(parseAdminSearch('AB12CD'), { type: 'code', code: 'AB12CD' });
  assert.deepEqual(parseAdminSearch('  ab12cd '), { type: 'code', code: 'AB12CD' });
  assert.deepEqual(parseAdminSearch('LOAN-loan_0007-AB12CD'), { type: 'code', code: 'LOAN-loan_0007-AB12CD' });
  assert.deepEqual(parseAdminSearch('canon'), { type: 'texte', texte: 'canon' });
  assert.deepEqual(parseAdminSearch('Canon R10'), { type: 'texte', texte: 'Canon R10' });
  assert.deepEqual(parseAdminSearch(''), { type: 'texte', texte: '' });
  // Six caractères mais pas un code : un mot de six lettres reste une recherche.
  assert.deepEqual(parseAdminSearch('trepie'), { type: 'texte', texte: 'trepie' });
});
```

`tests/ui.test.mjs` — ajouter à la fin :

```js
test('openModal : la fermeture renvoyée ne ferme que SA modale', () => {
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const avant = globalThis.document;
  globalThis.document = { getElementById: () => root, body: { classList: { add() {}, remove() {} } } };
  try {
    const fermerPremiere = openModal({ title: 'Première', body: '' });
    const fermerSeconde = openModal({ title: 'Seconde', body: '' });
    fermerPremiere(); // la première est déjà remplacée : cet appel ne doit rien fermer
    assert.match(root.innerHTML, /Seconde/, 'la seconde modale est toujours à l’écran');
    fermerSeconde();
    assert.equal(root.innerHTML, '');
  } finally {
    globalThis.document = avant;
  }
});
```

`tests/rules.test.mjs` — dans le test existant « réservation salle : début, fin, active, sortie non faite », la fixture `b` est `statut: 'a_venir'` : les deux assertions `isExitMissing` doivent viser un créneau en cours. Remplacer

```js
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 0)), false);
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 1)), true);
```

par

```js
  const enCours = { ...b, statut: 'en_cours' };
  assert.equal(isExitMissing(enCours, new Date(2026, 8, 17, 14, 0)), false);
  assert.equal(isExitMissing(enCours, new Date(2026, 8, 17, 14, 1)), true);
```

puis ajouter à la fin du fichier :

```js
test('isExitMissing : seul un créneau en cours peut avoir une sortie manquante', () => {
  const base = { date: '2026-09-17', creneaux: [9, 10], etatSortie: null };
  const tard = new Date(2026, 8, 17, 13, 0);
  assert.equal(isExitMissing({ ...base, statut: 'en_cours' }, tard), true);
  assert.equal(isExitMissing({ ...base, statut: 'terminee' }, tard), false, 'clos d’office par la pédago');
  assert.equal(isExitMissing({ ...base, statut: 'a_venir' }, tard), false, 'jamais commencé, balayé par closeDueBookings');
  assert.equal(isExitMissing({ ...base, statut: 'annulee' }, tard), false);
  assert.equal(isExitMissing({ ...base, statut: 'en_cours' }, new Date(2026, 8, 17, 11, 30)), false, 'moins d’une heure après la fin');
});
```

`tests/mobile-salle.test.mjs` — ajouter à la fin :

```js
test('myBookingsHtml : un créneau d’un autre jour resté ouvert est dit « non clôturé »', () => {
  const hier = { id: 'book_hier', date: '2026-09-16', creneaux: [11], statut: 'en_cours', etatEntree: { lignes: [] }, etatSortie: null };
  const html = myBookingsHtml({ active: { booking: hier, entreeFaite: true, sortieFaite: false }, aVenir: [] }, NOW);
  assert.match(html, /Créneau non clôturé/);
  assert.doesNotMatch(html, /Créneau en cours/);
  const aujourdhui = { ...hier, id: 'book_now', date: '2026-09-17', creneaux: [9, 10] };
  const html2 = myBookingsHtml({ active: { booking: aujourdhui, entreeFaite: true, sortieFaite: false }, aVenir: [] }, NOW);
  assert.match(html2, /Créneau en cours/);
});
```

- [ ] **Étape 2 : lancer les tests pour les voir échouer**

Run: `node --test tests/scan-modal.test.mjs tests/ui.test.mjs tests/rules.test.mjs tests/admin-layout.test.mjs tests/mobile-salle.test.mjs`
Attendu : module introuvable pour `scanModal.js`, et quatre échecs d’assertion.

- [ ] **Étape 3 : `js/scanModal.js` — la modale « scanner ou saisir »**

```js
// js/scanModal.js — la modale « scannez le QR, ou saisissez le code » : le lecteur, le champ,
// l’anti-répétition des erreurs et la libération de la caméra. Deux écrans l’utilisent déjà
// (remise d’un matériel de valeur, recherche par code) ; elle n’a pas à être réécrite à chaque fois.
import { escapeHtml, openModal, toast } from './ui.js';
import { startScanner, stopScanner, hasCamera, normalizeScanText } from './scanner.js';

export function scanModalBodyHtml({ hint, label, placeholder = '', readerId, value = '' }) {
  return `
    <p class="body-sm text-secondary">${escapeHtml(hint)}</p>
    <div id="${escapeHtml(readerId)}" class="reader reader--admin"></div>
    <label class="field"><span class="field__label">${escapeHtml(label)}</span><input class="input" name="code" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocapitalize="characters" maxlength="24"></label>`;
}

/**
 * `onCode(code, { close })` est appelé au scan ET à la validation ; il lève pour refuser.
 * Au scan, une erreur s’affiche en toast (sans se répéter) et la modale reste ouverte ;
 * à la validation, elle s’affiche et la modale reste ouverte aussi.
 */
export function openScanModal({ title, hint, label = 'Code', placeholder = '', readerId = 'scan-reader', value = '', submitLabel = 'Valider', onCode }) {
  // Le scanner relit le même QR plusieurs fois par seconde : on n’affiche pas deux fois
  // la même erreur à moins de 3 secondes d’intervalle.
  let dernierMessage = '';
  let dernierAffichage = 0;
  const signaler = (message) => {
    const t = Date.now();
    if (message === dernierMessage && t - dernierAffichage < 3000) return;
    dernierMessage = message;
    dernierAffichage = t;
    toast(message, 'error');
  };
  const close = openModal({
    title,
    onClose: () => { stopScanner(); },
    body: scanModalBodyHtml({ hint, label, placeholder, readerId, value }),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: submitLabel, variant: 'primary',
        onClick: (modal) => {
          try {
            onCode(modal.querySelector('[name="code"]').value, { close });
            stopScanner();
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        },
      },
    ],
  });
  const root = document.getElementById('modal-root');
  const input = root.querySelector('[name="code"]');
  input.focus();
  hasCamera().then((ok) => {
    const reader = root.querySelector(`#${readerId}`);
    if (!reader) return; // modale déjà fermée
    if (!ok) { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; return; }
    startScanner(readerId, (text) => {
      input.value = normalizeScanText(text);
      try {
        onCode(input.value, { close });
        stopScanner();
        close();
      } catch (e) {
        signaler(e.message);
      }
    }).catch(() => { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; });
  });
  return close;
}
```

- [ ] **Étape 4 : `js/admin/handoverModal.js` — bâtie sur la modale partagée, et pré-remplie**

Remplacer `openHandoverModal` par :

```js
// `loan` : l’emprunt de la ligne cliquée. Son code est pré-rempli, et on refuse un code
// qui ne lui correspond pas — sinon le bouton d’une ligne pourrait en remettre une autre.
export function openHandoverModal({ loan = null, onDone } = {}) {
  const attendu = loan ? loan.codeRetrait : null;
  return openScanModal({
    title: 'Remettre le matériel',
    hint: loan
      ? 'Scannez le QR affiché par l’emprunteur, ou vérifiez son code de retrait.'
      : 'Scannez le QR affiché par l’emprunteur, ou saisissez son code de retrait.',
    label: 'Code de retrait',
    placeholder: 'AB12CD',
    readerId: 'handover-reader',
    value: attendu || '',
    submitLabel: 'Remettre',
    onCode: (code) => {
      const remis = handOver({ code, pedagoId: auth.currentUserId() });
      if (loan && remis.id !== loan.id) throw new Error('Ce code correspond à une autre réservation.');
      toast('Matériel remis', 'success');
      if (onDone) onDone(remis);
    },
  });
}
```

Les imports de `handoverModal.js` deviennent : `auth`, `escapeHtml`, `toast` (`../ui.js`), `checklistFor`, `handOver`, et `openScanModal` depuis `../scanModal.js`. `startScanner`, `stopScanner`, `hasCamera`, `normalizeScanText` et `openModal` ne sont plus utilisés par ce fichier — vérifie-le avant de retirer les imports. `checklistFormHtml` et `readChecklistForm` restent inchangés.

`js/admin/views/emprunts.js` : le bouton *Remettre* passe sa ligne — `openHandoverModal({ loan: row.loan })` au lieu de `openHandoverModal({})`. Le tableau de bord garde `openHandoverModal({})` quand il n’a pas de ligne, et passe `{ loan: r.loan }` depuis son widget « À remettre aujourd’hui » si la ligne est disponible à cet endroit.

- [ ] **Étape 5 : `js/admin/layout.js` — un code de retrait dans la recherche ouvre la remise**

```js
// Un code de retrait saisi dans la recherche globale ouvre directement la remise (spec §6).
// Un code court = exactement 6 caractères alphanumériques avec au moins un chiffre ;
// un mot de six lettres reste une recherche de matériel.
const CODE6 = /^[A-Z0-9]{6}$/;
export function parseAdminSearch(q) {
  const texte = String(q || '').trim();
  // Un QR d’emprunt est rendu tel quel : `LOAN_CODE_RE` capture l’identifiant, et
  // `store.loans.get()` est sensible à la casse — le passer en majuscules le casserait.
  if (texte.toUpperCase().startsWith('LOAN-')) return { type: 'code', code: texte };
  const majuscules = texte.toUpperCase();
  if (CODE6.test(majuscules) && /[0-9]/.test(majuscules)) return { type: 'code', code: majuscules };
  return { type: 'texte', texte };
}
```

et le `keydown` de `setTopbar` devient :

```js
  el.querySelector('[data-role="global-search"]').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const parsed = parseAdminSearch(e.target.value);
    if (parsed.type === 'code') {
      e.target.value = '';
      onSearchCode(parsed.code);
      return;
    }
    sessionStorage.setItem(SEARCH_KEY, parsed.texte);
    if (currentPath() === '/materiel') window.dispatchEvent(new Event('hashchange'));
    else navigate('/materiel');
  });
```

Pour éviter une dépendance de `layout.js` vers une modale, `onSearchCode` est un module-level hook que `js/admin/app.js` installe une fois au démarrage :

```js
// js/admin/layout.js
let onSearchCode = () => {};
export function setSearchCodeHandler(fn) { onSearchCode = fn; }
```

```js
// js/admin/app.js, après les imports
import { setSearchCodeHandler } from './layout.js';
import { openHandoverModal } from './handoverModal.js';
setSearchCodeHandler((code) => openHandoverModal({ code }));
```

`openHandoverModal` accepte donc aussi `code` (valeur de départ sans emprunt attendu) :

```js
export function openHandoverModal({ loan = null, code = '', onDone } = {}) {
  const attendu = loan ? loan.codeRetrait : null;
  // …
    value: attendu || code || '',
```

- [ ] **Étape 6 : `js/ui.js` — un jeton d’identité par modale**

Aujourd’hui `openModal` renvoie `closeModal`, qui ferme *la modale ouverte*, quelle qu’elle soit : une fermeture différée (callback de caméra, promesse) peut fermer une modale ouverte depuis. Le module tient un jeton :

```js
let modalToken = 0;

export function closeModal() {
  const cb = onCloseModal;
  onCloseModal = null;
  modalToken += 1; // toute fermeture périme les jetons en circulation
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('has-modal');
  if (cb) cb();
}
```

et à la fin de `openModal` :

```js
  const token = (modalToken += 1);
  // La fermeture renvoyée n’agit que si CETTE modale est encore à l’écran.
  return () => { if (token === modalToken) closeModal(); };
```

Attention : `openModal` incrémente déjà le jeton quand il remplace une modale précédente (il appelle le `onClose` de l’ancienne, pas `closeModal`). Place `const token = (modalToken += 1);` **après** le bloc qui libère la modale précédente, pour que le jeton rendu soit bien celui de la nouvelle.

- [ ] **Étape 7 : les quatre corrections ponctuelles**

`js/rules.js` — `isExitMissing` ne vaut que pour un créneau en cours :

```js
// Une sortie ne « manque » que pendant un créneau en cours : un créneau clos d’office par
// la pédago, ou jamais commencé (balayé par `closeDueBookings`), n’a plus de sortie à faire.
export function isExitMissing(b, date) {
  if (b.statut !== BOOKING_STATES.EN_COURS || b.etatSortie) return false;
  return toDate(date) > new Date(bookingEnd(b).getTime() + 60 * MIN);
}
```

Les appelants qui filtrent déjà sur `EN_COURS` (`js/admin/kpi.js`, `js/admin/views/salle.js`) peuvent garder leur filtre : il devient redondant, pas faux. Ne les touche pas.

`js/store.js` — le commentaire de `transaction` dit ses préconditions :

```js
  // Regroupe plusieurs écritures : une seule persistance et une seule notification à la fin.
  // Si `fn` lève — ou si la persistance finale échoue — l’état d’avant est restauré et
  // personne n’est notifié.
  // Préconditions : `fn` doit être SYNCHRONE (une fonction async validerait avant ses écritures),
  // et `persist()` doit rester le seul écrivain de `localStorage` (l’instantané est pris en mémoire).
  // Imbrication : seule la transaction la plus externe restaure. Une transaction imbriquée
  // qui lève remonte l’erreur ; si l’externe la rattrape et continue, les écritures de
  // l’imbriquée sont conservées. Les actions de ce projet n’imbriquent pas.
```

`js/admin/views/utilisateurFiche.js` — la bascule actif/inactif attrape son erreur comme les autres actions :

```js
          { label: activate ? 'Réactiver' : 'Désactiver', variant: activate ? 'primary' : 'danger', onClick: () => {
            try {
              setUserActive(id, activate, auth.currentUserId());
              toast(activate ? 'Compte réactivé' : 'Compte désactivé', 'success');
            } catch (err) {
              toast(err.message, 'error');
              return false;
            }
          } },
```

`js/mobile/views/salle.js` — `myBookingsHtml` ne dit « Créneau en cours » que si le créneau est celui du jour affiché :

```js
  // Un créneau d’un autre jour resté ouvert n’est pas « en cours » : il attend sa sortie.
  const titre = booking.date === ymd(date) && booking.statut === BOOKING_STATES.EN_COURS
    ? 'Créneau en cours'
    : (booking.statut === BOOKING_STATES.EN_COURS ? 'Créneau non clôturé' : 'Créneau du jour');
```

`ymd` est à réimporter depuis `../../rules.js` (il avait été retiré en phase 4 comme import mort). La ligne exacte à modifier est

```js
import { now, addDays, isWeekday, REASONS, REASON_LABELS } from '../../rules.js';
```

qui devient

```js
import { now, addDays, ymd, isWeekday, REASONS, REASON_LABELS } from '../../rules.js';
```

- [ ] **Étape 8 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 9 : vérifier dans le navigateur** (contrôleur)

Admin → Emprunts, onglet *Réservés* : *Remettre* ouvre une modale dont le code est déjà rempli, et valider remet le bon objet ; saisir à la place le code d’une autre réservation affiche « Ce code correspond à une autre réservation. ». Taper un code à six caractères dans la recherche de la topbar ouvre la remise ; taper « canon » envoie toujours vers l’inventaire filtré.

- [ ] **Étape 10 : commit**

```bash
git add js/scanModal.js js/admin/handoverModal.js js/admin/views/emprunts.js js/admin/views/dashboard.js js/admin/layout.js js/admin/app.js js/ui.js js/rules.js js/store.js js/admin/views/utilisateurFiche.js js/mobile/views/salle.js tests/
git commit -m "refactor: modale de scan partagée, remise pré-remplie et reprises des revues"
```

---

### Task 5 : PWA légère — installable sur un téléphone

**Fichiers :**
- Créer : `manifest.json`, `scripts/make-icons.mjs`, `assets/icon-192.png`, `assets/icon-512.png`
- Modifier : `mobile.html` (`<link>` et `<meta>`), `css/mobile.css` (zones sûres)
- Test : `tests/manifest.test.mjs`

Spec §7 et feuille de route 5.4 : « Ajout à l’écran d’accueil ». Pas de *service worker* : hors ligne n’est pas au programme, et un cache mal réglé transformerait chaque mise à jour en énigme pendant les tests. L’installation suffit pour que les testeurs lancent le prototype comme une application.

Les icônes sont générées par un script du dépôt plutôt que committées à l’aveugle : pas de dépendance, et on peut les regénérer après un changement de charte.

- [ ] **Étape 1 : écrire le test**

`tests/manifest.test.mjs` :

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('manifest : nom, portée, affichage et couleurs de la charte', () => {
  assert.equal(manifest.name, 'MDS Emprunts');
  assert.equal(manifest.short_name, 'Emprunts');
  assert.equal(manifest.lang, 'fr');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, 'mobile.html');
  assert.equal(manifest.scope, '.');
  assert.equal(manifest.theme_color, '#662483');
  assert.ok(manifest.background_color);
});

test('manifest : les deux icônes existent et ne sont pas vides', () => {
  const tailles = manifest.icons.map((i) => i.sizes);
  assert.deepEqual(tailles.sort(), ['192x192', '512x512']);
  for (const icone of manifest.icons) {
    assert.equal(icone.type, 'image/png');
    const stat = statSync(new URL(`../${icone.src}`, import.meta.url));
    assert.ok(stat.size > 0, `${icone.src} est vide`);
  }
  assert.ok(manifest.icons.some((i) => (i.purpose || '').includes('any')));
});

test('mobile.html : lien vers le manifeste et métadonnées d’installation', () => {
  const html = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="assets\/icon-192\.png">/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /viewport-fit=cover/, 'les zones sûres ont besoin du viewport plein écran');
});
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

Run: `node --test tests/manifest.test.mjs`
Attendu : échec de lecture de `manifest.json`.

- [ ] **Étape 3 : écrire `scripts/make-icons.mjs`**

```js
// scripts/make-icons.mjs — génère les icônes PNG de la PWA sans dépendance.
// `node scripts/make-icons.mjs` réécrit assets/icon-192.png et assets/icon-512.png.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const VIOLET = [0x66, 0x24, 0x83];
const BLANC = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (const octet of buf) {
    c ^= octet;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corps));
  return Buffer.concat([len, corps, crc]);
}

function png(size, pixel) {
  const lignes = [];
  for (let y = 0; y < size; y += 1) {
    const ligne = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y, size);
      ligne[1 + x * 3] = r;
      ligne[2 + x * 3] = g;
      ligne[3 + x * 3] = b;
    }
    lignes.push(ligne);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 2;   // couleur vraie RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(lignes), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Un motif de repère de QR code sur fond violet : lisible à 48 px, et il dit « scanner ».
function motif(x, y, size) {
  const u = size / 16;           // grille de 16 unités
  const gx = Math.floor(x / u);
  const gy = Math.floor(y / u);
  const dansCarre = (x0, y0, c) => gx >= x0 && gx < x0 + c && gy >= y0 && gy < y0 + c;
  const anneau = (x0, y0) => dansCarre(x0, y0, 7) && !(dansCarre(x0 + 1, y0 + 1, 5) && !dansCarre(x0 + 2, y0 + 2, 3));
  if (anneau(1, 1) || anneau(8, 8)) return BLANC;
  return VIOLET;
}

mkdirSync('assets', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`assets/icon-${size}.png`, png(size, motif));
  console.log(`assets/icon-${size}.png écrit (${size}×${size})`);
}
```

Puis : `node scripts/make-icons.mjs`. Le script est idempotent ; les deux PNG font moins de 4 Ko.

- [ ] **Étape 4 : `manifest.json`**

```json
{
  "name": "MDS Emprunts",
  "short_name": "Emprunts",
  "lang": "fr",
  "dir": "ltr",
  "description": "Emprunt de matériel et réservation de la salle photo de l’école MDS.",
  "start_url": "mobile.html",
  "scope": ".",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#662483",
  "background_color": "#f2f4f8",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

- [ ] **Étape 5 : `mobile.html`**

Dans le `<head>`, après la balise `theme-color` existante :

```html
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="assets/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Emprunts">
```

Le `viewport` contient déjà `viewport-fit=cover` : ne pas y toucher.

- [ ] **Étape 6 : `css/mobile.css` — les zones sûres**

Installée, l’application occupe tout l’écran : l’encoche mange l’en-tête et la barre d’accueil mange la navigation. La barre de navigation réserve déjà l’espace en bas dans son `padding`, mais sa hauteur fixe comprime son contenu d’autant. Remplacer les règles concernées :

```css
.m-header { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: var(--space-sm); height: calc(56px + env(safe-area-inset-top)); padding: env(safe-area-inset-top) var(--space-lg) 0; background: var(--brand-primary); color: var(--text-on-brand); }
.m-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: min(480px, 100%); height: calc(72px + env(safe-area-inset-bottom)); padding: 0 var(--space-sm) env(safe-area-inset-bottom); display: grid; grid-template-columns: 1fr 1fr 72px 1fr 1fr; align-items: center; background: var(--bg-surface); border-top: var(--stroke-thin) solid var(--border-default); z-index: 10; }
```

et la barre de sélection de la salle, qui se cale au-dessus de la navigation :

```css
.selection-bar { position: sticky; bottom: calc(88px + env(safe-area-inset-bottom)); background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
```

Vérifie la règle qui réserve la place du contenu sous la navigation (`.m-main` ou équivalent, autour de la ligne 12 de `css/mobile.css`) : son `padding-bottom` doit lui aussi gagner `+ env(safe-area-inset-bottom)`. Sur un écran sans encoche, `env()` vaut 0 : rien ne change.

- [ ] **Étape 7 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 8 : vérifier** (contrôleur)

Au navigateur : `mobile.html` se charge sans erreur de console et la requête `manifest.json` renvoie 200. Sur téléphone, l’installation réelle attend la phase 6 (HTTPS obligatoire) — le noter plutôt que de prétendre l’avoir vérifiée.

- [ ] **Étape 9 : commit**

```bash
git add manifest.json scripts/make-icons.mjs assets/ mobile.html css/mobile.css tests/manifest.test.mjs
git commit -m "feat(pwa): manifeste, icônes générées et zones sûres"
```

---

### Task 6 : Vérification de fin de phase

**Fichiers :**
- Modifier : `README.md`, `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

- [ ] **Étape 1 : suite complète et greps**

Run: `npm test` puis `TZ=America/New_York npm test` → 0 échec (299 au départ de la phase, une quarantaine de plus attendue).
Run: `grep -rn "[a-zA-Zàéèêçûô]'[a-zA-Zàéèêçûô]" js/ tests/ --include='*.js' --include='*.mjs'` → rien.
Run: `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/admin.css css/mobile.css` → rien.
Run: `grep -rn "aVenirView" js/` → plus aucune route ne l’utilise ; supprimer `js/admin/views/aVenir.js` et son test si c’est le cas, ou dire pourquoi il reste.

- [ ] **Étape 2 : scénario de vérification de phase** (contrôleur, navigateur, deux fenêtres)

Horloge de démo un jour ouvré 9h, données régénérées.
1. Mobile : emprunter un objet self-service, le rendre en signalant un problème → admin · Maintenance : le signalement est en tête, l’objet est dans « Matériel immobilisé ».
2. Admin : *Démarrer* l’intervention → badge *En cours* ; *Créer une intervention* externe sur le même objet avec prestataire et coût → deux événements ouverts.
3. Clôturer le premier → l’objet reste en maintenance ; clôturer le second avec *Remettre en service* → il repasse disponible et réapparaît au catalogue mobile.
4. Refaire un signalement, clôturer avec *Hors service* → l’objet est masqué du catalogue mobile et reste à l’inventaire.
5. Paramètres : fermer le bureau à 11h, enregistrer → à 11h30 le mobile refuse un emprunt self-service avec un message citant 11h ; remettre 12h.
6. Paramètres : la jauge d’espace affiche un pourcentage cohérent ; *Régénérer les données* repart d’un jeu propre.
7. Emprunts · *Réservés* : *Remettre* ouvre une modale pré-remplie ; saisir le code d’une autre réservation est refusé. Taper ce même code dans la recherche de la topbar ouvre la remise.
8. `mobile.html` : la requête `manifest.json` renvoie 200, aucune erreur de console.

- [ ] **Étape 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 5 — Maintenance & paramètres` ; décrire en deux phrases l’écran Maintenance et l’écran Paramètres, à la suite du paragraphe sur la salle photo ; mentionner l’installation sur l’écran d’accueil et le fait qu’elle exige HTTPS (phase 6).
Feuille de route : ligne Phase 5 du tableau → `` `2026-10-04-phase-5-maintenance-parametres.md` (exécuté) ``, et la même mention sous le titre `## Phase 5`.

- [ ] **Étape 4 : commit et étiquette**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 5 terminée"
```

L’étiquette `phase-5` est posée par le contrôleur après la fusion dans `main`, comme pour les phases précédentes.

- [ ] **Étape 5 : rédiger le plan de la phase 6** (`superpowers:writing-plans`, feuille de route Phase 6). Y reporter les reprises laissées par la phase 5 : les éléments que la revue de branche de la phase 4 a renvoyés ici et qui ne seraient pas traités, plus tout ce que les revues de la phase 5 auront parqué.

---

## Reprises volontairement laissées de côté

Repoussées après arbitrage, pour que la revue de branche n’ait pas à les redécouvrir :

| Reprise | Pourquoi pas maintenant |
|---|---|
| `userBookings().passees` n’est consommé par aucune vue | C’est une surface d’API cohérente avec `active`/`aVenir` ; la supprimer pour la réécrire plus tard coûte plus que de la garder. |
| `openingWeek` n’évite que le week-end, pas un vendredi 18h | Un tap sur « semaine suivante » suffit, et la règle « quelle est la première semaine utile » mérite d’être pensée avec les horaires réglables plutôt que bricolée ici. |
| Deux créneaux lapsés simultanés : un seul remonte à l’emprunteur | Personne n’est bloqué (le second réapparaît dès le premier clos, et la pédago les voit tous les deux) ; le cas demande un vrai écran « mes créneaux », pas un correctif. |
| `BOOKING_TRANSITIONS` / `LOAN_TRANSITIONS` morts alors que la spec §9 promet `assertTransition` | Le choix — faire respecter les transitions partout ou supprimer les tables — change la couche d’actions entière. Il revient à la phase 6, avec un arbitrage explicite dans la spec. |
| Couverture : le tri de `exitMissingRows` n’est testé qu’avec une ligne | Largeur de couverture seulement ; aucun comportement n’est en jeu. |
| Perte d’écriture entre deux onglets (`persist()` réécrit tout le blob) | Architectural et documenté dans le README depuis la phase 4 ; la contrainte appartient au futur serveur, pas à `localStorage`. |

## Relecture du plan

- **Couverture de la spec.** §5.4 : signalement manuel ou issu d’une checklist (tâche 1), interventions interne/externe avec prestataire et coût (tâche 1 et 2), passage `en_cours` puis `clos` (tâche 1), clôture du dernier événement ouvert → `disponible` ou `hs` au choix (tâche 1), `hs` masqué du catalogue mais gardé à l’inventaire (déjà en place, `js/mobile/catalog.js:11`). §6 `#/maintenance` et `#/parametres` : tâches 2 et 3 ; recherche admin par code de retrait : tâche 4. Feuille de route 5.4 PWA : tâche 5.
- **Pas de réservé-à-plus-tard.** Chaque étape porte le code qu’elle demande ; les seules consignes en prose sont des retraits d’imports morts, qui sont assortis d’une vérification explicite.
- **Cohérence des signatures.** `openScanModal` (tâche 4) est consommé par `openHandoverModal` dans la même tâche ; `demoClockHtml`/`bindDemoClock` (tâche 3) sont consommés par le tableau de bord et par Paramètres dans la même tâche ; `exitMissingRows` change de module en tâche 2 et ses deux appelants sont mis à jour au même endroit.
- **Pré-vol.** Tout le code de ce plan a été extrait dans une copie jetable du dépôt à l’étiquette `phase-4` et exécuté : **340 tests au vert dans `Europe/Paris` et dans `TZ=America/New_York`**, grep des apostrophes vide, les deux PNG générés valides. Trois défauts du plan ont été corrigés à cette occasion : `parseAdminSearch` passait un code `LOAN-…` en majuscules et cassait l’identifiant d’emprunt ; le durcissement d’`isExitMissing` invalidait deux assertions existantes de `tests/rules.test.mjs`, que l’étape 1 de la tâche 4 met désormais à jour explicitement ; et la consigne d’import de `ymd` ne citait pas la ligne réelle de `js/mobile/views/salle.js`.
