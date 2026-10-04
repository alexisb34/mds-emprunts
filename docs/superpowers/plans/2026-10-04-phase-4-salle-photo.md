# MDS Emprunts — Phase 4 : Salle photo — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer la réservation de la salle photo de bout en bout — l'emprunteur choisit un ou plusieurs créneaux contigus d'une heure (8h-17h, lundi au vendredi) depuis son mobile, fait l'état des lieux d'entrée puis de sortie du matériel de la salle, et la pédagogie suit le tout sur un planning hebdomadaire avec le repérage des sorties non faites.

**Architecture :** les mutations vivent dans un nouveau `js/actions/bookings.js` (création, annulation, états des lieux, clôture automatique), toutes dans `store.transaction` et avec une entrée de journal par mutation ; les règles de créneaux existent déjà dans `js/rules.js` (`slotsAreContiguous`, `slotsInRoomHours`, `slotsConflict`, `bookingStart/End`, `isBookingActive`, `isExitMissing`) et sont consommées telles quelles. Une grille de semaine partagée (`js/weekGrid.js`, pure) alimente la vue mobile tactile et le planning admin, chacun avec son rendu. L'état des lieux réutilise `buildRoomChecklist`.

**Tech Stack :** HTML5, CSS3 (tokens Figma), JavaScript ES2022 modules natifs, `localStorage`, Node ≥ 22 (`node --test`), `python3 -m http.server`.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §3.2 (matériel salle), §5.3 (règles salle), §5.5 (temps), §6 (`#/salle` admin), §7 (écran Salle mobile), §8 (état des lieux).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md` (Phase 4). **Journaux** : `docs/superpowers/ledgers/2026-09-17-phase-0-ledger.md`, `2026-09-18-phase-1-ledger.md`, `2026-09-20-phase-2-ledger.md`, `2026-10-04-phase-3-ledger.md`.

## Global Constraints

- Aucun build, aucune dépendance npm ; aucune bibliothèque tierce nouvelle.
- Interface 100 % en français ; libellés d'états via `LABELS`/`badge` ; motifs de refus via `REASONS`/`REASON_LABELS`.
- Chaînes : délimiteurs simples, apostrophe typographique `’` (U+2019) dans le texte français (code, commentaires, HTML) — jamais `'` ni `\'` dans un mot français. Vérification : `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` ne renvoie rien.
- Aucune couleur en dur hors `css/tokens.css`.
- **Toute action à écritures multiples passe par `store.transaction(fn)`** ; une entrée de journal par mutation métier (deux quand un signalement est créé) ; enregistrements gelés → toujours `store.x.update(id, patch)`.
- Règles temporelles via `rules.now()` (horloge de démo réglable depuis le tableau de bord admin) ; aucun timer : les balayages (`sweepExpirations`, clôture des créneaux) sont appelés au rendu et dans la garde de chaque application, et doivent être **idempotents**.
- Vues : `xxxHtml(data)` pur (testé sous Node) + `xxxView(container, params)` DOM qui renvoie son nettoyage ; toute donnée dynamique échappée via `escapeHtml` (sauf fragments déjà échappés : `badge`, `avatar`, `renderTable`) ; les filtres re-rendent uniquement `[data-role="results"]`.
- Dates de jour en `YYYY-MM-DD` (`ymd`/`fromYmd`, heure locale) ; créneaux en heures entières (8 = 8h-9h) ; la salle est ouverte du lundi au vendredi, de `settings.salle.heureDebut` à `settings.salle.heureFin`.
- Commits fréquents, messages en français, préfixes `feat:`, `fix:`, `test:`, `docs:`.

---

## Structure de fichiers de la phase

| Fichier | Responsabilité |
|---|---|
| `js/ui.js` (modif) | `toDate` parse `YYYY-MM-DD` en date **locale** (prérequis, ruling phase 2) |
| `js/store.js` (modif) | `transaction` : persistance et notification différées jusqu'à la fin (prérequis, ruling phase 3) |
| `js/rules.js` (modif) | + `REASONS` de la salle et libellés ; `canBookRoom(...)` |
| `js/actions/bookings.js` | `createBooking`, `cancelBooking`, `recordEntry`, `recordExit`, `closeDueBookings`, `sweepBookings`, `roomChecklist`, `userBookings`, `weekBookings` |
| `js/weekGrid.js` | Grille de semaine pure : `startOfWeek`, `weekDays`, `roomHours`, `buildWeekGrid`, `toggleSlot`, `selectionIsValid` |
| `js/mobile/views/salle.js` | Grille tactile, mes réservations, états des lieux |
| `js/mobile/views/accueil.js` (modif) | Bouton « État des lieux » quand un créneau est en cours |
| `js/admin/views/salle.js` | Planning hebdomadaire, détail d'une réservation, annulation |
| `js/admin/app.js`, `js/mobile/app.js` (modif) | Route `/salle` + balayage des clôtures dans la garde |
| `js/admin/views/dashboard.js` (modif) | Widget « Sorties non faites » |
| `css/mobile.css`, `css/admin.css` (modif) | Grille de créneaux, planning, état des lieux |
| `tests/ui.test.mjs`, `tests/store.test.mjs`, `tests/rules.test.mjs` (modif) ; `tests/week-grid.test.mjs`, `tests/actions-bookings.test.mjs`, `tests/mobile-salle.test.mjs`, `tests/admin-salle.test.mjs` | Tests Node |

Signatures existantes réutilisées : `store.transaction(fn)`, `store.<coll>.*`, `store.subscribe` ; `now`, `ymd`, `fromYmd`, `addDays`, `isWeekday`, `withDefaults`, `sortByDateDesc`, `bookingStart`, `bookingEnd`, `isBookingActive`, `isExitMissing`, `slotsAreContiguous`, `slotsInRoomHours`, `slotsConflict`, `REASONS`, `REASON_LABELS` ; `buildRoomChecklist`, `hasProblem`, `problemLines` ; `logAction`, `ACTIONS` (dont `BOOKING_CREEE`, `BOOKING_ANNULEE`, `BOOKING_ENTREE`, `BOOKING_SORTIE`, `MAINT_SIGNALEMENT`) ; `sweepExpirations` (phase 3) ; `renderTable`/`bindTable` ; `setTopbar`, `setHeader` ; `openModal`, `toast`, `badge`, `avatar`, `formatDate`, `formatTime`, `formatSlots`, `relativeDay`, `fullName`, `escapeHtml` ; `BOOKING_STATES`, `MAINT_TYPES`, `MAINT_STATES`, `CIRCUITS`, `LABELS`.

---

### Task 1 : Prérequis — dates locales et transaction différée

**Files:**
- Modify: `js/ui.js` (`toDate`), `js/store.js` (`transaction`, `commit`)
- Test: `tests/ui.test.mjs`, `tests/store.test.mjs`

**Interfaces:**
- Produces : `toDate` interprète `'2026-09-17'` comme le 17 septembre **minuit local** ; `store.transaction(fn)` ne persiste et ne notifie **qu'une fois**, à la fin, et ne notifie pas du tout si `fn` lève.

- [ ] **Step 1 : Écrire les tests**

Ajouter à `tests/ui.test.mjs` :

```js
test('toDate : une date seule est locale, pas UTC', () => {
  // new Date('2026-09-17') vaut minuit UTC : à l’ouest de Greenwich, c’est le 16 au soir.
  assert.equal(formatDate('2026-09-17'), '17 sept. 2026');
  assert.equal(relativeDay('2026-09-17', new Date(2026, 8, 17, 23, 30)), 'Aujourd’hui');
  assert.equal(relativeDay('2026-09-18', new Date(2026, 8, 17, 0, 10)), 'Demain');
  // Les horodatages ISO complets restent interprétés comme avant.
  assert.equal(formatTime('2026-09-17T09:05:00.000Z'), formatTime(new Date('2026-09-17T09:05:00.000Z')));
});
```

Ajouter à `tests/store.test.mjs` :

```js
test('transaction : une seule persistance et une seule notification', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  const out = store.transaction(() => {
    store.users.create({ nom: 'A' });
    store.users.create({ nom: 'B' });
    store.settings.update({ marqueur: 1 });
    return 'ok';
  });
  off();
  assert.equal(out, 'ok');
  assert.equal(n, 1, 'une seule notification pour trois écritures');
  assert.equal(store.users.list().length, 2);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).users.length, 2, 'persisté');
});

test('transaction : un échec ne notifie pas et ne laisse rien derrière', () => {
  const before = store.users.list().length;
  let n = 0;
  const off = store.subscribe(() => n++);
  assert.throws(() => store.transaction(() => {
    store.users.create({ nom: 'A' });
    throw new Error('boum');
  }), /boum/);
  off();
  assert.equal(n, 0, 'aucune notification pour une transaction annulée');
  assert.equal(store.users.list().length, before);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).users.length, before);
});

test('transaction imbriquée : la notification part à la sortie de la plus externe', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  store.transaction(() => {
    store.users.create({ nom: 'A' });
    store.transaction(() => { store.users.create({ nom: 'B' }); });
    assert.equal(n, 0, 'rien pendant la transaction');
  });
  off();
  assert.equal(n, 1);
  assert.equal(store.users.list().length, 2);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/ui.test.mjs tests/store.test.mjs`
Expected: FAIL — `relativeDay('2026-09-17', …)` répond « Hier » dans un fuseau négatif (et le test de notification compte 3 au lieu de 1).

- [ ] **Step 3 : Corriger `toDate` dans `js/ui.js`**

```js
// Une date seule « AAAA-MM-JJ » est interprétée en heure locale : `new Date('2026-09-17')`
// vaudrait minuit UTC, soit la veille au soir à l’ouest de Greenwich.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const toDate = (d) => {
  if (d instanceof Date) return d;
  const m = DATE_ONLY_RE.exec(String(d));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
};
```

- [ ] **Step 4 : Différer persistance et notification dans `js/store.js`**

Remplacer le bloc `commit`/`transaction` par :

