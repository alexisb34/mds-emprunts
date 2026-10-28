// Les chapitres Typographie et Ton.
//
// Ce que ce fichier tient, et ce qu'il ne tient pas :
//   - il LIT css/base.css et recalcule l'échelle (taille, interligne, graisse, capitales) : les
//     étiquettes que l'exemple affiche à côté de chaque style sont comparées à la feuille, pas à
//     une copie ;
//   - il LIT le code de l'outil (js/, les pages à la racine) pour dire quels styles servent à un
//     écran, et pour retrouver, mot pour mot, les phrases que le chapitre Ton donne en modèle ;
//   - il LIT le texte des deux pages, pas leur intention ;
//   - il NE regarde PAS la page. Qu'un cadre se dimensionne, que 9 px soit franchement illisible
//     à côté de 14 px, que le chapitre Ton « sonne » juste : cela se voit dans un navigateur, et le
//     rapport de la tâche dit ce qui y a été vu.
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cadreHtml } from '../design-system/js/cadre.js';
import { valeursDepuis } from '../design-system/js/tokens.js';
import { enteteHtml, CHAPITRES } from '../design-system/js/chrome.js';
import { REASON_LABELS, REASONS, DEFAULT_SETTINGS, reasonLabel } from '../js/rules.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const sansCommentairesCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const texte = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// ---- L'échelle de base.css, lue ----

const NOMS_GRAISSE = { 400: 'Regular', 700: 'Bold', 800: 'ExtraBold' };

function echelle() {
  const css = sansCommentairesCss(lire('css/base.css'));
  return [...css.matchAll(/^\.([\w-]+)\s*\{([^}]*font-size[^}]*)\}/gm)].map((m) => ({
    nom: m[1],
    taille: Number(m[2].match(/font-size:\s*(\d+)px/)[1]),
    interligne: Number(m[2].match(/line-height:\s*(\d+)px/)[1]),
    graisse: Number((m[2].match(/font-weight:\s*(\d+)/) || [, 400])[1]),
    capitales: /text-transform:\s*uppercase/.test(m[2]),
    titre: /font-family:\s*var\(--font-heading\)/.test(m[2]),
  }));
}

const EXEMPLE = () => lire('design-system/exemples/typographie.html');
const PAGE = () => lire('design-system/typographie.html');
const TON = () => lire('design-system/ton.html');

// Les jetons d'une valeur `class="…"` : on compare des classes entières, pas des morceaux.
const classesDe = (html) => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean);

// ---- L'assertion du brief, telle quelle ----

