import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../js/router.js';

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
