# Réservation du matériel de valeur par créneaux : plan d’exécution

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**But :** réserver un appareil pour novembre ne doit plus le rendre indisponible aujourd’hui. La disponibilité se calcule sur une période, à la demi-journée, pour sept jours au plus.

**Architecture :** la règle de conflit de la salle photo, transposée au matériel de valeur — mais sur des intervalles datés plutôt que sur des heures d’une journée. L’état `reserve` d’un objet disparaît : il n’exprimait qu’un raccourci, et c’est lui le défaut.

**Pile :** HTML/CSS/JS vanilla, modules ES natifs, `localStorage` derrière `js/store.js`, tests `node --test` (Node ≥ 22).

**Spec :** `docs/superpowers/specs/2026-09-17-mds-emprunts-design.md` — §4 (modèle), §5.2 (matériel de valeur, amendée le 6 octobre), §7 (écran `#/reserver/:reference`).

**Base :** `main` après l’étiquette `phase-6` (429 tests au vert dans `Europe/Paris` et `TZ=America/New_York`).

## Le défaut que ce plan corrige

`reserveValeur` écrivait `applyItemState(itemId, RESERVE)`. L’objet devenait indisponible pour tout le monde, sans date de fin, dès la réservation enregistrée. Paul réserve une carte SD trois jours en novembre : la carte est bloquée en octobre. Le jeu de données contient trois références à trois exemplaires — `sd-256`, `sd-32`, `lpe17` — où le défaut se voit immédiatement.

La spec disait pourtant « d’autres utilisateurs ne peuvent plus le réserver **sur la période** ». Elle disait aussi « l’`Item` passe `reserve` immédiatement ». Les deux phrases étaient incompatibles ; l’implémentation a suivi la seconde.

## Contraintes globales

- **Aucune dépendance npm, aucune étape de build.** Node ≥ 22.
- Tests : `node --test "tests/**/*.test.mjs"` (glob entre guillemets). La suite doit passer aussi sous `TZ=America/New_York`.
- **Toute chaîne destinée à l’utilisateur est en français et utilise l’apostrophe typographique `’` (U+2019), jamais `'`.** Vérification : `grep -rn "[a-zA-Zàéèêçûô]'[a-zA-Zàéèêçûô]" js/ tests/ scripts/ --include='*.js' --include='*.mjs'` ne doit rien afficher.
- Persistance uniquement via `js/store.js` ; enregistrements gelés, modification par `store.x.update(id, patch)`. Écritures liées dans une seule `store.transaction`.
- **Aucun timer.** Le temps vient de `now()` (`js/rules.js`), piloté par l’horloge de démo.
- **Les identifiants créés ne sont pas ordonnés** : aucun tri ne départage sur un identifiant.
- Séparation pur/DOM : `xxxHtml(data)` pure et testée sous Node ; `xxxView(container)` rend une fonction de nettoyage.
- Les horaires réglés sont la seule source de vérité : rien ne fige « 8h-12h » ni « 5 jours ».
- Couleurs : uniquement des variables de `css/tokens.css`.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/rules.js` | Demi-journées déduites des horaires, occupation d’un exemplaire sur un intervalle, exemplaires libres, `canReserveValeur` réécrite. |
| `js/models.js` | L’état `reserve` quitte `ITEM_STATES`, ses transitions et ses libellés. |
| `js/actions/loans.js` | `reserveValeur` prend une référence, attribue un exemplaire libre, n’écrit plus d’état. |
| `js/mobile/views/reserver.js` | Date + demi-journée au retrait et au retour, réponse immédiate sur la période. |
| `js/mobile/catalog.js`, `js/mobile/views/fiche.js` | Le catalogue dit ce qui est physiquement là ; la fiche mène à `#/reserver/<reference>`. |
| `js/seed.js` | Les deux réservations à venir n’écrivent plus d’état d’objet. |

---

### Task 1 : Le domaine — règles, modèle et actions

Cette tâche est indivisible. Le pré-vol a essayé de la couper en deux (règles, puis actions) : `js/actions/loans.js` appelle `canReserveValeur`, donc changer l’une sans l’autre laisse la suite rouge, et le projet n’a jamais eu de commit rouge. Les trois fichiers changent ensemble.

**Fichiers :**
- Modifier : `js/rules.js`, `js/models.js`, `js/ui.js`, `js/actions/loans.js`, `js/actions/maintenance.js`
- Test : `tests/rules.test.mjs`, `tests/actions-loans-valeur.test.mjs`, `tests/handover-modal.test.mjs`, `tests/actions-items.test.mjs`, `tests/models.test.mjs`

**Interfaces :**
- Produit : `MOMENTS`, `halfDays(settings)`, `halfDayBounds(jour, moment, settings)`, `occupiesWindow(loan, debut, fin, date)`, `freeExemplaires({ items, loans, reference, debut, fin, date, ignoreLoanId })`, `canReserveValeur` réécrite.

- [ ] **Étape 1 : écrire les tests**

