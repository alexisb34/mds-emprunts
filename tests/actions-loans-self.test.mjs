import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES } from '../js/models.js';
import { findOpenLoanForItem, resolveScan, borrowSelf, returnSelf, userLoans } from '../js/actions/loans.js';

const NOW = new Date(2026, 8, 17, 10, 0); // jeudi 10h
const LEA = 'user_001';
const PHOTO = 'data:image/jpeg;base64,AAAA';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

const itemByCode = (code) => store.items.list((i) => i.code === code)[0];
const freeSelf = (ref) => store.items.list((i) => i.reference === ref && i.etat === ITEM_STATES.DISPONIBLE)[0];

test('findOpenLoanForItem : emprunt en cours ou null', () => {
  assert.equal(findOpenLoanForItem('item_001').statut, LOAN_STATES.EN_COURS);
  assert.equal(findOpenLoanForItem(freeSelf('souris').id), null);
});

test('resolveScan : code inconnu ou malformé', () => {
  assert.equal(resolveScan('MDS-9999', LEA).reason, REASONS.CODE_INCONNU);
  assert.equal(resolveScan('bonjour', LEA).mode, 'erreur');
  assert.equal(resolveScan('', LEA).reason, REASONS.CODE_INCONNU);
});

test('resolveScan : objet self disponible → emprunt', () => {
  const kit = freeSelf('kit-tableau');
  const r = resolveScan(kit.code, LEA);
  assert.equal(r.mode, 'emprunt');
  assert.equal(r.item.id, kit.id);
  assert.equal(r.loan, null);
});

test('resolveScan : mon propre emprunt en cours → retour, celui d’un autre → refus', () => {
  const mine = store.loans.get('loan_041'); // 1er emprunt self en cours du seed (Léa)
  assert.equal(mine.userId, LEA);
  const r = resolveScan(store.items.get(mine.itemId).code, LEA);
  assert.equal(r.mode, 'retour');
  assert.equal(r.loan.id, mine.id);
  const other = resolveScan(store.items.get(mine.itemId).code, 'user_002');
  assert.equal(other.mode, 'erreur');
  assert.equal(other.reason, REASONS.EMPRUNTE_PAR_AUTRE);
});

test('resolveScan : circuit valeur ou salle → mauvais_circuit', () => {
  const canon = itemByCode('MDS-0029');
  assert.equal(resolveScan(canon.code, 'user_010').reason, REASONS.MAUVAIS_CIRCUIT);
  const trepied = store.items.list((i) => i.reference === 'leofoto-trepied')[0];
  assert.equal(resolveScan(trepied.code, 'user_010').reason, REASONS.MAUVAIS_CIRCUIT);
});

test('resolveScan : maintenance, bureau fermé, déjà un exemplaire, compte inactif', () => {
  const souris3 = store.items.list((i) => i.reference === 'souris' && i.etat === ITEM_STATES.MAINTENANCE)[0];
  assert.equal(resolveScan(souris3.code, 'user_010').reason, REASONS.EN_MAINTENANCE);
  const kit = freeSelf('kit-tableau');
  assert.equal(resolveScan(kit.code, 'user_010', new Date(2026, 8, 19, 10, 0)).reason, REASONS.BUREAU_FERME);
  assert.equal(resolveScan(kit.code, 'user_010', new Date(2026, 8, 17, 12, 30)).reason, REASONS.BUREAU_FERME);
  const multi = freeSelf('multiprise');
  assert.equal(resolveScan(multi.code, LEA).reason, REASONS.DEJA_UN_EXEMPLAIRE); // Léa a déjà la multiprise #1
  store.users.update('user_010', { actif: false });
  assert.equal(resolveScan(kit.code, 'user_010').reason, REASONS.UTILISATEUR_INACTIF);
});

test('borrowSelf : crée l’emprunt, l’objet passe emprunté, retour prévu 17h, journal, photo', () => {
  const kit = freeSelf('kit-tableau');
  const logsBefore = store.log.list().length;
  const loan = borrowSelf({ itemCode: kit.code, userId: 'user_010', photo: PHOTO });
  assert.equal(loan.statut, LOAN_STATES.EN_COURS);
  assert.equal(loan.itemId, kit.id);
  assert.equal(loan.userId, 'user_010');
  assert.equal(loan.photoEmprunt, PHOTO);
  assert.equal(new Date(loan.finPrevue).getHours(), 17);
  assert.equal(new Date(loan.finPrevue).getDate(), 17);
  assert.equal(loan.dateRetrait, NOW.toISOString());
  assert.equal(store.items.get(kit.id).etat, ITEM_STATES.EMPRUNTE);
  assert.equal(store.log.list().length, logsBefore + 1);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.LOAN_EMPRUNT);
  assert.equal(entry.loanId, loan.id);
  assert.equal(entry.userId, 'user_010');
  assert.match(entry.detail, /Kit tableau blanc #\d — Hugo Bernard/);
});

test('borrowSelf refuse avec le motif en .reason et n’écrit rien', () => {
  const canon = itemByCode('MDS-0029');
  const before = store.loans.list().length;
  assert.throws(() => borrowSelf({ itemCode: canon.code, userId: 'user_010', photo: PHOTO }), (e) => e.reason === REASONS.MAUVAIS_CIRCUIT && /de cette façon/.test(e.message));
  assert.throws(() => borrowSelf({ itemCode: 'MDS-9999', userId: 'user_010', photo: PHOTO }), (e) => e.reason === REASONS.CODE_INCONNU);
  assert.equal(store.loans.list().length, before);
});

