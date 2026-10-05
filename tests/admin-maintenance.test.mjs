import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ITEM_STATES, MAINT_STATES, MAINT_TYPES } from '../js/models.js';
import { maintenanceRows, immobilises, reportIssue } from '../js/actions/maintenance.js';
import {
  eventsTableHtml, immobilisesHtml, maintenanceHtml, interventionFormHtml, readInterventionForm, signalementFormHtml, readSignalementForm,
} from '../js/admin/views/maintenance.js';

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

test('eventsTableHtml : le coût s’affiche avec la virgule décimale, et rien quand il est nul', () => {
  const item = store.items.list((i) => i.etat === ITEM_STATES.DISPONIBLE)[0];
  const base = { itemId: item.id, type: MAINT_TYPES.EXTERNE, auteurId: PEDAGO, date: NOW.toISOString(), statut: MAINT_STATES.EN_COURS, prestataire: 'Objectif Service', loanId: null };
  store.maintenance.create({ ...base, description: 'Avec coût', cout: 120.5 });
  const avec = eventsTableHtml({ rows: maintenanceRows(), filtre: MAINT_STATES.EN_COURS });
  assert.match(avec, /120,50/);
  assert.doesNotMatch(avec, /120\.5/);
  assert.match(avec, /€/);

  store.maintenance.list().forEach((m) => store.maintenance.update(m.id, { cout: 0 }));
  const sans = eventsTableHtml({ rows: maintenanceRows(), filtre: 'tous' });
  assert.doesNotMatch(sans, /€/, 'un coût nul n’affiche rien');
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
  const onglet = (cle) => html.match(new RegExp(`<button[^>]*data-filtre="${cle}"[^>]*>[\\s\\S]*?</button>`))[0];
  assert.match(onglet('ouvert'), /is-active/);
  assert.doesNotMatch(onglet('tous'), /is-active/);
  const rows = maintenanceRows();
  const compte = (cle) => Number(onglet(cle).match(/tab__count">(\d+)</)[1]);
  assert.equal(compte('clos'), rows.filter((r) => r.event.statut === MAINT_STATES.CLOS).length);
  assert.equal(compte('ouvert'), rows.filter((r) => r.event.statut === MAINT_STATES.OUVERT).length);
  assert.equal(compte('tous'), rows.length);
  assert.notEqual(compte('clos'), compte('ouvert'), 'les compteurs ne sont pas tous égaux');
  assert.match(html, /Matériel immobilisé/);
  assert.match(html, /data-action="new-intervention"/);
  assert.match(html, /data-action="new-signalement"[^>]*>Signaler une panne</, 'spec §5.4 : un signalement peut être créé à la main');
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

test('interventionFormHtml : sans objet imposé, une option par matériel', () => {
  const items = store.items.list().slice(0, 3);
  const html = interventionFormHtml(null, items);
  assert.match(html, /<select class="select" name="itemId">/);
  assert.doesNotMatch(html, /type="hidden"/);
  for (const i of items) {
    assert.ok(html.includes(`<option value="${i.id}">${i.nom}</option>`), `option pour ${i.id}`);
  }
  assert.equal((html.match(/<option value="item_/g) || []).length, items.length);
});

test('interventionFormHtml : les types portent les libellés de LABELS.maintType', () => {
  const html = interventionFormHtml(null, []);
  assert.match(html, /Intervention interne/);
  assert.match(html, /Intervention externe/);
});

function stubRoot(values) {
  return { querySelector: (sel) => ({ value: values[sel.match(/name="(\w+)"/)[1]] }) };
}

test('readInterventionForm : rogne les textes et normalise la virgule décimale du coût', () => {
  const lu = (cout) => readInterventionForm(stubRoot({ itemId: 'item_001', type: 'intervention_externe', prestataire: '  Objectif Service ', cout, description: '  Révision de la bague  ' }));
  assert.deepEqual(lu(' 120,50 '), { itemId: 'item_001', type: 'intervention_externe', prestataire: 'Objectif Service', cout: '120.50', description: 'Révision de la bague' });
  assert.equal(lu('').cout, '');
  assert.equal(lu('12o').cout, '12o', 'une saisie invalide n’est pas devinée : createIntervention la refuse');
  assert.equal(lu('12.5').cout, '12.5');
});

test('signalementFormHtml : une option par matériel et une description, sans type ni coût', () => {
  const items = store.items.list().slice(0, 3);
  const html = signalementFormHtml(items);
  assert.match(html, /<select class="select" name="itemId">/);
  for (const i of items) assert.ok(html.includes(`<option value="${i.id}">${i.nom}</option>`), `option pour ${i.id}`);
  assert.equal((html.match(/<option value="item_/g) || []).length, items.length);
  assert.match(html, /name="description"/);
  assert.doesNotMatch(html, /name="(type|prestataire|cout)"/);
});

test('signalementFormHtml : les noms de matériel sont échappés', () => {
  const html = signalementFormHtml([{ id: 'item_x', nom: '<b>Boîtier</b> & co' }]);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;Boîtier&lt;\/b&gt; &amp; co/);
});

test('readSignalementForm : l’objet choisi et la description rognée', () => {
  assert.deepEqual(readSignalementForm(stubRoot({ itemId: 'item_001', description: '  Câble manquant  ' })), { itemId: 'item_001', description: 'Câble manquant' });
});
