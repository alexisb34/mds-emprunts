// Fichier séparé : node --test exécute chaque fichier de test dans son propre processus,
// ce qui permet de vérifier le garde-fou d’initialisation sur un store réellement vierge
// (aucun autre test de ce processus n’a encore appelé store.init()).
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';

test('appeler une méthode de collection avant init() lève', () => {
  assert.throws(() => store.users.list(), /store\.init/);
});

test('appeler settings avant init() lève', () => {
  assert.throws(() => store.settings.get(), /store\.init/);
});
