// tests/store-crosstab.test.mjs — propagation de l’événement `storage` entre onglets.
// On simule `window` avant d’importer le store pour capter le handler qu’il enregistre,
// puis on le déclenche nous-mêmes comme le ferait le navigateur dans un autre onglet.
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const handlers = {};
globalThis.window = {
  addEventListener(type, fn) { handlers[type] = fn; },
};

const { store, STORAGE_KEY } = await import('../js/store.js');

test('un `storage` avec notre clé recharge et notifie', () => {
  store.init();
  let notified = 0;
  const off = store.subscribe(() => notified++);

  const db = { settings: {}, users: [{ id: 'u1', nom: 'X' }], items: [], loans: [], bookings: [], maintenance: [], log: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  handlers.storage({ key: STORAGE_KEY, newValue: JSON.stringify(db) });

  assert.equal(store.users.list().length, 1);
  assert.equal(notified, 1);
  off();
});

test('un `storage` avec key: null (clear depuis un autre onglet) est ignoré', () => {
  store.init();
  store.users.create({ nom: 'Local' });
  const before = store.users.list().length;
  let notified = 0;
  const off = store.subscribe(() => notified++);

  handlers.storage({ key: null, newValue: null });

  assert.equal(store.users.list().length, before);
  assert.equal(notified, 0);
  off();
});
