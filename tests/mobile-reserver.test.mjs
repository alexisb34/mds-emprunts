import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS, REASONS, ymd } from '../js/rules.js';
import { buildItemWeekGrid, togglePeriode, togglePeriodeJour, periodeContient, periodeBornes } from '../js/weekGrid.js';
import { reserverHtml, disponibiliteHtml } from '../js/mobile/views/reserver.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const S = DEFAULT_SETTINGS;
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

const grille = (reference = 'canon-r10') => buildItemWeekGrid({
  date: NOW, reference, items: store.items.list(), loans: store.loans.list(), settings: S, now: NOW,
});
const group = { nom: 'Canon R10 + objectif 18-55 + bague', reference: 'canon-r10', circuit: 'valeur', total: 1 };
const ecran = (extra = {}) => reserverHtml({
  group,
  grid: grille(),
  periode: null,
  semaine: NOW,
  dispo: '',
  motif: '',
  pretA: false,
  dureeMax: S.dureeMaxReservationJours,
  fermeture: '17h',
  ...extra,
});

test('reserverHtml : la grille de la semaine, le motif obligatoire, le rappel de la fenêtre', () => {
  const html = ecran();
  assert.match(html, /class="week-grid"/, 'la réservation se fait sur la grille, comme la salle photo');
  assert.equal((html.match(/data-day-check="/g) || []).length, 5, 'une case « journée entière » par jour');
  assert.match(html, /name="motif"[^>]*required/);
  assert.match(html, /field__required/, 'le motif est marqué obligatoire');
  assert.match(html, /Durée maximale : 7 jours/);
  assert.match(html, /jusqu’à la fermeture \(17h\)/);
  assert.match(html, /data-action="confirm-reserve"[^>]*disabled/, 'sans période ni motif, on ne confirme pas');
  assert.doesNotMatch(html, /type="date"/, 'les champs de date ont laissé la place à la grille');
});

test('reserverHtml : le bouton s’ouvre quand la période et le motif sont là, et le motif est réécrit', () => {
  const html = ecran({ pretA: true, motif: 'Tournage <MBA>' });
  assert.doesNotMatch(html, /data-action="confirm-reserve"[^>]*disabled/);
  assert.match(html, /Tournage &lt;MBA&gt;<\/textarea>/, 'le motif déjà saisi survit au re-rendu, échappé');
});

test('disponibiliteHtml : l’invitation, le motif d’un refus, puis plus rien', () => {
  assert.match(disponibiliteHtml({ periode: null }), /Touchez un ou plusieurs créneaux/);
  const periode = { debut: { ymd: '2026-09-18', heure: 9 }, fin: { ymd: '2026-09-18', heure: 10 } };
  const complet = disponibiliteHtml({ periode, reason: REASONS.COMPLET_SUR_LA_PERIODE, settings: S });
  assert.match(complet, /alert--warning/);
  const retard = disponibiliteHtml({ periode, reason: REASONS.RETARD_EN_COURS, settings: S });
  assert.match(retard, /alert--error/);
  assert.match(disponibiliteHtml({ periode, motifVide: true }), /Indiquez le motif/);
  assert.equal(disponibiliteHtml({ periode }), '', 'tout est prêt : rien à dire');
});

test('buildItemWeekGrid : une case libre quand un exemplaire l’est, prise sinon', () => {
  const g = grille();
  assert.equal(g.days.length, 5);
  assert.equal(g.hours.length, 9, '8h à 16h');
  const jour = ymd(NOW);
  assert.equal(g.cells[jour][8].past, true, 'il est 10h : le créneau de 8h est passé');
  assert.equal(g.cells[jour][8].free, false);
  // Le seul exemplaire du Canon, réservé sur une période, ferme ses créneaux à tout le monde.
  const occupe = buildItemWeekGrid({
    date: NOW, reference: 'canon-r10', items: store.items.list(), settings: S, now: NOW,
    loans: [{ id: 'L-x', itemId: store.items.list((i) => i.reference === 'canon-r10')[0].id, statut: 'reservee', debutPrevu: new Date(2026, 8, 18, 9).toISOString(), finPrevue: new Date(2026, 8, 18, 12).toISOString() }],
  });
  assert.equal(occupe.cells['2026-09-18'][9].free, false);
  assert.equal(occupe.cells['2026-09-18'][9].booking, true);
  assert.equal(occupe.cells['2026-09-18'][12].free, true, 'les bornes sont jointives');
});

test('togglePeriode : un créneau, puis la période s’étend, se raccourcit et s’efface', () => {
  const un = togglePeriode(null, '2026-09-18', 9);
  assert.deepEqual(un, { debut: { ymd: '2026-09-18', heure: 9 }, fin: { ymd: '2026-09-18', heure: 9 } });
  // Un matériel reste dehors d’un bout à l’autre : la période peut couvrir plusieurs jours.
  const deuxJours = togglePeriode(un, '2026-09-21', 11);
  assert.deepEqual(deuxJours.fin, { ymd: '2026-09-21', heure: 11 });
  const avant = togglePeriode(deuxJours, '2026-09-17', 14);
  assert.deepEqual(avant.debut, { ymd: '2026-09-17', heure: 14 });
  assert.deepEqual(avant.fin, { ymd: '2026-09-21', heure: 11 });
  const raccourcie = togglePeriode(avant, '2026-09-18', 9);
  assert.deepEqual(raccourcie.fin, { ymd: '2026-09-18', heure: 9 });
  assert.equal(togglePeriode(un, '2026-09-18', 9), null, 'retoucher le seul créneau retenu l’efface');
});

test('periodeBornes : du début du premier créneau à la fin du dernier', () => {
  const bornes = periodeBornes({ debut: { ymd: '2026-09-18', heure: 9 }, fin: { ymd: '2026-09-21', heure: 11 } });
  assert.deepEqual(bornes.debutPrevu, new Date(2026, 8, 18, 9));
  assert.deepEqual(bornes.finPrevue, new Date(2026, 8, 21, 12));
  assert.equal(periodeBornes(null), null);
});

test('togglePeriodeJour : une seconde journée étend la période au lieu de la remplacer', () => {
  const g = grille('sd-256'); // trois exemplaires : la semaine entière est libre
  const [a, b] = ['2026-09-17', '2026-09-18'];
  const heures = (j) => g.hours.filter((h) => g.cells[j][h].free);
  const un = togglePeriodeJour(null, g, a);
  assert.deepEqual(un, { debut: { ymd: a, heure: heures(a)[0] }, fin: { ymd: a, heure: heures(a).at(-1) } });
  const deux = togglePeriodeJour(un, g, b);
  assert.deepEqual(deux.debut, un.debut, 'cocher le vendredi ne rend pas le jeudi');
  assert.deepEqual(deux.fin, { ymd: b, heure: heures(b).at(-1) });
  // Décocher retire la journée par son bout, le reste de la période tient.
  const sansB = togglePeriodeJour(deux, g, b);
  assert.deepEqual(sansB.fin, { ymd: a, heure: heures(a).at(-1) });
  assert.equal(periodeContient(sansB, b, heures(b)[0]), false);
  assert.equal(togglePeriodeJour(sansB, g, a), null, 'la dernière journée décochée efface la période');
});
