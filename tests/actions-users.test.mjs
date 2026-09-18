import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS } from '../js/log.js';
import { validateUser, createUser, updateUser, setUserActive, userStats, userHistory } from '../js/actions/users.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';
const valid = { prenom: 'Nina', nom: 'Costa', email: 'Nina.Costa@mds-demo.fr', role: 'eleve', promo: 'Bachelor 2' };

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
});

test('validateUser : champs, email, rôle, promo, unicité', () => {
  assert.deepEqual(validateUser(valid), []);
  const errors = validateUser({ prenom: '', nom: ' ', email: 'pas-un-email', role: 'x', promo: null });
  assert.equal(errors.length, 4);
  assert.match(validateUser({ ...valid, promo: 'Inconnue' }).join(' '), /promo est obligatoire/);
  assert.deepEqual(validateUser({ ...valid, role: 'intervenant', promo: null }), []);
  assert.match(validateUser({ ...valid, email: 'lea.pezzetti@MDS-demo.fr' }).join(' '), /déjà utilisé/);
  assert.deepEqual(validateUser({ ...valid, email: 'lea.pezzetti@mds-demo.fr' }, 'user_001'), []);
});

test('createUser : actif, email normalisé, journal', () => {
  const u = createUser(valid, PEDAGO);
  assert.equal(u.actif, true);
  assert.equal(u.email, 'nina.costa@mds-demo.fr');
  assert.equal(u.promo, 'Bachelor 2');
  const entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.USER_CREE);
  assert.equal(entry.userId, u.id);
  assert.match(entry.detail, /Nina Costa \(Élève\)/);
  assert.throws(() => createUser({ ...valid, email: 'nina.costa@mds-demo.fr' }, PEDAGO), /déjà utilisé/);
});

test('createUser : un intervenant n’a pas de promo', () => {
  const u = createUser({ ...valid, email: 'i@mds-demo.fr', role: 'intervenant', promo: 'Bachelor 2' }, PEDAGO);
  assert.equal(u.promo, null);
});

test('updateUser : champs protégés ignorés, changement de rôle efface la promo', () => {
  const up = updateUser('user_001', { role: 'intervenant', actif: false, id: 'x' }, PEDAGO);
  assert.equal(up.role, 'intervenant');
  assert.equal(up.promo, null);
  assert.equal(up.actif, true);
  assert.equal(up.id, 'user_001');
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_MODIFIE);
  assert.throws(() => updateUser('user_002', { email: 'lea.pezzetti@mds-demo.fr' }, PEDAGO), /déjà utilisé/);
  assert.throws(() => updateUser('nope', { nom: 'x' }, PEDAGO), /introuvable/);
});

test('setUserActive : désactivation journalisée, idempotente', () => {
  const before = store.log.list().length;
  const u = setUserActive('user_002', false, PEDAGO);
  assert.equal(u.actif, false);
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_DESACTIVE);
  setUserActive('user_002', false, PEDAGO);
  assert.equal(store.log.list().length, before + 1);
  const re = setUserActive('user_002', true, PEDAGO);
  assert.equal(re.actif, true);
  assert.equal(store.log.list().at(-1).action, ACTIONS.USER_MODIFIE);
  assert.match(store.log.list().at(-1).detail, /réactivé/);
});

test('userStats : retards et emprunts en cours', () => {
  const lateLoan = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  const s = userStats(lateLoan.userId, NOW);
  assert.equal(s.retards, 1);
  assert.ok(s.enCours >= 1);
  assert.ok(s.total >= s.enCours);
  const none = userStats('user_045', NOW);
  assert.deepEqual(none, { enCours: 0, retards: 0, reservations: 0, total: 0 });
});

test('userHistory : emprunts, réservations salle et journal', () => {
  const b = store.bookings.list()[0];
  const h = userHistory(b.userId);
  assert.ok(h.bookings.some((x) => x.id === b.id));
  assert.ok(h.loans.every((l) => l.userId === b.userId));
  assert.ok(h.log.every((e) => e.userId === b.userId || e.auteurId === b.userId));
});
