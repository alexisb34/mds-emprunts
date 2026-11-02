// Le socle du site de design system : sa palette, son chrome, son accueil.
// Le site s'impose 4,5:1 sur toutes ses paires texte/fond — un guide qui échoue à
// ses propres contrastes se discrédite en une page (spec §8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { ratioExact, verdict } from '../design-system/js/contraste.js';
import { PAIRES } from '../design-system/js/palette-site.js';
import { CHAPITRES, COMPOSANTS, RUPTURE_ETROITE, brancherSommaire, enteteHtml, piedHtml, sommaireHtml } from '../design-system/js/chrome.js';
import { pageHtml as pageLogo } from '../design-system/js/logo.js';
import { pageHtml as pageCouleurs } from '../design-system/js/couleurs.js';
import { pageHtml as pageRessources } from '../design-system/js/telechargement.js';
import { lireTokens, valeursDepuis, sommaireGroupesHtml, tableauTokensHtml } from '../design-system/js/tokens.js';

const lire = (chemin) => readFileSync(new URL(`../design-system/${chemin}`, import.meta.url), 'utf8');

// Les règles feuilles d'une feuille de style : `{sélecteurs, corps}`. Le motif ne peut pas
// traverser une accolade, donc un `@media` ne matche pas et ses règles internes, si.
function reglesDe(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteurs: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
    corps: m[2],
  }));
}

