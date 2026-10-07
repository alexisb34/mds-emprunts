import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS } from '../js/mobile/scanFlow.js';
import { scanStepHtml, returnListHtml, stepperHtml, headerTitle, loaderStepHtml, photoStepHtml, confirmStepHtml, checklistStepHtml, resultHtml, errorHtml, friendlyError } from '../js/mobile/views/scan.js';

const item = { id: 'item_001', code: 'MDS-0001', nom: 'Multiprise #1', reference: 'multiprise', circuit: 'self' };
const PHOTO = 'data:image/jpeg;base64,AAAA';

test('scanStepHtml : lecteur, simulation avec la liste des codes, saisie manuelle', () => {
  const html = scanStepHtml({ codes: [{ code: 'MDS-0001', nom: 'Multiprise #1' }, { code: 'MDS-0029', nom: 'Canon "R10"' }], camera: true });
  assert.match(html, /id="reader"/);
  assert.match(html, /<option value="MDS-0029">MDS-0029 — Canon &quot;R10&quot;<\/option>/);
  assert.match(html, /data-action="simulate"/);
  assert.match(html, /name="code-manual"/);
  assert.match(html, /data-action="manual"/);
  const noCam = scanStepHtml({ codes: [], camera: false });
  assert.match(noCam, /Caméra indisponible/);
  assert.doesNotMatch(noCam, /id="reader"/);
});

test('photoStepHtml : caméra ou image de démonstration selon le contexte', () => {
  const cam = photoStepHtml({ mode: 'emprunt', item, camera: true });
  assert.match(cam, /<video id="video"/);
  assert.match(cam, /data-action="capture"/);
  assert.match(cam, /data-action="placeholder"/);
  assert.match(cam, /Prendre une photo de l’objet/, 'le titre nomme l’action, pas la chose');
  assert.match(cam, /Prendre la photo de l’objet/);
  // Le bouton de prise de vue porte l’icône appareil photo (correctif d’interface).
  assert.match(cam, /data-action="capture"><svg/);
  // Et le fil des étapes situe le parcours : deuxième sur trois.
  assert.match(cam, /aria-label="Étape 2 sur 3"/);
  assert.match(cam, /stepper__dot--done/);
  assert.match(cam, /stepper__dot--active/);
  const noCam = photoStepHtml({ mode: 'retour', item, camera: false });
  assert.doesNotMatch(noCam, /<video/);
  assert.doesNotMatch(noCam, /data-action="capture"/);
  assert.match(noCam, /avant de le rendre/);
});

