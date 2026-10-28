// La page Ressources : les noms de fichiers, le bloc de tokens à coller, les liens des polices.
//
// Ce que ce fichier tient, et ce qu'il ne tient pas :
//   - il compare les NOMS de fichiers produits par `nomFichier` à ceux que le chapitre Logo écrit
//     vraiment (le HTML de `logo.js` et le geste de `brancherExports`) : un nom ne peut pas diverger
//     entre les deux pages sans que cela se voie ici ;
//   - il compare le bloc de tokens à `css/tokens.css` : chaque déclaration du fichier s'y retrouve,
//     et relire le texte rendu redonne les mêmes tokens (aller-retour) ;
//   - il compare le bloc de polices à celui que `index.html` écrit dans son <head> ;
//   - il lit le HTML que `pageHtml` RENDRA ;
//   - il NE télécharge RIEN. Qu'un PNG se fabrique, qu'il fasse 1200 × 704 sur fond transparent, que le
//     bouton « Copier » copie : cela se vérifie dans un navigateur, et le rapport de la tâche dit ce qui
//     y a été vu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nomFichier, tokensEnTexte, LIENS_POLICES, pageHtml } from '../design-system/js/telechargement.js';
import { lireTokens, GROUPES } from '../design-system/js/tokens.js';
import { VERSIONS, TAILLES_PNG, brancherExports, pageHtml as pageLogo } from '../design-system/js/logo.js';
import { CHAPITRES, enteteHtml } from '../design-system/js/chrome.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const texte = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const deshabiller = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// ---- Les assertions du brief, telles quelles ----

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

// ---- nomFichier ----

test('chaque nom possible est en minuscules sans accent ni espace, et distinct des autres', () => {
  const noms = [];
  for (const v of VERSIONS) {
    noms.push(nomFichier(v.id, 'svg'));
    for (const l of TAILLES_PNG) noms.push(nomFichier(v.id, 'png', l));
  }
  assert.equal(noms.length, 9);
  assert.equal(new Set(noms).size, 9, 'deux noms identiques : un téléchargement écraserait l’autre');
  for (const n of noms) assert.match(n, /^mds-logo-[a-z]+(?:-\d+)?\.(?:svg|png)$/, n);
});

test('nomFichier refuse ce qu’il ne sait pas nommer', () => {
  assert.throws(() => nomFichier('rose', 'svg'), /version/i);
  assert.throws(() => nomFichier('couleur', 'gif'), /format/i);
  assert.throws(() => nomFichier('couleur', 'png'), /largeur/i);
  assert.throws(() => nomFichier('couleur', 'png', 0), /largeur/i);
  assert.throws(() => nomFichier('couleur', 'png', 12.5), /largeur/i);
  assert.throws(() => nomFichier('couleur', 'png', '600'), /largeur/i);
  assert.throws(() => nomFichier(undefined, 'svg'), /version/i);
});

test('un SVG n’a pas de largeur dans son nom : il se redimensionne sans perte', () => {
  assert.equal(nomFichier('blanc', 'svg', 1200), 'mds-logo-blanc.svg');
});

test('les versions que nomFichier connaît sont celles du chapitre Logo, et seulement elles', () => {
  for (const v of VERSIONS) assert.doesNotThrow(() => nomFichier(v.id, 'svg'), v.id);
  assert.equal(VERSIONS.length, 3);
  // Le violet n'est qu'un contre-exemple du chapitre Logo : il n'a pas de nom de fichier.
  assert.throws(() => nomFichier('violet', 'svg'));
});

