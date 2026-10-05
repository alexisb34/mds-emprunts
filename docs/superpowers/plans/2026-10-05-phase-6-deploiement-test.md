# Phase 6 — Déploiement test : plan d’exécution

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** rendre le prototype testable par de vraies personnes sur leurs propres téléphones — solder la dette accumulée, puis fournir l’URL, les scénarios et la notice qui font qu’une séance de test produit des réponses plutôt que des questions.

**Architecture :** aucune nouvelle brique. Une passe de reprises sur la couche d’actions et deux écrans, puis des fichiers de documentation et le strict nécessaire pour qu’un service statique serve le dépôt tel quel depuis un sous-répertoire.

**Pile :** HTML/CSS/JS vanilla, modules ES natifs, `localStorage` derrière `js/store.js`, tests `node --test` (Node ≥ 22).

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §9 (architecture, transitions), §10 (test sur téléphone réel), §11 (phases), §12 (hors périmètre).

**Feuille de route :** `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`, Phase 6.

**Base :** `main` après l’étiquette `phase-5` (399 tests au vert dans `Europe/Paris` et `TZ=America/New_York`).

## Ce que cette phase ne fait pas

**Elle ne publie rien.** Créer le dépôt GitHub et activer Pages engage le compte d’une personne et met le prototype en ligne : c’est à Alexis de le faire, avec les commandes que la tâche 2 écrit dans le README. Aucune tâche de ce plan ne crée de dépôt distant, ne pousse quoi que ce soit, ni n’installe d’outil. Tout le reste — ce qui doit être vrai pour que la publication fonctionne du premier coup — est de notre ressort.

## Contraintes globales

- **Aucune dépendance npm, aucune étape de build.** Toute bibliothèque tierce est une copie locale dans `vendor/`.
- Tests : `node --test "tests/**/*.test.mjs"` (glob entre guillemets — `node --test tests/` ne fonctionne pas ici). Node ≥ 22. La suite doit passer aussi sous `TZ=America/New_York`.
- **Toute chaîne destinée à l’utilisateur est en français et utilise l’apostrophe typographique `’` (U+2019), jamais `'` (U+0027).** Les commentaires français aussi. Vérification : `grep -rn "[a-zA-Zàéèêçûô]'[a-zA-Zàéèêçûô]" js/ tests/ scripts/ --include='*.js' --include='*.mjs'` ne doit rien afficher. **Cela vaut aussi pour les fichiers Markdown de cette phase**, qui sont lus par des humains.
- **Tout chemin de ressource est relatif.** Servi depuis `https://<compte>.github.io/<dépôt>/`, un `/css/…` pointerait à la racine du domaine. Aucun `src="/…"` ni `href="/…"` dans les pages.
- Persistance uniquement via `js/store.js`. Les enregistrements sont gelés : on ne modifie que par `store.x.update(id, patch)`.
- **Aucun timer.** Le temps vient de `now()` (`js/rules.js`), piloté par l’horloge de démo.
- **Les identifiants créés ne sont pas ordonnés** (`genId` = horodatage + aléa) : aucun tri ne départage sur un identifiant.
- Couleurs : uniquement des variables de `css/tokens.css`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/actions/loans.js`, `js/actions/bookings.js` | Les changements de statut passent par un helper qui vérifie la table de transitions (spec §9). |
| `js/models.js` | `BOOKING_TRANSITIONS` retrouve une transition que le code pratiquait sans qu’elle soit déclarée. |
| `js/actions/maintenance.js` | `reportIssue` devient le seul chemin de création d’un signalement ; les trois sites de checklist l’appellent. |
| `.nojekyll` (nouveau) | GitHub Pages sert le dépôt tel quel, sans passer par Jekyll. |
| `index.html` | Page d’accueil du site publié : les quatre entrées, dont les étiquettes. |
| `docs/scenarios-demo.md` (nouveau) | Les six scénarios pas à pas, les comptes, les pièges d’horloge. |
| `docs/notice-testeurs.md` (nouveau) | Une page à donner à un testeur : URL, compte, ce qu’on lui demande de faire. |
| `README.md` | Section « Publier » avec les commandes exactes, et l’état d’avancement. |
| `tests/deploiement.test.mjs` (nouveau) | Épingle ce qui casserait la publication : un chemin absolu, un fichier référencé absent. |

---

### Task 1 : Reprises — transitions vérifiées et signalement unifié

**Fichiers :**
- Modifier : `js/actions/loans.js`, `js/actions/bookings.js`, `js/actions/maintenance.js`, `js/admin/views/maintenance.js`
- Test : `tests/actions-loans-valeur.test.mjs`, `tests/actions-bookings.test.mjs`, `tests/actions-maintenance.test.mjs`, `tests/admin-maintenance.test.mjs`

**Interfaces :**
- Produit : `setLoanStatus(loanId, statut, patch)` (`js/actions/loans.js`, interne), `setBookingStatus(id, statut, patch)` (`js/actions/bookings.js`, interne), `reportIssue` gagne les paramètres `immobiliser` et `date`.

Deux dettes nommées par les revues des phases 4 et 5.

**La spec §9 dit que la couche d’actions « vérifie les transitions de `models.js` ».** `ITEM_TRANSITIONS` est respectée (`applyItemState` appelle `assertTransition`), mais `LOAN_TRANSITIONS` et `BOOKING_TRANSITIONS` sont déclarées et mortes : les deux modules écrivent `statut` en direct, derrière des gardes écrites à la main. Arbitrage : **les tables deviennent un filet de sécurité, pas le message lu par l’utilisateur.** Les gardes spécifiques restent — elles disent « Cette réservation n’est plus en attente de remise. », là où la table ne saurait dire que « Transition emprunt interdite : en_cours → en_cours ». Chaque écriture de statut passe par un helper qui vérifie d’abord la table. Un chemin imprévu lève au lieu d’écrire une incohérence ; un chemin prévu ne change pas de message.

**`reportIssue` est le seul chemin de création d’un signalement.** Les trois sites de checklist recopiaient son corps — créer, immobiliser si disponible, journaliser — avec la liste des champs réécrite à chaque fois. Ajouter un champ à `MaintenanceEvent` en oubliait trois sur quatre.

- [ ] **Étape 1 : écrire les tests**

`tests/actions-loans-valeur.test.mjs` — ajouter à la fin :

```js
test('setLoanStatus : une transition absente de LOAN_TRANSITIONS lève avant d’écrire', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.RETOURNEE)[0];
  assert.ok(loan, 'le seed contient un emprunt rendu');
  // `retournee` est terminal : aucune action ne doit pouvoir le rouvrir.
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), /./);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RETOURNEE);
});

