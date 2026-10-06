import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed, CATALOG } from '../js/seed.js';
import { PROMOS, ROLES, ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES } from '../js/models.js';
import { DEFAULT_SETTINGS, isLate, isWeekday, slotsAreContiguous, slotsInRoomHours, fromYmd } from '../js/rules.js';
import { CHECKLISTS } from '../js/checklists.js';

const NOW = new Date(2026, 8, 17, 10, 0); // jeudi
const db = buildSeed(NOW);

test('45 utilisateurs : 30 élèves, 10 intervenants, 5 pédago, emails uniques', () => {
  assert.equal(db.users.length, 45);
  const by = (r) => db.users.filter((u) => u.role === r);
  assert.equal(by(ROLES.ELEVE).length, 30);
  assert.equal(by(ROLES.INTERVENANT).length, 10);
  assert.equal(by(ROLES.PEDAGO).length, 5);
  for (const u of by(ROLES.ELEVE)) assert.ok(PROMOS.includes(u.promo), u.promo);
  for (const u of [...by(ROLES.INTERVENANT), ...by(ROLES.PEDAGO)]) assert.equal(u.promo, null);
  assert.equal(new Set(db.users.map((u) => u.email)).size, 45);
  assert.ok(db.users.every((u) => u.actif === true && u.createdAt && u.updatedAt));
});

test('inventaire complet : 44 exemplaires, codes uniques, chaque référence a une checklist', () => {
  const expected = CATALOG.reduce((n, c) => n + c[4], 0);
  assert.equal(expected, 44);
  assert.equal(db.items.length, 44);
  assert.equal(new Set(db.items.map((i) => i.code)).size, 44);
  assert.equal(db.items[0].code, 'MDS-0001');
  for (const i of db.items) assert.ok(CHECKLISTS[i.reference], i.reference);
  assert.equal(db.items.filter((i) => i.circuit === 'self').length, 23);
  assert.equal(db.items.filter((i) => i.circuit === 'salle').length, 5);
  assert.equal(db.items.filter((i) => i.circuit === 'valeur').length, 16);
});

test('cohérence emprunts ↔ états du matériel', () => {
  const item = (id) => db.items.find((i) => i.id === id);
  for (const l of db.loans) {
    if (l.statut === LOAN_STATES.EN_COURS) assert.equal(item(l.itemId).etat, ITEM_STATES.EMPRUNTE, l.id);
    if (l.statut === LOAN_STATES.RESERVEE) assert.equal(item(l.itemId).etat, ITEM_STATES.RESERVE, l.id);
    assert.ok(db.users.some((u) => u.id === l.userId), `userId ${l.userId}`);
  }
  const active = db.loans.filter((l) => [LOAN_STATES.EN_COURS, LOAN_STATES.RESERVEE].includes(l.statut));
  assert.equal(new Set(active.map((l) => l.itemId)).size, active.length, 'un seul emprunt actif par objet');
  for (const i of db.items.filter((i) => i.etat === ITEM_STATES.EMPRUNTE)) {
    assert.equal(active.filter((l) => l.itemId === i.id && l.statut === LOAN_STATES.EN_COURS).length, 1, i.code);
  }
});

test('volumes : ~40 retournés, 8 en cours dont 2 en retard, 2 réservés', () => {
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.RETOURNEE).length, 41); // 40 générés + 1 retour avec problème
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length, 10);  // 6 self + 2 valeur + 2 en retard
  assert.equal(db.loans.filter((l) => isLate(l, NOW)).length, 2);
  assert.equal(db.loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).length, 2);
  assert.ok(db.loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).every((l) => l.codeRetrait?.length === 6));
});

test('maintenance : 1 objet en maintenance avec signalement ouvert, 1 HS, 1 intervention externe close', () => {
  const enMaint = db.items.filter((i) => i.etat === ITEM_STATES.MAINTENANCE);
  assert.equal(enMaint.length, 1);
  assert.ok(db.maintenance.some((m) => m.itemId === enMaint[0].id && m.statut === MAINT_STATES.OUVERT));
  assert.equal(db.items.filter((i) => i.etat === ITEM_STATES.HS).length, 1);
  assert.ok(db.maintenance.some((m) => m.type === 'intervention_externe' && m.statut === MAINT_STATES.CLOS && m.prestataire));
});

test('réservations salle : jours ouvrés, créneaux contigus dans la plage, une en cours à 10h le jeudi', () => {
  assert.ok(db.bookings.length >= 5);
  for (const b of db.bookings) {
    assert.ok(isWeekday(fromYmd(b.date)), b.date);
    assert.ok(slotsAreContiguous(b.creneaux), b.id);
    assert.ok(slotsInRoomHours(b.creneaux, DEFAULT_SETTINGS.salle), b.id);
    assert.ok(db.users.some((u) => u.id === b.userId));
  }
  const enCours = db.bookings.filter((b) => b.statut === BOOKING_STATES.EN_COURS);
  assert.equal(enCours.length, 1);
  assert.equal(enCours[0].date, '2026-09-17');
  assert.ok(enCours[0].creneaux.includes(10));
  assert.ok(enCours[0].etatEntree);
  assert.equal(enCours[0].etatSortie, null);
  assert.equal(db.bookings.filter((b) => b.statut === BOOKING_STATES.TERMINEE).length, 2);
  assert.equal(db.bookings.filter((b) => b.statut === BOOKING_STATES.A_VENIR).length, 3);
});

