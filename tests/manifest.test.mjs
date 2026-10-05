import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('manifest : nom, portée, affichage et couleurs de la charte', () => {
  assert.equal(manifest.name, 'MDS Emprunts');
  assert.equal(manifest.short_name, 'Emprunts');
  assert.equal(manifest.lang, 'fr');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, 'mobile.html');
  assert.equal(manifest.scope, '.');
  assert.equal(manifest.theme_color, '#662483');
  assert.ok(manifest.background_color);
});

test('manifest : les deux icônes existent et ne sont pas vides', () => {
  const tailles = manifest.icons.map((i) => i.sizes);
  assert.deepEqual(tailles.sort(), ['192x192', '512x512']);
  for (const icone of manifest.icons) {
    assert.equal(icone.type, 'image/png');
    const stat = statSync(new URL(`../${icone.src}`, import.meta.url));
    assert.ok(stat.size > 0, `${icone.src} est vide`);
  }
  assert.ok(manifest.icons.some((i) => (i.purpose || '').includes('any')));
});

test('mobile.html : lien vers le manifeste et métadonnées d’installation', () => {
  const html = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="assets\/icon-192\.png">/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /viewport-fit=cover/, 'les zones sûres ont besoin du viewport plein écran');
});