test('les noms de nomFichier sont ceux que le chapitre Logo écrit et télécharge', async () => {
  const sources = { couleur: 'assets/logo.svg', blanc: 'blob:blanc', anthracite: 'blob:anthracite', violet: 'blob:violet' };
  // 1. Les liens SVG du HTML du chapitre Logo.
  const logo = pageLogo(sources);
  for (const v of VERSIONS) assert.ok(logo.includes(`download="${nomFichier(v.id, 'svg')}"`), `logo.html n’écrit plus ${nomFichier(v.id, 'svg')}`);
  // 2. Le nom que `brancherExports` donne à chaque PNG, vu à travers ce qu'il télécharge.
  const noms = [];
  let ecoute;
  const racine = { addEventListener: (t, f) => { ecoute = f; }, querySelector: () => ({ textContent: '' }) };
  brancherExports(racine, sources, { fabriquer: async () => 'octets', telecharger: (blob, nom) => noms.push(nom) });
  for (const v of VERSIONS) {
    for (const l of TAILLES_PNG) await ecoute({ target: { closest: () => ({ dataset: { version: v.id, largeur: String(l) } }) } });
  }
  assert.deepEqual(noms, VERSIONS.flatMap((v) => TAILLES_PNG.map((l) => nomFichier(v.id, 'png', l))));
});

// ---- tokensEnTexte ----

const TOKENS_CSS = () => lire('css/tokens.css');

test('tokensEnTexte reprend chaque déclaration de css/tokens.css, avec la même valeur', () => {
  const sortie = tokensEnTexte(lireTokens(TOKENS_CSS()));
  const sansCommentaires = TOKENS_CSS().replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = [...sansCommentaires.matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g)].map((m) => [m[1], m[2].trim()]);
  assert.ok(declarations.length >= 60, `${declarations.length} déclarations lues : le détecteur ne voit plus tokens.css`);
  for (const [nom, valeur] of declarations) assert.ok(sortie.includes(`  ${nom}: ${valeur};\n`), `${nom} : ${valeur} n’est pas dans le bloc`);
  // Et pas une de plus.
  assert.equal([...sortie.matchAll(/^ {2}--[\w-]+:/gm)].length, declarations.length);
});

test('relire le bloc rendu redonne les mêmes tokens, dans les mêmes groupes', () => {
  const groupes = lireTokens(TOKENS_CSS());
  assert.deepEqual(lireTokens(tokensEnTexte(groupes)), groupes);
});

test('chaque groupe non vide est annoncé par un commentaire de son titre, dans l’ordre de GROUPES ; un groupe vide est omis', () => {
  const groupes = lireTokens(TOKENS_CSS());
  const sortie = tokensEnTexte(groupes);
  const commentaires = [...sortie.matchAll(/^ {2}\/\* (.+) \*\/$/gm)].map((m) => m[1]);
  assert.deepEqual(commentaires, groupes.filter((g) => g.tokens.length).map((g) => g.titre));
  assert.deepEqual(commentaires, GROUPES.map((g) => g.titre).filter((t) => commentaires.includes(t)), 'l’ordre n’est pas celui de GROUPES');
  assert.ok(!commentaires.includes('Autres'), 'le groupe « Autres » est vide : il ne doit pas apparaître');
  // Un token inconnu d'un groupe va dans « Autres », et le bloc le dit.
  const avec = tokensEnTexte(lireTokens(':root { --zzz-nouveau: 1px; }'));
  assert.match(avec, /\/\* Autres \*\/\n {2}--zzz-nouveau: 1px;/);
});

test('le bloc est un :root complet (une accolade ouvrante, une fermante, rien après), avec une ligne vide entre deux groupes', () => {
  const sortie = tokensEnTexte(lireTokens(TOKENS_CSS()));
  assert.ok(sortie.startsWith(':root {\n'));
  assert.ok(sortie.endsWith('\n}'));
  assert.equal((sortie.match(/\{/g) || []).length, 1);
  assert.equal((sortie.match(/\}/g) || []).length, 1);
  // Une ligne vide sépare deux groupes, et aucune ligne n'a d'espace en fin.
  assert.doesNotMatch(sortie, /[ \t]+$/m);
  assert.doesNotMatch(sortie, /\n\n\n/);
  const commentaires = [...sortie.matchAll(/^ {2}\/\* .+ \*\/$/gm)];
  assert.ok(commentaires.length >= 10, 'le détecteur ne voit plus les groupes');
  commentaires.slice(1).forEach((c) => assert.equal(sortie.slice(c.index - 2, c.index), '\n\n', `une ligne vide doit précéder ${c[0].trim()}`));
});

