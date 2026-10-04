# MDS Emprunts — Phase 3 : Matériel de valeur — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le circuit du matériel de valeur de bout en bout — l'emprunteur réserve un exemplaire depuis le mobile, affiche son QR de retrait à l'heure prévue, la pédago le scanne pour remettre l'objet, puis le réceptionne avec la checklist complète ; les réservations non retirées expirent, les retards sont visibles partout.

**Architecture :** les mutations s'ajoutent à `js/actions/loans.js` (réservation, remise, réception, refus, prolongation, expiration), toutes dans `store.transaction` et avec `applyItemState` pour l'état de l'objet. Les règles temporelles existent déjà dans `js/rules.js` (`pickupWindow`, `isInPickupWindow`, `isExpired`, `canReserveValeur`) : la phase les consomme sans les réécrire. Côté admin, un écran Emprunts (table à onglets, réutilisant `js/admin/table.js`) et une modale de remise par scan ou code court ; côté mobile, un écran de réservation et l'affichage du QR de retrait dans « Mes emprunts ». Le scanner de `js/scanner.js` est réutilisé tel quel par l'admin.

**Tech Stack :** HTML5, CSS3 (tokens Figma), JavaScript ES2022 modules natifs, `localStorage`, `vendor/qrcode.min.js` (affichage), `vendor/html5-qrcode.min.js` (lecture), Node ≥ 22 (`node --test`), `python3 -m http.server`.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §3.3 (matériel de valeur), §3.4 (un exemplaire par référence), §5.2 (règles valeur), §5.5 (temps), §6 (`#/emprunts` admin), §7 (réserver, QR de retrait, notifications), §8 (checklists valeur).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md` (Phase 3). **Journaux** : `docs/superpowers/ledgers/2026-09-17-phase-0-ledger.md`, `2026-09-18-phase-1-ledger.md`, `2026-09-20-phase-2-ledger.md`.

## Global Constraints

- Aucun build, aucune dépendance npm ; bibliothèques tierces déjà présentes dans `vendor/` (aucune nouvelle).
- Interface 100 % en français ; libellés d'états via `LABELS`/`badge` ; motifs de refus via `REASONS`/`REASON_LABELS`.
- Chaînes : délimiteurs simples, apostrophe typographique `’` (U+2019) dans le texte français (code, commentaires, HTML) — jamais `'` ni `\'` dans un mot français. Vérification : `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` ne renvoie rien.
- Aucune couleur en dur hors `css/tokens.css`.
- **Toute action à écritures multiples passe par `store.transaction(fn)`** et écrit l'enregistrement le plus lourd (photo) en premier ; l'état de l'objet via `applyItemState` (sans journal) ; **une** entrée de journal par mutation métier (deux quand un signalement est créé).
- Règles temporelles via `rules.now()` (horloge de démo, réglable depuis le tableau de bord admin) ; `relativeDay(d, ref)` exige `ref` ; `ui.js` ne lit jamais le store.
- Les enregistrements du store sont gelés : toujours `store.x.update(id, patch)`.
- Vues : `xxxHtml(data)` pur (testé sous Node) + `xxxView(container, params)` DOM qui renvoie son nettoyage ; toute donnée dynamique échappée via `escapeHtml` (sauf fragments déjà échappés : `badge`, `avatar`, `renderTable`) ; les filtres re-rendent uniquement `[data-role="results"]`.
- Codes : objets `MDS-0042` (`isItemCode`), retraits `LOAN-<loanId>-<code6>` (`loanQrPayload`, `parseLoanCode`).
- Commits fréquents, messages en français, préfixes `feat:`, `fix:`, `test:`, `docs:`.

---

## Structure de fichiers de la phase

| Fichier | Responsabilité |
|---|---|
| `js/mobile/views/scan.js` (modif) | Correctifs reportés de la revue de phase 2 (F-R1 à F-R3) |
| `js/scanner.js` (modif) | `startScanner` arrête une instance encore active |
| `js/rules.js` (modif) | + `REASONS.FENETRE_RETRAIT`, `DEJA_RESERVE` et libellés |
| `js/actions/loans.js` (modif) | + `reserveValeur`, `handOver`, `receiveLoan`, `refuseLoan`, `cancelLoan`, `extendLoan`, `expireDueLoans`, `pendingHandovers` ; `userLoans.reservations` enrichi |
| `js/mobile/views/reserver.js` | Formulaire de réservation (dates, motif), règles affichées |
| `js/mobile/views/emprunts.js` (modif) | QR de retrait + compte à rebours sur une réservation ; notifications d'expiration |
| `js/mobile/views/fiche.js` (modif) | CTA « Réserver » désactivé quand l'utilisateur a déjà une réservation de cette référence |
| `js/admin/views/emprunts.js` | Écran admin : onglets En cours / Réservés / En retard / Historique, actions |
| `js/admin/handoverModal.js` | Modale de remise : scan QR ou saisie du code court |
| `js/admin/views/dashboard.js` (modif) | Widget « À remettre aujourd'hui » : bouton *Remettre* actif |
| `js/mobile/app.js`, `js/admin/app.js` (modif) | Routes `/reserver/:id` et `/emprunts` |
| `css/admin.css`, `css/mobile.css` (modif) | Modale de remise, QR mobile, compte à rebours |
| `tests/actions-loans-valeur.test.mjs`, `tests/admin-emprunts.test.mjs`, `tests/mobile-reserver.test.mjs`, `tests/mobile-emprunts.test.mjs` (modif), `tests/scanner.test.mjs` (modif) | Tests Node |

Signatures existantes réutilisées : `store.transaction(fn)`, `store.<coll>.*`, `store.subscribe` ; `now`, `isLate`, `pickupWindow(loan, minutes)`, `isInPickupWindow(loan, date, minutes)`, `isExpired(loan, date, minutes)`, `canReserveValeur({ item, user, loans, items, settings, debutPrevu, finPrevue, date })`, `withDefaults`, `sortByDateDesc`, `addDays`, `ymd`, `fromYmd`, `REASONS`, `REASON_LABELS` ; `applyItemState(id, etat)` ; `buildChecklist(reference)`, `hasProblem`, `problemLines` ; `loanQrPayload(loan)`, `parseLoanCode(text)`, `renderQr(container, text, size)` ; `startScanner(elementId, onCode)`, `stopScanner()` ; `logAction`, `ACTIONS` (dont `LOAN_RESERVEE`, `LOAN_REMISE`, `LOAN_RETOUR`, `LOAN_REFUSEE`, `LOAN_EXPIREE`, `LOAN_ANNULEE`, `LOAN_PROLONGEE`) ; `renderTable`/`sortRows`/`toggleSort`/`bindTable` ; `setTopbar`, `setHeader` ; `openModal`, `toast`, `badge`, `avatar`, `formatDate`, `formatTime`, `formatDateTime`, `relativeDay`, `formatSlots`, `fullName`, `escapeHtml`.

---

### Task 1 : Correctifs reportés de la revue de phase 2

**Files:**
- Modify: `js/mobile/views/scan.js`, `js/scanner.js`
- Test: `tests/mobile-scan-view.test.mjs`, `tests/scanner.test.mjs`

**Interfaces:**
- Produces : `errorHtml` sans bouton trompeur sur `rendu_a_la_pedago` ; `bindPhoto` silencieux sur une caméra annulée ; `startScanner` qui arrête l'instance précédente.

- [ ] **Step 1 : Écrire les tests**

Ajouter à `tests/mobile-scan-view.test.mjs` :

```js
test('errorHtml : pas de bouton « Réserver » quand l’objet est déjà entre les mains de l’emprunteur', () => {
  const valeur = { ...item, circuit: 'valeur', reference: 'canon-r10', nom: 'Canon R10' };
  const refus = errorHtml({ reason: 'rendu_a_la_pedago', error: null, item: valeur });
  assert.match(refus, /se rend directement à la pédago/);
  assert.doesNotMatch(refus, /href="#\/catalogue\/canon-r10"/);
  assert.match(refus, /data-action="restart"/);
  // Un refus « mauvais circuit » (objet qu’il ne détient pas) garde l’aide vers le catalogue.
  const autre = errorHtml({ reason: 'mauvais_circuit', error: null, item: valeur });
  assert.match(autre, /href="#\/catalogue\/canon-r10"/);
});
```

Ajouter à `tests/scanner.test.mjs` (le fichier installe déjà une fausse `window.Html5Qrcode` et importe `js/scanner.js` dynamiquement) :

```js
test('startScanner arrête une instance encore active avant d’en créer une autre', async () => {
  const { startScanner, stopScanner } = await import('../js/scanner.js');
  reset(); // remet à zéro les compteurs de la fausse bibliothèque
  await startScanner('a', () => {});
  await startScanner('b', () => {});
  assert.equal(stops, 1, 'la première instance a été arrêtée');
  assert.equal(instances.length, 2);
  await stopScanner();
  assert.equal(stops, 2);
});
```

