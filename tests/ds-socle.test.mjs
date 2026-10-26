// Le socle du site de design system : sa palette, son chrome, son accueil.
// Le site s'impose 4,5:1 sur toutes ses paires texte/fond — un guide qui échoue à
// ses propres contrastes se discrédite en une page (spec §8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ratioExact, verdict } from '../design-system/js/contraste.js';
import { PAIRES } from '../design-system/js/palette-site.js';
import { CHAPITRES, COMPOSANTS, enteteHtml, piedHtml, sommaireHtml } from '../design-system/js/chrome.js';

const lire = (chemin) => readFileSync(new URL(`../design-system/${chemin}`, import.meta.url), 'utf8');

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

test('aucune surface colorée ne laisse passer du texte secondaire', () => {
  // `--ds-texte-secondaire` tient 4,55:1 sur blanc et 3,9:1 sur un aplat pastel. Un
  // commentaire d'avertissement ne protège personne : la feuille doit neutraliser les
  // classes de texte secondaire à l'intérieur de chaque surface colorée. Une nouvelle
  // surface s'ajoute ici en même temps que dans `site.css`.
  const css = lire('css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const surfaces = ['.ds-bande--doux', '.ds-bande--frais', '.ds-etage', '.ds-rappel'];
  for (const surface of surfaces) {
    for (const secondaire of ['.ds-oeil', '.text-secondary']) {
      assert.ok(
        css.includes(`${surface} ${secondaire}`),
        `${surface} ne neutralise pas ${secondaire} : le texte secondaire y tombe sous 4,5:1`,
      );
    }
  }
  // Et la neutralisation repose sur une couleur mesurée, pas sur une valeur improvisée.
  const valeurs = valeursDuSite();
  for (const nom of ['--ds-texte', '--ds-texte-inverse']) assert.ok(valeurs[nom], `${nom} absent`);
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
