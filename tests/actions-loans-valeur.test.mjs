import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS, now, addDays, isLate, pickupWindow, freeExemplaires } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES } from '../js/models.js';
import { buildChecklist } from '../js/checklists.js';
import { reportIssue } from '../js/actions/maintenance.js';
import { loanQrPayload } from '../js/qr.js';
import {
  reserveValeur, handOver, receiveLoan, refuseLoan, cancelLoan, extendLoan,
  expireDueLoans, sweepExpirations, userLoans,
} from '../js/actions/loans.js';

const NOW = new Date(2026, 8, 17, 10, 0);   // jeudi 10h
const DEMAIN9 = new Date(2026, 8, 18, 9, 0); // vendredi 9h
const DEMAIN17 = new Date(2026, 8, 18, 17, 0); // vendredi 17h : une période a une longueur, DEMAIN9 → DEMAIN9 n’en a pas
const PEDAGO = 'user_041';
const ELEVE = 'user_010';
const PHOTO = 'data:image/jpeg;base64,AAAA';

const clock = (d) => store.settings.update({ horlogeDemo: d.toISOString() });
const freeValeur = (ref) => store.items.list((i) => i.reference === ref && i.etat === ITEM_STATES.DISPONIBLE)[0];

// Le seed contient déjà deux réservations (dont une le lendemain à 9h) : on les retire pour que
// les comptages de ces tests ne portent que sur les réservations qu’ils créent eux-mêmes.
// Une réservation n’écrit aucun état d’objet : il n’y a donc rien à remettre à `disponible`.
const clearSeedReservations = () => {
  for (const l of store.loans.list((x) => x.statut === LOAN_STATES.RESERVEE)) {
    store.loans.update(l.id, { statut: LOAN_STATES.ANNULEE });
  }
};

// Les exemplaires de la référence encore libres sur une période, vus par les règles : c’est
// la question qui remplace « l’objet est-il `reserve` ? ».
const libresSur = (reference, debut, fin) => freeExemplaires({
  items: store.items.list(), loans: store.loans.list(), reference, debut, fin, date: now(),
}).map((i) => i.id);

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  clock(NOW);
  clearSeedReservations();
});

test('reserveValeur : exemplaire attribué, occupé sur la période seulement, code de retrait, journal', () => {
  const item = freeValeur('hoya-nd');
  const fin = addDays(DEMAIN9, 2);
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: fin, motif: 'Tournage' });
  assert.equal(loan.statut, LOAN_STATES.RESERVEE);
  assert.equal(loan.itemId, item.id, 'l’exemplaire libre est attribué');
  assert.equal(loan.motif, 'Tournage');
  assert.match(loan.codeRetrait, /^[A-Z2-9]{6}$/);
  assert.equal(loan.debutPrevu, DEMAIN9.toISOString());
  // Aucun état n’est écrit : l’objet n’est ni « réservé » ni bloqué ; c’est sa période qui est prise.
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, fin), [], 'pris sur la période réservée');
  assert.deepEqual(libresSur('hoya-nd', addDays(DEMAIN9, 7), addDays(DEMAIN17, 7)), [item.id], 'libre une semaine plus tard');
  assert.deepEqual(libresSur('hoya-nd', NOW, new Date(2026, 8, 17, 17, 0)), [item.id], 'libre aujourd’hui, avant le retrait');
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.LOAN_RESERVEE);
  assert.equal(entry.loanId, loan.id);
  assert.match(entry.detail, /Hoya|filtre/i);
});

test('reserveValeur : refus — circuit, durée, doublon de référence, complet sur la période', () => {
  const item = freeValeur('hoya-nd');
  const multi = store.items.list((i) => i.reference === 'multiprise' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  assert.throws(() => reserveValeur({ reference: multi.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.MAUVAIS_CIRCUIT);
  assert.throws(() => reserveValeur({ reference: 'inexistante', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.CODE_INCONNU);
  assert.throws(() => reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 9) }), (e) => e.reason === REASONS.DUREE_TROP_LONGUE);
  assert.throws(() => reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: addDays(DEMAIN9, -5), finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.DATE_PASSEE);
  assert.throws(() => reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN9 }), (e) => e.reason === REASONS.DATES_INCOHERENTES, 'période de longueur nulle');
  reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17, motif: '' });
  // Un second exemplaire de la même référence reste refusé à la même personne, que la période
  // diffère ou non : la règle « un exemplaire par référence » ne dépend pas de la disponibilité.
  reserveValeur({ reference: 'sd-256', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17, motif: '' });
  assert.throws(() => reserveValeur({ reference: 'sd-256', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.DEJA_UN_EXEMPLAIRE);
  const dansUnMois = new Date(2026, 9, 19, 9, 0);
  assert.throws(() => reserveValeur({ reference: 'sd-256', userId: ELEVE, debutPrevu: dansUnMois, finPrevue: new Date(2026, 9, 19, 17, 0) }), (e) => e.reason === REASONS.DEJA_UN_EXEMPLAIRE, 'même sur une autre période');
});