(adapter les noms `reset`, `stops`, `instances` à ceux déjà en place dans le fichier ; s'ils n'existent pas sous cette forme, lire le fichier et réutiliser ses propres compteurs.)

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test tests/mobile-scan-view.test.mjs tests/scanner.test.mjs`
Expected: FAIL sur les deux nouveaux tests.

- [ ] **Step 3 : Corriger `js/mobile/views/scan.js`**

Dans `errorHtml`, n'afficher l'aide « Réserver depuis le catalogue » que si l'utilisateur ne détient pas l'objet :

```js
  // L’aide ne vaut que pour un objet que l’emprunteur ne détient pas : sur un refus
  // « rendu à la pédago », il l’a déjà entre les mains.
  if (reason !== REASONS.RENDU_A_LA_PEDAGO) {
    if (item && item.circuit === CIRCUITS.VALEUR) hint = `<a class="btn btn--secondary btn--block" href="#/catalogue/${escapeHtml(item.reference)}">Réserver depuis le catalogue</a>`;
    if (item && item.circuit === CIRCUITS.SALLE) hint = '<a class="btn btn--secondary btn--block" href="#/salle">Réserver la salle photo</a>';
  }
```

(importer `REASONS` depuis `../../rules.js` s'il ne l'est pas déjà.)

Dans `bindPhoto`, ignorer l'annulation volontaire de la caméra et protéger le `.video-box` :

```js
    } catch (e) {
      // startCamera lève « Caméra annulée. » quand l’utilisateur a quitté l’étape entre-temps :
      // ce n’est pas une panne, il n’y a rien à signaler.
      if (!alive || (e && e.message === 'Caméra annulée.')) return;
      capture.disabled = true;
      const box = container.querySelector('.video-box');
      if (box) box.hidden = true;
      toast('Caméra indisponible : utilisez l’image de démonstration.', 'warning');
    }
```

- [ ] **Step 4 : Corriger `js/scanner.js`**

Dans la chaîne de `startScanner`, arrêter l'instance encore référencée avant d'en créer une nouvelle — juste après `if (gen !== scannerGen) return;` :

```js
    // Une instance encore active (appelant qui n’a pas arrêté le lecteur) doit être relâchée,
    // sinon la caméra reste allumée.
    if (scanner) {
      const prev = scanner;
      scanner = null;
      try { await prev.stop(); } catch { /* déjà arrêté */ }
      try { prev.clear(); } catch { /* conteneur retiré */ }
    }
```

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/mobile-scan-view.test.mjs tests/scanner.test.mjs`
Expected: 0 échec.

- [ ] **Step 6 : Commit**

```bash
git add js/mobile/views/scan.js js/scanner.js tests/mobile-scan-view.test.mjs tests/scanner.test.mjs
git commit -m "fix(mobile): aide de refus pertinente, caméra annulée silencieuse, lecteur relâché"
```

---

### Task 2 : Actions du matériel de valeur

**Files:**
- Modify: `js/rules.js` (2 motifs), `js/actions/loans.js`
- Test: `tests/actions-loans-valeur.test.mjs`