test('toutes les classes typographiques de base.css sont documentées', () => {
  const base = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');
  const classes = [...base.matchAll(/^\.([\w-]+)\s*\{[^}]*font-size/gm)].map((m) => m[1]);
  const exemple = readFileSync(new URL('../design-system/exemples/typographie.html', import.meta.url), 'utf8');
  for (const c of classes) assert.match(exemple, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} n’est pas montrée`);
});

// ---- Ce que l'assertion du brief ne voit pas ----

test('l’assertion du brief est creuse : « body » est satisfait par « body-sm ». Ici, les classes sont comparées entières', () => {
  // `\bbody\b` reconnaît `body` dans `class="body-sm"` (le tiret est une frontière de mot). Le test
  // ci-dessous compare des jetons entiers ; celui-ci prouve que l'écart existe.
  assert.match('class="body-sm"', new RegExp('class="[^"]*\\bbody\\b'));
  assert.ok(!classesDe('class="body-sm"').includes('body'));
});

test('chaque style de base.css est montré tel quel, une fois, dans l’ordre de la feuille', () => {
  const attendu = echelle().map((s) => s.nom);
  assert.ok(attendu.length >= 13, `${attendu.length} styles lus dans base.css : le détecteur ne voit plus l’échelle`);
  const section = EXEMPLE().match(/<section data-demo="echelle">([\s\S]*?)<\/section>/)[1];
  const montres = [...section.matchAll(/<div class="ty-ligne">\s*<(\w+) class="([\w-]+)"/g)].map((m) => m[2]);
  assert.deepEqual(montres, attendu);
});

test('l’étiquette de chaque style dit sa taille, son interligne, sa graisse et ses capitales : celles de la feuille', () => {
  const section = EXEMPLE().match(/<section data-demo="echelle">([\s\S]*?)<\/section>/)[1];
  const lignes = [...section.matchAll(/<div class="ty-ligne">\s*<(\w+) class="([\w-]+)"[^>]*>[\s\S]*?<\/\1>\s*<p class="ty-nom body-sm">([\s\S]*?)<\/p>\s*<\/div>/g)];
  const style = echelle();
  assert.equal(lignes.length, style.length, 'une ligne de la démonstration n’a pas la forme attendue');
  for (const [, , classe, etiquette] of lignes) {
    const s = style.find((x) => x.nom === classe);
    const attendu = `.${s.nom} · ${s.taille} / ${s.interligne} px · ${NOMS_GRAISSE[s.graisse]}${s.capitales ? ' · capitales' : ''}`;
    assert.equal(texte(etiquette), attendu);
  }
});

test('les titres de l’échelle sont ceux que la feuille met en Bricolage Grotesque, et eux seuls', () => {
  // L'échelle dit « titres » pour .h5, .h6 et .kpi-number : c'est la feuille qui le décide.
  assert.deepEqual(echelle().filter((s) => s.titre).map((s) => s.nom), ['h5', 'h6', 'kpi-number']);
  assert.ok(echelle().filter((s) => s.titre).every((s) => s.graisse === 800), 'un titre n’est pas en ExtraBold');
  assert.ok(echelle().filter((s) => !s.titre).every((s) => s.graisse === 400 || s.graisse === 700), 'du texte courant est en ExtraBold');
});

// ---- Le fichier d'exemple ----

test('l’exemple a ses quatre démonstrations, charge les polices et les deux feuilles du kit, et rien du site', () => {
  const html = EXEMPLE();
  for (const d of ['familles', 'echelle', 'melange', 'taille-mini']) assert.match(html, new RegExp(`<section data-demo="${d}"`), `démonstration ${d} absente`);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/);
  assert.match(html, /href="\.\.\/\.\.\/css\/tokens\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/css\/base\.css"/);
  assert.doesNotMatch(html, /site\.css/, 'un exemple montre l’application, pas le guide');
  assert.match(html, /<script type="module" src="\.\.\/js\/cadre-enfant\.js"><\/script>/);
});

test('les familles montrées sont celles des tokens, et chacune dans la graisse que la feuille charge', () => {
  const tokens = valeursDepuis(lire('css/tokens.css'));
  assert.match(tokens['--font-heading'], /^'Bricolage Grotesque'/);
  assert.match(tokens['--font-body'], /^'Inter'/);
  const section = EXEMPLE().match(/<section data-demo="familles">([\s\S]*?)<\/section>/)[1];
  const t = texte(section);
  assert.match(t, /Bricolage Grotesque/);
  assert.match(t, /Inter/);
  assert.match(t, /ExtraBold/);
  // Les graisses annoncées sont celles que le <link> des polices demande à Google Fonts.
  const lien = EXEMPLE().match(/family=Inter:wght@([\d;]+)&amp;family=Bricolage\+Grotesque:wght@(\d+)/);
  assert.equal(lien[1], '400;700');
  assert.equal(lien[2], '800');
  // C'est bien le lien de l'outil : les mêmes graisses sont chargées par ses trois écrans.
  for (const page of ['index.html', 'admin.html', 'mobile.html']) {
    assert.ok(lire(page).includes(`family=Inter:wght@${lien[1]}&amp;family=Bricolage+Grotesque:wght@${lien[2]}`), `${page} charge d’autres graisses`);
  }
  assert.match(t, /Regular/);
  assert.match(t, /Bold/);
});

// Une figure de l'exemple : sa légende et son contenu.
function figures(demo) {
  const section = EXEMPLE().match(new RegExp(`<section data-demo="${demo}"[^>]*>([\\s\\S]*?)</section>`))[1];
  return [...section.matchAll(/<figure class="ty-cas ty-cas--(faux|juste)">([\s\S]*?)<\/figure>/g)].map((m) => ({ sorte: m[1], html: m[2] }));
}

test('chaque interdit montre une figure fautive puis une bonne, légendées', () => {
  for (const d of ['melange', 'taille-mini']) {
    const f = figures(d);
    assert.deepEqual(f.map((x) => x.sorte), ['faux', 'juste'], `${d} : une fautive puis une bonne`);
    assert.match(f[0].html, /<figcaption[^>]*>[\s\S]*À ne pas faire/);
    assert.match(f[1].html, /<figcaption[^>]*>[\s\S]*À faire/);
  }
});

test('« mélanger » : la figure fautive met Bricolage et Inter dans UN titre, la bonne n’en met qu’une', () => {
  const [faux, juste] = figures('melange');
  const ligne = (h) => h.match(/<p class="ty-titre">([\s\S]*?)<\/p>/)[1];
  assert.ok(classesDe(ligne(faux.html)).includes('h5'), 'la fautive garde un mot en Bricolage');
  assert.ok(classesDe(ligne(faux.html)).includes('ty-inter'), 'la fautive passe un mot en Inter');
  assert.deepEqual(classesDe(ligne(juste.html)), ['h5']);
  // Le même texte des deux côtés : on compare la police, pas les mots.
  assert.equal(texte(ligne(faux.html)), texte(ligne(juste.html)));
  // Et la classe qui passe un mot en Inter reprend vraiment la taille du titre : sinon la comparaison ne tient pas.
  const h5 = echelle().find((s) => s.nom === 'h5');
  const regle = EXEMPLE().match(/\.ty-inter\s*\{([^}]*)\}/)[1];
  assert.match(regle, /font-family:\s*var\(--font-body\)/);
  assert.match(regle, new RegExp(`font-size:\\s*${h5.taille}px`));
  assert.match(regle, new RegExp(`line-height:\\s*${h5.interligne}px`));
});

test('« trop petit » : la figure fautive est sous le plus petit style de l’échelle, la bonne est un style de l’échelle', () => {
  const [faux, juste] = figures('taille-mini');
  const tiny = echelle().find((s) => s.nom === 'body-tiny');
  // Le plus petit style de texte à lire (hors étiquettes en capitales) est body-tiny.
  const texteCourant = echelle().filter((x) => !x.capitales);
  assert.equal(Math.min(...texteCourant.map((x) => x.taille)), tiny.taille, 'body-tiny n’est plus le plus petit style de texte à lire');
  const classeFaux = faux.html.match(/<p class="([\w-]+)"/)[1];
  const regle = EXEMPLE().match(new RegExp(`\\.${classeFaux}\\s*\\{([^}]*)\\}`))[1];
  assert.ok(Number(regle.match(/font-size:\s*(\d+)px/)[1]) < tiny.taille, 'la fautive n’est pas plus petite que body-tiny');
  const classeJuste = juste.html.match(/<p class="([\w-]+)"/)[1];
  assert.ok(echelle().some((s) => s.nom === classeJuste && s.taille > tiny.taille), 'la bonne n’est pas un style plus grand que body-tiny');
  assert.equal(texte(faux.html.match(/<p class="[\w-]+">([\s\S]*?)<\/p>/)[1]), texte(juste.html.match(/<p class="[\w-]+">([\s\S]*?)<\/p>/)[1]));
});

// ---- cadreHtml depuis la racine ----

test('cadreHtml vise exemples/ depuis une page de la racine, et ../exemples/ par défaut', () => {
  const racine = cadreHtml({ fichier: 'typographie.html', demo: 'echelle', titre: 'x', depuisRacine: true });
  assert.match(racine, /src="exemples\/typographie\.html#echelle"/);
  assert.doesNotMatch(racine, /\.\.\/exemples/);
  assert.match(cadreHtml({ fichier: 'bouton.html', demo: 'tailles', titre: 'x' }), /src="\.\.\/exemples\/bouton\.html#tailles"/);
  assert.throws(() => cadreHtml({ fichier: 'a.html', demo: 'b', titre: 'x', depuisRacine: 'oui' }), /depuisRacine/);
});

// ---- La page typographie.html ----

function memeConventions(html, adresse) {
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, `${adresse} ne charge pas les polices par <link>`);
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(famille < html.indexOf('href="../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.ok(html.indexOf('href="../css/base.css"') < html.indexOf('href="css/site.css"'), 'la feuille du site passe en dernier');
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/, 'aucun chemin absolu');
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<main id="contenu"/);
  assert.doesNotMatch(html, /sommaireHtml|brancherSommaire|ds-colonnes/, 'le sommaire est réservé à l’étage composants');
  assert.match(html, new RegExp(`enteteHtml\\('${adresse.replace('.', '\\.')}'\\)`));
  assert.match(html, /piedHtml\(\)/);
  assert.match(enteteHtml(adresse), new RegExp(`href="${adresse.replace('.', '\\.')}"[^>]*aria-current="page"`));
  assert.doesNotMatch(html, /https?:\/\/(?!fonts\.g)/, 'seul Google Fonts est appelé');
}

test('typographie.html suit les conventions des chapitres : polices, feuilles, chrome, chemins relatifs', () => {
  memeConventions(PAGE(), 'typographie.html');
  assert.match(PAGE(), /<title>Typographie — /);
});

test('ton.html suit les conventions des chapitres', () => {
  memeConventions(TON(), 'ton.html');
  assert.match(TON(), /<title>Ton — /);
});

function structure(html, titre) {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, new RegExp(`<h1[^>]*>\\s*${titre}\\s*</h1>`));
  const niveaux = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaux.length; i++) assert.ok(niveaux[i] - niveaux[i - 1] <= 1, `un titre saute de h${niveaux[i - 1]} à h${niveaux[i]}`);
  // Aucune étiquette en capitales : ni la classe, ni la règle, ni le style en ligne.
  const classes = classesDe(html);
  assert.ok(!classes.includes('label-caps') && !classes.includes('label-mini-caps'), 'une étiquette en capitales');
  assert.doesNotMatch(html, /text-transform/);
  // Toute classe du site que la page emploie a une règle dans la feuille.
  const css = sansCommentairesCss(lire('design-system/css/site.css'));
  const connues = new Set([...css.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
  const emploi = new Set(classes.filter((c) => /^(?:ds|ty|tn)-/.test(c)));
  assert.ok(emploi.size >= 5, 'la page emploie des classes ds-, ty- ou tn-');
  assert.deepEqual([...emploi].filter((c) => !connues.has(c)), [], 'ces classes n’ont aucune règle dans site.css');
  // Les liens internes mènent quelque part.
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, cible] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(cible), `#${cible} ne mène nulle part`);
  // Les cinq chapitres sont liés par l'en-tête de toutes les pages ; ressources.html est écrit à la
  // tâche suivante, et son existence est tenue par tests/ds-telechargement.test.mjs.
  const chapitres = CHAPITRES.map((c) => c.href);
  for (const [, f] of html.matchAll(/href="([\w-]+\.html)(?:#[^"]*)?"/g)) {
    if (!chapitres.includes(f)) readFileSync(new URL(`../design-system/${f}`, import.meta.url));
  }
}

