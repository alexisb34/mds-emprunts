import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, initialState, onScanResolved, onPhoto, setChecklistLine, onDone, onError } from '../js/mobile/scanFlow.js';

const item = { id: 'i1', reference: 'multiprise', nom: 'Multiprise #1' };

test('initialState', () => {
  assert.deepEqual(initialState(), { step: STEPS.SCAN, mode: null, item: null, loan: null, reason: null, photo: null, checklist: null, result: null, error: null });
});

test('emprunt : scan → photo → confirmation → terminé', () => {
  let s = onScanResolved(initialState(), { mode: 'emprunt', item, loan: null, reason: null });
  assert.equal(s.step, STEPS.PHOTO);
  assert.equal(s.mode, 'emprunt');
  s = onPhoto(s, 'data:image/jpeg;base64,AAA');
  assert.equal(s.step, STEPS.CONFIRM);
  assert.equal(s.checklist, null);
  s = onDone(s, { loanId: 'l1' });
  assert.equal(s.step, STEPS.DONE);
  assert.deepEqual(s.result, { loanId: 'l1' });
});

test('retour : scan → photo → checklist pré-remplie → terminé', () => {
  let s = onScanResolved(initialState(), { mode: 'retour', item, loan: { id: 'l1' }, reason: null });
  s = onPhoto(s, 'data:image/jpeg;base64,AAA');
  assert.equal(s.step, STEPS.CHECKLIST);
  assert.equal(s.checklist.length, 3);
  assert.ok(s.checklist.every((l) => l.ok));
  const s2 = setChecklistLine(s, 0, { ok: false, commentaire: 'gaine coupée' });
  assert.equal(s2.checklist[0].ok, false);
  assert.equal(s2.checklist[0].commentaire, 'gaine coupée');
  assert.equal(s.checklist[0].ok, true, 'immutabilité');
  const s3 = setChecklistLine(s2, 0, { ok: true });
  assert.equal(s3.checklist[0].commentaire, '', 'repasser en OK vide le commentaire');
});

test('refus : scan → erreur avec motif', () => {
  const s = onScanResolved(initialState(), { mode: 'erreur', item, loan: null, reason: 'bureau_ferme' });
  assert.equal(s.step, STEPS.ERREUR);
  assert.equal(s.reason, 'bureau_ferme');
  assert.equal(s.item, item);
});

test('onError : erreur technique avec message', () => {
  const s = onError(onScanResolved(initialState(), { mode: 'emprunt', item, loan: null, reason: null }), 'Caméra indisponible');
  assert.equal(s.step, STEPS.ERREUR);
  assert.equal(s.error, 'Caméra indisponible');
  assert.equal(s.reason, null);
});
