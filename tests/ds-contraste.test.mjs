import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratio, ratioExact, verdict } from '../design-system/js/contraste.js';

test('ratio : valeurs de référence', () => {
  assert.equal(ratio('#ffffff', '#000000'), 21);
  assert.equal(ratio('#662483', '#f0e9f3'), 8.23);   // badge emprunté
  assert.equal(ratio('#faad14', '#fef3d9'), 1.72);   // badge maintenance
  assert.equal(ratio('#757678', '#ffffff'), 4.55);   // texte secondaire sur blanc
  assert.equal(ratio('#AABBCC', '#aabbcc'), 1);      // la casse n'a pas d'effet
});

test('ratioExact ne perd rien, ratio n’arrondit que pour l’affichage', () => {
  assert.ok(Math.abs(ratioExact('#757678', '#ffffff') - 4.5465) < 0.001);
  assert.equal(ratio('#757678', '#ffffff'), 4.55);
});

test('verdict : les bornes de WCAG sont inclusives', () => {
  assert.equal(verdict(4.5, 16, false), 'AA');
  assert.equal(verdict(4.49, 16, false), 'echec');
  assert.equal(verdict(3, 24, false), 'AA-large');    // 18 pt = 24 px
  assert.equal(verdict(3, 23.9, false), 'echec');
  assert.equal(verdict(3, 18.66, true), 'AA-large');  // 14 pt gras = 18,66 px
  assert.equal(verdict(3, 18.65, true), 'echec');
  assert.equal(verdict(3, 18, false), 'echec');       // 18 px non gras n’est PAS du grand texte
});

test('verdict juge sur le ratio non arrondi', () => {
  // 4,496 arrondi donnerait 4,50 et passerait : le piège que cette API évite.
  assert.equal(verdict(4.496, 16, false), 'echec');
});
