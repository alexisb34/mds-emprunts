import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS, now, addDays, isLate, pickupWindow } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES } from '../js/models.js';
import { buildChecklist } from '../js/checklists.js';
import { loanQrPayload } from '../js/qr.js';
import {
  reserveValeur, handOver, receiveLoan, refuseLoan, cancelLoan, extendLoan,
  expireDueLoans, sweepExpirations, userLoans, setLoanStatus,
} from '../js/actions/loans.js';

const NOW = new Date(2026, 8, 17, 10, 0);   // jeudi 10h
const DEMAIN9 = new Date(2026, 8, 18, 9, 0); // vendredi 9h
const PEDAGO = 'user_041';
const ELEVE = 'user_010';
const PHOTO = 'data:image/jpeg;base64,AAAA';

const clock = (d) => store.settings.update({ horlogeDemo: d.toISOString() });
const freeValeur = (ref) => store.items.list((i) => i.reference === ref && i.etat === ITEM_STATES.DISPONIBLE)[0];

// Le seed contient déjà deux réservations (dont une le lendemain à 9h) : on les retire pour que
// les comptages de ces tests ne portent que sur les réservations qu’ils créent eux-mêmes.
const clearSeedReservations = () => {
  for (const l of store.loans.list((x) => x.statut === LOAN_STATES.RESERVEE)) {
    store.loans.update(l.id, { statut: LOAN_STATES.ANNULEE });
    store.items.update(l.itemId, { etat: ITEM_STATES.DISPONIBLE });
  }
};

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  clock(NOW);
  clearSeedReservations();
});

test('reserveValeur : objet réservé, code de retrait, journal', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 2), motif: 'Tournage' });
  assert.equal(loan.statut, LOAN_STATES.RESERVEE);
  assert.equal(loan.motif, 'Tournage');
  assert.match(loan.codeRetrait, /^[A-Z2-9]{6}$/);
  assert.equal(loan.debutPrevu, DEMAIN9.toISOString());
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.RESERVE);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.LOAN_RESERVEE);
  assert.equal(entry.loanId, loan.id);
  assert.match(entry.detail, /Hoya|filtre/i);
});

test('reserveValeur : refus — circuit, durée, doublon de référence, indisponible', () => {
  const item = freeValeur('hoya-nd');
  const multi = store.items.list((i) => i.reference === 'multiprise' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  assert.throws(() => reserveValeur({ itemId: multi.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.MAUVAIS_CIRCUIT);
  assert.throws(() => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 9) }), (e) => e.reason === REASONS.DUREE_TROP_LONGUE);
  assert.throws(() => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: addDays(DEMAIN9, -5), finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DATE_PASSEE);
  reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  const sd1 = store.items.list((i) => i.reference === 'sd-256' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  const sd2 = store.items.list((i) => i.reference === 'sd-256' && i.etat === ITEM_STATES.DISPONIBLE)[1];
  reserveValeur({ itemId: sd1.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  assert.throws(() => reserveValeur({ itemId: sd2.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DEJA_UN_EXEMPLAIRE);
  // Re-réserver son propre exemplaire : « déjà un exemplaire », pas « réservé par quelqu’un d’autre ».
  assert.throws(() => reserveValeur({ itemId: sd1.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DEJA_UN_EXEMPLAIRE);
  assert.throws(() => reserveValeur({ itemId: sd1.id, userId: 'user_011', debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.RESERVE_PAR_AUTRE);
});

test('handOver : seulement dans la fenêtre de retrait, par code court ou QR', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), (e) => e.reason === REASONS.FENETRE_RETRAIT);
  clock(new Date(2026, 8, 18, 9, 30));
  const remis = handOver({ code: loanQrPayload(loan), pedagoId: PEDAGO });
  assert.equal(remis.statut, LOAN_STATES.EN_COURS);
  assert.equal(remis.remisPar, PEDAGO);
  assert.equal(new Date(remis.dateRetrait).getHours(), 9);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.EMPRUNTE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_REMISE);
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), /plus en attente de remise/);
  assert.throws(() => handOver({ code: 'ZZZZZZ', pedagoId: PEDAGO }), (e) => e.reason === REASONS.CODE_RETRAIT_INCONNU);
});

test('expireDueLoans : libère après la fenêtre, idempotent, n’touche pas les autres', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 59));
  assert.equal(expireDueLoans(), 0);
  clock(new Date(2026, 8, 18, 10, 1));
  assert.equal(expireDueLoans(), 1);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EXPIREE);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_EXPIREE);
  assert.equal(expireDueLoans(), 0, 'idempotent');
});

