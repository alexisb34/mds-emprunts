import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, REASONS } from '../js/rules.js';
import { startOfWeek, weekDays, weekLabel, roomHours, buildWeekGrid, toggleSlot, selectionIsValid } from '../js/weekGrid.js';

const JEUDI = new Date(2026, 8, 17, 10, 0);   // jeudi 17 septembre 2026
const S = DEFAULT_SETTINGS;

test('startOfWeek : lundi minuit, y compris un week-end', () => {
  assert.equal(startOfWeek(JEUDI).getDate(), 14);
  assert.equal(startOfWeek(JEUDI).getHours(), 0);
  assert.equal(startOfWeek(new Date(2026, 8, 14, 23, 59)).getDate(), 14, 'lundi');
  assert.equal(startOfWeek(new Date(2026, 8, 20, 12, 0)).getDate(), 14, 'dimanche → lundi précédent');
  assert.equal(startOfWeek(new Date(2026, 8, 19, 12, 0)).getDate(), 14, 'samedi → lundi précédent');
});

test('weekDays : 5 jours ouvrés étiquetés, aujourd’hui repéré', () => {
  const days = weekDays(JEUDI);
  assert.equal(days.length, 5);
  assert.deepEqual(days.map((d) => d.ymd), ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']);
  assert.match(days[0].label, /lun/i);
  assert.equal(days[3].isToday, true);
  assert.equal(days[0].isToday, false);
  assert.ok(days.every((d) => d.date instanceof Date));
});

test('roomHours : 8h à 16h inclus (16 = 16h-17h)', () => {
  assert.deepEqual(roomHours(S), [8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(roomHours({ salle: { heureDebut: 9, heureFin: 11 } }), [9, 10]);
});

test('buildWeekGrid : réservations placées, créneaux passés marqués, les miennes repérées', () => {
  const bookings = [
    { id: 'b1', userId: 'u1', date: '2026-09-17', creneaux: [9, 10], statut: 'en_cours' },
    { id: 'b2', userId: 'u2', date: '2026-09-18', creneaux: [14], statut: 'a_venir' },
    { id: 'b3', userId: 'u2', date: '2026-09-17', creneaux: [15], statut: 'annulee' },
  ];
  const grid = buildWeekGrid({ date: JEUDI, bookings, settings: S, userId: 'u1', now: JEUDI });
  assert.equal(grid.days.length, 5);
  assert.deepEqual(grid.hours, [8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const jeudi = grid.cells['2026-09-17'];
  assert.equal(jeudi[9].booking.id, 'b1');
  assert.equal(jeudi[9].mine, true);
  assert.equal(jeudi[9].free, false);
  assert.equal(grid.cells['2026-09-18'][14].mine, false);
  assert.equal(jeudi[15].booking, null, 'une réservation annulée libère le créneau');
  assert.equal(jeudi[15].free, true);
  assert.equal(grid.cells['2026-09-16'][9].past, true, 'hier');
  assert.equal(jeudi[8].past, true, 'ce matin');
  assert.equal(jeudi[11].past, false);
  assert.equal(jeudi[11].free, true);
});

test('toggleSlot : ajoute, retire, change de jour', () => {
  let sel = toggleSlot({ ymd: null, creneaux: [] }, { ymd: '2026-09-17', heure: 9 });
  assert.deepEqual(sel, { ymd: '2026-09-17', creneaux: [9] });
  sel = toggleSlot(sel, { ymd: '2026-09-17', heure: 10 });
  assert.deepEqual(sel.creneaux, [9, 10]);
  sel = toggleSlot(sel, { ymd: '2026-09-17', heure: 9 });
  assert.deepEqual(sel.creneaux, [10]);
  sel = toggleSlot(sel, { ymd: '2026-09-18', heure: 8 });
  assert.deepEqual(sel, { ymd: '2026-09-18', creneaux: [8] }, 'changer de jour repart de zéro');
  const vide = toggleSlot({ ymd: '2026-09-18', creneaux: [8] }, { ymd: '2026-09-18', heure: 8 });
  assert.deepEqual(vide, { ymd: null, creneaux: [] }, 'plus rien de sélectionné');
});

test('selectionIsValid : vide, non contiguë, conflit, passé, jour ouvré', () => {
  const bookings = [{ id: 'b1', userId: 'u2', date: '2026-09-17', creneaux: [14], statut: 'a_venir' }];
  const ctx = { bookings, settings: S, date: JEUDI };
  assert.deepEqual(selectionIsValid({ ymd: null, creneaux: [] }, ctx), { ok: false, reason: REASONS.CRENEAU_VIDE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [11, 13] }, ctx), { ok: false, reason: REASONS.CRENEAUX_NON_CONTIGUS });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [13, 14] }, ctx), { ok: false, reason: REASONS.CRENEAU_OCCUPE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [8] }, ctx), { ok: false, reason: REASONS.CRENEAU_PASSE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-19', creneaux: [9] }, ctx), { ok: false, reason: REASONS.SALLE_FERMEE });
  assert.deepEqual(selectionIsValid({ ymd: '2026-09-17', creneaux: [11, 12, 13] }, ctx), { ok: true, reason: null });
});

test('weekDays : « aujourd’hui » suit l’horloge, pas la semaine affichée', () => {
  const semaineSuivante = new Date(2026, 8, 21, 9, 0);   // lundi 21 septembre
  // Sans second argument, le repère reste la date passée (compatibilité des libellés).
  assert.equal(weekDays(semaineSuivante).find((d) => d.isToday).ymd, '2026-09-21');
  // Avec l’horloge : aucun jour de la semaine suivante n’est « aujourd’hui ».
  assert.equal(weekDays(semaineSuivante, JEUDI).some((d) => d.isToday), false);
  assert.equal(weekDays(JEUDI, JEUDI).find((d) => d.isToday).ymd, '2026-09-17');
});

test('buildWeekGrid : la semaine affichée ne déplace pas le repère du jour', () => {
  const suivante = buildWeekGrid({ date: new Date(2026, 8, 21), bookings: [], settings: S, userId: null, now: JEUDI });
  assert.equal(suivante.days.some((d) => d.isToday), false);
  const courante = buildWeekGrid({ date: JEUDI, bookings: [], settings: S, userId: null, now: JEUDI });
  assert.equal(courante.days.find((d) => d.isToday).ymd, '2026-09-17');
});

test('weekLabel : mois répété seulement quand la semaine chevauche deux mois', () => {
  assert.equal(weekLabel(JEUDI), '14 – 18 sept.');
  // Lundi 28 septembre → vendredi 2 octobre.
  assert.equal(weekLabel(new Date(2026, 8, 28)), '28 sept. – 2 oct.');
});