// Tout sélecteur qui peint un fond autre que le blanc du site : aplat, dégradé, survol.
// `--ds-fond` seul ne compte pas — c'est la couleur de la page.
function surfacesColorees(regles) {
  const surfaces = new Map();
  for (const r of regles) {
    for (const d of r.corps.matchAll(/\bbackground(?:-color|-image)?\s*:\s*([^;]+)/g)) {
      const valeur = d[1].replace(/\s+/g, ' ').trim();
      const colore = /gradient\(/.test(valeur)
        || [...valeur.matchAll(/var\(\s*(--[\w-]+)/g)].some((m) => m[1] !== '--ds-fond');
      if (colore) for (const s of r.selecteurs) surfaces.set(s, valeur);
    }
  }
  return surfaces;
}

// Les `--ds-*` du `:root` de site.css, avec leur valeur hexadécimale.
function valeursDuSite() {
  const css = lire('css/site.css');
  const racine = css.match(/:root\s*\{([^}]*)\}/)[1];
  return Object.fromEntries(
    [...racine.matchAll(/(--ds-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)].map((m) => [m[1], m[2]]),
  );
}

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

// ---- Ce que les assertions du plan ne couvrent pas, et qui tient quand même le socle ----

test('la palette ne déclare aucune couleur qu’elle n’emploie pas', () => {
  // Une couleur déclarée et jamais posée est une intention, pas une palette : les treize
  // tâches suivantes la reprendraient sans savoir à quoi elle sert.
  const css = lire('css/site.css');
  for (const nom of Object.keys(valeursDuSite())) {
    assert.ok(css.includes(`var(${nom})`), `${nom} est déclaré mais jamais utilisé dans site.css`);
  }
});

test('toute surface colorée dit quelle couleur y prend le texte discret', () => {
  // `--ds-texte-secondaire` tient 4,55:1 sur blanc et tombe à 3,9:1 sur un aplat pastel.
  //
  // Ce test ne vérifie PAS une liste de surfaces écrite à la main : il la DÉRIVE des
  // déclarations `background` de la feuille. Une surface colorée ajoutée par une tâche
  // future sans son `--ds-discret` fait donc échouer la suite — c'est précisément le
  // trou par lequel `.ds-hero` était passé.
  const regles = reglesDe(lire('css/site.css'));

  // 1. Le texte discret lit bien `--ds-discret`, et dans une vraie déclaration `color`.
  for (const classe of ['.ds-oeil', '.text-secondary']) {
    const porte = regles.some((r) => r.selecteurs.includes(classe)
      && /(?:^|;)\s*color\s*:[^;]*var\(\s*--ds-discret/.test(r.corps));
    assert.ok(porte, `${classe} ne prend pas sa couleur de --ds-discret`);
  }

  // 2. Qui déclare `--ds-discret`, et avec quelle couleur.
  const valeurs = valeursDuSite();
  const declare = new Map();
  for (const r of regles) {
    const m = r.corps.match(/--ds-discret\s*:\s*([^;]+)/);
    if (!m) continue;
    for (const s of r.selecteurs) declare.set(s, m[1].trim());
  }
  for (const [selecteur, valeur] of declare) {
    const nom = (valeur.match(/var\(\s*(--[\w-]+)/) || [])[1];
    assert.ok(nom && valeurs[nom], `${selecteur} : --ds-discret vaut « ${valeur} », qui n’est pas une couleur mesurée du :root`);
  }

  // 3. Chaque fond coloré de la feuille doit s'y trouver.
  const surfaces = surfacesColorees(regles);
  assert.ok(surfaces.size >= 10, `le détecteur ne voit plus que ${surfaces.size} fonds colorés : il a cessé de chercher`);
  const nues = [...surfaces.keys()].filter((s) => !declare.has(s));
  assert.deepEqual(nues, [], 'ces surfaces colorées ne déclarent pas --ds-discret : le texte discret y tombe sous 4,5:1');
});

test('le site ne pose aucune valeur de couleur en dur hors de son :root', () => {
  // Hors du `:root`, tout vient de `tokens.css` ou des `--ds-*` : c'est la contrainte
  // globale du plan, et le seul moyen qu'un token changé change le site.
  // Les commentaires citent des couleurs (« sur #f2f4f8 il tomberait à 4,13:1 ») : on juge
  // la feuille, pas sa prose.
  const css = lire('css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const horsRacine = css.replace(/:root\s*\{[^}]*\}/, '');
  const enDur = [...horsRacine.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map((m) => m[0]);
  assert.deepEqual(enDur, [], 'site.css pose des couleurs en dur hors de son :root');
});

test('l’en-tête mène aux deux étages depuis n’importe quelle profondeur', () => {
  // Depuis une page de `composants/`, les liens du site remontent d'un cran : sans ça,
  // « Logo » viserait `composants/logo.html`, qui n'existera jamais.
  const racine = enteteHtml('index.html');
  assert.match(racine, /href="index\.html"/);
  assert.match(racine, /href="composants\/demarrer\.html"/);

  // Une seule règle d'adresse pour tout le site : l'adresse relative à `design-system/`,
  // précédée d'autant de `../` qu'il faut. Depuis `composants/`, l'étage composants se
  // désigne donc par `../composants/…`, qui se résout bien dans le même dossier.
  const profond = enteteHtml('composants/badge.html');
  assert.match(profond, /href="\.\.\/index\.html"/);
  assert.match(profond, /href="\.\.\/logo\.html"/);
  assert.match(profond, /href="\.\.\/composants\/demarrer\.html"/);
  assert.doesNotMatch(profond, /href="(?!\.\.\/|#)/, 'une adresse du chrome ne remonte pas');

  // Le pied suit la même convention, et s'en passe à la racine.
  assert.match(piedHtml(), /href="index\.html"/);
  assert.match(piedHtml('composants/badge.html'), /href="\.\.\/index\.html"/);
});

test('l’en-tête signale l’étage composants sans mentir sur la page courante', () => {
  // Sur une page de composant, la page courante est marquée par le sommaire latéral ;
  // l'en-tête ne dit que « vous êtes dans cet étage ».
  const profond = enteteHtml('composants/badge.html');
  assert.equal((profond.match(/aria-current="page"/g) || []).length, 0);
  assert.equal((profond.match(/aria-current="true"/g) || []).length, 1);

  // Démarrer est bien la page courante quand on y est, et une seule fois.
  const demarrer = enteteHtml('composants/demarrer.html');
  assert.equal((demarrer.match(/aria-current="page"/g) || []).length, 1);
  assert.equal((demarrer.match(/aria-current="true"/g) || []).length, 0);
});

test('l’en-tête porte le logo officiel et un lien d’évitement', () => {
  const html = enteteHtml('index.html');
  assert.match(html, /src="assets\/logo\.svg"/);
  assert.match(html, /alt="[^"]+"/);
  // Le premier élément focalisable saute la navigation : chaque page porte `id="contenu"`.
  assert.match(html, /href="#contenu"/);
  assert.ok(html.indexOf('href="#contenu"') < html.indexOf('assets/logo.svg'), 'le lien d’évitement passe avant le logo');
});

test('le sommaire des composants marque la page courante et une seule', () => {
  const html = sommaireHtml('composants/badge.html');
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /href="\.\.\/composants\/badge\.html"[^>]*aria-current="page"/);
  // Il mène à toutes les pages de l'étage, Démarrer compris, par la même convention
  // d'adresse que l'en-tête.
  for (const c of COMPOSANTS) {
    assert.match(html, new RegExp(`href="\\.\\./${c.href}"`), `le sommaire ne mène pas à ${c.href}`);
  }
});

test('les chapitres et les composants sont une liste propre', () => {
  for (const [nom, liste] of [['CHAPITRES', CHAPITRES], ['COMPOSANTS', COMPOSANTS]]) {
    assert.ok(liste.length > 0, `${nom} est vide`);
    const href = liste.map((e) => e.href);
    assert.deepEqual([...new Set(href)], href, `${nom} a deux fois la même adresse`);
    for (const e of liste) {
      assert.ok(e.titre && e.titre.trim(), `${nom} : un titre vide pour ${e.href}`);
      assert.match(e.href, /^[a-z0-9/-]+\.html$/, `${nom} : ${e.href} n’est pas une adresse relative simple`);
    }
  }
  // Les chapitres de la marque sont à la racine, les composants dans leur dossier.
  for (const c of CHAPITRES) assert.doesNotMatch(c.href, /\//, `${c.href} ne doit pas être dans un sous-dossier`);
  for (const c of COMPOSANTS) assert.match(c.href, /^composants\//, `${c.href} doit être dans composants/`);
  // Chaque chapitre porte un résumé : c'est le texte des cartes de l'accueil.
  for (const c of CHAPITRES) assert.ok(c.resume && c.resume.trim(), `${c.href} n’a pas de résumé`);
  assert.ok(COMPOSANTS.some((c) => c.href === 'composants/demarrer.html'), 'Démarrer manque à l’étage composants');
});

test('le pied rappelle que ces règles ne sont pas une charte approuvée', () => {
  // Les fichiers sont servis publiquement : personne ne doit prendre ce site pour une
  // charte validée du côté de la marque (spec §9).
  const html = piedHtml();
  assert.match(html, /<footer/);
  assert.match(html, /valid/i);
  assert.match(html, /href="index\.html"/);
});

test('l’accueil charge les polices avant ses feuilles et reste relatif', () => {
  const html = lire('index.html');
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'index.html ne charge pas les polices par <link>');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'), 'preconnect googleapis');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'), 'preconnect gstatic');
  assert.ok(famille < html.indexOf('href="../css/tokens.css"'), 'les polices passent avant nos feuilles');
  // Publié dans un sous-répertoire : aucun chemin absolu, et les feuilles du dépôt sont au-dessus.
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
  assert.match(html, /href="\.\.\/css\/tokens\.css"/);
  assert.match(html, /href="css\/site\.css"/);
});

test('l’accueil a un seul h1, et c’est la signature de l’école', () => {
  const html = lire('index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1[^>]*>\s*Les talents se connectent\s*<\/h1>/);
  // Le lien d'évitement de l'en-tête a besoin de sa cible.
  assert.match(html, /id="contenu"/);
});

// ---- Le sommaire escamotable ----
// Treize liens avant le premier titre feraient un écran entier de téléphone, et un écran de
// bureau zoomé à 200 % est dans le même cas (WCAG 1.4.10). Sous 900 px le sommaire se replie en
// un seul arrêt de tabulation, EN TÊTE de page : il ne change pas de place dans le balisage,
// donc ce qu'on voit, ce qu'on lit et ce qu'on parcourt au clavier restent dans le même ordre.

test('le sommaire est un <details> rendu ouvert, avec un résumé et sa navigation', () => {
  const html = sommaireHtml('composants/badge.html');
  assert.match(html, /^<details class="ds-sommaire" open>/);
  assert.match(html, /<summary class="ds-sommaire__resume[^"]*">[^<]+<\/summary>/);
  assert.match(html, /<nav class="ds-sommaire__corps" aria-label="[^"]+">/);
  assert.ok(html.indexOf('<summary') < html.indexOf('<nav'), 'le résumé précède la navigation');
});

// Un faux document et une fausse fenêtre : `brancherSommaire` ne doit rien exiger d'autre.
function decor(etroit) {
  const sommaire = { open: true };
  const ecouteurs = [];
  const requete = { matches: etroit, addEventListener: (type, f) => ecouteurs.push([type, f]) };
  const requetes = [];
  return {
    sommaire, requete, ecouteurs, requetes,
    doc: { querySelector: (s) => (s === '.ds-sommaire' ? sommaire : null) },
    fenetre: { matchMedia: (q) => { requetes.push(q); return requete; } },
  };
}

test('brancherSommaire replie le sommaire sous la rupture et le laisse ouvert au-dessus', () => {
  const etroit = decor(true);
  brancherSommaire(etroit.doc, etroit.fenetre);
  assert.equal(etroit.sommaire.open, false);
  const large = decor(false);
  brancherSommaire(large.doc, large.fenetre);
  assert.equal(large.sommaire.open, true);
});

test('brancherSommaire suit la fenêtre quand elle change de taille ou de zoom', () => {
  const d = decor(false);
  brancherSommaire(d.doc, d.fenetre);
  assert.deepEqual(d.ecouteurs.map(([type]) => type), ['change']);
  d.requete.matches = true;
  d.ecouteurs[0][1]();
  assert.equal(d.sommaire.open, false, 'la fenêtre se resserre : il se replie');
  d.requete.matches = false;
  d.ecouteurs[0][1]();
  assert.equal(d.sommaire.open, true, 'elle s’élargit : il se rouvre');
});

test('brancherSommaire ne casse rien sans sommaire ni matchMedia', () => {
  brancherSommaire({ querySelector: () => null }, { matchMedia: () => { throw new Error('inutile'); } });
  const sommaire = { open: true };
  brancherSommaire({ querySelector: () => sommaire }, {});
  assert.equal(sommaire.open, true, 'sans matchMedia, il reste ouvert : le repli est correct');
});

test('la rupture du script est celle de la feuille, et le résumé n’existe que dessous', () => {
  const css = lire('css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(RUPTURE_ETROITE, 900);
  const debut = css.indexOf(`@media (max-width: ${RUPTURE_ETROITE}px)`);
  const fin = css.indexOf('@media (max-width: 600px)');
  assert.ok(debut >= 0 && fin > debut, `aucun @media (max-width: ${RUPTURE_ETROITE}px) dans site.css`);
  const etroit = css.slice(debut, fin);
  const large = css.replace(etroit, '');
  // Au-dessus : colonne ouverte, résumé caché. En dessous : résumé visible.
  assert.match(large, /\.ds-sommaire__resume\s*\{\s*display:\s*none/);
  assert.match(etroit, /\.ds-sommaire__resume\s*\{[^}]*display:\s*flex/);
  // Et le sommaire ne change jamais de place visuelle : pas d'`order` pour le déplacer.
  assert.doesNotMatch(css, /\.ds-sommaire\s*\{[^}]*\border:/);
});

// Le CSS suppose que le sommaire et `<main>` sont les deux enfants directs de `.ds-colonnes`.
// Douze pages vont s'y conformer ; ce test dit laquelle ne le fait pas.
function enfantsDirects(html, classe) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const ouverture = source.match(new RegExp(`<div class="${classe}"[^>]*>`));
  if (!ouverture) return null;
  const VIDES = new Set(['br', 'img', 'input', 'link', 'meta', 'hr', 'source', 'wbr']);
  let profondeur = 1;
  const enfants = [];
  for (const m of source.slice(ouverture.index + ouverture[0].length).matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi)) {
    const [, ferme, nom, attributs] = m;
    if (VIDES.has(nom.toLowerCase()) || attributs.trimEnd().endsWith('/')) { if (profondeur === 1) enfants.push(nom.toLowerCase()); continue; }
    if (ferme) { profondeur -= 1; if (profondeur === 0) break; continue; }
    if (profondeur === 1) enfants.push(`${nom.toLowerCase()}${/id="([^"]+)"/.test(attributs) ? `#${attributs.match(/id="([^"]+)"/)[1]}` : ''}`);
    profondeur += 1;
  }
  return enfants;
}

test('chaque page de l’étage composants met le sommaire et <main> côte à côte dans .ds-colonnes', () => {
  const dossier = new URL('../design-system/composants/', import.meta.url);
  const pages = readdirSync(dossier).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 0, 'aucune page dans composants/ : le test ne voit plus rien');
  for (const page of pages) {
    const html = readFileSync(new URL(page, dossier), 'utf8');
    const enfants = enfantsDirects(html, 'ds-colonnes');
    assert.ok(enfants, `${page} : pas de <div class="ds-colonnes">`);
    assert.deepEqual(enfants, ['div#sommaire', 'main#contenu'],
      `${page} : .ds-colonnes doit contenir exactement <div id="sommaire"> puis <main id="contenu"> comme enfants directs — la feuille replie le sommaire sous 900 px en comptant dessus`);
    assert.match(html, /sommaireHtml\('composants\/[a-z0-9-]+\.html'\)/, `${page} ne pose pas le sommaire`);
    assert.match(html, /brancherSommaire\(\)/, `${page} n’appelle pas brancherSommaire() : le sommaire resterait ouvert sur téléphone`);

    // Et l'adresse passée au chrome est celle de CETTE page. Les douze pages de l'étage
    // naissent par copier-coller : une page recopiée qui garde le nom de l'autre marque la
    // mauvaise entrée du sommaire et le mauvais `aria-current`, sans qu'aucune erreur
    // n'apparaisse. Vérifier la forme de l'adresse ne suffit pas, il faut vérifier sa valeur.
    for (const [, fonction, adresse] of html.matchAll(/\b(enteteHtml|sommaireHtml|piedHtml)\('([^']*)'\)/g)) {
      assert.equal(adresse, `composants/${page}`,
        `${page} : ${fonction}('${adresse}') — le chrome reçoit l’adresse d’une AUTRE page, donc le sommaire marquerait la mauvaise entrée comme courante`);
    }
  }
});

test('le détecteur d’enfants directs voit bien un enfant mal placé', () => {
  // Garde le test précédent honnête : s'il ne savait pas échouer, il ne protégerait rien.
  const bon = '<div class="ds-colonnes"><div id="sommaire"></div><main id="contenu"><div><p>x</p></div></main></div>';
  const mauvais = '<div class="ds-colonnes"><div class="cadre"><div id="sommaire"></div><main id="contenu"></main></div></div>';
  assert.deepEqual(enfantsDirects(bon, 'ds-colonnes'), ['div#sommaire', 'main#contenu']);
  assert.deepEqual(enfantsDirects(mauvais, 'ds-colonnes'), ['div']);
});

// ---- La passe finale : titres et entrée dans le site, sur toutes les pages ----
//
// « Toutes les pages » est ici `design-system/*.html` et `design-system/composants/*.html` : les
// dix-neuf pages qu'une personne ouvre. Les fichiers de `design-system/exemples/` sont des pages
// isolées, rendues dans un cadre, qui ne chargent que les feuilles de l'outil : leur mettre
// l'en-tête du site contredirait la décision centrale du projet (le cadre montre le composant, rien
// d'autre). Ils sont tenus par tests/ds-cadre.test.mjs et tests/deploiement.test.mjs.

const PAGES_DU_SITE = ['index.html', ...CHAPITRES.map((c) => c.href), ...COMPOSANTS.map((c) => c.href)];

// Le HTML qu'une personne verra, pas celui du fichier : quatre pages remplacent leur contenu par
// un module (logo, couleurs, ressources) ou y ajoutent le tableau des tokens (fondations). On
// reconstitue ce que ces modules posent, avec les vraies fonctions et les vraies feuilles.
const TOKENS_CSS = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const SOURCES_LOGO = { couleur: 'assets/logo.svg', blanc: 'blob:blanc', anthracite: 'blob:anthracite', violet: 'blob:violet' };
function htmlRendu(page) {
  const html = lire(page);
  const dans = (motif, contenu) => {
    const m = html.match(motif);
    assert.ok(m, `${page} : l'endroit où le module pose son contenu n'est plus là`);
    return html.replace(m[0], m[1] + contenu + m[2]);
  };
  if (page === 'logo.html') return dans(/(<main id="contenu">)[\s\S]*?(<\/main>)/, pageLogo(SOURCES_LOGO));
  if (page === 'couleurs.html') return dans(/(<main id="contenu">)[\s\S]*?(<\/main>)/, pageCouleurs(valeursDepuis(TOKENS_CSS)));
  if (page === 'ressources.html') return dans(/(<main id="contenu">)[\s\S]*?(<\/main>)/, pageRessources({ sources: SOURCES_LOGO, groupes: lireTokens(TOKENS_CSS) }));
  if (page === 'composants/fondations.html') {
    const groupes = lireTokens(TOKENS_CSS);
    return dans(/(<div id="tokens"[^>]*>)[\s\S]*?(<\/div>\s*<\/main>)/, sommaireGroupesHtml(groupes) + tableauTokensHtml(groupes));
  }
  return html;
}

// Les niveaux de titre dans l'ordre du document, hors scripts et commentaires.
const niveaux = (html) => [...html.replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, '').matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
// Le défaut d'une suite de niveaux, ou null : un seul h1 qui ouvre la page, jamais de saut vers le bas.
function defautDeTitres(suite) {
  if (suite.filter((n) => n === 1).length !== 1) return `${suite.filter((n) => n === 1).length} h1 au lieu d'un`;
  if (suite[0] !== 1) return `la page s'ouvre sur un h${suite[0]}`;
  for (let i = 1; i < suite.length; i++) if (suite[i] - suite[i - 1] > 1) return `saut de h${suite[i - 1]} à h${suite[i]} (titre n° ${i + 1})`;
  return null;
}

test('chaque page du design system a une hiérarchie de titres correcte', () => {
  assert.equal(PAGES_DU_SITE.length, 19, 'le site n’a plus dix-neuf pages : la liste ou le chrome a changé');
  for (const page of PAGES_DU_SITE) {
    const suite = niveaux(htmlRendu(page));
    assert.ok(suite.length >= 4, `${page} : ${suite.length} titres seulement, la page rendue n'est pas celle qu'on croit`);
    assert.equal(defautDeTitres(suite), null, `${page} : ${defautDeTitres(suite)}`);
  }
});

test('le détecteur de titres voit un saut de niveau, un h1 en trop et une page sans h1', () => {
  assert.equal(defautDeTitres([1, 2, 3, 2, 3]), null);
  assert.equal(defautDeTitres([1, 3]), 'saut de h1 à h3 (titre n° 2)');
  assert.equal(defautDeTitres([1, 2, 4]), 'saut de h2 à h4 (titre n° 3)');
  assert.equal(defautDeTitres([1, 2, 1]), '2 h1 au lieu d\'un');
  assert.equal(defautDeTitres([2, 3]), '0 h1 au lieu d\'un');
  // Remonter d'un coup est permis : on ferme une section.
  assert.equal(defautDeTitres([1, 2, 3, 4, 2]), null);
});

test('le rendu reconstitué des quatre pages construites par un module garde leur h1 unique', () => {
  // Garde le test précédent honnête : le contenu du fichier seul (message d'attente compris) ne dit
  // pas ce qu'on verra, et un module qui ajouterait un second h1 passerait inaperçu sans cela.
  for (const page of ['logo.html', 'couleurs.html', 'ressources.html', 'composants/fondations.html']) {
    assert.notEqual(htmlRendu(page), lire(page), `${page} : le rendu n'a rien remplacé`);
    assert.equal(niveaux(htmlRendu(page)).filter((n) => n === 1).length, 1, `${page} : un seul h1 attendu une fois le module passé`);
  }
});

test('chaque page du design system mène au reste du site', () => {
  for (const page of PAGES_DU_SITE) {
    const html = lire(page);
    const dossier = page.includes('/') ? 'composants/' : '';
    // La page pose l'en-tête et le pied, avec SA propre adresse (voir le test de composants/ plus haut).
    assert.ok(html.includes('<div id="entete"></div>'), `${page} : pas d'emplacement pour l'en-tête`);
    assert.ok(html.includes(`document.getElementById('entete').outerHTML = enteteHtml('${page}');`), `${page} ne pose pas enteteHtml('${page}')`);
    assert.ok(html.includes('<div id="pied"></div>'), `${page} : pas d'emplacement pour le pied`);
    assert.match(html, new RegExp(`document\\.getElementById\\('pied'\\)\\.outerHTML = piedHtml\\(${dossier ? `'${page}'` : ''}\\);`), `${page} ne pose pas son pied`);
    assert.ok(html.includes(`from '${dossier ? '../' : './'}js/chrome.js'`), `${page} n'importe pas le chrome depuis le bon dossier`);

    // Ce que le chrome écrit pour CETTE page : le lien de la marque vers l'accueil, l'entrée de
    // l'étage composants, et chaque chapitre ; et chacune de ces adresses mène à un fichier réel.
    const chrome = enteteHtml(page) + piedHtml(dossier ? page : '');
    const base = dossier ? '../' : '';
    assert.ok(chrome.includes(`href="${base}index.html"`), `${page} : le chrome ne ramène pas à l'accueil`);
    assert.ok(chrome.includes(`href="${base}composants/demarrer.html"`), `${page} : le chrome ne mène pas à Démarrer`);
    for (const c of CHAPITRES) assert.ok(chrome.includes(`href="${base}${c.href}"`), `${page} : le chrome ne mène pas à ${c.titre}`);
    for (const [, cible] of chrome.matchAll(/href="([^"#]+)"/g)) {
      const fichier = posix.normalize(posix.join(dossier, cible));
      assert.doesNotThrow(() => readFileSync(new URL(`../design-system/${fichier}`, import.meta.url)), `${page} : ${cible} mène à ${fichier}, qui n'existe pas`);
    }
  }
});
