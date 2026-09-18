import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userStats, userHistory } from '../js/actions/users.js';
import { filterUsers, withStats, USER_COLUMNS, utilisateursHtml, userFormHtml } from '../js/admin/views/utilisateurs.js';
import { userFicheHtml } from '../js/admin/views/utilisateurFiche.js';
import { sortRows } from '../js/admin/table.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('filterUsers : recherche, rôle, promo, actifs', () => {
  const users = store.users.list();
  assert.equal(filterUsers(users, {}).length, 45);
  assert.equal(filterUsers(users, { q: 'pezz' }).length, 1);
  assert.equal(filterUsers(users, { q: 'mds-demo' }).length, 45);
  assert.equal(filterUsers(users, { role: 'intervenant' }).length, 10);
  assert.equal(filterUsers(users, { promo: 'MBA 2 UX/UI' }).length, 4);
  store.users.update('user_001', { actif: false });
  assert.equal(filterUsers(store.users.list(), { actifs: true }).length, 44);
  assert.equal(filterUsers(store.users.list(), { actifs: false }).length, 45);
});

test('withStats et USER_COLUMNS', () => {
  const rows = withStats(store.users.list(), NOW);
  const late = rows.find((r) => r.stats.retards > 0);
  assert.ok(late);
  assert.deepEqual(USER_COLUMNS.map((c) => c.key), ['nom', 'role', 'promo', 'email', 'enCours', 'retards', 'actif']);
  assert.match(USER_COLUMNS[0].render(late), /avatar/);
  assert.match(USER_COLUMNS[5].render(late), /badge--late">1</);
  assert.match(USER_COLUMNS[5].render({ stats: { retards: 0 } }), /^0$/);
  assert.match(USER_COLUMNS[6].render({ actif: false }), /Désactivé/);
  const sorted = sortRows(rows, { key: 'retards', dir: 'desc' }, USER_COLUMNS);
  assert.ok(sorted[0].stats.retards >= sorted[1].stats.retards);
});

test('utilisateursHtml : compteur, filtres, table', () => {
  const filters = { q: '', role: 'pedago', promo: '', actifs: true };
  const rows = sortRows(withStats(filterUsers(store.users.list(), filters), NOW), { key: 'nom', dir: 'asc' }, USER_COLUMNS);
  const html = utilisateursHtml({ rows, total: 45, filters, sort: { key: 'nom', dir: 'asc' } });
  assert.match(html, /5 résultats/);
  assert.match(html, /<option value="pedago" selected>Pédagogie/);
  assert.match(html, /Alexis Bengel/);
  assert.match(html, /name="actifs"[^>]*checked/);
});

test('userFormHtml : champs, promo pré-sélectionnée', () => {
  const html = userFormHtml({ prenom: 'Léa', nom: 'Pezzetti', email: 'lea@x.fr', role: 'eleve', promo: 'MBA 2 DEV' });
  for (const name of ['prenom', 'nom', 'email', 'role', 'promo']) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /<option value="eleve" selected>/);
  assert.match(html, /<option value="MBA 2 DEV" selected>/);
  assert.match(userFormHtml(), /<option value="eleve" selected>/);
});

test('userFicheHtml : identité, statistiques, historique, bouton d’activation', () => {
  const booking = store.bookings.list()[0];
  const user = store.users.get(booking.userId);
  const html = userFicheHtml({ user, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW });
  assert.match(html, new RegExp(`${user.prenom} ${user.nom}`));
  assert.match(html, /stat__label">Retards/);
  assert.match(html, /Réservations de la salle photo/);
  assert.match(html, new RegExp(`${booking.creneaux[0]}h-${booking.creneaux.at(-1) + 1}h`));
  assert.match(html, /data-action="toggle-active">Désactiver le compte/);
  const inactive = userFicheHtml({ user: { ...user, actif: false }, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW });
  assert.match(inactive, /data-action="toggle-active">Réactiver le compte/);
  assert.match(inactive, /badge--hs">Désactivé/);
});

test('userFicheHtml : isSelf désactive le bouton d’activation', () => {
  const user = store.users.get('user_001');
  const html = userFicheHtml({ user, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW, isSelf: true });
  assert.match(html, /data-action="toggle-active" disabled title="Vous ne pouvez pas désactiver votre propre compte\."/);
  const other = userFicheHtml({ user, stats: userStats(user.id, NOW), history: userHistory(user.id), items: store.items.list(), date: NOW });
  assert.doesNotMatch(other, /disabled/);
});
