import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import {
  DEFAULT_SETTINGS, REASONS, REASON_LABELS, now, isWeekday, isOfficeOpen, atHour, addDays, ymd, fromYmd,
  selfReturnDeadline, returnHour, isLate, pickupWindow, isInPickupWindow, isExpired,
  bookingStart, bookingEnd, isBookingActive, isExitMissing,
  slotsAreContiguous, slotsInRoomHours, slotsConflict,
  hasActiveLoanOfReference, userHasLateLoan, canBorrowSelf, canReserveValeur, withDefaults, sortByDateDesc,
  openHours, reasonLabel, formatOpenHours,
  MOMENTS, halfDays, halfDayBounds, occupiesWindow, freeExemplaires,
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
  const enCours = { ...b, statut: 'en_cours' };
  assert.equal(isExitMissing(enCours, new Date(2026, 8, 17, 14, 0)), false);
  assert.equal(isExitMissing(enCours, new Date(2026, 8, 17, 14, 1)), true);
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

test('canReserveValeur : durée max, circuit et doublon de référence', () => {
  const debut = new Date(2026, 8, 18, 9);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: debut, finPrevue: fromYmd(ymd(addDays(debut, 2)), 17), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true);
  assert.equal(canReserveValeur({ ...base, finPrevue: fromYmd(ymd(addDays(debut, 7)), 17) }).reason, REASONS.DUREE_TROP_LONGUE);
  assert.equal(canReserveValeur({ ...base, finPrevue: addDays(debut, -1) }).reason, REASONS.DATES_INCOHERENTES);
  assert.equal(canReserveValeur({ ...base, reference: items[0].reference }).reason, REASONS.MAUVAIS_CIRCUIT, 'self');
  assert.equal(canReserveValeur({ ...base, reference: items[3].reference }).reason, REASONS.MAUVAIS_CIRCUIT, 'salle');
  // Détenir déjà un exemplaire prime sur la disponibilité : la réservation occupe PRÉCISÉMENT la
  // période demandée du seul exemplaire, donc « complet » serait l’autre réponse possible.
  const sienne = [{ id: 'l1', userId: 'u1', itemId: items[2].id, statut: 'reservee', debutPrevu: base.debutPrevu.toISOString(), finPrevue: base.finPrevue.toISOString() }];
  assert.equal(canReserveValeur({ ...base, loans: sienne }).reason, REASONS.DEJA_UN_EXEMPLAIRE);
  assert.equal(canReserveValeur({ ...base, loans: [{ ...sienne[0], userId: 'u2' }] }).reason, REASONS.COMPLET_SUR_LA_PERIODE, 'la même période prise par un autre');
});

test('canReserveValeur : cohérence des dates et heures d’ouverture du retrait', () => {
  const jeudi9h = new Date(2026, 8, 17, 9);
  const jeudi17h = new Date(2026, 8, 17, 17);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: jeudi9h, finPrevue: jeudi17h, date: jeudi10h };
  const verdict = canReserveValeur(base);
  assert.deepEqual({ ok: verdict.ok, reason: verdict.reason }, { ok: true, reason: null });
  assert.deepEqual(verdict.libres.map((i) => i.id), [items[2].id], 'le verdict rend l’exemplaire qu’il a retenu');
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 19, 9), finPrevue: new Date(2026, 8, 19, 17) }).reason, REASONS.HORS_OUVERTURE, 'samedi');
  assert.equal(canReserveValeur({ ...base, debutPrevu: new Date(2026, 8, 17, 12, 30) }).reason, REASONS.HORS_OUVERTURE, 'pause de midi');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 16, 17) }).reason, REASONS.DATES_INCOHERENTES, 'retour la veille du retrait');
  // Une période de longueur nulle ou négative n’a plus de sens : le minimum est une demi-journée.
  assert.equal(canReserveValeur({ ...base, finPrevue: jeudi9h }).reason, REASONS.DATES_INCOHERENTES, 'même instant');
  assert.equal(canReserveValeur({ ...base, finPrevue: new Date(2026, 8, 17, 8) }).reason, REASONS.DATES_INCOHERENTES, 'retour avant le retrait');
});

