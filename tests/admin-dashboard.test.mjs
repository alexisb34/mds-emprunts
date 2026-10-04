import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeed } from '../js/seed.js';
import { computeKpis, lateLoans, dueTodayReservations, openReports } from '../js/admin/kpi.js';
import { dashboardHtml, demoClockHtml } from '../js/admin/views/dashboard.js';
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
  assert.match(html, /Aucun signalement ouvert/);
  assert.match(html, /Aucune activité/);
});

test('demoClockHtml : état du bureau, valeur du champ, badge et boutons', () => {
  const ouvert = demoClockHtml({ date: NOW, horlogeDemo: null, status: officeStatus(NOW, db.settings) });
  assert.match(ouvert, /value="2026-09-17T10:00"/);
  assert.match(ouvert, /badge--available">Temps réel/);
  assert.match(ouvert, /alert--info/);
  assert.match(ouvert, /data-action="real-clock" disabled/);
  assert.match(ouvert, /data-action="next-open"/);
  const samedi = new Date(2026, 8, 19, 10, 0);
  const ferme = demoClockHtml({ date: samedi, horlogeDemo: samedi.toISOString(), status: officeStatus(samedi, db.settings) });
  assert.match(ferme, /badge--maintenance">Horloge simulée/);
  assert.match(ferme, /alert--warning/);
  assert.match(ferme, /week-end/);
  assert.doesNotMatch(ferme, /data-action="real-clock" disabled/);
});
