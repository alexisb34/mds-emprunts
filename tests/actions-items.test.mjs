import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ITEM_STATES } from '../js/models.js';
import { ACTIONS } from '../js/log.js';
import { slugify, nextItemCode, validateItem, createItem, updateItem, setItemState, manualTransitions, itemHistory } from '../js/actions/items.js';

const PEDAGO = 'user_041';
const valid = { nom: 'Multiprise', reference: 'multiprise', categorie: 'Bureautique', circuit: 'self', valeurEstimee: 15, localisation: 'Bureau pédago' };

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('slugify', () => {
  assert.equal(slugify('Trépied LeoFoto'), 'trepied-leofoto');
  assert.equal(slugify('  Carte SD 256 Go '), 'carte-sd-256-go');
  assert.equal(slugify(''), '');
});

test('nextItemCode suit le plus grand code existant', () => {
  assert.equal(nextItemCode(), 'MDS-0045');
  createItem(valid, PEDAGO);
  assert.equal(nextItemCode(), 'MDS-0046');
});

test('validateItem : messages en français', () => {
  assert.deepEqual(validateItem(valid), []);
  const errors = validateItem({ nom: ' ', reference: '', categorie: 'Nope', circuit: 'x', valeurEstimee: -1 });
  assert.equal(errors.length, 5);
  assert.match(errors[0], /nom est obligatoire/);
  assert.match(errors[4], /nombre positif/);
});

test('createItem : code auto, état disponible, journal', () => {
  const before = store.log.list().length;
  const item = createItem({ ...valid, nom: '  Multiprise 7  ', reference: 'Multi Prise' }, PEDAGO);
  assert.equal(item.code, 'MDS-0045');
  assert.equal(item.etat, ITEM_STATES.DISPONIBLE);
  assert.equal(item.nom, 'Multiprise 7');
  assert.equal(item.reference, 'multi-prise');
  assert.equal(item.notes, '');
  const entry = store.log.list().at(-1);
  assert.equal(store.log.list().length, before + 1);
  assert.equal(entry.action, ACTIONS.ITEM_CREE);
  assert.equal(entry.itemId, item.id);
  assert.equal(entry.auteurId, PEDAGO);
  assert.match(entry.detail, /Multiprise 7 \(MDS-0045\)/);
});

test('createItem refuse des données invalides sans rien écrire', () => {
  const before = store.items.list().length;
  assert.throws(() => createItem({ ...valid, categorie: 'Nope' }, PEDAGO), /catégorie est invalide/);
  assert.equal(store.items.list().length, before);
});

test('updateItem : champs protégés ignorés, validation, journal', () => {
  const item = store.items.get('item_001');
  const up = updateItem('item_001', { nom: 'Multiprise A', code: 'MDS-9999', etat: 'hs', id: 'x', valeurEstimee: '20' }, PEDAGO);
  assert.equal(up.nom, 'Multiprise A');
  assert.equal(up.code, item.code);
  assert.equal(up.etat, item.etat);
  assert.equal(up.id, 'item_001');
  assert.equal(up.valeurEstimee, 20);
  assert.equal(store.log.list().at(-1).action, ACTIONS.ITEM_MODIFIE);
  assert.throws(() => updateItem('item_001', { nom: '' }, PEDAGO), /nom est obligatoire/);
  assert.throws(() => updateItem('nope', { nom: 'x' }, PEDAGO), /introuvable/);
});

test('setItemState : transition autorisée, journal, disponibles décrémentés', () => {
  const dispoAvant = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE).length;
  const free = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const up = setItemState(free.id, ITEM_STATES.HS, PEDAGO, 'cassé');
  assert.equal(up.etat, ITEM_STATES.HS);
  assert.equal(store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE).length, dispoAvant - 1);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.ITEM_ETAT);
  assert.match(entry.detail, /Disponible → Hors service — cassé/);
});

test('setItemState refuse une transition interdite', () => {
  const hs = store.items.list((i) => i.etat === ITEM_STATES.HS)[0];
  assert.throws(() => setItemState(hs.id, ITEM_STATES.EMPRUNTE, PEDAGO), /Transition matériel interdite : hs → emprunte/);
  assert.throws(() => setItemState('nope', ITEM_STATES.HS, PEDAGO), /introuvable/);
});

test('manualTransitions : seulement les états pilotés à la main', () => {
  assert.deepEqual(manualTransitions({ etat: 'disponible' }), ['maintenance', 'hs']);
  assert.deepEqual(manualTransitions({ etat: 'maintenance' }), ['disponible', 'hs']);
  assert.deepEqual(manualTransitions({ etat: 'hs' }), ['maintenance', 'disponible']);
  assert.deepEqual(manualTransitions({ etat: 'emprunte' }), []);
  assert.deepEqual(manualTransitions({ etat: 'reserve' }), []);
});

test('itemHistory : emprunts, maintenance et journal du plus récent au plus ancien', () => {
  const canon = store.items.list((i) => i.reference === 'canon-r10')[0];
  const h = itemHistory(canon.id);
  assert.ok(h.loans.length >= 1);
  assert.ok(h.loans.every((l) => l.itemId === canon.id));
  assert.ok(h.loans.every((l, i, a) => i === 0 || a[i - 1].createdAt >= l.createdAt));
  assert.equal(h.maintenance.length, 1);
  assert.equal(h.maintenance[0].prestataire, 'Optic Services');
  assert.ok(h.log.length >= 2);
  assert.ok(h.log.every((e) => e.itemId === canon.id));
});