test('les messages des gardes métier priment sur celui de la table', () => {
  const rendu = store.loans.list((l) => l.statut === LOAN_STATES.RETOURNEE)[0];
  let message = '';
  try { receiveLoan({ loanId: rendu.id, pedagoId: PEDAGO }); } catch (e) { message = e.message; }
  assert.match(message, /n’est plus en cours/, 'la garde métier parle, pas la table');
  assert.doesNotMatch(message, /Transition/);
});
```

`tests/actions-bookings.test.mjs` — ajouter à la fin :

```js
test('setBookingStatus : une transition absente de BOOKING_TRANSITIONS lève avant d’écrire', () => {
  const b = createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [9] });
  cancelBooking(b.id, PEDAGO);
  assert.equal(store.bookings.get(b.id).statut, BOOKING_STATES.ANNULEE);
  // `annulee` est terminal : la garde métier refuse d’abord, et la table couvre le reste.
  assert.throws(() => cancelBooking(b.id, PEDAGO), /plus annulable/);
  assert.equal(store.bookings.get(b.id).statut, BOOKING_STATES.ANNULEE);
});
```

`tests/actions-maintenance.test.mjs` — ajouter à la fin :

```js
test('reportIssue : un seul chemin de création, même forme depuis les trois checklists', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const direct = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Signalé à la main' });
  const champs = Object.keys(direct).sort();
  // La forme de l’enregistrement ne doit dépendre ni de l’appelant ni du contexte.
  const depuisRetour = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Signalé au retour', loanId: 'loan_0001' });
  assert.deepEqual(Object.keys(depuisRetour).sort(), champs);
  assert.equal(depuisRetour.loanId, 'loan_0001');
  assert.equal(depuisRetour.bookingId, null);
});

