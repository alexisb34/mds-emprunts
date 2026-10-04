import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store, STORAGE_KEY, COLLECTIONS, genId } from '../js/store.js';

beforeEach(() => {
  localStorage.clear();
  store.init();
});

test('init crée une base vide et la persiste', () => {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  for (const c of COLLECTIONS) assert.deepEqual(raw[c], []);
  assert.deepEqual(raw.settings, {});
});

test('init avec seedFn charge le seed une seule fois', () => {
  localStorage.clear();
  const seedFn = () => ({ settings: { a: 1 }, users: [{ id: 'u1', nom: 'X' }], items: [], loans: [], bookings: [], maintenance: [], log: [] });
  store.init(seedFn);
  assert.equal(store.users.get('u1').nom, 'X');
  store.users.update('u1', { nom: 'Y' });
  store.init(seedFn); // ne doit pas écraser
  assert.equal(store.users.get('u1').nom, 'Y');
});

test('create ajoute id, createdAt, updatedAt et persiste', () => {
  const u = store.users.create({ nom: 'Dupont' });
  assert.match(u.id, /^user_/);
  assert.ok(u.createdAt);
  assert.equal(u.createdAt, u.updatedAt);
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(raw.users[0].nom, 'Dupont');
});

test('create respecte un id fourni', () => {
  const u = store.users.create({ id: 'user_fixe', nom: 'A' });
  assert.equal(u.id, 'user_fixe');
  assert.equal(store.users.get('user_fixe').nom, 'A');
});

test('get renvoie null si absent', () => {
  assert.equal(store.users.get('nope'), null);
});

test('list renvoie une copie, filtrable', () => {
  store.items.create({ nom: 'A', etat: 'disponible' });
  store.items.create({ nom: 'B', etat: 'hs' });
  const all = store.items.list();
  assert.equal(all.length, 2);
  all.push({});
  assert.equal(store.items.list().length, 2);
  assert.equal(store.items.list((i) => i.etat === 'hs')[0].nom, 'B');
});

test('update fusionne et met à jour updatedAt ; lève si absent', async () => {
  const it = store.items.create({ nom: 'A', etat: 'disponible' });
  await new Promise((r) => setTimeout(r, 5));
  const up = store.items.update(it.id, { etat: 'hs' });
  assert.equal(up.nom, 'A');
  assert.equal(up.etat, 'hs');
  assert.notEqual(up.updatedAt, it.updatedAt);
  assert.throws(() => store.items.update('nope', {}), /introuvable/);
});

test('remove supprime ; lève si absent', () => {
  const it = store.items.create({ nom: 'A' });
  store.items.remove(it.id);
  assert.equal(store.items.get(it.id), null);
  assert.throws(() => store.items.remove(it.id), /introuvable/);
});

test('settings get/update', () => {
  store.settings.update({ horlogeDemo: '2026-09-17T10:00:00.000Z' });
  assert.equal(store.settings.get().horlogeDemo, '2026-09-17T10:00:00.000Z');
});

test('subscribe est notifié à chaque mutation et désabonnable', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  store.users.create({ nom: 'A' });
  store.settings.update({ x: 1 });
  assert.equal(n, 2);
  off();
  store.users.create({ nom: 'B' });
  assert.equal(n, 2);
});

test('reset recharge le seed', () => {
  store.users.create({ nom: 'A' });
  store.reset(() => ({ settings: {}, users: [], items: [], loans: [], bookings: [], maintenance: [], log: [] }));
  assert.equal(store.users.list().length, 0);
});

test('usage renvoie un pourcentage du budget 5 Mo', () => {
  const u = store.usage();
  assert.equal(u.budget, 5 * 1024 * 1024);
  assert.ok(u.bytes > 0);
  assert.ok(u.percent >= 0 && u.percent <= 100);
});

test('genId préfixe et unicité', () => {
  const a = genId('loan');
  const b = genId('loan');
  assert.match(a, /^loan_/);
  assert.notEqual(a, b);
});

test('les enregistrements renvoyés par get/list sont gelés', () => {
  const u = store.users.create({ nom: 'Dupont' });
  assert.throws(() => { store.users.get(u.id).nom = 'X'; }, TypeError);
  assert.equal(store.users.get(u.id).nom, 'Dupont');
});

test('settings.get() renvoie un objet gelé', () => {
  store.settings.update({ horaires: [{ debut: 8, fin: 12 }] });
  assert.throws(() => { store.settings.get().horaires[0].debut = 99; }, TypeError);
});

test('un seedFn qui renvoie des objets mutables est gelé après init', () => {
  localStorage.clear();
  const seedFn = () => ({ settings: {}, users: [{ id: 'u1', nom: 'X' }], items: [], loans: [], bookings: [], maintenance: [], log: [] });
  store.init(seedFn);
  assert.ok(Object.isFrozen(store.users.get('u1')));
});

test('transaction : si fn() lève, les écritures intermédiaires sont annulées sans notification', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  assert.throws(() => store.transaction(() => {
    store.users.create({ nom: 'A' });
    throw new Error('boom');
  }), /boom/);
  off();
  assert.equal(store.users.list().length, 0);
  assert.equal(n, 0, 'aucun abonné n’a vu l’état intermédiaire');
});

test('transaction : si fn() réussit, renvoie sa valeur et conserve les écritures', () => {
  const u = store.transaction(() => store.users.create({ nom: 'A' }));
  assert.equal(u.nom, 'A');
  assert.equal(store.users.list().length, 1);
});

test('transaction : une seule persistance et une seule notification', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  const out = store.transaction(() => {
    store.users.create({ nom: 'A' });
    store.users.create({ nom: 'B' });
    store.settings.update({ marqueur: 1 });
    return 'ok';
  });
  off();
  assert.equal(out, 'ok');
  assert.equal(n, 1, 'une seule notification pour trois écritures');
  assert.equal(store.users.list().length, 2);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).users.length, 2, 'persisté');
});

test('transaction : un échec ne notifie pas et ne laisse rien derrière', () => {
  const before = store.users.list().length;
  let n = 0;
  const off = store.subscribe(() => n++);
  assert.throws(() => store.transaction(() => {
    store.users.create({ nom: 'A' });
    throw new Error('boum');
  }), /boum/);
  off();
  assert.equal(n, 0, 'aucune notification pour une transaction annulée');
  assert.equal(store.users.list().length, before);
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).users.length, before);
});

test('transaction imbriquée : la notification part à la sortie de la plus externe', () => {
  let n = 0;
  const off = store.subscribe(() => n++);
  store.transaction(() => {
    store.users.create({ nom: 'A' });
    store.transaction(() => { store.users.create({ nom: 'B' }); });
    assert.equal(n, 0, 'rien pendant la transaction');
  });
  off();
  assert.equal(n, 1);
  assert.equal(store.users.list().length, 2);
});