test('receiveLoan : checklist complète, objet disponible, signalement si problème, emprunt self accepté', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 30));
  handOver({ code: loan.codeRetrait, pedagoId: PEDAGO });
  clock(new Date(2026, 8, 19, 11, 0));
  const ok = receiveLoan({ loanId: loan.id, pedagoId: PEDAGO, checklist: buildChecklist('hoya-nd') });
  assert.equal(ok.maintenance, null);
  assert.equal(ok.loan.statut, LOAN_STATES.RETOURNEE);
  assert.equal(ok.loan.receptionnePar, PEDAGO);
  assert.equal(ok.loan.checklistRetour.length, 3);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_RETOUR);
  // Un emprunt self peut être clôturé par la pédago (élève absent, compte désactivé).
  const self = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && store.items.get(l.itemId).circuit === 'self')[0];
  const r = receiveLoan({ loanId: self.id, pedagoId: PEDAGO, checklist: buildChecklist(store.items.get(self.itemId).reference) });
  assert.equal(r.loan.statut, LOAN_STATES.RETOURNEE);
});

test('receiveLoan avec problème : maintenance, signalement, deux entrées de journal', () => {
  const dji = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS && store.items.get(l.itemId).reference === 'dji-rsc2')[0];
  const checklist = buildChecklist('dji-rsc2');
  checklist[3].ok = false;
  checklist[3].commentaire = 'batterie gonflée';
  const before = store.log.list().length;
  const r = receiveLoan({ loanId: dji.id, pedagoId: PEDAGO, checklist, commentaire: 'à envoyer au SAV' });
  assert.equal(store.items.get(dji.itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.match(r.maintenance.description, /batterie gonflée/);
  assert.equal(r.loan.commentaire, 'à envoyer au SAV');
  assert.equal(store.log.list().length, before + 2);
});

test('refuseLoan, cancelLoan, extendLoan', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const refus = refuseLoan(loan.id, PEDAGO, 'Matériel réservé pour un cours');
  assert.equal(refus.statut, LOAN_STATES.REFUSEE);
  assert.equal(refus.motifRefus, 'Matériel réservé pour un cours');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_REFUSEE);
  assert.throws(() => refuseLoan(loan.id, PEDAGO, 'x'), /plus en attente/);

  const vide = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.throws(() => refuseLoan(vide.id, PEDAGO, '  '), /motif/);
  assert.equal(store.loans.get(vide.id).statut, LOAN_STATES.RESERVEE, 'le refus sans motif ne change rien');
  refuseLoan(vide.id, PEDAGO, 'Matériel indisponible');

  const l2 = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const annule = cancelLoan(l2.id, ELEVE);
  assert.equal(annule.statut, LOAN_STATES.ANNULEE);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_ANNULEE);

  const enCours = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  const fin = addDays(new Date(enCours.finPrevue), 2);
  const prolonge = extendLoan(enCours.id, fin, PEDAGO);
  assert.equal(prolonge.finPrevue, fin.toISOString());
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_PROLONGEE);
  assert.throws(() => extendLoan(enCours.id, addDays(new Date(enCours.finPrevue), -10), PEDAGO), /postérieure/);
});

test('userLoans.reservations : fenêtre de retrait et expiration dérivées', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const avant = userLoans(ELEVE, NOW).reservations[0];
  assert.equal(avant.loan.id, loan.id);
  assert.equal(avant.pickupOpen, false);
  assert.equal(avant.expired, false);
  assert.equal(avant.window.start.getHours(), 9);
  assert.equal(avant.window.end.getHours(), 10);
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 18, 9, 30)).reservations[0].pickupOpen, true);
  const tard = userLoans(ELEVE, new Date(2026, 8, 18, 10, 30)).reservations[0];
  assert.equal(tard.pickupOpen, false);
  assert.equal(tard.expired, true);
});