test('reportIssue : `immobiliser: false` laisse l’état de l’objet à l’appelant', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Constaté pendant un retour', immobiliser: false });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE, 'le retour décidera lui-même');
  assert.equal(openEvents(item.id).length, 1);
});

test('reportIssue : `date` imposée, pour horodater comme l’action qui l’englobe', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const quand = new Date(2026, 8, 17, 15, 30);
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test', date: quand });
  assert.equal(ev.date, quand.toISOString());
});
```

- [ ] **Étape 2 : lancer les tests pour les voir échouer**

Run: `node --test tests/actions-maintenance.test.mjs`
Attendu : échec sur `immobiliser` et sur `date`, que `reportIssue` n’accepte pas encore.

- [ ] **Étape 3 : `reportIssue` accueille ses deux nouveaux paramètres**

`js/actions/maintenance.js` :

```js
/**
 * Crée un signalement. Seul chemin de création d’un `MaintenanceEvent` de type signalement :
 * les checklists de retour et les états des lieux passent par ici.
 * - `immobiliser: false` quand l’action englobante décide elle-même de l’état de l’objet
 *   (un retour, par exemple, le fait après avoir rendu l’exemplaire).
 * - `date` pour horodater comme l’action englobante plutôt qu’à l’instant de l’appel.
 */
export function reportIssue({ itemId, auteurId, description, loanId = null, bookingId = null, immobiliser: doitImmobiliser = true, date = null }) {
  const texte = cleanDescription(description);
  const cible = itemId || null;
  if (cible) requireItem(cible);
  const quand = date || now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId: cible, type: MAINT_TYPES.SIGNALEMENT, auteurId, date: quand.toISOString(),
      statut: MAINT_STATES.OUVERT, description: texte, prestataire: '', cout: 0,
      loanId, bookingId,
    });
    if (doitImmobiliser) immobiliser(cible);
    logAction({ auteurId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: cible, loanId, bookingId, detail: texte });
    return event;
  });
}
```

- [ ] **Étape 4 : les trois sites de checklist appellent `reportIssue`**

Dans `js/actions/loans.js`, `returnSelf` et `receiveLoan` contiennent chacun le même bloc : `store.maintenance.create({ … })` suivi d’un `logAction({ action: ACTIONS.MAINT_SIGNALEMENT, … })`. Remplacer les deux par un appel unique, **à l’intérieur de la transaction existante**, après l’écriture de l’état de l’objet :

```js
    const maintenance = reportIssue({
      itemId: item.id, auteurId: <l’auteur du site : userId pour returnSelf, pedagoId pour receiveLoan>,
      description: `Signalé ${<au retour|à la réception>} : ${detail}`,
      loanId, immobiliser: false, date,
    });
```

`immobiliser: false` parce que le retour vient déjà de décider de l’état par `resolveItemState`. La ligne d’import exacte à modifier dans `js/actions/loans.js` est

```js
import { resolveItemState } from './maintenance.js';
```

qui devient

```js
import { reportIssue, resolveItemState } from './maintenance.js';
```

et `js/actions/bookings.js`, qui n’importait rien de ce module, gagne `import { reportIssue } from './maintenance.js';` après son import de `./items.js`. Vérifier qu’aucun `store.maintenance.create` ne subsiste dans `js/actions/loans.js`.

Dans `js/actions/bookings.js`, `recordEtatDesLieux` crée un signalement **par ligne en problème** ; la boucle garde sa forme, son corps devient :

```js
    const events = lignesProblemes.map((ligne) => {
      const description = `Signalé à l’état des lieux ${libelleMoment} : ${ligne.ligne}${ligne.commentaire ? ` → ${ligne.commentaire}` : ''}`;
      return reportIssue({
        itemId: ligne.itemId || null, auteurId: userId, description,
        bookingId: booking.id, date,
      });
    });