test('reserveValeur : un autre emprunteur reçoit un autre exemplaire, puis « complet » quand tous sont pris', () => {
  const sd = store.items.list((i) => i.reference === 'sd-256');
  assert.equal(sd.length, 3, 'le jeu a trois cartes SD');
  // Des emprunteurs sans retard ni exemplaire de cette référence : la seule règle en jeu est la disponibilité.
  const candidats = store.users.list((u) => u.role === 'eleve' && u.actif
    && !store.loans.list((l) => l.userId === u.id && (l.statut === LOAN_STATES.EN_COURS || l.statut === LOAN_STATES.RESERVEE)).length);
  assert.ok(candidats.length >= 4, 'assez d’emprunteurs pour remplir les trois exemplaires puis en refuser un');
  const pris = candidats.slice(0, 3).map((u) => reserveValeur({ reference: 'sd-256', userId: u.id, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }).itemId);
  assert.equal(new Set(pris).size, 3, 'chacun reçoit un exemplaire différent, jamais deux fois le même sur la même période');
  assert.deepEqual(libresSur('sd-256', DEMAIN9, DEMAIN17), []);
  assert.throws(() => reserveValeur({ reference: 'sd-256', userId: candidats[3].id, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.COMPLET_SUR_LA_PERIODE);
  // Complet sur cette période, pas ailleurs : la semaine suivante la référence est de nouveau réservable.
  const suivante = reserveValeur({ reference: 'sd-256', userId: candidats[3].id, debutPrevu: addDays(DEMAIN9, 7), finPrevue: addDays(DEMAIN17, 7) });
  assert.equal(suivante.statut, LOAN_STATES.RESERVEE);
  // Aucun exemplaire n’a changé d’état.
  assert.ok(sd.every((i) => store.items.get(i.id).etat === ITEM_STATES.DISPONIBLE));
});

test('réserver pour novembre ne bloque pas octobre', () => {
  const sd = store.items.list((i) => i.reference === 'sd-256');
  assert.ok(sd.length >= 2, 'le jeu a plusieurs cartes SD');
  const novembre = new Date(2026, 10, 3, 9, 0);
  reserveValeur({ reference: 'sd-256', userId: ELEVE, debutPrevu: novembre, finPrevue: new Date(2026, 10, 5, 17, 0) });
  // Quelqu’un d’autre, la semaine prochaine : la référence doit rester réservable.
  const bientot = new Date(2026, 8, 24, 9, 0);
  const autre = reserveValeur({ reference: 'sd-256', userId: 'user_011', debutPrevu: bientot, finPrevue: new Date(2026, 8, 24, 17, 0) });
  assert.equal(autre.statut, 'reservee');
  assert.ok(store.items.list((i) => i.reference === 'sd-256').every((i) => i.etat === ITEM_STATES.DISPONIBLE),
    'aucun exemplaire n’est marqué indisponible : la réservation occupe une période, pas un objet');
});

test('une seule carte : deux périodes disjointes passent, une période qui chevauche est refusée, l’annulation libère', () => {
  // Une seule carte Hoya : la seconde réservation ne peut venir que du même exemplaire.
  const item = freeValeur('hoya-nd');
  const lundi = new Date(2026, 8, 21, 9, 0);
  const l1 = reserveValeur({ reference: 'hoya-nd', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 });
  const l2 = reserveValeur({ reference: 'hoya-nd', userId: 'user_011', debutPrevu: lundi, finPrevue: new Date(2026, 8, 21, 17, 0) });
  assert.equal(l1.itemId, item.id);
  assert.equal(l2.itemId, item.id, 'le même exemplaire, deux périodes qui ne se recoupent pas');
  assert.throws(() => reserveValeur({ reference: 'hoya-nd', userId: 'user_012', debutPrevu: new Date(2026, 8, 18, 13, 0), finPrevue: new Date(2026, 8, 18, 17, 0) }), (e) => e.reason === REASONS.COMPLET_SUR_LA_PERIODE, 'chevauche la première');
  // Une réservation annulée libère sa période : la même demande passe alors.
  cancelLoan(l1.id, ELEVE);
  const reprise = reserveValeur({ reference: 'hoya-nd', userId: 'user_012', debutPrevu: new Date(2026, 8, 18, 13, 0), finPrevue: new Date(2026, 8, 18, 17, 0) });
  assert.equal(reprise.itemId, item.id);
});

test('handOver : seulement dans la fenêtre de retrait, par code court ou QR', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
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
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 16, 59));
  assert.equal(expireDueLoans(), 0, 'avant la fermeture, la réservation tient encore');
  clock(new Date(2026, 8, 18, 17, 1));
  assert.equal(expireDueLoans(), 1);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EXPIREE);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [item.id], 'expirée, la réservation libère sa période');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_EXPIREE);
  assert.equal(expireDueLoans(), 0, 'idempotent');
});

