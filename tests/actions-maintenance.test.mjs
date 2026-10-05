import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS } from '../js/log.js';
import { ITEM_STATES, LOAN_STATES, MAINT_STATES, MAINT_TYPES } from '../js/models.js';
import {
  openEvents, reportIssue, createIntervention, startIntervention, closeEvent,
  maintenanceRows, immobilises, resolveItemState,
} from '../js/actions/maintenance.js';
import { receiveLoan, returnSelf, reserveValeur, refuseLoan, cancelLoan, expireDueLoans } from '../js/actions/loans.js';
import { addDays } from '../js/rules.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';

// Un objet disponible, choisi sans dépendre d’un identifiant du seed.
const itemDispo = () => store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('reportIssue : crée un signalement ouvert et immobilise un objet disponible', () => {
  const item = itemDispo();
  const avant = store.log.list().length;
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Câble d’alimentation manquant' });
  assert.equal(ev.type, MAINT_TYPES.SIGNALEMENT);
  assert.equal(ev.statut, MAINT_STATES.OUVERT);
  assert.equal(ev.itemId, item.id);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(store.log.list().length, avant + 1);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_SIGNALEMENT);
});

test('reportIssue : un objet emprunté n’est pas immobilisé tout de suite', () => {
  const emprunte = store.items.list((i) => i.etat === ITEM_STATES.EMPRUNTE)[0];
  assert.ok(emprunte, 'le seed contient un objet emprunté');
  reportIssue({ itemId: emprunte.id, auteurId: PEDAGO, description: 'Signalé par un tiers' });
  assert.equal(store.items.get(emprunte.id).etat, ITEM_STATES.EMPRUNTE, 'il repartira en maintenance au retour');
});

test('reportIssue : description obligatoire', () => {
  const item = itemDispo();
  assert.throws(() => reportIssue({ itemId: item.id, auteurId: PEDAGO, description: '   ' }), /description/i);
});

test('createIntervention : interne et externe, coût et prestataire', () => {
  const item = itemDispo();
  const interne = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Nettoyage du capteur', pedagoId: PEDAGO });
  assert.equal(interne.statut, MAINT_STATES.OUVERT);
  assert.equal(interne.prestataire, '');
  assert.equal(interne.cout, 0);
  const externe = createIntervention({
    itemId: item.id, type: MAINT_TYPES.EXTERNE, prestataire: 'Objectif Service',
    cout: 120.5, description: 'Révision de la bague', pedagoId: PEDAGO,
  });
  assert.equal(externe.prestataire, 'Objectif Service');
  assert.equal(externe.cout, 120.5);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_INTERVENTION);
  assert.equal(openEvents(item.id).length, 2);
});

test('createIntervention : une externe exige un prestataire, un coût négatif est refusé', () => {
  const item = itemDispo();
  assert.throws(() => createIntervention({ itemId: item.id, type: MAINT_TYPES.EXTERNE, description: 'Révision', pedagoId: PEDAGO }), /prestataire/i);
  assert.throws(() => createIntervention({
    itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Révision', cout: -5, pedagoId: PEDAGO,
  }), /coût/i);
  assert.throws(() => createIntervention({
    itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Révision', cout: '12o', pedagoId: PEDAGO,
  }), /coût/i);
  assert.equal(openEvents(item.id).length, 0, 'aucune intervention créée par les refus');
});

test('startIntervention : ouvert → en cours, puis refus de recommencer', () => {
  const item = itemDispo();
  const ev = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Nettoyage', pedagoId: PEDAGO });
  const encours = startIntervention(ev.id, PEDAGO);
  assert.equal(encours.statut, MAINT_STATES.EN_COURS);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_EN_COURS);
  assert.throws(() => startIntervention(ev.id, PEDAGO), /en cours/i);
});

test('closeEvent : le dernier événement ouvert remet l’objet disponible', () => {
  const item = itemDispo();
  const a = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const b = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Démontage', pedagoId: PEDAGO });
  closeEvent(a.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE, 'il reste un événement ouvert');
  const clos = closeEvent(b.id, PEDAGO, { remettreEnService: true });
  assert.equal(clos.statut, MAINT_STATES.CLOS);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.MAINT_CLOS);
});