test('canReserveValeur : durée en jours calendaires, bornes comprises', () => {
  // Un lundi À VENIR : le verdict refuse désormais une période passée, et ce test ne parle
  // que d’arithmétique de durée — les bornes comptées restent exactement les mêmes.
  const lundi9h = new Date(2026, 8, 21, 9);
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, debutPrevu: lundi9h, finPrevue: fromYmd(ymd(addDays(lundi9h, 4)), 17), date: jeudi10h };
  assert.equal(canReserveValeur(base).ok, true, 'lundi au vendredi = 5 jours');
  // Bornes comprises : debut + (max - 1) jours est le dernier jour permis.
  const dernierJour = fromYmd(ymd(addDays(lundi9h, S.dureeMaxReservationJours - 1)), 17);
  assert.equal(canReserveValeur({ ...base, finPrevue: dernierJour }).ok, true, 'sept jours pile');
  const unDeTrop = fromYmd(ymd(addDays(lundi9h, S.dureeMaxReservationJours)), 17);
  assert.equal(canReserveValeur({ ...base, finPrevue: unDeTrop }).reason, REASONS.DUREE_TROP_LONGUE);
  // Traversée du changement d’heure : le compte reste en jours calendaires.
  const debutDst = new Date(2026, 9, 22, 9);
  assert.equal(canReserveValeur({ ...base, debutPrevu: debutDst, finPrevue: fromYmd(ymd(addDays(debutDst, 5)), 17) }).ok, true);
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

test('dates seules « AAAA-MM-JJ » lues en heure locale, quel que soit le fuseau', () => {
  assert.equal(ymd('2026-09-17'), '2026-09-17');
  assert.equal(isWeekday('2026-09-19'), false, 'samedi');
  assert.equal(isWeekday('2026-09-18'), true, 'vendredi');
});

test('openHours : tolère une liste nulle, vide ou mal formée', () => {
  assert.deepEqual(openHours(null), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [] }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: null }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [{ debut: 9, fin: 'midi' }] }), DEFAULT_SETTINGS.horaires);
  assert.deepEqual(openHours({ horaires: [{ debut: 9.5, fin: 12 }] }), [{ debut: 9.5, fin: 12 }]);
});

test('isOfficeOpen : horaires fractionnaires et réglages cassés', () => {
  const S = { horaires: [{ debut: 9.5, fin: 12 }] };
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 9, 20), S.horaires), false);
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 9, 40), S.horaires), true);
  // Une liste vide retombe sur les horaires par défaut au lieu de fermer le bureau pour toujours.
  assert.equal(isOfficeOpen(new Date(2026, 8, 17, 10, 0), []), true);
});

test('reasonLabel : le message hors ouverture reprend les horaires réglés', () => {
  const S = { horaires: [{ debut: 9, fin: 12 }, { debut: 14, fin: 18 }] };
  const texte = reasonLabel(REASONS.HORS_OUVERTURE, S);
  assert.match(texte, /9h-12h/);
  assert.match(texte, /14h-18h/);
  assert.doesNotMatch(texte, /8h-12h/);
  // Sans réglages, le libellé statique reste celui de REASON_LABELS.
  assert.equal(reasonLabel(REASONS.BUREAU_FERME), REASON_LABELS[REASONS.BUREAU_FERME]);
});

test('formatOpenHours : heures entières et fractionnaires', () => {
  assert.equal(formatOpenHours({ horaires: [{ debut: 9.5, fin: 12 }] }), '9h30-12h');
  assert.equal(formatOpenHours(null), '8h-12h et 13h-17h');
});

test('openHours : le repli est une copie, pas les horaires par défaut eux-mêmes', () => {
  const repli = openHours({ horaires: [] });
  assert.notEqual(repli, DEFAULT_SETTINGS.horaires);
  assert.notEqual(repli[0], DEFAULT_SETTINGS.horaires[0]);
  repli[0].debut = 3;
  assert.equal(DEFAULT_SETTINGS.horaires[0].debut, 8, 'modifier le résultat ne corrompt pas les défauts');
});

test('reasonLabel : salle_fermee reprend les heures de la salle réglées', () => {
  const texte = reasonLabel(REASONS.SALLE_FERMEE, { salle: { heureDebut: 9, heureFin: 18 } });
  assert.match(texte, /de 9h à 18h/);
  assert.doesNotMatch(texte, /8h à 17h/);
  // Réglage absent ou cassé : retour aux heures par défaut ; sans réglages : texte figé.
  assert.match(reasonLabel(REASONS.SALLE_FERMEE, {}), /de 8h à 17h/);
  assert.equal(reasonLabel(REASONS.SALLE_FERMEE), REASON_LABELS[REASONS.SALLE_FERMEE]);
});