test('receiveLoan : checklist complète, objet disponible, signalement si problème, emprunt self accepté', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
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
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const refus = refuseLoan(loan.id, PEDAGO, 'Matériel réservé pour un cours');
  assert.equal(refus.statut, LOAN_STATES.REFUSEE);
  assert.equal(refus.motifRefus, 'Matériel réservé pour un cours');
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [item.id], 'refusée, la réservation libère sa période');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE, 'et l’objet n’a jamais été touché');
  assert.equal(store.log.list().at(-1).action, ACTIONS.LOAN_REFUSEE);
  assert.throws(() => refuseLoan(loan.id, PEDAGO, 'x'), /plus en attente/);

  const vide = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  assert.throws(() => refuseLoan(vide.id, PEDAGO, '  '), /motif/);
  assert.equal(store.loans.get(vide.id).statut, LOAN_STATES.RESERVEE, 'le refus sans motif ne change rien');
  refuseLoan(vide.id, PEDAGO, 'Matériel indisponible');

  const l2 = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const annule = cancelLoan(l2.id, ELEVE);
  assert.equal(annule.statut, LOAN_STATES.ANNULEE);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [item.id], 'annulée, la réservation libère sa période');
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
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const avant = userLoans(ELEVE, NOW).reservations[0];
  assert.equal(avant.loan.id, loan.id);
  assert.equal(avant.pickupOpen, false);
  assert.equal(avant.expired, false);
  assert.equal(avant.window.start.getHours(), 9);
  assert.equal(avant.window.end.getHours(), 17, 'la journée entière, et non une heure');
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 18, 9, 30)).reservations[0].pickupOpen, true);
  assert.equal(userLoans(ELEVE, new Date(2026, 8, 18, 16, 30)).reservations[0].pickupOpen, true, 'encore ouvert en fin de journée');
  const tard = userLoans(ELEVE, new Date(2026, 8, 18, 17, 30)).reservations[0];
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

test('reserveValeur : une journée de retrait déjà close est refusée d’emblée', () => {
  const item = freeValeur('hoya-nd');
  // 17h30 : le bureau a fermé, plus rien à retirer aujourd’hui, même pour l’après-midi.
  clock(new Date(2026, 8, 17, 17, 30));
  const nbLoans = store.loans.list().length;
  for (const [h1, h2, quoi] of [[8, 12, 'ce matin'], [13, 17, 'cet après-midi']]) {
    assert.throws(
      () => reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: new Date(2026, 8, 17, h1), finPrevue: new Date(2026, 8, 17, h2), motif: '' }),
      (e) => e.reason === REASONS.DATE_PASSEE, quoi,
    );
  }
  assert.equal(store.loans.list().length, nbLoans);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  // Demain reste ouvert : c’est la journée qui est passée, pas la référence. Par un compte
  // sans emprunt : à 17h30 les retours self du jour sont en retard, et `bloquerSiRetard`
  // refuserait pour une tout autre raison.
  const sansRetard = store.users.list((u) => u.actif !== false
    && !store.loans.list((l) => l.userId === u.id && [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS].includes(l.statut)).length)[0];
  const ok = reserveValeur({ reference: item.reference, userId: sansRetard.id, debutPrevu: DEMAIN9, finPrevue: DEMAIN17, motif: '' });
  assert.equal(ok.statut, LOAN_STATES.RESERVEE);
});

