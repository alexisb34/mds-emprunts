import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { baseName, groupByReference, filterCatalog, availability } from '../js/mobile/catalog.js';

const db = buildSeed(new Date(2026, 8, 17, 10, 0));

test('baseName retire le numéro d’exemplaire', () => {
  assert.equal(baseName('Multiprise #3'), 'Multiprise');
  assert.equal(baseName('Canon R10 + objectif 18-55 + bague'), 'Canon R10 + objectif 18-55 + bague');
});

test('groupByReference : une carte par référence, compteurs, tri par nom', () => {
  const groups = groupByReference(db.items);
  assert.equal(groups.length, 20);
  const multi = groups.find((g) => g.reference === 'multiprise');
  assert.equal(multi.nom, 'Multiprise');
  assert.equal(multi.total, 6);
  assert.equal(multi.disponibles, 4);
  assert.equal(multi.exemplaires.length, 6);
  assert.equal(multi.circuit, 'self');
  const noms = groups.map((g) => g.nom);
  assert.deepEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, 'fr')));
});

test('filterCatalog : recherche et catégorie', () => {
  const groups = groupByReference(db.items);
  assert.equal(filterCatalog(groups, { q: 'sd' }).length, 2);
  assert.equal(filterCatalog(groups, { categorie: 'Audio' }).length, 5);
  assert.equal(filterCatalog(groups, { q: 'zoom', categorie: 'Audio' }).length, 1);
  assert.equal(filterCatalog(groups, { q: 'zoom', categorie: 'Photo' }).length, 0);
});

test('availability : disponible, tout emprunté, maintenance/HS', () => {
  const groups = groupByReference(db.items);
  assert.deepEqual(availability(groups.find((g) => g.reference === 'multiprise')), { kind: 'item', value: 'disponible', text: '4 sur 6 disponibles' });
  assert.deepEqual(availability(groups.find((g) => g.reference === 'canon-r10')), { kind: 'item', value: 'emprunte', text: '' });
  assert.deepEqual(availability(groups.find((g) => g.reference === 'tascam-dr70')), { kind: 'item', value: 'disponible', text: '' }, 'réservé à venir : présent, donc disponible au catalogue');
  const hsOnly = { exemplaires: [{ etat: 'hs' }, { etat: 'maintenance' }], disponibles: 0, total: 2 };
  assert.deepEqual(availability(hsOnly), { kind: 'item', value: 'maintenance', text: 'Indisponible' });
});