test('isExitMissing : seul un créneau en cours peut avoir une sortie manquante', () => {
  const base = { date: '2026-09-17', creneaux: [9, 10], etatSortie: null };
  const tard = new Date(2026, 8, 17, 13, 0);
  assert.equal(isExitMissing({ ...base, statut: 'en_cours' }, tard), true);
  assert.equal(isExitMissing({ ...base, statut: 'terminee' }, tard), false, 'clos d’office par la pédago');
  assert.equal(isExitMissing({ ...base, statut: 'a_venir' }, tard), false, 'jamais commencé, balayé par closeDueBookings');
  assert.equal(isExitMissing({ ...base, statut: 'annulee' }, tard), false);
  assert.equal(isExitMissing({ ...base, statut: 'en_cours' }, new Date(2026, 8, 17, 11, 30)), false, 'moins d’une heure après la fin');
});

test('returnHour : sans valeur enregistrée, la dernière fermeture des horaires réglés', () => {
  assert.equal(returnHour(null), 17, 'sans réglages : horaires par défaut');
  assert.equal(returnHour({}), 17);
  assert.equal(returnHour({ horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 16 }] }), 16);
  assert.equal(returnHour({ horaires: [{ debut: 14, fin: 18 }, { debut: 8, fin: 12 }] }), 18, 'la plus tardive, quel que soit l’ordre');
  assert.equal(returnHour({ horaires: [] }), 17, 'horaires mal formés : repli sur les défauts');
});

test('returnHour : une valeur enregistrée l’emporte sur les horaires', () => {
  assert.equal(returnHour({ heureRetourSelf: 15, horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 16 }] }), 15);
  assert.equal(returnHour({ heureRetourSelf: 'bientôt', horaires: [{ debut: 9, fin: 11 }] }), 11, 'une valeur inexploitable est ignorée');
});

test('selfReturnDeadline : sans heure explicite, la fermeture par défaut ; les demi-heures sont respectées', () => {
  assert.equal(selfReturnDeadline(new Date(2026, 8, 17, 10, 0)).getHours(), 17);
  const demi = selfReturnDeadline(new Date(2026, 8, 17, 10, 0), 16.5);
  assert.deepEqual([demi.getHours(), demi.getMinutes()], [16, 30]);
});

test('REASON_LABELS : les messages d’horaires sans réglages sont ceux que donnent les horaires par défaut', () => {
  for (const reason of [REASONS.HORS_OUVERTURE, REASONS.SALLE_FERMEE]) {
    assert.equal(REASON_LABELS[reason], reasonLabel(reason, DEFAULT_SETTINGS), reason);
  }
  assert.match(REASON_LABELS.hors_ouverture, /8h-12h et 13h-17h/);
  assert.match(REASON_LABELS.salle_fermee, /de 8h à 17h/);
});

const ITEMS_SD = [
  { id: 'i1', reference: 'sd-256', circuit: 'valeur', etat: 'disponible' },
  { id: 'i2', reference: 'sd-256', circuit: 'valeur', etat: 'disponible' },
  { id: 'i3', reference: 'sd-256', circuit: 'valeur', etat: 'maintenance' },
];
// Par défaut la réservation est celle de quelqu’un d’autre : c’est le cas qui nous occupe.
// Une réservation à soi déclencherait « déjà un exemplaire », qui passe avant dans l’ordre des refus.
const resa = (itemId, debut, fin, statut = 'reservee', userId = 'autre') => ({
  id: `l-${itemId}-${debut}`, itemId, userId, statut,
  debutPrevu: new Date(debut).toISOString(), finPrevue: new Date(fin).toISOString(),
});

test('halfDays : les deux demi-journées viennent des horaires réglés', () => {
  assert.deepEqual(halfDays(DEFAULT_SETTINGS), {
    matin: { debut: 8, fin: 12 },
    apres_midi: { debut: 13, fin: 17 },
  });
  // Horaires modifiés : les demi-journées suivent.
  assert.deepEqual(halfDays({ horaires: [{ debut: 9, fin: 11 }, { debut: 14, fin: 18 }] }), {
    matin: { debut: 9, fin: 11 },
    apres_midi: { debut: 14, fin: 18 },
  });
  // Une seule plage : l’après-midi est sa seconde moitié, pour que « demi-journée » garde un sens.
  assert.deepEqual(halfDays({ horaires: [{ debut: 8, fin: 16 }] }), {
    matin: { debut: 8, fin: 12 },
    apres_midi: { debut: 12, fin: 16 },
  });
  // Réglages absents ou cassés : les horaires par défaut, via `openHours`.
  assert.deepEqual(halfDays(null), { matin: { debut: 8, fin: 12 }, apres_midi: { debut: 13, fin: 17 } });
});