test('closeEvent : remettreEnService false passe l’objet hors service', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Écran fendu' });
  closeEvent(ev.id, PEDAGO, { remettreEnService: false });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.HS);
  assert.match(store.log.list().at(-1).detail, /hors service/i);
});

test('closeEvent : un événement sans objet (état des lieux de salle) se clôt sans toucher au matériel', () => {
  const ev = store.maintenance.create({
    itemId: null, bookingId: 'book_0001', type: MAINT_TYPES.SIGNALEMENT, auteurId: PEDAGO,
    date: NOW.toISOString(), statut: MAINT_STATES.OUVERT, description: 'Salle rangée → chaises renversées',
    prestataire: '', cout: 0, loanId: null,
  });
  const clos = closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  assert.equal(clos.statut, MAINT_STATES.CLOS);
});

test('closeEvent : un événement déjà clos est refusé', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test' });
  closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  assert.throws(() => closeEvent(ev.id, PEDAGO, { remettreEnService: true }), /déjà clos/i);
});

test('closeEvent : une seule notification pour la clôture et le changement d’état', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test' });
  let n = 0;
  const off = store.subscribe(() => { n += 1; });
  closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  off();
  assert.equal(n, 1);
});

test('maintenanceRows : joint objet et auteur, ouverts d’abord, plus récents en tête', () => {
  const item = itemDispo();
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Récent' });
  const rows = maintenanceRows();
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].event.description, 'Récent');
  assert.equal(rows[0].item.id, item.id);
  assert.equal(rows[0].auteur.id, PEDAGO);
  const statuts = rows.map((r) => r.event.statut);
  const dernierOuvert = statuts.lastIndexOf(MAINT_STATES.OUVERT);
  const premierClos = statuts.indexOf(MAINT_STATES.CLOS);
  if (premierClos !== -1) assert.ok(dernierOuvert < premierClos, 'les clos passent après les ouverts');
});

test('immobilises : matériel en maintenance ou hors service, avec ce qui reste à traiter', () => {
  const item = itemDispo();
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const rows = immobilises();
  const ligne = rows.find((r) => r.item.id === item.id);
  assert.ok(ligne, 'l’objet immobilisé est listé');
  assert.equal(ligne.aTraiter.length, 1);
  assert.ok(rows.every((r) => r.item.etat === ITEM_STATES.MAINTENANCE || r.item.etat === ITEM_STATES.HS));
});

test('un objet signalé pendant son emprunt part en maintenance au retour, checklist propre ou non', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  assert.ok(loan, 'le seed contient un emprunt en cours');
  reportIssue({ itemId: loan.itemId, auteurId: PEDAGO, description: 'Signalé par un tiers pendant l’emprunt' });
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.EMPRUNTE, 'pas touché tant qu’il est dehors');
  // Réception sans problème : l’objet ne doit pas repartir au catalogue avec un signalement ouvert.
  receiveLoan({ loanId: loan.id, pedagoId: PEDAGO });
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(openEvents(loan.itemId).length, 1);
});

test('un retour sans signalement ouvert et sans problème remet bien l’objet disponible', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  receiveLoan({ loanId: loan.id, pedagoId: PEDAGO });
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.DISPONIBLE);
});

test('closeEvent : hors service refusé tant que l’objet est dehors, rien n’est écrit', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  const ev = reportIssue({ itemId: loan.itemId, auteurId: PEDAGO, description: 'Signalé comme irréparable' });
  const logs = store.log.list().length;
  assert.throws(() => closeEvent(ev.id, PEDAGO, { remettreEnService: false }), /encore dehors/i);
  assert.equal(store.maintenance.get(ev.id).statut, MAINT_STATES.OUVERT, 'l’événement reste ouvert');
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.EMPRUNTE);
  assert.equal(store.log.list().length, logs);
});

test('closeEvent : sans choix explicite, l’état de l’objet n’est pas touché', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Test' });
  store.items.update(item.id, { etat: ITEM_STATES.HS });
  closeEvent(ev.id, PEDAGO);
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.HS, 'un objet hors service n’est pas ressuscité par défaut');
});