```

Ici `immobiliser` reste à sa valeur par défaut : c’est bien le signalement qui immobilise l’objet de la salle. Le `logAction` et le `applyItemState` du corps actuel disparaissent — `reportIssue` les fait. Vérifier que le compte d’entrées de journal attendu par les tests existants ne change pas : un signalement produisait déjà une entrée `MAINT_SIGNALEMENT` et, le cas échéant, une entrée d’état d’objet.

- [ ] **Étape 5 : les helpers de transition**

`js/actions/loans.js`, à côté de `requireLoan` :

```js
// Spec §9 : la couche d’actions vérifie les transitions déclarées dans `models.js`.
// Les gardes métier en amont restent : elles donnent le message lisible, la table n’est
// qu’un filet pour un chemin imprévu.
function setLoanStatus(loanId, statut, patch = {}) {
  const loan = requireLoan(loanId);
  assertTransition(LOAN_TRANSITIONS, loan.statut, statut, 'emprunt');
  return store.loans.update(loanId, { statut, ...patch });
}
```

Importer `LOAN_TRANSITIONS` et `assertTransition` depuis `../models.js`. Remplacer les quatre écritures de statut (`returnSelf`, `handOver`, `receiveLoan`, `releaseReservation`) par `setLoanStatus(...)`, en conservant chaque `patch` tel quel. **`extendLoan` n’y touche pas** : il ne change que `finPrevue`.

`js/actions/bookings.js`, de même :

```js
function setBookingStatus(id, statut, patch = {}) {
  const booking = requireBooking(id);
  assertTransition(BOOKING_TRANSITIONS, booking.statut, statut, 'réservation');
  return store.bookings.update(id, { statut, ...patch });
}
```

Les quatre sites : `cancelBooking`, `recordEtatDesLieux`, `closeDueBookings`, `forceCloseBooking`. Attention à `recordEtatDesLieux`, dont le `patch` contient `etatEntree`/`etatSortie` en plus du statut.

- [ ] **Étape 6 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

Le pré-vol a déjà fait cette découverte une fois, et l’arbitrage est rendu : **`BOOKING_TRANSITIONS.a_venir` doit gagner `'terminee'`.** `closeDueBookings` clôt à son échéance un créneau que personne n’a ouvert, directement de `a_venir` à `terminee`, sans passer par `en_cours` ; c’est le comportement voulu et testé depuis la phase 4, mais la table ne le déclarait pas — faute d’être vérifiée, elle avait dérivé du vrai automate. Dans `js/models.js` :

```js
export const BOOKING_TRANSITIONS = {
  // `a_venir → terminee` : un créneau que personne n’a ouvert est clos à son échéance par
  // `closeDueBookings`, sans passer par `en_cours`. La table l’ignorait tant qu’elle n’était
  // pas vérifiée (spec §9).
  a_venir: ['en_cours', 'terminee', 'annulee'],
```

C’est la seule correction nécessaire : avec elle, les 399 tests passent dans les deux fuseaux.

Si **une autre** transition se met à échouer, c’est une découverte de même nature. **Ne pas élargir la table pour faire taire le test** — rapporter le chemin exact et attendre un arbitrage.

- [ ] **Étape 7 : commit**

```bash
git add js/models.js js/actions/loans.js js/actions/bookings.js js/actions/maintenance.js tests/
git commit -m "refactor(actions): transitions vérifiées et signalement unifié"
```

---

### Task 2 : Prêt à publier

**Fichiers :**
- Créer : `.nojekyll`, `tests/deploiement.test.mjs`
- Modifier : `index.html`, `README.md`
- Test : `tests/deploiement.test.mjs`

Le dépôt est déjà servable tel quel : toutes les références de ressources sont relatives (vérifié). Cette tâche épingle cette propriété par un test, pour qu’un `href="/css/…"` ajouté un jour ne soit pas découvert par un testeur devant un écran blanc, et écrit les commandes de publication.

**Pourquoi un test plutôt qu’une relecture :** servi depuis `https://<compte>.github.io/<dépôt>/`, un chemin absolu pointe à la racine du domaine, donc hors du site. Ça marche en local et casse une fois publié — exactement le genre de défaut qu’on découvre au pire moment.

- [ ] **Étape 1 : écrire le test**

`tests/deploiement.test.mjs` :

```js
// Épingle ce qui casserait la publication sous un sous-répertoire (GitHub Pages sert le
// dépôt depuis `/<nom-du-dépôt>/`, pas depuis la racine du domaine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const RACINE = new URL('../', import.meta.url);
const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
const lire = (f) => readFileSync(new URL(f, RACINE), 'utf8');

test('les pages du dépôt sont bien celles qu’on croit', () => {
  assert.deepEqual(pages.sort(), ['admin.html', 'etiquettes.html', 'index.html', 'kit.html', 'mobile.html']);
});

test('aucune page ne référence une ressource par un chemin absolu', () => {
  for (const page of pages) {
    const html = lire(page);
    const absolus = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(absolus, [], `${page} référence ${absolus.join(', ')} depuis la racine du domaine`);
  }
});

test('toute ressource locale référencée par une page existe', () => {
  for (const page of pages) {
    for (const [, href] of lire(page).matchAll(/(?:src|href)="([^"#:]+)"/g)) {
      if (href.startsWith('//') || href.startsWith('data:')) continue;
      assert.ok(existsSync(new URL(href, RACINE)), `${page} référence ${href}, qui n’existe pas`);
    }
  }
});

test('le manifeste reste relatif : il sera servi depuis un sous-répertoire', () => {
  const manifest = JSON.parse(lire('manifest.json'));
  for (const champ of ['start_url', 'scope', 'id']) {
    assert.ok(!String(manifest[champ]).startsWith('/'), `manifest.${champ} ne doit pas commencer par /`);
  }
  for (const icone of manifest.icons) {
    assert.ok(!icone.src.startsWith('/'), `icons[].src ne doit pas commencer par /`);
  }
});

test('.nojekyll existe : GitHub Pages sert le dépôt sans passer par Jekyll', () => {
  assert.ok(existsSync(new URL('.nojekyll', RACINE)));
});

test('la page d’accueil mène aux quatre interfaces', () => {
  const html = lire('index.html');
  for (const cible of ['admin.html', 'mobile.html', 'etiquettes.html', 'kit.html']) {
    assert.match(html, new RegExp(`href="${cible}"`), `index.html ne mène pas à ${cible}`);
  }
});
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

Run: `node --test tests/deploiement.test.mjs`
Attendu : deux échecs — `.nojekyll` absent, et `index.html` qui ne mène pas encore aux étiquettes.

- [ ] **Étape 3 : `.nojekyll`**

Créer un fichier vide à la racine :

```bash
touch .nojekyll
```

Jekyll ignore les dossiers commençant par `_` et réinterprète certains fichiers. Le dépôt n’en contient aucun aujourd’hui, mais ce fichier vide supprime une classe entière de surprises pour le prix d’un octet.

- [ ] **Étape 4 : `index.html` mène aux étiquettes**

Ajouter une quatrième entrée dans le `<nav class="links">`, avant celle du kit :

```html
      <a href="etiquettes.html"><strong class="label-lg">Étiquettes QR</strong><span class="body-sm">À imprimer et coller sur le matériel</span></a>
```

- [ ] **Étape 5 : la section « Publier » du README**

Ajouter avant « ## Documentation » :

```markdown
## Publier

Le prototype est un site statique : n’importe quel hébergement de fichiers le sert tel quel. Les chemins sont tous relatifs, donc un sous-répertoire convient.

**La caméra exige HTTPS.** Sans elle, le scan de QR et les photos retombent sur la saisie manuelle et une image de démonstration — utile en salle, insuffisant pour un vrai test terrain. `localhost` fait exception : en local, tout fonctionne.

Depuis ce dossier, une fois un dépôt GitHub créé :

```bash
git remote add origin https://github.com/<compte>/mds-emprunts.git
git push -u origin main
```

Puis, dans le dépôt : **Settings → Pages → Source : Deploy from a branch → `main` / `/ (root)`**. L’URL `https://<compte>.github.io/mds-emprunts/` répond au bout d’une minute ou deux.

Pour montrer une version en cours sans rien publier, un tunnel suffit :

```bash
cloudflared tunnel --url http://localhost:8000
```
```

(Attention en recopiant : le bloc ci-dessus contient lui-même des blocs de code. Dans le README, ce sont des blocs ```` ``` ```` ordinaires.)