test('un bloc sans aucun token reste un :root valide', () => {
  assert.equal(tokensEnTexte(lireTokens('')), ':root {\n}');
});

// ---- Les polices ----

test('le bloc de polices est, mot pour mot, celui que index.html écrit dans son <head>', () => {
  const index = lire('design-system/index.html');
  const lignes = [
    index.match(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/)[0],
    index.match(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/)[0],
    index.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/)[0],
  ];
  assert.equal(LIENS_POLICES, lignes.join('\n'));
  // Et c'est aussi ce que l'outil d'emprunt charge : la page ne ment pas en disant « comme l'outil ».
  for (const page of ['index.html', 'admin.html', 'mobile.html']) assert.ok(lire(page).includes(lignes[2]), `${page} charge d’autres polices`);
});

// ---- La page ----

const SOURCES = { couleur: 'assets/logo.svg', blanc: 'blob:blanc', anthracite: 'blob:anthracite', violet: 'blob:violet' };
const GROUPES_REELS = lireTokens(TOKENS_CSS());
const PAGE = pageHtml({ sources: SOURCES, groupes: GROUPES_REELS });

test('pageHtml refuse une source ou des tokens manquants', () => {
  assert.throws(() => pageHtml({ sources: { ...SOURCES, blanc: '' }, groupes: GROUPES_REELS }), /blanc/);
  assert.throws(() => pageHtml({ sources: SOURCES, groupes: [] }), /token/i);
  assert.throws(() => pageHtml({ sources: SOURCES }), /token/i);
});