test('typographie.html : un h1, pas de saut de titre, pas de capitales, des classes qui existent', () => {
  structure(PAGE(), 'La typographie');
});

test('ton.html : un h1, pas de saut de titre, pas de capitales, des classes qui existent', () => {
  structure(TON(), 'Le ton');
});

test('typographie.html : chaque cadre est écrit en clair, depuis la racine, et vise une démonstration qui existe', () => {
  const html = PAGE();
  const appels = [...html.matchAll(/cadreHtml\(\s*\{([^}]*)\}/g)];
  assert.ok(appels.length >= 4, `${appels.length} cadre(s) seulement`);
  const vus = [];
  for (const [, corps] of appels) {
    const fichier = corps.match(/\bfichier\s*:\s*'([^']*)'/);
    const demo = corps.match(/\bdemo\s*:\s*'([^']*)'/);
    assert.ok(fichier && demo, `cadreHtml({${corps.trim()}}) : fichier et demo en clair`);
    assert.match(corps, /\bdepuisRacine\s*:\s*true\b/, `un cadre de la racine doit viser exemples/, pas ../exemples/ : ${demo[1]}`);
    assert.equal(fichier[1], 'typographie.html');
    assert.match(EXEMPLE(), new RegExp(`<section data-demo="${demo[1]}"`), `${demo[1]} absente de l’exemple`);
    vus.push(demo[1]);
  }
  // Chaque démonstration de l'exemple est montrée, une fois.
  const dans = [...EXEMPLE().matchAll(/<section data-demo="([\w-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...vus].sort(), [...dans].sort());
  // Protocole : brancherCadres vient après les cadres, dans le même script, sans attente entre les deux.
  const script = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  assert.ok(script.indexOf('brancherCadres(') > script.lastIndexOf('cadreHtml('), 'brancherCadres doit venir après le dernier cadre');
  assert.doesNotMatch(script.slice(script.indexOf('cadreHtml('), script.indexOf('brancherCadres(')), /\bawait\b/, 'un await entre les cadres et brancherCadres');
  // Tout emplacement de cadre du balisage reçoit un cadre.
  for (const [, id] of html.matchAll(/<div id="(cadre-[\w-]+)"><\/div>/g)) assert.ok(script.includes(`getElementById('${id}')`), `${id} n’est jamais rempli`);
});

