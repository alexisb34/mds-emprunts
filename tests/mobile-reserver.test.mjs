import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS, REASONS, MOMENTS, fromYmd, halfDayBounds, isWeekday } from '../js/rules.js';
import {
  defaultDates, momentOptions, reserverHtml, readReserveForm,
  disponibiliteHtml, prochaineDisponibilite,
} from '../js/mobile/views/reserver.js';

const NOW = new Date(2026, 8, 17, 10, 0);
const S = DEFAULT_SETTINGS;
beforeEach(() => { localStorage.clear(); store.init(() => buildSeed(NOW)); });

// Un faux formulaire : `readReserveForm` ne lit que des `[name=…].value`, pas un vrai DOM.
const formulaire = (champs) => ({ querySelector: (sel) => ({ value: champs[sel.replace(/\[name="|"\]/g, '')] }) });

test('defaultDates : demain, même jour par défaut, aujourd’hui permis, horizon de 60 jours', () => {
  assert.deepEqual(defaultDates(NOW, 5), { debut: '2026-09-18', fin: '2026-09-18', min: '2026-09-17', max: '2026-11-16' });
});

test('defaultDates : le retrait proposé tombe toujours un jour ouvré', () => {
  const vendredi = defaultDates(new Date(2026, 8, 18, 10, 0), 5);
  assert.equal(vendredi.debut, '2026-09-21', 'un vendredi → le lundi suivant');
  assert.equal(vendredi.fin, '2026-09-21');
  assert.equal(vendredi.min, '2026-09-18', 'min reste le jour courant');
  assert.equal(vendredi.max, '2026-11-17');
  assert.equal(defaultDates(new Date(2026, 8, 19, 10, 0), 5).debut, '2026-09-21', 'un samedi → le lundi suivant');
  assert.equal(defaultDates(new Date(2026, 8, 20, 10, 0), 5).debut, '2026-09-21', 'un dimanche → le lundi suivant');
});

test('momentOptions : deux demi-journées, étiquetées avec les heures RÉGLÉES', () => {
  assert.deepEqual(momentOptions(S), [
    { value: MOMENTS.MATIN, label: 'Matin (8h-12h)' },
    { value: MOMENTS.APRES_MIDI, label: 'Après-midi (13h-17h)' },
  ]);
  // La pédago change les horaires : les libellés suivent, rien n’est écrit en dur.
  assert.deepEqual(momentOptions({ horaires: [{ debut: 9, fin: 11 }, { debut: 14, fin: 18 }] }).map((m) => m.label),
    ['Matin (9h-11h)', 'Après-midi (14h-18h)']);
  // Une seule plage : l’après-midi est sa seconde moitié, à la demi-heure près.
  assert.deepEqual(momentOptions({ horaires: [{ debut: 8, fin: 15 }] }).map((m) => m.label),
    ['Matin (8h-11h30)', 'Après-midi (11h30-15h)']);
});

