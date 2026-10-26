# MDS — Guide de marque & design system — Plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire, dans `design-system/`, un site statique à deux étages — vitrine de marque puis documentation des composants — qui rend les vrais composants du dépôt et qu'un nouvel arrivant traverse seul.

**Architecture :** Pages HTML statiques, sans étape de construction. Toute la logique testable vit dans des modules ES purs de `design-system/js/` qui rendent des chaînes HTML, à la manière de `js/demoClock.js` ; les pages les appellent depuis un script en ligne. Chaque exemple de composant est rendu dans un `<iframe>` vers une page autonome de `design-system/exemples/`, qui charge exactement les feuilles dont ce composant a besoin — le dépôt a cinq feuilles qui se contredisent, les charger ensemble ferait dévorer la page de documentation. Le code montré est extrait du DOM du cadre, donc il est par construction celui qui est rendu.

**Tech Stack :** HTML, CSS, JavaScript modules ES. Tests `node --test` (Node ≥ 22), sans DOM : les modules rendent des chaînes, les tests les comparent, et le DOM est simulé à la main quand c'est indispensable (voir `tests/ui.test.mjs`).

**Spec :** `docs/superpowers/specs/2026-10-26-mds-design-system-design.md`

## Global Constraints

- **Aucune étape de construction, aucune dépendance** hors Google Fonts. On ouvre un fichier, on recharge.
- **Chemins relatifs partout.** Un chemin absolu casse la publication sous `https://<compte>.github.io/mds-emprunts/`. `tests/deploiement.test.mjs` le vérifie.
- **Les couleurs, espacements, rayons et typographies viennent de `css/tokens.css`.** Aucune valeur en dur éparpillée dans `design-system/css/site.css` : ce qui appartient en propre au site — ses couleurs de chrome et son échelle de titres de vitrine — se déclare dans son `:root` sous le préfixe `--ds-`, en un seul endroit. Le kit s'arrête à 40 px, qui est une échelle de produit ; une vitrine de marque a besoin de plus grand, et c'est la seule chose qu'elle ajoute.
- **Pas de `--text-secondary` sur un aplat pastel.** `#757678` sur `--bg-canvas` donne 4,13:1 et sur les fonds de statut moins encore. Sur un aplat coloré, le texte passe en `--text-primary`.
- **Toute page de `design-system/composants/` sauf `demarrer.html` et `fondations.html` porte les six ancres de la trame** : `id="a-quoi"`, `id="exemple"`, `id="variantes"`, `id="code"`, `id="quand-ne-pas"`, `id="accessibilite"`. Le test de la Task 10 balaie le dossier entier et vaut rétroactivement.
- **Le site n'utilise pour lui-même aucune paire texte/fond sous 4,5:1.** Vérifié par test, Task 2.
- **Langue : français.** Titres sans jargon non expliqué. Phrases courtes.
- **Chaque page de `design-system/` charge les polices par `<link>` avant ses feuilles**, comme les pages de la racine (`preconnect` googleapis, `preconnect` gstatic, puis la famille Inter + Bricolage Grotesque).
- **Chaque message de commit se termine par** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Les démonstrations de dette** (badges non conformes montrés tels quels) sont des exceptions sanctionnées pour le contrôle design : chacune est déclarée via `impeccable hooks ignore-value` avec la raison « documentation de dette connue : décidé par l'utilisateur le 2026-10-26 », jamais par `ignore-file`.

## Review Focus

1. **Presse-papiers indisponible** (origine non sécurisée, `navigator.clipboard` absent) — le bouton « copier » doit sélectionner le code pour que la personne fasse Cmd+C, pas échouer en silence. → Task 5.
2. **Page ouverte en `file://`** — `document.styleSheets[].cssRules` lève une erreur de sécurité ; la page Fondations doit afficher « ouvrez le site depuis un serveur » au lieu d'un tableau vide. → Task 3.
3. **Un token ajouté à `tokens.css` qu'aucun groupe connu ne réclame** — il doit apparaître dans un groupe « Autres », jamais disparaître : un token invisible est pire qu'un token mal rangé. → Task 3.
4. **Un fichier d'exemple absent ou en erreur** — le cadre doit afficher un message visible nommant le fichier manquant, pas rester blanc à 0 pixel de haut. → Task 4.
5. **Ratio exactement à 4,5 et texte exactement à 18 px** — les bornes de WCAG sont inclusives ; un verdict faux à la borne décrédibilise tout le tableau de contraste. → Task 1.

---

### Task 1 : Mesure de contraste

**Files:**
- Create: `design-system/js/contraste.js`
- Test: `tests/ds-contraste.test.mjs`