test('extendLoan est transactionnel : un échec du journal laisse la date de retour intacte', () => {
  const enCours = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  const avant = enCours.finPrevue;
  const orig = store.log.create;
  store.log.create = () => { throw new Error('quota'); };
  try {
    assert.throws(() => extendLoan(enCours.id, addDays(new Date(avant), 2), PEDAGO), /quota/);
  } finally {
    store.log.create = orig;
  }
  assert.equal(store.loans.get(enCours.id).finPrevue, avant);
});

test('reserveValeur : une fenêtre de retrait déjà close est refusée d’emblée', () => {
  const item = freeValeur('hoya-nd');
  clock(new Date(2026, 8, 17, 10, 30));
  const nbLoans = store.loans.list().length;
  assert.throws(
    () => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: new Date(2026, 8, 17, 8, 0), finPrevue: new Date(2026, 8, 17, 8, 0), motif: '' }),
    (e) => e.reason === REASONS.DATE_PASSEE,
  );
  assert.equal(store.loans.list().length, nbLoans);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  const ok = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: new Date(2026, 8, 17, 14, 0), finPrevue: new Date(2026, 8, 17, 14, 0), motif: '' });
  assert.equal(ok.statut, LOAN_STATES.RESERVEE);
});

test('expireDueLoans : une vue abonnée qui rappelle expireDueLoans ne rejoue pas une expiration', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  reserveValeur({ itemId: a.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  reserveValeur({ itemId: b.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 10, 30));
  const unsubscribe = store.subscribe(() => { expireDueLoans(now()); });
  try {
    expireDueLoans(now());
  } finally {
    unsubscribe();
  }
  assert.equal(store.log.list((e) => e.action === ACTIONS.LOAN_EXPIREE).length, 2);
  assert.equal(store.items.get(a.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.items.get(b.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(expireDueLoans(now()), 0);
});

test('userLoans : expireesRecentes ne garde que les réservations expirées depuis moins de 24 h', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  reserveValeur({ itemId: a.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 11, 0)); // fenêtre close à 10h : expirée il y a 1 h
  expireDueLoans(now());
  const recent = userLoans(ELEVE, new Date(2026, 8, 18, 12, 0)); // expirée il y a 2 h
  assert.equal(recent.expireesRecentes.length, 1);
  assert.equal(recent.expireesRecentes[0].item.id, a.id);
  assert.equal(recent.reservations.length, 0);
  const ancienne = userLoans(ELEVE, new Date(2026, 8, 19, 16, 0)); // expirée il y a 30 h
  assert.equal(ancienne.expireesRecentes.length, 0);
  assert.equal(ancienne.reservations.length, 0);
});

test('userLoans : refuseesRecentes porte le motif de refus et s’efface après 24 h', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  refuseLoan(loan.id, PEDAGO, 'Réservé pour un cours');
  const recent = userLoans(ELEVE, NOW).refuseesRecentes;
  assert.equal(recent.length, 1);
  assert.equal(recent[0].loan.motifRefus, 'Réservé pour un cours');
  assert.equal(recent[0].item.id, item.id);
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 19, 10, 0)).refuseesRecentes.length, 0, 'plus de 24 h après, sur l’horloge de démo');
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 18, 9, 0)).refuseesRecentes.length, 1, 'moins de 24 h après');
  // Un refus sans `dateRefus` (antérieur à ce champ) n’est jamais « récent ».
  store.loans.update(loan.id, { dateRefus: null });
  assert.equal(userLoans(ELEVE, NOW).refuseesRecentes.length, 0);
});

test('sweepExpirations : comme expireDueLoans, mais une écriture qui échoue ne lève jamais', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 10, 30));
  const origLog = store.log.create;
  const origError = console.error;
  const traces = [];
  store.log.create = () => { throw new Error('quota'); };
  console.error = (...args) => { traces.push(args); };
  try {
    assert.equal(sweepExpirations(), 0);
  } finally {
    store.log.create = origLog;
    console.error = origError;
  }
  assert.equal(traces.length, 1, 'l’erreur est tracée en console');
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RESERVEE, 'transaction restaurée');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.RESERVE);
  assert.equal(sweepExpirations(), 1, 'sans panne, le prochain balayage libère la réservation');
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EXPIREE);
});

