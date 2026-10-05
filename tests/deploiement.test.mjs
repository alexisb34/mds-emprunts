// Épingle ce qui casserait la publication sous un sous-répertoire (GitHub Pages sert le
// dépôt depuis `/<nom-du-dépôt>/`, pas depuis la racine du domaine, sur un système de
// fichiers qui distingue les majuscules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';

const RACINE = new URL('../', import.meta.url);
const pages = readdirSync(RACINE).filter((f) => f.endsWith('.html'));
const lire = (f) => readFileSync(new URL(f, RACINE), 'utf8');

// Toutes les références de ressources d’une page : attributs (guillemets simples ou
// doubles), imports de modules en ligne (statiques et dynamiques) et `url(…)`.
function references(html) {
  const motifs = [
    // `i` : un attribut en capitales compte autant. La seconde alternative couvre une
    // valeur sans guillemets, que HTML tolère et qu’un motif à guillemets ne verrait pas.
    /\b(?:src|href|srcset)\s*=\s*(["'])(.*?)\1/gi,
    /\b(?:src|href)\s*=\s*(?!["'])([^\s>]+)/gi,
    /\bimport\s*(?:[^'"()]*?\bfrom\s*)?(["'])(.*?)\1/g,
    /\bimport\s*\(\s*(["'])(.*?)\1\s*\)/g,
    /\burl\(\s*(["']?)(.*?)\1\s*\)/g,
  ];
  // Selon le motif, la référence est dans le groupe 2 (après le guillemet) ou le groupe 1.
  return motifs.flatMap((re) => [...html.matchAll(re)].map((m) => (m[2] ?? m[1]).trim()));
}

// Une référence externe (`https:`, `data:`, `mailto:`, `//cdn…`) n’est pas notre affaire.
const estExterne = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//');

// Chemin local, sans fragment ni requête ; chaque segment doit exister avec SA casse :
// un `existsSync` indulgent sur macOS laisserait passer un 404 sous Linux.
function cheminLocal(ref) {
  return ref.replace(/[#?].*$/, '');
}

// `chemin` est relatif à la racine du site ; rend le premier segment qui manque, ou null.
function segmentAbsent(chemin) {
  const segments = posix.normalize(chemin).split('/').filter((s) => s && s !== '.');
  let dossier = '';
  for (const segment of segments) {
    let present;
    try {
      present = readdirSync(new URL(dossier, RACINE));
    } catch {
      // Un segment déjà trouvé n’est pas un dossier (`css/base.css/x.css`) : ce qui suit
      // n’existe pas, et le test doit le dire plutôt que planter sur un ENOTDIR brut.
      return segment;
    }
    if (!present.includes(segment)) return segment;
    dossier += `${segment}/`;
  }
  return null;
}

// `dossier` : le dossier de la page, relatif à la racine du site (« » pour une page à la
// racine). Une référence relative se résout depuis lui, comme le fait le navigateur.
function problemes(html, dossier = '') {
  const out = [];
  for (const ref of references(html)) {
    // `${…}` : un gabarit de balisage dont l’adresse se décide à l’exécution ; ce n’est pas un chemin.
    if (!ref || ref.includes('${') || estExterne(ref)) continue;
    if (ref.startsWith('/')) { out.push(`${ref} : chemin absolu, hors du site une fois publié`); continue; }
    const chemin = cheminLocal(ref);
    if (!chemin) continue; // fragment seul
    const resolu = posix.normalize(posix.join(dossier, chemin));
    if (resolu === '..' || resolu.startsWith('../')) { out.push(`${ref} : remonte au-dessus de la racine du site`); continue; }
    const absent = segmentAbsent(resolu);
    if (absent) out.push(`${ref} : « ${absent} » n’existe pas (casse comprise)`);
  }
  return out;
}

test('les pages du dépôt sont bien celles qu’on croit', () => {
  assert.deepEqual([...pages].sort(), ['admin.html', 'etiquettes.html', 'index.html', 'kit.html', 'mobile.html']);
});

test('aucune page ne référence une ressource absente ou par un chemin absolu', () => {
  for (const page of pages) {
    assert.deepEqual(problemes(lire(page)), [], `${page} a des références qui casseraient une fois publiées`);
  }
});

test('le détecteur voit un import de module en ligne rendu absolu', () => {
  const html = `<script type="module">\n  import { store } from '/js/store.js';\n</script>`;
  assert.match(problemes(html).join('\n'), /\/js\/store\.js : chemin absolu/);
  assert.match(problemes(`<script type="module">import("/js/x.js")</script>`).join('\n'), /\/js\/x\.js : chemin absolu/);
});

test('le détecteur voit un attribut entre guillemets simples', () => {
  assert.match(problemes(`<link href='/css/base.css'>`).join('\n'), /\/css\/base\.css : chemin absolu/);
  assert.match(problemes(`<img src='assets/inexistant.png'>`).join('\n'), /inexistant\.png/);
});

test('le détecteur voit une différence de casse, que macOS ne voit pas', () => {
  assert.match(problemes(`<link href="CSS/Base.css">`).join('\n'), /« CSS » n’existe pas/);
  assert.match(problemes(`<link href="css/Base.css">`).join('\n'), /« Base\.css » n’existe pas/);
  assert.deepEqual(problemes(`<link href="css/base.css">`), []);
});

test('le détecteur nomme la bonne référence, ignore fragments et externes, suit les fragments', () => {
  assert.match(problemes(`<a href="/">accueil</a>`).join('\n'), /^\/ : chemin absolu/);
  assert.deepEqual(problemes(`<a href="#haut">x</a><a href="https://exemple.org/a">y</a><a href="//cdn.exemple.org/a.js">z</a><img src="data:image/png;base64,AA">`), []);
  assert.deepEqual(problemes(`<a href="admin.html#/materiel">x</a>`), []);
  assert.match(problemes(`<a href="absent.html#/materiel">x</a>`).join('\n'), /absent\.html/);
});

test('le manifeste reste relatif et complet : il sera servi depuis un sous-répertoire', () => {
  const manifest = JSON.parse(lire('manifest.json'));
  // Pas d’`id` : il se résout contre l’ORIGINE (`https://<compte>.github.io/mobile.html`), pas
  // contre le manifeste, donc une valeur relative ne serait pas la bonne. Absent, il vaut `start_url`.
  assert.equal('id' in manifest, false, 'manifest.id doit rester absent (il défaut à start_url)');
  for (const champ of ['start_url', 'scope']) {
    assert.equal(typeof manifest[champ], 'string', `manifest.${champ} est absent`);
    assert.ok(!manifest[champ].startsWith('/'), `manifest.${champ} ne doit pas commencer par /`);
  }
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest.icons est absent ou vide');
  for (const icone of manifest.icons) {
    assert.equal(typeof icone.src, 'string', 'icons[].src est absent');
    assert.ok(!icone.src.startsWith('/'), 'icons[].src ne doit pas commencer par /');
    assert.equal(segmentAbsent(icone.src), null, `${icone.src} n’existe pas (casse comprise)`);
  }
  assert.equal(segmentAbsent(manifest.start_url), null, `start_url ${manifest.start_url} n’existe pas`);
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

test('le détecteur voit un attribut sans guillemets ou en capitales', () => {
  // HTML tolère les deux ; un motif qui exige des guillemets minuscules les manquerait.
  // On compare le message, pas le nombre : un seul problème, mais le bon.
  assert.deepEqual(problemes('<link href=/css/base.css>'), ['/css/base.css : chemin absolu, hors du site une fois publié']);
  assert.deepEqual(problemes('<script SRC="/js/store.js"></script>'), ['/js/store.js : chemin absolu, hors du site une fois publié']);
  assert.deepEqual(problemes('<img srcset="/assets/icon-192.png 1x">'), ['/assets/icon-192.png 1x : chemin absolu, hors du site une fois publié']);
  // Et rien d’inventé sur du balisage légitime.
  assert.deepEqual(problemes('<link href=css/base.css><a href="#/materiel">x</a>'), []);
});

test('le détecteur ignore une adresse de gabarit `${…}`, qui ne se décide qu’à l’exécution', () => {
  assert.deepEqual(problemes('const html = `<a href="${lien}">x</a>`;'), []);
  assert.deepEqual(problemes('`<img src="assets/${nom}.png">`'), []);
  // Un gabarit n’excuse pas pour autant un chemin absolu écrit en dur à côté.
  assert.deepEqual(problemes('`<a href="${lien}">x</a><a href="/admin.html">y</a>`'), ['/admin.html : chemin absolu, hors du site une fois publié']);
});

test('le détecteur résout `..` depuis le dossier de la page au lieu de le prendre pour un nom', () => {
  // Depuis `docs/`, `../css/base.css` est bien `css/base.css`.
  assert.deepEqual(problemes('<link href="../css/base.css">', 'docs'), []);
  assert.deepEqual(problemes('<link href="../css/absent.css">', 'docs'), ['../css/absent.css : « absent.css » n’existe pas (casse comprise)']);
  assert.deepEqual(problemes('<link href="css/../css/base.css">'), []);
  // Depuis la racine, remonter sort du site : c’est un vrai défaut, et le message le dit.
  assert.deepEqual(problemes('<link href="../css/base.css">'), ['../css/base.css : remonte au-dessus de la racine du site']);
});

test('le détecteur signale un segment qui traverse un fichier au lieu de planter sur ENOTDIR', () => {
  assert.deepEqual(problemes('<link href="css/base.css/x.css">'), ['css/base.css/x.css : « x.css » n’existe pas (casse comprise)']);
});

test('les polices se chargent en parallèle : <link> dans chaque page, avant nos feuilles, jamais @import', () => {
  // Un `@import` dans base.css fait attendre le premier rendu deux allers-retours réseau
  // d’affilée ; sur un wifi d’école, c’est un écran blanc.
  assert.doesNotMatch(lire('css/base.css'), /@import/);
  const famille = /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/;
  for (const page of pages) {
    const html = lire(page);
    const police = html.search(famille);
    assert.ok(police >= 0, `${page} ne charge pas les polices par <link>`);
    assert.ok(html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">') >= 0, `${page} : preconnect googleapis`);
    assert.ok(html.indexOf('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>') >= 0, `${page} : preconnect gstatic`);
    assert.ok(police < html.indexOf('href="css/tokens.css"'), `${page} : les polices passent avant nos feuilles`);
  }
});
