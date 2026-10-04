import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ITEM_STATES, MAINT_STATES, MAINT_TYPES } from '../js/models.js';
import { maintenanceRows, immobilises, reportIssue } from '../js/actions/maintenance.js';
import { eventsTableHtml, immobilisesHtml, maintenanceHtml, interventionFormHtml } from '../js/admin/views/maintenance.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const PEDAGO = 'user_041';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('eventsTableHtml : une ligne par événement, badge de statut, actions selon le statut', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const ev = reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const html = eventsTableHtml({ rows: maintenanceRows(), filtre: 'tous' });
  assert.match(html, /Bague grippée/);
  assert.match(html, new RegExp(`data-start="${ev.id}"`), 'un événement ouvert peut démarrer');
  assert.match(html, new RegExp(`data-close="${ev.id}"`), 'un événement ouvert peut être clos');
  const clos = maintenanceRows().filter((r) => r.event.statut === MAINT_STATES.CLOS);
  assert.ok(clos.length, 'le seed contient des événements clos');
  assert.doesNotMatch(html, new RegExp(`data-close="${clos[0].event.id}"`), 'un événement clos n’a plus d’action');
});

test('eventsTableHtml : le filtre ne garde que le statut demandé', () => {
  const rows = maintenanceRows();
  const html = eventsTableHtml({ rows, filtre: MAINT_STATES.OUVERT });
  const ouverts = rows.filter((r) => r.event.statut === MAINT_STATES.OUVERT);
  const clos = rows.filter((r) => r.event.statut === MAINT_STATES.CLOS);
  assert.ok(ouverts.length && clos.length, 'le seed a des deux');
  assert.match(html, new RegExp(ouverts[0].event.id));
  assert.doesNotMatch(html, new RegExp(clos[0].event.id));
});

test('eventsTableHtml : état vide explicite', () => {
  assert.match(eventsTableHtml({ rows: [], filtre: 'tous' }), /Aucun événement/);
});

test('eventsTableHtml : un signalement sans objet reste lisible', () => {
  const ev = store.maintenance.create({
    itemId: null, bookingId: 'book_0001', type: MAINT_TYPES.SIGNALEMENT, auteurId: PEDAGO,
    date: NOW.toISOString(), statut: MAINT_STATES.OUVERT, description: 'Salle rangée → chaises renversées',
    prestataire: '', cout: 0, loanId: null,
  });
  const html = eventsTableHtml({ rows: maintenanceRows(), filtre: 'tous' });
  assert.match(html, /Salle photo — état des lieux/);
  assert.doesNotMatch(html, /\/materiel\/null/);
  assert.match(html, new RegExp(`data-close="${ev.id}"`));
});

test('immobilisesHtml : objets en maintenance et hors service, avec le nombre à traiter', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  reportIssue({ itemId: item.id, auteurId: PEDAGO, description: 'Bague grippée' });
  const html = immobilisesHtml(immobilises());
  assert.match(html, new RegExp(item.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /1 à traiter/);
  assert.match(html, new RegExp(`/materiel/${item.id}`));
});

test('immobilisesHtml : état vide', () => {
  assert.match(immobilisesHtml([]), /Aucun matériel immobilisé/);
});

test('maintenanceHtml : onglets de statut, compteur et les deux sections', () => {
  const html = maintenanceHtml({ rows: maintenanceRows(), bloques: immobilises(), filtre: MAINT_STATES.OUVERT });
  assert.match(html, /data-filtre="tous"/);
  assert.match(html, /data-filtre="ouvert" class="[^"]*is-active/);
  assert.match(html, /Matériel immobilisé/);
  assert.match(html, /data-action="new-intervention"/);
});

test('interventionFormHtml : type, prestataire, coût, description', () => {
  const item = store.items.list()[0];
  const html = interventionFormHtml(item);
  assert.match(html, new RegExp(item.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /name="type"/);
  assert.match(html, new RegExp(`value="${MAINT_TYPES.EXTERNE}"`));
  assert.match(html, /name="prestataire"/);
  assert.match(html, /name="cout"[^>]*inputmode="decimal"/, 'la virgule décimale française doit pouvoir être saisie');
  assert.match(html, /name="description"/);
});