`tests/rules.test.mjs` — ajouter `MOMENTS`, `halfDays`, `halfDayBounds`, `occupiesWindow`, `freeExemplaires` à l’import groupé depuis `../js/rules.js`, puis à la fin du fichier :

```js
const ITEMS_SD = [
  { id: 'i1', reference: 'sd-256', circuit: 'valeur', etat: 'disponible' },
  { id: 'i2', reference: 'sd-256', circuit: 'valeur', etat: 'disponible' },
  { id: 'i3', reference: 'sd-256', circuit: 'valeur', etat: 'maintenance' },
];
// Par défaut la réservation est celle de quelqu’un d’autre : c’est le cas qui nous occupe.
// Une réservation à soi déclencherait « déjà un exemplaire », qui passe avant dans l’ordre des refus.
const resa = (itemId, debut, fin, statut = 'reservee', userId = 'autre') => ({
  id: `l-${itemId}-${debut}`, itemId, userId, statut,
  debutPrevu: new Date(debut).toISOString(), finPrevue: new Date(fin).toISOString(),
});

test('halfDays : les deux demi-journées viennent des horaires réglés', () => {
  assert.deepEqual(halfDays(DEFAULT_SETTINGS), {
    matin: { debut: 8, fin: 12 },
    apres_midi: { debut: 13, fin: 17 },
  });
  // Horaires modifiés : les demi-journées suivent.
  assert.deepEqual(halfDays({ horaires: [{ debut: 9, fin: 11 }, { debut: 14, fin: 18 }] }), {
    matin: { debut: 9, fin: 11 },
    apres_midi: { debut: 14, fin: 18 },
  });
  // Une seule plage : l’après-midi est sa seconde moitié, pour que « demi-journée » garde un sens.
  assert.deepEqual(halfDays({ horaires: [{ debut: 8, fin: 16 }] }), {
    matin: { debut: 8, fin: 12 },
    apres_midi: { debut: 12, fin: 16 },
  });
  // Réglages absents ou cassés : les horaires par défaut, via `openHours`.
  assert.deepEqual(halfDays(null), { matin: { debut: 8, fin: 12 }, apres_midi: { debut: 13, fin: 17 } });
});

test('halfDayBounds : des dates locales, pas UTC', () => {
  const matin = halfDayBounds('2026-11-03', MOMENTS.MATIN, DEFAULT_SETTINGS);
  assert.equal(matin.debut.getHours(), 8);
  assert.equal(matin.fin.getHours(), 12);
  assert.equal(matin.debut.getDate(), 3, 'le jour ne glisse pas selon le fuseau');
  const aprem = halfDayBounds('2026-11-03', MOMENTS.APRES_MIDI, DEFAULT_SETTINGS);
  assert.equal(aprem.debut.getHours(), 13);
  assert.equal(aprem.fin.getHours(), 17);
});

test('occupiesWindow : chevauchement, bornes jointives, statuts qui ne comptent pas', () => {
  const MAINTENANT = new Date(2026, 10, 1, 10, 0);
  const l = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const entre = (d, f) => occupiesWindow(l, new Date(d), new Date(f), MAINTENANT);
  assert.equal(entre('2026-11-04T08:00', '2026-11-04T12:00'), true, 'à l’intérieur');
  assert.equal(entre('2026-11-02T08:00', '2026-11-03T12:00'), true, 'déborde au début');
  assert.equal(entre('2026-11-05T13:00', '2026-11-06T17:00'), true, 'déborde à la fin');
  // Bornes jointives : la réservation finit quand l’autre commence, pas de conflit.
  assert.equal(entre('2026-11-05T17:00', '2026-11-06T17:00'), false);
  assert.equal(entre('2026-11-01T08:00', '2026-11-03T08:00'), false);
  // Loin devant, loin derrière.
  assert.equal(entre('2026-12-01T08:00', '2026-12-02T17:00'), false);
  // Un statut clos n’occupe rien.
  for (const statut of ['retournee', 'refusee', 'expiree', 'annulee']) {
    assert.equal(occupiesWindow({ ...l, statut }, new Date('2026-11-04T08:00'), new Date('2026-11-04T12:00'), MAINTENANT), false, statut);
  }
});

test('occupiesWindow : un emprunt en retard occupe tout l’avenir', () => {
  // Sorti, devait rentrer hier, toujours dehors : aucune période future n’est libre.
  const enRetard = resa('i1', '2026-10-20T08:00', '2026-10-30T17:00', 'en_cours');
  const apres = new Date(2026, 10, 1, 10, 0); // 1er novembre
  assert.equal(occupiesWindow(enRetard, new Date('2026-11-03T08:00'), new Date('2026-11-03T12:00'), apres), true);
  assert.equal(occupiesWindow(enRetard, new Date('2027-01-05T08:00'), new Date('2027-01-05T12:00'), apres), true);
  // À l’heure, il n’occupe que sa période.
  const aLHeure = resa('i1', '2026-10-20T08:00', '2026-11-30T17:00', 'en_cours');
  const pendant = new Date(2026, 10, 1, 10, 0);
  assert.equal(occupiesWindow(aLHeure, new Date('2026-12-01T08:00'), new Date('2026-12-02T17:00'), pendant), false);
});

test('freeExemplaires : c’est le cœur du correctif', () => {
  const MAINTENANT = new Date(2026, 9, 6, 10, 0); // 6 octobre
  const novembre = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const libre = (d, f) => freeExemplaires({
    items: ITEMS_SD, loans: [novembre], reference: 'sd-256',
    debut: new Date(d), fin: new Date(f), date: MAINTENANT,
  }).map((i) => i.id);
  // Le défaut signalé : une réservation en novembre ne bloque pas octobre.
  assert.deepEqual(libre('2026-10-08T08:00', '2026-10-08T12:00'), ['i1', 'i2']);
  // Sur la période réservée, l’exemplaire pris sort, l’autre reste.
  assert.deepEqual(libre('2026-11-04T08:00', '2026-11-04T12:00'), ['i2']);
  // Un objet en maintenance n’est jamais libre, quelle que soit la période.
  assert.ok(!libre('2026-12-01T08:00', '2026-12-01T12:00').includes('i3'));
  // Les deux exemplaires pris : complet.
  const deux = [novembre, resa('i2', '2026-11-03T08:00', '2026-11-05T17:00')];
  assert.deepEqual(freeExemplaires({
    items: ITEMS_SD, loans: deux, reference: 'sd-256',
    debut: new Date('2026-11-04T08:00'), fin: new Date('2026-11-04T12:00'), date: MAINTENANT,
  }), []);
});

test('freeExemplaires : `ignoreLoanId` laisse une réservation ne pas se gêner elle-même', () => {
  const MAINTENANT = new Date(2026, 9, 6, 10, 0);
  const sienne = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const ids = freeExemplaires({
    items: ITEMS_SD, loans: [sienne], reference: 'sd-256',
    debut: new Date('2026-11-04T08:00'), fin: new Date('2026-11-04T12:00'),
    date: MAINTENANT, ignoreLoanId: sienne.id,
  }).map((i) => i.id);
  assert.deepEqual(ids, ['i1', 'i2']);
});

test('canReserveValeur : durée maximale de sept jours, bornes comprises', () => {
  const ctx = (debut, fin) => ({
    reference: 'sd-256', user: { id: 'u1', actif: true }, loans: [], items: ITEMS_SD,
    settings: DEFAULT_SETTINGS, debutPrevu: new Date(debut), finPrevue: new Date(fin),
    date: new Date(2026, 9, 6, 10, 0),
  });
  assert.equal(canReserveValeur(ctx('2026-11-03T08:00', '2026-11-09T17:00')).ok, true, 'sept jours pile');
  const trop = canReserveValeur(ctx('2026-11-03T08:00', '2026-11-10T17:00'));
  assert.equal(trop.ok, false);
  assert.equal(trop.reason, REASONS.DUREE_TROP_LONGUE);
  // Une demi-journée : le minimum, accepté.
  assert.equal(canReserveValeur(ctx('2026-11-03T08:00', '2026-11-03T12:00')).ok, true);
  // Fin avant début.
  assert.equal(canReserveValeur(ctx('2026-11-05T08:00', '2026-11-03T12:00')).reason, REASONS.DATES_INCOHERENTES);
});

test('canReserveValeur : la référence doit être du circuit valeur', () => {
  // Le passage de l’exemplaire à la référence ne doit pas perdre cette garde.
  const commun = {
    user: { id: 'u1', actif: true }, loans: [], settings: DEFAULT_SETTINGS,
    debutPrevu: new Date('2026-11-03T08:00'), finPrevue: new Date('2026-11-03T12:00'),
    date: new Date(2026, 9, 6, 10, 0),
  };
  const selfService = [{ id: 's1', reference: 'multiprise', circuit: 'self', etat: 'disponible' }];
  assert.equal(canReserveValeur({ ...commun, reference: 'multiprise', items: selfService }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...commun, reference: 'inexistante', items: ITEMS_SD }).reason, REASONS.CODE_INCONNU);
  assert.equal(canReserveValeur({ ...commun, reference: 'sd-256', items: ITEMS_SD }).ok, true);
});

test('canReserveValeur : refuse quand aucun exemplaire n’est libre sur la période', () => {
  const pris = [
    resa('i1', '2026-11-03T08:00', '2026-11-05T17:00'),
    resa('i2', '2026-11-03T08:00', '2026-11-05T17:00'),
  ];
  const verdict = canReserveValeur({
    reference: 'sd-256', user: { id: 'u1', actif: true }, loans: pris, items: ITEMS_SD,
    settings: DEFAULT_SETTINGS, debutPrevu: new Date('2026-11-04T08:00'),
    finPrevue: new Date('2026-11-04T12:00'), date: new Date(2026, 9, 6, 10, 0),
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, REASONS.COMPLET_SUR_LA_PERIODE);
});
```

