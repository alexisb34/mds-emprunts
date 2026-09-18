import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';
import { dashboardHtml } from '../js/admin/views/dashboard.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const db = buildSeed(NOW);

test('dashboardHtml : KPI, retards, signalements, activités', () => {
  const activity = [...db.log].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const html = dashboardHtml({
    kpis: computeKpis(db, NOW), late: lateLoans(db, NOW), due: dueTodayReservations(db, NOW),
    reports: openReports(db), activity, users: db.users, date: NOW,
  });
  assert.match(html, /kpi__value">30</);
  assert.match(html, /kpi__value">10</);
  assert.match(html, /kpi--alert[^>]*>[\s\S]*?kpi__value">2</);
  assert.match(html, /DJI Ronin RSC2/);
  assert.match(html, /3 jours/);
  assert.match(html, /1 jour</);
  assert.match(html, /Clic gauche/);
  assert.match(html, /Aucune remise prévue aujourd’hui/);
  assert.equal((html.match(/activity__item/g) || []).length, 15);
  assert.match(html, /data-href="\/materiel\/item_/);
});

test('dashboardHtml : états vides', () => {
  const html = dashboardHtml({ kpis: computeKpis({ items: [], loans: [], bookings: [], maintenance: [] }, NOW), late: [], due: [], reports: [], activity: [], users: [], date: NOW });
  assert.match(html, /Aucun retard/);
  assert.match(html, /Aucun signalement ouvert/);
  assert.match(html, /Aucune activité/);
});