test('confirmStepHtml : récapitulatif, photo, échéance', () => {
  const html = confirmStepHtml({ item, photo: PHOTO, deadline: new Date(2026, 8, 17, 17, 0) });
  assert.match(html, /Multiprise #1/);
  assert.match(html, /<img class="photo-preview" src="data:image\/jpeg;base64,AAAA"/);
  assert.match(html, /aujourd’hui avant 17h00/);
  assert.match(html, /data-action="confirm-borrow"/);
  assert.match(html, /data-action="cancel"/);
});

test('checklistStepHtml : une ligne par point, état OK/Problème, commentaire', () => {
  const checklist = [{ ligne: 'Câble intact', ok: true, commentaire: '' }, { ligne: 'Interrupteur OK', ok: false, commentaire: 'cassé <b>' }];
  const html = checklistStepHtml({ item, photo: PHOTO, checklist });
  assert.equal((html.match(/checklist__row/g) || []).length, 3); // 2 lignes + 1 modificateur --problem
  assert.match(html, /data-line="0" data-ok="1" class="seg__btn seg__btn--on"/);
  assert.match(html, /checklist__row checklist__row--problem" data-row="1"/);
  assert.match(html, /data-line="1" data-ok="0" class="seg__btn seg__btn--problem"/);
  assert.match(html, /<textarea[^>]*data-comment="1"[^>]*>cassé &lt;b&gt;<\/textarea>/);
  assert.match(html, /data-action="confirm-return"/);
});

test('resultHtml et errorHtml', () => {
  assert.match(resultHtml({ mode: 'emprunt', item, result: { finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() } }), /Emprunt enregistré/);
  assert.match(resultHtml({ mode: 'retour', item, result: { problem: true } }), /la pédago est prévenue/);
  assert.match(resultHtml({ mode: 'retour', item, result: { problem: false } }), /Merci !/);
  const closed = errorHtml({ reason: 'bureau_ferme', error: null, item });
  assert.match(closed, /heures d’ouverture/);
  assert.match(closed, /data-action="restart"/);
  const valeur = errorHtml({ reason: 'mauvais_circuit', error: null, item: { ...item, circuit: 'valeur', reference: 'canon-r10' } });
  assert.match(valeur, /href="#\/catalogue\/canon-r10"/);
  const tech = errorHtml({ reason: null, error: 'Caméra indisponible.', item: null });
  assert.match(tech, /Caméra indisponible\./);
});

test('friendlyError : quota de stockage en français, autres erreurs inchangées', () => {
  assert.match(friendlyError({ name: 'QuotaExceededError' }), /Stockage de démonstration plein/);
  assert.match(friendlyError({ code: 22 }), /Stockage de démonstration plein/);
  assert.equal(friendlyError(new Error('boum')), 'boum');
  assert.equal(friendlyError(null), 'Une erreur est survenue.');
});

test('returnListHtml : un bouton par emprunt en cours, badge de retard, rien si aucun', () => {
  const loans = [
    { loan: { id: 'l1', finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() }, item: { code: 'MDS-0001', nom: 'Multiprise #1' }, late: false },
    { loan: { id: 'l2', finPrevue: new Date(2026, 8, 16, 17, 0).toISOString() }, item: { code: 'MDS-0007', nom: 'Kit tableau <b>' }, late: true },
  ];
  const html = returnListHtml(loans);
  assert.match(html, /Rendre un objet/);
  assert.equal((html.match(/data-return="/g) || []).length, 2);
  assert.match(html, /data-return="MDS-0007"/);
  assert.match(html, /Kit tableau &lt;b&gt;/);
  assert.match(html, /Retour attendu avant 17h00/);
  assert.equal((html.match(/badge--late/g) || []).length, 1);
  assert.equal(returnListHtml([]), '');
});

test('scanStepHtml : la liste de retour est en tête et la simulation disparaît sans objet disponible', () => {
  const returnable = [{ loan: { id: 'l1', finPrevue: new Date(2026, 8, 17, 17, 0).toISOString() }, item: { code: 'MDS-0001', nom: 'Multiprise #1' }, late: false }];
  const html = scanStepHtml({ codes: [{ code: 'MDS-0002', nom: 'Multiprise #2' }], camera: true, returnable });
  assert.ok(html.indexOf('data-return="MDS-0001"') < html.indexOf('id="reader"'), 'le retour direct passe avant le scan');
  assert.match(html, /Emprunter : scannez l’étiquette/);
  const vide = scanStepHtml({ codes: [], camera: true, returnable: [] });
  assert.match(vide, /Aucun objet disponible à emprunter/);
  assert.doesNotMatch(vide, /data-action="simulate"/);
  assert.doesNotMatch(vide, /data-return=/);
  assert.match(vide, /data-action="manual"/);
});

test('errorHtml : pas de bouton « Réserver » quand l’objet est déjà entre les mains de l’emprunteur', () => {
  const valeur = { ...item, circuit: 'valeur', reference: 'canon-r10', nom: 'Canon R10' };
  const refus = errorHtml({ reason: 'rendu_a_la_pedago', error: null, item: valeur });
  assert.match(refus, /se rend directement à la pédago/);
  assert.doesNotMatch(refus, /href="#\/catalogue\/canon-r10"/);
  assert.match(refus, /data-action="restart"/);
  // Un refus « mauvais circuit » (objet qu’il ne détient pas) garde l’aide vers le catalogue.
  const autre = errorHtml({ reason: 'mauvais_circuit', error: null, item: valeur });
  assert.match(autre, /href="#\/catalogue\/canon-r10"/);
});

test('loaderStepHtml : nomme ce qui vient d’être reconnu, et le dit aux lecteurs d’écran', () => {
  const item = { code: 'MDS-0003', nom: 'Multiprise <#3>' };
  const emprunt = loaderStepHtml({ mode: 'emprunt', item });
  assert.match(emprunt, /Multiprise &lt;#3&gt;/, 'le nom est échappé');
  assert.match(emprunt, /Objet reconnu/);
  assert.match(emprunt, /préparation de la photo/);
  // Sans `role=status`, le changement d’écran passe inaperçu d’un lecteur d’écran.
  assert.match(emprunt, /role="status"/);
  assert.match(emprunt, /aria-live="polite"/);
  assert.match(emprunt, /class="spinner"[^>]*aria-hidden="true"/);
  // Au retour, c’est l’emprunt qu’on a retrouvé, pas un objet à prendre.
  assert.match(loaderStepHtml({ mode: 'retour', item }), /Emprunt retrouvé/);
});

test('stepperHtml : où l’on en est, et ce qui reste', () => {
  const premier = stepperHtml(1);
  assert.match(premier, /aria-label="Étape 1 sur 3"/);
  assert.equal((premier.match(/stepper__dot--done/g) || []).length, 0);
  assert.equal((premier.match(/stepper__dot--active/g) || []).length, 1);
  assert.equal((premier.match(/stepper__dot--todo/g) || []).length, 2);
  // Le trait qui suit l’étape en cours est à moitié parcouru, les suivants sont vides.
  assert.equal((premier.match(/stepper__line--half/g) || []).length, 1);
  assert.equal((premier.match(/stepper__line--todo/g) || []).length, 1);

  const dernier = stepperHtml(3);
  assert.equal((dernier.match(/stepper__dot--done/g) || []).length, 2);
  assert.equal((dernier.match(/stepper__line--done/g) || []).length, 2);
  // À la fin du parcours, tout est fait et plus rien n’est en cours.
  const fini = stepperHtml(4);
  assert.equal((fini.match(/stepper__dot--done/g) || []).length, 3);
  assert.doesNotMatch(fini, /stepper__dot--active/);
  assert.match(fini, /aria-label="Étape 3 sur 3"/, 'le libellé ne dépasse pas le total');
});

test('headerTitle : le bandeau nomme l’étape, pas l’écran', () => {
  assert.equal(headerTitle(STEPS.SCAN, 'emprunt'), 'Scanner');
  assert.equal(headerTitle(STEPS.CHARGEMENT, 'emprunt'), 'Scanner');
  assert.equal(headerTitle(STEPS.PHOTO, 'emprunt'), 'Prendre une photo');
  assert.equal(headerTitle(STEPS.CONFIRM, 'emprunt'), 'Confirmer l’emprunt');
  assert.equal(headerTitle(STEPS.CHECKLIST, 'retour'), 'Rendre le matériel');
  assert.equal(headerTitle(STEPS.DONE, 'emprunt'), 'Matériel emprunté');
  assert.equal(headerTitle(STEPS.DONE, 'retour'), 'Matériel rendu');
  assert.equal(headerTitle(STEPS.ERREUR, 'emprunt'), 'Scanner', 'un refus n’est pas une étape');
});
