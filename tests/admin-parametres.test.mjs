import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS } from '../js/rules.js';
import { officeStatus } from '../js/actions/settings.js';
import { usageHtml, settingsFormHtml, parametresHtml } from '../js/admin/views/parametres.js';
import { demoClockHtml } from '../js/admin/demoClock.js';

const NOW = new Date(2026, 8, 17, 10, 0);

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('usageHtml : jauge, pourcentage et taille lisible', () => {
  const html = usageHtml({ bytes: 1024 * 1024, budget: 5 * 1024 * 1024, percent: 20 });
  assert.match(html, /20 ?%/);
  assert.match(html, /1(,0)? Mo/);
  assert.match(html, /value="20"|style="[^"]*20%/, 'la jauge reflète le pourcentage');
});

test('usageHtml : alerte au-delà de 80 %', () => {
  assert.doesNotMatch(usageHtml({ bytes: 1, budget: 100, percent: 50 }), /alert--warning/);
  assert.match(usageHtml({ bytes: 90, budget: 100, percent: 90 }), /alert--warning/);
});

test('settingsFormHtml : les champs portent les valeurs courantes', () => {
  const html = settingsFormHtml({ ...DEFAULT_SETTINGS, dureeMaxReservationJours: 7, bloquerSiRetard: false });
  assert.match(html, /name="matinDebut"[^>]*value="8"/);
  assert.match(html, /name="matinFin"[^>]*value="12"/);
  assert.match(html, /name="apresMidiDebut"[^>]*value="13"/);
  assert.match(html, /name="apresMidiFin"[^>]*value="17"/);
  assert.match(html, /name="dureeMaxReservationJours"[^>]*value="7"/);
  assert.match(html, /name="fenetreRetraitMinutes"[^>]*value="60"/);
  assert.match(html, /name="bloquerSiRetard"(?![^>]*checked)/, 'la case suit le réglage');
  assert.match(html, /name="salleHeureDebut"[^>]*value="8"/);
  assert.match(html, /name="salleHeureFin"[^>]*value="17"/);
});

test('parametresHtml : les trois cartes et le bouton de réinitialisation', () => {
  const html = parametresHtml({
    settings: DEFAULT_SETTINGS, usage: { bytes: 10, budget: 100, percent: 10 },
    date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, DEFAULT_SETTINGS),
  });
  assert.match(html, /Horloge de démonstration/);
  assert.match(html, /Règles d’emprunt/);
  assert.match(html, /Espace occupé/);
  assert.match(html, /data-action="save-settings"/);
  assert.match(html, /data-action="reset-demo"/);
});

test('demoClockHtml : badge, état du bureau et champ pré-rempli', () => {
  const html = demoClockHtml({ date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, DEFAULT_SETTINGS) });
  assert.match(html, /Horloge simulée/);
  assert.match(html, /value="2026-09-17T10:00"/);
  assert.match(html, /data-action="set-clock"/);
  const reel = demoClockHtml({ date: NOW, horlogeDemo: null, status: officeStatus(NOW, DEFAULT_SETTINGS) });
  assert.match(reel, /Temps réel/);
  assert.match(reel, /data-action="real-clock"[^>]*disabled/);
});
