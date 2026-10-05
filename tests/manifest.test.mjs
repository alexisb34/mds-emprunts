import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

// Un `statSync(...).size > 0` accepterait un fichier texte renommé en .png : on lit
// vraiment l’en-tête PNG et on compare ses dimensions à celles que le manifeste annonce.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('manifest : les deux icônes sont de vrais PNG aux dimensions annoncées', () => {
  const tailles = manifest.icons.map((i) => i.sizes);
  assert.deepEqual(tailles.sort(), ['192x192', '512x512']);
  for (const icone of manifest.icons) {
    assert.equal(icone.type, 'image/png');
    const octets = readFileSync(new URL(`../${icone.src}`, import.meta.url));
    assert.deepEqual(octets.subarray(0, 8), PNG_SIGNATURE, `${icone.src} n’est pas un PNG`);
    assert.equal(octets.subarray(12, 16).toString('ascii'), 'IHDR');
    const [attendue] = icone.sizes.split('x').map(Number);
    assert.equal(octets.readUInt32BE(16), attendue, `largeur de ${icone.src}`);
    assert.equal(octets.readUInt32BE(20), attendue, `hauteur de ${icone.src}`);
  }
  assert.ok(manifest.icons.some((i) => (i.purpose || '').includes('any')));
});

test('manifest : identité d’installation par défaut et couleur de thème accordées au document', () => {
  // `id` se résout contre l’origine, pas contre le manifeste : `"mobile.html"` deviendrait
  // `https://<compte>.github.io/mobile.html`. Sans `id`, l’identité est `start_url`, qui se
  // résout, lui, depuis le manifeste et donc sous le sous-répertoire de publication.
  assert.equal('id' in manifest, false);
  assert.equal(manifest.start_url, 'mobile.html');
  const html = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');
  const meta = /<meta name="theme-color" content="([^"]+)">/.exec(html);
  assert.ok(meta, 'mobile.html déclare une couleur de thème');
  assert.equal(meta[1], manifest.theme_color, 'le manifeste et le document doivent s’accorder');
});

test('mobile.html : lien vers le manifeste et métadonnées d’installation', () => {
  const html = readFileSync(new URL('../mobile.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="apple-touch-icon" href="assets\/icon-192\.png">/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /viewport-fit=cover/, 'les zones sûres ont besoin du viewport plein écran');
});