**Interfaces:**
- Consumes : `canReserveValeur`, `pickupWindow`, `isInPickupWindow`, `isExpired`, `withDefaults`, `applyItemState`, `store.transaction`, `buildChecklist`, `parseLoanCode`, `logAction`.
- Produces :
  - `REASONS.FENETRE_RETRAIT` / `DEJA_RESERVE` + libellés ;
  - `code6()` → 6 caractères `A-Z2-9` sans ambiguïté ;
  - `reserveValeur({ itemId, userId, debutPrevu, finPrevue, motif }) → Loan` (lève `Error` avec `.reason`) ;
  - `handOver({ code, pedagoId, date? }) → Loan` (accepte `LOAN-…` ou le code court seul) ;
  - `receiveLoan({ loanId, pedagoId, checklist, commentaire? }) → { loan, maintenance }` (accepte aussi un emprunt self, cf. ruling phase 2) ;
  - `refuseLoan(loanId, pedagoId, motifRefus) → Loan` ;
  - `cancelLoan(loanId, userId) → Loan` (annulation par l'emprunteur) ;
  - `extendLoan(loanId, finPrevue, pedagoId) → Loan` ;
  - `expireDueLoans(date = now()) → number` (idempotent) ;
  - `pendingHandovers(date = now()) → [{ loan, item, user, window, open }]` ;
  - `userLoans(...).reservations` enrichi : `{ loan, item, pickupOpen, expired, window }`.

- [ ] **Step 1 : Ajouter les deux motifs dans `js/rules.js`**

Dans `REASONS`, après `CODE_INCONNU` : `FENETRE_RETRAIT: 'fenetre_retrait',` et `DEJA_RESERVE: 'deja_reserve',`.
Dans `REASON_LABELS` : `fenetre_retrait: 'Hors de la fenêtre de retrait : le matériel se retire dans l’heure qui suit le début de la réservation.',` et `deja_reserve: 'Vous avez déjà une réservation en cours pour ce matériel.',`.

- [ ] **Step 2 : Écrire le test**

`tests/actions-loans-valeur.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS, now, addDays } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES } from '../js/models.js';
import { buildChecklist } from '../js/checklists.js';
import { loanQrPayload } from '../js/qr.js';
import {
  reserveValeur, handOver, receiveLoan, refuseLoan, cancelLoan, extendLoan,
  expireDueLoans, pendingHandovers, userLoans,
} from '../js/actions/loans.js';

const NOW = new Date(2026, 8, 17, 10, 0);   // jeudi 10h
const DEMAIN9 = new Date(2026, 8, 18, 9, 0); // vendredi 9h
const PEDAGO = 'user_041';
const ELEVE = 'user_010';
const PHOTO = 'data:image/jpeg;base64,AAAA';

const clock = (d) => store.settings.update({ horlogeDemo: d.toISOString() });
const freeValeur = (ref) => store.items.list((i) => i.reference === ref && i.etat === ITEM_STATES.DISPONIBLE)[0];

// Le seed contient déjà deux réservations (dont une le lendemain à 9h) : on les retire pour que
// les comptages de ces tests ne portent que sur les réservations qu’ils créent eux-mêmes.
const clearSeedReservations = () => {
  for (const l of store.loans.list((x) => x.statut === LOAN_STATES.RESERVEE)) {
    store.loans.update(l.id, { statut: LOAN_STATES.ANNULEE });
    store.items.update(l.itemId, { etat: ITEM_STATES.DISPONIBLE });
  }
};

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  clock(NOW);
  clearSeedReservations();
});

test('reserveValeur : objet réservé, code de retrait, journal', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 2), motif: 'Tournage' });
  assert.equal(loan.statut, LOAN_STATES.RESERVEE);
  assert.equal(loan.motif, 'Tournage');
  assert.match(loan.codeRetrait, /^[A-Z2-9]{6}$/);
  assert.equal(loan.debutPrevu, DEMAIN9.toISOString());
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.RESERVE);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.LOAN_RESERVEE);
  assert.equal(entry.loanId, loan.id);
  assert.match(entry.detail, /Hoya|filtre/i);
});

test('reserveValeur : refus — circuit, durée, doublon de référence, indisponible', () => {
  const item = freeValeur('hoya-nd');
  const multi = store.items.list((i) => i.reference === 'multiprise' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  assert.throws(() => reserveValeur({ itemId: multi.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.MAUVAIS_CIRCUIT);
  assert.throws(() => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 9) }), (e) => e.reason === REASONS.DUREE_TROP_LONGUE);
  assert.throws(() => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: addDays(DEMAIN9, -5), finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DATE_PASSEE);
  reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  const sd1 = store.items.list((i) => i.reference === 'sd-256' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  const sd2 = store.items.list((i) => i.reference === 'sd-256' && i.etat === ITEM_STATES.DISPONIBLE)[1];
  reserveValeur({ itemId: sd1.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  assert.throws(() => reserveValeur({ itemId: sd2.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DEJA_RESERVE);
  assert.throws(() => reserveValeur({ itemId: sd1.id, userId: 'user_011', debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.RESERVE_PAR_AUTRE);
});

test('handOver : seulement dans la fenêtre de retrait, par code court ou QR', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), (e) => e.reason === REASONS.FENETRE_RETRAIT);
  clock(new Date(2026, 8, 18, 9, 30));
  const remis = handOver({ code: loanQrPayload(loan), pedagoId: PEDAGO });
  assert.equal(remis.statut, LOAN_STATES.EN_COURS);
  assert.equal(remis.remisPar, PEDAGO);
  assert.equal(new Date(remis.dateRetrait).getHours(), 9);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.EMPRUNTE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_REMISE);
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), /plus en attente de remise/);
  assert.throws(() => handOver({ code: 'ZZZZZZ', pedagoId: PEDAGO }), (e) => e.reason === REASONS.CODE_INCONNU);
});

test('expireDueLoans : libère après la fenêtre, idempotent, n’touche pas les autres', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 59));
  assert.equal(expireDueLoans(), 0);
  clock(new Date(2026, 8, 18, 10, 1));
  assert.equal(expireDueLoans(), 1);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EXPIREE);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_EXPIREE);
  assert.equal(expireDueLoans(), 0, 'idempotent');
});

test('pendingHandovers : réservations du jour, fenêtre ouverte ou non', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.equal(pendingHandovers(NOW).length, 0, 'pas aujourd’hui');
  const demainTot = new Date(2026, 8, 18, 8, 0);
  const avant = pendingHandovers(demainTot);
  assert.equal(avant.length, 1);
  assert.equal(avant[0].open, false);
  assert.equal(avant[0].user.id, ELEVE);
  assert.equal(pendingHandovers(new Date(2026, 8, 18, 9, 30))[0].open, true);
});

test('receiveLoan : checklist complète, objet disponible, signalement si problème, emprunt self accepté', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 30));
  handOver({ code: loan.codeRetrait, pedagoId: PEDAGO });
  clock(new Date(2026, 8, 19, 11, 0));
  const ok = receiveLoan({ loanId: loan.id, pedagoId: PEDAGO, checklist: buildChecklist('hoya-nd') });
  assert.equal(ok.maintenance, null);
  assert.equal(ok.loan.statut, LOAN_STATES.RETOURNEE);
  assert.equal(ok.loan.receptionnePar, PEDAGO);
  assert.equal(ok.loan.checklistRetour.length, 3);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_RETOUR);
  // Un emprunt self peut être clôturé par la pédago (élève absent, compte désactivé).
  const self = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && store.items.get(l.itemId).circuit === 'self')[0];
  const r = receiveLoan({ loanId: self.id, pedagoId: PEDAGO, checklist: buildChecklist(store.items.get(self.itemId).reference) });
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
});

test('receiveLoan avec problème : maintenance, signalement, deux entrées de journal', () => {
  const dji = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && store.items.get(l.itemId).reference === 'dji-rsc2')[0];
  const checklist = buildChecklist('dji-rsc2');
  checklist[3].ok = false;
  checklist[3].commentaire = 'batterie gonflée';
  const before = store.log.list().length;
  const r = receiveLoan({ loanId: dji.id, pedagoId: PEDAGO, checklist, commentaire: 'à envoyer au SAV' });
  assert.equal(store.items.get(dji.itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.match(r.maintenance.description, /batterie gonflée/);
  assert.equal(r.loan.commentaire, 'à envoyer au SAV');
  assert.equal(store.log.list().length, before + 2);
});

test('refuseLoan, cancelLoan, extendLoan', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const refus = refuseLoan(loan.id, PEDAGO, 'Matériel réservé pour un cours');
  assert.equal(refus.statut, LOAN_STATES.REFUSEE);
  assert.equal(refus.motifRefus, 'Matériel réservé pour un cours');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_REFUSEE);
  assert.throws(() => refuseLoan(loan.id, PEDAGO, 'x'), /plus en attente/);

  const vide = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.throws(() => refuseLoan(vide.id, PEDAGO, '  '), /motif/);
  assert.equal(store.loans.get(vide.id).statut, LOAN_STATES.RESERVEE, 'le refus sans motif ne change rien');
  refuseLoan(vide.id, PEDAGO, 'Matériel indisponible');

  const l2 = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const annule = cancelLoan(l2.id, ELEVE);
  assert.equal(annule.statut, LOAN_STATES.ANNULEE);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_ANNULEE);

  const enCours = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  const fin = addDays(new Date(enCours.finPrevue), 2);
  const prolonge = extendLoan(enCours.id, fin, PEDAGO);
  assert.equal(prolonge.finPrevue, fin.toISOString());
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_PROLONGEE);
  assert.throws(() => extendLoan(enCours.id, addDays(new Date(enCours.finPrevue), -10), PEDAGO), /postérieure/);
});

test('userLoans.reservations : fenêtre de retrait et expiration dérivées', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const avant = userLoans(ELEVE, NOW).reservations[0];
  assert.equal(avant.loan.id, loan.id);
  assert.equal(avant.pickupOpen, false);
  assert.equal(avant.expired, false);
  assert.equal(avant.window.start.getHours(), 9);
  assert.equal(avant.window.end.getHours(), 10);
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 18, 9, 30)).reservations[0].pickupOpen, true);
  const tard = userLoans(ELEVE, new Date(2026, 8, 18, 10, 30)).reservations[0];
  assert.equal(tard.pickupOpen, false);
  assert.equal(tard.expired, true);
});
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/actions-loans-valeur.test.mjs`
Expected: FAIL — exports manquants dans `js/actions/loans.js`.

- [ ] **Step 4 : Écrire le code dans `js/actions/loans.js`**

Ajouter aux imports : `canReserveValeur, pickupWindow, isInPickupWindow, isExpired` depuis `../rules.js`, `parseLoanCode` depuis `../qr.js`, `addDays` si besoin. Ajouter également `REASONS.DATE_PASSEE` dans `js/rules.js` (`date_passee: 'La date de début est déjà passée.'`) — ce motif est utilisé par `reserveValeur`.

```js
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Code court lisible (sans I, L, O, 0, 1) : l’emprunteur peut le dicter si le QR ne passe pas.
export function code6() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

function requireLoan(id) {
  const loan = store.loans.get(id);
  if (!loan) throw new Error(`Emprunt introuvable (${id})`);
  return loan;
}

export function reserveValeur({ itemId, userId, debutPrevu, finPrevue, motif = '' }) {
  const date = now();
  const item = store.items.get(itemId);
  if (!item) throw refusal(REASONS.CODE_INCONNU);
  const user = store.users.get(userId);
  const debut = new Date(debutPrevu);
  const fin = new Date(finPrevue);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) throw new Error('Dates invalides.');
  if (debut < new Date(date.getFullYear(), date.getMonth(), date.getDate())) throw refusal(REASONS.DATE_PASSEE);
  const loans = store.loans.list();
  // « Un exemplaire par référence » couvre déjà les autres exemplaires, mais le message doit être
  // explicite quand c’est l’emprunteur lui-même qui a déjà réservé cette référence.
  const check = canReserveValeur({ item, user, loans, items: store.items.list(), settings: store.settings.get(), debutPrevu: debut, finPrevue: fin, date });
  if (!check.ok) {
    const sienne = check.reason === REASONS.DEJA_UN_EXEMPLAIRE;
    throw refusal(sienne ? REASONS.DEJA_RESERVE : check.reason);
  }
  return store.transaction(() => {
    const loan = store.loans.create({
      itemId, userId, statut: LOAN_STATES.RESERVEE, motif: String(motif || '').trim(), motifRefus: '', codeRetrait: code6(),
      dateReservation: date.toISOString(), debutPrevu: debut.toISOString(), finPrevue: fin.toISOString(),
      dateRetrait: null, dateRetourReelle: null, remisPar: null, receptionnePar: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
    });
    applyItemState(itemId, ITEM_STATES.RESERVE);
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RESERVEE, itemId, loanId: loan.id, userId, detail: `${item.nom} — ${fullName(user)}` });
    return loan;
  });
}

// La pédago scanne le QR de l’emprunteur (LOAN-…) ou saisit son code court.
export function handOver({ code, pedagoId, date = now() }) {
  const text = String(code || '').trim().toUpperCase();
  const parsed = parseLoanCode(String(code || '').trim());
  // On cherche d’abord une réservation en attente, puis n’importe quel emprunt portant ce code :
  // ainsi un code déjà utilisé donne « plus en attente de remise » et non « code inconnu ».
  const byCode = store.loans.list((l) => l.codeRetrait === text);
  const loan = parsed
    ? store.loans.get(parsed.loanId)
    : (byCode.find((l) => l.statut === LOAN_STATES.RESERVEE) || byCode[0]);
  if (!loan || (parsed && loan.codeRetrait !== parsed.code6)) throw refusal(REASONS.CODE_INCONNU);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus en attente de remise.');
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  if (!isInPickupWindow(loan, date, minutes)) throw refusal(REASONS.FENETRE_RETRAIT);
  const item = store.items.get(loan.itemId);
  const user = store.users.get(loan.userId);
  return store.transaction(() => {
    const updated = store.loans.update(loan.id, { statut: LOAN_STATES.EN_COURS, dateRetrait: date.toISOString(), remisPar: pedagoId });
    applyItemState(item.id, ITEM_STATES.EMPRUNTE);
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_REMISE, itemId: item.id, loanId: loan.id, userId: loan.userId, detail: `${item.nom} remis à ${fullName(user)}` });
    return updated;
  });
}

// Réception par la pédago : checklist complète. Accepte aussi un emprunt self qu’un élève
// n’a pas pu clôturer lui-même (compte désactivé, oubli).
export function receiveLoan({ loanId, pedagoId, checklist = null, commentaire = '' }) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  const item = store.items.get(loan.itemId);
  const date = now();
  const lines = checklist || buildChecklist(item.reference);
  const problem = hasProblem(lines);
  return store.transaction(() => {
    const updated = store.loans.update(loanId, {
      statut: LOAN_STATES.RETOURNEE, dateRetourReelle: date.toISOString(), receptionnePar: pedagoId,
      checklistRetour: lines, commentaire: String(commentaire || '').trim(),
    });
    if (item.etat === ITEM_STATES.EMPRUNTE) applyItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE);
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId: loan.userId, detail: `${item.nom} réceptionné${problem ? ' avec un problème' : ''}` });
    if (!problem) return { loan: updated, maintenance: null };
    const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
    const maintenance = store.maintenance.create({
      itemId: item.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: pedagoId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description: `Signalé à la réception : ${detail}`, prestataire: '', cout: 0, loanId, bookingId: null,
    });
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: item.id, loanId, detail: maintenance.description });
    return { loan: updated, maintenance };
  });
}

function releaseReservation(loan, { statut, action, auteurId, detail, patch = {} }) {
  const item = store.items.get(loan.itemId);
  return store.transaction(() => {
    const updated = store.loans.update(loan.id, { statut, ...patch });
    if (item && item.etat === ITEM_STATES.RESERVE) applyItemState(item.id, ITEM_STATES.DISPONIBLE);
    logAction({ auteurId, action, itemId: loan.itemId, loanId: loan.id, userId: loan.userId, detail });
    return updated;
  });
}

export function refuseLoan(loanId, pedagoId, motifRefus) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus en attente.');
  const motif = String(motifRefus || '').trim();
  if (!motif) throw new Error('Le motif du refus est obligatoire.');
  const item = store.items.get(loan.itemId);
  return releaseReservation(loan, { statut: LOAN_STATES.REFUSEE, action: ACTIONS.LOAN_REFUSEE, auteurId: pedagoId, detail: `${item ? item.nom : loan.itemId} — ${motif}`, patch: { motifRefus: motif } });
}

export function cancelLoan(loanId, userId) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus annulable.');
  if (loan.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  const item = store.items.get(loan.itemId);
  return releaseReservation(loan, { statut: LOAN_STATES.ANNULEE, action: ACTIONS.LOAN_ANNULEE, auteurId: userId, detail: `${item ? item.nom : loan.itemId} — annulée par l’emprunteur` });
}

export function extendLoan(loanId, finPrevue, pedagoId) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  const fin = new Date(finPrevue);
  if (Number.isNaN(fin.getTime())) throw new Error('Date invalide.');
  if (fin <= new Date(loan.finPrevue)) throw new Error('La nouvelle date doit être postérieure à la date de retour actuelle.');
  const item = store.items.get(loan.itemId);
  const updated = store.loans.update(loanId, { finPrevue: fin.toISOString() });
  logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_PROLONGEE, itemId: loan.itemId, loanId, userId: loan.userId, detail: `${item ? item.nom : loan.itemId} jusqu’au ${new Date(fin).toLocaleDateString('fr-FR')}` });
  return updated;
}

// Appelé au rendu des vues : libère les réservations non retirées dans la fenêtre. Idempotent.
export function expireDueLoans(date = now()) {
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  const due = store.loans.list((l) => isExpired(l, date, minutes));
  for (const loan of due) {
    const item = store.items.get(loan.itemId);
    releaseReservation(loan, { statut: LOAN_STATES.EXPIREE, action: ACTIONS.LOAN_EXPIREE, auteurId: loan.userId, detail: `${item ? item.nom : loan.itemId} — non retiré dans l’heure` });
  }
  return due.length;
}

// Réservations à remettre le jour de `date`, avec leur fenêtre de retrait.
export function pendingHandovers(date = now()) {
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  const items = store.items.list();
  const users = store.users.list();
  const jour = ymd(date);
  return store.loans
    .list((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === jour)
    .sort((a, b) => a.debutPrevu.localeCompare(b.debutPrevu))
    .map((loan) => ({
      loan,
      item: items.find((i) => i.id === loan.itemId) || null,
      user: users.find((u) => u.id === loan.userId) || null,
      window: pickupWindow(loan, minutes),
      open: isInPickupWindow(loan, date, minutes),
    }));
}
```

Enrichir `userLoans` : dans la branche `reservations`, remplacer `.map((loan) => ({ loan, item: itemOf(loan) }))` par

```js
      .map((loan) => ({
        loan, item: itemOf(loan),
        window: pickupWindow(loan, minutes),
        pickupOpen: isInPickupWindow(loan, date, minutes),
        expired: isExpired(loan, date, minutes),
      })),
```

avec, en tête de `userLoans` : `const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;`. Importer `ymd` depuis `../rules.js`.

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/actions-loans-valeur.test.mjs tests/actions-loans-self.test.mjs tests/rules.test.mjs`
Expected: 0 échec (les tests self existants ne changent pas).

- [ ] **Step 6 : Commit**

```bash
git add js/rules.js js/actions/loans.js tests/actions-loans-valeur.test.mjs
git commit -m "feat(actions): matériel de valeur — réservation, remise, réception, refus, expiration"
```

---

### Task 3 : Mobile — réserver un exemplaire

**Files:**
- Create: `js/mobile/views/reserver.js`
- Modify: `js/mobile/app.js` (route `/reserver/:id`), `js/mobile/views/fiche.js` (CTA si déjà réservé)
- Test: `tests/mobile-reserver.test.mjs`

**Interfaces:**
- Consumes : `reserveValeur`, `userLoans`, `now`, `addDays`, `ymd`, `withDefaults`, `REASON_LABELS`, `setHeader`, `navigate`, `toast`, `escapeHtml`, `badge`.
- Produces : `defaultDates(date, dureeMax)` → `{ debut, fin }` (chaînes `YYYY-MM-DD`), `reserverHtml({ item, dates, dureeMax, fenetreMinutes })`, `readReserveForm(root)` → `{ debutPrevu, finPrevue, motif }` (Dates locales), `reserverView(container, { id })`.

- [ ] **Step 1 : Écrire le test**

`tests/mobile-reserver.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { defaultDates, reserverHtml } from '../js/mobile/views/reserver.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('defaultDates : demain, même jour par défaut', () => {
  assert.deepEqual(defaultDates(NOW, 5), { debut: '2026-09-18', fin: '2026-09-18' });
});

