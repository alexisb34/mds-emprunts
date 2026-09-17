import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, PROMOS, CIRCUITS, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES,
  ITEM_TRANSITIONS, LOAN_TRANSITIONS, BOOKING_TRANSITIONS, MAINT_TRANSITIONS,
  canTransition, assertTransition, LABELS,
} from '../js/models.js';

test('les 9 promos sont définies', () => {
  assert.equal(PROMOS.length, 9);
  assert.ok(PROMOS.includes('MBA 2 UX/UI'));
  assert.ok(PROMOS.includes('Bachelor 1'));
});

test('transitions d\'emprunt : reservee → en_cours autorisée, retournee → en_cours interdite', () => {
  assert.equal(canTransition(LOAN_TRANSITIONS, LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS), true);
  assert.equal(canTransition(LOAN_TRANSITIONS, LOAN_STATES.RETOURNEE, LOAN_STATES.EN_COURS), false);
  assert.equal(canTransition(LOAN_TRANSITIONS, 'inconnu', LOAN_STATES.EN_COURS), false);
});

test('assertTransition lève une erreur en français', () => {
  assert.throws(
    () => assertTransition(ITEM_TRANSITIONS, ITEM_STATES.HS, ITEM_STATES.EMPRUNTE, 'matériel'),
    /Transition matériel interdite : hs → emprunte/,
  );
  assert.doesNotThrow(() => assertTransition(ITEM_TRANSITIONS, ITEM_STATES.DISPONIBLE, ITEM_STATES.EMPRUNTE, 'matériel'));
});

test('chaque état a un libellé', () => {
  for (const s of Object.values(ITEM_STATES)) assert.ok(LABELS.itemState[s], `itemState ${s}`);
  for (const s of Object.values(LOAN_STATES)) assert.ok(LABELS.loanState[s], `loanState ${s}`);
  for (const s of Object.values(BOOKING_STATES)) assert.ok(LABELS.bookingState[s], `bookingState ${s}`);
  for (const s of Object.values(MAINT_STATES)) assert.ok(LABELS.maintState[s], `maintState ${s}`);
  for (const c of Object.values(CIRCUITS)) assert.ok(LABELS.circuit[c], `circuit ${c}`);
  for (const r of Object.values(ROLES)) assert.ok(LABELS.role[r], `role ${r}`);
});

test('toutes les tables de transitions couvrent tous leurs états', () => {
  for (const s of Object.values(ITEM_STATES)) assert.ok(Array.isArray(ITEM_TRANSITIONS[s]), s);
  for (const s of Object.values(LOAN_STATES)) assert.ok(Array.isArray(LOAN_TRANSITIONS[s]), s);
  for (const s of Object.values(BOOKING_STATES)) assert.ok(Array.isArray(BOOKING_TRANSITIONS[s]), s);
  for (const s of Object.values(MAINT_STATES)) assert.ok(Array.isArray(MAINT_TRANSITIONS[s]), s);
});
