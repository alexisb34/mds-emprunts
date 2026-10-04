import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDate, formatTime, formatDateTime, relativeDay, formatSlots, initials, fullName, badge, openModal, closeModal } from '../js/ui.js';

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

test('relativeDay exige une référence explicite', () => {
  assert.throws(() => relativeDay(d), /relativeDay/);
  assert.throws(() => relativeDay(d, undefined), /relativeDay/);
});

test('formatSlots', () => {
  assert.equal(formatSlots([8, 9, 10, 11, 12]), '8h-13h');
  assert.equal(formatSlots([14]), '14h-15h');
  assert.equal(formatSlots([]), '');
});

test('initials et fullName', () => {
  const u = { prenom: 'Léa', nom: 'Pezzetti' };
  assert.equal(initials(u), 'LP');
  assert.equal(fullName(u), 'Léa Pezzetti');
});

test('initials tolère un prénom ou nom manquant', () => {
  assert.equal(initials({ prenom: undefined, nom: 'X' }), 'X');
});

test('badge : variante et libellé', () => {
  assert.equal(badge('item', 'disponible'), '<span class="badge badge--available">Disponible</span>');
  assert.equal(badge('loan', 'en_retard'), '<span class="badge badge--late">En retard</span>');
  assert.equal(badge('circuit', 'valeur'), '<span class="badge badge--borrowed">Sur réservation</span>');
  assert.equal(badge('maint', 'ouvert'), '<span class="badge badge--late">Ouvert</span>');
  assert.equal(badge('item', 'inconnu'), '<span class="badge badge--hs">inconnu</span>');
  assert.equal(badge('role', 'eleve'), '<span class="badge badge--reserved">Élève</span>');
  assert.equal(badge('role', 'pedago'), '<span class="badge badge--available">Pédagogie</span>');
});

test('badge : libellé dérivé « sortie non faite » via LABELS.derived', () => {
  assert.equal(badge('booking', 'sortie_non_faite'), '<span class="badge badge--hs">Sortie non faite</span>');
});

test('badge : une réservation expirée est « Non retiré »', () => {
  assert.match(badge('loan', 'expiree'), /badge--hs">Non retiré</);
});

test('openModal : ouvrir une modale libère d’abord la précédente, closeModal ne rappelle rien deux fois', () => {
  const root = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
  const body = { classList: { add() {}, remove() {} } };
  const avant = globalThis.document;
  globalThis.document = { getElementById: () => root, body };
  const appels = [];
  try {
    openModal({ title: 'A', body: '', onClose: () => appels.push('A') });
    openModal({ title: 'B', body: '', onClose: () => appels.push('B') });
    assert.deepEqual(appels, ['A'], 'l’onClose de la première modale est appelé à l’ouverture de la seconde');
    closeModal();
    assert.deepEqual(appels, ['A', 'B']);
    closeModal();
    assert.deepEqual(appels, ['A', 'B'], 'chaque onClose n’est appelé qu’une fois');
  } finally {
    globalThis.document = avant;
  }
});

test('toDate : une date seule est locale, pas UTC', () => {
  // new Date('2026-09-17') vaut minuit UTC : à l’ouest de Greenwich, c’est le 16 au soir.
  assert.equal(formatDate('2026-09-17'), '17 sept. 2026');
  assert.equal(relativeDay('2026-09-17', new Date(2026, 8, 17, 23, 30)), 'Aujourd’hui');
  assert.equal(relativeDay('2026-09-18', new Date(2026, 8, 17, 0, 10)), 'Demain');
  // Les horodatages ISO complets restent interprétés comme avant.
  assert.equal(formatTime('2026-09-17T09:05:00.000Z'), formatTime(new Date('2026-09-17T09:05:00.000Z')));
  // Vérification indépendante du fuseau : avant le correctif, « 2026-09-17 » valait minuit UTC,
  // soit 02h00 à Paris et 20h00 la veille à New York.
  assert.equal(formatTime('2026-09-17'), '00h00');
});