- [ ] **Étape 2 : lancer les tests pour les voir échouer**

Run: `node --test tests/rules.test.mjs`
Attendu : échec d’import (`halfDays`, `MOMENTS`… n’existent pas), puis des échecs d’assertion.

- [ ] **Étape 3 : `js/rules.js`**

D’abord le défaut que la spec vient de changer, dans `DEFAULT_SETTINGS` :

```js
  dureeMaxReservationJours: 7, // une semaine complète, bornes comprises (spec §5.2)
```

Puis le motif de refus dans `REASONS` et son libellé dans `REASON_LABELS`, à côté des autres :

```js
  COMPLET_SUR_LA_PERIODE: 'complet_sur_la_periode',
```

```js
  complet_sur_la_periode: 'Aucun exemplaire n’est libre sur cette période.',
```

Puis, après `openHours` :

```js
export const MOMENTS = { MATIN: 'matin', APRES_MIDI: 'apres_midi' };

// Les deux demi-journées se déduisent des horaires réglés : matin = première plage,
// après-midi = seconde. Avec une seule plage, l’après-midi en est la seconde moitié —
// « demi-journée » doit garder un sens même si la pédago range tout en une plage.
export function halfDays(settings) {
  const plages = openHours(settings);
  const matin = plages[0];
  if (plages.length > 1) return { matin: { ...matin }, apres_midi: { ...plages[plages.length - 1] } };
  const milieu = (matin.debut + matin.fin) / 2;
  return { matin: { debut: matin.debut, fin: milieu }, apres_midi: { debut: milieu, fin: matin.fin } };
}

// Les bornes d’une demi-journée, en heure LOCALE : `fromYmd` lit une date seule sans
// glisser d’un jour selon le fuseau.
export function halfDayBounds(jour, moment, settings) {
  const plage = halfDays(settings)[moment === MOMENTS.APRES_MIDI ? 'apres_midi' : 'matin'];
  return { debut: fromYmd(jour, plage.debut), fin: fromYmd(jour, plage.fin) };
}

const OCCUPANTS = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

// Un emprunt occupe-t-il son exemplaire sur [debut, fin[ ? Les bornes sont jointives :
// une réservation qui finit à 17h n’empêche pas celle qui commence à 17h.
// Un emprunt en retard occupe tout l’avenir : l’objet est dehors, et nul ne sait quand il rentre.
export function occupiesWindow(loan, debut, fin, date) {
  if (!OCCUPANTS.includes(loan.statut)) return false;
  const lDebut = toDate(loan.debutPrevu);
  const lFin = toDate(loan.finPrevue);
  if (loan.statut === LOAN_STATES.EN_COURS && toDate(date) > lFin) return toDate(fin) > toDate(date);
  return lDebut < toDate(fin) && toDate(debut) < lFin;
}

// Les exemplaires d’une référence réellement disponibles sur une période. C’est ici que se
// joue la correction : un objet réservé en novembre reste libre pour octobre.
export function freeExemplaires({ items, loans, reference, debut, fin, date, ignoreLoanId = null }) {
  const presents = items.filter((i) => i.reference === reference
    && i.etat !== ITEM_STATES.MAINTENANCE && i.etat !== ITEM_STATES.HS);
  return presents.filter((item) => !loans.some((l) => l.itemId === item.id
    && l.id !== ignoreLoanId
    && occupiesWindow(l, debut, fin, date)));
}
```