test('halfDayBounds : des dates locales, pas UTC', () => {
  const matin = halfDayBounds('2026-11-03', MOMENTS.MATIN, DEFAULT_SETTINGS);
  assert.equal(matin.debut.getHours(), 8);
  assert.equal(matin.fin.getHours(), 12);
  assert.equal(matin.debut.getDate(), 3, 'le jour ne glisse pas selon le fuseau');
  const aprem = halfDayBounds('2026-11-03', MOMENTS.APRES_MIDI, DEFAULT_SETTINGS);
  assert.equal(aprem.debut.getHours(), 13);
  assert.equal(aprem.fin.getHours(), 17);
});

test('occupiesWindow : chevauchement, bornes jointives, statuts qui ne comptent pas', () => {
  const MAINTENANT = new Date(2026, 10, 1, 10, 0);
  const l = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const entre = (d, f) => occupiesWindow(l, new Date(d), new Date(f), MAINTENANT);
  assert.equal(entre('2026-11-04T08:00', '2026-11-04T12:00'), true, 'à l’intérieur');
  assert.equal(entre('2026-11-02T08:00', '2026-11-03T12:00'), true, 'déborde au début');
  assert.equal(entre('2026-11-05T13:00', '2026-11-06T17:00'), true, 'déborde à la fin');
  // Bornes jointives : la réservation finit quand l’autre commence, pas de conflit.
  assert.equal(entre('2026-11-05T17:00', '2026-11-06T17:00'), false);
  assert.equal(entre('2026-11-01T08:00', '2026-11-03T08:00'), false);
  // Loin devant, loin derrière.
  assert.equal(entre('2026-12-01T08:00', '2026-12-02T17:00'), false);
  // Un statut clos n’occupe rien.
  for (const statut of ['retournee', 'refusee', 'expiree', 'annulee']) {
    assert.equal(occupiesWindow({ ...l, statut }, new Date('2026-11-04T08:00'), new Date('2026-11-04T12:00'), MAINTENANT), false, statut);
  }
});

test('occupiesWindow : un emprunt en retard occupe tout l’avenir', () => {
  // Sorti, devait rentrer hier, toujours dehors : aucune période future n’est libre.
  const enRetard = resa('i1', '2026-10-20T08:00', '2026-10-30T17:00', 'en_cours');
  const apres = new Date(2026, 10, 1, 10, 0); // 1er novembre
  assert.equal(occupiesWindow(enRetard, new Date('2026-11-03T08:00'), new Date('2026-11-03T12:00'), apres), true);
  assert.equal(occupiesWindow(enRetard, new Date('2027-01-05T08:00'), new Date('2027-01-05T12:00'), apres), true);
  // À l’heure, il n’occupe que sa période.
  const aLHeure = resa('i1', '2026-10-20T08:00', '2026-11-30T17:00', 'en_cours');
  const pendant = new Date(2026, 10, 1, 10, 0);
  assert.equal(occupiesWindow(aLHeure, new Date('2026-12-01T08:00'), new Date('2026-12-02T17:00'), pendant), false);
});

test('freeExemplaires : c’est le cœur du correctif', () => {
  const MAINTENANT = new Date(2026, 9, 6, 10, 0); // 6 octobre
  const novembre = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const libre = (d, f) => freeExemplaires({
    items: ITEMS_SD, loans: [novembre], reference: 'sd-256',
    debut: new Date(d), fin: new Date(f), date: MAINTENANT,
  }).map((i) => i.id);
  // Le défaut signalé : une réservation en novembre ne bloque pas octobre.
  assert.deepEqual(libre('2026-10-08T08:00', '2026-10-08T12:00'), ['i1', 'i2']);
  // Sur la période réservée, l’exemplaire pris sort, l’autre reste.
  assert.deepEqual(libre('2026-11-04T08:00', '2026-11-04T12:00'), ['i2']);
  // Un objet en maintenance n’est jamais libre, quelle que soit la période.
  assert.ok(!libre('2026-12-01T08:00', '2026-12-01T12:00').includes('i3'));
  // Les deux exemplaires pris : complet.
  const deux = [novembre, resa('i2', '2026-11-03T08:00', '2026-11-05T17:00')];
  assert.deepEqual(freeExemplaires({
    items: ITEMS_SD, loans: deux, reference: 'sd-256',
    debut: new Date('2026-11-04T08:00'), fin: new Date('2026-11-04T12:00'), date: MAINTENANT,
  }), []);
});

