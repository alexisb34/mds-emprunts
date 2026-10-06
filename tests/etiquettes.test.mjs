import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { selectLabels } from '../js/etiquettes.js';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('sans paramètre, la page d’étiquettes montre tout l’inventaire, pas un message d’erreur', () => {
  const tous = store.items.list();
  assert.ok(tous.length > 0);
  for (const param of [null, undefined, '', '   ', ',', ' , ']) {
    const r = selectLabels(param, tous);
    assert.equal(r.mode, 'inventaire', JSON.stringify(param));
    assert.equal(r.items.length, tous.length, JSON.stringify(param));
    assert.deepEqual(r.inconnus, []);
  }
});

test('l’inventaire sort trié par code, sans modifier la liste reçue', () => {
  const tous = store.items.list().reverse();
  const avant = tous.map((i) => i.code);
  const codes = selectLabels(null, tous).items.map((i) => i.code);
  assert.deepEqual(codes, [...avant].sort());
  assert.deepEqual(tous.map((i) => i.code), avant);
});

test('avec des codes, seuls ceux-là sortent, dans l’ordre demandé, les inconnus à part', () => {
  const tous = store.items.list();
  const r = selectLabels(' MDS-0004 , MDS-9999,MDS-0003', tous);
  assert.equal(r.mode, 'selection');
  assert.deepEqual(r.items.map((i) => i.code), ['MDS-0004', 'MDS-0003']);
  assert.deepEqual(r.inconnus, ['MDS-9999']);
});

test('des codes qui ne désignent rien ne retombent pas sur l’inventaire : « Codes inconnus »', () => {
  const r = selectLabels('MDS-9998,MDS-9999', store.items.list());
  assert.equal(r.mode, 'selection');
  assert.deepEqual(r.items, []);
  assert.deepEqual(r.inconnus, ['MDS-9998', 'MDS-9999']);
});

test('etiquettes.html passe par selectLabels et n’a plus d’état « aucun code fourni »', () => {
  const html = readFileSync(new URL('../etiquettes.html', import.meta.url), 'utf8');
  assert.match(html, /import \{ selectLabels \} from '\.\/js\/etiquettes\.js'/);
  assert.doesNotMatch(html, /Aucun code fourni/);
  assert.match(html, /tout l’inventaire/, 'la consigne d’impression dit ce que la page montre par défaut');
});
