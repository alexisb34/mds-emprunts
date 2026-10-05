import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { NAV, isActive, sidebarHtml, topbarHtml, parseAdminSearch } from '../js/admin/layout.js';
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

test('topbarHtml : la valeur de recherche en cours est préservée et échappée', () => {
  const html = topbarHtml({ title: 'x', searchValue: 'ro"nin' });
  assert.match(html, /value="ro&quot;nin"/);
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

test('parseAdminSearch : distingue un code de retrait d’une recherche de matériel', () => {
  assert.deepEqual(parseAdminSearch('AB23CD'), { type: 'code_possible', code: 'AB23CD' });
  assert.deepEqual(parseAdminSearch('  ab23cd '), { type: 'code_possible', code: 'AB23CD' });
  assert.deepEqual(parseAdminSearch('LOAN-loan_0007-AB12CD'), { type: 'code', code: 'LOAN-loan_0007-AB12CD' });
  assert.deepEqual(parseAdminSearch('canon'), { type: 'texte', texte: 'canon' });
  assert.deepEqual(parseAdminSearch('Canon R10'), { type: 'texte', texte: 'Canon R10' });
  assert.deepEqual(parseAdminSearch(''), { type: 'texte', texte: '' });
});

test('parseAdminSearch : un code sans chiffre reste un code possible, l’alphabet des codes tranche', () => {
  // 17 % des codes émis n’ont aucun chiffre : exiger un chiffre en perdrait un sur six.
  assert.deepEqual(parseAdminSearch('ZKMNPQ'), { type: 'code_possible', code: 'ZKMNPQ' });
  // Un mot de six lettres de l’alphabet est un candidat : c’est le store qui décidera.
  assert.deepEqual(parseAdminSearch('camera'), { type: 'code_possible', code: 'CAMERA' });
  // I, L, O, 0 et 1 ne figurent jamais dans un code émis : recherche de matériel.
  for (const t of ['trepie', 'ABCDEI', 'ABCDEL', 'ABCDEO', 'ABCDE0', 'ABCDE1', 'ab12c', 'AB12CDE']) {
    assert.deepEqual(parseAdminSearch(t), { type: 'texte', texte: t }, t);
  }
});

test('parseAdminSearch : le préfixe LOAN- est exigé en majuscules, la casse du reste est conservée', () => {
  assert.deepEqual(parseAdminSearch(' LOAN-Loan_0007-AB12CD '), { type: 'code', code: 'LOAN-Loan_0007-AB12CD' });
  assert.deepEqual(parseAdminSearch('loan-loan_0007-ab12cd'), { type: 'texte', texte: 'loan-loan_0007-ab12cd' });
});