- [ ] **Étape 6 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux.

- [ ] **Étape 7 : commit**

```bash
git add .nojekyll index.html README.md tests/deploiement.test.mjs
git commit -m "feat(deploiement): dépôt servable tel quel et commandes de publication"
```

---

### Task 3 : Scénarios de démonstration

**Fichiers :**
- Créer : `docs/scenarios-demo.md`
- Test : aucun (document)

Spec §11 : chaque phase a son scénario de vérification. Ce document les rassemble dans l’ordre où on les joue devant quelqu’un, avec les comptes et les réglages d’horloge. Il sert deux publics : Alexis qui fait une démonstration, et le contrôleur d’une phase ultérieure qui doit rejouer la boucle complète.

- [ ] **Étape 1 : écrire `docs/scenarios-demo.md`**

Le document comprend, dans cet ordre :

1. **Avant de commencer** — ouvrir `admin.html` et `mobile.html` dans deux fenêtres côte à côte ; sur le tableau de bord, régler l’horloge de démonstration sur un **jour ouvré à 9h** puis cliquer sur **Régénérer les données**. Rappeler que les deux interfaces partagent le `localStorage` du navigateur, donc qu’un même navigateur suffit, et qu’un onglet de navigation privée donne un second jeu indépendant.
2. **Les comptes** — un tableau de trois lignes : un élève, un intervenant, un membre de la pédagogie, avec le nom tel qu’il apparaît à l’écran de connexion. Prendre les noms réels du seed (les lire dans `js/seed.js`, ne pas les inventer). Préciser qu’il n’y a pas de mot de passe.
3. **Les six scénarios**, un par phase livrée, chacun en pas numérotés avec ce qu’on doit voir après chaque pas :
   - *Self-service* : scanner un QR → photo → emprunt visible côté admin en direct → retour avec un problème → signalement côté admin.
   - *Règles de refus* : horloge hors ouverture → refus avec le message citant les horaires réglés ; même objet déjà emprunté → refus « déjà un exemplaire ».
   - *Matériel de valeur* : réserver → l’objet devient indisponible → remettre par code → avancer l’horloge → retard → réceptionner avec un problème → maintenance. Puis l’expiration : réserver, avancer d’une heure et une minute, l’objet est libre.
   - *Salle photo* : réserver deux créneaux contigus → un autre compte est bloqué → état des lieux d’entrée → avancer l’horloge → état des lieux de sortie en signalant un objet → signalement et planning côté admin. Puis une sortie jamais faite → bandeau « Sorties non faites » → **Clore le créneau**.
   - *Maintenance* : démarrer une intervention → en créer une externe avec prestataire et coût → clore la première (l’objet reste immobilisé) → clore la dernière en remettant en service → l’objet revient au catalogue. Puis un signalement clos en **Hors service** → l’objet disparaît du catalogue mais reste à l’inventaire.
   - *Paramètres* : fermer le bureau à 11h → à 11h30 le mobile refuse avec un message citant **11h** → remettre 12h. Montrer la jauge d’espace.