test('returnSelf sans problème : retourné, disponible, photo de retour, journal', () => {
  const loan = store.loans.get('loan_041');
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO });
  assert.equal(r.maintenance, null);
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
  assert.equal(r.loan.photoRetour, PHOTO);
  assert.equal(r.loan.dateRetourReelle, NOW.toISOString());
  assert.equal(r.loan.checklistRetour.length, 3);
  assert.ok(r.loan.checklistRetour.every((l) => l.ok));
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_RETOUR);
});

test('returnSelf avec problème : maintenance + signalement ouvert + 2 entrées de journal', () => {
  const loan = store.loans.get('loan_041');
  const item = store.items.get(loan.itemId);
  const logsBefore = store.log.list().length;
  const maintBefore = store.maintenance.list().length;
  const checklist = [{ ligne: 'Câble intact', ok: false, commentaire: 'gaine coupée' }, { ligne: 'Toutes les prises fonctionnent', ok: true, commentaire: '' }, { ligne: 'Interrupteur OK', ok: true, commentaire: '' }];
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO, checklist });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.equal(r.maintenance.loanId, loan.id);
  assert.match(r.maintenance.description, /Câble intact → gaine coupée/);
  assert.equal(store.maintenance.list().length, maintBefore + 1);
  assert.equal(store.log.list().length, logsBefore + 2);
  assert.deepEqual(store.log.list().slice(-2).map((e) => e.action), [ACTIONS.LOAN_RETOUR, ACTIONS.MAINT_SIGNALEMENT]);
});

test('returnSelf : retour possible bureau fermé ; refus si mauvais utilisateur ou emprunt clos', () => {
  const loan = store.loans.get('loan_041');
  assert.throws(() => returnSelf({ loanId: loan.id, userId: 'user_002', photo: PHOTO }), /ne vous appartient pas/);
  store.settings.update({ horlogeDemo: new Date(2026, 8, 19, 10, 0).toISOString() });
  const r = returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO });
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
  assert.throws(() => returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO }), /plus en cours/);
  assert.throws(() => returnSelf({ loanId: 'nope', userId: LEA, photo: PHOTO }), /introuvable/);
});

test('borrowSelf : une écriture qui échoue n’écrit rien (item toujours disponible, aucun emprunt créé)', () => {
  const kit = freeSelf('kit-tableau');
  const loansBefore = store.loans.list().length;
  const orig = store.log.create;
  store.log.create = () => { throw new Error('quota'); };
  try {
    assert.throws(() => borrowSelf({ itemCode: kit.code, userId: 'user_010', photo: PHOTO }), /quota/);
  } finally {
    store.log.create = orig;
  }
  assert.equal(store.items.get(kit.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.loans.list().length, loansBefore);
});

test('returnSelf avec problème : une écriture qui échoue n’écrit rien (emprunt toujours en cours, item toujours emprunté)', () => {
  const loan = store.loans.get('loan_041');
  const item = store.items.get(loan.itemId);
  const checklist = [{ ligne: 'Câble intact', ok: false, commentaire: 'gaine coupée' }, { ligne: 'Toutes les prises fonctionnent', ok: true, commentaire: '' }, { ligne: 'Interrupteur OK', ok: true, commentaire: '' }];
  const orig = store.maintenance.create;
  store.maintenance.create = () => { throw new Error('quota'); };
  try {
    assert.throws(() => returnSelf({ loanId: loan.id, userId: LEA, photo: PHOTO, checklist }), /quota/);
  } finally {
    store.maintenance.create = orig;
  }
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EN_COURS);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.EMPRUNTE);
});

test('userLoans : en cours avec retard, réservations, historique trié', () => {
  const lateLoan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && new Date(l.finPrevue) < NOW)[0];
  const u = userLoans(lateLoan.userId, NOW);
  assert.ok(u.enCours.some((x) => x.loan.id === lateLoan.id && x.late === true));
  assert.ok(u.enCours.every((x) => x.item && x.item.id === x.loan.itemId));
  const resUser = store.loans.list((l) => l.statut === LOAN_STATES.RESERVEE)[0].userId;
  assert.equal(userLoans(resUser, NOW).reservations.length, 1);
  const hist = userLoans('user_005', NOW).historique;
  assert.ok(hist.every((x) => x.loan.statut !== LOAN_STATES.EN_COURS && x.loan.statut !== LOAN_STATES.RESERVEE));
  assert.ok(hist.every((x, i, a) => i === 0 || (a[i - 1].loan.dateRetourReelle || '') >= (x.loan.dateRetourReelle || '')));
});

const valueLoan = () => store.loans.list((l) => l.statut === 'en_cours' && store.items.get(l.itemId).circuit === 'valeur')[0];

test('resolveScan : le matériel de valeur emprunté par moi ne se rend pas par scan → rendu_a_la_pedago', () => {
  const loan = valueLoan();
  assert.ok(loan);
  const r = resolveScan(store.items.get(loan.itemId).code, loan.userId);
  assert.equal(r.mode, 'erreur');
  assert.equal(r.reason, REASONS.RENDU_A_LA_PEDAGO);
});

test('returnSelf : refuse le matériel de valeur (rendu_a_la_pedago), emprunt et objet inchangés', () => {
  const loan = valueLoan();
  assert.throws(() => returnSelf({ loanId: loan.id, userId: loan.userId, photo: PHOTO }), (e) => e.reason === REASONS.RENDU_A_LA_PEDAGO);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EN_COURS);
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.EMPRUNTE);
});
