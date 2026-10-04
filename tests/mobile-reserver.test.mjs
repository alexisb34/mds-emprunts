import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { defaultDates, reserverHtml, openHours } from '../js/mobile/views/reserver.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('defaultDates : demain, même jour par défaut, aujourd’hui permis, horizon de 60 jours', () => {
  assert.deepEqual(defaultDates(NOW, 5), { debut: '2026-09-18', fin: '2026-09-18', min: '2026-09-17', max: '2026-11-16' });
});

test('openHours : les heures entières de chaque plage d’ouverture', () => {
  assert.deepEqual(openHours({ horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }] }), [8, 9, 10, 11, 13, 14, 15, 16]);
  assert.deepEqual(openHours({ horaires: [{ debut: 9, fin: 11 }] }), [9, 10]);
  assert.deepEqual(openHours({}), [8, 9, 10, 11, 13, 14, 15, 16], 'réglages incomplets : horaires par défaut');
});

test('reserverHtml : champs, bornes, rappel de la fenêtre de retrait, règles', () => {
  const item = store.items.list((i) => i.reference === 'canon-r10')[0];
  const html = reserverHtml({ item: { ...item, nom: 'Canon <R10>' }, dates: { debut: '2026-09-18', fin: '2026-09-19', min: '2026-09-17', max: '2026-11-16' }, dureeMax: 5, fenetreMinutes: 60, heures: [9, 10, 14] });
  assert.match(html, /Canon &lt;R10&gt;/);
  assert.match(html, /name="debut"[^>]*value="2026-09-18"/);
  assert.match(html, /name="fin"[^>]*value="2026-09-19"/);
  assert.match(html, /name="debut"[^>]*min="2026-09-17" max="2026-11-16"/);
  assert.match(html, /name="fin"[^>]*min="2026-09-17" max="2026-11-16"/);
  assert.match(html, /name="heure"/);
  assert.equal((html.match(/<option value="/g) || []).length, 3, 'une option par heure proposée');
  assert.match(html, /<option value="14">14h00<\/option>/);
  assert.match(html, /name="motif"/);
  assert.match(html, /dans l’heure/);
  assert.match(html, /5 jours/);
  assert.match(html, /data-action="confirm-reserve"/);
});