4. **Pièges d’horloge** — après un grand saut dans le temps, régénérer les données ; le week-end, le bureau est fermé et la grille de la salle s’ouvre sur la semaine suivante ; l’horloge est partagée par les deux interfaces.
5. **Remettre à zéro** — *Paramètres → Régénérer les données*, ou vider le stockage du site.

Contraintes de rédaction : français, apostrophes typographiques, **pas de capture d’écran** (elles périment), et chaque pas dit ce qu’on doit **voir**, pas seulement ce qu’on doit cliquer. Vérifier chaque libellé de bouton cité dans le code plutôt que de le supposer : un pas-à-pas qui nomme un bouton inexistant est pire que pas de pas-à-pas.

- [ ] **Étape 2 : relire en jouant le scénario 1**

Suivre les pas du premier scénario dans le navigateur, bouton par bouton, et corriger tout libellé inexact. Les cinq autres scénarios ont été joués lors des vérifications de phase ; celui-ci est le plus souvent rejoué, il doit être exact au mot près.

- [ ] **Étape 3 : commit**

```bash
git add docs/scenarios-demo.md
git commit -m "docs: scénarios de démonstration pas à pas"
```

---

### Task 4 : Notice pour les testeurs et étiquettes

**Fichiers :**
- Créer : `docs/notice-testeurs.md`
- Modifier : `etiquettes.html` (consigne d’impression)
- Test : aucun (document)

