import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { defaultDates, reserverHtml } from '../js/mobile/views/reserver.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

test('defaultDates : demain, même jour par défaut', () => {
  assert.deepEqual(defaultDates(NOW, 5), { debut: '2026-09-18', fin: '2026-09-18' });
});

test('reserverHtml : champs, bornes, rappel de la fenêtre de retrait, règles', () => {
  const item = store.items.list((i) => i.reference === 'canon-r10')[0];
  const html = reserverHtml({ item: { ...item, nom: 'Canon <R10>' }, dates: { debut: '2026-09-18', fin: '2026-09-19' }, dureeMax: 5, fenetreMinutes: 60 });
  assert.match(html, /Canon &lt;R10&gt;/);
  assert.match(html, /name="debut"[^>]*value="2026-09-18"/);
  assert.match(html, /name="fin"[^>]*value="2026-09-19"/);
  assert.match(html, /name="heure"/);
  assert.match(html, /name="motif"/);
  assert.match(html, /dans l’heure/);
  assert.match(html, /5 jours/);
  assert.match(html, /data-action="confirm-reserve"/);
});