**Interfaces:**
- Consumes: rien.
- Produces: `ratioExact(hexA: string, hexB: string) -> number` (pleine précision) ; `ratio(hexA, hexB) -> number` (le précédent, arrondi à 2 décimales, **pour l'affichage seulement**) ; `verdict(ratioExact: number, px: number, gras: boolean) -> 'AA' | 'AA-large' | 'echec'` ; `GRAND_TEXTE = { px: 24, pxGras: 18.66 }`.

`verdict` reçoit le ratio **non arrondi** : arrondir avant de juger ferait passer un 4,496 réel pour un 4,50 conforme. L'arrondi ne sert qu'à écrire le nombre à l'écran.

Les seuils de grand texte sont ceux de WCAG, convertis en pixels : 18 pt = 24 px, et 14 pt gras = 18,66 px. Un texte de 18 px non gras n'est **pas** du grand texte et exige 4,5:1.

- [ ] **Step 1: Write the failing test** dans `tests/ds-contraste.test.mjs`

```js
test('ratio : valeurs de référence', () => {
  assert.equal(ratio('#ffffff', '#000000'), 21);
  assert.equal(ratio('#662483', '#f0e9f3'), 8.23);   // badge emprunté
  assert.equal(ratio('#faad14', '#fef3d9'), 1.72);   // badge maintenance
  assert.equal(ratio('#757678', '#ffffff'), 4.55);   // texte secondaire sur blanc
  assert.equal(ratio('#AABBCC', '#aabbcc'), 1);      // la casse n'a pas d'effet
});

test('ratioExact ne perd rien, ratio n’arrondit que pour l’affichage', () => {
  assert.ok(Math.abs(ratioExact('#757678', '#ffffff') - 4.5465) < 0.001);
  assert.equal(ratio('#757678', '#ffffff'), 4.55);
});

test('verdict : les bornes de WCAG sont inclusives', () => {
  assert.equal(verdict(4.5, 16, false), 'AA');
  assert.equal(verdict(4.49, 16, false), 'echec');
  assert.equal(verdict(3, 24, false), 'AA-large');    // 18 pt = 24 px
  assert.equal(verdict(3, 23.9, false), 'echec');
  assert.equal(verdict(3, 18.66, true), 'AA-large');  // 14 pt gras = 18,66 px
  assert.equal(verdict(3, 18.65, true), 'echec');
  assert.equal(verdict(3, 18, false), 'echec');       // 18 px non gras n’est PAS du grand texte
});

test('verdict juge sur le ratio non arrondi', () => {
  // 4,496 arrondi donnerait 4,50 et passerait : le piège que cette API évite.
  assert.equal(verdict(4.496, 16, false), 'echec');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-contraste.test.mjs`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implement `ratioExact`, `ratio` et `verdict` dans `design-system/js/contraste.js`**

Luminance relative WCAG 2.1 : canal / 255, puis `c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055) ** 2.4`, pondération `0.2126 / 0.7152 / 0.0722`. `ratioExact` rend `(clair + 0.05) / (sombre + 0.05)` sans arrondi ; `ratio` l'arrondit à 2 décimales. Accepter `#rgb` et `#rrggbb`, quelle que soit la casse.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-contraste.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/js/contraste.js tests/ds-contraste.test.mjs
git commit -m "feat(ds): mesure de contraste WCAG"
```

---

### Task 2 : Socle du site et accueil de la marque

**Files:**
- Create: `design-system/css/site.css`, `design-system/js/palette-site.js`, `design-system/js/chrome.js`, `design-system/index.html`
- Test: `tests/ds-socle.test.mjs`

**Interfaces:**
- Consumes: `ratioExact`, `verdict` (Task 1).
- Produces: `CHAPITRES: {href, titre, resume}[]` et `COMPOSANTS: {href, titre}[]` ; `enteteHtml(courant: string) -> string` ; `piedHtml() -> string` ; `PAIRES: {nom, texte, fond, px, gras}[]` où `texte` et `fond` sont des noms de variables `--ds-*`.

Le site se pose sur fond blanc, pas sur `--bg-canvas` : `--text-secondary` sur `--bg-canvas` tombe à 4,13:1, sous le seuil que le site s'impose.

- [ ] **Step 1: Write the failing test** dans `tests/ds-socle.test.mjs`

```js
test('la palette du site passe AA sur toutes ses paires', () => {
  const css = readFileSync(new URL('../design-system/css/site.css', import.meta.url), 'utf8');
  const racine = css.match(/:root\s*\{([^}]*)\}/)[1];
  const valeurs = Object.fromEntries([...racine.matchAll(/(--ds-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]));
  for (const p of PAIRES) {
    assert.ok(valeurs[p.texte], `${p.texte} absent de site.css`);
    assert.ok(valeurs[p.fond], `${p.fond} absent de site.css`);
    assert.notEqual(verdict(ratioExact(valeurs[p.texte], valeurs[p.fond]), p.px, p.gras), 'echec', `${p.nom} échoue`);
  }
});

test('enteteHtml marque le chapitre courant et un seul', () => {
  const html = enteteHtml('logo.html');
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /href="logo\.html"[^>]*aria-current="page"/);
});

