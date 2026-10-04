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
  assert.match(html, /Retrait .* à \d\dh\d\d/);
  assert.match(html, /badge--reserved">Réservé/);
  const hist = empruntsHtml({ tab: 'historique', data: userLoans('user_006', NOW), date: NOW }); // user_006 a rendu la souris #3
  assert.match(hist, /badge--available">Retourné/);
  const empty = empruntsHtml({ tab: 'reservations', data: userLoans('user_006', NOW), date: NOW });
  assert.match(empty, /Aucune réservation/);
});

import { reservationCardHtml } from '../js/mobile/views/emprunts.js';
import { pickupWindow } from '../js/rules.js';

test('reservationCardHtml : avant la fenêtre, pendant (QR + code), après', () => {
  const loan = { id: 'loan_x', debutPrevu: new Date(2026, 8, 18, 9, 0).toISOString(), finPrevue: new Date(2026, 8, 19, 17, 0).toISOString(), codeRetrait: 'AB12CD', statut: 'reservee' };
  const item = { nom: 'Canon R10', code: 'MDS-0029', reference: 'canon-r10' };
  const window = pickupWindow(loan, 60);

  const avant = reservationCardHtml({ loan, item, pickupOpen: false, expired: false, window }, NOW);
  assert.match(avant, /Canon R10/);
  assert.match(avant, /Retrait demain à 09h00/);
  assert.doesNotMatch(avant, /data-role="qr"/);
  assert.match(avant, /data-action="cancel" data-loan="loan_x"/);

  const pendant = reservationCardHtml({ loan, item, pickupOpen: true, expired: false, window }, new Date(2026, 8, 18, 9, 20));
  assert.match(pendant, /data-role="qr" data-code="LOAN-loan_x-AB12CD"/);
  assert.match(pendant, /AB12CD/);
  assert.match(pendant, /avant 10h00/);
  assert.match(pendant, /Montrez ce code à la pédago/);

  const apres = reservationCardHtml({ loan, item, pickupOpen: false, expired: true, window }, new Date(2026, 8, 18, 11, 0));
  assert.match(apres, /Réservation expirée/);
  assert.doesNotMatch(apres, /data-role="qr"/);
  assert.doesNotMatch(apres, /data-action="cancel"/);
});

test('empruntsHtml : l’onglet Réservations affiche les cartes de retrait', () => {
  const res = store.loans.list((l) => l.statut === 'reservee')[0];
  const data = userLoans(res.userId, NOW);
  const html = empruntsHtml({ tab: 'reservations', data, date: NOW });
  assert.match(html, /data-action="cancel"/);
  assert.doesNotMatch(html, /Le QR de retrait s’affichera ici/);
});

test('empruntsHtml : l’historique affiche le motif d’un refus, échappé', () => {
  const loan = { id: 'loan_r', itemId: 'inconnu', statut: 'refusee', debutPrevu: NOW.toISOString(), finPrevue: NOW.toISOString(), motifRefus: 'Réservé pour un <cours>' };
  const data = { enCours: [], reservations: [], historique: [{ loan, item: { nom: 'Canon R10' } }] };
  const html = empruntsHtml({ tab: 'historique', data, date: NOW });
  assert.match(html, /Motif : Réservé pour un &lt;cours&gt;/);
  assert.match(html, /badge--hs">Refusé/);
});
