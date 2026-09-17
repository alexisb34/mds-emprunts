import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatTime, formatDateTime, relativeDay, formatSlots, initials, fullName, badge } from '../js/ui.js';

const d = new Date(2026, 8, 17, 9, 5);

test('escapeHtml neutralise les caractères spéciaux', () => {
  assert.equal(escapeHtml('<a href="x">Léa & co</a>'), '&lt;a href=&quot;x&quot;&gt;Léa &amp; co&lt;/a&gt;');
  assert.equal(escapeHtml(null), '');
});

test('formats de date en français', () => {
  assert.equal(formatDate(d), '17 sept. 2026');
  assert.equal(formatTime(d), '09h05');
  assert.equal(formatDateTime(d), '17 sept. 2026 à 09h05');
  assert.equal(formatDate(d.toISOString()), '17 sept. 2026');
});

test('relativeDay', () => {
  const ref = new Date(2026, 8, 17, 15, 0);
  assert.equal(relativeDay(d, ref), 'Aujourd’hui');
  assert.equal(relativeDay(new Date(2026, 8, 18, 8), ref), 'Demain');
  assert.equal(relativeDay(new Date(2026, 8, 16, 23), ref), 'Hier');
  assert.equal(relativeDay(new Date(2026, 8, 20), ref), '20 sept. 2026');
});

test('formatSlots', () => {
  assert.equal(formatSlots([8, 9, 10, 11, 12]), '8h-13h');
  assert.equal(formatSlots([14]), '14h-15h');
});

test('initials et fullName', () => {
  const u = { prenom: 'Léa', nom: 'Pezzetti' };
  assert.equal(initials(u), 'LP');
  assert.equal(fullName(u), 'Léa Pezzetti');
});

test('badge : variante et libellé', () => {
  assert.equal(badge('item', 'disponible'), '<span class="badge badge--available">Disponible</span>');
  assert.equal(badge('loan', 'en_retard'), '<span class="badge badge--late">En retard</span>');
  assert.equal(badge('circuit', 'valeur'), '<span class="badge badge--borrowed">Sur réservation</span>');
  assert.equal(badge('maint', 'ouvert'), '<span class="badge badge--late">Ouvert</span>');
  assert.equal(badge('item', 'inconnu'), '<span class="badge badge--hs">inconnu</span>');
});
