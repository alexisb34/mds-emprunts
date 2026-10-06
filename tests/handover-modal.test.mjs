import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { addDays } from '../js/rules.js';
import { ITEM_STATES, LOAN_STATES } from '../js/models.js';
import { loanQrPayload } from '../js/qr.js';
import { reserveValeur } from '../js/actions/loans.js';
import { codeMatchesLoan, handOverChecked, isKnownRetraitCode } from '../js/admin/handoverModal.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const DEMAIN9 = new Date(2026, 8, 18, 9, 0);
const PEDAGO = 'user_041';

let a;
let b;
beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
  // Deux réservations distinctes pour demain 9h ; on avance ensuite l’horloge dans la fenêtre de retrait.
  a = reserveValeur({ reference: 'hoya-nd', userId: 'user_010', debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  b = reserveValeur({ reference: 'sd-256', userId: 'user_011', debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  store.settings.update({ horlogeDemo: new Date(2026, 8, 18, 9, 10).toISOString() });
});

test('codeMatchesLoan : le code, en minuscules ou en QR, de la bonne réservation', () => {
  assert.equal(codeMatchesLoan(a.codeRetrait, a), true);
  assert.equal(codeMatchesLoan(` ${a.codeRetrait.toLowerCase()} `, a), true);
  assert.equal(codeMatchesLoan(loanQrPayload(a), a), true);
  // Le bon identifiant avec un mauvais code court ne suffit pas : `handOverChecked`
  // reconstruit la charge utile, donc cette comparaison est la dernière.
  assert.equal(codeMatchesLoan(`LOAN-${a.id}-ZZZZZZ`, a), false);
});

test('codeMatchesLoan : le code, ou le QR, d’une autre réservation est refusé', () => {
  assert.equal(codeMatchesLoan(b.codeRetrait, a), false);
  assert.equal(codeMatchesLoan(loanQrPayload(b), a), false);
  assert.equal(codeMatchesLoan('', a), false);
});

test('codeMatchesLoan : sans réservation attendue, tout code est accepté', () => {
  assert.equal(codeMatchesLoan(b.codeRetrait, null), true);
  assert.equal(codeMatchesLoan('n’importe quoi', null), true);
});

test('handOverChecked : le code d’une autre réservation est refusé sans rien écrire', () => {
  const logAvant = store.log.list().length;
  assert.throws(() => handOverChecked({ saisi: b.codeRetrait, loan: a, pedagoId: PEDAGO }), /autre réservation/);
  assert.throws(() => handOverChecked({ saisi: loanQrPayload(b), loan: a, pedagoId: PEDAGO }), /autre réservation/);
  for (const l of [a, b]) {
    const lu = store.loans.get(l.id);
    assert.equal(lu.statut, LOAN_STATES.RESERVEE);
    assert.equal(lu.remisPar ?? null, null);
    assert.equal(lu.dateRetrait ?? null, null);
    assert.equal(store.items.get(l.itemId).etat, ITEM_STATES.DISPONIBLE, 'un refus ne remet rien : l’objet n’est pas sorti');
  }
  assert.equal(store.log.list().length, logAvant, 'aucune ligne de journal');
});

test('handOverChecked : le bon code remet la bonne réservation, et l’autre reste intacte', () => {
  const remis = handOverChecked({ saisi: a.codeRetrait.toLowerCase(), loan: a, pedagoId: PEDAGO });
  assert.equal(remis.id, a.id);
  assert.equal(store.loans.get(a.id).statut, LOAN_STATES.EN_COURS);
  assert.equal(store.loans.get(b.id).statut, LOAN_STATES.RESERVEE);
  // Sans réservation attendue (code tapé dans la recherche), n’importe quelle réservation se remet.
  assert.equal(handOverChecked({ saisi: b.codeRetrait, pedagoId: PEDAGO }).id, b.id);
});

test('isKnownRetraitCode : seul un code porté par un emprunt est reconnu', () => {
  const loans = store.loans.list();
  assert.equal(isKnownRetraitCode(a.codeRetrait, loans), true);
  assert.equal(isKnownRetraitCode(b.codeRetrait, loans), true);
  // Un code bien formé que AUCUN emprunt du jeu complet ne porte : il doit être refusé, sans
  // retirer quoi que ce soit de la liste (sinon la fonction pourrait tout accepter sans que le test le voie).
  const portes = new Set(loans.map((l) => l.codeRetrait));
  const inconnu = ['CAMERA', 'ZZZZZZ', 'AAAAAA', 'MMMMMM'].find((c) => !portes.has(c));
  assert.ok(inconnu, 'un code d’essai que personne ne porte');
  assert.equal(isKnownRetraitCode(inconnu, loans), false);
  assert.equal(isKnownRetraitCode(a.codeRetrait, []), false, 'sans emprunt, aucun code n’est connu');
  assert.equal(isKnownRetraitCode(a.codeRetrait, loans.filter((l) => l.codeRetrait !== a.codeRetrait)), false, 'le code d’une réservation retirée de la liste n’est plus connu');
});

test('handOverChecked : avec la ligne connue, la remise passe par l’identifiant, pas par le code', () => {
  // Rien n’impose l’unicité du code court au tirage : on force la collision.
  store.loans.update(b.id, { codeRetrait: a.codeRetrait });
  // La modale est ouverte depuis la ligne B, la SECONDE à porter ce code. Une remise
  // par code prendrait A, la première réservation en attente trouvée ; par identifiant,
  // c’est bien B qui part.
  const remis = handOverChecked({ saisi: a.codeRetrait, loan: store.loans.get(b.id), pedagoId: PEDAGO });
  assert.equal(remis.id, b.id, 'c’est la réservation de la ligne ouverte qui est remise');
  assert.equal(store.loans.get(b.id).statut, LOAN_STATES.EN_COURS);
  assert.equal(store.loans.get(a.id).statut, LOAN_STATES.RESERVEE, 'l’autre réservation n’a pas bougé');
});
