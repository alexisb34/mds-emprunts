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
    /\b(?:src|href)\s*=\s*(["'])(.*?)\1/g,
    /\bimport\s*(?:[^'"()]*?\bfrom\s*)?(["'])(.*?)\1/g,
    /\bimport\s*\(\s*(["'])(.*?)\1\s*\)/g,
    /\burl\(\s*(["']?)(.*?)\1\s*\)/g,
  ];
  return motifs.flatMap((re) => [...html.matchAll(re)].map((m) => m[2].trim()));
}

// Une référence externe (`https:`, `data:`, `mailto:`, `//cdn…`) n’est pas notre affaire.
const estExterne = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//');

// Chemin local, sans fragment ni requête ; chaque segment doit exister avec SA casse :
// un `existsSync` indulgent sur macOS laisserait passer un 404 sous Linux.
function cheminLocal(ref) {
  return ref.replace(/[#?].*$/, '');
}

function segmentAbsent(chemin) {
  const segments = posix.normalize(chemin).split('/').filter((s) => s && s !== '.');
  let dossier = '';
  for (const segment of segments) {
    const present = readdirSync(new URL(dossier, RACINE));
    if (!present.includes(segment)) return segment;
    dossier += `${segment}/`;
  }
  return null;
}

function problemes(html) {
  const out = [];
  for (const ref of references(html)) {
    if (!ref || estExterne(ref)) continue;
    if (ref.startsWith('/')) { out.push(`${ref} : chemin absolu, hors du site une fois publié`); continue; }
    const chemin = cheminLocal(ref);
    if (!chemin) continue; // fragment seul
    const absent = segmentAbsent(chemin);
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
  for (const champ of ['start_url', 'scope', 'id']) {
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