```js
let depth = 0;      // profondeur de transaction
let pending = false; // des écritures attendent d’être persistées

function commit() {
  if (depth > 0) { pending = true; return; }
  persist();
  notify();
}
```

et, dans l'objet `store` :

```js
  // Regroupe plusieurs écritures : une seule persistance et une seule notification à la fin.
  // Si `fn` lève, l’état d’avant est restauré et personne n’est notifié.
  transaction(fn) {
    assertInit();
    const snapshot = localStorage.getItem(STORAGE_KEY);
    depth += 1;
    try {
      const out = fn();
      depth -= 1;
      if (depth === 0 && pending) { pending = false; persist(); notify(); }
      return out;
    } catch (err) {
      depth -= 1;
      if (depth === 0) {
        pending = false;
        if (snapshot === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, snapshot);
        load();
      }
      throw err;
    }
  },
```

(La restauration ne notifie plus : personne n'a été notifié pendant la transaction, il n'y a donc rien à corriger côté abonnés. Le `load()` remet la base en mémoire en cohérence avec le stockage.)

- [ ] **Step 5 : Lancer la suite complète**

Run: `npm test`
Expected: **un** échec attendu, celui du test de la phase 2 `transaction : si fn() lève, les écritures intermédiaires sont annulées et les abonnés notifiés` (`tests/store.test.mjs`), qui affirmait `assert.ok(n >= 1)` : avec la persistance différée, plus personne n'est notifié pendant une transaction, donc il n'y a rien à corriger côté abonnés après son annulation. Remplacer ce test par :

```js
test('transaction : si fn() lève, les écritures intermédiaires sont annulées sans notification', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  assert.throws(() => store.transaction(() => {
    store.users.create({ nom: 'A' });
    throw new Error('boom');
  }), /boom/);
  off();
  assert.equal(store.users.list().length, 0);
  assert.equal(n, 0, 'aucun abonné n’a vu l’état intermédiaire');
});
```

puis relancer `npm test` : 0 échec. Si un autre test d'une phase précédente comptait des notifications intermédiaires (chercher `subscribe` dans `tests/`), l'ajuster de la même façon et le signaler dans le rapport.

- [ ] **Step 6 : Commit**

```bash
git add js/ui.js js/store.js tests/ui.test.mjs tests/store.test.mjs
git commit -m "fix(ui, store): dates seules en heure locale et transaction à notification unique"
```

---

### Task 2 : `weekGrid.js` — grille de semaine partagée

**Files:**
- Create: `js/weekGrid.js`
- Test: `tests/week-grid.test.mjs`

**Interfaces:**
- Consumes : `ymd`, `fromYmd`, `addDays`, `isWeekday`, `withDefaults`, `slotsAreContiguous`, `slotsInRoomHours`, `slotsConflict` (`js/rules.js`), `BOOKING_STATES`.
- Produces : `startOfWeek(date) → Date` (lundi 00h00 local), `weekDays(date) → [{ ymd, date, label, isToday }]` (5 jours ouvrés), `roomHours(settings) → number[]` (8…16), `buildWeekGrid({ date, bookings, settings, userId, now }) → { days, hours, cells }` où `cells[ymd][heure] = { heure, booking, mine, past, free }`, `toggleSlot(selection, { ymd, heure }) → selection` (`{ ymd, creneaux }`, bascule et remet à zéro si on change de jour), `selectionIsValid(selection, { bookings, settings, date }) → { ok, reason }`.

- [ ] **Step 1 : Écrire le test**

`tests/week-grid.test.mjs` :

```js
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, REASONS } from '../js/rules.js';
import { startOfWeek, weekDays, roomHours, buildWeekGrid, toggleSlot, selectionIsValid } from '../js/weekGrid.js';

const JEUDI = new Date(2026, 8, 17, 10, 0);   // jeudi 17 septembre 2026
const S = DEFAULT_SETTINGS;

test('startOfWeek : lundi minuit, y compris un week-end', () => {
  assert.equal(startOfWeek(JEUDI).getDate(), 14);
  assert.equal(startOfWeek(JEUDI).getHours(), 0);
  assert.equal(startOfWeek(new Date(2026, 8, 14, 23, 59)).getDate(), 14, 'lundi');
  assert.equal(startOfWeek(new Date(2026, 8, 20, 12, 0)).getDate(), 14, 'dimanche → lundi précédent');
  assert.equal(startOfWeek(new Date(2026, 8, 19, 12, 0)).getDate(), 14, 'samedi → lundi précédent');
});

test('weekDays : 5 jours ouvrés étiquetés, aujourd’hui repéré', () => {
  const days = weekDays(JEUDI);
  assert.equal(days.length, 5);
  assert.deepEqual(days.map((d) => d.ymd), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
  assert.match(days[0].label, /lun/i);
  assert.equal(days[3].isToday, true);
  assert.equal(days[0].isToday, false);
  assert.ok(days.every((d) => d.date instanceof Date));
});

test('roomHours : 8h à 16h inclus (16 = 16h-17h)', () => {
  assert.deepEqual(roomHours(S), [8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(roomHours({ salle: { heureDebut: 9, heureFin: 11 } }), [9, 10]);
});

test('buildWeekGrid : réservations placées, créneaux passés marqués, les miennes repérées', () => {
  const bookings = [
    { id: 'b1', userId: 'u1', date: '2026-09-17', creneaux: [9, 10], statut: 'en_cours' },
    { id: 'b2', userId: 'u2', date: '2026-09-18', creneaux: [14], statut: 'a_venir' },
    { id: 'b3', userId: 'u2', date: '2026-09-17', creneaux: [15], statut: 'annulee' },
  ];
  const grid = buildWeekGrid({ date: JEUDI, bookings, settings: S, userId: 'u1', now: JEUDI });
  assert.equal(grid.days.length, 5);
  assert.deepEqual(grid.hours, [8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const jeudi = grid.cells['2026-09-17'];
  assert.equal(jeudi[9].booking.id, 'b1');
  assert.equal(jeudi[9].mine, true);
  assert.equal(jeudi[9].free, false);
  assert.equal(grid.cells['2026-09-18'][14].mine, false);
  assert.equal(jeudi[15].booking, null, 'une réservation annulée libère le créneau');
  assert.equal(jeudi[15].free, true);
  assert.equal(grid.cells['2026-09-16'][9].past, true, 'hier');
  assert.equal(jeudi[8].past, true, 'ce matin');
  assert.equal(jeudi[11].past, false);
  assert.equal(jeudi[11].free, true);
});

test('toggleSlot : ajoute, retire, change de jour', () => {
  let sel = toggleSlot({ ymd: null, creneaux: [] }, { ymd: '2026-09-17', heure: 9 });
  assert.deepEqual(sel, { ymd: '2026-09-17', creneaux: [9] });
  sel = toggleSlot(sel, { ymd: '2026-09-17', heure: 10 });
  assert.deepEqual(sel.creneaux, [9, 10]);
  sel = toggleSlot(sel, { ymd: '2026-09-17', heure: 9 });
  assert.deepEqual(sel.creneaux, [10]);
  sel = toggleSlot(sel, { ymd: '2026-09-18', heure: 8 });
  assert.deepEqual(sel, { ymd: '2026-09-18', creneaux: [8] }, 'changer de jour repart de zéro');
  const vide = toggleSlot({ ymd: '2026-09-18', creneaux: [8] }, { ymd: '2026-09-18', heure: 8 });
  assert.deepEqual(vide, { ymd: null, creneaux: [] }, 'plus rien de sélectionné');
});

test('selectionIsValid : vide, non contiguë, conflit, passé, jour ouvré', () => {
  const bookings = [{ id: 'b1', userId: 'u2', date: '2026-09-17', creneaux: [14], statut: 'a_venir' }];
  const ctx = { bookings, settings: S, date: JEUDI };
  assert.deepEqual(selectionIsValid({ ymd: null, creneaux: [] }, ctx), { ok: false, reason: REASONS.CRENEAU_VIDE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [11, 13] }, ctx), { ok: false, reason: REASONS.CRENEAUX_NON_CONTIGUS });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [13, 14] }, ctx), { ok: false, reason: REASONS.CRENEAU_OCCUPE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [8] }, ctx), { ok: false, reason: REASONS.CRENEAU_PASSE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-19', creneaux: [9] }, ctx), { ok: false, reason: REASONS.SALLE_FERMEE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [11, 12, 13] }, ctx), { ok: true, reason: null });
});
```

- [ ] **Step 2 : Ajouter les motifs dans `js/rules.js`**

Dans `REASONS` : `CRENEAU_VIDE: 'creneau_vide',`, `CRENEAUX_NON_CONTIGUS: 'creneaux_non_contigus',`, `CRENEAU_OCCUPE: 'creneau_occupe',`, `CRENEAU_PASSE: 'creneau_passe',`, `SALLE_FERMEE: 'salle_fermee',`.
Dans `REASON_LABELS` : `creneau_vide: 'Choisissez au moins un créneau.',`, `creneaux_non_contigus: 'Les créneaux doivent se suivre sans interruption.',`, `creneau_occupe: 'Un de ces créneaux est déjà réservé.',`, `creneau_passe: 'Ce créneau est déjà passé.',`, `salle_fermee: 'La salle photo est ouverte du lundi au vendredi, de 8h à 17h.',`.

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/week-grid.test.mjs`
Expected: FAIL — `Cannot find module '../js/weekGrid.js'`

- [ ] **Step 4 : Écrire `js/weekGrid.js`**

```js
// js/weekGrid.js — grille de semaine de la salle photo, partagée par le mobile et l’admin.
// Fonctions pures : elles reçoivent les réservations, les réglages et la date.
import { ymd, fromYmd, addDays, isWeekday, withDefaults, slotsAreContiguous, slotsInRoomHours, slotsConflict, REASONS } from './rules.js';
import { BOOKING_STATES } from './models.js';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

// Lundi 00h00 de la semaine contenant `date` (le week-end rattache à la semaine écoulée).
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const delta = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - delta);
  return d;
}

