import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKLISTS, SALLE_GLOBAL_LINE, checklistFor, buildChecklist, buildRoomChecklist, hasProblem, problemLines } from '../js/checklists.js';

const REFERENCES = [
  'multiprise', 'kit-tableau', 'casque-audio', 'clavier', 'souris',
  'newer-eclairage', 'newer-led', 'leofoto-trepied', 'mini-studio', 'sac-beschoi',
  'canon-r10', 'dji-rsc2', 'tascam-dr70', 'zoom-h5', 'sd-256', 'sd-32', 'lpe17', 'hoya-nd', 'sennheiser', 'at-streaming',
];

test('toutes les références du spec ont une checklist non vide', () => {
  for (const r of REFERENCES) assert.ok(CHECKLISTS[r]?.length > 0, r);
});

test('kit tableau : 4 lignes dont les stylos', () => {
  const lines = checklistFor('kit-tableau');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /4 stylos/);
});

test('checklistFor renvoie [] pour une référence inconnue', () => {
  assert.deepEqual(checklistFor('inconnu'), []);
});

test('buildChecklist initialise toutes les lignes à OK', () => {
  const c = buildChecklist('multiprise');
  assert.equal(c.length, 3);
  assert.deepEqual(c[0], { ligne: "Câble intact", ok: true, commentaire: '' });
  assert.equal(hasProblem(c), false);
});

test('hasProblem et problemLines', () => {
  const c = buildChecklist('souris');
  c[0].ok = false; c[0].commentaire = 'clic gauche mort';
  assert.equal(hasProblem(c), true);
  assert.deepEqual(problemLines(c).map((l) => l.ligne), ["Clic et molette OK"]);
});

test('buildRoomChecklist : une ligne par item salle + ligne globale', () => {
  const items = [
    { id: 'i1', reference: 'leofoto-trepied', nom: 'Trépied LeoFoto' },
    { id: 'i2', reference: 'sac-beschoi', nom: 'Sac à dos Beschoi' },
  ];
  const c = buildRoomChecklist(items);
  assert.equal(c.length, 3);
  assert.equal(c[0].itemId, 'i1');
  assert.match(c[0].ligne, /^Trépied LeoFoto — /);
  assert.equal(c[2].itemId, null);
  assert.equal(c[2].ligne, SALLE_GLOBAL_LINE);
});