test('maintenanceRows : horloge figée, le dernier événement créé passe en premier', () => {
  const item = itemDispo();
  const premier = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Premier' });
  const second = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Second' });
  assert.equal(premier.date, second.date, 'même instant sous l’horloge de démo');
  const rows = maintenanceRows();
  assert.equal(rows[0].event.id, second.id);
  assert.equal(rows[1].event.id, premier.id);
});

test('reportIssue : un identifiant d’objet vide vaut « sans objet »', () => {
  const ev = reportIssue({ itemId: '', auteurId: PEDAGO, description: 'Chaises renversées', bookingId: 'book_0001' });
  assert.equal(ev.itemId, null);
  assert.throws(() => reportIssue({ itemId: 'item_inconnu', auteurId: PEDAGO, description: 'x' }), /introuvable/i);
});

test('returnSelf : un objet signalé pendant son emprunt part en maintenance, checklist propre', () => {
  const loan = store.loans.get('loan_041');
  reportIssue({ itemId: loan.itemId, auteurId: PEDAGO, description: 'Signalé par un tiers pendant l’emprunt' });
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.EMPRUNTE);
  const r = returnSelf({ loanId: loan.id, userId: loan.userId, photo: 'data:image/jpeg;base64,AAAA' });
  assert.equal(r.maintenance, null, 'checklist propre : pas de nouveau signalement');
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(openEvents(loan.itemId).length, 1);
});

// ---- resolveItemState : l’état d’un objet au vu de ses événements ouverts ----

test('resolveItemState : retour au catalogue, sauf si un événement est encore ouvert', () => {
  const item = itemDispo();
  assert.equal(resolveItemState(item.id, ITEM_STATES.DISPONIBLE), ITEM_STATES.DISPONIBLE, 'rien d’ouvert : état inchangé (disponible → disponible est interdit)');
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE);
  store.items.update(item.id, { etat: ITEM_STATES.DISPONIBLE });
  assert.equal(resolveItemState(item.id, ITEM_STATES.DISPONIBLE), ITEM_STATES.MAINTENANCE, 'un événement ouvert prime sur la remise en service');
  store.items.update(item.id, { etat: ITEM_STATES.MAINTENANCE });
  const [ev] = openEvents(item.id);
  store.maintenance.update(ev.id, { statut: MAINT_STATES.CLOS });
  assert.equal(resolveItemState(item.id, ITEM_STATES.DISPONIBLE), ITEM_STATES.DISPONIBLE, 'plus rien d’ouvert : retour au catalogue');
});

test('resolveItemState : hors service n’est jamais écarté par un événement ouvert', () => {
  const item = itemDispo();
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Écran fendu' });
  assert.equal(resolveItemState(item.id, ITEM_STATES.HS), ITEM_STATES.HS, 'maintenance → hs');
  store.items.update(item.id, { etat: ITEM_STATES.DISPONIBLE });
  assert.equal(resolveItemState(item.id, ITEM_STATES.HS), ITEM_STATES.HS, 'disponible → hs, malgré l’événement ouvert');
});

test('resolveItemState : une transition interdite rend l’état courant, un objet inconnu rend null', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  assert.equal(resolveItemState(loan.itemId, ITEM_STATES.HS), ITEM_STATES.EMPRUNTE, 'emprunte → hs est interdit : on ne bouge pas');
  assert.equal(resolveItemState(loan.itemId, ITEM_STATES.DISPONIBLE), ITEM_STATES.DISPONIBLE, 'emprunte → disponible est permis');
  reportIssue({ itemId: loan.itemId, auteurId: PEDAGO, description: 'Signalé pendant l’emprunt' });
  assert.equal(resolveItemState(loan.itemId, ITEM_STATES.DISPONIBLE), ITEM_STATES.MAINTENANCE, 'emprunte → maintenance est permis');
  assert.equal(resolveItemState('item_inconnu', ITEM_STATES.DISPONIBLE), null);
  assert.equal(resolveItemState(null, ITEM_STATES.DISPONIBLE), null);
  assert.equal(resolveItemState(undefined, ITEM_STATES.HS), null);
});

// ---- une réservation qui se termine ne remet pas au catalogue un objet signalé ----