`canReserveValeur` est réécrite : elle raisonne sur une **référence** et une période, plus sur un exemplaire et un état.

```js
export function canReserveValeur(ctx) {
  const { reference, user, loans, items, settings, debutPrevu, finPrevue, date, ignoreLoanId = null } = ctx;
  const S = withDefaults(settings);
  if (!user || user.actif === false) return { ok: false, reason: REASONS.UTILISATEUR_INACTIF };
  // En raisonnant sur la référence plutôt que sur un exemplaire, on perdrait la vérification
  // du circuit : sans elle, `#/reserver/multiprise` réserverait du self-service.
  const exemplaires = items.filter((i) => i.reference === reference);
  if (!exemplaires.length) return { ok: false, reason: REASONS.CODE_INCONNU };
  if (exemplaires.some((i) => i.circuit !== CIRCUITS.VALEUR)) return { ok: false, reason: REASONS.MAUVAIS_CIRCUIT };
  if (toDate(finPrevue) <= toDate(debutPrevu)) return { ok: false, reason: REASONS.DATES_INCOHERENTES };
  if (!isOfficeOpen(debutPrevu, S.horaires)) return { ok: false, reason: REASONS.HORS_OUVERTURE };
  const days = Math.round((fromYmd(ymd(finPrevue)) - fromYmd(ymd(debutPrevu))) / DAY) + 1;
  if (days > S.dureeMaxReservationJours) return { ok: false, reason: REASONS.DUREE_TROP_LONGUE };
  if (hasActiveLoanOfReference(loans, items, user.id, reference)) return { ok: false, reason: REASONS.DEJA_UN_EXEMPLAIRE };
  if (S.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return { ok: false, reason: REASONS.RETARD_EN_COURS };
  const libres = freeExemplaires({ items, loans, reference, debut: debutPrevu, fin: finPrevue, date, ignoreLoanId });
  if (!libres.length) return { ok: false, reason: REASONS.COMPLET_SUR_LA_PERIODE };
  return { ok: true, reason: null };
}
```

`UNAVAILABLE_REASON` perd sa ligne `reserve`, et `REASONS.RESERVE_PAR_AUTRE` disparaît avec son libellé : plus rien ne produit cet état, et `COMPLET_SUR_LA_PERIODE` dit désormais ce qu’il disait mal. Un motif déclaré sans producteur est la dette que la phase 6 vient de solder sur les tables de transitions — autant ne pas en rouvrir une.

**L’ordre des refus est un choix, pas un hasard :** « vous détenez déjà un exemplaire » passe avant « aucun exemplaire libre ». Le premier dit à l’emprunteur ce qu’il peut faire — rendre le sien — là où le second l’enverrait attendre pour rien.

**Attention à la durée :** l’ancienne formule comptait les jours *écoulés* entre les deux dates, donc « du 3 au 9 » faisait 6. La spec dit sept jours, bornes comprises — d’où le `+ 1`. Vérifie que les tests existants de durée maximale suivent : ils parlent de la règle d’hier.

- [ ] **Étape 4 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`

