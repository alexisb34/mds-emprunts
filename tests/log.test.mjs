import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { ACTIONS, ACTION_LABELS, logAction, recentLog, logForItem, logForUser } from '../js/log.js';

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(new Date(2026, 8, 17, 10, 0)));
});

test('toutes les actions du seed sont des ACTIONS connues et ont un libellé', () => {
  const known = new Set(Object.values(ACTIONS));
  for (const e of store.log.list()) assert.ok(known.has(e.action), e.action);
  for (const a of known) assert.ok(ACTION_LABELS[a], a);
});

test('logAction écrit une entrée datée par now() (horloge de démo)', () => {
  store.settings.update({ horlogeDemo: '2026-09-18T09:00:00.000Z' });
  const e = logAction({ auteurId: 'user_041', action: ACTIONS.ITEM_ETAT, itemId: 'item_001', detail: 'test' });
  assert.equal(e.date, '2026-09-18T09:00:00.000Z');
  assert.equal(store.log.get(e.id).detail, 'test');
  assert.equal(e.loanId, null);
});

test('logAction refuse une action inconnue ou sans auteur', () => {
  assert.throws(() => logAction({ auteurId: 'user_041', action: 'nimporte.quoi' }), /action inconnue/);
  assert.throws(() => logAction({ action: ACTIONS.ITEM_ETAT }), /auteurId/);
});

test('recentLog renvoie les plus récentes en premier, limitées', () => {
  const r = recentLog(5);
  assert.equal(r.length, 5);
  assert.ok(r[0].date >= r[4].date);
});

test('logForItem et logForUser filtrent', () => {
  assert.ok(logForItem('item_001').every((e) => e.itemId === 'item_001'));
  assert.ok(logForItem('item_001').length > 0);
  const u = logForUser('user_001');
  assert.ok(u.length > 0);
  assert.ok(u.every((e) => e.userId === 'user_001' || e.auteurId === 'user_001'));
});

test('à `date` égale (horloge de démo figée), tri secondaire sur createdAt décroissant', async () => {
  store.settings.update({ horlogeDemo: '2026-09-18T09:00:00.000Z' });
  const e1 = logAction({ auteurId: 'user_041', action: ACTIONS.ITEM_ETAT, itemId: 'item_001', detail: 'premier' });
  await new Promise((r) => setTimeout(r, 5));
  const e2 = logAction({ auteurId: 'user_041', action: ACTIONS.ITEM_ETAT, itemId: 'item_001', detail: 'second' });
  assert.equal(e1.date, e2.date); // même horloge de démo
  assert.notEqual(e1.createdAt, e2.createdAt); // horloge réelle, distincte
  const [first] = recentLog(1);
  assert.equal(first.detail, 'second'); // le plus récemment créé en premier
});