export function weekDays(date) {
  const lundi = startOfWeek(date);
  const today = ymd(date);
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDays(lundi, i);
    return { ymd: ymd(d), date: d, label: dayFmt.format(d), isToday: ymd(d) === today };
  });
}

export function roomHours(settings) {
  const salle = withDefaults(settings).salle;
  const hours = [];
  for (let h = salle.heureDebut; h < salle.heureFin; h += 1) hours.push(h);
  return hours;
}

// cells[ymd][heure] : qui occupe, est-ce moi, est-ce passé, est-ce libre.
export function buildWeekGrid({ date, bookings, settings, userId, now }) {
  const days = weekDays(date);
  const hours = roomHours(settings);
  const actives = bookings.filter((b) => b.statut !== BOOKING_STATES.ANNULEE);
  const cells = {};
  for (const day of days) {
    cells[day.ymd] = {};
    for (const heure of hours) {
      const booking = actives.find((b) => b.date === day.ymd && b.creneaux.includes(heure)) || null;
      const past = fromYmd(day.ymd, heure + 1) <= now;
      cells[day.ymd][heure] = { heure, booking, mine: !!booking && booking.userId === userId, past, free: !booking && !past };
    }
  }
  return { days, hours, cells };
}

export function toggleSlot(selection, { ymd: jour, heure }) {
  if (selection.ymd !== jour) return { ymd: jour, creneaux: [heure] };
  const creneaux = selection.creneaux.includes(heure)
    ? selection.creneaux.filter((h) => h !== heure)
    : [...selection.creneaux, heure].sort((a, b) => a - b);
  return creneaux.length ? { ymd: jour, creneaux } : { ymd: null, creneaux: [] };
}

export function selectionIsValid(selection, { bookings, settings, date }) {
  const S = withDefaults(settings);
  if (!selection.ymd || !selection.creneaux.length) return { ok: false, reason: REASONS.CRENEAU_VIDE };
  if (!isWeekday(fromYmd(selection.ymd)) || !slotsInRoomHours(selection.creneaux, S.salle)) return { ok: false, reason: REASONS.SALLE_FERMEE };
  if (!slotsAreContiguous(selection.creneaux)) return { ok: false, reason: REASONS.CRENEAUX_NON_CONTIGUS };
  if (fromYmd(selection.ymd, Math.max(...selection.creneaux) + 1) <= date) return { ok: false, reason: REASONS.CRENEAU_PASSE };
  if (slotsConflict(bookings, selection.ymd, selection.creneaux)) return { ok: false, reason: REASONS.CRENEAU_OCCUPE };
  return { ok: true, reason: null };
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/week-grid.test.mjs tests/rules.test.mjs`
Expected: 0 échec (le test « chaque motif a un libellé » de `rules.test.mjs` couvre les 5 nouveaux motifs).

- [ ] **Step 6 : Commit**

```bash
git add js/weekGrid.js js/rules.js tests/week-grid.test.mjs
git commit -m "feat(salle): grille de semaine partagée et règles de sélection de créneaux"
```

---

### Task 3 : `actions/bookings.js` — réservations et états des lieux

**Files:**
- Create: `js/actions/bookings.js`
- Test: `tests/actions-bookings.test.mjs`

**Interfaces:**
- Consumes : `store.transaction`, `selectionIsValid` (`js/weekGrid.js`), `now`, `ymd`, `fromYmd`, `bookingStart`, `bookingEnd`, `isBookingActive`, `isExitMissing`, `withDefaults`, `sortByDateDesc`, `REASONS`, `REASON_LABELS` ; `buildRoomChecklist`, `hasProblem`, `problemLines` ; `logAction`, `ACTIONS` ; `CIRCUITS`, `BOOKING_STATES`, `MAINT_TYPES`, `MAINT_STATES`.
- Produces :
  - `roomItems() → Item[]` (circuit `salle`, hors service exclus) ;
  - `roomChecklist() → [{ itemId, ligne, ok, commentaire }]` ;
  - `createBooking({ userId, date, creneaux }) → Booking` (lève `Error` avec `.reason`) ;
  - `cancelBooking(id, auteurId) → Booking` ;
  - `recordEntry({ bookingId, userId, checklist }) → { booking, maintenance }` (passe `en_cours`) ;
  - `recordExit({ bookingId, userId, checklist }) → { booking, maintenance }` (passe `terminee`) ;
  - `closeDueBookings(date = now()) → number` (idempotent : passe `a_venir`/`en_cours` dépassées en `terminee` quand la sortie est faite, et laisse les sorties manquantes visibles) ;
  - `sweepBookings(date = now()) → number` (enrobage try/catch, comme `sweepExpirations`) ;
  - `userBookings(userId, date = now()) → { active, aVenir, passees }` où `active` est `{ booking, entreeFaite, sortieFaite } | null` ;
  - `weekBookings(date) → Booking[]` (les réservations de la semaine de `date`, annulées comprises pour l'admin).

- [ ] **Step 1 : Écrire le test**

`tests/actions-bookings.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS, now } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { BOOKING_STATES, ITEM_STATES, MAINT_STATES } from '../js/models.js';
import {
  roomItems, roomChecklist, createBooking, cancelBooking, recordEntry, recordExit,
  closeDueBookings, sweepBookings, userBookings, weekBookings,
} from '../js/actions/bookings.js';

const NOW = new Date(2026, 8, 17, 10, 0);    // jeudi 17 sept. 10h
const DEMAIN = '2026-09-18';                  // vendredi
const ELEVE = 'user_010';
const PEDAGO = 'user_041';

const clock = (d) => store.settings.update({ horlogeDemo: d.toISOString() });

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  clock(NOW);
});

test('roomItems et roomChecklist : les 5 objets de la salle, plus la ligne globale', () => {
  const items = roomItems();
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.circuit === 'salle'));
  const lignes = roomChecklist();
  assert.equal(lignes.length, 6);
  assert.equal(lignes.at(-1).itemId, null);
  assert.match(lignes.at(-1).ligne, /Salle rangée/);
  assert.ok(lignes.every((l) => l.ok === true && l.commentaire === ''));
});

test('createBooking : réservation contiguë, journal, conflit et créneau passé refusés', () => {
  const b = createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [13, 14] });
  assert.equal(b.statut, BOOKING_STATES.A_VENIR);
  assert.deepEqual(b.creneaux, [13, 14]);
  assert.equal(b.etatEntree, null);
  assert.equal(b.etatSortie, null);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.BOOKING_CREEE);
  assert.equal(entry.bookingId, b.id);
  assert.match(entry.detail, /13h-15h/);
  assert.throws(() => createBooking({ userId: 'user_011', date: DEMAIN, creneaux: [14] }), (e) => e.reason === REASONS.CRENEAU_OCCUPE);
  assert.throws(() => createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [8] }), (e) => e.reason === REASONS.CRENEAU_PASSE);
  assert.throws(() => createBooking({ userId: ELEVE, date: '2026-09-19', creneaux: [9] }), (e) => e.reason === REASONS.SALLE_FERMEE);
  assert.throws(() => createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [9, 11] }), (e) => e.reason === REASONS.CRENEAUX_NON_CONTIGUS);
});

test('cancelBooking : libère les créneaux, journalise, refuse une réservation terminée', () => {
  const b = createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [13] });
  const annule = cancelBooking(b.id, ELEVE);
  assert.equal(annule.statut, BOOKING_STATES.ANNULEE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_ANNULEE);
  const libre = createBooking({ userId: 'user_011', date: DEMAIN, creneaux: [13] });
  assert.equal(libre.statut, BOOKING_STATES.A_VENIR);
  assert.throws(() => cancelBooking(b.id, ELEVE), /plus annulable/);
  assert.throws(() => cancelBooking('nope', ELEVE), /introuvable/);
});

test('recordEntry : passe en cours, horodate, journalise ; refuse hors créneau et pour un autre', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11, 12] });
  assert.throws(() => recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), (e) => e.reason === REASONS.CRENEAU_PASSE || /pas encore commencé/.test(e.message));
  clock(new Date(2026, 8, 17, 11, 5));
  assert.throws(() => recordEntry({ bookingId: b.id, userId: 'user_011', checklist: roomChecklist() }), /ne vous appartient pas/);
  const r = recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  assert.equal(r.maintenance, null);
  assert.equal(r.booking.statut, BOOKING_STATES.EN_COURS);
  assert.equal(r.booking.etatEntree.lignes.length, 6);
  assert.equal(new Date(r.booking.etatEntree.date).getHours(), 11);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_ENTREE);
  assert.throws(() => recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /déjà/);
});

test('recordEntry avec un problème : signalement, objet en maintenance, deux entrées de journal', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  const lignes = roomChecklist();
  lignes[0].ok = false;
  lignes[0].commentaire = 'une ampoule grillée';
  const before = store.log.list().length;
  const r = recordEntry({ bookingId: b.id, userId: ELEVE, checklist: lignes });
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.equal(r.maintenance.bookingId, b.id);
  assert.equal(r.maintenance.itemId, lignes[0].itemId);
  assert.match(r.maintenance.description, /ampoule grillée/);
  assert.equal(store.items.get(lignes[0].itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(store.log.list().length, before + 2);
});

test('recordExit : termine, journalise, exige l’entrée', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  assert.throws(() => recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /état des lieux d’entrée/);
  recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  clock(new Date(2026, 8, 17, 11, 50));
  const r = recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  assert.equal(r.booking.statut, BOOKING_STATES.TERMINEE);
  assert.equal(r.booking.etatSortie.lignes.length, 6);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_SORTIE);
  assert.throws(() => recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /plus en cours/);
});

test('closeDueBookings : clôture les créneaux passés sans sortie manquante, idempotent', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  const jamaisVenue = createBooking({ userId: 'user_011', date: '2026-09-17', creneaux: [13] });
  clock(new Date(2026, 8, 17, 14, 30));
  assert.equal(closeDueBookings(), 1, 'la réservation jamais ouverte est clôturée');
  const apres = store.bookings.get(jamaisVenue.id);
  assert.equal(apres.statut, BOOKING_STATES.TERMINEE);
  assert.equal(apres.etatEntree, null, 'aucun état des lieux n’est inventé');
  assert.equal(closeDueBookings(), 0, 'idempotent');
});

