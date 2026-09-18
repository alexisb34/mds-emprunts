import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { NAV, isActive, sidebarHtml, topbarHtml } from '../js/admin/layout.js';
import { loginHtml } from '../js/admin/views/login.js';
import { aVenirHtml } from '../js/admin/views/aVenir.js';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('NAV : 7 entrées dans l’ordre du spec', () => {
  assert.deepEqual(NAV.map((n) => n.path), ['/dashboard', '/materiel', '/emprunts', '/salle', '/maintenance', '/utilisateurs', '/parametres']);
});

test('isActive : exact ou sous-route', () => {
  assert.equal(isActive('/materiel', '/materiel'), true);
  assert.equal(isActive('/materiel', '/materiel/item_001'), true);
  assert.equal(isActive('/materiel', '/materiels'), false);
  assert.equal(isActive('/dashboard', '/materiel'), false);
});

test('sidebarHtml : entrée active, compteurs, pied avec utilisateur', () => {
  const user = { prenom: 'Alexis', nom: 'Bengel <b>', role: 'pedago' };
  const html = sidebarHtml({ currentPath: '/materiel/item_001', counts: { emprunts: 10, maintenance: 0 }, user });
  assert.match(html, /nav-item nav-item--active" href="#\/materiel"/);
  assert.doesNotMatch(html, /nav-item--active" href="#\/dashboard"/);
  assert.match(html, /Emprunts<span class="nav-item__count">10<\/span>/);
  assert.doesNotMatch(html, /Maintenance<span class="nav-item__count">/);
  assert.match(html, /Bengel &lt;b&gt;/);
  assert.match(html, /Pédagogie/);
  assert.match(html, /data-action="logout"/);
});

test('sidebarHtml sans utilisateur : pas de pied', () => {
  const html = sidebarHtml({ currentPath: '/login', counts: {}, user: null });
  assert.doesNotMatch(html, /sidebar__footer/);
});

test('topbarHtml : titre, sous-titre, action optionnelle, recherche', () => {
  const withAction = topbarHtml({ title: 'Matériel', subtitle: '44 exemplaires', action: { label: '+ Ajouter' } });
  assert.match(withAction, /<h1>Matériel<\/h1>/);
  assert.match(withAction, /<p>44 exemplaires<\/p>/);
  assert.match(withAction, /data-action="primary">\+ Ajouter</);
  assert.match(withAction, /data-role="global-search"/);
  const without = topbarHtml({ title: 'Tableau de bord' });
  assert.doesNotMatch(without, /data-action="primary"/);
  assert.doesNotMatch(without, /<p>/);
});

test('loginHtml : un bouton par pédago actif, emails affichés', () => {
  const pedagos = store.users.list((u) => u.role === 'pedago');
  const html = loginHtml(pedagos);
  assert.equal((html.match(/data-user="user_0/g) || []).length, 5);
  assert.match(html, /alexis\.bengel@mds-demo\.fr/);
  assert.match(html, /Qui êtes-vous/);
});

test('aVenirHtml : mentionne la phase', () => {
  assert.match(aVenirHtml('Emprunts', 3), /Emprunts/);
  assert.match(aVenirHtml('Emprunts', 3), /phase 3/);
});
