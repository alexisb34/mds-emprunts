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
