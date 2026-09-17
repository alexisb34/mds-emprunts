# MDS Emprunts — Spec de design du prototype

**Date :** 2026-09-17
**Statut :** validé en brainstorming, en attente de relecture avant plan d'action
**Auteur :** Alexis Bengel (avec Claude)

## 1. Contexte et objectifs

L'école (MDS) prête du matériel aux élèves et intervenants pour les cours. Les solutions actuelles ne permettent ni suivi ni maintenance efficaces :

- vol de matériel (on ne sait pas qui emprunte ni quand il rend) ;
- perte de matériel ;
- aucune traçabilité ;
- pas de maintenance interne, seulement des interventions ponctuelles d'un prestataire externe sur le matériel de valeur ;
- pas d'inventaire réel.

**Objectif du prototype :** démontrer, sans backend, un système complet d'emprunt, de retour, de réservation de salle et de maintenance, avec une interface admin desktop (pédagogie) et une interface mobile (emprunteurs), où chaque action est tracée.

### Décisions structurantes

| Décision | Choix |
|---|---|
| Niveau du prototype | Fonctionnel : HTML/CSS/JS vanilla, données en `localStorage`, aucune étape de build |
| Démo | Sur une seule machine (2 fenêtres) en v1 ; couche `store` isolée pour passer à Supabase en phase 2 |
| Architecture | Deux mini-applications (`admin.html`, `mobile.html`) avec routing par `#hash`, modules ES natifs |
| Identité | Nom **MDS Emprunts**, UI kit Figma « MDS — UI Kit — Prêt de matériel » (desktop), mobile dérivé des mêmes tokens |
| Langue | Interface 100 % français |
| Périmètre v1 | Tout : inventaire, self-service, matériel de valeur, salle photo, retards, historique, maintenance, utilisateurs, paramètres |

## 2. Utilisateurs et rôles

| Rôle | Droits |
|---|---|
| `eleve` | Emprunter (self-service, réservation valeur), réserver la salle photo, voir ses emprunts |
| `intervenant` | Identiques à `eleve` — le rôle sert uniquement à l'affichage et aux filtres admin |
| `pedago` | Interface admin : gestion du matériel, des utilisateurs, des emprunts, de la salle, de la maintenance, des paramètres |

Promos utilisées pour les élèves : MBA 2 UX/UI, MBA 2 DEV, MBA 2 DAD, Bachelor 1, Bachelor 2, Bachelor 3, MBA 1 UX/UI, MBA 1 DEV, MBA 1 DAD.

**Connexion (v1)** : page de login avec les comptes de démo en un clic, sans mot de passe. La couche `auth.js` est isolée pour brancher une authentification réelle en phase 2. Un sélecteur « Changer d'utilisateur » (clairement marqué démo) est disponible dans le profil mobile.

## 3. Matériel et circuits

Trois **circuits** déterminent le flux d'emprunt.

### 3.1 Self-service (`self`)
Multiprises · Kit tableau (stylos bleu/noir/vert/rouge, télécommande vidéoprojecteur, brosse) · Casque audio · Clavier · Souris.

Situés dans le bureau des pédago, ouvert **8h-12h et 13h-17h**. Emprunt par scan du QR collé sur l'objet, sans validation. Retour attendu le jour même avant 17h.

### 3.2 Matériel salle photo (`salle`)
Newer kit éclairage · Newer pack LED + batteries · Trépied et tête fluide LeoFoto · Mini studio photo produit · Sac à dos Beschoi.

Reste **dans la salle photo** en permanence. Accessible sans validation à toute personne ayant une réservation de la salle en cours. Jamais empruntable individuellement.

### 3.3 Matériel de valeur (`valeur`)
Canon R10 + objectif 18-55 + bague · DJI Ronin RSC2 · Tascam DR70 · Zoom H5 · Cartes SD 256 Go et 32 Go · Batteries Canon LP-E17 · Filtre variable Hoya · Casque Sennheiser · Kit de streaming Audio-Technica.

Stocké dans un lieu sécurisé. Réservation depuis le mobile, remise physique par une personne de la pédago. Même avec une réservation de salle, ce matériel passe par ce circuit.

