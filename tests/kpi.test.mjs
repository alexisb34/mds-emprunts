import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, joinLoan, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('computeKpis sur le seed du jeudi 10h', () => {
  assert.deepEqual(computeKpis(db, NOW), {
    disponibles: 30, enCours: 10, retards: 2, reservationsSalle: 3, signalements: 1, aRemettre: 0,
  });
});

test('aRemettre compte les réservations dont le retrait est prévu le jour donné', () => {
  const first = db.loans.find((l) => l.statut === 'reservee');
  const day = new Date(first.debutPrevu);
  assert.equal(computeKpis(db, day).aRemettre, 1);
  assert.equal(dueTodayReservations(db, day).length, 1);
  assert.equal(dueTodayReservations(db, day)[0].user.id, first.userId);
});

test('lateLoans : jointure, jours de retard, tri décroissant', () => {
  const late = lateLoans(db, NOW);
  assert.equal(late.length, 2);
  assert.equal(late[0].item.reference, 'dji-rsc2');
  assert.equal(late[0].joursRetard, 3);
  assert.equal(late[1].item.reference, 'casque-audio');
  assert.equal(late[1].joursRetard, 1);
  assert.ok(late.every((x) => x.user && x.user.id === x.loan.userId));
});

test('joinLoan tolère un objet ou un utilisateur manquant', () => {
  const j = joinLoan({ itemId: 'nope', userId: 'nope' }, db.items, db.users);
  assert.equal(j.item, null);
  assert.equal(j.user, null);
});

test('openReports : signalements ouverts joints', () => {
  const r = openReports(db);
  assert.equal(r.length, 1);
  assert.equal(r[0].item.reference, 'souris');
  assert.ok(r[0].auteur);
  assert.match(r[0].event.description, /Clic gauche/);
});