Exactement **trois** tests existants échouent, tous parce qu’ils appellent `canReserveValeur` avec un `item`. Je les ai réécrits au pré-vol et vérifiés : la nouvelle conception ne perd aucune des règles qu’ils couvraient. Remplace-les par ces versions — trois changements de sémantique y sont assumés, et **aucun ne doit être « corrigé » en affaiblissant la règle** :

1. `MAUVAIS_CIRCUIT` se teste maintenant sur la référence, pas sur l’exemplaire.
2. Une période de longueur nulle ou négative devient `DATES_INCOHERENTES`. L’ancien modèle l’acceptait parce que seules les dates comptaient ; avec la demi-journée pour minimum, elle n’a plus de sens.
3. La durée compte **bornes comprises** : `debut + (max − 1)` jours est le dernier jour permis, là où l’ancienne formule comptait les jours écoulés.

```js
test('canReserveValeur : durée max, circuit et doublon de référence', () => {
  const debut = new Date(2026, 8, 18, 9);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: debut, finPrevue: fromYmd(ymd(addDays(debut, 2)), 17), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true);
  assert.equal(canReserveValeur({ ...base, finPrevue: fromYmd(ymd(addDays(debut, 7)), 17) }).reason, REASONS.DUREE_TROP_LONGUE);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, -1) }).reason, REASONS.DATES_INCOHERENTES);
  assert.equal(canReserveValeur({ ...base, reference: items[0].reference }).reason, REASONS.MAUVAIS_CIRCUIT);
  // Détenir déjà un exemplaire de la référence prime sur la disponibilité de la période.
  const sienne = [{ id: 'l1', userId: 'u1', itemId: items[2].id, statut: 'reservee', debutPrevu: debut.toISOString(), finPrevue: debut.toISOString() }];
  assert.equal(canReserveValeur({ ...base, loans: sienne }).reason, REASONS.DEJA_UN_EXEMPLAIRE);
});
```

```js
test('canReserveValeur : cohérence des dates et heures d’ouverture du retrait', () => {
  const jeudi9h = new Date(2026, 8, 17, 9);
  const jeudi17h = new Date(2026, 8, 17, 17);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: jeudi9h, finPrevue: jeudi17h, date: jeudi10h };
  assert.deepEqual(canReserveValeur(base), { ok: true, reason: null });
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 19, 9), finPrevue: new Date(2026, 8, 19, 17) }).reason, REASONS.HORS_OUVERTURE, 'samedi');
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 17, 12, 30) }).reason, REASONS.HORS_OUVERTURE, 'pause de midi');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 16, 17) }).reason, REASONS.DATES_INCOHERENTES, 'retour la veille du retrait');
  // Une période de longueur nulle ou négative n’a plus de sens : le minimum est une demi-journée.
  assert.equal(canReserveValeur({ ...base, finPrevue: jeudi9h }).reason, REASONS.DATES_INCOHERENTES, 'même instant');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 17, 8) }).reason, REASONS.DATES_INCOHERENTES, 'retour avant le retrait');
});
```

