import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import {
  DEFAULT_SETTINGS, REASONS, REASON_LABELS, now, isWeekday, isOfficeOpen, atHour, addDays, ymd, fromYmd,
  selfReturnDeadline, isLate, pickupWindow, isInPickupWindow, isExpired,
  bookingStart, bookingEnd, isBookingActive, isExitMissing,
  slotsAreContiguous, slotsInRoomHours, slotsConflict,
  hasActiveLoanOfReference, userHasLateLoan, canBorrowSelf, canReserveValeur, withDefaults, sortByDateDesc,
} from '../js/rules.js';

const jeudi10h = new Date(2026, 8, 17, 10, 0);
const samedi10h = new Date(2026, 8, 19, 10, 0);
const S = DEFAULT_SETTINGS;

test('now() respecte l’horloge de démo', () => {
  localStorage.clear();
  store.init();
  assert.ok(Math.abs(now() - Date.now()) < 1000);
  store.settings.update({ horlogeDemo: '2026-09-17T08:00:00.000Z' });
  assert.equal(now().toISOString(), '2026-09-17T08:00:00.000Z');
  assert.equal(now({ horlogeDemo: null }).getFullYear(), new Date().getFullYear());
});

test('jours ouvrés et horaires d’ouverture', () => {
  assert.equal(isWeekday(jeudi10h), true);
  assert.equal(isWeekday(samedi10h), false);
  assert.equal(isOfficeOpen(jeudi10h, S.horaires), true);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 12, 30), S.horaires), false); // pause
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 16, 59), S.horaires), true);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 17, 0), S.horaires), false);
  assert.equal(isOfficeOpen(samedi10h, S.horaires), false);
});

test('utilitaires de dates', () => {
  assert.equal(ymd(jeudi10h), '2026-09-17');
  assert.equal(fromYmd('2026-09-17', 8).getHours(), 8);
  assert.equal(fromYmd('2026-09-17').getDate(), 17);
  assert.equal(addDays(jeudi10h, 3).getDate(), 20);
  assert.equal(atHour(jeudi10h, 17).getHours(), 17);
  assert.equal(atHour(jeudi10h, 17).getMinutes(), 0);
  assert.equal(selfReturnDeadline(jeudi10h).getHours(), 17);
  assert.equal(selfReturnDeadline('2026-09-17T08:00:00.000Z', 16).getHours(), 16);
});

test('retard = en_cours et date > finPrevue', () => {
  const loan = { statut: 'en_cours', finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() };
  assert.equal(isLate(loan, new Date(2026, 8, 17, 16, 59)), false);
  assert.equal(isLate(loan, new Date(2026, 8, 17, 17, 1)), true);
  assert.equal(isLate({ ...loan, statut: 'retournee' }, new Date(2026, 8, 18)), false);
});

test('fenêtre de retrait = [début, début + 60 min]', () => {
  const loan = { statut: 'reservee', debutPrevu: new Date(2026, 8, 17, 9, 0).toISOString() };
  const w = pickupWindow(loan, S.fenetreRetraitMinutes);
  assert.equal(w.start.getHours(), 9);
  assert.equal(w.end.getHours(), 10);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 8, 59), 60), false);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 9, 30), 60), true);
  assert.equal(isInPickupWindow(loan, new Date(2026, 8, 17, 10, 0), 60), true);
  assert.equal(isExpired(loan, new Date(2026, 8, 17, 10, 0), 60), false);
  assert.equal(isExpired(loan, new Date(2026, 8, 17, 10, 1), 60), true);
  assert.equal(isExpired({ ...loan, statut: 'en_cours' }, new Date(2026, 8, 18), 60), false);
});

test('réservation salle : début, fin, active, sortie non faite', () => {
  const b = { date: '2026-09-17', creneaux: [8, 9, 10, 11, 12], statut: 'a_venir', etatSortie: null };
  assert.equal(bookingStart(b).getHours(), 8);
  assert.equal(bookingEnd(b).getHours(), 13);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 7, 59)), false);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 12, 59)), true);
  assert.equal(isBookingActive(b, new Date(2026, 8, 17, 13, 0)), false);
  assert.equal(isBookingActive({ ...b, statut: 'annulee' }, new Date(2026, 8, 17, 10)), false);
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 0)), false);
  assert.equal(isExitMissing(b, new Date(2026, 8, 17, 14, 1)), true);
  assert.equal(isExitMissing({ ...b, etatSortie: { date: 'x', lignes: [] } }, new Date(2026, 8, 18)), false);
  assert.equal(isExitMissing({ ...b, statut: 'annulee' }, new Date(2026, 8, 18)), false);
});