test('freeExemplaires : `ignoreLoanId` laisse une réservation ne pas se gêner elle-même', () => {
  const MAINTENANT = new Date(2026, 9, 6, 10, 0);
  const sienne = resa('i1', '2026-11-03T08:00', '2026-11-05T17:00');
  const ids = freeExemplaires({
    items: ITEMS_SD, loans: [sienne], reference: 'sd-256',
    debut: new Date('2026-11-04T08:00'), fin: new Date('2026-11-04T12:00'),
    date: MAINTENANT, ignoreLoanId: sienne.id,
  }).map((i) => i.id);
  assert.deepEqual(ids, ['i1', 'i2']);
});

test('canReserveValeur : durée maximale de sept jours, bornes comprises', () => {
  const ctx = (debut, fin) => ({
    reference: 'sd-256', user: { id: 'u1', actif: true }, loans: [], items: ITEMS_SD,
    settings: DEFAULT_SETTINGS, debutPrevu: new Date(debut), finPrevue: new Date(fin),
    date: new Date(2026, 9, 6, 10, 0),
  });
  assert.equal(canReserveValeur(ctx('2026-11-03T08:00', '2026-11-09T17:00')).ok, true, 'sept jours pile');
  const trop = canReserveValeur(ctx('2026-11-03T08:00', '2026-11-10T17:00'));
  assert.equal(trop.ok, false);
  assert.equal(trop.reason, REASONS.DUREE_TROP_LONGUE);
  // Une demi-journée : le minimum, accepté.
  assert.equal(canReserveValeur(ctx('2026-11-03T08:00', '2026-11-03T12:00')).ok, true);
  // Fin avant début.
  assert.equal(canReserveValeur(ctx('2026-11-05T08:00', '2026-11-03T12:00')).reason, REASONS.DATES_INCOHERENTES);
});

test('canReserveValeur : la référence doit être du circuit valeur', () => {
  // Le passage de l’exemplaire à la référence ne doit pas perdre cette garde.
  const commun = {
    user: { id: 'u1', actif: true }, loans: [], settings: DEFAULT_SETTINGS,
    debutPrevu: new Date('2026-11-03T08:00'), finPrevue: new Date('2026-11-03T12:00'),
    date: new Date(2026, 9, 6, 10, 0),
  };
  const selfService = [{ id: 's1', reference: 'multiprise', circuit: 'self', etat: 'disponible' }];
  assert.equal(canReserveValeur({ ...commun, reference: 'multiprise', items: selfService }).reason, REASONS.MAUVAIS_CIRCUIT);
  assert.equal(canReserveValeur({ ...commun, reference: 'inexistante', items: ITEMS_SD }).reason, REASONS.CODE_INCONNU);
  assert.equal(canReserveValeur({ ...commun, reference: 'sd-256', items: ITEMS_SD }).ok, true);
});

