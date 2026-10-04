import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { buildWeekGrid } from '../js/weekGrid.js';
import { weekBookings } from '../js/actions/bookings.js';
import { planningHtml, exitMissingRows, bookingDetailHtml, salleHtml } from '../js/admin/views/salle.js';

const NOW = new Date(2026, 8, 17, 10, 0);
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

const grid = () => buildWeekGrid({ date: NOW, bookings: weekBookings(NOW), settings: store.settings.get(), userId: null, now: NOW });

test('planningHtml : 5 colonnes, initiales de l’occupant, créneau cliquable', () => {
  const html = planningHtml({ grid: grid(), users: store.users.list() });
  assert.equal((html.match(/<th data-day=/g) || []).length, 5);
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const user = store.users.get(actif.userId);
  // Les initiales doivent être DANS la cellule occupée, pas seulement quelque part
  // dans le document (le `title` les contiendrait aussi).
  const initiales = `${user.prenom[0]}${user.nom[0]}`.toUpperCase();
  assert.match(html, new RegExp(`class="slot slot--taken" data-booking="${actif.id}"[^>]*>${initiales}</button>`));
});

test('exitMissingRows : une réservation dont la sortie manque depuis plus d’une heure', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  assert.deepEqual(exitMissingRows(store.bookings.list(), store.users.list(), NOW), [], 'le créneau est encore en cours');
  const tard = new Date(2026, 8, 17, 13, 0); // fin 11h + 1h dépassée
  const rows = exitMissingRows(store.bookings.list(), store.users.list(), tard);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].booking.id, actif.id);
  assert.equal(rows[0].user.id, actif.userId);
});

test('bookingDetailHtml : créneaux, états des lieux, bouton d’annulation', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html = bookingDetailHtml({ booking: actif, user: store.users.get(actif.userId) });
  assert.match(html, /9h-11h/);
  assert.match(html, /État des lieux d’entrée/);
  assert.match(html, /pas encore faite/);
  assert.match(html, /data-cancel-booking="book_/);
  assert.doesNotMatch(html, /Sortie non faite/, 'le créneau est encore en cours');
  const tard = new Date(2026, 8, 17, 13, 0);
  const manquante = bookingDetailHtml({ booking: actif, user: store.users.get(actif.userId), date: tard });
  assert.match(manquante, /badge--late">Sortie non faite/, 'une heure après la fin, la sortie manque');
  assert.doesNotMatch(planningHtml({ grid: grid(), users: store.users.list() }), /week-grid--admin/);
  const terminee = store.bookings.list((b) => b.statut === 'terminee')[0];
  const html2 = bookingDetailHtml({ booking: terminee, user: store.users.get(terminee.userId) });
  assert.doesNotMatch(html2, /data-cancel-booking/);
});

test('salleHtml : navigation de semaine, planning et bandeau des sorties manquantes', () => {
  const tard = new Date(2026, 8, 17, 13, 0);
  const missing = exitMissingRows(store.bookings.list(), store.users.list(), tard);
  const html = salleHtml({ grid: grid(), users: store.users.list(), missing, semaine: NOW });
  assert.match(html, /data-action="prev-week"/);
  assert.match(html, /data-action="next-week"/);
  assert.match(html, /Sorties non faites/);
  assert.match(html, /alert--warning/);
  assert.match(html, /data-action="force-close" data-booking="book_/);
  const sans = salleHtml({ grid: grid(), users: store.users.list(), missing: [], semaine: NOW });
  assert.doesNotMatch(sans, /Sorties non faites/);
});