```js
test('canReserveValeur : durée en jours calendaires, bornes comprises', () => {
  const lundi9h = new Date(2026, 8, 14, 9);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: lundi9h, finPrevue: fromYmd(ymd(addDays(lundi9h, 4)), 17), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true, 'lundi au vendredi = 5 jours');
  // Bornes comprises : debut + (max - 1) jours est le dernier jour permis.
  const dernierJour = fromYmd(ymd(addDays(lundi9h, S.dureeMaxReservationJours - 1)), 17);
  assert.equal(canReserveValeur({ ...base, finPrevue: dernierJour }).ok, true, 'sept jours pile');
  const unDeTrop = fromYmd(ymd(addDays(lundi9h, S.dureeMaxReservationJours)), 17);
  assert.equal(canReserveValeur({ ...base, finPrevue: unDeTrop }).reason, REASONS.DUREE_TROP_LONGUE);
  // Traversée du changement d’heure : le compte reste en jours calendaires.
  const debutDst = new Date(2026, 9, 22, 9);
  assert.equal(canReserveValeur({ ...base, debutPrevu: debutDst, finPrevue: fromYmd(ymd(addDays(debutDst, 5)), 17) }).ok, true);
});
```

Avec ces trois-là, `tests/rules.test.mjs` passe 38/38. Si un **autre** test échoue, c’est une découverte : rapporte-la au lieu de l’absorber.

- [ ] **Étape 5 : commit**

```bash
git add js/rules.js tests/rules.test.mjs
git commit -m "feat(rules): disponibilité du matériel de valeur par période"
```

---

#### Suite de la tâche 1 : le modèle et les actions (même commit)

- [ ] **Étape 6 : `js/models.js` — l’état `reserve` quitte le modèle**

```js
export const ITEM_STATES = {
  DISPONIBLE: 'disponible', EMPRUNTE: 'emprunte', MAINTENANCE: 'maintenance', HS: 'hs',
};
```

Dans `ITEM_TRANSITIONS`, la ligne `reserve:` disparaît et `disponible` perd `'reserve'` parmi ses cibles :

```js
  disponible: ['emprunte', 'maintenance', 'hs'],
```

`LABELS.itemState` perd `reserve: 'Réservé'`, et `js/ui.js` perd la variante de badge `reserve: 'reserved'` de la famille `item`.

Dans `js/actions/maintenance.js`, `estDehors` ne regarde plus qu’un état :

```js
const estDehors = (item) => item.etat === ITEM_STATES.EMPRUNTE;
```

- [ ] **Étape 7 : `js/actions/loans.js` — réserver une référence**

`reserveValeur` prend une référence, demande à `canReserveValeur` si la période est tenable, puis attribue le premier exemplaire libre. Elle **n’écrit plus aucun état d’objet** :

```js
export function reserveValeur({ reference, userId, debutPrevu, finPrevue, motif = '' }) {
  const date = now();
  const user = store.users.get(userId);
  const debut = new Date(debutPrevu);
  const fin = new Date(finPrevue);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) throw new Error('Dates invalides.');
  if (debut < new Date(date.getFullYear(), date.getMonth(), date.getDate())) throw refusal(REASONS.DATE_PASSEE);
  // Une réservation dont la fenêtre de retrait est déjà close serait balayée par expireDueLoans
  // dès le prochain rendu : autant la refuser tout de suite.
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  if (new Date(debut.getTime() + minutes * 60000) < date) throw refusal(REASONS.DATE_PASSEE);
  const loans = store.loans.list();
  const items = store.items.list();
  const check = canReserveValeur({ reference, user, loans, items, settings: store.settings.get(), debutPrevu: debut, finPrevue: fin, date });
  if (!check.ok) throw refusal(check.reason);
  // `canReserveValeur` vient de garantir qu’il en reste au moins un : on prend le premier,
  // l’ordre de la liste étant l’ordre de création, donc stable.
  const exemplaire = freeExemplaires({ items, loans, reference, debut, fin, date })[0];
  return store.transaction(() => {
    const loan = store.loans.create({
      itemId: exemplaire.id, userId, statut: LOAN_STATES.RESERVEE, motif: String(motif || '').trim(), motifRefus: '', dateRefus: null, codeRetrait: code6(),
      dateReservation: date.toISOString(), debutPrevu: debut.toISOString(), finPrevue: fin.toISOString(),
      dateRetrait: null, dateRetourReelle: null, remisPar: null, receptionnePar: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
    });
    // Aucun état d’objet n’est écrit : la réservation occupe une période, pas un objet.
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RESERVEE, itemId: exemplaire.id, loanId: loan.id, userId, detail: `${exemplaire.nom} — ${fullName(user)}` });
    return loan;
  });
}
```

Ajouter `freeExemplaires` à l’import groupé depuis `../rules.js`.

Dans `releaseReservation`, la ligne qui remettait l’objet à `disponible` disparaît : rien ne l’avait sorti de cet état.

```js
    if (item && item.etat === ITEM_STATES.RESERVE) applyItemState(item.id, resolveItemState(item.id, ITEM_STATES.DISPONIBLE));
```