Spec §10 et feuille de route 6.3. La notice est la page qu’on tend à quelqu’un qui va tester dix minutes : elle ne décrit pas le produit, elle dit quoi faire et quoi signaler.

- [ ] **Étape 1 : écrire `docs/notice-testeurs.md`**

Une page, pas plus, comprenant :

- **Ce que vous testez** : deux phrases. Un prototype d’emprunt de matériel ; rien n’est réel, aucune donnée n’est envoyée nulle part, tout vit dans le navigateur du téléphone.
- **Comment y accéder** : l’URL (laisser `https://<compte>.github.io/mds-emprunts/` en clair, à remplacer au moment de la distribution), puis « Ajouter à l’écran d’accueil » pour l’ouvrir comme une application.
- **Votre compte** : choisir n’importe quel nom dans la liste, sans mot de passe. Préciser que chaque téléphone a ses propres données : deux testeurs ne se voient pas l’un l’autre.
- **Ce qu’on vous demande de faire** : trois parcours courts, en une ligne chacun — emprunter un objet en self-service avec le QR d’une étiquette, réserver un créneau de salle photo, réserver un objet de valeur. Pour chacun, la question à laquelle on veut une réponse (« avez-vous su quoi faire sans explication ? »).
- **Ce qu’on veut savoir** : trois questions ouvertes, courtes.
- **Si ça coince** : la caméra demande une autorisation ; sans caméra, l’écran Scanner propose une saisie ; pour repartir de zéro, *Paramètres* côté admin ou vider les données du site.
- **Pour la pédagogie** : `admin.html` s’ouvre dans le navigateur du téléphone, en ajoutant `admin.html` à l’URL.

Contraintes : français, apostrophes typographiques, vouvoiement, pas de jargon (« QR code » oui, « localStorage » non), et aucune promesse que le prototype ne tient pas.

- [ ] **Étape 2 : consigne d’impression sur `etiquettes.html`**

La page imprime les étiquettes mais ne dit pas comment s’en servir. Ajouter sous le titre, dans la barre d’outils, une ligne discrète :

```html
    <p class="body-sm text-secondary">Imprimer à 100 % (sans « ajuster à la page »), puis coller une étiquette par exemplaire. Les codes correspondent au matériel du jeu de démonstration : après une régénération des données, réimprimer.</p>
```

Vérifier la classe utilisée contre `css/base.css` avant de la poser, et que l’ajout ne sort pas dans l’impression si la feuille masque la barre d’outils — si elle la masque, la consigne doit rester à l’écran, c’est l’intention.

- [ ] **Étape 3 : commit**

```bash
git add docs/notice-testeurs.md etiquettes.html
git commit -m "docs: notice pour les testeurs et consigne d’impression des étiquettes"
```

---

### Task 5 : Vérification de fin de phase

**Fichiers :**
- Modifier : `README.md`, `docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md`

- [ ] **Étape 1 : suite complète et greps**

Run: `npm test` puis `TZ=America/New_York npm test` → 0 échec.
Run: `grep -rn "[a-zA-Zàéèêçûô]'[a-zA-Zàéèêçûô]" js/ tests/ scripts/ docs/*.md *.md --include='*' ` → rien (les documents de cette phase comptent).
Run: `grep -nE "#[0-9a-f]{3,6}|rgba\(" css/admin.css css/mobile.css` → rien.
Run: `grep -rn "LOAN_TRANSITIONS\|BOOKING_TRANSITIONS" js/` → les deux tables ont désormais un lecteur.

- [ ] **Étape 2 : vérification navigateur** (contrôleur)

Servir le dépôt depuis un sous-répertoire pour reproduire les conditions de GitHub Pages, et vérifier qu’aucune ressource ne manque :

```bash
mkdir -p /tmp/pages/mds-emprunts && cp -R . /tmp/pages/mds-emprunts && (cd /tmp/pages && python3 -m http.server 8001)
```

