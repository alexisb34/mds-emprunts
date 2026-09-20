import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { userLoans } from '../js/actions/loans.js';
import { TABS_EMPRUNTS, empruntsHtml } from '../js/mobile/views/emprunts.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('TABS_EMPRUNTS', () => {
  assert.deepEqual(TABS_EMPRUNTS.map((t) => t.key), ['enCours', 'reservations', 'historique']);
});

test('empruntsHtml : onglets avec compteurs, en cours avec photo et retard, aide au retour', () => {
  const late = store.loans.list((l) => l.statut === 'en_cours' && new Date(l.finPrevue) < NOW)[0];
  store.loans.update(late.id, { photoEmprunt: 'data:image/jpeg;base64,AAAA' });
  const data = userLoans(late.userId, NOW);
  const html = empruntsHtml({ tab: 'enCours', data, date: NOW });
  assert.match(html, /tab tab--active" data-tab="enCours">En cours <span class="tab__count">1<\/span>/);
  assert.match(html, /data-tab="historique">Historique <span class="tab__count">\d+</);
  assert.match(html, /badge--late">En retard/);
  assert.match(html, /<img class="thumb-lg" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /scannez son étiquette/);
});

test('empruntsHtml : réservations et historique', () => {
  const res = store.loans.list((l) => l.statut === 'reservee')[0];
  const html = empruntsHtml({ tab: 'reservations', data: userLoans(res.userId, NOW), date: NOW });
  assert.match(html, /Retrait prévu/);
  assert.match(html, /badge--reserved">Réservé/);
  const hist = empruntsHtml({ tab: 'historique', data: userLoans('user_006', NOW), date: NOW }); // user_006 a rendu la souris #3
  assert.match(hist, /badge--available">Retourné/);
  const empty = empruntsHtml({ tab: 'reservations', data: userLoans('user_006', NOW), date: NOW });
  assert.match(empty, /Aucune réservation/);
});