**Attention :** `refuseLoan`, `cancelLoan` et `expireDueLoans` passent toutes par `releaseReservation`. Des tests vérifient qu’un objet signalé pendant sa réservation part en maintenance à la libération — ce comportement **doit disparaître avec son déclencheur** : l’objet n’était jamais passé `reserve`, donc il n’y a rien à libérer. Un signalement déposé pendant une réservation immobilise déjà l’objet par `reportIssue`, et c’est toujours vrai. Réécris ces tests pour asserter cela, sans réintroduire d’écriture d’état.

- [ ] **Étape 8 : migrer les tests de la couche d’actions**

`tests/actions-loans-valeur.test.mjs` compte **30 appels** à `reserveValeur`, `tests/handover-modal.test.mjs` en compte 2. La transformation d’appel est mécanique :

```
reserveValeur({ itemId: X.id, …})   →   reserveValeur({ reference: X.reference, …})
```

Deux pièges que le pré-vol a rencontrés :

- **`finPrevue: DEMAIN9` vaut `debutPrevu`.** Une période de longueur nulle est désormais refusée (`DATES_INCOHERENTES`). Introduis une constante de fin — `const DEMAIN17 = new Date(2026, 8, 18, 17, 0);` — et remplace `finPrevue: DEMAIN9` par `finPrevue: DEMAIN17`.
- **Les assertions sur l’état de l’objet.** Plusieurs tests vérifient qu’après réservation l’objet passe `reserve`, ou qu’il revient `disponible` au refus. Ces assertions testent le défaut qu’on supprime : remplace-les par ce qui compte désormais — l’exemplaire attribué n’est plus libre **sur la période**, et il l’est toujours en dehors.

Ajoute au moins un test qui épingle le défaut signalé :

```js
test('réserver pour novembre ne bloque pas octobre', () => {
  const sd = store.items.list((i) => i.reference === 'sd-256');
  assert.ok(sd.length >= 2, 'le jeu a plusieurs cartes SD');
  const novembre = new Date(2026, 10, 3, 9, 0);
  reserveValeur({ reference: 'sd-256', userId: ELEVE, debutPrevu: novembre, finPrevue: new Date(2026, 10, 5, 17, 0) });
  // Quelqu’un d’autre, la semaine prochaine : la référence doit rester réservable.
  const bientot = new Date(2026, 8, 24, 9, 0);
  const autre = reserveValeur({ reference: 'sd-256', userId: 'user_011', debutPrevu: bientot, finPrevue: new Date(2026, 8, 24, 17, 0) });
  assert.equal(autre.statut, 'reservee');
  assert.ok(store.items.list((i) => i.reference === 'sd-256').every((i) => i.etat === ITEM_STATES.DISPONIBLE),
    'aucun exemplaire n’est marqué indisponible : la réservation occupe une période, pas un objet');
});
```

- [ ] **Étape 9 : lancer les tests**

Run: `node --test "tests/**/*.test.mjs"` puis `TZ=America/New_York node --test "tests/**/*.test.mjs"`
Attendu : 0 échec dans les deux. Rapporte le total réel et la liste des tests que tu as réécrits, avec l’intention conservée pour chacun.

- [ ] **Étape 10 : commit**

```bash
git add js/rules.js js/models.js js/ui.js js/actions/loans.js js/actions/maintenance.js tests/
git commit -m "feat(valeur): la réservation occupe une période, plus un objet"
```

---

### Task 2 : Le mobile — demi-journées et réponse immédiate

**Fichiers :**
- Modifier : `js/mobile/views/reserver.js`, `js/mobile/views/fiche.js`, `js/mobile/catalog.js`, `js/mobile/app.js` (route)
- Test : `tests/mobile-reserver.test.mjs` (ou le fichier existant), `tests/mobile-catalog.test.mjs`, `tests/mobile-views.test.mjs`

- [ ] **Étape 1 : la route passe à la référence**

`js/mobile/app.js` : `{ path: '/reserver/:reference', view: guard(reserverView) }`. `js/mobile/views/fiche.js` fait pointer son bouton **Réserver** sur `#/reserver/${group.reference}` au lieu de l’identifiant d’un exemplaire.

- [ ] **Étape 2 : le formulaire**

Remplacer « Date de retrait / Heure de retrait / Date de retour » par quatre champs : date et demi-journée au retrait, date et demi-journée au retour. Les deux sélecteurs de demi-journée proposent **Matin** et **Après-midi**, avec les heures réglées en libellé — `halfDays(settings)` les donne, ne les écris pas en dur.

La lecture du formulaire rend `{ debutPrevu, finPrevue }` via `halfDayBounds` : le début est le début de la demi-journée de retrait, la fin est la **fin** de la demi-journée de retour.

- [ ] **Étape 3 : la réponse immédiate**

Sous les champs, une ligne qui se recalcule à chaque changement, sans appel réseau ni validation :

- des exemplaires libres → « 2 exemplaires libres sur cette période » (ou « 1 exemplaire libre ») ;
- aucun → « Complet sur cette période » plus, si on la trouve, la première date où un exemplaire se libère ; le bouton **Confirmer** est désactivé ;
- une période invalide (fin avant début, trop longue, hors ouverture) → le message de `reasonLabel(reason, settings)`, et le bouton désactivé.