test('canReserveValeur : refuse quand aucun exemplaire n’est libre sur la période', () => {
  const pris = [
    resa('i1', '2026-11-03T08:00', '2026-11-05T17:00'),
    resa('i2', '2026-11-03T08:00', '2026-11-05T17:00'),
  ];
  const verdict = canReserveValeur({
    reference: 'sd-256', user: { id: 'u1', actif: true }, loans: pris, items: ITEMS_SD,
    settings: DEFAULT_SETTINGS, debutPrevu: new Date('2026-11-04T08:00'),
    finPrevue: new Date('2026-11-04T12:00'), date: new Date(2026, 9, 6, 10, 0),
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, REASONS.COMPLET_SUR_LA_PERIODE);
});

test('une référence dont tous les exemplaires sont immobilisés le dit, au lieu de « complet sur la période »', () => {
  const debut = new Date(2026, 8, 18, 9);
  const base = { reference: items[2].reference, user, loans: [], settings: S, debutPrevu: debut, finPrevue: fromYmd(ymd(debut), 17), date: jeudi10h };
  const enMaint = items.map((i) => (i.id === items[2].id ? { ...i, etat: 'maintenance' } : i));
  const hs = items.map((i) => (i.id === items[2].id ? { ...i, etat: 'hs' } : i));
  assert.equal(canReserveValeur({ ...base, items: enMaint }).reason, REASONS.EN_MAINTENANCE);
  assert.equal(canReserveValeur({ ...base, items: hs }).reason, REASONS.HORS_SERVICE);
  // Aucune autre date n’y changerait rien : le motif ne doit pas inviter à chercher un créneau.
  assert.equal(canReserveValeur({ ...base, items: hs, debutPrevu: fromYmd('2026-11-03', 9), finPrevue: fromYmd('2026-11-03', 17) }).reason, REASONS.HORS_SERVICE);
});

test('halfDayBounds : une plage de largeur impaire coupe à la demi-heure sans tronquer', () => {
  const S1 = { ...S, horaires: [{ debut: 8, fin: 15 }] };
  assert.deepEqual(halfDays(S1), { matin: { debut: 8, fin: 11.5 }, apres_midi: { debut: 11.5, fin: 15 } });
  const matin = halfDayBounds('2026-09-17', MOMENTS.MATIN, S1);
  const aprem = halfDayBounds('2026-09-17', MOMENTS.APRES_MIDI, S1);
  assert.equal(matin.fin.getHours(), 11);
  assert.equal(matin.fin.getMinutes(), 30, 'et non 11h00 par troncature');
  assert.equal(aprem.debut.getMinutes(), 30);
  assert.equal(+matin.fin, +aprem.debut, 'les deux moitiés restent jointives');
});

test('occupiesWindow : un emprunt en retard occupe aussi sa propre période, passé compris', () => {
  const retard = { statut: 'en_cours', debutPrevu: new Date(2026, 8, 15, 9).toISOString(), finPrevue: new Date(2026, 8, 16, 17).toISOString() };
  // Une fenêtre entièrement dans la période de l’emprunt, mais déjà passée : l’objet y était dehors.
  assert.equal(occupiesWindow(retard, new Date(2026, 8, 15, 10), new Date(2026, 8, 15, 12), jeudi10h), true);
  // Et il occupe tout l’avenir, puisque nul ne sait quand il rentre.
  assert.equal(occupiesWindow(retard, new Date(2026, 9, 1, 9), new Date(2026, 9, 1, 17), jeudi10h), true);
  // Avant son retrait, en revanche, il n’occupait rien.
  assert.equal(occupiesWindow(retard, new Date(2026, 8, 14, 9), new Date(2026, 8, 14, 17), jeudi10h), false);
});

test('canReserveValeur : une période passée se refuse dans le verdict, pas seulement à l’écriture', () => {
  const base = { reference: items[2].reference, user, loans: [], items, settings: S, date: jeudi10h };
  // La veille : l’écran de réservation doit pouvoir le dire avant toute validation (spec §5.2).
  assert.equal(canReserveValeur({ ...base, debutPrevu: fromYmd('2026-09-16', 9), finPrevue: fromYmd('2026-09-16', 17) }).reason, REASONS.DATE_PASSEE);
  // Le jour même, avant l’heure courante : la fenêtre de retrait est déjà close.
  assert.equal(canReserveValeur({ ...base, debutPrevu: fromYmd('2026-09-17', 8), finPrevue: fromYmd('2026-09-17', 12) }).reason, REASONS.DATE_PASSEE);
  // La borne : un retrait à 9h avec une fenêtre d’une heure se clôt À 10h pile, et il est 10h —
  // la fenêtre est encore ouverte, puisqu’elle se juge sur « close AVANT maintenant ».
  assert.equal(canReserveValeur({ ...base, debutPrevu: fromYmd('2026-09-17', 9), finPrevue: fromYmd('2026-09-17', 12) }).ok, true, 'fenêtre close à 10h pile : encore ouverte');
  assert.equal(canReserveValeur({ ...base, debutPrevu: fromYmd('2026-09-17', 13), finPrevue: fromYmd('2026-09-17', 17) }).ok, true, 'cet après-midi : permis');
  // La fenêtre de retrait réglée mène ce jugement, pas une heure écrite en dur.
  const large = { ...base, settings: { ...S, fenetreRetraitMinutes: 240 }, debutPrevu: fromYmd('2026-09-17', 8), finPrevue: fromYmd('2026-09-17', 12) };
  assert.equal(canReserveValeur(large).ok, true, 'une fenêtre de quatre heures est encore ouverte à 10h');
});