### 3.4 Règle commune
**Un exemplaire maximum par référence et par personne** à la fois (emprunt en cours ou réservation active). Le scan ou la réservation d'un second exemplaire est refusé avec un message explicite.

## 4. Modèle de données

Toutes les entités ont un `id` (string unique), `createdAt`, `updatedAt`.

### `User`
`nom`, `prenom`, `email`, `role` (`eleve` | `intervenant` | `pedago`), `promo` (élèves uniquement), `actif` (bool).

### `Item` — un enregistrement par exemplaire physique
`code` (QR, format `MDS-0042`), `nom`, `categorie` (Bureautique, Audio, Photo, Vidéo, Lumière, Stockage, Accessoire…), `reference` (regroupe les exemplaires identiques, ex. `multiprise`), `circuit` (`self` | `salle` | `valeur`), `etat` (`disponible` | `emprunte` | `reserve` | `maintenance` | `hs`), `localisation`, `dateAchat`, `valeurEstimee`, `notes`, `photoUrl` (illustration catalogue).

### `Loan` — emprunt ou réservation
`itemId`, `userId`, `statut` (`reservee` | `en_cours` | `retournee` | `refusee` | `expiree` | `annulee`), `dateReservation`, `debutPrevu`, `finPrevue`, `dateRetrait`, `dateRetourReelle`, `remisPar` (userId pédago), `receptionnePar`, `motif`, `motifRefus`, `codeRetrait` (6 caractères, circuit valeur), `photoEmprunt` (base64 JPEG, self), `photoRetour` (base64 JPEG, self), `checklistRetour` (tableau `{ ligne, ok, commentaire }`), `commentaire`.

`en_retard` n'est **pas** un statut stocké : c'est un état dérivé (`statut === 'en_cours' && now > finPrevue`), calculé à chaque rendu.

### `RoomBooking` — réservation de la salle photo
`userId`, `date` (jour), `creneaux` (heures entières contiguës, ex. `[8, 9, 10, 11, 12]` pour 8h-13h), `statut` (`a_venir` | `en_cours` | `terminee` | `annulee`), `etatEntree` (`{ date, lignes: [{ ligne, ok, commentaire }] }` ou null), `etatSortie` (idem).

« Sortie non faite » est dérivé : `statut !== 'annulee' && now > fin du dernier créneau + 1h && !etatSortie`.

### `MaintenanceEvent`
`itemId`, `type` (`signalement` | `intervention_interne` | `intervention_externe` | `remise_en_service`), `auteurId`, `date`, `description`, `prestataire`, `cout`, `statut` (`ouvert` | `en_cours` | `clos`), `loanId` ou `bookingId` d'origine (optionnel).

### `LogEntry` — journal de traçabilité
`date`, `auteurId`, `action` (chaîne normalisée : `item.cree`, `loan.reservee`, `loan.remise`, `loan.retour`, `booking.entree`…), `itemId`, `loanId`, `bookingId`, `userId` (cible), `detail` (texte libre). **Chaque mutation métier écrit une entrée.**

### `Settings`
`horaires` (`[{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }]`), `dureeMaxReservationJours` (5), `fenetreRetraitMinutes` (60), `bloquerSiRetard` (bool), `horlogeDemo` (offset en ms ou date fixée, null = temps réel).

## 5. Règles métier

### 5.1 Self-service
- Retrait possible uniquement pendant les horaires d'ouverture ; **le retour est toujours possible**.
- Scan → capture photo obligatoire → confirmation → `Loan` `en_cours`, `Item` `emprunte`, `finPrevue` = aujourd'hui 17h.
- Re-scan d'un objet que l'utilisateur a en cours → flux de retour : photo → mini-checklist → `retournee`, `Item` `disponible`.
- Une ligne de checklist en « Problème » → `Item` passe `maintenance`, `MaintenanceEvent` `signalement` créé, lié au `Loan`.
- Refus : objet `maintenance`/`hs`, objet `emprunte` par quelqu'un d'autre, déjà un exemplaire de cette référence, bureau fermé (retrait), utilisateur bloqué pour retard (si `bloquerSiRetard`).

