import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { REASONS, now } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { BOOKING_STATES, ITEM_STATES, MAINT_STATES } from '../js/models.js';
import {
  roomItems, roomChecklist, createBooking, cancelBooking, recordEntry, recordExit,
  closeDueBookings, sweepBookings, userBookings, weekBookings,
} from '../js/actions/bookings.js';

const NOW = new Date(2026, 8, 17, 10, 0);    // jeudi 17 sept. 10h
const DEMAIN = '2026-09-18';                  // vendredi
const ELEVE = 'user_010';
const PEDAGO = 'user_041';

const clock = (d) => store.settings.update({ horlogeDemo: d.toISOString() });

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  clock(NOW);
});

test('roomItems et roomChecklist : les 5 objets de la salle, plus la ligne globale', () => {
  const items = roomItems();
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.circuit === 'salle'));
  const lignes = roomChecklist();
  assert.equal(lignes.length, 6);
  assert.equal(lignes.at(-1).itemId, null);
  assert.match(lignes.at(-1).ligne, /Salle rangée/);
  assert.ok(lignes.every((l) => l.ok === true && l.commentaire === ''));
});

test('createBooking : réservation contiguë, journal, conflit et créneau passé refusés', () => {
  const b = createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [13, 14] });
  assert.equal(b.statut, BOOKING_STATES.A_VENIR);
  assert.deepEqual(b.creneaux, [13, 14]);
  assert.equal(b.etatEntree, null);
  assert.equal(b.etatSortie, null);
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.BOOKING_CREEE);
  assert.equal(entry.bookingId, b.id);
  assert.match(entry.detail, /13h-15h/);
  assert.throws(() => createBooking({ userId: 'user_011', date: DEMAIN, creneaux: [14] }), (e) => e.reason === REASONS.CRENEAU_OCCUPE);
  assert.throws(() => createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [8] }), (e) => e.reason === REASONS.CRENEAU_PASSE);
  assert.throws(() => createBooking({ userId: ELEVE, date: '2026-09-19', creneaux: [9] }), (e) => e.reason === REASONS.SALLE_FERMEE);
  assert.throws(() => createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [9, 11] }), (e) => e.reason === REASONS.CRENEAUX_NON_CONTIGUS);
});

test('cancelBooking : libère les créneaux, journalise, refuse une réservation terminée', () => {
  const b = createBooking({ userId: ELEVE, date: DEMAIN, creneaux: [13] });
  const annule = cancelBooking(b.id, ELEVE);
  assert.equal(annule.statut, BOOKING_STATES.ANNULEE);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_ANNULEE);
  const libre = createBooking({ userId: 'user_011', date: DEMAIN, creneaux: [13] });
  assert.equal(libre.statut, BOOKING_STATES.A_VENIR);
  assert.throws(() => cancelBooking(b.id, ELEVE), /plus annulable/);
  assert.throws(() => cancelBooking('nope', ELEVE), /introuvable/);
});

test('recordEntry : passe en cours, horodate, journalise ; refuse hors créneau et pour un autre', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11, 12] });
  assert.throws(() => recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), (e) => e.reason === REASONS.CRENEAU_PASSE || /pas encore commencé/.test(e.message));
  clock(new Date(2026, 8, 17, 11, 5));
  assert.throws(() => recordEntry({ bookingId: b.id, userId: 'user_011', checklist: roomChecklist() }), /ne vous appartient pas/);
  const r = recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  assert.equal(r.maintenance, null);
  assert.equal(r.booking.statut, BOOKING_STATES.EN_COURS);
  assert.equal(r.booking.etatEntree.lignes.length, 6);
  assert.equal(new Date(r.booking.etatEntree.date).getHours(), 11);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_ENTREE);
  assert.throws(() => recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /déjà/);
});

test('recordEntry avec un problème : signalement, objet en maintenance, deux entrées de journal', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  const lignes = roomChecklist();
  lignes[0].ok = false;
  lignes[0].commentaire = 'une ampoule grillée';
  const before = store.log.list().length;
  const r = recordEntry({ bookingId: b.id, userId: ELEVE, checklist: lignes });
  assert.equal(r.maintenance.statut, MAINT_STATES.OUVERT);
  assert.equal(r.maintenance.bookingId, b.id);
  assert.equal(r.maintenance.itemId, lignes[0].itemId);
  assert.match(r.maintenance.description, /ampoule grillée/);
  assert.equal(store.items.get(lignes[0].itemId).etat, ITEM_STATES.MAINTENANCE);
  assert.equal(store.log.list().length, before + 2);
});

test('recordExit : termine, journalise, exige l’entrée', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  assert.throws(() => recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /état des lieux d’entrée/);
  recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  clock(new Date(2026, 8, 17, 11, 50));
  const r = recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  assert.equal(r.booking.statut, BOOKING_STATES.TERMINEE);
  assert.equal(r.booking.etatSortie.lignes.length, 6);
  assert.equal(store.log.list().at(-1).action, ACTIONS.BOOKING_SORTIE);
  assert.throws(() => recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() }), /plus en cours/);
});

test('closeDueBookings : clôture les créneaux passés sans sortie manquante, idempotent', () => {
  const b = createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 11, 5));
  recordEntry({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  recordExit({ bookingId: b.id, userId: ELEVE, checklist: roomChecklist() });
  const jamaisVenue = createBooking({ userId: 'user_011', date: '2026-09-17', creneaux: [13] });
  clock(new Date(2026, 8, 17, 14, 30));
  assert.equal(closeDueBookings(), 1, 'la réservation jamais ouverte est clôturée');
  const apres = store.bookings.get(jamaisVenue.id);
  assert.equal(apres.statut, BOOKING_STATES.TERMINEE);
  assert.equal(apres.etatEntree, null, 'aucun état des lieux n’est inventé');
  assert.equal(closeDueBookings(), 0, 'idempotent');
});

test('sweepBookings : une écriture qui échoue ne lève pas', () => {
  createBooking({ userId: ELEVE, date: '2026-09-17', creneaux: [11] });
  clock(new Date(2026, 8, 17, 13, 30));
  const orig = store.log.create;
  store.log.create = () => { throw new Error('quota'); };
  try {
    assert.equal(sweepBookings(), 0);
  } finally {
    store.log.create = orig;
  }
  assert.equal(store.bookings.list((b) => b.statut === BOOKING_STATES.A_VENIR && b.date === '2026-09-17').length, 1, 'rien n’a été écrit');
  assert.equal(sweepBookings(), 1, 'le balayage suivant réussit');
});

test('userBookings et weekBookings', () => {
  const active = store.bookings.list((b) => b.statut === BOOKING_STATES.EN_COURS)[0];
  const u = userBookings(active.userId, NOW);
  assert.equal(u.active.booking.id, active.id);
  assert.equal(u.active.entreeFaite, true);
  assert.equal(u.active.sortieFaite, false);
  const futur = userBookings('user_008', NOW);
  assert.equal(futur.active, null);
  assert.ok(futur.aVenir.every((b) => b.date >= '2026-09-17'));
  const semaine = weekBookings(NOW);
  assert.ok(semaine.every((b) => b.date >= '2026-09-14' && b.date <= '2026-09-18'));
  assert.ok(semaine.some((b) => b.id === active.id));
});