const DEMAIN9 = new Date(2026, 8, 18, 9, 0);
const reservationSignalee = () => {
  const item = store.items.list((i) => i.circuit === 'valeur' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  const loan = reserveValeur({ itemId: item.id, userId: 'user_010', debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Signalé pendant la réservation' });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.RESERVE, 'la réservation tient : l’objet n’est pas immobilisé');
  return { item, loan };
};
const enMaintenanceAvecUnEvenement = (item) => {
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.MAINTENANCE, 'l’objet signalé ne retourne pas au catalogue');
  assert.equal(openEvents(item.id).length, 1);
  assert.ok(immobilises().some((r) => r.item.id === item.id), 'il figure dans le matériel immobilisé');
};

test('refuseLoan : un objet signalé pendant sa réservation passe en maintenance', () => {
  const { item, loan } = reservationSignalee();
  refuseLoan(loan.id, PEDAGO, 'Pas disponible');
  enMaintenanceAvecUnEvenement(item);
});

test('cancelLoan : un objet signalé pendant sa réservation passe en maintenance', () => {
  const { item, loan } = reservationSignalee();
  cancelLoan(loan.id, loan.userId);
  enMaintenanceAvecUnEvenement(item);
});

test('expireDueLoans : un objet signalé pendant sa réservation passe en maintenance', () => {
  const { item } = reservationSignalee();
  assert.ok(expireDueLoans(new Date(2026, 8, 18, 11, 0)) >= 1, 'la réservation de l’objet expire');
  enMaintenanceAvecUnEvenement(item);
});

test('refuseLoan : sans signalement, l’objet réservé redevient disponible', () => {
  const item = store.items.list((i) => i.circuit === 'valeur' && i.etat === ITEM_STATES.DISPONIBLE)[0];
  const loan = reserveValeur({ itemId: item.id, userId: 'user_010', debutPrevu: DEMAIN9, finPrevue: addDays(DEMAIN9, 1), motif: '' });
  refuseLoan(loan.id, PEDAGO, 'Pas disponible');
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
});

// ---- closeEvent : « hors service » ----

test('closeEvent : un objet remis disponible à la main peut encore être clos « hors service »', () => {
  const item = itemDispo();
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Écran fendu' });
  store.items.update(item.id, { etat: ITEM_STATES.DISPONIBLE });
  closeEvent(ev.id, PEDAGO, { remettreEnService: false });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.HS);
  assert.match(store.log.list().at(-1).detail, /— hors service$/);
});

test('closeEvent : le suffixe du journal n’apparaît que si l’état a vraiment changé', () => {
  const item = itemDispo();
  const a = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Premier' });
  const b = createIntervention({ itemId: item.id, type: MAINT_TYPES.INTERNE, description: 'Second', pedagoId: PEDAGO });
  closeEvent(a.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.log.list().at(-1).detail, 'Premier', 'un autre événement est ouvert : rien n’a changé');
  closeEvent(b.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.log.list().at(-1).detail, 'Second — disponible');
  // Déjà disponible : la clôture ne change rien, le journal ne prétend pas le contraire.
  const c = store.maintenance.create({
    itemId: item.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: PEDAGO, date: NOW.toISOString(), statut: MAINT_STATES.OUVERT,
    description: 'Oubli', prestataire: '', cout: 0, loanId: null, bookingId: null,
  });
  closeEvent(c.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.items.get(item.id).etat, ITEM_STATES.DISPONIBLE);
  assert.equal(store.log.list().at(-1).detail, 'Oubli');
});

test('closeEvent : « remettre en service » ne touche pas à un objet encore dehors', () => {
  const loan = store.loans.list((l) => l.statut === LOAN_STATES.EN_COURS)[0];
  const ev = reportIssue({ itemId: loan.itemId, auteurId: PEDAGO, description: 'Signalé pendant l’emprunt' });
  closeEvent(ev.id, PEDAGO, { remettreEnService: true });
  assert.equal(store.items.get(loan.itemId).etat, ITEM_STATES.EMPRUNTE, 'son retour décidera');
  assert.equal(store.log.list().at(-1).detail, 'Signalé pendant l’emprunt');
});