test('les deux étages sont annoncés sur l’accueil', () => {
  const html = readFileSync(new URL('../design-system/index.html', import.meta.url), 'utf8');
  for (const c of CHAPITRES) assert.match(html, new RegExp(`href="${c.href}"`));
  assert.match(html, /href="composants\/demarrer\.html"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-socle.test.mjs`
Expected: FAIL — modules introuvables.

- [ ] **Step 3: Implement le socle**

`palette-site.js` : les paires du chrome (texte courant, texte secondaire, texte sur violet, lien) avec leur taille réelle. `site.css` : un `:root` avec les `--ds-*` correspondants, puis la mise en page du site — en-tête collant, largeur de lecture limitée, sommaire latéral pour l'étage composants, pied. `chrome.js` : `enteteHtml` pose la navigation des deux étages et marque le courant par `aria-current="page"`. `index.html` : le hero « Les talents se connectent », deux phrases, les chapitres en cartes, et l'entrée vers l'étage composants.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-socle.test.mjs`
Expected: PASS

- [ ] **Step 5: Vérifier à l'œil**

Ouvrir `design-system/index.html` via `npm run serve`, à 1440 px puis à 360 px de large. Attendu : aucun défilement horizontal, le hero lisible, les chapitres cliquables.

- [ ] **Step 6: Commit**

```bash
git add design-system/css/site.css design-system/js/palette-site.js design-system/js/chrome.js design-system/index.html tests/ds-socle.test.mjs
git commit -m "feat(ds): socle du site et accueil de la marque"
```

---

### Task 3 : Lecture des tokens et page Fondations

**Files:**
- Create: `design-system/js/tokens.js`, `design-system/composants/fondations.html`
- Test: `tests/ds-tokens.test.mjs`

**Interfaces:**
- Consumes: `enteteHtml` (Task 2).
- Produces: `GROUPES: {cle, titre, prefixes: string[]}[]` ; `lireTokens(cssTexte: string) -> {cle, titre, tokens: {nom, valeur}[]}[]` — tout token non réclamé par un préfixe atterrit dans le groupe `autres` ; `valeursDepuis(cssTexte: string) -> Record<string, string>` ; `tableauTokensHtml(groupes) -> string` ; `lireTokensDepuisDocument(doc) -> {ok: true, groupes} | {ok: false, message: string}`.

- [ ] **Step 1: Write the failing test** dans `tests/ds-tokens.test.mjs`

```js
test('lireTokens range par groupe et garde l’ordre du fichier', () => {
  const g = lireTokens(':root { --brand-primary: #662483; --space-sm: 8px; --radius-md: 8px; }');
  assert.deepEqual(g.find((x) => x.cle === 'marque').tokens, [{ nom: '--brand-primary', valeur: '#662483' }]);
  assert.deepEqual(g.find((x) => x.cle === 'espacements').tokens.map((t) => t.nom), ['--space-sm']);
});

test('un token inconnu tombe dans « autres » au lieu de disparaître', () => {
  const g = lireTokens(':root { --chose-inedite: 3px; }');
  assert.deepEqual(g.find((x) => x.cle === 'autres').tokens, [{ nom: '--chose-inedite', valeur: '3px' }]);
});

test('aucun token du vrai fichier ne se perd', () => {
  const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  const attendus = [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
  const obtenus = lireTokens(css).flatMap((g) => g.tokens.map((t) => t.nom));
  assert.deepEqual([...obtenus].sort(), [...attendus].sort());
});

test('les commentaires ne deviennent pas des tokens', () => {
  assert.deepEqual(lireTokens(':root { /* --faux: 1px; */ --space-sm: 8px; }').flatMap((g) => g.tokens.map((t) => t.nom)), ['--space-sm']);
});

test('valeursDepuis rend un dictionnaire nom → valeur', () => {
  assert.deepEqual(valeursDepuis(':root { --brand-primary: #662483; --space-sm: 8px; }'),
    { '--brand-primary': '#662483', '--space-sm': '8px' });
});

test('sans serveur, la page explique au lieu de rester vide', () => {
  const docRefuse = { styleSheets: [{ get cssRules() { throw new Error('SecurityError'); } }] };
  const r = lireTokensDepuisDocument(docRefuse);
  assert.equal(r.ok, false);
  assert.match(r.message, /serveur/i);
  assert.match(r.message, /npm run serve/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-tokens.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `tokens.js` et la page Fondations**

`lireTokens` retire d'abord les commentaires, puis lit les déclarations du `:root`. Les groupes suivent les sections de `tokens.css` : marque, texte, fonds, bordures, retours, statuts, espacements, rayons, tailles, ombres, typographie, puis `autres`. `tableauTokensHtml` rend pour chaque token son nom, un aperçu quand la valeur est une couleur, et sa valeur copiable.

La page obtient le texte de `tokens.css` depuis `document.styleSheets` (même origine). `--border-muted` est affiché avec la mention « non tranché — voir `docs/correctifs-figma.md` ».

- [ ] **Step 4: Traiter le cas `file://`**

`lireTokensDepuisDocument` entoure l'accès à `cssRules` d'un `try` — un navigateur refuse la lecture des règles sur `file://`. En cas d'échec, il rend `{ok: false, message}`, et la page affiche ce message à la place du tableau : « Cette page lit les tokens depuis la feuille de style, ce qu'un navigateur refuse sur un fichier local. Ouvrez le site depuis un serveur : `npm run serve`. »

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/ds-tokens.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add design-system/js/tokens.js design-system/composants/fondations.html tests/ds-tokens.test.mjs
git commit -m "feat(ds): lecture des tokens et page Fondations"
```

---

### Task 4 : Cadres d'exemple isolés, et la page Bouton qui les prouve

**Files:**
- Create: `design-system/js/cadre.js`, `design-system/js/cadre-enfant.js`, `design-system/exemples/bouton.html`, `design-system/composants/bouton.html`
- Test: `tests/ds-cadre.test.mjs`

**Interfaces:**
- Consumes: `enteteHtml` (Task 2).
- Produces: `cadreHtml({fichier: string, demo: string, titre: string}) -> string` (un `<iframe>` titré, `loading="lazy"`, `src` = `../exemples/<fichier>#<demo>`) ; `brancherCadres(racine: Element, delaiMs = 1000) -> void` (hauteur automatique par `postMessage`) ; `messageCadreAbsent(fichier: string) -> string`.

Un fichier d'exemple est une page complète : polices, `tokens.css`, `base.css`, puis seulement les feuilles que ce composant réclame. Chaque démonstration y est un `<section data-demo="...">`. `cadre-enfant.js` masque tout sauf la section demandée par le fragment et annonce sa hauteur au parent.

- [ ] **Step 1: Write the failing test** dans `tests/ds-cadre.test.mjs`

```js
test('cadreHtml pointe vers le bon fichier et porte un titre accessible', () => {
  const html = cadreHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Les variantes de bouton' });
  assert.match(html, /src="\.\.\/exemples\/bouton\.html#variantes"/);
  assert.match(html, /title="Les variantes de bouton"/);
});

test('chaque cadre vise une démo qui existe vraiment', () => {
  for (const page of pagesComposants()) {
    for (const [, fichier, demo] of page.html.matchAll(/src="\.\.\/exemples\/([\w-]+\.html)#([\w-]+)"/g)) {
      const exemple = lireExemple(fichier);                       // lève si le fichier manque
      assert.match(exemple, new RegExp(`data-demo="${demo}"`), `${page.nom} vise ${fichier}#${demo}, absent`);
    }
  }
});