La recherche de la première date libre balaie au plus 60 jours à partir du début demandé, demi-journée par demi-journée, et s’arrête à la première qui convient. Au-delà, dire « aucune disponibilité dans les deux mois » plutôt que de balayer sans fin.

Ces fonctions sont **pures et testées** : `disponibiliteHtml({ libres, reason, prochaine, settings })` et `prochaineDisponibilite({ items, loans, reference, debut, fin, date, settings })`.

- [ ] **Étape 4 : le catalogue cesse de parler de réservation**

`js/mobile/catalog.js` : `availability` ne peut plus citer `reserve`. Un objet est **présent** s’il n’est ni `emprunte`, ni `maintenance`, ni `hs`. Pour le circuit valeur, le catalogue dit ce qui est physiquement là ; c’est l’écran de réservation qui répond sur une période. Un Canon réservé pour novembre est présent et réservable aujourd’hui — le cacher reproduirait le défaut en plus discret.

- [ ] **Étape 5 : tests, puis commit**

Run: `node --test "tests/**/*.test.mjs"` et sous `TZ=America/New_York`.

```bash
git add js/mobile/ tests/
git commit -m "feat(mobile): réservation à la demi-journée avec réponse immédiate"
```

---

### Task 3 : Jeu de données, documents, vérification

**Fichiers :**
- Modifier : `js/seed.js`, `docs/scenarios-demo.md`, `README.md`
- Test : `tests/seed.test.mjs`

- [ ] **Étape 1 : le jeu de données**

`js/seed.js` : la ligne `it.etat = ITEM_STATES.RESERVE;` disparaît des deux réservations à venir. Les objets restent `disponible` ; c’est leur période qui est prise.

Ajouter au jeu une **réservation lointaine** sur une référence à plusieurs exemplaires — `sd-256` en convient — pour que le défaut corrigé soit visible en démonstration : une carte réservée le mois prochain, les autres libres aujourd’hui.

Dans `tests/seed.test.mjs`, le test « cohérence emprunts ↔ états du matériel » attend des objets `reserve` : il doit désormais vérifier l’inverse — aucune réservation n’écrit d’état, et les exemplaires réservés restent `disponible`.

- [ ] **Étape 2 : le scénario de démonstration**

`docs/scenarios-demo.md`, scénario 3 : la réservation se fait depuis la référence et à la demi-journée. Ajouter un pas qui montre le correctif — réserver une carte SD pour le mois prochain, puis en réserver une autre pour la semaine prochaine, et constater que les deux passent.

- [ ] **Étape 3 : vérification de fin** (contrôleur)

Greps habituels, suite dans les deux fuseaux, puis au navigateur : réserver une carte SD en novembre, vérifier qu’elle reste réservable en octobre, qu’une troisième réservation sur la même demi-journée est refusée quand les trois exemplaires sont pris, et que le message nomme la première date libre.

- [ ] **Étape 4 : commit**

```bash
git add js/seed.js docs/ tests/
git commit -m "docs: réservation par créneaux dans le jeu de démonstration et les scénarios"
```

---

## Relecture du plan

- **Couverture.** Spec §5.2 amendée : disponibilité par période (tâche 1), demi-journée dérivée des horaires (tâche 1 et 2), sept jours bornes comprises (tâche 1), réservation depuis la référence avec attribution (tâche 1 et 2), réponse immédiate avant validation (tâche 2). §4 : l’état `reserve` quitte le modèle (tâche 1). §7 : la route `#/reserver/:reference` (tâche 2).
- **Pré-vol.** Le code de la tâche 1 a été extrait dans une copie jetable du dépôt à l’étiquette `phase-6` et exécuté. `tests/rules.test.mjs` passe **38/38**, les huit tests neufs compris. Quatre défauts du plan ont été corrigés à cette occasion :
  1. `DEFAULT_SETTINGS.dureeMaxReservationJours` valait encore 5 : la spec disait sept, le code non. Sans ce changement, « sept jours pile » était refusé.
  2. La fixture de test donnait les réservations bloquantes au demandeur lui-même, donc `DEJA_UN_EXEMPLAIRE` tombait avant `COMPLET_SUR_LA_PERIODE`.
  3. **En passant de l’exemplaire à la référence, la vérification du circuit disparaissait** — `#/reserver/multiprise` aurait réservé du self-service. La garde est rétablie, avec son test.
  4. Le découpage initial (règles, puis actions) laissait la suite rouge entre les deux commits, puisque `loans.js` appelle `canReserveValeur`. Les deux sont désormais une seule tâche.
- **Ce que le pré-vol n’a pas fini.** La migration des tests de la couche d’actions est mécanique sur la forme d’appel (vérifié : 30 appels transformés par script) mais demande de vraies réécritures là où les assertions portent sur l’état `reserve`. L’étape 8 nomme les deux pièges rencontrés.
