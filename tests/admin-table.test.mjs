import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortRows, toggleSort, renderTable } from '../js/admin/table.js';

const columns = [
  { key: 'nom', label: 'Nom', sortable: true },
  { key: 'valeur', label: 'Valeur', sortable: true, align: 'right' },
  { key: 'etat', label: 'État', sortValue: (r) => ({ a: 1, b: 2 }[r.etat]) },
];
const rows = [
  { id: '1', nom: 'Écran', valeur: 10, etat: 'b' },
  { id: '2', nom: 'câble', valeur: 200, etat: 'a' },
  { id: '3', nom: 'Batterie 10', valeur: null, etat: 'a' },
  { id: '4', nom: 'Batterie 9', valeur: 5, etat: 'b' },
];

test('sortRows : texte (locale fr, numérique), nombres, null en dernier, desc', () => {
  assert.deepEqual(sortRows(rows, { key: 'nom', dir: 'asc' }, columns).map((r) => r.id), ['4', '3', '2', '1']);
  assert.deepEqual(sortRows(rows, { key: 'valeur', dir: 'asc' }, columns).map((r) => r.id), ['4', '1', '2', '3']);
  assert.deepEqual(sortRows(rows, { key: 'valeur', dir: 'desc' }, columns).map((r) => r.id), ['2', '1', '4', '3']);
  assert.deepEqual(sortRows(rows, { key: 'etat', dir: 'asc' }, columns).map((r) => r.etat), ['a', 'a', 'b', 'b']);
  assert.deepEqual(sortRows(rows, null, columns).map((r) => r.id), ['1', '2', '3', '4']);
  assert.notEqual(sortRows(rows, null, columns), rows);
});

test('toggleSort : asc → desc → asc, nouvelle clé → asc', () => {
  assert.deepEqual(toggleSort(null, 'nom'), { key: 'nom', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'asc' }, 'nom'), { key: 'nom', dir: 'desc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'desc' }, 'nom'), { key: 'nom', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'nom', dir: 'desc' }, 'valeur'), { key: 'valeur', dir: 'asc' });
});

test('renderTable : en-têtes triables avec flèche, cellules échappées, lien de ligne', () => {
  const html = renderTable({ columns, rows: [{ id: '1', nom: '<b>x</b>', valeur: 1, etat: 'a' }], sort: { key: 'valeur', dir: 'desc' }, rowHref: (r) => `/materiel/${r.id}` });
  assert.match(html, /<th data-sortable data-key="nom">Nom<\/th>/);
  assert.match(html, /<th data-sortable data-key="valeur" style="text-align:right">Valeur ↓<\/th>/);
  assert.match(html, /<th>État<\/th>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /<tr data-href="\/materiel\/1">/);
});

test('renderTable : render personnalisé et état vide', () => {
  const cols = [{ key: 'nom', label: 'Nom', render: (r) => `<em>${r.nom}</em>` }];
  assert.match(renderTable({ columns: cols, rows: [{ nom: 'A' }] }), /<td><em>A<\/em><\/td>/);
  const empty = renderTable({ columns: cols, rows: [], emptyText: 'Rien.' });
  assert.match(empty, /empty-state">Rien\.</);
  assert.doesNotMatch(empty, /<tbody>/);
});