test('sweepBookings : une écriture qui échoue ne lève pas', () => {
  createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 13, 30));
  const orig = store.log.create;
  store.log.create = () => { throw new Error('quota'); };
  try {
    assert.equal(sweepBookings(), 0);
  } finally {
    store.log.create = orig;
  }
  assert.equal(store.bookings.list((b) => b.statut === BOOKING_STATES.A_VENIR && b.date === '2026-09-17').length, 1, 'rien n’a été écrit');
  assert.equal(sweepBookings(), 1, 'le balayage suivant réussit');
});

test('userBookings et weekBookings', () => {
  const active = store.bookings.list((b) => b.statut === BOOKING_STATES.EN_COURS)[0];
  const u = userBookings(active.userId, NOW);
  assert.equal(u.active.booking.id, active.id);
  assert.equal(u.active.entreeFaite, true);
  assert.equal(u.active.sortieFaite, false);
  const futur = userBookings('user_008', NOW);
  assert.equal(futur.active, null);
  assert.ok(futur.aVenir.every((b) => b.date >= '2026-09-17'));
  const semaine = weekBookings(NOW);
  assert.ok(semaine.every((b) => b.date >= '2026-09-14' && b.date <= '2026-09-18'));
  assert.ok(semaine.some((b) => b.id === active.id));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/actions-bookings.test.mjs`
Expected: FAIL — `Cannot find module '../js/actions/bookings.js'`

- [ ] **Step 3 : Écrire `js/actions/bookings.js`**

```js
// js/actions/bookings.js — réservations de la salle photo et états des lieux.
// Réserver la salle vaut responsabilité de son contenu (spec §5.3) : le matériel « salle »
// ne fait pas l’objet d’emprunts individuels, il est contrôlé à l’entrée et à la sortie.
import { store } from '../store.js';
import { BOOKING_STATES, CIRCUITS, ITEM_STATES, MAINT_TYPES, MAINT_STATES } from '../models.js';
import { now, ymd, fromYmd, bookingStart, bookingEnd, isBookingActive, sortByDateDesc, REASONS, REASON_LABELS } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { buildRoomChecklist, hasProblem, problemLines } from '../checklists.js';
import { selectionIsValid, startOfWeek, weekDays } from '../weekGrid.js';
import { fullName, formatSlots } from '../ui.js';

function refusal(reason) {
  return Object.assign(new Error(REASON_LABELS[reason] || reason), { reason });
}

function requireBooking(id) {
  const booking = store.bookings.get(id);
  if (!booking) throw new Error(`Réservation introuvable (${id})`);
  return booking;
}

export function roomItems() {
  return store.items.list((i) => i.circuit === CIRCUITS.SALLE && i.etat !== ITEM_STATES.HS);
}

export function roomChecklist() {
  return buildRoomChecklist(roomItems());
}

export function createBooking({ userId, date, creneaux }) {
  const maintenant = now();
  const user = store.users.get(userId);
  if (!user || user.actif === false) throw refusal(REASONS.UTILISATEUR_INACTIF);
  const check = selectionIsValid({ ymd: date, creneaux: [...creneaux] }, { bookings: store.bookings.list(), settings: store.settings.get(), date: maintenant });
  if (!check.ok) throw refusal(check.reason);
  const ordonnes = [...creneaux].sort((a, b) => a - b);
  return store.transaction(() => {
    const booking = store.bookings.create({
      userId, date, creneaux: ordonnes, statut: BOOKING_STATES.A_VENIR, etatEntree: null, etatSortie: null,
    });
    logAction({ auteurId: userId, action: ACTIONS.BOOKING_CREEE, bookingId: booking.id, userId, detail: `Salle photo ${formatSlots(ordonnes)} — ${fullName(user)}` });
    return booking;
  });
}

export function cancelBooking(id, auteurId) {
  const booking = requireBooking(id);
  if (booking.statut !== BOOKING_STATES.A_VENIR && booking.statut !== BOOKING_STATES.EN_COURS) throw new Error('Cette réservation n’est plus annulable.');
  return store.transaction(() => {
    const updated = store.bookings.update(id, { statut: BOOKING_STATES.ANNULEE });
    logAction({ auteurId, action: ACTIONS.BOOKING_ANNULEE, bookingId: id, userId: booking.userId, detail: `Salle photo ${formatSlots(booking.creneaux)} du ${booking.date}` });
    return updated;
  });
}

// Un état des lieux : horodaté, enregistré tel quel, et tout problème ouvre un signalement
// par objet concerné (l’objet passe en maintenance). La ligne globale « salle rangée »
// n’a pas d’itemId : son problème est signalé sans changement d’état.
function recordEtatDesLieux({ booking, userId, checklist, moment }) {
  const date = now();
  const lignes = checklist || roomChecklist();
  const problem = hasProblem(lignes);
  const entree = moment === 'entree';
  const patch = entree
    ? { statut: BOOKING_STATES.EN_COURS, etatEntree: { date: date.toISOString(), lignes } }
    : { statut: BOOKING_STATES.TERMINEE, etatSortie: { date: date.toISOString(), lignes } };
  return store.transaction(() => {
    const updated = store.bookings.update(booking.id, patch);
    logAction({
      auteurId: userId, action: entree ? ACTIONS.BOOKING_ENTREE : ACTIONS.BOOKING_SORTIE,
      bookingId: booking.id, userId: booking.userId,
      detail: `État des lieux ${entree ? 'd’entrée' : 'de sortie'}${problem ? ' — problème signalé' : ' OK'}`,
    });
    if (!problem) return { booking: updated, maintenance: null };
    const lignesProblemes = problemLines(lignes);
    const description = `Signalé à l’état des lieux ${entree ? 'd’entrée' : 'de sortie'} : ${lignesProblemes.map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ')}`;
    const itemId = lignesProblemes.find((l) => l.itemId)?.itemId || null;
    const maintenance = store.maintenance.create({
      itemId, type: MAINT_TYPES.SIGNALEMENT, auteurId: userId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description, prestataire: '', cout: 0, loanId: null, bookingId: booking.id,
    });
    for (const ligne of lignesProblemes) {
      const item = ligne.itemId ? store.items.get(ligne.itemId) : null;
      if (item && item.etat === ITEM_STATES.DISPONIBLE) applyItemState(item.id, ITEM_STATES.MAINTENANCE);
    }
    logAction({ auteurId: userId, action: ACTIONS.MAINT_SIGNALEMENT, itemId, bookingId: booking.id, detail: description });
    return { booking: updated, maintenance };
  });
}

export function recordEntry({ bookingId, userId, checklist = null }) {
  const booking = requireBooking(bookingId);
  if (booking.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  if (booking.statut === BOOKING_STATES.ANNULEE || booking.statut === BOOKING_STATES.TERMINEE) throw new Error('Cette réservation est close.');
  if (booking.etatEntree) throw new Error('L’état des lieux d’entrée a déjà été fait.');
  const date = now();
  if (date < bookingStart(booking)) throw new Error('Le créneau n’a pas encore commencé.');
  if (date >= bookingEnd(booking)) throw refusal(REASONS.CRENEAU_PASSE);
  return recordEtatDesLieux({ booking, userId, checklist, moment: 'entree' });
}

export function recordExit({ bookingId, userId, checklist = null }) {
  const booking = requireBooking(bookingId);
  if (booking.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  // L’ordre compte : sans entrée la réservation est encore `a_venir`, et le message utile
  // est « faites d’abord l’entrée », pas « plus en cours ».
  if (booking.statut === BOOKING_STATES.ANNULEE || booking.statut === BOOKING_STATES.TERMINEE) throw new Error('Cette réservation n’est plus en cours.');
  if (!booking.etatEntree) throw new Error('Faites d’abord l’état des lieux d’entrée.');
  if (booking.statut !== BOOKING_STATES.EN_COURS) throw new Error('Cette réservation n’est plus en cours.');
  return recordEtatDesLieux({ booking, userId, checklist, moment: 'sortie' });
}

// Clôture les créneaux terminés : une réservation jamais ouverte ou dont la sortie a été faite
// passe `terminee`. Celles dont la sortie manque restent `en_cours` et remontent via `isExitMissing`.
export function closeDueBookings(date = now()) {
  const dues = store.bookings.list((b) => (b.statut === BOOKING_STATES.A_VENIR || b.statut === BOOKING_STATES.EN_COURS) && date >= bookingEnd(b) && !b.etatEntree);
  let closes = 0;
  for (const candidat of dues) {
    const booking = store.bookings.get(candidat.id);
    if (!booking || booking.etatEntree || booking.statut === BOOKING_STATES.TERMINEE || booking.statut === BOOKING_STATES.ANNULEE) continue;
    store.transaction(() => {
      store.bookings.update(booking.id, { statut: BOOKING_STATES.TERMINEE });
      logAction({ auteurId: booking.userId, action: ACTIONS.BOOKING_SORTIE, bookingId: booking.id, userId: booking.userId, detail: `Créneau ${formatSlots(booking.creneaux)} terminé — salle non occupée` });
    });
    closes += 1;
  }
  return closes;
}

// Balayage défensif appelé par les vues et les gardes : une écriture qui échoue
// (stockage plein) ne doit jamais empêcher l’affichage.
export function sweepBookings(date = now()) {
  try {
    return closeDueBookings(date);
  } catch (e) {
    console.error('Clôture des créneaux impossible :', e);
    return 0;
  }
}

export function userBookings(userId, date = now()) {
  const mine = store.bookings.list((b) => b.userId === userId && b.statut !== BOOKING_STATES.ANNULEE);
  const active = mine.find((b) => isBookingActive(b, date)) || null;
  const today = ymd(date);
  return {
    active: active ? { booking: active, entreeFaite: !!active.etatEntree, sortieFaite: !!active.etatSortie } : null,
    aVenir: mine.filter((b) => b.statut === BOOKING_STATES.A_VENIR && b.date >= today && b !== active).sort((a, b) => a.date.localeCompare(b.date) || a.creneaux[0] - b.creneaux[0]),
    passees: sortByDateDesc(mine.filter((b) => b.statut === BOOKING_STATES.TERMINEE), (b) => b.date),
  };
}

export function weekBookings(date) {
  const jours = weekDays(startOfWeek(date)).map((d) => d.ymd);
  return store.bookings.list((b) => jours.includes(b.date));
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `node --test tests/actions-bookings.test.mjs`
Expected: `# pass 9`, `# fail 0`

- [ ] **Step 5 : Commit**

```bash
git add js/actions/bookings.js tests/actions-bookings.test.mjs
git commit -m "feat(actions): réservations de la salle photo, états des lieux et clôture des créneaux"
```

---

### Task 4 : Mobile — écran Salle (grille, réservation, états des lieux)

**Files:**
- Create: `js/mobile/views/salle.js`
- Modify: `js/mobile/app.js` (route `/salle` + balayage dans la garde), `js/mobile/views/accueil.js` (bouton « État des lieux »), `css/mobile.css`
- Test: `tests/mobile-salle.test.mjs`

**Interfaces:**
- Consumes : `buildWeekGrid`, `toggleSlot`, `selectionIsValid`, `startOfWeek`, `weekDays` (`js/weekGrid.js`) ; `createBooking`, `cancelBooking`, `recordEntry`, `recordExit`, `roomChecklist`, `userBookings`, `weekBookings`, `sweepBookings` ; `now`, `addDays`, `ymd`, `REASON_LABELS` ; `setHeader`, helpers `ui`.
- Produces : `gridHtml({ grid, selection })`, `selectionBarHtml({ selection, check })`, `myBookingsHtml({ active, aVenir }, date)`, `etatHtml({ booking, moment, lignes })`, `salleHtml({ grid, selection, check, mine, date })`, `salleView(container)`.

- [ ] **Step 1 : Écrire le test**

`tests/mobile-salle.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS, REASONS } from '../js/rules.js';
import { buildWeekGrid, selectionIsValid } from '../js/weekGrid.js';
import { roomChecklist, userBookings } from '../js/actions/bookings.js';
import { gridHtml, selectionBarHtml, myBookingsHtml, etatHtml, salleHtml } from '../js/mobile/views/salle.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const ELEVE = 'user_010';
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

const grid = () => buildWeekGrid({ date: NOW, bookings: store.bookings.list(), settings: store.settings.get(), userId: ELEVE, now: NOW });

test('gridHtml : une colonne par jour ouvré, une case par heure, états distingués', () => {
  const html = gridHtml({ grid: grid(), selection: { ymd: '2026-09-17', creneaux: [11] } });
  assert.equal((html.match(/data-day="/g) || []).length, 5);
  assert.equal((html.match(/class="slot/g) || []).length, 45, '5 jours × 9 heures');
  assert.match(html, /data-slot="2026-09-17:11" class="slot slot--selected"/);
  assert.match(html, /data-slot="2026-09-17:8" class="slot slot--past"/);
  assert.match(html, /data-slot="2026-09-17:9" class="slot slot--taken"/, 'créneau déjà réservé');
  assert.match(html, /<th>11h<\/th>/);
});

test('selectionBarHtml : résumé, motif de refus, bouton actif ou non', () => {
  const vide = selectionBarHtml({ selection: { ymd: null, creneaux: [] }, check: { ok: false, reason: REASONS.CRENEAU_VIDE } });
  assert.match(vide, /Choisissez au moins un créneau/);
  assert.match(vide, /data-action="book"[^>]*disabled/);
  const ok = selectionBarHtml({ selection: { ymd: '2026-09-17', creneaux: [11, 12] }, check: { ok: true, reason: null } });
  assert.match(ok, /11h-13h/);
  assert.match(ok, /2 créneaux/);
  assert.doesNotMatch(ok, /disabled/);
  const occupe = selectionBarHtml({ selection: { ymd: '2026-09-17', creneaux: [9] }, check: { ok: false, reason: REASONS.CRENEAU_OCCUPE } });
  assert.match(occupe, /déjà réservé/);
});

test('myBookingsHtml : créneau en cours avec le bon bouton d’état des lieux', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const mine = userBookings(actif.userId, NOW);
  const html = myBookingsHtml(mine, NOW);
  assert.match(html, /9h-11h/);
  assert.match(html, /data-action="exit"/, 'entrée déjà faite → bouton de sortie');
  assert.doesNotMatch(html, /data-action="entry"/);
  const sansEntree = { active: { booking: { ...actif, etatEntree: null }, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] };
  assert.match(myBookingsHtml(sansEntree, NOW), /data-action="entry"/);
  const vide = myBookingsHtml({ active: null, aVenir: [], passees: [] }, NOW);
  assert.match(vide, /Aucune réservation/);
});

test('etatHtml : une ligne par objet plus la ligne globale, commentaires', () => {
  const booking = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html = etatHtml({ booking, moment: 'entree', lignes: roomChecklist() });
  assert.equal((html.match(/data-row="/g) || []).length, 6, 'une ligne par objet plus la ligne globale');
  assert.equal((html.match(/data-line="/g) || []).length, 12, 'deux boutons OK/Problème par ligne');
  assert.match(html, /État des lieux d’entrée/);
  assert.match(html, /Salle rangée/);
  assert.match(html, /data-action="confirm-etat"/);
  const sortie = etatHtml({ booking, moment: 'sortie', lignes: roomChecklist() });
  assert.match(sortie, /État des lieux de sortie/);
});

test('salleHtml : grille, barre de sélection et mes réservations', () => {
  const selection = { ymd: '2026-09-18', creneaux: [13] };
  const html = salleHtml({
    grid: grid(), selection, check: selectionIsValid(selection, { bookings: store.bookings.list(), settings: DEFAULT_SETTINGS, date: NOW }),
    mine: userBookings(ELEVE, NOW), date: NOW,
  });
  assert.match(html, /data-action="prev-week"/);
  assert.match(html, /data-action="next-week"/);
  assert.match(html, /14 – 18 sept\./);
  assert.match(html, /data-slot=/);
  assert.match(html, /data-action="book"/);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-salle.test.mjs`
Expected: FAIL — `Cannot find module '../js/mobile/views/salle.js'`

- [ ] **Step 3 : Écrire `js/mobile/views/salle.js`**

```js
// js/mobile/views/salle.js — réservation de la salle photo : grille de semaine tactile,
// mes réservations et états des lieux d’entrée et de sortie.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, addDays, ymd, REASON_LABELS } from '../../rules.js';
import { escapeHtml, badge, formatDate, formatSlots, relativeDay, openModal, toast } from '../../ui.js';
import { buildWeekGrid, toggleSlot, selectionIsValid, startOfWeek, weekDays } from '../../weekGrid.js';
import { createBooking, cancelBooking, recordEntry, recordExit, roomChecklist, userBookings, sweepBookings } from '../../actions/bookings.js';
import { setHeader } from '../layout.js';

const emptySelection = () => ({ ymd: null, creneaux: [] });

function slotClass(cell, selection) {
  if (selection.ymd === cell.ymdJour && selection.creneaux.includes(cell.heure)) return 'slot slot--selected';
  if (cell.booking) return cell.mine ? 'slot slot--mine' : 'slot slot--taken';
  if (cell.past) return 'slot slot--past';
  return 'slot slot--free';
}

export function gridHtml({ grid, selection }) {
  const entetes = grid.days.map((d) => `<th data-day="${escapeHtml(d.ymd)}"${d.isToday ? ' class="is-today"' : ''}>${escapeHtml(d.label)}</th>`).join('');
  const lignes = grid.hours.map((heure) => {
    const cases = grid.days.map((d) => {
      const cell = { ...grid.cells[d.ymd][heure], ymdJour: d.ymd };
      const cls = slotClass(cell, selection);
      const libelle = cell.booking ? (cell.mine ? 'Vous' : 'Pris') : '';
      const disabled = cell.booking || cell.past ? ' disabled' : '';
      return `<td><button type="button" data-slot="${escapeHtml(d.ymd)}:${heure}" class="${cls}"${disabled} aria-label="${escapeHtml(d.label)} ${heure}h">${escapeHtml(libelle)}</button></td>`;
    }).join('');
    return `<tr><th>${heure}h</th>${cases}</tr>`;
  }).join('');
  return `<table class="week-grid"><thead><tr><th></th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}

export function selectionBarHtml({ selection, check }) {
  const n = selection.creneaux.length;
  const resume = n
    ? `<strong>${escapeHtml(formatSlots(selection.creneaux))}</strong> · ${n} créneau${n > 1 ? 'x' : ''}`
    : 'Touchez un ou plusieurs créneaux qui se suivent.';
  const message = check.ok ? '' : `<p class="body-tiny text-secondary">${escapeHtml(REASON_LABELS[check.reason] || '')}</p>`;
  return `
    <div class="selection-bar">
      <div class="selection-bar__resume body-sm">${resume}</div>
      ${message}
      <button type="button" class="btn btn--primary btn--block" data-action="book"${check.ok ? '' : ' disabled'}>Réserver</button>
    </div>`;
}

export function myBookingsHtml({ active, aVenir }, date) {
  const bloc = [];
  if (active) {
    const { booking, entreeFaite, sortieFaite } = active;
    const action = !entreeFaite
      ? '<button type="button" class="btn btn--primary btn--block" data-action="entry">Faire l’état des lieux d’entrée</button>'
      : (!sortieFaite ? '<button type="button" class="btn btn--primary btn--block" data-action="exit">Faire l’état des lieux de sortie</button>' : '');
    bloc.push(`
      <div class="m-item m-item--stacked m-item--pickup">
        <div class="m-item__row"><span class="m-item__body"><strong>Créneau en cours · ${escapeHtml(formatSlots(booking.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(booking.date))}</span></span>${badge('booking', booking.statut)}</div>
        ${action}
      </div>`);
  }
  for (const b of aVenir) {
    bloc.push(`
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${escapeHtml(relativeDay(b.date, date))} · ${escapeHtml(formatSlots(b.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(b.date))}</span></span>${badge('booking', b.statut)}</div>
        <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-booking="${escapeHtml(b.id)}">Annuler</button>
      </div>`);
  }
  if (!bloc.length) return '<div class="empty-state">Aucune réservation de la salle photo.</div>';
  return `<div class="m-list">${bloc.join('')}</div>`;
}

export function etatHtml({ booking, moment, lignes }) {
  const titre = moment === 'entree' ? 'État des lieux d’entrée' : 'État des lieux de sortie';
  const aide = moment === 'entree'
    ? 'Vérifiez le matériel avant de commencer : ce que vous signalez maintenant ne vous sera pas reproché.'
    : 'Vérifiez le matériel avant de partir : la salle doit être rangée.';
  const rows = lignes.map((l, i) => `
    <div class="checklist__row${l.ok ? '' : ' checklist__row--problem'}" data-row="${i}">
      <span class="checklist__line">${escapeHtml(l.ligne)}</span>
      <div class="seg">
        <button type="button" data-line="${i}" data-ok="1" class="seg__btn${l.ok ? ' seg__btn--on' : ''}">OK</button>
        <button type="button" data-line="${i}" data-ok="0" class="seg__btn${l.ok ? '' : ' seg__btn--problem'}">Problème</button>
      </div>
      <textarea class="textarea checklist__comment" data-comment="${i}" placeholder="Décrivez le problème (optionnel)">${escapeHtml(l.commentaire)}</textarea>
    </div>`).join('');
  return `
    <h2 class="h6">${escapeHtml(titre)}</h2>
    <p class="body-sm text-secondary">${escapeHtml(aide)} · ${escapeHtml(formatSlots(booking.creneaux))}</p>
    <div class="checklist">${rows}</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-etat">Valider l’état des lieux</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel-etat">Retour</button>`;
}

const weekLabel = (date) => {
  const jours = weekDays(date);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(jours[0].date)} – ${fmt.format(jours[4].date)}`;
};

export function salleHtml({ grid, selection, check, mine, date }) {
  return `
    <section class="card">
      <div class="card__header">
        <button type="button" class="btn btn--ghost btn--sm" data-action="prev-week" aria-label="Semaine précédente">←</button>
        <h2 class="card__title">${escapeHtml(weekLabel(date))}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="next-week" aria-label="Semaine suivante">→</button>
      </div>
      ${gridHtml({ grid, selection })}
    </section>
    ${selectionBarHtml({ selection, check })}
    <section class="m-section">
      <h2 class="label-caps text-secondary">Mes réservations</h2>
      ${myBookingsHtml(mine, date)}
    </section>`;
}

export function salleView(container) {
  const user = auth.currentUser();
  let semaine = now();
  let selection = emptySelection();
  let etat = null; // { bookingId, moment, lignes } quand un état des lieux est ouvert

  const render = () => {
    sweepBookings(now());
    const date = now();
    const bookings = store.bookings.list();
    const settings = store.settings.get();
    if (etat) {
      const booking = store.bookings.get(etat.bookingId);
      setHeader({ title: 'Salle photo', back: '/salle' });
      container.innerHTML = etatHtml({ booking, moment: etat.moment, lignes: etat.lignes });
      container.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.line);
        const ok = b.dataset.ok === '1';
        etat.lignes = etat.lignes.map((l, k) => (k === i ? { ...l, ok, commentaire: ok ? '' : l.commentaire } : l));
        render();
      }));
      container.querySelectorAll('[data-comment]').forEach((t) => t.addEventListener('input', () => {
        const i = Number(t.dataset.comment);
        etat.lignes = etat.lignes.map((l, k) => (k === i ? { ...l, commentaire: t.value } : l));
      }));
      container.querySelector('[data-action="cancel-etat"]').addEventListener('click', () => { etat = null; render(); });
      container.querySelector('[data-action="confirm-etat"]').addEventListener('click', () => {
        try {
          const args = { bookingId: etat.bookingId, userId: user.id, checklist: etat.lignes };
          const r = etat.moment === 'entree' ? recordEntry(args) : recordExit(args);
          toast(r.maintenance ? 'État des lieux enregistré — problème signalé' : 'État des lieux enregistré', r.maintenance ? 'warning' : 'success');
          etat = null;
          render();
        } catch (e) {
          toast(e.message, 'error');
        }
      });
      return;
    }
    const grid = buildWeekGrid({ date: semaine, bookings, settings, userId: user.id, now: date });
    const check = selectionIsValid(selection, { bookings, settings, date });
    setHeader({ title: 'Salle photo' });
    container.innerHTML = salleHtml({ grid, selection, check, mine: userBookings(user.id, date), date: semaine });
    container.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      const [jour, heure] = b.dataset.slot.split(':');
      selection = toggleSlot(selection, { ymd: jour, heure: Number(heure) });
      render();
    }));
    container.querySelector('[data-action="prev-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), -7); selection = emptySelection(); render(); });
    container.querySelector('[data-action="next-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), 7); selection = emptySelection(); render(); });
    container.querySelector('[data-action="book"]').addEventListener('click', () => {
      try {
        const b = createBooking({ userId: user.id, date: selection.ymd, creneaux: selection.creneaux });
        toast(`Salle réservée ${formatSlots(b.creneaux)} le ${formatDate(b.date)}`, 'success');
        selection = emptySelection();
        render();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    const entry = container.querySelector('[data-action="entry"]');
    if (entry) entry.addEventListener('click', () => { etat = { bookingId: userBookings(user.id, date).active.booking.id, moment: 'entree', lignes: roomChecklist() }; render(); });
    const exit = container.querySelector('[data-action="exit"]');
    if (exit) exit.addEventListener('click', () => { etat = { bookingId: userBookings(user.id, date).active.booking.id, moment: 'sortie', lignes: roomChecklist() }; render(); });
    container.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener('click', () => openModal({
      title: 'Annuler la réservation',
      body: '<p class="body-sm">Le créneau redeviendra libre pour les autres.</p>',
      actions: [
        { label: 'Garder', variant: 'ghost' },
        { label: 'Annuler la réservation', variant: 'danger', onClick: () => {
          try { cancelBooking(b.dataset.booking, user.id); toast('Réservation annulée', 'success'); }
          catch (e) { toast(e.message, 'error'); return false; }
        } },
      ],
    })));
  };

  render();
  return store.subscribe(render);
}
```


- [ ] **Step 4 : Route, garde et accueil**

`js/mobile/app.js` : `import { salleView } from './views/salle.js';` et remplacer la route `{ path: '/salle', view: guard(aVenirView('Salle photo', 4)) }` par `{ path: '/salle', view: guard(salleView) }`. Dans `guard`, après `sweepExpirations(now());`, ajouter `sweepBookings(now());` (importer depuis `../actions/bookings.js`).

`js/mobile/views/accueil.js` : `bookingCard` reçoit en plus `active` (depuis `userBookings`) et, quand le créneau est en cours et que l'état des lieux attendu n'est pas fait, affiche un bouton `<a class="btn btn--primary btn--block" href="#/salle">${entreeFaite ? 'Faire l’état des lieux de sortie' : 'Faire l’état des lieux d’entrée'}</a>`. `accueilView` passe `userBookings(user.id, date)` à `accueilHtml` sous la clé `salle`. Test (`tests/mobile-views.test.mjs`) : `accueilHtml({ …, salle: { active: { booking, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] } })` contient « état des lieux d’entrée » et un lien vers `#/salle`.

`js/admin/app.js` : ajouter également `sweepBookings(now());` dans sa garde (la pédago voit ainsi les créneaux clos).

- [ ] **Step 5 : CSS**

`css/mobile.css`, après `.m-item__photos` :

```css
.week-grid { width: 100%; border-collapse: separate; border-spacing: 2px; table-layout: fixed; }
.week-grid th { font-size: 10px; font-weight: 700; color: var(--text-secondary); padding: var(--space-xs) 0; }
.week-grid th.is-today { color: var(--text-brand); }
.week-grid tbody th { width: 28px; text-align: right; padding-right: var(--space-xs); }
.slot { width: 100%; height: 30px; border-radius: var(--radius-xs); font-size: 9px; font-weight: 700; border: var(--stroke-thin) solid transparent; }
.slot--free { background: var(--bg-surface); border-color: var(--border-default); }
.slot--free:hover { border-color: var(--border-brand); }
.slot--selected { background: var(--brand-primary); color: var(--text-on-brand); }
.slot--taken { background: var(--status-borrowed-bg); color: var(--status-borrowed-fg); }
.slot--mine { background: var(--status-reserved-bg); color: var(--status-reserved-fg); }
.slot--past { background: var(--bg-muted); }
.selection-bar { position: sticky; bottom: 88px; background: var(--bg-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-sm); }
.selection-bar__resume { min-height: 21px; }
```

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/mobile-salle.test.mjs tests/mobile-views.test.mjs`
Expected: 0 échec.

- [ ] **Step 7 : Vérifier dans le navigateur**

Mobile 390 px, horloge de démo un jour ouvré : onglet Salle → grille de la semaine, les créneaux passés grisés, ceux du seed marqués « Pris » ; toucher 13h puis 14h le lendemain → la barre affiche « 13h-15h · 2 créneaux » et le bouton s'active ; réserver → toast et la réservation apparaît sous « Mes réservations » ; toucher un créneau non contigu → message « Les créneaux doivent se suivre sans interruption ». Avec l'horloge pendant un créneau : « Faire l'état des lieux d'entrée » → 6 lignes → une en Problème avec commentaire → validation → toast « problème signalé ».

- [ ] **Step 8 : Commit**

```bash
git add js/mobile/views/salle.js js/mobile/views/accueil.js js/mobile/app.js js/admin/app.js css/mobile.css tests/mobile-salle.test.mjs tests/mobile-views.test.mjs
git commit -m "feat(mobile): réservation de la salle photo par créneaux et états des lieux"
```

---

### Task 5 : Admin — planning de la salle et sorties non faites

**Files:**
- Create: `js/admin/views/salle.js`
- Modify: `js/admin/app.js` (route `/salle`), `js/admin/views/dashboard.js` (widget « Sorties non faites »), `css/admin.css`
- Test: `tests/admin-salle.test.mjs`, `tests/admin-dashboard.test.mjs`

**Interfaces:**
- Consumes : `buildWeekGrid`, `startOfWeek`, `weekDays` ; `weekBookings`, `cancelBooking`, `sweepBookings`, `roomItems` ; `isExitMissing`, `now`, `addDays`, `ymd` ; `setTopbar`, `openModal`, `toast`, `badge`, `avatar`, `fullName`, `formatDate`, `formatSlots`, `formatDateTime`.
- Produces : `planningHtml({ grid, users, date })`, `exitMissingRows(bookings, users, date)`, `bookingDetailHtml({ booking, user })`, `salleHtml({ grid, users, missing, date })`, `salleView(container)` ; dans `dashboard.js`, `exitMissingHtml(rows)`.

- [ ] **Step 1 : Écrire le test**

`tests/admin-salle.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { buildWeekGrid } from '../js/weekGrid.js';
import { weekBookings } from '../js/actions/bookings.js';
import { planningHtml, exitMissingRows, bookingDetailHtml, salleHtml } from '../js/admin/views/salle.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

const grid = () => buildWeekGrid({ date: NOW, bookings: weekBookings(NOW), settings: store.settings.get(), userId: null, now: NOW });

test('planningHtml : 5 colonnes, initiales de l’occupant, créneau cliquable', () => {
  const html = planningHtml({ grid: grid(), users: store.users.list(), date: NOW });
  assert.equal((html.match(/<th data-day=/g) || []).length, 5);
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const user = store.users.get(actif.userId);
  assert.match(html, new RegExp(`data-booking="${actif.id}"`));
  assert.match(html, new RegExp(`${user.prenom[0]}${user.nom[0]}`));
  assert.match(html, /slot--taken|slot--booked/);
});

test('exitMissingRows : une réservation dont la sortie manque depuis plus d’une heure', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  assert.deepEqual(exitMissingRows(store.bookings.list(), store.users.list(), NOW), [], 'le créneau est encore en cours');
  const tard = new Date(2026, 8, 17, 13, 0); // fin 11h + 1h dépassée
  const rows = exitMissingRows(store.bookings.list(), store.users.list(), tard);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].booking.id, actif.id);
  assert.equal(rows[0].user.id, actif.userId);
});

test('bookingDetailHtml : créneaux, états des lieux, bouton d’annulation', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html = bookingDetailHtml({ booking: actif, user: store.users.get(actif.userId) });
  assert.match(html, /9h-11h/);
  assert.match(html, /État des lieux d’entrée/);
  assert.match(html, /pas encore faite/);
  assert.match(html, /data-action="cancel-booking"/);
  const terminee = store.bookings.list((b) => b.statut === 'terminee')[0];
  const html2 = bookingDetailHtml({ booking: terminee, user: store.users.get(terminee.userId) });
  assert.doesNotMatch(html2, /data-action="cancel-booking"/);
});