test('créneaux : contiguïté, plage horaire, conflits', () => {
  assert.equal(slotsAreContiguous([8, 9, 10]), true);
  assert.equal(slotsAreContiguous([10, 8, 9]), true);
  assert.equal(slotsAreContiguous([8, 10]), false);
  assert.equal(slotsAreContiguous([]), false);
  assert.equal(slotsInRoomHours([8, 16], S.salle), true);
  assert.equal(slotsInRoomHours([7], S.salle), false);
  assert.equal(slotsInRoomHours([17], S.salle), false);
  const bookings = [
    { id: 'b1', date: '2026-09-17', creneaux: [9, 10], statut: 'a_venir' },
    { id: 'b2', date: '2026-09-17', creneaux: [14], statut: 'annulee' },
  ];
  assert.equal(slotsConflict(bookings, '2026-09-17', [10, 11]), true);
  assert.equal(slotsConflict(bookings, '2026-09-17', [11, 12]), false);
  assert.equal(slotsConflict(bookings, '2026-09-17', [14]), false); // annulée
  assert.equal(slotsConflict(bookings, '2026-09-18', [9]), false);
  assert.equal(slotsConflict(bookings, '2026-09-17', [9], 'b1'), false); // ignorée
});

const items = [
  { id: 'i1', reference: 'multiprise', circuit: 'self', etat: 'disponible' },
  { id: 'i2', reference: 'multiprise', circuit: 'self', etat: 'disponible' },
  { id: 'i3', reference: 'canon-r10', circuit: 'valeur', etat: 'disponible' },
  { id: 'i4', reference: 'leofoto-trepied', circuit: 'salle', etat: 'disponible' },
];
const user = { id: 'u1', actif: true };

test('un exemplaire par référence et par personne', () => {
  const loans = [{ userId: 'u1', itemId: 'i1', statut: 'en_cours' }];
  assert.equal(hasActiveLoanOfReference(loans, items, 'u1', 'multiprise'), true);
  assert.equal(hasActiveLoanOfReference(loans, items, 'u1', 'canon-r10'), false);
  assert.equal(hasActiveLoanOfReference(loans, items, 'u2', 'multiprise'), false);
  assert.equal(hasActiveLoanOfReference([{ ...loans[0], statut: 'retournee' }], items, 'u1', 'multiprise'), false);
});

test('canBorrowSelf : cas passant et motifs de refus', () => {
  const base = { item: items[0], user, loans: [], items, settings: S, date: jeudi10h };
  assert.deepEqual(canBorrowSelf(base), { ok: true, reason: null });
  assert.equal(canBorrowSelf({ ...base, date: samedi10h }).reason, REASONS.BUREAU_FERME);
  assert.equal(canBorrowSelf({ ...base, item: items[2] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canBorrowSelf({ ...base, item: { ...items[0], etat: 'maintenance' } }).reason, REASONS.EN_MAINTENANCE);
  assert.equal(canBorrowSelf({ ...base, item: { ...items[0], etat: 'emprunte' } }).reason, REASONS.EMPRUNTE_PAR_AUTRE);
  assert.equal(canBorrowSelf({ ...base, item: { ...items[0], etat: 'hs' } }).reason, REASONS.HORS_SERVICE);
  assert.equal(canBorrowSelf({ ...base, loans: [{ userId: 'u1', itemId: 'i2', statut: 'en_cours' }] }).reason, REASONS.DEJA_UN_EXEMPLAIRE);
  const late = [{ userId: 'u1', itemId: 'i3', statut: 'en_cours', finPrevue: new Date(2026, 8, 10).toISOString() }];
  assert.equal(canBorrowSelf({ ...base, loans: late }).reason, REASONS.RETARD_EN_COURS);
  assert.equal(canBorrowSelf({ ...base, loans: late, settings: { ...S, bloquerSiRetard: false } }).ok, true);
  assert.equal(canBorrowSelf({ ...base, user: { ...user, actif: false } }).reason, REASONS.UTILISATEUR_INACTIF);
  assert.equal(userHasLateLoan(late, 'u1', jeudi10h), true);
});

test('canReserveValeur : durée max et circuit', () => {
  const debut = new Date(2026, 8, 18, 9);
  const base = { item: items[2], user, loans: [], items, settings: S, debutPrevu: debut, finPrevue: addDays(debut, 3), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, 6) }).reason, REASONS.DUREE_TROP_LONGUE);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, -1) }).reason, REASONS.DATES_INCOHERENTES);
  assert.equal(canReserveValeur({ ...base, item: items[0] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...base, item: items[3] }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...base, item: { ...items[2], etat: 'reserve' } }).reason, REASONS.RESERVE_PAR_AUTRE);
  // Le doublon de référence prime sur l’état : son propre exemplaire réservé n’est pas « réservé par quelqu’un d’autre ».
  const sienne = [{ userId: 'u1', itemId: 'i3', statut: 'reservee' }];
  assert.equal(canReserveValeur({ ...base, item: { ...items[2], etat: 'reserve' }, loans: sienne }).reason, REASONS.DEJA_UN_EXEMPLAIRE);
});