test('expireDueLoans : une vue abonnée qui rappelle expireDueLoans ne rejoue pas une expiration', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  reserveValeur({ reference: a.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  reserveValeur({ reference: b.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 17, 30));
  const unsubscribe = store.subscribe(() => { expireDueLoans(now()); });
  try {
    expireDueLoans(now());
  } finally {
    unsubscribe();
  }
  assert.equal(store.log.list((e) => e.action === ACTIONS.LOAN_EXPIREE).length, 2);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [a.id], 'les deux périodes sont libérées');
  assert.ok(libresSur('sd-256', DEMAIN9, addDays(DEMAIN9, 1)).includes(b.id));
  assert.equal(store.items.get(a.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.items.get(b.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(expireDueLoans(now()), 0);
});

test('userLoans : expireesRecentes ne garde que les réservations expirées depuis moins de 24 h', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  reserveValeur({ reference: a.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 18, 0)); // journée close à 17h : expirée il y a 1 h
  expireDueLoans(now());
  const recent = userLoans(ELEVE, new Date(2026, 8, 18, 19, 0)); // expirée il y a 2 h
  assert.equal(recent.expireesRecentes.length, 1);
  assert.equal(recent.expireesRecentes[0].item.id, a.id);
  assert.equal(recent.reservations.length, 0);
  const ancienne = userLoans(ELEVE, new Date(2026, 8, 19, 18, 0)); // expirée il y a 25 h
  assert.equal(ancienne.expireesRecentes.length, 0);
  assert.equal(ancienne.reservations.length, 0);
});

test('userLoans : refuseesRecentes porte le motif de refus et s’efface après 24 h', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
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
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 17, 30));
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
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE, 'l’objet n’a jamais été touché');
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [], 'la réservation tient encore l’exemplaire sur sa période');
  assert.equal(sweepExpirations(), 1, 'sans panne, le prochain balayage libère la réservation');
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.EXPIREE);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, addDays(DEMAIN9, 1)), [item.id], 'expirée, elle libère sa période');
});

test('userLoans.reservations : le retrait le plus proche en premier', () => {
  const a = freeValeur('hoya-nd');
  const b = freeValeur('sd-256');
  const lundi = new Date(2026, 8, 21, 9, 0);
  const loanLoin = reserveValeur({ reference: a.reference, userId: ELEVE, debutPrevu: lundi, finPrevue: new Date(2026, 8, 21, 17, 0), motif: '' });
  const loanProche = reserveValeur({ reference: b.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17, motif: '' });
  assert.deepEqual(userLoans(ELEVE, NOW).reservations.map((r) => r.loan.id), [loanProche.id, loanLoin.id]);
});

test('reserveValeur : un emprunteur en retard ne peut pas réserver', () => {
  const retard = store.loans.list((l) => isLate(l, NOW))[0];
  const item = freeValeur('hoya-nd');
  const nb = store.loans.list().length;
  assert.throws(() => reserveValeur({ reference: item.reference, userId: retard.userId, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), (e) => e.reason === REASONS.RETARD_EN_COURS);
  assert.equal(store.loans.list().length, nb);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
});

test('bornes de la fenêtre de retrait : remise à l’instant de fin, expiration une minute après', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  const autre = freeValeur('sd-256');
  const l2 = reserveValeur({ reference: autre.reference, userId: 'user_011', debutPrevu: DEMAIN9, finPrevue: DEMAIN17, motif: '' });
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
  const loan = reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  clock(new Date(2026, 8, 18, 9, 30));
  const mauvais = loan.codeRetrait === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ';
  assert.throws(() => handOver({ code: `LOAN-${loan.id}-${mauvais}`, pedagoId: PEDAGO }), (e) => e.reason === REASONS.CODE_RETRAIT_INCONNU);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RESERVEE, 'rien n’a bougé');
  refuseLoan(loan.id, PEDAGO, 'Matériel réservé pour un cours');
  assert.throws(() => handOver({ code: loanQrPayload(loan), pedagoId: PEDAGO }), /plus en attente de remise/);
  assert.throws(() => handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }), /plus en attente de remise/);
});

test('reserveValeur est transactionnel : un échec du journal ne laisse aucun emprunt', () => {
  // Une réservation n’écrit plus l’objet : la seule écriture qui suit la création de l’emprunt
  // est le journal. C’est elle qui doit défaire l’emprunt si elle échoue.
  const item = freeValeur('hoya-nd');
  const nb = store.loans.list().length;
  const nbJournal = store.log.list().length;
  const orig = store.log.create;
  store.log.create = () => { throw new Error('quota'); };
  try {
    assert.throws(() => reserveValeur({ reference: item.reference, userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 }), /quota/);
  } finally {
    store.log.create = orig;
  }
  assert.equal(store.loans.list().length, nb, 'aucun emprunt créé');
  assert.equal(store.log.list().length, nbJournal);
  assert.deepEqual(libresSur('hoya-nd', DEMAIN9, DEMAIN17), [item.id], 'l’exemplaire reste libre sur la période');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
});