test('un exemple ne charge aucune feuille de page, sauf les exemples mobiles', () => {
  // .admin-shell et .m-nav prennent tout l’écran : chargés dans un cadre, ils dévorent la démo.
  for (const f of fichiersExemples()) {
    const html = lireExemple(f);
    assert.doesNotMatch(html, /admin\.css/, `${f} charge admin.css`);
    if (!f.startsWith('mobile-')) assert.doesNotMatch(html, /mobile\.css/, `${f} charge mobile.css`);
    assert.match(html, /href="\.\.\/\.\.\/css\/tokens\.css"/, `${f} ne charge pas tokens.css`);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/, `${f} ne charge pas les polices`);
  }
});

test('un cadre muet se signale au lieu de rester blanc', () => {
  assert.match(messageCadreAbsent('bouton.html'), /exemples\/bouton\.html/);
  assert.match(messageCadreAbsent('bouton.html'), /introuvable/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-cadre.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement le mécanisme et les deux pages Bouton**

`exemples/bouton.html` : sections `variantes`, `tailles`, `etats`, `bloc`. `composants/bouton.html` suit la trame des six points de la spec §5, **chacun dans une section portant son ancre** — `id="a-quoi"`, `id="exemple"`, `id="variantes"`, `id="code"`, `id="quand-ne-pas"`, `id="accessibilite"` — car le test de la Task 10 balaie tout le dossier et vaut pour cette page aussi. Y écrire que `.btn` n'a aucun style de focus visible aujourd'hui : manque nommé, reporté dans `docs/correctifs-figma.md`.

- [ ] **Step 4: Rendre visible un cadre qui ne répond pas**

Si aucun `postMessage` n'arrive dans `delaiMs`, `brancherCadres` remplace le cadre par `messageCadreAbsent(fichier)`. Vérifier à l'œil en pointant temporairement un cadre vers un fichier absent, puis remettre.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/ds-cadre.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add design-system/js/cadre.js design-system/js/cadre-enfant.js design-system/exemples/bouton.html design-system/composants/bouton.html tests/ds-cadre.test.mjs
git commit -m "feat(ds): cadres d’exemple isolés et page Bouton"
```

---

### Task 5 : Le code montré, extrait du cadre, et copiable

**Files:**
- Create: `design-system/js/code.js`
- Modify: `design-system/js/cadre.js`, `design-system/composants/bouton.html`
- Test: `tests/ds-code.test.mjs`

**Interfaces:**
- Consumes: `brancherCadres` (Task 4).
- Produces: `formaterHtml(brut: string) -> string` (réindente, deux espaces par niveau, une balise par ligne) ; `copier(texte: string, champ: HTMLElement) -> Promise<'presse-papiers' | 'selection'>`.

Le code affiché est extrait du DOM du cadre, donc c'est exactement ce qui est rendu : la démonstration et son code ne peuvent pas diverger.

- [ ] **Step 1: Write the failing test** dans `tests/ds-code.test.mjs`

```js
test('formaterHtml met une balise par ligne et indente', () => {
  assert.equal(formaterHtml('<div class="row"><button class="btn btn--primary">OK</button></div>'),
    '<div class="row">\n  <button class="btn btn--primary">OK</button>\n</div>');
});

test('formaterHtml laisse le texte intact et n’ajoute pas de ligne vide', () => {
  assert.equal(formaterHtml('<p>Deux mots</p>'), '<p>Deux mots</p>');
});

test('copier retombe sur la sélection quand le presse-papiers est absent', async () => {
  const avant = globalThis.navigator;
  globalThis.navigator = {};                       // origine non sécurisée
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  try {
    assert.equal(await copier('texte', champ), 'selection');
    assert.equal(champ.selectionne, true);
  } finally { globalThis.navigator = avant; }
});

test('copier signale aussi le repli quand l’écriture est refusée', async () => {
  const avant = globalThis.navigator;
  globalThis.navigator = { clipboard: { writeText: () => Promise.reject(new Error('refus')) } };
  const champ = { focus() {}, select() {} };
  try { assert.equal(await copier('texte', champ), 'selection'); } finally { globalThis.navigator = avant; }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-code.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `code.js` et brancher l'extraction**

`brancherCadres` reçoit la hauteur **et** le HTML de la section depuis `cadre-enfant.js`, le passe à `formaterHtml`, et le pose dans le bloc de code de la page. Le bouton « Copier » appelle `copier` et affiche « Copié » ou « Sélectionné, faites Cmd+C » selon le retour.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-code.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/js/code.js design-system/js/cadre.js design-system/js/cadre-enfant.js design-system/composants/bouton.html tests/ds-code.test.mjs
git commit -m "feat(ds): code extrait du cadre et copiable"
```

---

### Task 6 : Le logo, ses versions et ses exports

**Files:**
- Create: `design-system/assets/logo.svg`, `design-system/js/logo.js`, `design-system/logo.html`
- Test: `tests/ds-logo.test.mjs`

**Interfaces:**
- Consumes: `enteteHtml` (Task 2).
- Produces: `COULEURS = { turquoise: '#2DB8C5', anthracite: '#3C3C3B' }` ; `RATIO = 150 / 88` ; `versionMono(svgTexte: string, couleur: string) -> string` ; `tailleExport(largeur: number) -> {largeur: number, hauteur: number}` ; `TAILLES_PNG = [600, 1200]`.

Le SVG officiel est le seul fichier stocké. Les versions blanche et anthracite, et tous les PNG, sont dérivés dans le navigateur — rien de binaire au dépôt, et aucune étape de construction.

- [ ] **Step 1: Déposer le logo officiel**

Enregistrer le SVG de `https://www.mydigitalschool.com/themes/custom/koriolis_starterkit/logos/www_mydigitalschool_fr/logo.svg` dans `design-system/assets/logo.svg`. Vérifier : `viewBox="0 0 150 88"`, dix `fill="#2DB8C5"`, neuf `fill="#3C3C3B"`.

- [ ] **Step 2: Write the failing test** dans `tests/ds-logo.test.mjs`

```js
test('le logo déposé est bien le logo officiel', () => {
  const svg = readFileSync(new URL('../design-system/assets/logo.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 150 88"/);
  assert.equal((svg.match(/fill="#2DB8C5"/g) || []).length, 10);
  assert.equal((svg.match(/fill="#3C3C3B"/g) || []).length, 9);
});

test('versionMono remplace les deux couleurs et ne touche pas fill="none"', () => {
  const svg = '<svg><path fill="#2DB8C5"/><path fill="#3C3C3B"/><g fill="none"/></svg>';
  const blanc = versionMono(svg, '#ffffff');
  assert.equal((blanc.match(/fill="#ffffff"/g) || []).length, 2);
  assert.match(blanc, /fill="none"/);
});

test('versionMono ignore la casse des couleurs source', () => {
  assert.match(versionMono('<path fill="#2db8c5"/>', '#fff'), /fill="#fff"/);
});

test('tailleExport garde les proportions du logo', () => {
  assert.deepEqual(tailleExport(600), { largeur: 600, hauteur: 352 });
  assert.deepEqual(tailleExport(1200), { largeur: 1200, hauteur: 704 });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/ds-logo.test.mjs`
Expected: FAIL

- [ ] **Step 4: Implement `logo.js` et la page Logo**

La page montre les trois versions, la zone de protection exprimée en proportion du logo, les tailles minimales, les fonds autorisés, puis les neuf interdits de la spec §6 — étirer, recolorer, ombre portée, contraste insuffisant, photo chargée, pivoter, réarranger, enfermer dans une forme, ajouter un contour. Chaque interdit est une démonstration HTML réelle, montrée à côté de la version correcte, **avec sa raison**.

La page porte la mention : ces règles ont été construites pour ce site et ne sont validées par personne du côté de la marque.

- [ ] **Step 5: Déclarer les démonstrations fautives au contrôle design**

Les interdits sont volontairement laids. Pour chaque valeur signalée, exécuter `impeccable hooks ignore-value <règle> "<valeur>" --reason "démonstration d'un interdit : décidé par l'utilisateur le 2026-10-26"`. Jamais `ignore-file`.

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/ds-logo.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add design-system/assets/logo.svg design-system/js/logo.js design-system/logo.html tests/ds-logo.test.mjs
git commit -m "feat(ds): chapitre Logo, versions et exports"
```

---

### Task 7 : Chapitre Couleurs et dette de contraste

**Files:**
- Create: `design-system/js/dette.js`, `design-system/couleurs.html`
- Test: `tests/ds-dette.test.mjs`

**Interfaces:**
- Consumes: `ratio` (affichage), `ratioExact`, `verdict` (Task 1), `lireTokens`, `valeursDepuis` (Task 3).
- Produces: `PAIRES_KIT: {nom, texte, fond, px, gras}[]` — les paires réellement employées par `css/components.css` ; `tableauDetteHtml(paires, valeurs) -> string`.

- [ ] **Step 1: Write the failing test** dans `tests/ds-dette.test.mjs`

```js
test('les six badges du kit sont tous couverts', () => {
  const badges = PAIRES_KIT.filter((p) => p.nom.startsWith('badge'));
  assert.deepEqual(badges.map((p) => p.nom).sort(),
    ['badge--available', 'badge--borrowed', 'badge--hs', 'badge--late', 'badge--maintenance', 'badge--reserved']);
  for (const p of badges) { assert.equal(p.px, 11); assert.equal(p.gras, true); }
});

test('les ratios publiés sont ceux des vrais tokens', () => {
  const valeurs = valeursDepuis(readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8'));
  const r = (nom) => { const p = PAIRES_KIT.find((x) => x.nom === nom); return ratio(valeurs[p.texte], valeurs[p.fond]); };
  assert.equal(r('badge--maintenance'), 1.72);
  assert.equal(r('badge--available'), 2.49);
  assert.equal(r('badge--reserved'), 2.91);
  assert.equal(r('badge--hs'), 3.51);
  assert.equal(r('badge--late'), 3.54);
  assert.equal(r('badge--borrowed'), 8.23);
});

test('le tableau publié annonce cinq échecs et une seule conformité', () => {
  const valeurs = valeursDepuis(readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8'));
  const html = tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom.startsWith('badge')), valeurs);
  assert.equal((html.match(/échoue/g) || []).length, 5);
  assert.equal((html.match(/\bAA\b/g) || []).length, 1);
  assert.match(html, /1,72/);   // les ratios sont écrits à la française
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-dette.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement `dette.js` et la page Couleurs**

La page couvre, dans cet ordre : la tension entre le logo (turquoise, anthracite) et la couleur primaire du produit (violet), expliquée franchement ; les primitives ; les tokens sémantiques ; la règle « on écrit `var(--brand-primary)`, jamais `#662483` », avec sa raison ; puis le tableau de dette, chaque paire avec son ratio calculé et son verdict, présentée comme dette datée du 2026-10-26 et non comme modèle.

Ajouter les correctifs correspondants à `docs/correctifs-figma.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-dette.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/js/dette.js design-system/couleurs.html docs/correctifs-figma.md tests/ds-dette.test.mjs
git commit -m "feat(ds): chapitre Couleurs et dette de contraste publiée"
```

---

### Task 8 : Chapitres Typographie et Ton

**Files:**
- Create: `design-system/typographie.html`, `design-system/ton.html`, `design-system/exemples/typographie.html`
- Test: `tests/ds-typo.test.mjs`

**Interfaces:**
- Consumes: `cadreHtml` (Task 4), `enteteHtml` (Task 2).
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1: Write the failing test** dans `tests/ds-typo.test.mjs`

```js
test('toutes les classes typographiques de base.css sont documentées', () => {
  const base = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
  const classes = [...base.matchAll(/^\.([\w-]+)\s*\{[^}]*font-size/gm)].map((m) => m[1]);
  const exemple = readFileSync(new URL('../design-system/exemples/typographie.html', import.meta.url), 'utf8');
  for (const c of classes) assert.match(exemple, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} n’est pas montrée`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-typo.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement les deux chapitres**

Typographie : Bricolage Grotesque ExtraBold pour les titres, Inter pour le texte, l'échelle complète de `base.css` montrée en cadre, quand utiliser laquelle, et les interdits (mélanger les deux dans un titre, descendre sous `body-tiny` pour du texte courant).

Ton : limité à l'écriture dans les interfaces. Décrire le ton déjà en place dans le prototype plutôt que l'inventer — phrases courtes, pas de jargon, un message d'erreur dit quoi faire. Trois paires « au lieu de / écrire », prises dans les vrais textes du prototype.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-typo.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/typographie.html design-system/ton.html design-system/exemples/typographie.html tests/ds-typo.test.mjs
git commit -m "feat(ds): chapitres Typographie et Ton"
```

---

### Task 9 : Page Ressources

**Files:**
- Create: `design-system/ressources.html`, `design-system/js/telechargement.js`
- Test: `tests/ds-telechargement.test.mjs`

**Interfaces:**
- Consumes: `versionMono`, `tailleExport`, `TAILLES_PNG` (Task 6), `lireTokens` (Task 3).
- Produces: `nomFichier(version: 'couleur'|'blanc'|'anthracite', format: 'svg'|'png', largeur?: number) -> string` ; `tokensEnTexte(groupes) -> string`.

- [ ] **Step 1: Write the failing test** dans `tests/ds-telechargement.test.mjs`

```js
test('les noms de fichiers sont explicites et sans accent', () => {
  assert.equal(nomFichier('couleur', 'svg'), 'mds-logo-couleur.svg');
  assert.equal(nomFichier('blanc', 'png', 1200), 'mds-logo-blanc-1200.png');
  assert.equal(nomFichier('anthracite', 'png', 600), 'mds-logo-anthracite-600.png');
});

test('tokensEnTexte rend un bloc CSS collable, groupes commentés', () => {
  const texte = tokensEnTexte(lireTokens(':root { --brand-primary: #662483; }'));
  assert.match(texte, /^:root \{/);
  assert.match(texte, /\/\* Marque \*\//);
  assert.match(texte, /^ {2}--brand-primary: #662483;$/m);
  assert.match(texte, /\}$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-telechargement.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement la page et le module**

Trois versions du logo × SVG + PNG 600 et 1200, le bloc de tokens, et les liens Google Fonts. Les SVG dérivés et les PNG sont fabriqués au clic : `versionMono` puis un `canvas` à la taille de `tailleExport`, et un `Blob` téléchargé par un `<a download>`.

La page dit, en une phrase, pourquoi il n'y a pas de lien vers le Figma : le fichier est privé, et le site se suffit à lui-même.

- [ ] **Step 4: Vérifier un téléchargement réel**

Ouvrir la page via `npm run serve`, télécharger le PNG blanc 1200. Attendu : 1200 × 704, fond transparent, logo blanc.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/ds-telechargement.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add design-system/ressources.html design-system/js/telechargement.js tests/ds-telechargement.test.mjs
git commit -m "feat(ds): page Ressources et téléchargements dérivés"
```

---

### Task 10 : Composants — Badge, Avatar, Formulaires, Cartes

**Files:**
- Create: `design-system/composants/{badge,avatar,formulaires,cartes}.html`, `design-system/exemples/{badge,avatar,formulaires,cartes}.html`
- Test: `tests/ds-composants.test.mjs`

**Interfaces:**
- Consumes: `cadreHtml`, `brancherCadres` (Task 4), `formaterHtml`, `copier` (Task 5), `COMPOSANTS` (Task 2).
- Produces: le test `trame` que les Tasks 11 à 13 étendent à leurs pages.

- [ ] **Step 1: Write the failing test** dans `tests/ds-composants.test.mjs`

```js
test('chaque page de composant suit les six points de la trame', () => {
  for (const f of readdirSync(DOSSIER_COMPOSANTS).filter((f) => f.endsWith('.html') && f !== 'demarrer.html' && f !== 'fondations.html')) {
    const html = readFileSync(new URL(f, DOSSIER_COMPOSANTS), 'utf8');
    for (const ancre of ['a-quoi', 'exemple', 'variantes', 'code', 'quand-ne-pas', 'accessibilite']) {
      assert.match(html, new RegExp(`id="${ancre}"`), `${f} : section « ${ancre} » absente`);
    }
  }
});

test('toutes les variantes de badge du CSS sont montrées', () => {
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  const variantes = [...css.matchAll(/\.badge--([\w-]+)/g)].map((m) => m[1]);
  const exemple = readFileSync(new URL('../design-system/exemples/badge.html', import.meta.url), 'utf8');
  for (const v of new Set(variantes)) assert.match(exemple, new RegExp(`badge--${v}\\b`));
});

test('le tag — .chip — est documenté avec le badge, et distingué de lui', () => {
  // La page Figma s’appelle « Badge & Tag » : le .chip est le tag, et il est cliquable.
  const exemple = readFileSync(new URL('../design-system/exemples/badge.html', import.meta.url), 'utf8');
  assert.match(exemple, /class="chip"/);
  assert.match(exemple, /chip--active/);
  const page = readFileSync(new URL('../design-system/composants/badge.html', import.meta.url), 'utf8');
  assert.match(page, /\.chip/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-composants.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement les quatre paires de pages**

Chaque page suit la trame. Points obligatoires relevés dans le CSS : Badge couvre `.badge` **et** `.chip` — le « Tag » du Figma, qui est cliquable alors que le badge ne l'est pas, et c'est la différence qui décide lequel employer — et documente `badge(kind, value)` de `js/ui.js` comme la vraie façon d'en produire un, avec la table des familles (`item`, `loan`, `booking`, `maint`, `circuit`, `role`, `derived`) ; Avatar documente `avatar(user, size)` et les deux tailles `sm` / `md` ; Formulaires montre `.input:focus` (le seul focus stylé du dépôt) et nomme l'absence d'état de chargement ; Cartes couvre `.card`, `.card--flat`, `.card--item`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-composants.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/composants design-system/exemples tests/ds-composants.test.mjs
git commit -m "feat(ds): pages Badge, Avatar, Formulaires et Cartes"
```

---

### Task 11 : Composants — Tableau, KPI, Navigation, Icônes

**Files:**
- Create: `design-system/composants/{tableau,kpi,navigation,icones}.html`, `design-system/exemples/{tableau,kpi,navigation,icones}.html`
- Modify: `tests/ds-composants.test.mjs`

**Interfaces:**
- Consumes: idem Task 10.
- Produces: rien de nouveau.

Navigation est le premier composant à exister en deux versions incompatibles : `.tabs`/`.tab--active` dans `components.css`, `.tabs`/`.is-active` dans `admin.css`. Les deux sont documentées séparément et nommées, comme l'exige la spec §4.

- [ ] **Step 1: Write the failing test** — ajouter à `tests/ds-composants.test.mjs`

```js
test('les deux versions d’onglets sont documentées et distinguées', () => {
  const html = readFileSync(new URL('../design-system/composants/navigation.html', import.meta.url), 'utf8');
  assert.match(html, /tab--active/);
  assert.match(html, /is-active/);
  assert.match(html, /desktop/i);
});

test('les quatre teintes de carte KPI sont montrées', () => {
  const exemple = readFileSync(new URL('../design-system/exemples/kpi.html', import.meta.url), 'utf8');
  for (const v of ['disponible', 'emprunte', 'retard', 'salle']) assert.match(exemple, new RegExp(`kpi--${v}\\b`));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-composants.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement les quatre paires de pages**

Tableau : tri par `th[data-sortable]`, lignes cliquables `tr[data-href]`, et le manque de focus visible sur la ligne cliquable, nommé. KPI : les quatre teintes, `.kpi--link` et son `:focus-visible` — le seul correct du dépôt, cité en exemple. Navigation : `.nav-item`, son compteur, et les deux versions d'onglets. Icônes : l'inventaire des icônes réellement employées, et d'où elles viennent.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-composants.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/composants design-system/exemples tests/ds-composants.test.mjs
git commit -m "feat(ds): pages Tableau, KPI, Navigation et Icônes"
```

---

### Task 12 : Composants — Modale et retours, documentés comme une API

**Files:**
- Create: `design-system/composants/modale.html`, `design-system/exemples/modale.html`
- Modify: `tests/ds-composants.test.mjs`

**Interfaces:**
- Consumes: idem Task 10.
- Produces: rien de nouveau.

C'est la page qui justifie la décision de la spec §5 : personne ne doit écrire une modale à la main. Elle documente l'API de `js/ui.js`, pas du HTML à recopier.

- [ ] **Step 1: Write the failing test** — ajouter à `tests/ds-composants.test.mjs`

```js
test('la page Modale documente l’API JS, ses racines et ses manques', () => {
  const html = readFileSync(new URL('../design-system/composants/modale.html', import.meta.url), 'utf8');
  for (const attendu of ['openModal', 'closeModal', 'toast', 'modal-root', 'toast-root', 'has-modal']) {
    assert.match(html, new RegExp(attendu), `${attendu} n’est pas documenté`);
  }
  assert.match(html, /chappe/i);     // pas de fermeture au clavier : manque nommé
  assert.match(html, /focus/i);      // pas de piège de focus : manque nommé
});

test('les quatre variantes de toast et les trois d’alerte sont montrées', () => {
  const exemple = readFileSync(new URL('../design-system/exemples/modale.html', import.meta.url), 'utf8');
  for (const v of ['toast--success', 'toast--error', 'toast--warning', 'alert--warning', 'alert--error', 'alert--info']) {
    assert.match(exemple, new RegExp(v));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-composants.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement la page**

Documenter `openModal({title, body, actions, onClose})` — `body` est du HTML brut, donc l'appelant échappe lui-même via `escapeHtml` ; la valeur de retour ne ferme que SA modale ; `actions[].onClick` qui rend `false` garde la modale ouverte. Puis `toast(message, variant, ms)` et `closeModal()`. Dire ce que la page hôte doit contenir : `#modal-root`, `#toast-root`.

Nommer les deux manques : aucune fermeture par Échap, aucun piège de focus. Les reporter dans `docs/correctifs-figma.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-composants.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/composants/modale.html design-system/exemples/modale.html docs/correctifs-figma.md tests/ds-composants.test.mjs
git commit -m "feat(ds): page Modale et retours, API JS documentée"
```

---

### Task 13 : Motifs mobiles et page Démarrer

**Files:**
- Create: `design-system/composants/mobile.html`, `design-system/exemples/mobile-shell.html`, `design-system/exemples/mobile-listes.html`, `design-system/composants/demarrer.html`
- Modify: `tests/ds-composants.test.mjs`

**Interfaces:**
- Consumes: `cadreHtml` (Task 4), `COMPOSANTS` (Task 2).
- Produces: rien.

Les exemples mobiles sont les seuls autorisés à charger `css/mobile.css` ; ils se regardent dans un cadre étroit, à 390 px.

- [ ] **Step 1: Write the failing test** — ajouter à `tests/ds-composants.test.mjs`

```js
test('Démarrer donne l’ordre exact des feuilles et les racines à poser', () => {
  const html = readFileSync(new URL('../design-system/composants/demarrer.html', import.meta.url), 'utf8');
  const ordre = ['tokens.css', 'base.css', 'components.css'];
  let position = -1;
  for (const f of ordre) { const i = html.indexOf(f); assert.ok(i > position, `${f} est annoncé hors ordre`); position = i; }
  assert.match(html, /modal-root/);
  assert.match(html, /toast-root/);
});

test('Démarrer mène à toutes les pages de composants', () => {
  const html = readFileSync(new URL('../design-system/composants/demarrer.html', import.meta.url), 'utf8');
  for (const c of COMPOSANTS) assert.match(html, new RegExp(`href="${c.href}"`), `Démarrer ne mène pas à ${c.href}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-composants.test.mjs`
Expected: FAIL

- [ ] **Step 3: Implement les deux pages**

Mobile : le shell (`.m-shell`, `.m-nav` fixe), les listes et cartes, et pourquoi ces styles ne doivent pas être chargés ailleurs.

Démarrer : le chemin le plus court entre « on m'a demandé d'ajouter un écran » et « mon écran ressemble au reste » — les feuilles dans l'ordre, les racines `#modal-root` et `#toast-root`, les classes utilitaires qui existent déjà (`.stack`, `.row`, `.grid-2`, `.grid-4`), la règle `var(--token)` jamais de valeur en dur, et les liens vers chaque page de composant.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ds-composants.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add design-system/composants design-system/exemples tests/ds-composants.test.mjs
git commit -m "feat(ds): motifs mobiles et page Démarrer"
```

---

### Task 14 : Retrait de `kit.html` et extension des tests de publication

**Files:**
- Delete: `kit.html`
- Modify: `index.html`, `README.md`, `tests/deploiement.test.mjs`
- Test: `tests/deploiement.test.mjs`

**Interfaces:**
- Consumes: `design-system/index.html` (Task 2).
- Produces: rien.

`kit.html` rend `.kpi--brand` et `.kpi--teal`, deux classes absentes de `components.css` depuis un moment : ces cartes s'affichent en gris. C'est la dérive que ce site existe pour empêcher ; le fichier part entièrement, sans redirection, pour ne pas garder deux vérités.

- [ ] **Step 1: Write the failing test** — modifier `tests/deploiement.test.mjs`

```js
test('les pages du dépôt sont bien celles qu’on croit', () => {
  assert.deepEqual([...pages].sort(), ['admin.html', 'etiquettes.html', 'index.html', 'mobile.html']);
});

test('la page d’accueil mène aux trois interfaces et au design system', () => {
  const html = lire('index.html');
  for (const cible of ['admin.html', 'mobile.html', 'etiquettes.html', 'design-system/index.html']) {
    assert.match(html, new RegExp(`href="${cible}"`), `index.html ne mène pas à ${cible}`);
  }
});

test('les pages du design system tiennent les mêmes règles de publication', () => {
  // Pour design-system/*.html, composants/*.html et exemples/*.html :
  // aucune référence absente ni absolue (problemes(html, dossier)), et les
  // <link> de polices avant les feuilles, comme pour les pages de la racine.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/deploiement.test.mjs`
Expected: FAIL — `kit.html` est encore là et `index.html` pointe encore vers lui.

- [ ] **Step 3: Supprimer `kit.html` et rebrancher l'accueil**

`git rm kit.html`. Dans `index.html`, remplacer la carte « Kit de composants » par « Guide de marque & design system », vers `design-system/index.html`. Mettre à jour la section Documentation du `README.md`.

- [ ] **Step 4: Étendre le détecteur aux sous-dossiers**

Faire boucler les trois tests de publication sur les pages de `design-system/`, en passant leur dossier à `problemes(html, dossier)`.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, tous fichiers confondus.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ds): kit.html remplacé par le design system, publication vérifiée"
```

---

### Task 15 : Passe finale — clavier, largeur, cohérence

**Files:**
- Modify: ce qui ressort de la vérification
- Test: `tests/ds-socle.test.mjs`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: un site prêt pour la séance de test de la spec §12.

- [ ] **Step 1: Write the failing test** — ajouter à `tests/ds-socle.test.mjs`

```js
test('chaque page du design system a une hiérarchie de titres correcte', () => {
  // Un seul <h1>, et aucun saut de niveau (pas de h3 sans h2 avant lui).
});

test('chaque page du design system mène au reste du site', () => {
  // Toute page contient enteteHtml : lien vers l’accueil marque et vers Démarrer.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ds-socle.test.mjs`
Expected: FAIL sur les pages fautives.

- [ ] **Step 3: Corriger ce que le test révèle**

- [ ] **Step 4: Vérifier à l'œil ce qu'aucun test ne voit**

Via `npm run serve`, sur chaque page : à 360 px de large, aucun défilement horizontal ; à la tabulation, chaque élément interactif du **site** reçoit un contour visible ; les cadres d'exemple montrent bien le composant et pas une page entière.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(ds): hiérarchie des titres, clavier et largeur étroite"
```