test('typographie.html : l’échelle est montrée, et dit ce qui n’est pas dans la page', () => {
  const t = texte(PAGE());
  assert.match(t, /Bricolage Grotesque/);
  assert.match(t, /Inter/);
  assert.match(t, /ExtraBold/);
  // Ce que la page dit des polices est ce que base.css et tokens.css disent.
  const tokens = valeursDepuis(lire('css/tokens.css'));
  assert.match(tokens['--font-heading'], /Bricolage Grotesque/);
  assert.ok(echelle().filter((s) => s.titre).every((s) => s.graisse === 800));
  assert.match(t, /titres/);
});

test('typographie.html : les styles qu’aucun écran n’emploie sont nommés, et ce sont les bons', () => {
  // On calcule, à la source, quels styles de base.css servent à un écran : une classe posée dans
  // js/ ou dans une page de la racine (kit.html, la page de vérification visuelle, ne compte pas).
  const fichiers = [
    ...readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html') && f !== 'kit.html'),
  ];
  const source = fichiers.map(lire).join('\n');
  const posees = new Set([...source.matchAll(/class=\\?"([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.ok(posees.size > 40, 'le détecteur ne voit plus les classes de l’outil');
  const inemployes = echelle().map((s) => s.nom).filter((n) => !posees.has(n));
  assert.ok(inemployes.length >= 1);
  // La page les nomme dans un paragraphe repéré par data-inemployes, chacun dans un <code>.
  const para = PAGE().match(/<p[^>]*data-inemployes[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(para, 'la page doit nommer les styles sans écran dans un <p data-inemployes>');
  const nommes = [...para[1].matchAll(/<code>\.?([\w-]+)<\/code>/g)].map((m) => m[1]);
  assert.deepEqual([...nommes].sort(), [...inemployes].sort());
  // Le chiffre des cartes KPI reprend le style de .kpi-number sans passer par sa classe : c'est ce que la page dit.
  const kpi = echelle().find((s) => s.nom === 'kpi-number');
  const comp = sansCommentairesCss(lire('css/components.css')).match(/\.kpi__value\s*\{([^}]*)\}/)[1];
  assert.match(comp, new RegExp(`font-size:\\s*${kpi.taille}px`));
  assert.match(comp, new RegExp(`line-height:\\s*${kpi.interligne}px`));
  assert.match(comp, new RegExp(`font-weight:\\s*${kpi.graisse}`));
  if (inemployes.includes('kpi-number')) assert.match(texte(PAGE()), /kpi__value/);
});

test('typographie.html : le plancher dit est celui de body-tiny, et ce que le prototype fait en dessous est dit', () => {
  const t = texte(PAGE());
  const tiny = echelle().find((s) => s.nom === 'body-tiny');
  assert.match(t, new RegExp(`${tiny.taille} px`));
  // Le prototype descend lui-même sous ce plancher : la page le dit « par exemple », avec les mesures de
  // mobile.css (admin.css a aussi des étiquettes en capitales à 10 px : ce test ne lit que mobile.css).
  const mobile = sansCommentairesCss(lire('css/mobile.css'));
  const sous = [...mobile.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .map((m) => ({ selecteur: m[1].trim(), taille: Number((m[2].match(/(?:^|;)\s*font-size:\s*(\d+)px/) || [])[1]) }))
    .filter((r) => r.taille && r.taille < tiny.taille);
  assert.deepEqual(sous.map((r) => r.selecteur).sort(), ['.m-nav__tab', '.week-grid .slot', '.week-grid th'], 'les endroits de mobile.css sous le plancher ont changé : la page doit suivre');
  for (const r of sous) assert.match(t, new RegExp(`${r.taille} px`), `la page ne cite pas ${r.taille} px (${r.selecteur})`);
  assert.match(t, /par exemple/);
  assert.match(t, /grille des créneaux/);
  assert.match(t, /barre de navigation/);
});

test('typographie.html : ce que la page dit des composants du kit (boutons, titres de champ, en-têtes de tableau) est dans components.css', () => {
  const comp = sansCommentairesCss(lire('css/components.css'));
  const regle = (selecteur) => comp.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))[1];
  const de = (nom) => echelle().find((s) => s.nom === nom);
  for (const [selecteur, nom] of [['.btn', 'label-md'], ['.field__label', 'label-sm']]) {
    const r = regle(selecteur);
    assert.match(r, new RegExp(`font-size:\\s*${de(nom).taille}px`), `${selecteur} n’a plus la taille de ${nom}`);
    assert.match(r, new RegExp(`font-weight:\\s*${de(nom).graisse}`), `${selecteur} n’a plus la graisse de ${nom}`);
    assert.match(r, new RegExp(`line-height:\\s*${de(nom).interligne}px`), `${selecteur} n’a plus l’interligne de ${nom}`);
  }
  const th = comp.match(/\.table th\s*\{([^}]*)\}/)[1];
  assert.match(th, /font-size:\s*11px/);
  assert.match(th, /text-transform:\s*uppercase/);
  assert.equal(de('label-caps').taille, 11);
  const t = texte(PAGE());
  assert.match(t, /boutons du kit ont la taille de \.label-md/);
  assert.match(t, /titres de champ celle de \.label-sm/);
  assert.match(t, /en-tête de tableau/);
  // Les deux étiquettes en capitales : 11 et 10 px, comme la page le dit.
  assert.deepEqual([de('label-caps').taille, de('label-mini-caps').taille], [11, 10]);
  assert.match(t, /vont à 11 et 10 px/);
});

test('typographie.html : les deux interdits sont des règles de ce guide, et la page le dit', () => {
  const t = texte(PAGE());
  assert.match(t, /règles de ce guide|ne sont pas une charte/);
  assert.match(t, /Mélanger les deux polices dans un titre/);
  assert.match(t, /Descendre sous/);
});

// ---- Le chapitre Ton ----

const SOURCES_OUTIL = () => readdirSync(new URL('../js/', import.meta.url), { recursive: true })
  .filter((f) => f.endsWith('.js')).map((f) => ({ fichier: `js/${f}`, source: lire(`js/${f}`) }));

// Les paires de la page : chacune est un <article class="tn-paire" data-source="…">.
function paires() {
  return [...TON().matchAll(/<article class="tn-paire"([^>]*)>([\s\S]*?)<\/article>/g)].map((m) => ({
    attrs: m[1],
    ecrire: texte((m[2].match(/<blockquote class="tn-phrase tn-phrase--juste">([\s\S]*?)<\/blockquote>/) || [])[1] || ''),
    lieu: texte((m[2].match(/<blockquote class="tn-phrase tn-phrase--faux">([\s\S]*?)<\/blockquote>/) || [])[1] || ''),
    html: m[2],
  }));
}

test('ton.html donne trois paires « au lieu de / écrire »', () => {
  const p = paires();
  assert.equal(p.length, 3);
  for (const x of p) {
    assert.ok(x.ecrire && x.lieu, 'chaque paire a ses deux phrases');
    assert.match(x.html, /Au lieu de/);
    assert.match(x.html, /Écrire/);
  }
});

test('chaque phrase « écrire » est dans l’outil d’emprunt, mot pour mot', () => {
  const sources = SOURCES_OUTIL();
  const attendues = {
    'Modifications enregistrées': { reason: null, fichier: 'js/admin/views/materielFiche.js', geste: "toast('Modifications enregistrées'" },
    [REASON_LABELS[REASONS.EN_MAINTENANCE]]: { reason: 'en_maintenance' },
    [REASON_LABELS[REASONS.RETARD_EN_COURS]]: { reason: 'retard_en_cours' },
  };
  assert.deepEqual(paires().map((p) => p.ecrire), Object.keys(attendues));
  for (const p of paires()) {
    const a = attendues[p.ecrire];
    if (a.reason) {
      // Le texte vient de la table des messages que l'outil affiche vraiment.
      assert.equal(REASON_LABELS[a.reason], p.ecrire);
      assert.match(p.attrs, new RegExp(`data-source="js/rules\\.js"`));
      assert.ok(sources.find((s) => s.fichier === 'js/rules.js').source.includes(`${a.reason}: '${p.ecrire}'`), `${a.reason} n’est plus écrit ainsi dans rules.js`);
    } else {
      assert.match(p.attrs, new RegExp(`data-source="${a.fichier.replace('.', '\\.')}"`));
      assert.ok(sources.find((s) => s.fichier === a.fichier).source.includes(a.geste), `${a.fichier} ne contient plus ${a.geste}`);
    }
  }
});

test('aucune phrase « au lieu de » n’est dans l’outil : ce sont des contre-exemples, et la page le dit', () => {
  const tout = SOURCES_OUTIL().map((s) => s.source).join('\n') + lire('index.html');
  for (const p of paires()) assert.ok(!tout.includes(p.lieu), `« ${p.lieu} » est dans l’outil : ce n’est pas un contre-exemple`);
  assert.match(texte(TON()), /Les phrases « au lieu de » sont inventées/);
  assert.match(texte(TON()), /celles à écrire sont (?:les vraies|copiées)/);
});

test('ton.html décrit l’écriture des interfaces, rien d’autre, et le dit', () => {
  const t = texte(TON());
  assert.match(t, /textes des interfaces|écriture dans les interfaces/);
  assert.match(t, /pas les affiches|ni les affiches/i);
});

test('ton.html : le vouvoiement et ses verbes sont ceux de l’outil', () => {
  const t = texte(TON());
  const tout = SOURCES_OUTIL().map((s) => s.source).join('\n');
  const verbes = [...TON().matchAll(/«&nbsp;<span data-verbe>([^<]+)<\/span>&nbsp;»/g)].map((m) => m[1]);
  assert.ok(verbes.length >= 3, 'la page cite au moins trois verbes');
  for (const v of verbes) assert.ok(tout.includes(v), `« ${v} » n’est pas dans l’outil`);
  assert.match(t, /vouvoie/);
  // Aucun « tu » dans le texte que l'outil affiche à une personne : le test lit les mêmes sources.
  assert.doesNotMatch(tout, /(?:^|[^\wÀ-ÿ'’-])(?:Tu|tu|Toi|toi) [a-zà-ÿ]+/m, 'l’outil tutoie quelque part : la page ne dit plus vrai');
});

test('ton.html : la phrase longue citée est celle de rules.js, avec l’horaire qu’elle donne', () => {
  const t = texte(TON());
  const longue = REASON_LABELS[REASONS.FENETRE_RETRAIT];
  assert.ok(t.includes(longue), 'la phrase citée n’est pas celle de rules.js');
  assert.match(longue, /\(\d+h\)/);
  // « L'horaire suit les réglages » : la même raison, avec une fermeture réglée à 18h, donne 18h.
  const reglee = reasonLabel(REASONS.FENETRE_RETRAIT, { horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 18 }] });
  assert.match(reglee, /\(18h\)/);
  assert.match(t, /suit les réglages de la pédago/);
  assert.match(t, new RegExp(`${DEFAULT_SETTINGS.horaires.at(-1).fin}h est la valeur par défaut`));
});

test('ton.html : les trois principes sont ceux que les paires illustrent', () => {
  const t = texte(TON());
  assert.match(t, /Des phrases courtes/);
  assert.match(t, /Pas de jargon/);
  assert.match(t, /Une erreur dit quoi faire/);
});