test('la page a un seul h1 « Les ressources », ne saute aucun niveau de titre, et a ses quatre sections', () => {
  assert.equal((PAGE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE, /<h1[^>]*>\s*Les ressources\s*<\/h1>/);
  const niveaux = [...PAGE.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaux.length; i++) assert.ok(niveaux[i] - niveaux[i - 1] <= 1, `un titre saute de h${niveaux[i - 1]} à h${niveaux[i]}`);
  for (const id of ['versions', 'tokens', 'polices', 'figma']) assert.match(PAGE, new RegExp(`<section[^>]*id="${id}"`), `section ${id} absente`);
});

test('aucune étiquette en capitales, et aucune classe que la feuille ne connaît pas', () => {
  const classes = [...PAGE.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);
  assert.ok(!classes.includes('label-caps') && !classes.includes('label-mini-caps'));
  assert.doesNotMatch(PAGE, /text-transform/);
  const css = lire('design-system/css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const connues = new Set([...css.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
  const emploi = new Set(classes.filter((c) => /^(?:lg|ds|rs)-/.test(c)));
  assert.ok(emploi.size > 15, 'la page emploie des classes lg-, ds- et rs-');
  // `ds-code-bloc__texte` et `__etat` sont des accroches de code.js (il les cherche), sans règle de feuille : ce sont les
  // mêmes que celles de `codeHtml`, éprouvées par ds-code.test.mjs.
  const accroches = new Set(['ds-code-bloc__texte', 'ds-code-bloc__etat']);
  assert.deepEqual([...emploi].filter((c) => !connues.has(c) && !accroches.has(c)), [], 'ces classes n’ont aucune règle dans site.css');
});

test('les trois versions : un SVG et deux PNG chacune, aux noms de nomFichier', () => {
  for (const v of VERSIONS) {
    const carte = PAGE.match(new RegExp(`<article class="lg-version" id="version-${v.id}"[\\s\\S]*?</article>`))[0];
    assert.match(carte, new RegExp(`download="${nomFichier(v.id, 'svg')}"`));
    const png = [...carte.matchAll(/<button\b[^>]*data-export-png[^>]*>/g)].map((m) => Number(m[0].match(/data-largeur="(\d+)"/)[1]));
    assert.deepEqual(png, TAILLES_PNG);
  }
  assert.equal((PAGE.match(/data-export-statut/g) || []).length, 1, 'une seule zone de statut pour les exports');
});

test('la page dit d’où viennent les fichiers du logo, et que le blanc et l’anthracite sont fabriqués ici', () => {
  const t = texte(PAGE);
  assert.match(t, /mydigitalschool\.com/);
  assert.match(t, /fabriquées ici/);
  assert.match(t, /fabriqués par votre navigateur/);
  assert.match(t, /personne du côté de la marque ne les a validées/);
  assert.match(t, /transparent/);
  for (const l of TAILLES_PNG) assert.match(t, new RegExp(`${l} px`));
  // Les règles d'usage sont dans le chapitre Logo, pas ici : la page y renvoie.
  assert.match(PAGE, /href="logo\.html"/);
});

// Les blocs à copier : leur texte rendu, relu.
function blocs() {
  return [...PAGE.matchAll(/<div class="ds-code-bloc"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)].map((m) => ({
    html: m[0],
    texte: deshabiller((m[1].match(/<code class="ds-code-bloc__texte">([\s\S]*?)<\/code>/) || [])[1] || ''),
  }));
}

test('il y a deux blocs à copier, prêts, nommés, et dont le texte est celui des fonctions', () => {
  const b = blocs();
  assert.equal(b.length, 2);
  assert.equal(b[0].texte, tokensEnTexte(GROUPES_REELS));
  assert.equal(b[1].texte, LIENS_POLICES);
  for (const x of b) {
    assert.match(x.html, /data-etat="pret"/, 'brancherCode refuse de copier un bloc qui n’est pas prêt');
    assert.match(x.html, /<pre[^>]*tabindex="0"[^>]*role="region"[^>]*aria-label="[^"]{8,}"/, 'le <pre> défile : il est focalisable et nommé');
    assert.match(x.html, /<button type="button" class="ds-copier label-md" aria-label="Copier[^"]{8,}">Copier<\/button>/);
    assert.match(x.html, /role="status"/);
  }
  const noms = b.map((x) => x.html.match(/<button[^>]*aria-label="([^"]*)"/)[1]);
  assert.equal(new Set(noms).size, 2, 'deux boutons « Copier » au même nom accessible');
});

test('un texte à copier est échappé : un < ou un & ne devient jamais du HTML', () => {
  const html = pageHtml({ sources: SOURCES, groupes: lireTokens(':root { --font-x: "a<b>&c"; }') });
  assert.doesNotMatch(html, /a<b>/);
  assert.match(html, /a&lt;b&gt;&amp;c/);
});

test('les polices : deux liens vers les pages de Google Fonts, et le bloc à coller', () => {
  const liens = [...PAGE.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(liens, ['https://fonts.google.com/specimen/Bricolage+Grotesque', 'https://fonts.google.com/specimen/Inter']);
  const t = texte(PAGE);
  assert.match(t, /Bricolage Grotesque/);
  assert.match(t, /Inter/);
  // Liées, pas stockées : la page le dit, et c'est vrai du dépôt.
  assert.match(t, /pas stockées|ne sont pas hébergées/);
  assert.match(t, /Google Fonts/);
  assert.equal(lire('design-system/index.html').includes('fonts.googleapis.com'), true);
});

test('la page dit pourquoi il n’y a pas de lien vers le Figma, et n’en contient aucun', () => {
  const t = texte(PAGE);
  assert.match(t, /Il n’y a pas de lien vers le Figma/);
  assert.match(t, /le fichier est privé/);
  assert.match(t, /ce site se suffit à lui-même/);
  assert.doesNotMatch(PAGE, /figma\.com/i);
  // Le dit en une phrase : la section est courte.
  const section = PAGE.match(/<section[^>]*id="figma"[\s\S]*?<\/section>/)[0];
  assert.ok((texte(section).match(/[.!?]/g) || []).length <= 3, 'la section Figma tient en une ou deux phrases');
});

test('aucun chemin absolu, et seul Google Fonts est appelé', () => {
  assert.doesNotMatch(PAGE, /(?:src|href)="\/[^/]/);
  // Les adresses de la page, hors du texte des blocs à copier (où `<link href="https://fonts.googleapis.com">` est du texte).
  const adresses = [...PAGE.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map((m) => new URL(m[1]).host);
  assert.deepEqual(adresses, ['fonts.google.com', 'fonts.google.com']);
});

test('chaque image a un alt, et aucun texte n’est posé sur un fond écrit en attribut style', () => {
  for (const img of PAGE.match(/<img\b[^>]*>/g)) assert.match(img, /\balt="[^"]*"/, img);
  const posesEnLigne = [...PAGE.matchAll(/<(\w+)\b[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)];
  for (const [, , dedans] of posesEnLigne) assert.equal(texte(dedans.replace(/<img[^>]*>/g, '')), '', 'du texte sur un fond en ligne');
});

test('les liens internes mènent à des pages qui existent', () => {
  for (const [, f] of PAGE.matchAll(/href="([\w-]+\.html)(?:#[^"]*)?"/g)) lire(`design-system/${f}`);
});

// ---- La page ressources.html ----

const FICHIER = () => lire('design-system/ressources.html');

test('ressources.html charge les polices avant ses feuilles, reste relative, et appelle le chrome avec sa propre adresse', () => {
  const html = FICHIER();
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'ressources.html ne charge pas les polices par <link>');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(famille < html.indexOf('href="../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.ok(html.indexOf('href="../css/base.css"') < html.indexOf('href="css/site.css"'), 'la feuille du site passe en dernier');
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<main id="contenu"/);
  assert.doesNotMatch(html, /sommaireHtml|brancherSommaire|ds-colonnes/, 'le sommaire est réservé à l’étage composants');
  assert.match(html, /enteteHtml\('ressources\.html'\)/);
  assert.match(html, /piedHtml\(\)/);
  assert.match(html, /<title>Ressources — /);
  assert.match(enteteHtml('ressources.html'), /href="ressources\.html"[^>]*aria-current="page"/);
  assert.match(html, /import \{[^}]*pageHtml[^}]*\} from '\.\/js\/telechargement\.js'/);
});

test('ressources.html lit le logo et les tokens, branche les exports et les copies, et dit quand elle ne peut pas', () => {
  const html = FICHIER();
  assert.match(html, /fetch\('assets\/logo\.svg'\)/);
  assert.match(html, /fetch\('\.\.\/css\/tokens\.css'\)/);
  assert.match(html, /preparerSources/);
  assert.match(html, /lireTokens/);
  assert.match(html, /brancherExports\(contenu, sources\)/);
  assert.match(html, /querySelectorAll\('\.ds-code-bloc'\)\.forEach\(\(bloc\) => brancherCode\(bloc\)\)/, 'les blocs à copier doivent être branchés un à un');
  assert.match(html, /ds-message/, 'un message de repli est écrit dans le HTML');
  assert.match(html, /npm run serve/);
  const script = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  assert.match(script, /catch \(erreur\) \{\s*const repli = document\.getElementById\('repli'\);\s*repli\.classList\.remove\('ds-message--attente'\);/, 'le repli doit apparaître tout de suite en cas d’échec attrapé');
  assert.doesNotMatch(script.slice(script.indexOf('catch (erreur)')), /\bthrow\b/, 'une exception relancée dans le repli laisserait la page sur son attente');
});

test('les cinq chapitres de l’en-tête existent, y compris Ressources', () => {
  for (const c of CHAPITRES) assert.ok(lire(`design-system/${c.href}`).length > 0, `${c.href} est lié par l’en-tête de toutes les pages`);
  assert.equal(CHAPITRES.length, 5);
});