### 5.2 Matériel de valeur
- Réservation depuis la fiche objet : `debutPrevu`, `finPrevue` (≤ `dureeMaxReservationJours`), `motif`. L'`Item` passe `reserve` immédiatement ; d'autres utilisateurs ne peuvent plus le réserver sur la période.
- Il n'y a pas d'étape de validation séparée : **la validation est la remise physique**.
- Fenêtre de retrait : `[debutPrevu, debutPrevu + fenetreRetraitMinutes]`. Avant `debutPrevu`, le QR de retrait n'est pas actif. Après la fenêtre sans retrait → `expiree`, `Item` `disponible`, notification à l'emprunteur, badge « non retiré » côté admin.
- Remise : l'emprunteur affiche son QR de retrait (`LOAN-<id>-<code6>`) ; la pédago clique **Remettre** et scanne (ou saisit le code court) → `en_cours`, `dateRetrait`, `remisPar`.
- La pédago peut **Refuser** (motif obligatoire) une réservation avant remise, et **Prolonger** un emprunt en cours.
- Retour : la pédago clique **Réceptionner** → checklist complète de la référence → `retournee` ou `maintenance` + signalement.
- Un emprunt `en_cours` au-delà de `finPrevue` est affiché en retard partout (rouge) ; si `bloquerSiRetard`, l'utilisateur ne peut plus réserver de matériel valeur.

### 5.3 Salle photo
- Réservation libre (sans validation), créneaux d'1h de 8h à 17h, lundi à vendredi, créneaux contigus multiples. Un créneau réservé est bloqué pour les autres.
- La réservation vaut responsabilité du contenu de la salle (matériel circuit `salle`).
- **État des lieux d'entrée** proposé dès le début du créneau : checklist des items `salle` + ligne « Salle rangée, rien d'anormal ». Une ligne en problème à l'entrée → signalement, l'emprunteur n'est pas tenu responsable.
- **État des lieux de sortie** : même checklist ; `booking` → `terminee`. Absence de sortie 1h après la fin → « sortie non faite » visible côté admin.
- Annulation possible par l'emprunteur (avant le début) et par la pédago (à tout moment).

### 5.4 Maintenance
- Un signalement peut venir d'une checklist (self, valeur, salle) ou être créé manuellement par la pédago.
- La pédago crée des interventions (interne ou externe avec prestataire et coût), les fait passer `en_cours`, puis `clos`. Clore la dernière intervention ouverte d'un objet le remet `disponible` (ou la pédago choisit `hs`).
- `hs` = définitivement hors service ; l'objet reste dans l'inventaire (historique) mais est masqué du catalogue.

### 5.5 Temps
Toutes les règles temporelles (retard, expiration, sortie non faite, horaires) sont calculées à la volée à chaque rendu par `rules.js` à partir de `now()`, qui respecte `Settings.horlogeDemo`. Aucun timer ni cron.

## 6. Interface admin (desktop)

Basée sur l'UI kit Figma : sidebar violette 260 px, topbar 72 px, canvas `#f2f4f8`, cartes blanches ombrées, Inter + Bricolage Grotesque.

