// tests/admin-dom-readers.test.mjs — lecteurs de formulaires DOM (readItemForm, readUserForm)
// et takeSearch, testés avec un stub minimal de `querySelector` plutôt qu’un vrai DOM.
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readItemForm } from '../js/admin/views/materiel.js';
import { readUserForm } from '../js/admin/views/utilisateurs.js';
import { SEARCH_KEY, takeSearch } from '../js/admin/layout.js';

function stubRoot(values) {
  return { querySelector: (sel) => ({ value: values[sel.match(/name="(\w+)"/)[1]] }) };
}

beforeEach(() => {
  sessionStorage.clear();
});

test('readItemForm : lit les 9 champs du formulaire matériel, dont photoUrl', () => {
  const values = {
    nom: 'Canon R10', reference: 'canon-r10', categorie: 'Photo', circuit: 'valeur',
    valeurEstimee: '1100', localisation: 'Armoire', dateAchat: '2025-09-01', photoUrl: 'https://x/y.jpg', notes: 'RAS',
  };
  const root = stubRoot(values);
  assert.deepEqual(readItemForm(root), values);
  assert.equal(Object.keys(readItemForm(root)).length, 9);
});

test('readUserForm : promo vide devient null', () => {
  const root = stubRoot({ prenom: 'Nina', nom: 'Costa', email: 'nina.costa@mds-demo.fr', role: 'eleve', promo: '' });
  assert.deepEqual(readUserForm(root), { prenom: 'Nina', nom: 'Costa', email: 'nina.costa@mds-demo.fr', role: 'eleve', promo: null });
});

test('takeSearch : renvoie la valeur déposée puis la vide (sessionStorage)', () => {
  sessionStorage.setItem(SEARCH_KEY, 'canon');
  assert.equal(takeSearch(), 'canon');
  assert.equal(takeSearch(), '');
  assert.equal(sessionStorage.getItem(SEARCH_KEY), null);
});
