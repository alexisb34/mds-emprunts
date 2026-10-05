import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';
import { dashboardHtml } from '../js/admin/views/dashboard.js';
import { officeStatus } from '../js/actions/settings.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('dashboardHtml : KPI, retards, signalements, activités', () => {
  const activity = [...db.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const html = dashboardHtml({
    kpis: computeKpis(db, NOW), late: lateLoans(db, NOW), due: dueTodayReservations(db, NOW),
    reports: openReports(db), activity, users: db.users, date: NOW,
    horlogeDemo: null, status: officeStatus(NOW, db.settings),
  });
  assert.match(html, /kpi__value">30</);
  assert.match(html, /kpi__value">10</);
  assert.match(html, /kpi--alert[^>]*>[\s\S]*?kpi__value">2</);
  assert.match(html, /DJI Ronin RSC2/);
  assert.match(html, /3 jours/);
  assert.match(html, /1 jour</);
  assert.match(html, /Clic gauche/);
  assert.match(html, /Aucune remise prévue aujourd’hui/);
  assert.doesNotMatch(html, /La remise se fait depuis/);
  assert.equal((html.match(/activity__item/g) || []).length, 15);
  assert.match(html, /data-href="\/materiel\/item_/);
});

test('dashboardHtml : un bouton Remettre par remise du jour', () => {
  const due = dueTodayReservations({ ...db, loans: db.loans.map((l, i) => (i === 0 ? { ...l, statut: 'reservee', debutPrevu: NOW.toISOString(), codeRetrait: 'AB12CD' } : l)) }, NOW);
  assert.ok(due.length >= 1);
  const html = dashboardHtml({
    kpis: computeKpis(db, NOW), late: [], due, reports: [], activity: [], users: db.users, date: NOW,
    horlogeDemo: null, status: officeStatus(NOW, db.settings),
  });
  assert.equal((html.match(/data-action="handover"/g) || []).length, due.length);
  assert.doesNotMatch(html, /La remise se fait depuis/);
});

test('dashboardHtml : états vides', () => {
  const html = dashboardHtml({ kpis: computeKpis({ items: [], loans: [], bookings: [], maintenance: [] }, NOW), late: [], due: [], reports: [], activity: [], users: [], date: NOW, horlogeDemo: null, status: officeStatus(NOW, db.settings) });
  assert.match(html, /Aucun retard/);
  assert.match(html, /Aucun signalement à traiter/);
  assert.match(html, /Aucune activité/);
});

test('dashboardHtml : widget des sorties non faites', () => {
  const tard = new Date(2026, 8, 17, 13, 0);
  const actif = db.bookings.find((b) => b.statut === 'en_cours');
  assert.ok(actif, 'le seed contient une réservation en cours');
  const missing = [{ booking: actif, user: db.users.find((u) => u.id === actif.userId) }];
  const html = dashboardHtml({
    kpis: computeKpis(db, tard), late: [], due: [], reports: [], activity: [], users: db.users, date: tard,
    horlogeDemo: null, status: officeStatus(tard, db.settings), exitMissing: missing,
  });
  assert.match(html, /Sorties non faites/);
  assert.match(html, /href="#\/salle"/);
  const sans = dashboardHtml({
    kpis: computeKpis(db, NOW), late: [], due: [], reports: [], activity: [], users: db.users, date: NOW,
    horlogeDemo: null, status: officeStatus(NOW, db.settings), exitMissing: [],
  });
  assert.doesNotMatch(sans, /Sorties non faites/);
});

test('dashboardHtml : un signalement sans objet reste lisible et pointe vers la salle', () => {
  const event = {
    id: 'maint_salle', itemId: null, bookingId: 'book_0001', statut: 'ouvert',
    description: 'Salle rangée → chaises renversées', date: NOW.toISOString(),
  };
  const html = dashboardHtml({
    kpis: computeKpis(db, NOW), late: [], due: [], reports: [{ event, item: null, auteur: null }],
    activity: [], users: db.users, date: NOW, horlogeDemo: null, status: officeStatus(NOW, db.settings),
  });
  assert.match(html, /Salle photo — état des lieux/);
  assert.match(html, /data-href="\/salle"/);
  assert.doesNotMatch(html, /data-href="\/materiel\/null"/);
});

test('dashboardHtml : le widget et la carte parlent de signalements « à traiter », ouverts et en cours confondus', () => {
  const item = db.items[0];
  const base = { itemId: item.id, type: 'signalement', auteurId: db.users[0].id, date: NOW.toISOString(), prestataire: '', cout: 0, loanId: null, bookingId: null };
  const maintenance = [
    { ...base, id: 'm1', statut: 'ouvert', description: 'Premier' },
    { ...base, id: 'm2', statut: 'en_cours', description: 'Deuxième' },
    { ...base, id: 'm3', statut: 'en_cours', description: 'Troisième' },
  ];
  const data = { ...db, maintenance };
  const html = dashboardHtml({
    kpis: computeKpis(data, NOW), late: [], due: [], reports: openReports(data), activity: [], users: db.users, date: NOW,
    horlogeDemo: null, status: officeStatus(NOW, db.settings),
  });
  assert.match(html, /3 signalements à traiter/);
  assert.match(html, /Signalements à traiter/);
  assert.doesNotMatch(html, /signalements? ouverts?/i);
  for (const d of ['Premier', 'Deuxième', 'Troisième']) assert.match(html, new RegExp(d));
});