test('userLoans.reservations : le retrait le plus proche en premier', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  const lundi = new Date(2026, 8, 21, 9, 0);
  const loanLoin = reserveValeur({ itemId: a.id, userId: ELEVE, debutPrevu: lundi, finPrevue: lundi, motif: '' });
  const loanProche = reserveValeur({ itemId: b.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  assert.deepEqual(userLoans(ELEVE, NOW).reservations.map((r) => r.loan.id), [loanProche.id, loanLoin.id]);
});

test('reserveValeur : un emprunteur en retard ne peut pas réserver', () => {
  const retard = store.loans.list((l) => isLate(l, NOW))[0];
  const item = freeValeur('hoya-nd');
  const nb = store.loans.list().length;
  assert.throws(() => reserveValeur({ itemId: item.id, userId: retard.userId, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.RETARD_EN_COURS);
  assert.equal(store.loans.list().length, nb);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
});

test('bornes de la fenêtre de retrait : remise à l’instant de fin, expiration une minute après', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const autre = freeValeur('sd-256');
  const l2 = reserveValeur({ itemId: autre.id, userId: 'user_011', debutPrevu: DEMAIN9, finPrevue: DEMAIN9, motif: '' });
  const { end } = pickupWindow(loan, 60);
  clock(end);
  assert.equal(expireDueLoans(end), 0, 'à l’instant exact de fin, la réservation tient encore');
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RESERVEE);
  assert.equal(handOver({ code: loan.codeRetrait, pedagoId: PEDAGO, date: end }).statut, LOAN_STATES.EN_COURS);

  const apres = new Date(pickupWindow(l2, 60).end.getTime() + 60 * 1000);
  clock(apres);
  assert.equal(expireDueLoans(apres), 1, 'une minute après la fin, elle expire');
  assert.equal(store.loans.get(l2.id).statut, LOAN_STATES.EXPIREE);
});

test('handOver : mauvais code court dans un QR, ou réservation déjà refusée', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 30));
  const mauvais = loan.codeRetrait === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ';
  assert.throws(() => handOver({ code: `LOAN-${loan.id}-${mauvais}`, pedagoId: PEDAGO }), (e) => e.reason === REASONS.CODE_RETRAIT_INCONNU);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RESERVEE, 'rien n’a bougé');
  refuseLoan(loan.id, PEDAGO, 'Matériel réservé pour un cours');
  assert.throws(() => handOver({ code: loanQrPayload(loan), pedagoId: PEDAGO }), /plus en attente de remise/);
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), /plus en attente de remise/);
});

test('reserveValeur est transactionnel : un échec sur l’objet ne laisse aucun emprunt', () => {
  const item = freeValeur('hoya-nd');
  const nb = store.loans.list().length;
  const orig = store.items.update;
  store.items.update = () => { throw new Error('quota'); };
  try {
    assert.throws(() => reserveValeur({ itemId: item.id, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), /quota/);
  } finally {
    store.items.update = orig;
  }
  assert.equal(store.loans.list().length, nb, 'aucun emprunt créé');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
});

test('setLoanStatus : le filet de la table arrête une transition interdite avant d’écrire', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.RETOURNEE)[0];
  assert.ok(loan, 'le seed contient un emprunt rendu');
  const avant = store.loans.get(loan.id);
  // `retournee` est terminal : la table interdit de le rouvrir, quoi que disent les gardes.
  assert.throws(() => setLoanStatus(loan.id, LOAN_STATES.EN_COURS, { remisPar: PEDAGO }), /Transition emprunt interdite : retournee → en_cours/);
  assert.deepEqual(store.loans.get(loan.id), avant, 'rien n’a été écrit');
});

test('les messages des gardes métier priment sur celui de la table', () => {
  const rendu = store.loans.list((l) => l.statut === LOAN_STATES.RETOURNEE)[0];
  let message = '';
  try { receiveLoan({ loanId: rendu.id, pedagoId: PEDAGO }); } catch (e) { message = e.message; }
  assert.match(message, /n’est plus en cours/, 'la garde métier parle, pas la table');
  assert.doesNotMatch(message, /Transition/);
});