Ouvrir `http://localhost:8001/mds-emprunts/`, suivre les quatre liens, et vérifier dans l’onglet réseau qu’aucune requête ne part vers la racine du domaine. Jouer le premier scénario de `docs/scenarios-demo.md` pour s’assurer que le pas-à-pas correspond à l’écran.

- [ ] **Étape 3 : README et feuille de route**

`README.md` : cocher `- [x] Phase 6 — Déploiement test`. Feuille de route : ligne Phase 6 du tableau → `` `2026-10-05-phase-6-deploiement-test.md` (exécuté) ``, et la même mention sous le titre `## Phase 6`.

- [ ] **Étape 4 : commit**

```bash
git add README.md docs/superpowers/plans/2026-09-17-mds-emprunts-roadmap.md
git commit -m "docs: phase 6 terminée"
```

L’étiquette `phase-6` est posée par le contrôleur après la fusion dans `main`.

- [ ] **Étape 5 : la main revient à Alexis.** La publication est la seule étape que ce plan ne fait pas : créer le dépôt GitHub, pousser, activer Pages. Les commandes sont dans le README, et le prototype est prêt à être servi tel quel.

---

## Reprises volontairement laissées de côté

| Reprise | Pourquoi pas maintenant |
|---|---|
| `sidebarCounts` vit dans `js/admin/app.js`, qui touche le DOM à l’import et ne se charge pas sous Node | Trois lignes sans risque, mais les déplacer sans déplacer aussi le reste du câblage de `app.js` ne ferait que répartir le problème. À traiter le jour où `app.js` sera découpé. |
| L’instantané complet de `store.transaction` à chaque écriture | Correction achetée à un coût qui croît avec les photos. La jauge de l’écran Paramètres rend ce coût visible : on y reviendra si un testeur le remarque, pas avant. |
| L’écriture concurrente entre onglets (dernier arrivé gagne) | Architectural, documenté au README depuis la phase 4. La contrainte appartient au serveur de la phase 2, pas à `localStorage`. |
| Le piège asynchrone d’`openScanModal` (une modale refermée puis rouverte pendant que `hasCamera()` se résout) | Le compteur de génération du scanner neutralise déjà les lectures périmées ; la correction propre demande un jeton exposé par `openModal`. |
| Icône `maskable`, piège de focus et touche Échap sur les modales | Finition d’interface, à faire avec un vrai retour de testeurs plutôt qu’à l’aveugle. |
| Le gestionnaire de « Signaler une panne » non testé | Même famille que les autres gestionnaires de modale ; à prendre avec un harnais DOM, pas à l’unité. |
| Le nettoyage paresseux de `heureRetourSelf` | Suffisant : avec les horaires par défaut la valeur figée égale la valeur dérivée, et changer les horaires passe justement par `updateSettings`. |

## Relecture du plan

- **Couverture.** Feuille de route 6.1 → tâche 3 ; 6.2 → tâche 2 (tout sauf l’acte de publier, qui revient à Alexis) ; 6.3 → tâche 4. Spec §9 (transitions vérifiées) et la dette de duplication de `reportIssue` → tâche 1. Spec §10 (tunnel, deuxième onglet, données locales à l’appareil) → README et notice.
- **Pas de réservé-à-plus-tard.** Les deux tâches documentaires décrivent leur contenu section par section plutôt que de livrer le texte final : un pas-à-pas doit être écrit en regardant l’écran, et un plan qui le figerait d’avance produirait des libellés faux. Les contraintes de rédaction et la vérification qui les contrôle sont, elles, explicites.
- **Pré-vol.** Le code des tâches 1 et 2 a été extrait dans une copie jetable du dépôt à l’étiquette `phase-5` et exécuté : **405 tests au vert dans `Europe/Paris` et dans `TZ=America/New_York`**, et le test de déploiement échoue bien sur les deux points annoncés avant que `.nojekyll` et le lien des étiquettes n’existent. Le pré-vol a trouvé trois choses : la ligne d’import de `loans.js` que le plan citait de travers, l’import manquant dans `bookings.js`, et surtout une transition que le code pratique depuis la phase 4 sans que la table la déclare (`a_venir → terminee`). Cette dernière est exactement ce que vérifier les transitions devait révéler — le plan porte désormais l’arbitrage.
