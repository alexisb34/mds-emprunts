// tests/admin-demoClock.test.mjs — la carte « horloge de démonstration », partagée par le
// tableau de bord et l’écran Paramètres.
import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { officeStatus } from '../js/actions/settings.js';
import { demoClockHtml, bindDemoClock } from '../js/admin/demoClock.js';

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

// Pose une carte horloge factice (boutons et champ stubés) et une modale factice dont on capte les actions.
function avecCarteFactice(valeurChamp, fn) {
  const clics = {};
  const champ = { value: valeurChamp };
  const root = {
    querySelector: (sel) => {
      if (sel === '[name="horloge"]') return champ;
      return { addEventListener: (type, f) => { clics[sel.match(/data-action="([\w-]+)"/)[1]] = f; } };
    },
  };
  const boutons = [];
  const modalRoot = {
    innerHTML: '',
    querySelectorAll: (sel) => (sel === '.modal__footer [data-action]'
      ? [0, 1].map((i) => ({ dataset: { action: String(i) }, addEventListener: (type, f) => { boutons[i] = f; } }))
      : []),
    querySelector: () => null,
  };
  const avant = globalThis.document;
  // `toast` arme des minuteurs de 3 s : sans cela le processus de test les attendrait.
  const avantTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  const element = () => ({ setAttribute() {}, classList: { add() {} }, remove() {} });
  globalThis.document = {
    getElementById: (id) => (id === 'modal-root' ? modalRoot : { appendChild() {} }),
    createElement: element,
    body: { classList: { add() {}, remove() {} } },
  };
  try { return fn({ root, clics, boutons, modalRoot }); } finally { globalThis.document = avant; globalThis.setTimeout = avantTimeout; }
}

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('bindDemoClock : régénérer avec le champ vidé garde la date annoncée par la modale', async () => {
  await avecCarteFactice('', async ({ root, clics, boutons, modalRoot }) => {
    bindDemoClock(root, { date: NOW });
    clics['reset-demo']();
    assert.match(modalRoot.innerHTML, /17 sept\. 2026/, 'la modale annonce la date affichée dans la carte');
    await boutons[1](); // « Régénérer »
    assert.equal(store.settings.get().horlogeDemo, NOW.toISOString(), 'l’horloge de démo n’est pas perdue : les données et le « maintenant » restent calés sur la date annoncée');
  });
});

test('bindDemoClock : régénérer avec une date saisie la retient', async () => {
  await avecCarteFactice('2026-10-05T09:30', async ({ root, clics, boutons }) => {
    bindDemoClock(root, { date: NOW });
    clics['reset-demo']();
    await boutons[1]();
    assert.equal(store.settings.get().horlogeDemo, new Date(2026, 9, 5, 9, 30).toISOString());
  });
});