test('reserverHtml : champs, bornes, rappel de la fenêtre de retrait, règles', () => {
  const item = store.items.list((i) => i.reference === 'canon-r10')[0];
  const html = reserverHtml({ item: { ...item, nom: 'Canon <R10>' }, dates: { debut: '2026-09-18', fin: '2026-09-19' }, dureeMax: 5, fenetreMinutes: 60 });
  assert.match(html, /Canon &lt;R10&gt;/);
  assert.match(html, /name="debut"[^>]*value="2026-09-18"/);
  assert.match(html, /name="fin"[^>]*value="2026-09-19"/);
  assert.match(html, /name="heure"/);
  assert.match(html, /name="motif"/);
  assert.match(html, /dans l’heure/);
  assert.match(html, /5 jours/);
  assert.match(html, /data-action="confirm-reserve"/);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-reserver.test.mjs`
Expected: FAIL — `Cannot find module '../js/mobile/views/reserver.js'`

- [ ] **Step 3 : Écrire `js/mobile/views/reserver.js`**

```js
// js/mobile/views/reserver.js — réservation d’un exemplaire de matériel de valeur.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, addDays, ymd, fromYmd, withDefaults } from '../../rules.js';
import { escapeHtml, badge, formatTime, toast } from '../../ui.js';
import { reserveValeur } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

const HEURES = [8, 9, 10, 11, 13, 14, 15, 16];

export function defaultDates(date, dureeMax) {
  const debut = ymd(addDays(date, 1));
  return { debut, fin: debut };
}

export function reserverHtml({ item, dates, dureeMax, fenetreMinutes }) {
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">${escapeHtml(item.nom)}</h2>${badge('circuit', item.circuit)}</div>
      <p class="body-sm text-secondary">${escapeHtml(item.code)} · ${escapeHtml(item.localisation || '')}</p>
    </div>
    <div class="card">
      <div class="stack">
        <label class="field"><span class="field__label">Date de retrait</span><input class="input" type="date" name="debut" value="${escapeHtml(dates.debut)}" min="${escapeHtml(dates.debut)}"></label>
        <label class="field"><span class="field__label">Heure de retrait</span><select class="select" name="heure">${HEURES.map((h) => `<option value="${h}"${h === 9 ? ' selected' : ''}>${h}h00</option>`).join('')}</select></label>
        <label class="field"><span class="field__label">Date de retour</span><input class="input" type="date" name="fin" value="${escapeHtml(dates.fin)}" min="${escapeHtml(dates.debut)}"></label>
        <label class="field"><span class="field__label">Motif (visible par la pédago)</span><textarea class="textarea" name="motif" placeholder="Tournage du projet MBA 2"></textarea></label>
      </div>
    </div>
    <div class="alert alert--info">Le matériel se retire auprès de la pédago <strong>dans l’heure</strong> qui suit l’heure choisie (${fenetreMinutes} minutes) : passé ce délai, la réservation est annulée et le matériel redevient disponible. Durée maximale : ${dureeMax} jours.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-reserve">Confirmer la réservation</button>
    <a class="btn btn--ghost btn--block" href="#/catalogue/${escapeHtml(item.reference)}">Annuler</a>`;
}

export function readReserveForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  const heure = Number(value('heure'));
  return {
    debutPrevu: fromYmd(value('debut'), heure),
    finPrevue: fromYmd(value('fin'), 17),
    motif: value('motif'),
  };
}

export function reserverView(container, { id }) {
  const item = store.items.get(id);
  const settings = withDefaults(store.settings.get());
  if (!item) {
    setHeader({ title: 'Introuvable', back: '/catalogue' });
    container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
    return undefined;
  }
  setHeader({ title: 'Réserver', back: `/catalogue/${item.reference}` });
  container.innerHTML = reserverHtml({
    item, dates: defaultDates(now(), settings.dureeMaxReservationJours),
    dureeMax: settings.dureeMaxReservationJours, fenetreMinutes: settings.fenetreRetraitMinutes,
  });
  container.querySelector('[data-action="confirm-reserve"]').addEventListener('click', () => {
    try {
      const loan = reserveValeur({ ...readReserveForm(container), itemId: item.id, userId: auth.currentUserId() });
      toast(`Réservé — à retirer le ${new Date(loan.debutPrevu).toLocaleDateString('fr-FR')} à ${formatTime(loan.debutPrevu)}`, 'success');
      navigate('/emprunts');
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  return undefined;
}
```

- [ ] **Step 4 : Route et CTA**

`js/mobile/app.js` : `import { reserverView } from './views/reserver.js';` et remplacer la route `{ path: '/reserver/:id', view: guard(aVenirView('Réserver', 3, '/catalogue')) }` par `{ path: '/reserver/:id', view: guard(reserverView) }`.

`js/mobile/views/fiche.js` : `ficheView` passe désormais `reserved` à `ficheHtml` — la réservation en cours de l'utilisateur pour cette référence :

```js
    const mine = userLoans(auth.currentUserId(), now()).reservations.find((r) => r.item && r.item.reference === reference) || null;
```

et dans `ficheHtml({ group, date, reserved = null })`, `ctaHtml(group, reserved)` renvoie, lorsque `reserved` existe :

```js
  if (reserved) return `<div class="alert alert--info">Vous avez déjà réservé ce matériel (retrait le ${escapeHtml(formatDate(reserved.loan.debutPrevu))} à ${escapeHtml(formatTime(reserved.loan.debutPrevu))}).</div><a class="btn btn--secondary btn--block" href="#/emprunts">Voir ma réservation</a>`;
```

(importer `userLoans`, `auth`, `formatTime` dans `fiche.js` ; ajouter dans `tests/mobile-views.test.mjs` un cas : `ficheHtml({ group, date: NOW, reserved: { loan: { debutPrevu: new Date(2026, 8, 18, 9).toISOString() } } })` contient `Voir ma réservation` et ne contient pas `href="#/reserver/`.)

- [ ] **Step 5 : Lancer les tests**

Run: `node --test tests/mobile-reserver.test.mjs tests/mobile-views.test.mjs`
Expected: 0 échec.

- [ ] **Step 6 : Vérifier dans le navigateur**

Mobile 390 px, horloge de démo sur un jour ouvré : catalogue → Carte SD 256 Go → « Réserver » → formulaire ; confirmer → toast et arrivée sur « Mes emprunts », onglet Réservations ; revenir sur la fiche → « Vous avez déjà réservé ce matériel ». Réserver une seconde carte SD → refus « Vous avez déjà une réservation en cours pour ce matériel. »

- [ ] **Step 7 : Commit**

```bash
git add js/mobile/views/reserver.js js/mobile/views/fiche.js js/mobile/app.js tests/mobile-reserver.test.mjs tests/mobile-views.test.mjs
git commit -m "feat(mobile): réservation d'un exemplaire de matériel de valeur"
```

---

### Task 4 : Mobile — QR de retrait, compte à rebours et notifications

**Files:**
- Modify: `js/mobile/views/emprunts.js`, `js/mobile/views/accueil.js`, `css/mobile.css`
- Test: `tests/mobile-emprunts.test.mjs`

**Interfaces:**
- Consumes : `userLoans` enrichi (`pickupOpen`, `expired`, `window`), `expireDueLoans`, `cancelLoan`, `loanQrPayload`, `renderQr`, `formatTime`, `relativeDay`, `openModal`, `toast`.
- Produces : `reservationCardHtml({ loan, item, pickupOpen, expired, window }, date)`, `notificationsHtml(data, date)` (accueil), `empruntsView` branché sur le QR et l'annulation.

- [ ] **Step 1 : Écrire le test**

Ajouter à `tests/mobile-emprunts.test.mjs` :

```js
import { reservationCardHtml } from '../js/mobile/views/emprunts.js';
import { pickupWindow } from '../js/rules.js';

test('reservationCardHtml : avant la fenêtre, pendant (QR + code), après', () => {
  const loan = { id: 'loan_x', debutPrevu: new Date(2026, 8, 18, 9, 0).toISOString(), finPrevue: new Date(2026, 8, 19, 17, 0).toISOString(), codeRetrait: 'AB12CD', statut: 'reservee' };
  const item = { nom: 'Canon R10', code: 'MDS-0029', reference: 'canon-r10' };
  const window = pickupWindow(loan, 60);

  const avant = reservationCardHtml({ loan, item, pickupOpen: false, expired: false, window }, NOW);
  assert.match(avant, /Canon R10/);
  assert.match(avant, /Retrait demain à 09h00/);
  assert.doesNotMatch(avant, /data-role="qr"/);
  assert.match(avant, /data-action="cancel" data-loan="loan_x"/);

  const pendant = reservationCardHtml({ loan, item, pickupOpen: true, expired: false, window }, new Date(2026, 8, 18, 9, 20));
  assert.match(pendant, /data-role="qr" data-code="LOAN-loan_x-AB12CD"/);
  assert.match(pendant, /AB12CD/);
  assert.match(pendant, /avant 10h00/);
  assert.match(pendant, /Montrez ce code à la pédago/);

  const apres = reservationCardHtml({ loan, item, pickupOpen: false, expired: true, window }, new Date(2026, 8, 18, 11, 0));
  assert.match(apres, /Réservation expirée/);
  assert.doesNotMatch(apres, /data-role="qr"/);
  assert.doesNotMatch(apres, /data-action="cancel"/);
});

Mettre également à jour le test existant « empruntsHtml : réservations et historique » (phase 2), dont la carte de réservation a changé de libellés : remplacer `assert.match(html, /Retrait prévu/);` par `assert.match(html, /Retrait .* à \d\dh\d\d/);` et supprimer l'assertion sur « Le QR de retrait s'affichera ici (phase 3) » si elle est présente.

test('empruntsHtml : l’onglet Réservations affiche les cartes de retrait', () => {
  const res = store.loans.list((l) => l.statut === 'reservee')[0];
  const data = userLoans(res.userId, NOW);
  const html = empruntsHtml({ tab: 'reservations', data, date: NOW });
  assert.match(html, /data-action="cancel"/);
  assert.doesNotMatch(html, /Le QR de retrait s’affichera ici/);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/mobile-emprunts.test.mjs`
Expected: FAIL — `reservationCardHtml` n'existe pas.

- [ ] **Step 3 : Écrire le code dans `js/mobile/views/emprunts.js`**

Remplacer `reservationsHtml` par une version fondée sur une carte par réservation :

```js
// Une réservation : avant la fenêtre on annonce l’heure, pendant on affiche le QR de retrait
// (que la pédago scanne) et le code court de secours, après elle est expirée.
export function reservationCardHtml({ loan, item, pickupOpen, expired, window }, date) {
  const nom = escapeHtml(item ? item.nom : loan.itemId);
  if (expired) {
    return `
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">Non retiré avant ${escapeHtml(formatTime(window.end))} — le matériel est reparti dans le catalogue.</span></span>${badge('loan', 'expiree')}</div>
        <p class="body-tiny text-secondary">Réservation expirée : vous pouvez en créer une nouvelle depuis le catalogue.</p>
      </div>`;
  }
  if (!pickupOpen) {
    return `
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">Retrait ${escapeHtml(relativeDay(loan.debutPrevu, date).toLowerCase())} à ${escapeHtml(formatTime(loan.debutPrevu))} · retour le ${escapeHtml(formatDate(loan.finPrevue))}</span></span>${badge('loan', loan.statut)}</div>
        <p class="body-tiny text-secondary">Votre code de retrait s’affichera à l’heure prévue.</p>
        <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-loan="${escapeHtml(loan.id)}">Annuler la réservation</button>
      </div>`;
  }
  return `
    <div class="m-item m-item--stacked m-item--pickup">
      <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">À retirer avant ${escapeHtml(formatTime(window.end))}</span></span>${badge('loan', loan.statut)}</div>
      <div class="pickup"><div data-role="qr" data-code="${escapeHtml(loanQrPayload(loan))}"></div><strong class="label-lg">${escapeHtml(loan.codeRetrait)}</strong><span class="body-tiny text-secondary">Montrez ce code à la pédago pour récupérer le matériel.</span></div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-loan="${escapeHtml(loan.id)}">Annuler la réservation</button>
    </div>`;
}

function reservationsHtml(rows, date) {
  if (!rows.length) return '<div class="empty-state">Aucune réservation.</div>';
  return `<div class="m-list">${rows.map((r) => reservationCardHtml(r, date)).join('')}</div>`;
}
```

Imports à ajouter : `formatDate` (déjà présent), `loanQrPayload` depuis `../../qr.js`, `renderQr` depuis `../../qr.js`, `cancelLoan` et `expireDueLoans` depuis `../../actions/loans.js`, `openModal` depuis `../../ui.js`.

Dans `empruntsView`, au début de `render()` : `expireDueLoans(now());` (idempotent ; libère les réservations dépassées avant l'affichage). Après l'injection du HTML :

```js
    container.querySelectorAll('[data-role="qr"]').forEach((el) => renderQr(el, el.dataset.code, 148));
    container.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener('click', () => {
      openModal({
        title: 'Annuler la réservation',
        body: '<p class="body-sm">Le matériel redeviendra disponible pour les autres emprunteurs.</p>',
        actions: [
          { label: 'Garder', variant: 'ghost' },
          { label: 'Annuler la réservation', variant: 'danger', onClick: () => {
            try { cancelLoan(b.dataset.loan, auth.currentUserId()); toast('Réservation annulée', 'success'); }
            catch (e) { toast(e.message, 'error'); return false; }
          } },
        ],
      });
    }));
```

`mobile.html` charge déjà `vendor/html5-qrcode.min.js` ; ajouter **avant** le script module : `<script src="vendor/qrcode.min.js"></script>` (bibliothèque d'affichage, déjà présente dans `vendor/`, utilisée par l'admin).

- [ ] **Step 4 : Notifications sur l'accueil**

Dans `js/mobile/views/accueil.js`, `accueilHtml` reçoit `reservations` et affiche une carte quand au moins une réservation est retirable maintenant ou vient d'expirer :

```js
function noticesHtml(reservations, date) {
  const open = reservations.filter((r) => r.pickupOpen);
  const expired = reservations.filter((r) => r.expired);
  if (!open.length && !expired.length) return '';
  const lignes = [
    ...open.map((r) => `<div class="alert alert--info">${escapeHtml(r.item ? r.item.nom : '')} : à retirer avant ${escapeHtml(formatTime(r.window.end))} — <a href="#/emprunts">voir mon code</a>.</div>`),
    ...expired.map((r) => `<div class="alert alert--warning">${escapeHtml(r.item ? r.item.nom : '')} : réservation expirée, le matériel est reparti dans le catalogue.</div>`),
  ];
  return `<section class="stack">${lignes.join('')}</section>`;
}
```

inséré juste après le `m-hero` dans `accueilHtml({ user, enCours, nextBooking, date, reservations = [] })`, et `accueilView` passe `reservations: userLoans(user.id, date).reservations` après avoir appelé `expireDueLoans(date)`.

Test (dans `tests/mobile-views.test.mjs`) :

```js
test('accueilHtml : avis de retrait et d’expiration', () => {
  const base = { user: store.users.get('user_010'), enCours: [], nextBooking: null, date: NOW };
  const item = { nom: 'Canon R10' };
  const w = { end: new Date(2026, 8, 17, 11, 0) };
  const open = accueilHtml({ ...base, reservations: [{ loan: {}, item, pickupOpen: true, expired: false, window: w }] });
  assert.match(open, /à retirer avant 11h00/);
  assert.match(open, /href="#\/emprunts"/);
  const exp = accueilHtml({ ...base, reservations: [{ loan: {}, item, pickupOpen: false, expired: true, window: w }] });
  assert.match(exp, /réservation expirée/);
  assert.doesNotMatch(accueilHtml(base), /alert--info|alert--warning/);
});
```

- [ ] **Step 5 : CSS**

`css/mobile.css`, après `.m-item__photos` :

```css
.m-item--pickup { border: var(--stroke-thin) solid var(--border-brand); }
.pickup { display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); padding: var(--space-lg) 0; text-align: center; }
.pickup [data-role="qr"] img, .pickup [data-role="qr"] canvas { image-rendering: pixelated; }
```

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/mobile-emprunts.test.mjs tests/mobile-views.test.mjs`
Expected: 0 échec.

- [ ] **Step 7 : Commit**

```bash
git add js/mobile/views/emprunts.js js/mobile/views/accueil.js mobile.html css/mobile.css tests/mobile-emprunts.test.mjs tests/mobile-views.test.mjs
git commit -m "feat(mobile): QR de retrait, annulation d'une réservation et avis d'expiration"
```

---

### Task 5 : Admin — écran Emprunts et modale de remise

**Files:**
- Create: `js/admin/views/emprunts.js`, `js/admin/handoverModal.js`
- Modify: `js/admin/app.js` (route `/emprunts`), `js/admin/views/dashboard.js` (bouton *Remettre*), `css/admin.css`
- Test: `tests/admin-emprunts.test.mjs`

**Interfaces:**
- Consumes : `handOver`, `receiveLoan`, `refuseLoan`, `extendLoan`, `expireDueLoans`, `pendingHandovers`, `buildChecklist`, `hasProblem`, `startScanner`/`stopScanner`, `renderTable`/`sortRows`/`toggleSort`/`bindTable`, `openModal`/`closeModal`, `setTopbar`, `badge`, `avatar`.
- Produces : `TABS_ADMIN_LOANS`, `loanRows(tab, date)` (depuis le store), `LOAN_COLUMNS`, `empruntsHtml({ tab, rows, counts, sort, date })`, `empruntsView(container)` ; `openHandoverModal({ onDone })`, `checklistFormHtml(reference)`, `readChecklistForm(root)`.

- [ ] **Step 1 : Écrire le test**

`tests/admin-emprunts.test.mjs` :

```js
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { TABS_ADMIN_LOANS, LOAN_COLUMNS, loanRows, empruntsHtml } from '../js/admin/views/emprunts.js';
import { checklistFormHtml, readChecklistForm } from '../js/admin/handoverModal.js';
import { sortRows } from '../js/admin/table.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

test('TABS_ADMIN_LOANS et loanRows : répartition conforme au seed', () => {
  assert.deepEqual(TABS_ADMIN_LOANS.map((t) => t.key), ['enCours', 'reserves', 'retards', 'historique']);
  assert.equal(loanRows('enCours', NOW).length, 8, '10 en cours moins les 2 en retard');
  assert.equal(loanRows('retards', NOW).length, 2);
  assert.equal(loanRows('reserves', NOW).length, 2);
  assert.ok(loanRows('historique', NOW).length >= 40);
  const r = loanRows('retards', NOW)[0];
  assert.ok(r.item && r.user && r.loan);
  assert.equal(r.late, true);
});

test('LOAN_COLUMNS : rendus échappés, badge de retard, actions selon l’onglet', () => {
  const row = { loan: { id: 'l1', statut: 'en_cours', debutPrevu: NOW.toISOString(), dateRetrait: NOW.toISOString(), finPrevue: NOW.toISOString(), codeRetrait: null }, item: { id: 'i1', nom: '<x>', code: 'MDS-0001' }, user: { id: 'u1', prenom: 'Léa', nom: 'P' }, late: true };
  assert.deepEqual(LOAN_COLUMNS.map((c) => c.key), ['item', 'user', 'debut', 'fin', 'statut']);
  assert.match(LOAN_COLUMNS[0].render(row), /&lt;x&gt;/);
  assert.match(LOAN_COLUMNS[1].render(row), /Léa P/);
  assert.match(LOAN_COLUMNS[4].render(row), /badge--late/);
});

test('empruntsHtml : onglets avec compteurs, actions de l’onglet Réservés, état vide', () => {
  const rows = sortRows(loanRows('reserves', NOW), { key: 'debut', dir: 'asc' }, LOAN_COLUMNS);
  const counts = { enCours: 8, reserves: 2, retards: 2, historique: 41 };
  const html = empruntsHtml({ tab: 'reserves', rows, counts, sort: { key: 'debut', dir: 'asc' }, date: NOW });
  assert.match(html, /tab tab--active" data-tab="reserves">Réservés <span class="tab__count">2<\/span>/);
  assert.match(html, /data-action="handover"/);
  assert.match(html, /data-action="refuse" data-loan="/);
  const vide = empruntsHtml({ tab: 'retards', rows: [], counts: { enCours: 0, reserves: 0, retards: 0, historique: 0 }, sort: null, date: NOW });
  assert.match(vide, /Aucun emprunt/);
});

test('empruntsHtml : onglet En cours propose réception et prolongation', () => {
  const rows = loanRows('enCours', NOW);
  const html = empruntsHtml({ tab: 'enCours', rows, counts: { enCours: rows.length, reserves: 0, retards: 0, historique: 0 }, sort: null, date: NOW });
  assert.match(html, /data-action="receive" data-loan="/);
  assert.match(html, /data-action="extend" data-loan="/);
});

test('checklistFormHtml et readChecklistForm', () => {
  const html = checklistFormHtml('hoya-nd');
  assert.equal((html.match(/data-line="/g) || []).length, 3);
  assert.match(html, /Verre sans rayure/);
  assert.match(html, /name="commentaire"/);
  const root = {
    querySelectorAll: () => [
      { dataset: { line: '0' }, checked: false, closest: () => ({ querySelector: () => ({ value: 'rayure' }) }) },
      { dataset: { line: '1' }, checked: true, closest: () => ({ querySelector: () => ({ value: '' }) }) },
      { dataset: { line: '2' }, checked: true, closest: () => ({ querySelector: () => ({ value: '' }) }) },
    ],
    querySelector: (sel) => (sel === '[name="commentaire"]' ? { value: 'à nettoyer' } : null),
  };
  const read = readChecklistForm(root, 'hoya-nd');
  assert.equal(read.checklist.length, 3);
  assert.equal(read.checklist[0].ok, false);
  assert.equal(read.checklist[0].commentaire, 'rayure');
  assert.equal(read.checklist[1].ok, true);
  assert.equal(read.commentaire, 'à nettoyer');
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node --test tests/admin-emprunts.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 3 : Écrire `js/admin/handoverModal.js`**

```js
// js/admin/handoverModal.js — remise d’un matériel réservé (scan du QR de l’emprunteur ou code court)
// et formulaire de checklist pour la réception.
import { auth } from '../auth.js';
import { escapeHtml, openModal, toast } from '../ui.js';
import { checklistFor } from '../checklists.js';
import { handOver } from '../actions/loans.js';
import { startScanner, stopScanner, hasCamera, normalizeScanText } from '../scanner.js';

export function checklistFormHtml(reference) {
  const lignes = checklistFor(reference);
  return `
    <div class="checklist-admin">
      ${lignes.map((ligne, i) => `
        <div class="checklist-admin__row">
          <label class="checkbox"><input type="checkbox" data-line="${i}" checked> ${escapeHtml(ligne)}</label>
          <input class="input input--sm" placeholder="Problème constaté (optionnel)" data-comment="${i}">
        </div>`).join('')}
    </div>
    <label class="field"><span class="field__label">Commentaire de réception (optionnel)</span><textarea class="textarea" name="commentaire"></textarea></label>`;
}

// `root` : l’élément de la modale. Une ligne décochée = problème ; son champ texte devient le commentaire.
export function readChecklistForm(root, reference) {
  const lignes = checklistFor(reference);
  const checklist = [...root.querySelectorAll('[data-line]')].map((cb) => {
    const i = Number(cb.dataset.line);
    const commentaire = cb.closest('.checklist-admin__row').querySelector(`[data-comment="${i}"]`).value.trim();
    return { ligne: lignes[i], ok: cb.checked, commentaire: cb.checked ? '' : commentaire };
  });
  const c = root.querySelector('[name="commentaire"]');
  return { checklist, commentaire: c ? c.value.trim() : '' };
}

// Modale de remise : la pédago scanne le QR affiché par l’emprunteur, ou saisit son code à 6 caractères.
export function openHandoverModal({ onDone } = {}) {
  const close = openModal({
    title: 'Remettre le matériel',
    body: `
      <p class="body-sm text-secondary">Scannez le QR affiché par l’emprunteur, ou saisissez son code de retrait.</p>
      <div id="handover-reader" class="reader reader--admin"></div>
      <label class="field"><span class="field__label">Code de retrait</span><input class="input" name="code" placeholder="AB12CD" autocapitalize="characters" maxlength="24"></label>`,
    actions: [
      { label: 'Annuler', variant: 'ghost', onClick: () => { stopScanner(); } },
      {
        label: 'Remettre', variant: 'primary',
        onClick: (modal) => {
          try {
            const loan = handOver({ code: modal.querySelector('[name="code"]').value, pedagoId: auth.currentUserId() });
            stopScanner();
            toast('Matériel remis', 'success');
            if (onDone) onDone(loan);
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
    const reader = root.querySelector('#handover-reader');
    if (!reader) return; // modale déjà fermée
    if (!ok) { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; return; }
    startScanner('handover-reader', (text) => {
      input.value = normalizeScanText(text);
      try {
        const loan = handOver({ code: input.value, pedagoId: auth.currentUserId() });
        stopScanner();
        toast('Matériel remis', 'success');
        close();
        if (onDone) onDone(loan);
      } catch (e) {
        toast(e.message, 'error');
      }
    }).catch(() => { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; });
  });
  return close;
}
```

- [ ] **Step 4 : Écrire `js/admin/views/emprunts.js`**

```js
// js/admin/views/emprunts.js — suivi des emprunts : en cours, réservés, en retard, historique.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, isLate, sortByDateDesc, addDays } from '../../rules.js';
import { LOAN_STATES } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, formatDate, formatDateTime, relativeDay, openModal, toast } from '../../ui.js';
import { receiveLoan, refuseLoan, extendLoan, expireDueLoans } from '../../actions/loans.js';
import { setTopbar } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';
import { openHandoverModal, checklistFormHtml, readChecklistForm } from '../handoverModal.js';

export const TABS_ADMIN_LOANS = [
  { key: 'enCours', label: 'En cours' },
  { key: 'reserves', label: 'Réservés' },
  { key: 'retards', label: 'En retard' },
  { key: 'historique', label: 'Historique' },
];

const ACTIVE = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

export function loanRows(tab, date) {
  const items = store.items.list();
  const users = store.users.list();
  const join = (loan) => ({ loan, item: items.find((i) => i.id === loan.itemId) || null, user: users.find((u) => u.id === loan.userId) || null, late: isLate(loan, date) });
  const all = store.loans.list();
  if (tab === 'reserves') return sortByDateDesc(all.filter((l) => l.statut === LOAN_STATES.RESERVEE), (l) => l.debutPrevu).reverse().map(join);
  if (tab === 'retards') return all.filter((l) => isLate(l, date)).map(join).sort((a, b) => a.loan.finPrevue.localeCompare(b.loan.finPrevue));
  if (tab === 'historique') return sortByDateDesc(all.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.dateRetrait || l.debutPrevu).map(join);
  return sortByDateDesc(all.filter((l) => l.statut === LOAN_STATES.EN_COURS && !isLate(l, date)), (l) => l.dateRetrait).map(join);
}

export const LOAN_COLUMNS = [
  { key: 'item', label: 'Matériel', sortable: true, sortValue: (r) => (r.item ? r.item.nom : ''), render: (r) => `<strong>${escapeHtml(r.item ? r.item.nom : r.loan.itemId)}</strong><br><span class="body-tiny text-secondary">${escapeHtml(r.item ? r.item.code : '')}</span>` },
  { key: 'user', label: 'Emprunteur', sortable: true, sortValue: (r) => (r.user ? `${r.user.nom} ${r.user.prenom}` : ''), render: (r) => (r.user ? `<span class="row">${avatar(r.user)}${escapeHtml(fullName(r.user))}</span>` : '—') },
  { key: 'debut', label: 'Retrait', sortable: true, sortValue: (r) => r.loan.dateRetrait || r.loan.debutPrevu, render: (r) => escapeHtml(formatDateTime(r.loan.dateRetrait || r.loan.debutPrevu)) },
  { key: 'fin', label: 'Retour prévu', sortable: true, sortValue: (r) => r.loan.finPrevue, render: (r) => escapeHtml(formatDate(r.loan.finPrevue)) },
  { key: 'statut', label: 'Statut', sortable: true, sortValue: (r) => (r.late ? 'zz' : r.loan.statut), render: (r) => badge('loan', r.late ? 'en_retard' : r.loan.statut) },
];

function actionsColumn(tab) {
  return {
    key: 'actions', label: '', align: 'right',
    render: (r) => {
      const id = escapeHtml(r.loan.id);
      if (tab === 'reserves') {
        return `<div class="table__actions"><button type="button" class="btn btn--primary btn--sm" data-action="handover" data-loan="${id}">Remettre</button><button type="button" class="btn btn--ghost btn--sm" data-action="refuse" data-loan="${id}">Refuser</button></div>`;
      }
      if (tab === 'enCours' || tab === 'retards') {
        return `<div class="table__actions"><button type="button" class="btn btn--primary btn--sm" data-action="receive" data-loan="${id}">Réceptionner</button><button type="button" class="btn btn--ghost btn--sm" data-action="extend" data-loan="${id}">Prolonger</button></div>`;
      }
      return '';
    },
  };
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function empruntsHtml({ tab, rows, counts, sort, date }) {
  const tabs = TABS_ADMIN_LOANS.map((t) => `<button type="button" class="tab${t.key === tab ? ' tab--active' : ''}" data-tab="${t.key}">${escapeHtml(t.label)} <span class="tab__count">${counts[t.key]}</span></button>`).join('');
  const columns = [...LOAN_COLUMNS, actionsColumn(tab)];
  return `
    <div class="page-header">
      <div><h2 class="h6">Emprunts</h2><p class="page-header__meta">${plural(counts.enCours + counts.reserves, 'dossier actif', 'dossiers actifs')} · ${plural(counts.retards, 'retard', 'retards')}</p></div>
    </div>
    <div class="card">
      <div class="tabs">${tabs}</div>
      <div data-role="results">${renderTable({ columns, rows, sort, rowHref: (r) => `/materiel/${r.loan.itemId}`, emptyText: 'Aucun emprunt dans cet onglet.' })}</div>
    </div>`;
}

export function empruntsView(container) {
  let tab = 'enCours';
  let sort = { key: 'debut', dir: 'desc' };

  const counts = (date) => ({
    enCours: loanRows('enCours', date).length, reserves: loanRows('reserves', date).length,
    retards: loanRows('retards', date).length, historique: loanRows('historique', date).length,
  });

  const askReceive = (row) => openModal({
    title: `Réceptionner — ${row.item ? row.item.nom : ''}`,
    body: checklistFormHtml(row.item ? row.item.reference : ''),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Valider le retour', variant: 'primary', onClick: (modal) => {
        try {
          const { checklist, commentaire } = readChecklistForm(modal, row.item.reference);
          const r = receiveLoan({ loanId: row.loan.id, pedagoId: auth.currentUserId(), checklist, commentaire });
          toast(r.maintenance ? 'Retour enregistré — problème signalé' : 'Retour enregistré', r.maintenance ? 'warning' : 'success');
        } catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const askRefuse = (row) => openModal({
    title: `Refuser la réservation — ${row.item ? row.item.nom : ''}`,
    body: '<label class="field"><span class="field__label">Motif (communiqué à l’emprunteur)</span><textarea class="textarea" name="motif" placeholder="Matériel réservé pour un cours"></textarea></label>',
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Refuser', variant: 'danger', onClick: (modal) => {
        try { refuseLoan(row.loan.id, auth.currentUserId(), modal.querySelector('[name="motif"]').value); toast('Réservation refusée', 'success'); }
        catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const askExtend = (row) => openModal({
    title: `Prolonger — ${row.item ? row.item.nom : ''}`,
    body: `<label class="field"><span class="field__label">Nouvelle date de retour</span><input class="input" type="date" name="fin" value="${escapeHtml(new Date(addDays(new Date(row.loan.finPrevue), 2)).toISOString().slice(0, 10))}"></label>`,
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Prolonger', variant: 'primary', onClick: (modal) => {
        const v = modal.querySelector('[name="fin"]').value;
        const [y, m, d] = v.split('-').map(Number);
        try { extendLoan(row.loan.id, new Date(y, m - 1, d, 17, 0), auth.currentUserId()); toast('Emprunt prolongé', 'success'); }
        catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const render = () => {
    const date = now();
    expireDueLoans(date);
    const rows = sortRows(loanRows(tab, date), sort, LOAN_COLUMNS);
    setTopbar({ title: 'Emprunts', subtitle: 'Suivi des prêts et des réservations', action: { label: 'Remettre un matériel', onClick: () => openHandoverModal({}) } });
    container.innerHTML = empruntsHtml({ tab, rows, counts: counts(date), sort, date });
    container.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); render(); }, onRow: navigate });
    const rowOf = (id) => rows.find((r) => r.loan.id === id);
    container.querySelectorAll('[data-action="receive"]').forEach((b) => b.addEventListener('click', () => askReceive(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="refuse"]').forEach((b) => b.addEventListener('click', () => askRefuse(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="extend"]').forEach((b) => b.addEventListener('click', () => askExtend(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="handover"]').forEach((b) => b.addEventListener('click', () => openHandoverModal({})));
  };

  render();
  return store.subscribe(render);
}
```

- [ ] **Step 5 : Route, dashboard et CSS**

`js/admin/app.js` : `import { empruntsView } from './views/emprunts.js';` et route `{ path: '/emprunts', view: guard(empruntsView) }`.

`js/admin/views/dashboard.js` : dans `dueList`, remplacer la phrase « La remise se fait depuis l'écran Emprunts (phase 3). » par un bouton par ligne — `<button type="button" class="btn btn--primary btn--sm" data-action="handover">Remettre</button>` dans chaque `list__item` — et, dans `dashboardView`, brancher `container.querySelectorAll('[data-action="handover"]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openHandoverModal({}); }));` (importer `openHandoverModal`). Mettre à jour le test correspondant dans `tests/admin-dashboard.test.mjs` (la phrase disparaît, `data-action="handover"` apparaît quand il y a des remises du jour).

`css/admin.css` :

```css
.reader--admin { aspect-ratio: 4 / 3; max-height: 260px; margin-bottom: var(--space-lg); }
.checklist-admin { display: flex; flex-direction: column; gap: var(--space-sm); }
.checklist-admin__row { display: grid; grid-template-columns: 1fr 200px; gap: var(--space-md); align-items: center; }
.input--sm { height: var(--size-control-sm); font-size: 12px; }
@media (max-width: 600px) { .checklist-admin__row { grid-template-columns: 1fr; } }
```

- [ ] **Step 6 : Lancer les tests**

Run: `node --test tests/admin-emprunts.test.mjs tests/admin-dashboard.test.mjs`
Expected: 0 échec.

- [ ] **Step 7 : Commit**

```bash
git add js/admin/views/emprunts.js js/admin/handoverModal.js js/admin/app.js js/admin/views/dashboard.js css/admin.css tests/admin-emprunts.test.mjs tests/admin-dashboard.test.mjs
git commit -m "feat(admin): écran emprunts, remise par QR ou code, réception avec checklist"
```

---

### Task 6 : Vérification de fin de phase

**Files:**
- Modify: `README.md`, `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

- [ ] **Step 1 : Suite complète et greps**

Run: `npm test` → 0 échec (207 + ~35 nouveaux tests).
Run: `grep -nE "[a-zéèà]'[a-zéèà]" js/*.js js/**/*.js *.html` → rien ; `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/admin.css css/mobile.css` → rien.

- [ ] **Step 2 : Scénario de vérification de phase (contrôleur, navigateur, deux fenêtres)**

Horloge de démo sur un jour ouvré 8h30, données régénérées.
1. Mobile (Yann) : catalogue → Canon R10 → « Réserver » → retrait aujourd'hui 9h, retour demain → toast, onglet Réservations : « Votre code de retrait s'affichera à l'heure prévue », pas de QR. Admin : onglet Réservés, la ligne apparaît ; dashboard « À remettre aujourd'hui » avec bouton *Remettre*.
2. Horloge → 9h15. Mobile : le QR et le code à 6 caractères s'affichent, l'accueil annonce « à retirer avant 10h00 ». Admin → *Remettre* → saisir le code → « Matériel remis » ; l'emprunt bascule dans En cours, l'objet passe `emprunte`.
3. Horloge → +2 jours. Admin : onglet En retard, la ligne est là. *Réceptionner* → décocher « Carte SD retirée », commenter → « Retour enregistré — problème signalé » ; l'objet passe en maintenance, le signalement apparaît sur le dashboard.
4. Expiration : réserver le Zoom H5 pour 14h, horloge → 15h01, ouvrir l'écran Emprunts → la réservation est passée en « Expiré » et l'objet est de nouveau disponible ; le mobile affiche l'avis d'expiration.
5. Refus : réserver un filtre Hoya, admin → *Refuser* avec motif → l'objet redevient disponible, le mobile montre « Refusé » dans l'historique.
6. Annulation : réserver, puis annuler depuis le mobile → l'objet redevient disponible.

- [ ] **Step 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 3 — Matériel de valeur`. Roadmap : ligne Phase 3 → `` `2026-10-04-phase-3-materiel-valeur.md` (exécuté) ``.

- [ ] **Step 4 : Commit et étiquette**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 3 terminée"
git tag phase-3
```

- [ ] **Step 5 : Rédiger le plan de la phase 4** (`superpowers:writing-plans`, roadmap Phase 4, spec §5.3 et §6/§7). **Prérequis à traiter en Task 1 de la phase 4** (ruling phase 2) : `ui.toDate` doit parser `YYYY-MM-DD` en date locale (aujourd'hui interprété en UTC), avec un test épinglé sur `TZ=America/New_York` — les dates de réservation de salle passent par `relativeDay`/`formatDate`.

---

## Auto-revue du plan

**Couverture du spec** — §3.3 : la liste du matériel `valeur` vient du seed, inchangée ✔. §3.4 : « un exemplaire par référence » couvert par `canReserveValeur` (motif spécialisé `DEJA_RESERVE` quand c'est l'emprunteur lui-même) ✔. §5.2 : réservation bloque l'objet immédiatement ✔ ; pas d'étape de validation séparée, la validation est la remise ✔ ; fenêtre `[debutPrevu, debutPrevu + fenetreRetraitMinutes]` et QR inactif avant ✔ (le QR n'est rendu que si `pickupOpen`) ; expiration → `expiree`, objet disponible, notification ✔ ; refus avec motif ✔ ; prolongation ✔ ; réception avec checklist complète → `retournee` ou `maintenance` + signalement ✔ ; blocage si retard : déjà dans `commonChecks` ✔. §5.5 : tout passe par `now()` ; `expireDueLoans` appelé au rendu, pas de timer ✔. §6 `#/emprunts` : onglets En cours / Réservés / En retard / Historique, actions Remettre / Réceptionner / Refuser / Prolonger ✔ ; widget « À remettre aujourd'hui » rendu actif ✔. §7 : « Réserver » depuis la fiche ✔, QR de retrait + code court dans « Mes emprunts » ✔, notifications (expiration, retrait possible) sur l'accueil ✔ ; les notifications « refus » apparaissent dans l'historique mobile (statut `Refusé`) — acceptable, pas d'écran de notifications dédié dans le spec. §8 : `checklistFor(reference)` fournit les lignes valeur ✔.

**Hors périmètre de la phase**, conformément à la feuille de route : écran Salle (phase 4), maintenance/paramètres (phase 5), `store.usage()` et le message de quota (phase 5), `ui.toDate` local (prérequis phase 4, noté en Task 6 Step 5).

**Placeholders** : aucun ; chaque étape porte son code ou l'édition exacte.

**Cohérence des noms** : `reserveValeur/handOver/receiveLoan/refuseLoan/cancelLoan/extendLoan/expireDueLoans/pendingHandovers` (T2) ↔ T3 (`reserveValeur`), T4 (`cancelLoan`, `expireDueLoans`), T5 (`handOver` via la modale, `receiveLoan`, `refuseLoan`, `extendLoan`, `expireDueLoans`) ✔ ; `userLoans(...).reservations` enrichi (T2) ↔ T3 (fiche) et T4 (cartes, avis) ✔ ; `REASONS.FENETRE_RETRAIT/DEJA_RESERVE/DATE_PASSEE` (T2) ↔ messages affichés via `REASON_LABELS` ✔ ; `loanQrPayload`/`parseLoanCode` (phase 1) ↔ T4 (affichage) et T2 (`handOver`) ✔ ; `checklistFormHtml`/`readChecklistForm` (T5, `handoverModal.js`) ↔ `empruntsView` ✔ ; `openHandoverModal({ onDone })` (T5) ↔ dashboard et écran Emprunts ✔ ; `renderTable`/`bindTable` (phase 1) ↔ T5 ✔.
