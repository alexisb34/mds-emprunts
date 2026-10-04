# MDS Emprunts — Feuille de route d'implémentation

> **For agentic workers:** ce document est la carte d'ensemble. Chaque phase a (ou aura) son propre plan détaillé `docs/superpowers/plans/2026-09-17-phase-N-<nom>.md`, exécutable tâche par tâche avec superpowers:subagent-driven-development ou superpowers:executing-plans. Le plan détaillé d'une phase est rédigé (skill writing-plans) **à la fin de la phase précédente**, en s'appuyant sur le code réel, pour éviter de planifier à l'aveugle.

**Goal :** livrer un prototype fonctionnel HTML/CSS/JS vanilla de gestion des emprunts de matériel de l'école MDS (admin desktop + mobile emprunteurs), données en `localStorage`, tracé de bout en bout.

**Architecture :** deux mini-applications (`admin.html`, `mobile.html`) avec routing `#hash`, modules ES natifs, une couche `store.js` unique pour la persistance, des `actions/` par domaine qui appliquent les règles (`rules.js`, `models.js`) et écrivent le journal.

**Tech Stack :** HTML5, CSS3 (tokens issus du Figma), JavaScript ES2022 (modules natifs), `localStorage`/`sessionStorage`, `html5-qrcode`, `qrcode.js` (copies locales dans `vendor/`), Node ≥ 22 pour les tests (`node --test`), `python3 -m http.server` pour servir.

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md`

## Global Constraints

- Aucun build, aucune dépendance npm installée ; `package.json` sert uniquement à `"type": "module"` et au script `npm test`.
- Interface 100 % en français ; libellés d'états définis une seule fois dans `js/models.js` (`LABELS`).
- Tokens visuels = variables Figma du kit « MDS — UI Kit — Prêt de matériel » (fichier `pyMDlyt4X8jot1ZeHcXvtk`), jamais de couleur en dur dans les vues.
- Polices : Inter (corps) et Bricolage Grotesque (titres), chargées via Google Fonts.
- Toute mutation métier passe par `js/actions/*` et écrit une `LogEntry` ; les vues ne touchent jamais `store` en écriture.
- Règles temporelles calculées à la volée via `rules.now()` (respecte l'horloge de démo) ; aucun `setInterval` métier.
- Clé de persistance : `mds-emprunts:v1`. Utilisateur courant : `sessionStorage` clé `mds-emprunts:currentUser`.
- Photos : JPEG 640 px max, base64, stockées dans le `Loan`.
- Codes QR : objets `MDS-0042`, retraits `LOAN-<loanId>-<code6>`.
- Commits fréquents, messages en français, préfixe `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

---

## Vue d'ensemble des phases

| Phase | Plan détaillé | Livrable démontrable |
|---|---|---|
| 0. Fondations | `2026-09-17-phase-0-fondations.md` (rédigé) | `kit.html` fidèle au Figma, `npm test` vert, seed complet |
| 1. Admin — inventaire & utilisateurs | `2026-09-18-phase-1-admin-inventaire.md` (exécuté) | Admin navigable : dashboard, matériel, fiche, QR, utilisateurs |
| 2. Mobile — self-service | `2026-09-20-phase-2-mobile-self-service.md` (exécuté) | Scan → photo → emprunt → retour, visible en direct côté admin |
| 3. Matériel de valeur | `2026-10-04-phase-3-materiel-valeur.md` (exécuté) | Réservation → remise par QR → retard → réception avec checklist |
| 4. Salle photo | à rédiger fin phase 3 | Réservation multi-créneaux, états des lieux, planning admin |
| 5. Maintenance & paramètres | à rédiger fin phase 4 | Interventions, horloge de démo, reset, PWA installable |
| 6. Déploiement test | à rédiger fin phase 5 | URL GitHub Pages, scénarios de démo, test sur téléphone |

---

## Phase 1 — Admin : inventaire & utilisateurs

**Consomme :** `store`, `models`, `rules`, `seed`, `log`, `auth`, `ui`, `router`, `components.css` (phase 0).

| # | Tâche | Fichiers | Produit (interfaces) | Vérification |
|---|---|---|---|---|
| 1.1 | Coquille admin | `admin.html`, `css/admin.css`, `js/admin/app.js` | Sidebar (7 entrées), topbar (recherche, action principale, avatar), `<main id="view">`, `<div id="modal-root">`, `<div id="toast-root">` ; `app.js` : `store.init(buildSeed)`, login pédago (sélecteur des 5 pédago si aucun `auth.currentUser()`), `createRouter(routes)` | Ouvrir `admin.html`, naviguer entre routes vides, sidebar active |
| 1.2 | Actions matériel | `js/actions/items.js`, `tests/actions-items.test.mjs` | `createItem(data, auteurId)` (génère `code` `MDS-NNNN` unique), `updateItem(id, patch, auteurId)`, `setItemState(id, etat, auteurId, detail)` (vérifie `ITEM_TRANSITIONS`), `applyItemState(id, etat)` (sans journal), `nextItemCode()` | Tests : code auto-incrémenté, transition interdite lève, log écrit |
| 1.3 | Actions utilisateurs | `js/actions/users.js`, `tests/actions-users.test.mjs` | `createUser`, `updateUser`, `setUserActive`, `userStats(userId, date)` → `{ enCours, retards, reservations, total }` | Tests : désactivation, stats |
| 1.4 | Vue tableau de bord | `js/admin/views/dashboard.js`, `js/admin/kpi.js`, `tests/kpi.test.mjs` | `computeKpis(db, now)` → `{ disponibles, enCours, retards, reservationsSalle }` ; widgets Retards, À remettre aujourd'hui, Signalements, Dernières activités (15 dernières `LogEntry`) | Test `computeKpis` sur le seed ; visuel vs Figma `2:117` |
| 1.5 | Vue matériel | `js/admin/views/materiel.js`, `js/admin/table.js` | `renderTable({ columns, rows, sort, rowHref, emptyText })` + `bindTable(root, { onSort, onRow })` réutilisables ; filtres catégorie/circuit/état + recherche ; modale *Ajouter* | Ajouter un objet → apparaît dans la table et le journal |
| 1.6 | Fiche matériel + QR | `js/admin/views/materielFiche.js`, `js/qr.js`, `vendor/qrcode.min.js`, `etiquettes.html` | `renderQr(container, text, size)` ; fiche : infos éditables, changement d'état, historique emprunts/interventions, photos ; `etiquettes.html?codes=MDS-0001,MDS-0002` page d'impression | Imprimer une étiquette (aperçu impression), passer un objet HS → disparaît des disponibles |
| 1.7 | Vues utilisateurs | `js/admin/views/utilisateurs.js`, `js/admin/views/utilisateurFiche.js` | Table + filtres rôle/promo, ajout/modif/désactivation, fiche avec historique complet | Scénario : ajouter un intervenant, le désactiver |

**Scénario de vérification de phase :** ajouter « Multiprise #7 », imprimer son QR, la passer `hs`, vérifier KPI « disponibles » décrémenté et journal à jour.

---

## Phase 2 — Mobile : self-service

| # | Tâche | Fichiers | Produit (interfaces) | Vérification |
|---|---|---|---|---|
| 2.1 | Coquille mobile | `mobile.html`, `css/mobile.css`, `js/mobile/app.js`, `js/mobile/views/login.js`, `js/mobile/views/profil.js` | Header, `<main>`, bottom nav 4 onglets + bouton Scanner central ; login démo par rôle ; profil avec *Changer d'utilisateur* | Ouvrir sur viewport 390 px, se connecter, naviguer |
| 2.2 | Actions emprunt self | `js/actions/loans.js`, `tests/actions-loans-self.test.mjs` | `findOpenLoanForItem(itemId)` ; `resolveScan(code, userId, date)` → `{ mode: 'emprunt' \| 'retour' \| 'erreur', item, loan, reason }` ; `borrowSelf({ itemCode, userId, photo })` → `Loan` ou lève `Error(reason)` ; `returnSelf({ loanId, userId, photo, checklist })` → crée signalement si problème ; `userLoans(userId, date)` → `{ enCours, reservations, historique }` ; `store.transaction(fn)` (écritures atomiques) | Tests : bureau fermé, déjà un exemplaire, objet en maintenance, retour avec problème → `MaintenanceEvent` + item `maintenance` |
| 2.3 | Scanner & photo | `js/scanner.js`, `vendor/html5-qrcode.min.js`, `tests/scanner.test.mjs`, `tests/scan-flow.test.mjs` | `js/scanner.js` : `fitWithin` / `normalizeScanText` / `resizeToJpeg` (pures et testées), `capturePhoto(videoEl)` → base64 JPEG ≤ 640 px, `placeholderPhoto`, `hasCamera`, `startCamera` / `stopCamera`, `startScanner(elementId, onCode)` / `stopScanner()` ; `js/mobile/scanFlow.js` (réducteur du flux scan → photo → confirmation / checklist) | Tests de redimensionnement, de normalisation, du cycle de vie du lecteur et du réducteur ; scan réel sur `localhost` |
| 2.4 | Vues catalogue | `js/mobile/views/accueil.js`, `catalogue.js`, `fiche.js` | Cartes objet avec badge état + pastille circuit ; bouton contextuel par circuit ; `js/mobile/catalog.js` : `groupByReference` / `filterCatalog` / `availability` | Visuel ; filtre par chips |
| 2.5 | Vue scan | `js/mobile/views/scan.js` | Flux : scan → `resolveScan` → photo → confirmation (emprunt) ou mini-checklist (retour) → toast ; messages d'erreur `REASON_LABELS` | Scénario 2 fenêtres : emprunt visible côté admin sans rechargement |
| 2.6 | Vue mes emprunts | `js/mobile/views/emprunts.js` | Onglets En cours / Réservations / Historique ; photo d'emprunt affichée | Visuel |

**Scénario de vérification de phase :** fenêtre A admin, fenêtre B mobile (Léa) ; B scanne `MDS-0003` → photo → emprunt ; A voit la ligne apparaître ; B rescanne → photo → coche « Câble intact » en Problème → A voit le signalement et l'objet en `maintenance`. Horloge démo à samedi 10h → scan refusé « Bureau fermé ».

---

## Phase 3 — Matériel de valeur

| # | Tâche | Fichiers | Produit (interfaces) | Vérification |
|---|---|---|---|---|
| 3.1 | Actions réservation & remise | `js/actions/loans.js` (extension), `tests/actions-loans-valeur.test.mjs` | `reserveValeur({ itemId, userId, debutPrevu, finPrevue, motif })` (item → `reserve`, génère `codeRetrait`), `refuseLoan(loanId, pedagoId, motifRefus)`, `handOver({ code, pedagoId })` (accepte `LOAN-…` ou code6, vérifie la fenêtre de retrait), `receiveLoan({ loanId, pedagoId, checklist })` (accepte aussi le circuit self : réception d’un emprunt self par la pédago), `extendLoan(loanId, finPrevue, pedagoId)`, `expireDueLoans(now)` (appelé par les vues au rendu) | Tests : fenêtre de retrait avant/pendant/après, expiration libère l'objet, réception avec problème |
| 3.2 | Mobile réservation | `js/mobile/views/reserver.js`, `emprunts.js` (QR de retrait) | `userLoans.reservations` exposera `pickupOpen` / `expired` ; formulaire dates/motif ; QR de retrait via `renderQr` actif seulement dans la fenêtre ; code court affiché | Réserver un R10, voir le QR à l'heure |
| 3.3 | Admin emprunts | `js/admin/views/emprunts.js`, `js/admin/scanModal.js` | Onglets En cours / Réservés / En retard / Historique ; actions Remettre (modale : saisie code6 ou caméra), Réceptionner (checklist complète), Refuser, Prolonger ; widget « À remettre aujourd'hui » branché | Scénario complet |
| 3.4 | Retards & blocage | `js/rules.js` (déjà), vues admin/mobile | Badge rouge partout, KPI retards, blocage réservation si `bloquerSiRetard` | Horloge démo +3 jours |
| 3.5 | Notifications mobile | `js/mobile/notifications.js`, `tests/notifications.test.mjs` | `computeNotifications(userId, db, now)` → liste dérivée (expirée, refusée, retard, retrait possible maintenant) | Test sur seed |

**Scénario :** réserver le Canon R10 pour demain 9h → horloge à demain 9h05 → admin *Remettre* avec le code → horloge à J+4 → retard visible → *Réceptionner* avec « Capteur propre » en Problème → objet en maintenance. Expiration : réserver le Zoom H5, horloge début + 1h01 → objet libre, badge « non retiré ».

---

## Phase 4 — Salle photo

**Prérequis :** `ui.toDate` doit parser `YYYY-MM-DD` en date locale (test épinglé sur `TZ=America/New_York`) et `store.transaction` doit différer la persistance et la notification.

| # | Tâche | Fichiers | Produit (interfaces) | Vérification |
|---|---|---|---|---|
| 4.1 | Actions salle | `js/actions/bookings.js`, `tests/actions-bookings.test.mjs` | `createBooking({ userId, date, creneaux })` (contiguïté, conflit, jour ouvré, 8-17h), `cancelBooking(id, auteurId)`, `recordEntry(id, checklist)` (→ `en_cours`), `recordExit(id, checklist)` (→ `terminee`), `roomChecklist()` (items `salle` + ligne globale) | Tests : conflit, non contigu, week-end, sortie |
| 4.2 | Mobile salle | `js/mobile/views/salle.js`, `js/mobile/weekGrid.js` | Grille semaine tactile, sélection contiguë, mes réservations, états des lieux | Réserver 8h-13h, refus pour un autre utilisateur |
| 4.3 | Admin planning | `js/admin/views/salle.js`, `js/admin/planning.js` | Planning lun-ven × 8h-17h, navigation semaine, détail, annulation, badge « sortie non faite » | Horloge fin + 1h01 sans sortie → badge |
| 4.4 | Liens catalogue | `js/mobile/views/fiche.js` | Objets `salle` : « Disponible dans la salle photo → Réserver la salle » | Visuel |

---

## Phase 5 — Maintenance & paramètres

**Reprises de la phase 3 :** extraction d’un `openScanModal({ title, hint, onCode })` réutilisable et pré-remplissage de la remise depuis la ligne ; recherche admin par code de retrait ; jeton d’identité des modales.

| # | Tâche | Fichiers | Produit (interfaces) | Vérification |
|---|---|---|---|---|
| 5.1 | Actions maintenance | `js/actions/maintenance.js`, `tests/actions-maintenance.test.mjs` | `reportIssue({ itemId, auteurId, description, loanId?, bookingId? })`, `createIntervention({ itemId, type, prestataire, cout, description, pedagoId })`, `closeEvent(id, pedagoId, { remettreEnService: true \| false })` (dernier événement ouvert clos → item `disponible` ou `hs`) | Tests : clôture remet disponible, choix HS |
| 5.2 | Admin maintenance | `js/admin/views/maintenance.js` | Liste par statut, création, clôture, vue matériel en maintenance/HS | Scénario |
| 5.3 | Admin paramètres | `js/admin/views/parametres.js` | Horaires, durée max, fenêtre, `bloquerSiRetard`, **horloge de démo** (date + heure, bouton « temps réel »), jauge `store.usage()`, **Réinitialiser** (confirmation) | Reset → seed propre |
| 5.4 | PWA légère | `manifest.json`, `assets/icon-192.png`, `assets/icon-512.png`, `<meta>` dans `mobile.html` | Ajout à l'écran d'accueil | Sur téléphone via HTTPS |

---

## Phase 6 — Déploiement test

| # | Tâche | Fichiers | Produit | Vérification |
|---|---|---|---|---|
| 6.1 | Scénarios de démo | `docs/scenarios-demo.md` | Pas-à-pas des 6 scénarios de phase + comptes de démo + astuces horloge | Relecture |
| 6.2 | Publication | `README.md`, dépôt GitHub, GitHub Pages (branche `main`, dossier racine) | URL HTTPS publique | Ouvrir l'URL, `npm test` documenté |
| 6.3 | Test terrain | `docs/notice-testeurs.md`, QR imprimés via `etiquettes.html` | Notice pour testeurs (URL, comptes, scénarios, comment ouvrir `admin.html` sur le téléphone) | Scan réel d'un QR imprimé sur un téléphone |

---

## Phase 2 produit (hors v1, pour mémoire)

`store.js` → Supabase (mêmes signatures), Supabase Auth dans `auth.js`, synchronisation multi-appareils, checklists éditables depuis Paramètres, notifications push.
