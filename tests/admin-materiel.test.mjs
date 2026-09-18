import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { filterItems, COLUMNS, materielHtml, itemFormHtml } from '../js/admin/views/materiel.js';
import { sortRows } from '../js/admin/table.js';

const db = buildSeed(new Date(2026, 8, 17, 10, 0));

test('filterItems : recherche, catégorie, circuit, état combinés', () => {
  assert.equal(filterItems(db.items, {}).length, 44);
  assert.equal(filterItems(db.items, { q: 'canon r10' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'canon' }).length, 4); // + 3 batteries Canon LP-E17
  assert.equal(filterItems(db.items, { q: 'MDS-0001' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'armoire' }).length, 16);
  assert.equal(filterItems(db.items, { categorie: 'Audio' }).length, 9);
  assert.equal(filterItems(db.items, { circuit: 'salle' }).length, 5);
  assert.equal(filterItems(db.items, { etat: 'hs' }).length, 1);
  assert.equal(filterItems(db.items, { q: 'multi', etat: 'emprunte' }).length, 2);
});

test('COLUMNS : clés attendues, rendus échappés', () => {
  assert.deepEqual(COLUMNS.map((c) => c.key), ['code', 'nom', 'categorie', 'circuit', 'etat', 'localisation', 'valeurEstimee']);
  const item = { ...db.items[0], nom: '<x>' };
  assert.match(COLUMNS[1].render(item), /&lt;x&gt;/);
  assert.match(COLUMNS[3].render(item), /badge--available">Self-service/);
  assert.match(COLUMNS[6].render(item), /15 €/);
});

test('materielHtml : compteurs, filtres, table triée', () => {
  const filters = { q: 'sd', categorie: '', circuit: 'valeur', etat: '' };
  const items = sortRows(filterItems(db.items, filters), { key: 'code', dir: 'asc' }, COLUMNS);
  const html = materielHtml({ items, total: 44, disponibles: 30, filters, sort: { key: 'code', dir: 'asc' } });
  assert.match(html, /44 exemplaires · 30 disponibles/);
  assert.match(html, /6 résultats/);
  assert.match(html, /value="sd"/);
  assert.match(html, /<option value="valeur" selected>Sur réservation/);
  assert.match(html, /Carte SD 256 Go #1/);
  assert.match(html, /data-key="code">Code ↑/);
});

test('itemFormHtml : champs nommés, datalist des références, valeurs pré-remplies', () => {
  const html = itemFormHtml({ nom: 'Canon "R10"', reference: 'canon-r10', categorie: 'Photo', circuit: 'valeur', valeurEstimee: 1100, localisation: 'Armoire', dateAchat: '2025-09-01', notes: '' }, ['canon-r10', 'zoom-h5']);
  for (const name of ['nom', 'reference', 'categorie', 'circuit', 'valeurEstimee', 'localisation', 'dateAchat', 'notes']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /value="Canon &quot;R10&quot;"/);
  assert.match(html, /<option value="Photo" selected>/);
  assert.match(html, /<option value="valeur" selected>/);
  assert.match(html, /<datalist id="ref-list"><option value="canon-r10"><option value="zoom-h5"><\/datalist>/);
  assert.match(itemFormHtml(), /<option value="self" selected>/);
});
