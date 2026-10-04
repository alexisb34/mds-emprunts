// tests/admin-demoClock.test.mjs — la carte « horloge de démonstration », partagée par le
// tableau de bord et l’écran Paramètres.
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { officeStatus } from '../js/actions/settings.js';
import { demoClockHtml } from '../js/admin/demoClock.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('demoClockHtml : état du bureau, valeur du champ, badge et boutons', () => {
  const ouvert = demoClockHtml({ date: NOW, horlogeDemo: null, status: officeStatus(NOW, db.settings) });
  assert.match(ouvert, /value="2026-09-17T10:00"/);
  assert.match(ouvert, /badge--available">Temps réel/);
  assert.match(ouvert, /alert--info/);
  assert.match(ouvert, /data-action="real-clock" disabled/);
  assert.match(ouvert, /data-action="next-open"/);
  assert.match(ouvert, /data-action="set-clock"/);
  assert.match(ouvert, /data-action="reset-demo"/);
  const samedi = new Date(2026, 8, 19, 10, 0);
  const ferme = demoClockHtml({ date: samedi, horlogeDemo: samedi.toISOString(), status: officeStatus(samedi, db.settings) });
  assert.match(ferme, /badge--maintenance">Horloge simulée/);
  assert.match(ferme, /alert--warning/);
  assert.match(ferme, /week-end/);
  assert.doesNotMatch(ferme, /data-action="real-clock" disabled/);
});

test('demoClockHtml : le badge distingue horloge simulée et temps réel', () => {
  const simule = demoClockHtml({ date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, db.settings) });
  assert.match(simule, /badge--maintenance">Horloge simulée/);
  assert.doesNotMatch(simule, /badge--available">Temps réel/);
  const reel = demoClockHtml({ date: NOW, horlogeDemo: null, status: officeStatus(NOW, db.settings) });
  assert.match(reel, /badge--available">Temps réel/);
  assert.doesNotMatch(reel, /Horloge simulée/);
});