test('salleHtml : navigation de semaine, planning et bandeau des sorties manquantes', () => {
  const tard = new Date(2026, 8, 17, 13, 0);
  const missing = exitMissingRows(store.bookings.list(), store.users.list(), tard);
  const html = salleHtml({ grid: grid(), users: store.users.list(), missing, date: NOW });
  assert.match(html, /data-action="prev-week"/);
  assert.match(html, /data-action="next-week"/);
  assert.match(html, /Sorties non faites/);
  assert.match(html, /alert--warning/);
  const sans = salleHtml({ grid: grid(), users: store.users.list(), missing: [], date: NOW });
  assert.doesNotMatch(sans, /Sorties non faites/);
});
```

Ajouter à `tests/admin-dashboard.test.mjs` :

```js
test('dashboardHtml : widget des sorties non faites', () => {
  const tard = new Date(2026, 8, 17, 13, 0);
  const actif = db.bookings.find((b) => b.statut === 'en_cours');
  const missing = [{ booking: actif, user: db.users.find((u) => u.id === actif.userId) }];
  const html = dashboardHtml({
    kpis: computeKpis(db, tard), late: [], due: [], reports: [], activity: [], users: db.users, date: tard,
    horlogeDemo: null, status: officeStatus(tard, db.settings), exitMissing: missing,
  });
  assert.match(html, /Sorties non faites/);
  assert.match(html, /href="#\/salle"/);
  const sans = dashboardHtml({
    kpis: computeKpis(db, NOW), late: [], due: [], reports: [], activity: [], users: db.users, date: NOW,
    horlogeDemo: null, status: officeStatus(NOW, db.settings), exitMissing: [],
  });
  assert.doesNotMatch(sans, /Sorties non faites/);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/admin-salle.test.mjs tests/admin-dashboard.test.mjs`
Expected: FAIL — module introuvable et `exitMissing` inconnu.

- [ ] **Step 3 : Écrire `js/admin/views/salle.js`**

```js
// js/admin/views/salle.js — planning hebdomadaire de la salle photo pour la pédagogie.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, addDays, isExitMissing } from '../../rules.js';
import { BOOKING_STATES } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, formatDate, formatDateTime, formatSlots, openModal, toast } from '../../ui.js';
import { buildWeekGrid, startOfWeek, weekDays } from '../../weekGrid.js';
import { weekBookings, cancelBooking, sweepBookings } from '../../actions/bookings.js';
import { setTopbar } from '../layout.js';

const initials = (user) => (user ? `${(user.prenom || '')[0] || ''}${(user.nom || '')[0] || ''}`.toUpperCase() : '?');

export function planningHtml({ grid, users, date }) {
  const entetes = grid.days.map((d) => `<th data-day="${escapeHtml(d.ymd)}"${d.isToday ? ' class="is-today"' : ''}>${escapeHtml(d.label)}</th>`).join('');
  const lignes = grid.hours.map((heure) => {
    const cases = grid.days.map((d) => {
      const cell = grid.cells[d.ymd][heure];
      if (!cell.booking) return `<td><div class="slot ${cell.past ? 'slot--past' : 'slot--free'}"></div></td>`;
      const user = users.find((u) => u.id === cell.booking.userId) || null;
      return `<td><button type="button" class="slot slot--taken" data-booking="${escapeHtml(cell.booking.id)}" title="${escapeHtml(user ? fullName(user) : '')}">${escapeHtml(initials(user))}</button></td>`;
    }).join('');
    return `<tr><th>${heure}h</th>${cases}</tr>`;
  }).join('');
  return `<table class="week-grid week-grid--admin"><thead><tr><th></th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}

export function exitMissingRows(bookings, users, date) {
  return bookings
    .filter((b) => b.statut === BOOKING_STATES.EN_COURS && isExitMissing(b, date))
    .map((booking) => ({ booking, user: users.find((u) => u.id === booking.userId) || null }))
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date));
}

function etatBloc(titre, etat) {
  if (!etat) return `<p class="body-sm text-secondary">${escapeHtml(titre)} : pas encore faite.</p>`;
  const problemes = etat.lignes.filter((l) => !l.ok);
  return `
    <div class="stack">
      <p class="body-sm"><strong>${escapeHtml(titre)}</strong> · ${escapeHtml(formatDateTime(etat.date))}</p>
      ${problemes.length
        ? `<div class="alert alert--warning">${problemes.map((l) => `${escapeHtml(l.ligne)}${l.commentaire ? ` → ${escapeHtml(l.commentaire)}` : ''}`).join('<br>')}</div>`
        : '<p class="body-tiny text-secondary">Tout était conforme.</p>'}
    </div>`;
}

export function bookingDetailHtml({ booking, user }) {
  const annulable = booking.statut === BOOKING_STATES.A_VENIR || booking.statut === BOOKING_STATES.EN_COURS;
  return `
    <div class="stack">
      <p class="body-sm">${user ? `<span class="row">${avatar(user)}${escapeHtml(fullName(user))}</span>` : '—'}</p>
      <p class="body-sm">${escapeHtml(formatDate(booking.date))} · <strong>${escapeHtml(formatSlots(booking.creneaux))}</strong> ${badge('booking', booking.statut)}</p>
      ${etatBloc('État des lieux d’entrée', booking.etatEntree)}
      ${etatBloc('État des lieux de sortie', booking.etatSortie)}
      ${annulable ? `<button type="button" class="btn btn--danger btn--sm" data-action="cancel-booking" data-booking="${escapeHtml(booking.id)}">Annuler la réservation</button>` : ''}
    </div>`;
}

const weekLabel = (date) => {
  const jours = weekDays(date);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(jours[0].date)} – ${fmt.format(jours[4].date)}`;
};

export function salleHtml({ grid, users, missing, date }) {
  const bandeau = missing.length
    ? `<div class="card"><div class="card__header"><h2 class="card__title">Sorties non faites</h2><span class="body-sm text-secondary">${missing.length}</span></div>
        ${missing.map(({ booking, user }) => `<div class="alert alert--warning">${escapeHtml(formatDate(booking.date))} · ${escapeHtml(formatSlots(booking.creneaux))} — ${escapeHtml(user ? fullName(user) : booking.userId)} n’a pas fait l’état des lieux de sortie.</div>`).join('')}
      </div>`
    : '';
  return `
    ${bandeau}
    <div class="card">
      <div class="card__header">
        <button type="button" class="btn btn--ghost btn--sm" data-action="prev-week">← Semaine précédente</button>
        <h2 class="card__title">${escapeHtml(weekLabel(date))}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="next-week">Semaine suivante →</button>
      </div>
      ${planningHtml({ grid, users, date })}
      <p class="body-tiny text-secondary">Cliquez sur un créneau occupé pour voir le détail et les états des lieux.</p>
    </div>`;
}

export function salleView(container) {
  let semaine = now();
  const render = () => {
    sweepBookings(now());
    const date = now();
    const users = store.users.list();
    const grid = buildWeekGrid({ date: semaine, bookings: weekBookings(semaine), settings: store.settings.get(), userId: null, now: date });
    const missing = exitMissingRows(store.bookings.list(), users, date);
    setTopbar({ title: 'Salle photo', subtitle: 'Planning et états des lieux' });
    container.innerHTML = salleHtml({ grid, users, missing, date: semaine });
    container.querySelector('[data-action="prev-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), -7); render(); });
    container.querySelector('[data-action="next-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), 7); render(); });
    container.querySelectorAll('[data-booking]').forEach((b) => b.addEventListener('click', () => {
      const booking = store.bookings.get(b.dataset.booking);
      const user = users.find((u) => u.id === booking.userId) || null;
      openModal({
        title: `Créneau du ${formatDate(booking.date)}`,
        body: bookingDetailHtml({ booking, user }),
        actions: [{ label: 'Fermer', variant: 'ghost' }],
      });
      const root = document.getElementById('modal-root');
      const annuler = root.querySelector('[data-action="cancel-booking"]');
      if (annuler) annuler.addEventListener('click', () => {
        try { cancelBooking(annuler.dataset.booking, auth.currentUserId()); toast('Réservation annulée', 'success'); }
        catch (e) { toast(e.message, 'error'); }
      });
    }));
  };
  render();
  return store.subscribe(render);
}
```

- [ ] **Step 4 : Route, dashboard et CSS**

`js/admin/app.js` : `import { salleView } from './views/salle.js';` et route `{ path: '/salle', view: guard(salleView) }`.

`js/admin/views/dashboard.js` : ajouter

```js
function exitMissingHtml(rows) {
  if (!rows.length) return '';
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Sorties non faites</h2><a class="body-sm" href="#/salle">Voir le planning →</a></div>
      ${rows.map(({ booking, user }) => `<div class="alert alert--warning">${escapeHtml(formatDate(booking.date))} · ${escapeHtml(formatSlots(booking.creneaux))} — ${escapeHtml(user ? fullName(user) : booking.userId)}</div>`).join('')}
    </div>`;
}
```

(importer `formatSlots`), l'insérer dans `dashboardHtml({ …, exitMissing = [] })` juste après la carte « Signalements ouverts », et dans `dashboardView` calculer `exitMissing: exitMissingRows(store.bookings.list(), data.users, date)` en important `exitMissingRows` depuis `./salle.js`.

`css/admin.css` :

```css
.week-grid { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
.week-grid th { font-size: 11px; font-weight: 700; color: var(--text-secondary); padding: var(--space-xs) 0; }
.week-grid th.is-today { color: var(--text-brand); }
.week-grid tbody th { width: 40px; text-align: right; padding-right: var(--space-sm); }
.week-grid .slot { width: 100%; height: 34px; border-radius: var(--radius-xs); font-size: 11px; font-weight: 700; border: var(--stroke-thin) solid transparent; display: grid; place-items: center; }
.week-grid .slot--free { background: var(--bg-surface); border-color: var(--border-default); }
.week-grid .slot--past { background: var(--bg-muted); }
.week-grid .slot--taken { background: var(--status-borrowed-bg); color: var(--status-borrowed-fg); cursor: pointer; }
.week-grid .slot--taken:hover { background: var(--brand-primary); color: var(--text-on-brand); }
```

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/admin-salle.test.mjs tests/admin-dashboard.test.mjs`
Expected: 0 échec.

- [ ] **Step 6 : Vérifier dans le navigateur**

Admin → Salle photo : planning de la semaine avec les initiales des occupants, navigation de semaine, clic sur un créneau → modale avec les états des lieux et le bouton d'annulation. Avancer l'horloge d'une heure après la fin d'un créneau dont la sortie manque → bandeau « Sorties non faites » en haut du planning **et** sur le tableau de bord.

- [ ] **Step 7 : Commit**

```bash
git add js/admin/views/salle.js js/admin/views/dashboard.js js/admin/app.js css/admin.css tests/admin-salle.test.mjs tests/admin-dashboard.test.mjs
git commit -m "feat(admin): planning de la salle photo, détail des créneaux et sorties non faites"
```

---

### Task 6 : Vérification de fin de phase

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

- [ ] **Step 1 : Suite complète et greps**

Run: `npm test` → 0 échec (250 + ~35 nouveaux tests).
Run: `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` → rien ; `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/admin.css css/mobile.css` → rien.
Run: `TZ=America/New_York npm test` → 0 échec (le correctif de `toDate` doit tenir dans un fuseau négatif).

- [ ] **Step 2 : Scénario de vérification de phase (contrôleur, navigateur, deux fenêtres)**

Horloge de démo sur un jour ouvré 8h30, données régénérées.
1. Mobile (Yann) : onglet Salle → réserver 10h-12h → la réservation apparaît sous « Mes réservations » ; admin → Salle photo : le créneau affiche « YG ».
2. Un second compte mobile tente 11h → « Un de ces créneaux est déjà réservé. »
3. Horloge → 10h05. Mobile : accueil propose « Faire l'état des lieux d'entrée » → 6 lignes → tout OK → le créneau passe en cours ; admin : la modale du créneau montre l'entrée horodatée.
4. Horloge → 11h50 : « Faire l'état des lieux de sortie » → signaler « Trépied LeoFoto » en problème → toast « problème signalé » ; admin : l'objet est en maintenance, le signalement est sur le tableau de bord, la modale du créneau montre les deux états des lieux.
5. Sortie manquante : réserver 14h-15h avec un autre compte, faire l'entrée, ne pas faire la sortie, horloge → 16h05 → bandeau « Sorties non faites » sur le planning et sur le tableau de bord.
6. Annulation : réserver un créneau à venir puis l'annuler depuis le mobile → le créneau redevient libre dans les deux interfaces.

- [ ] **Step 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 4 — Salle photo`. Roadmap : ligne Phase 4 → `` `2026-10-04-phase-4-salle-photo.md` (exécuté) ``.

- [ ] **Step 4 : Commit et étiquette**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 4 terminée"
git tag phase-4
```

- [ ] **Step 5 : Rédiger le plan de la phase 5** (`superpowers:writing-plans`, roadmap Phase 5, spec §5.4 et §6). Y reporter les éléments déjà programmés pour la phase 5 : extraction d'un `openScanModal({ title, hint, onCode })` réutilisable, pré-remplissage de la remise depuis la ligne d'emprunt, recherche admin par code de retrait, jeton d'identité des modales, `openHours` robuste aux `horaires` nuls ou fractionnaires, libellé `hors_ouverture` dérivé des réglages, CSS des zones sûres pour la PWA, surfaçage de `store.usage()`.

---

## Auto-revue du plan

**Couverture du spec** — §3.2 : le matériel `salle` reste dans la salle, jamais emprunté individuellement ; `roomItems()` le liste pour les états des lieux ✔. §5.3 : réservation libre sans validation ✔ ; créneaux d'1h, 8h-17h, lundi-vendredi, contigus et multiples ✔ (`selectionIsValid`) ; un créneau réservé est bloqué pour les autres ✔ (`slotsConflict`) ; la réservation vaut responsabilité du contenu ✔ (états des lieux) ; état des lieux d'entrée proposé dès le début du créneau, problème → signalement sans que l'emprunteur soit tenu responsable ✔ (texte de l'écran + signalement horodaté à l'entrée) ; état des lieux de sortie → `terminee` ✔ ; absence de sortie 1h après la fin → « sortie non faite » côté admin ✔ (`isExitMissing`, bandeau planning + tableau de bord) ; annulation par l'emprunteur avant le début et par la pédago à tout moment ✔ (`cancelBooking` accepte `a_venir` et `en_cours`, appelée par les deux interfaces). §5.5 : tout passe par `now()` ; les balayages sont appelés au rendu et dans les gardes, idempotents ✔. §6 `#/salle` : planning semaine lun-ven × 8h-17h, navigation, réservations colorées avec nom, clic → détail avec états des lieux et badge « sortie non faite », annulation ✔. §7 écran Salle mobile : grille semaine, sélection de créneaux contigus, mes réservations, états des lieux ✔. §8 : `buildRoomChecklist` fournit les lignes salle plus la ligne globale ✔.

**Prérequis traités** : `ui.toDate` en heure locale (Task 1, avec un test `TZ=America/New_York` en fin de phase) ✔ ; `store.transaction` à notification unique (Task 1) ✔.

**Hors périmètre, conformément à la feuille de route** : maintenance et paramètres (phase 5), déploiement (phase 6), et les sept éléments déjà programmés pour la phase 5 rappelés en Task 6 Step 5.

**Placeholders** : aucun ; chaque étape porte son code ou l'édition exacte.

**Cohérence des noms** : `startOfWeek/weekDays/roomHours/buildWeekGrid/toggleSlot/selectionIsValid` (T2) ↔ T3 (`selectionIsValid`, `startOfWeek`, `weekDays`), T4 et T5 (grille) ✔ ; `createBooking/cancelBooking/recordEntry/recordExit/closeDueBookings/sweepBookings/roomChecklist/userBookings/weekBookings` (T3) ↔ T4 et T5 ✔ ; `REASONS.CRENEAU_VIDE/CRENEAUX_NON_CONTIGUS/CRENEAU_OCCUPE/CRENEAU_PASSE/SALLE_FERMEE` (T2) ↔ messages affichés via `REASON_LABELS` (T4) ✔ ; `exitMissingRows` (T5) ↔ `dashboard.js` (T5 Step 4) ✔ ; `.week-grid`/`.slot--*` définis deux fois (mobile et admin) avec des tailles différentes, chacun dans sa feuille — c'est voulu, les deux pages ne chargent pas la même CSS ✔.