test('reserverHtml : quatre champs, bornes, rappel de la fenêtre, durée maximale réglée', () => {
  const group = { nom: 'Canon <R10>', reference: 'canon-r10', circuit: 'valeur', total: 2 };
  const html = reserverHtml({
    group, dates: { debut: '2026-09-18', fin: '2026-09-19', min: '2026-09-17', max: '2026-11-16' },
    moments: momentOptions(S), dureeMax: 7, fenetreMinutes: 60, dispo: '<p>x</p>',
  });
  assert.match(html, /Canon &lt;R10&gt;/, 'le nom est échappé');
  assert.match(html, /2 exemplaires/);
  assert.match(html, /name="debut"[^>]*value="2026-09-18"[^>]*min="2026-09-17" max="2026-11-16"/);
  assert.match(html, /name="fin"[^>]*value="2026-09-19"[^>]*min="2026-09-17" max="2026-11-16"/);
  // Les deux sélecteurs de demi-journée ont remplacé le choix d’une heure entière.
  assert.match(html, /name="momentDebut"/);
  assert.match(html, /name="momentFin"/);
  assert.doesNotMatch(html, /name="heure"/);
  assert.equal((html.match(/<option value="/g) || []).length, 4, 'deux options par sélecteur');
  assert.match(html, /<option value="matin" selected>Matin \(8h-12h\)/, 'le retrait est proposé le matin');
  assert.match(html, /<option value="apres_midi" selected>Après-midi \(13h-17h\)/, 'le retour l’après-midi');
  assert.match(html, /name="motif"/);
  assert.match(html, /60 minutes/);
  assert.match(html, /7 jours/);
  assert.match(html, /data-role="dispo"><p>x<\/p>/, 'la réponse immédiate a sa place dans le gabarit');
  assert.match(html, /data-action="confirm-reserve"/);
  assert.match(html, /href="#\/catalogue\/canon-r10"/);
});

test('readReserveForm : du début de la demi-journée de retrait à la FIN de celle de retour', () => {
  const lu = readReserveForm(formulaire({ debut: '2026-09-18', momentDebut: MOMENTS.MATIN, fin: '2026-09-21', momentFin: MOMENTS.APRES_MIDI, motif: ' Tournage ' }), S);
  assert.equal(+lu.debutPrevu, +fromYmd('2026-09-18', 8), 'le début du matin');
  assert.equal(+lu.finPrevue, +fromYmd('2026-09-21', 17), 'la fin de l’après-midi, pas son début');
  assert.equal(lu.motif, ' Tournage ', 'le motif est transmis tel quel : c’est l’action qui le taille');
  // Une seule demi-journée, le minimum : une période qui a bien une longueur.
  const demi = readReserveForm(formulaire({ debut: '2026-09-18', momentDebut: MOMENTS.MATIN, fin: '2026-09-18', momentFin: MOMENTS.MATIN, motif: '' }), S);
  assert.equal(+demi.debutPrevu, +fromYmd('2026-09-18', 8));
  assert.equal(+demi.finPrevue, +fromYmd('2026-09-18', 12));
  assert.ok(demi.finPrevue > demi.debutPrevu);
  // Les horaires réglés mènent la lecture, pas une heure écrite en dur.
  const regle = readReserveForm(formulaire({ debut: '2026-09-18', momentDebut: MOMENTS.APRES_MIDI, fin: '2026-09-18', momentFin: MOMENTS.APRES_MIDI, motif: '' }), { horaires: [{ debut: 9, fin: 11 }, { debut: 14, fin: 18 }] });
  assert.equal(+regle.debutPrevu, +fromYmd('2026-09-18', 14));
  assert.equal(+regle.finPrevue, +fromYmd('2026-09-18', 18));
});

test('disponibiliteHtml : le nombre de libres, au singulier comme au pluriel', () => {
  assert.match(disponibiliteHtml({ libres: [{ id: 'a' }, { id: 'b' }], settings: S }), /2 exemplaires libres sur cette période/);
  assert.match(disponibiliteHtml({ libres: [{ id: 'a' }], settings: S }), /1 exemplaire libre sur cette période/);
  assert.match(disponibiliteHtml({ libres: [{ id: 'a' }], settings: S }), /alert--info/);
});

test('disponibiliteHtml : complet → la première période libre, ou l’aveu qu’il n’y en a pas', () => {
  const prochaine = { debut: fromYmd('2026-09-21', 8), fin: fromYmd('2026-09-21', 12) };
  const avec = disponibiliteHtml({ reason: REASONS.COMPLET_SUR_LA_PERIODE, prochaine, settings: S });
  assert.match(avec, /Aucun exemplaire n’est libre sur cette période/);
  assert.match(avec, /Premier créneau libre/);
  assert.match(avec, /le 21 sept\. 2026 matin/, 'une seule demi-journée');
  assert.match(avec, /alert--warning/);
  const sans = disponibiliteHtml({ reason: REASONS.COMPLET_SUR_LA_PERIODE, prochaine: null, settings: S });
  assert.match(sans, /Aucune disponibilité dans les deux mois/);
  assert.doesNotMatch(sans, /Premier créneau/);
  // Le même jour en entier ne répète pas la date ; deux jours la nomment aux deux bouts.
  const journee = disponibiliteHtml({ reason: REASONS.COMPLET_SUR_LA_PERIODE, prochaine: { debut: fromYmd('2026-09-21', 8), fin: fromYmd('2026-09-21', 17) }, settings: S });
  assert.match(journee, /le 21 sept\. 2026, matin et après-midi/);
  const large = disponibiliteHtml({ reason: REASONS.COMPLET_SUR_LA_PERIODE, prochaine: { debut: fromYmd('2026-09-21', 8), fin: fromYmd('2026-09-22', 17) }, settings: S });
  assert.match(large, /du 21 sept\. 2026 matin au 22 sept\. 2026 après-midi/);
});

test('disponibiliteHtml : un refus qu’aucune autre date ne lèverait le dit sans parler de période', () => {
  for (const reason of [REASONS.DUREE_TROP_LONGUE, REASONS.DATES_INCOHERENTES, REASONS.HORS_OUVERTURE, REASONS.EN_MAINTENANCE, REASONS.HORS_SERVICE, REASONS.DEJA_UN_EXEMPLAIRE]) {
    const html = disponibiliteHtml({ reason, settings: S });
    assert.match(html, /alert--error/, reason);
    assert.doesNotMatch(html, /Premier créneau|disponibilité dans les deux mois/, reason);
  }
  assert.match(disponibiliteHtml({ reason: REASONS.EN_MAINTENANCE, settings: S }), /en maintenance/);
  // Le message cite les horaires RÉGLÉS, via `reasonLabel`.
  assert.match(disponibiliteHtml({ reason: REASONS.HORS_OUVERTURE, settings: { horaires: [{ debut: 9, fin: 11 }] } }), /9h-11h/);
});

test('prochaineDisponibilite : la période glisse vers l’avant sans changer de longueur', () => {
  // Une seule Hoya : la demi-journée demandée est prise, la suivante est libre.
  const items = store.items.list((i) => i.reference === 'hoya-nd');
  assert.equal(items.length, 1);
  const pris = halfDayBounds('2026-09-18', MOMENTS.MATIN, S);
  const loans = [{ id: 'l1', itemId: items[0].id, statut: 'reservee', debutPrevu: pris.debut.toISOString(), finPrevue: pris.fin.toISOString() }];
  const trouve = prochaineDisponibilite({ items, loans, reference: 'hoya-nd', debut: pris.debut, fin: pris.fin, date: NOW, settings: S });
  assert.equal(+trouve.debut, +fromYmd('2026-09-18', 13), 'l’après-midi du même jour');
  assert.equal(+trouve.fin, +fromYmd('2026-09-18', 17));
});

test('prochaineDisponibilite : saute le week-end, et rend null au-delà de deux mois', () => {
  const items = store.items.list((i) => i.reference === 'hoya-nd');
  // Le vendredi après-midi est pris : la suite ouvrée est le lundi matin, pas le samedi.
  const pris = halfDayBounds('2026-09-18', MOMENTS.APRES_MIDI, S);
  const loans = [{ id: 'l1', itemId: items[0].id, statut: 'reservee', debutPrevu: pris.debut.toISOString(), finPrevue: pris.fin.toISOString() }];
  const trouve = prochaineDisponibilite({ items, loans, reference: 'hoya-nd', debut: pris.debut, fin: pris.fin, date: NOW, settings: S });
  assert.equal(+trouve.debut, +fromYmd('2026-09-21', 8), 'le lundi matin');
  // Un emprunt en cours jamais rendu occupe tout l’avenir : il n’y a aucune date à proposer.
  const dehors = [{ id: 'l2', itemId: items[0].id, statut: 'en_cours', debutPrevu: fromYmd('2026-09-16', 8).toISOString(), finPrevue: fromYmd('2026-09-16', 17).toISOString() }];
  assert.equal(prochaineDisponibilite({ items, loans: dehors, reference: 'hoya-nd', debut: pris.debut, fin: pris.fin, date: NOW, settings: S }), null);
});

test('prochaineDisponibilite : un autre exemplaire libre suffit, et la durée reste valide', () => {
  const items = store.items.list((i) => i.reference === 'sd-256');
  assert.ok(items.length >= 2);
  // Rien n’est pris : la première période essayée est déjà la suivante, de même longueur.
  const debut = fromYmd('2026-09-18', 8);
  const fin = fromYmd('2026-09-22', 17); // 5 jours calendaires, sous le maximum de 7
  const trouve = prochaineDisponibilite({ items, loans: [], reference: 'sd-256', debut, fin, date: NOW, settings: S });
  assert.equal(+trouve.debut, +fromYmd('2026-09-18', 13), 'glissée d’une demi-journée');
  assert.equal(+trouve.fin, +fromYmd('2026-09-23', 12), 'et la fin a glissé d’autant');
  // La longueur demandée dépasse le maximum une demi-journée sur deux : la fonction ne rend
  // jamais une période que `canReserveValeur` refuserait pour sa durée.
  const long = prochaineDisponibilite({ items, loans: [], reference: 'sd-256', debut, fin: fromYmd('2026-09-24', 17), date: NOW, settings: S });
  assert.ok(long, 'une période est trouvée');
  assert.ok(isWeekday(long.debut) && isWeekday(long.fin), 'retrait et retour tombent un jour ouvré');
  assert.ok(+long.debut > +debut, 'et elle est postérieure à celle demandée');
});