test('canReserveValeur : cohérence des dates et heures d’ouverture du retrait', () => {
  const jeudi9h = new Date(2026, 8, 17, 9);
  const base = { item: items[2], user, loans: [], items, settings: S, debutPrevu: jeudi9h, finPrevue: jeudi9h, date: jeudi10h };
  assert.deepEqual(canReserveValeur(base), { ok: true, reason: null });
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 19, 9), finPrevue: new Date(2026, 8, 19, 17) }).reason, REASONS.HORS_OUVERTURE, 'samedi');
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 17, 12, 30) }).reason, REASONS.HORS_OUVERTURE, 'pause de midi');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 16, 17) }).reason, REASONS.DATES_INCOHERENTES, 'retour la veille du retrait');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 17, 8) }).ok, true, 'même jour, heure antérieure : permis');
});

test('canReserveValeur : durée max et circuit (jours calendaires)', () => {
  // (a) lundi 9h → samedi 17h = 5 jours calendaires (fractionnaire donnerait ~4,33) → ok
  const lundi9h = new Date(2026, 8, 14, 9);
  const samedi17h = new Date(2026, 8, 19, 17);
  const base = { item: items[2], user, loans: [], items, settings: S, debutPrevu: lundi9h, finPrevue: samedi17h, date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true);
  // (b) exactement dureeMaxReservationJours jours → ok
  const debut = new Date(2026, 8, 14, 9);
  const finExacte = fromYmd(ymd(addDays(debut, S.dureeMaxReservationJours)), 8);
  assert.equal(canReserveValeur({ ...base, debutPrevu: debut, finPrevue: finExacte }).ok, true);
  // (c) dureeMax + 1 jour → DUREE_TROP_LONGUE
  const finTropLongue = fromYmd(ymd(addDays(debut, S.dureeMaxReservationJours + 1)), 8);
  assert.equal(canReserveValeur({ ...base, debutPrevu: debut, finPrevue: finTropLongue }).reason, REASONS.DUREE_TROP_LONGUE);
  // (d) traversée de DST (passage heure d’hiver fin octobre en France) : 5 jours calendaires → ok
  const debutDst = new Date(2026, 9, 22, 9);
  const finDst = new Date(2026, 9, 27, 9);
  assert.equal(canReserveValeur({ ...base, debutPrevu: debutDst, finPrevue: finDst }).ok, true);
});

test('chaque motif a un libellé français', () => {
  for (const r of Object.values(REASONS)) assert.ok(REASON_LABELS[r], r);
});

test('sortByDateDesc : tri par date métier, createdAt en départage', () => {
  const rows = [
    { d: '2026-09-10', createdAt: '2026-09-18T10:00:00Z' },
    { d: '2026-09-16', createdAt: '2026-09-01T00:00:00Z' },
    { d: null, createdAt: '2026-09-19T00:00:00Z' },
  ];
  assert.deepEqual(sortByDateDesc(rows, (r) => r.d).map((r) => r.d), ['2026-09-16', '2026-09-10', null]);
  const tie = [
    { d: '2026-09-10', createdAt: '2026-09-01T00:00:00Z' },
    { d: '2026-09-10', createdAt: '2026-09-05T00:00:00Z' },
  ];
  assert.deepEqual(sortByDateDesc(tie, (r) => r.d).map((r) => r.createdAt), ['2026-09-05T00:00:00Z', '2026-09-01T00:00:00Z']);
});

test('withDefaults : fusionne des settings partiels avec les défauts', () => {
  assert.deepEqual(withDefaults(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(withDefaults({}), DEFAULT_SETTINGS);
  assert.equal(withDefaults({ dureeMaxReservationJours: 2 }).dureeMaxReservationJours, 2);
  assert.equal(withDefaults({ dureeMaxReservationJours: 2 }).fenetreRetraitMinutes, DEFAULT_SETTINGS.fenetreRetraitMinutes);
});

test('canBorrowSelf avec des settings vides se comporte comme DEFAULT_SETTINGS', () => {
  const base = { item: items[0], user, loans: [], items, settings: {}, date: jeudi10h };
  assert.deepEqual(canBorrowSelf(base), { ok: true, reason: null });
  assert.equal(canBorrowSelf({ ...base, date: samedi10h }).reason, REASONS.BUREAU_FERME);
});

test('isOfficeOpen(date, null) utilise les horaires par défaut', () => {
  assert.equal(isOfficeOpen(jeudi10h, null), true);
  assert.equal(isOfficeOpen(jeudi10h, undefined), true);
});