test('journal non vide, entrées datées et référencées ; settings = défauts', () => {
  assert.ok(db.log.length > 80);
  for (const e of db.log) {
    assert.ok(e.date && e.action && e.auteurId, e.id);
    assert.ok(e.itemId || e.loanId || e.bookingId || e.userId, `${e.id} sans référence`);
  }
  assert.deepEqual(db.settings, DEFAULT_SETTINGS);
});

test('buildSeed est déterministe pour un même now', () => {
  assert.equal(JSON.stringify(buildSeed(NOW)), JSON.stringify(db));
});

test('aucun emprunt « en cours » ni état des lieux d’entrée n’est daté dans le futur', () => {
  for (const l of db.loans.filter((l) => l.statut === LOAN_STATES.EN_COURS)) {
    assert.ok(new Date(l.dateRetrait).getTime() <= NOW.getTime(), l.id);
  }
  const enCours = db.bookings.find((b) => b.statut === BOOKING_STATES.EN_COURS);
  if (enCours) assert.ok(new Date(enCours.etatEntree.date).getTime() <= NOW.getTime());
});

test('buildSeed(lundi 8h00) : aucun dateRetrait futur, seed déterministe', () => {
  const lundi8h = new Date(2026, 8, 21, 8, 0);
  const seedLundi = buildSeed(lundi8h);
  for (const l of seedLundi.loans.filter((l) => l.statut === LOAN_STATES.EN_COURS)) {
    assert.ok(new Date(l.dateRetrait).getTime() <= lundi8h.getTime(), l.id);
  }
  assert.equal(JSON.stringify(buildSeed(lundi8h)), JSON.stringify(seedLundi));
});

test('aucune entrée de journal n’est postérieure à « maintenant », quelle que soit l’heure', () => {
  // Le tableau de bord ouvre sur « Dernières activités » : une entrée future s’y affiche
  // en tête et donne l’impression d’un jeu de données incohérent.
  // On balaie une semaine entière heure par heure : trois horaires choisis avaient laissé
  // passer une plage complète (avant 8h30, les réservations à venir étaient postdatées).
  const fautifs = [];
  for (let jour = 1; jour <= 7; jour += 1) {
    for (let heure = 0; heure < 24; heure += 1) {
      const quand = new Date(2026, 9, jour, heure, 10);
      const futures = buildSeed(quand).log.filter((l) => new Date(l.date) > quand);
      if (futures.length) fautifs.push(`${quand.toISOString()} → ${futures[0].date} ${futures[0].action}`);
    }
  }
  assert.deepEqual(fautifs, []);
});

test('à 8h00 un lundi, les entrées bornées ne s’empilent pas : au moins quatre minutes entre deux', () => {
  // Avant 8h30, les horodatages du matin tombent dans le futur et sont ramenés à
  // « maintenant » moins un écart ; des écarts d’une minute donnaient cinq entrées collées.
  const lundi8h = new Date(2026, 8, 21, 8, 0);
  const recentes = buildSeed(lundi8h).log
    .map((l) => new Date(l.date).getTime())
    .filter((t) => t > lundi8h.getTime() - 2 * 60 * 60 * 1000)
    .sort((a, b) => a - b);
  assert.ok(recentes.length >= 10, 'le journal du matin n’est pas vide');
  for (let i = 1; i < recentes.length; i += 1) {
    assert.ok(recentes[i] - recentes[i - 1] >= 4 * 60 * 1000, `entrées ${i - 1} et ${i} à moins de quatre minutes`);
  }
});

test('les repères que citent les documents de démonstration existent dans le jeu', () => {
  // `docs/scenarios-demo.md` et `docs/notice-testeurs.md` nomment des comptes et des codes.
  // Sans ce test, réordonner CATALOG ou renommer un compte les rendrait faux en silence.
  const nom = (u) => `${u.prenom} ${u.nom}`;
  const parNom = (n) => db.users.find((u) => nom(u) === n);
  assert.equal(parNom('Camille Dubois')?.role, ROLES.ELEVE);
  assert.equal(parNom('Sophie Marchand')?.role, ROLES.INTERVENANT);
  assert.equal(parNom('Alexis Bengel')?.role, ROLES.PEDAGO);
  const parCode = (c) => db.items.find((i) => i.code === c);
  assert.equal(parCode('MDS-0003')?.nom, 'Multiprise #3');
  assert.equal(parCode('MDS-0004')?.nom, 'Multiprise #4');
  assert.equal(parCode('MDS-0042')?.nom, 'Filtre variable Hoya');
  // Les codes doivent rester stables d’une génération à l’autre : les étiquettes imprimées
  // le supposent, et la consigne d’impression le dit.
  const autre = buildSeed(new Date(2026, 11, 1, 14, 0));
  assert.equal(autre.items.find((i) => i.code === 'MDS-0003')?.nom, 'Multiprise #3');
});
