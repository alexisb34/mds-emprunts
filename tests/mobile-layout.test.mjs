import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { TABS, isActive, bottomNavHtml, headerHtml } from '../js/mobile/layout.js';
import { groupUsersByRole, loginHtml } from '../js/mobile/views/login.js';
import { profilHtml } from '../js/mobile/views/profil.js';
import { aVenirHtml } from '../js/mobile/views/aVenir.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('TABS : 4 onglets, le scanner est un bouton à part', () => {
  assert.deepEqual(TABS.map((t) => t.path), ['/accueil', '/catalogue', '/salle', '/emprunts']);
});

test('isActive : exact ou sous-route', () => {
  assert.equal(isActive('/catalogue', '/catalogue/multiprise'), true);
  assert.equal(isActive('/catalogue', '/catalogues'), false);
});

test('bottomNavHtml : onglet actif, bouton scan central, libellés', () => {
  const html = bottomNavHtml('/catalogue/multiprise');
  assert.match(html, /m-nav__tab m-nav__tab--active" href="#\/catalogue"/);
  assert.doesNotMatch(html, /m-nav__tab--active" href="#\/accueil"/);
  assert.match(html, /class="m-nav__scan" href="#\/scan" aria-label="Scanner un QR code"/);
  for (const label of ['Accueil', 'Catalogue', 'Salle', 'Emprunts']) assert.match(html, new RegExp(`>${label}<`));
  assert.equal((html.match(/<svg/g) || []).length, 5);
});

test('headerHtml : titre, lien retour optionnel, avatar vers le profil', () => {
  const user = { prenom: 'Léa', nom: 'Pezzetti <b>' };
  const html = headerHtml({ title: 'Catalogue', user });
  assert.match(html, /<h1 class="m-header__title">Catalogue<\/h1>/);
  assert.match(html, /href="#\/profil"/);
  assert.match(html, /LP/);
  assert.doesNotMatch(html, /m-header__back/);
  const withBack = headerHtml({ title: 'Multiprise', user, back: '/catalogue' });
  assert.match(withBack, /class="m-header__back" href="#\/catalogue" aria-label="Retour"/);
  const noUser = headerHtml({ title: 'Connexion', user: null });
  assert.doesNotMatch(noUser, /href="#\/profil"/);
});

test('groupUsersByRole et loginHtml : groupes, filtre, comptes inactifs exclus', () => {
  store.users.update('user_001', { actif: false });
  const groups = groupUsersByRole(store.users.list());
  assert.deepEqual(groups.map((g) => g.role), ['eleve', 'intervenant', 'pedago']);
  assert.equal(groups[0].users.length, 29);
  assert.equal(groups[1].users.length, 10);
  const html = loginHtml(groups, '');
  assert.match(html, /Élèves \(29\)/);
  assert.match(html, /Intervenants \(10\)/);
  assert.equal((html.match(/data-user="/g) || []).length, 44);
  const filtered = loginHtml(groupUsersByRole(store.users.list(), 'guih'), 'guih');
  assert.equal((filtered.match(/data-user="/g) || []).length, 1);
  assert.match(filtered, /Yann Guihard/);
  assert.match(filtered, /value="guih"/);
  assert.match(html, /data-role="results"/);
  assert.match(loginHtml([], 'zzz'), /data-role="results"[^>]*>\s*<div class="empty-state">/);
});

test('profilHtml : identité, promo, actions', () => {
  const html = profilHtml(store.users.get('user_001'));
  assert.match(html, /Léa Pezzetti/);
  assert.match(html, /MBA 2 UX\/UI/);
  assert.match(html, /badge--reserved">Élève/);
  assert.match(html, /data-action="switch-user"/);
  assert.match(html, /data-action="logout"/);
  const inter = profilHtml(store.users.get('user_031'));
  assert.doesNotMatch(inter, /Promo/);
});

test('aVenirHtml mentionne la phase', () => {
  assert.match(aVenirHtml('Salle photo', 4), /phase 4/);
});
