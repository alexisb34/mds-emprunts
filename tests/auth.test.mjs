import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { auth, SESSION_KEY } from '../js/auth.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('aucun utilisateur par défaut', () => {
  assert.equal(auth.currentUserId(), null);
  assert.equal(auth.currentUser(), null);
  assert.equal(auth.isPedago(), false);
});

test('login stocke l’id en sessionStorage et renvoie l’utilisateur', () => {
  const u = auth.login('user_041');
  assert.equal(u.role, 'pedago');
  assert.equal(sessionStorage.getItem(SESSION_KEY), 'user_041');
  assert.equal(auth.currentUser().id, 'user_041');
  assert.equal(auth.isPedago(), true);
});

test('login refuse un inconnu ou un compte désactivé', () => {
  assert.throws(() => auth.login('nope'), /introuvable/);
  store.users.update('user_001', { actif: false });
  assert.throws(() => auth.login('user_001'), /désactivé/);
});

test('logout efface la session', () => {
  auth.login('user_001');
  auth.logout();
  assert.equal(auth.currentUser(), null);
});
