import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute, createRouter } from '../js/router.js';
import { openModal } from '../js/ui.js';

test('matchRoute : exact, paramètres, échec', () => {
  assert.deepEqual(matchRoute('/', '/'), {});
  assert.deepEqual(matchRoute('/materiel', '/materiel'), {});
  assert.deepEqual(matchRoute('/materiel/:id', '/materiel/item_001'), { id: 'item_001' });
  assert.deepEqual(matchRoute('/a/:x/b/:y', '/a/1/b/2'), { x: '1', y: '2' });
  assert.equal(matchRoute('/materiel/:id', '/materiel'), null);
  assert.equal(matchRoute('/materiel', '/emprunts'), null);
  assert.equal(matchRoute('/materiel', '/materiel/x'), null);
});

test('matchRoute décode les segments et tolère le slash final', () => {
  assert.deepEqual(matchRoute('/u/:name', '/u/L%C3%A9a'), { name: 'Léa' });
  assert.deepEqual(matchRoute('/materiel', '/materiel/'), {});
});

// `window` et `document` n’existent pas sous Node : on en pose de quoi faire tourner le routeur et les modales.
function avecNavigateur(fn) {
  const avant = { window: globalThis.window, document: globalThis.document };
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const nav = { hash: '#/a', ecouteurs: [] };
  globalThis.window = {
    location: nav,
    addEventListener: (type, f) => nav.ecouteurs.push([type, f]),
    removeEventListener: (type, f) => { nav.ecouteurs = nav.ecouteurs.filter(([t, g]) => t !== type || g !== f); },
    scrollTo() {},
  };
  globalThis.document = { getElementById: () => root, body: { classList: { add() {}, remove() {} } } };
  try { return fn({ nav, root }); } finally {
    globalThis.window = avant.window;
    globalThis.document = avant.document;
  }
}

test('createRouter : un changement de route ferme la modale ouverte et libère ses ressources', () => {
  avecNavigateur(({ nav, root }) => {
    const appels = [];
    const router = createRouter({
      container: { innerHTML: '' }, defaultPath: '/a',
      routes: [{ path: '/a', view: () => () => appels.push('vue a') }, { path: '/b', view: () => null }],
    });
    router.start();
    openModal({ title: 'Scanner', body: '', onClose: () => appels.push('caméra relâchée') });
    assert.match(root.innerHTML, /Scanner/);
    nav.hash = '#/b';
    router.render();
    assert.deepEqual(appels, ['vue a', 'caméra relâchée'], 'la vue est nettoyée, la modale fermée, sa caméra relâchée');
    assert.equal(root.innerHTML, '', 'la modale ne reste pas posée sur la vue suivante');
    router.stop();
  });
});

test('createRouter : l’arrêt du routeur ferme aussi la modale ouverte', () => {
  avecNavigateur(({ root }) => {
    const router = createRouter({ container: { innerHTML: '' }, routes: [{ path: '/a', view: () => null }] });
    router.start();
    openModal({ title: 'Remise', body: '' });
    router.stop();
    assert.equal(root.innerHTML, '');
  });
});