| Écran (`#/route`) | Contenu |
|---|---|
| `#/dashboard` | 4 KPI (matériel disponible, emprunts en cours, retards, réservations salle à venir) · widget **Retards** · widget **À remettre aujourd'hui** (réservations valeur avec bouton *Remettre* → scanner/code) · widget **Signalements ouverts** · flux « Dernières activités » (journal) |
| `#/materiel` | Table triable/filtrable (catégorie, circuit, état, recherche) · *Ajouter* (modale : nom, catégorie, référence, circuit, code QR auto, valeur, localisation) · sélection multiple → *Imprimer les QR* (page d'étiquettes) |
| `#/materiel/:id` | Fiche : infos éditables, changement d'état (disponible / maintenance / HS), QR imprimable, historique des emprunts (avec photos emprunt/retour) et des interventions |
| `#/emprunts` | Onglets *En cours / Réservés / En retard / Historique* · table (objet, emprunteur, dates, statut) · actions : *Remettre*, *Réceptionner* (checklist), *Refuser*, *Prolonger* |
| `#/salle` | Planning semaine (colonnes lun-ven, lignes 8h-17h), navigation semaine ±, réservations colorées · clic → détail avec états des lieux et badge « sortie non faite » · *Annuler* |
| `#/maintenance` | Liste des événements par statut · *Créer une intervention* · *Clôturer* · vue « Matériel en maintenance / HS » |
| `#/utilisateurs` | Table (nom, rôle, promo, emprunts en cours, retards) · ajouter / modifier / désactiver · `#/utilisateurs/:id` → historique complet de la personne |
| `#/parametres` | Horaires d'ouverture, durée max réservation, fenêtre de retrait, règle anti-retard, **horloge de démo**, compteur d'espace `localStorage`/photos, **Réinitialiser les données de démo** |

Recherche globale dans la topbar (objets, utilisateurs, emprunts). Modales et toasts conformes à la page *Modal & Feedback* du kit.

## 7. Interface mobile (emprunteurs)

Mêmes tokens, déclinés en mobile-first (largeur cible 360-430 px). Header simple, barre de navigation basse à 4 onglets (Accueil, Catalogue, Salle, Mes emprunts) et **bouton Scanner central** proéminent. Profil accessible depuis le header.

| Écran (`#/route`) | Contenu |
|---|---|
| `#/login` | Comptes de démo en un clic (regroupés par rôle) |
| `#/accueil` | Salutation · « Mes emprunts en cours » (retour attendu, badge retard) · « Ma prochaine réservation salle » avec bouton *État des lieux* si le créneau est en cours · notifications (expiration, refus, retard) |
| `#/catalogue` | Recherche + chips de catégorie · cartes objet (photo, nom, badge d'état, pastille circuit) |
| `#/catalogue/:id` | Fiche objet · bouton contextuel selon circuit : *Scanner pour emprunter* / *Réserver* / *Disponible dans la salle photo → Réserver la salle* |
| `#/reserver/:id` | Dates début/fin, motif, rappel « à retirer dans l'heure suivant le début » → *Confirmer* |
| `#/scan` | Plein écran caméra (`html5-qrcode`) + bouton **Simuler un scan** (liste déroulante des codes) · détection emprunt vs retour · **prise de photo** (caméra → canvas → JPEG 640 px) · confirmation ou mini-checklist · messages d'erreur explicites |
| `#/salle` | Grille semaine (jours en horizontal, heures en vertical) · sélection de créneaux contigus → *Réserver* · mes réservations · état des lieux entrée/sortie |
| `#/emprunts` | Onglets *En cours / Réservations / Historique* · réservation valeur active : **QR de retrait** + code court (actif seulement dans la fenêtre de retrait) · emprunt en cours : date, photo prise à l'emprunt |
| `#/profil` | Nom, rôle, promo · *Changer d'utilisateur* (démo) · déconnexion |

`manifest.json` (nom « MDS Emprunts », icône, `display: standalone`) pour l'ajout à l'écran d'accueil. Pas de service worker en v1.

## 8. Checklists de retour

Définies dans `checklists.js`, indexées par `reference`. Chaque ligne se coche **OK / Problème** avec commentaire optionnel.

**Self-service (mini-checklist mobile)**
- `multiprise` : câble intact · toutes les prises fonctionnent · interrupteur OK
- `kit-tableau` : 4 stylos (bleu, noir, vert, rouge) · télécommande vidéoprojecteur · brosse · boîte fermée
- `casque-audio` : son des deux côtés · câble/jack intact · mousses présentes
- `clavier` : toutes les touches · câble/récepteur USB présent
- `souris` : clic et molette OK · câble/récepteur USB présent

**Salle photo (état des lieux entrée = sortie)**
- `newer-eclairage` : 2 pieds, 2 softbox, 2 ampoules OK
- `newer-led` : panneau, batteries (nombre), chargeur
- `leofoto-trepied` : 3 sections, tête fluide, plateau rapide
- `mini-studio` : tente, fonds, éclairage intégré
- `sac-beschoi` : présent, fermetures OK
- Ligne globale : salle rangée, rien d'anormal (champ libre)

**Matériel de valeur (checklist complète admin)**
- `canon-r10` : boîtier · objectif 18-55 · bague · bouchons · batterie · carte SD retirée · capteur/objectif propres · allumage OK · nombre de déclenchements (optionnel)
- `dji-rsc2` : stabilisateur · plateau · vis/accessoires · batterie chargée · allumage et calibration OK · mallette
- `tascam-dr70`, `zoom-h5` : enregistreur · capsule/bonnette · câbles · piles/batterie · carte SD retirée · test d'enregistrement OK
- `sd-256`, `sd-32` : présente · vidée/formatée · verrou intact
- `lpe17` : présente · chargée · pas de gonflement
- `hoya-nd` : verre sans rayure · bague tourne · étui
- `sennheiser` : son · câble · mousses · étui
- `at-streaming` : micro · bras/pied · câble XLR/USB · interface · test audio OK

## 9. Architecture technique

```
mds-emprunts/
├── index.html              → accueil : choisir Admin (desktop) ou Mobile
├── admin.html              → coquille admin (sidebar + topbar + <main id="view">)
├── mobile.html             → coquille mobile (header + <main> + bottom nav)
├── kit.html                → page de démo des composants (vérification vs Figma)
├── tests.html              → assertions navigateur pour store/rules/models
├── manifest.json
├── css/
│   ├── tokens.css          → variables CSS issues des variables Figma
│   ├── base.css            → reset, typographie, polices
│   ├── components.css      → boutons, badges, cartes, tables, KPI, formulaires, modales, toasts
│   ├── admin.css           → layout sidebar/topbar, planning
│   └── mobile.css          → layout mobile, bottom nav, scanner, grille salle
├── js/
│   ├── store.js            → seule couche lisant/écrivant localStorage ; API get/put/query/subscribe
│   ├── seed.js             → données de démo
│   ├── models.js           → constantes (circuits, statuts, catégories), transitions autorisées
│   ├── rules.js            → now(), horaires, expiration, retard, sortie non faite, 1 exemplaire/personne
│   ├── checklists.js       → définitions des checklists par référence
│   ├── log.js              → écriture du journal
│   ├── auth.js             → utilisateur courant, changement d'utilisateur démo
│   ├── router.js           → routing #hash, montage des vues
│   ├── ui.js               → modale, toast, formatage dates, badges, génération QR
│   ├── scanner.js          → wrapper html5-qrcode, mode simulé, capture photo
│   ├── actions/            → items.js, loans.js, bookings.js, maintenance.js, users.js (mutations métier + journal)
│   ├── admin/views/        → dashboard.js, materiel.js, materielFiche.js, emprunts.js, salle.js,
│   │                         maintenance.js, utilisateurs.js, utilisateurFiche.js, parametres.js
│   └── mobile/views/       → login.js, accueil.js, catalogue.js, fiche.js, reserver.js, scan.js,
│                             salle.js, emprunts.js, profil.js
├── vendor/                 → html5-qrcode.min.js, qrcode.min.js (copies locales)
└── docs/
    ├── superpowers/specs/  → ce document
    ├── superpowers/plans/  → plan d'action
    └── scenarios-demo.md   → scénarios de démo / grille de test
```

### Principes
- **Aucun build, aucun npm.** Servir le dossier avec `python3 -m http.server 8000` (la caméra exige `localhost` ou HTTPS).
- **Modules ES natifs.** Une vue = `render(container, params)` qui produit du HTML par template literals, branche ses événements, et s'abonne au store.
- **`store.js`** : `store.<collection>.list(filter)`, `.get(id)`, `.create(data)`, `.update(id, patch)`, `.remove(id)` ; `store.subscribe(fn)` ; `store.reset()` (recharge le seed). Persistance sous une clé unique `mds-emprunts:v1`. L'événement `storage` du navigateur déclenche les abonnés → synchronisation en direct entre fenêtres. En phase 2, seul ce fichier change pour Supabase.
- **Mutations métier** dans `js/actions/` (un module par domaine : `items.js`, `loans.js`, `bookings.js`, `maintenance.js`, `users.js`) qui appliquent les règles, vérifient les transitions de `models.js`, et écrivent le journal — les vues n'écrivent jamais directement dans le store.
- **Photos** : `canvas` → JPEG 640 px → base64 dans le `Loan`. Budget `localStorage` ≈ 5 Mo (~50-80 photos). Le seed n'embarque aucune photo ; un compteur dans Paramètres avertit à 80 %.
- **QR** : `MDS-0042` pour les objets, `LOAN-<id>-<code6>` pour les retraits valeur.

### Données de démo (seed)
- **45 utilisateurs** : 30 élèves répartis sur les 9 promos, 10 intervenants, 5 pédago.
- Tout l'inventaire listé en §3, avec plusieurs exemplaires pour le self-service (ex. 6 multiprises, 4 kits tableau, 5 casques, 4 claviers, 4 souris) et les cartes SD/batteries (3 de chaque).
- Historique réaliste : ~40 emprunts passés, 6-8 en cours, 2 en retard, 2 réservations valeur à venir, 1 réservation salle en cours et 3 à venir, 1 objet en maintenance avec signalement ouvert, 1 intervention externe close, 1 objet HS.

## 10. Test sur téléphone réel

- **GitHub Pages** (HTTPS gratuit) pour distribuer une URL aux testeurs — voie recommandée.
- **Tunnel local** (`cloudflared tunnel --url http://localhost:8000`) pour tester une version en cours sans la publier.
- Les données sont locales à chaque appareil (limite `localStorage`). Pour tester la boucle élève ↔ pédago sur un téléphone, ouvrir `admin.html` dans un second onglet du même navigateur. La vraie multi-appareils est la phase 2.

## 11. Phases de livraison

| Phase | Livrable | Vérification |
|---|---|---|
| 0. Fondations | Arborescence, `tokens.css`, `base.css`, `components.css`, `kit.html`, `store.js`, `seed.js`, `models.js`, `rules.js`, `tests.html` | `kit.html` fidèle au Figma ; `tests.html` vert (CRUD, subscribe, propagation entre onglets, règles temporelles) |
| 1. Admin — inventaire & utilisateurs | Coquille admin, routing, dashboard (KPI + journal), matériel (table, ajout, fiche, QR), utilisateurs | Ajouter un objet, imprimer son QR, le passer HS, vérifier sa disparition des disponibles |
| 2. Mobile — self-service | Coquille mobile, login, catalogue, fiche, scanner (caméra + simulé), photo, emprunt/retour avec mini-checklist | Deux fenêtres : scan → photo → emprunt visible côté admin en direct → retour avec problème → signalement admin. Règles « bureau fermé » et « déjà un exemplaire » via l'horloge |
| 3. Matériel de valeur | Réservation mobile, QR de retrait, écran Emprunts admin (Remettre / Réceptionner / Refuser / Prolonger), checklist complète, expiration, retards | Réserver un R10 → remettre par scan → avancer l'horloge → retard → réceptionner avec problème → maintenance. Expiration : réserver, avancer 1h01, objet libre |
| 4. Salle photo | Grille mobile, planning admin, états des lieux, sortie non faite | Réserver 8h-13h, blocage pour un autre utilisateur, état des lieux, avancer l'horloge sans sortie → badge |
| 5. Maintenance & paramètres | Écran maintenance, paramètres, horloge, reset, compteur photos, `manifest.json` | Clôturer une intervention → objet disponible ; reset → seed ; ajout à l'écran d'accueil |
| 6. Déploiement test | GitHub Pages, `docs/scenarios-demo.md`, notice de test | URL ouverte sur un téléphone, scan réel d'un QR imprimé |

**Phase 2 (hors v1)** : `store.js` → Supabase, authentification réelle, multi-appareils, checklists éditables depuis Paramètres.

## 12. Hors périmètre v1

Notifications push/email, export PDF/Excel, multi-campus, statistiques avancées, impression d'étiquettes au-delà du QR simple, service worker/offline, gestion des mots de passe.