test('les messages des gardes métier priment sur celui de la table', () => {
  const rendu = store.loans.list((l) => l.statut === LOAN_STATES.RETOURNEE)[0];
  let message = '';
  try { receiveLoan({ loanId: rendu.id, pedagoId: PEDAGO }); } catch (e) { message = e.message; }
  assert.match(message, /n’est plus en cours/, 'la garde métier parle, pas la table');
  assert.doesNotMatch(message, /Transition/);
});

test('handOver : l’exemplaire encore dehors au créneau suivant est refusé lisiblement', () => {
  // Deux demi-journées du même jour sur la seule Hoya : légitime, et le même exemplaire.
  const item = freeValeur('hoya-nd');
  const matin = reserveValeur({ reference: 'hoya-nd', userId: ELEVE, debutPrevu: new Date(2026, 8, 18, 9, 0), finPrevue: new Date(2026, 8, 18, 12, 0) });
  const aprem = reserveValeur({ reference: 'hoya-nd', userId: 'user_011', debutPrevu: new Date(2026, 8, 18, 13, 0), finPrevue: DEMAIN17 });
  assert.equal(aprem.itemId, matin.itemId, 'le même exemplaire, deux créneaux jointifs');
  clock(new Date(2026, 8, 18, 9, 30));
  handOver({ code: matin.codeRetrait, pedagoId: PEDAGO });
  // 13h : le premier n’a pas rendu, le second se présente dans sa fenêtre.
  clock(new Date(2026, 8, 18, 13, 0));
  let message = '';
  try { handOver({ code: aprem.codeRetrait, pedagoId: PEDAGO }); } catch (e) { message = e.message; }
  assert.match(message, /déjà emprunté par quelqu’un d’autre/);
  assert.doesNotMatch(message, /Transition/, 'la pédago ne lit jamais le message de la table');
  assert.equal(store.loans.get(aprem.id).statut, LOAN_STATES.RESERVEE, 'la réservation reste en attente');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.EMPRUNTE, 'et rien n’a été écrit');
});

test('handOver : un exemplaire signalé entre la réservation et la remise est refusé lisiblement', () => {
  const item = freeValeur('hoya-nd');
  const loan = reserveValeur({ reference: 'hoya-nd', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 });
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Filtre rayé', immobiliser: true });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  clock(new Date(2026, 8, 18, 9, 30));
  let message = '';
  try { handOver({ code: loan.codeRetrait, pedagoId: PEDAGO }); } catch (e) { message = e.message; }
  assert.match(message, /en maintenance/);
  assert.doesNotMatch(message, /Transition/);
  assert.equal(store.loans.get(loan.id).statut, LOAN_STATES.RESERVEE, 'la pédago la refuse ensuite avec un motif');
  const refus = refuseLoan(loan.id, PEDAGO, 'Objet en maintenance');
  assert.equal(refus.statut, LOAN_STATES.REFUSEE);
});

test('extendLoan : prolonger ne mord pas sur la réservation suivante du même exemplaire', () => {
  const item = freeValeur('hoya-nd');
  const jeudi = reserveValeur({ reference: 'hoya-nd', userId: ELEVE, debutPrevu: DEMAIN9, finPrevue: DEMAIN17 });
  const lundi = reserveValeur({ reference: 'hoya-nd', userId: 'user_011', debutPrevu: new Date(2026, 8, 21, 9, 0), finPrevue: new Date(2026, 8, 21, 17, 0) });
  assert.equal(lundi.itemId, jeudi.itemId);
  clock(new Date(2026, 8, 18, 9, 30));
  handOver({ code: jeudi.codeRetrait, pedagoId: PEDAGO });
  let message = '';
  try { extendLoan(jeudi.id, new Date(2026, 8, 21, 17, 0), PEDAGO); } catch (e) { message = e.message; }
  assert.match(message, /réservé par quelqu’un d’autre sur la période demandée/);
  assert.equal(store.loans.get(jeudi.id).finPrevue, DEMAIN17.toISOString(), 'la date de retour n’a pas bougé');
  // Jusqu’à la veille de ce créneau, en revanche, la prolongation passe.
  const prolonge = extendLoan(jeudi.id, new Date(2026, 8, 20, 17, 0), PEDAGO);
  assert.equal(prolonge.finPrevue, new Date(2026, 8, 20, 17, 0).toISOString());
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.EMPRUNTE);
});
