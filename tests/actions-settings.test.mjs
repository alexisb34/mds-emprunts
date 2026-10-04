import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { now } from '../js/rules.js';
import { ACTIONS } from '../js/log.js';
import { toDatetimeLocal, fromDatetimeLocal, officeStatus, setDemoClock, resetDemoData } from '../js/actions/settings.js';

const NOW = new Date(2026, 8, 17, 10, 0); // jeudi 10h
const PEDAGO = 'user_041';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
});

test('toDatetimeLocal et fromDatetimeLocal sont symétriques en heure locale', () => {
  assert.equal(toDatetimeLocal(new Date(2026, 8, 17, 9, 5)), '2026-09-17T09:05');
  const d = fromDatetimeLocal('2026-09-17T09:05');
  assert.equal(d.getHours(), 9);
  assert.equal(d.getDate(), 17);
  assert.equal(toDatetimeLocal(d), '2026-09-17T09:05');
  assert.equal(fromDatetimeLocal('n’importe quoi'), null);
  assert.equal(fromDatetimeLocal(''), null);
});

test('officeStatus : ouvert, pause déjeuner, week-end', () => {
  const s = store.settings.get();
  assert.equal(officeStatus(NOW, s).open, true);
  assert.match(officeStatus(NOW, s).text, /Bureau ouvert/);
  const pause = officeStatus(new Date(2026, 8, 17, 12, 30), s);
  assert.equal(pause.open, false);
  assert.match(pause.text, /hors des heures d’ouverture/);
  const samedi = officeStatus(new Date(2026, 8, 19, 10, 0), s);
  assert.equal(samedi.open, false);
  assert.match(samedi.text, /week-end/);
  assert.match(samedi.text, /les retours restent possibles/);
});

test('setDemoClock fixe l’horloge, la remet au temps réel et journalise', () => {
  const target = new Date(2026, 8, 17, 9, 0);
  setDemoClock(target, PEDAGO);
  assert.equal(store.settings.get().horlogeDemo, target.toISOString());
  assert.equal(now().getTime(), target.getTime());
  let entry = store.log.list().at(-1);
  assert.equal(entry.action, ACTIONS.SETTINGS_MODIFIES);
  assert.match(entry.detail, /Horloge de démo : 17 sept\. 2026 à 09h00/);
  setDemoClock(null, PEDAGO);
  assert.equal(store.settings.get().horlogeDemo, null);
  assert.ok(Math.abs(now() - Date.now()) < 1000);
  entry = store.log.list().at(-1);
  assert.match(entry.detail, /temps réel/);
});

test('setDemoClock refuse une date invalide sans rien écrire', () => {
  const before = store.log.list().length;
  assert.throws(() => setDemoClock('pas-une-date', PEDAGO), /Date invalide/);
  assert.equal(store.settings.get().horlogeDemo, null); // valeur du seed, inchangée
  assert.equal(store.log.list().length, before);
});

test('resetDemoData : données reconstruites autour de la date simulée, horloge conservée', () => {
  const lundi = new Date(2026, 9, 5, 9, 0);
  store.items.update('item_001', { nom: 'Modifié' });
  resetDemoData(lundi, PEDAGO);
  assert.equal(store.items.get('item_001').nom, 'Multiprise #1', 'le seed est rechargé');
  assert.equal(store.settings.get().horlogeDemo, lundi.toISOString(), 'l’horloge simulée est conservée');
  assert.equal(now().getTime(), lundi.getTime());
  // Les emprunts self du jour ne sont pas en retard à 9h le jour même.
  const enCours = store.loans.list((l) => l.statut === 'en_cours');
  const retards = enCours.filter((l) => new Date(l.finPrevue) < lundi);
  assert.equal(retards.length, 2, 'seuls les 2 retards voulus par le seed');
  assert.equal(store.log.list().at(-1).action, ACTIONS.DEMO_RESET);
});

test('resetDemoData sans date : temps réel', () => {
  resetDemoData(null, PEDAGO);
  assert.equal(store.settings.get().horlogeDemo, null);
  assert.ok(Math.abs(now() - Date.now()) < 1000);
});
