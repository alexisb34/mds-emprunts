import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS, REASONS, ymd } from '../js/rules.js';
import { buildWeekGrid, selectionIsValid } from '../js/weekGrid.js';
import { roomChecklist, userBookings } from '../js/actions/bookings.js';
import { gridHtml, selectionBarHtml, myBookingsHtml, etatHtml, salleHtml, openingWeek } from '../js/mobile/views/salle.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const ELEVE = 'user_010';
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); store.settings.update({ horlogeDemo: NOW.toISOString() }); });

const grid = () => buildWeekGrid({ date: NOW, bookings: store.bookings.list(), settings: store.settings.get(), userId: ELEVE, now: NOW });

test('gridHtml : une colonne par jour ouvré, une case par heure, états distingués', () => {
  const html = gridHtml({ grid: grid(), selection: { ymd: '2026-09-17', creneaux: [11] } });
  assert.equal((html.match(/data-day="/g) || []).length, 5);
  assert.equal((html.match(/class="slot/g) || []).length, 45, '5 jours × 9 heures');
  assert.match(html, /data-slot="2026-09-17:11" class="slot slot--selected"/);
  assert.match(html, /data-slot="2026-09-17:8" class="slot slot--past"/);
  assert.match(html, /data-slot="2026-09-17:9" class="slot slot--taken"/, 'créneau déjà réservé');
  assert.match(html, /<th>11h<\/th>/);
  const label = (slot) => html.match(new RegExp(`data-slot="${slot}"[^>]*aria-label="([^"]*)"`))[1];
  assert.match(label('2026-09-17:11'), /, sélectionné$/);
  assert.match(label('2026-09-17:8'), /, passé$/);
  assert.match(label('2026-09-17:9'), /, (déjà pris|réservé par vous)$/);
  assert.match(label('2026-09-17:15'), /, libre$/);
});

test('selectionBarHtml : résumé, motif de refus, bouton actif ou non', () => {
  const vide = selectionBarHtml({ selection: { ymd: null, creneaux: [] }, check: { ok: false, reason: REASONS.CRENEAU_VIDE } });
  assert.match(vide, /Touchez un ou plusieurs créneaux/);
  assert.match(vide, /data-action="book"[^>]*disabled/);
  assert.doesNotMatch(vide, /Choisissez au moins un créneau/);
  assert.equal((vide.match(/body-tiny/g) || []).length, 0, 'sélection vide : le résumé suffit, pas de second message');
  const ok = selectionBarHtml({ selection: { ymd: '2026-09-17', creneaux: [11, 12] }, check: { ok: true, reason: null } });
  assert.match(ok, /11h-13h/);
  assert.match(ok, /2 créneaux/);
  assert.doesNotMatch(ok, /disabled/);
  const occupe = selectionBarHtml({ selection: { ymd: '2026-09-17', creneaux: [9] }, check: { ok: false, reason: REASONS.CRENEAU_OCCUPE } });
  assert.match(occupe, /déjà réservé/);
  assert.equal((occupe.match(/body-tiny/g) || []).length, 1, 'un motif de refus réel reste affiché');
});

test('myBookingsHtml : créneau en cours avec le bon bouton d’état des lieux', () => {
  const actif = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const mine = userBookings(actif.userId, NOW);
  const html = myBookingsHtml(mine, NOW);
  assert.match(html, /9h-11h/);
  assert.match(html, /data-action="exit"/, 'entrée déjà faite → bouton de sortie');
  assert.doesNotMatch(html, /data-action="entry"/);
  const sansEntree = { active: { booking: { ...actif, etatEntree: null }, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] };
  assert.match(myBookingsHtml(sansEntree, NOW), /data-action="entry"/);
  assert.match(html, /Créneau en cours · 9h-11h/);
  const pasEncoreEnCours = { active: { booking: { ...actif, statut: 'a_venir', etatEntree: null }, entreeFaite: false, sortieFaite: false }, aVenir: [], passees: [] };
  const titreDuJour = myBookingsHtml(pasEncoreEnCours, NOW);
  assert.match(titreDuJour, /Créneau du jour · 9h-11h/);
  assert.doesNotMatch(titreDuJour, /Créneau en cours/);
  const vide = myBookingsHtml({ active: null, aVenir: [], passees: [] }, NOW);
  assert.match(vide, /Aucune réservation/);
});

test('etatHtml : une ligne par objet plus la ligne globale, commentaires', () => {
  const booking = store.bookings.list((b) => b.statut === 'en_cours')[0];
  const html = etatHtml({ booking, moment: 'entree', lignes: roomChecklist() });
  assert.equal((html.match(/data-row="/g) || []).length, 6, 'une ligne par objet plus la ligne globale');
  assert.equal((html.match(/data-line="/g) || []).length, 12, 'deux boutons OK/Problème par ligne');
  assert.match(html, /État des lieux d’entrée/);
  assert.match(html, /Salle rangée/);
  assert.match(html, /data-action="confirm-etat"/);
  const sortie = etatHtml({ booking, moment: 'sortie', lignes: roomChecklist() });
  assert.match(sortie, /État des lieux de sortie/);
});

test('salleHtml : grille, barre de sélection et mes réservations', () => {
  const selection = { ymd: '2026-09-18', creneaux: [13] };
  const html = salleHtml({
    grid: grid(), selection, check: selectionIsValid(selection, { bookings: store.bookings.list(), settings: DEFAULT_SETTINGS, date: NOW }),
    mine: userBookings(ELEVE, NOW), semaine: NOW, date: NOW,
  });
  assert.match(html, /data-action="prev-week"/);
  assert.match(html, /data-action="next-week"/);
  assert.match(html, /14 – 18 sept\./);
  assert.match(html, /data-slot=/);
  assert.match(html, /data-action="book"/);
});

test('salleHtml : la semaine affichée ne fausse pas les jours relatifs de mes réservations', () => {
  const lundiSuivant = new Date(2026, 8, 21, 10, 0);
  const aVenir = [{ id: 'bk_x', date: '2026-09-21', creneaux: [13], statut: 'a_venir' }];
  const selection = { ymd: null, creneaux: [] };
  const html = salleHtml({
    grid: buildWeekGrid({ date: lundiSuivant, bookings: store.bookings.list(), settings: store.settings.get(), userId: ELEVE, now: NOW }),
    selection, check: { ok: false, reason: REASONS.CRENEAU_VIDE },
    mine: { active: null, aVenir, passees: [] }, semaine: lundiSuivant, date: NOW,
  });
  assert.match(html, /21 – 25 sept\./, 'l’en-tête suit la semaine affichée');
  assert.doesNotMatch(html, /Aujourd’hui/, 'le jour relatif se calcule depuis maintenant, pas depuis la semaine affichée');
  assert.doesNotMatch(html, /Demain/);
});

test('openingWeek : un jour ouvré garde la date, le week-end ouvre la semaine suivante', () => {
  assert.equal(openingWeek(NOW), NOW, 'jeudi : inchangé');
  const samedi = openingWeek(new Date(2026, 8, 19, 10, 0));
  const dimanche = openingWeek(new Date(2026, 8, 20, 10, 0));
  assert.equal(ymd(samedi), '2026-09-21');
  assert.equal(ymd(dimanche), '2026-09-21');
});
