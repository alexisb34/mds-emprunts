// Le commentaire de tête de cadre.js décrit le protocole des cadres. Il disait que le cadre vise
// « ../exemples/… » sans condition : faux depuis l'option `depuisRacine`. Ce test le compare à
// ce que `cadreHtml` rend, pas à lui-même.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cadreHtml } from '../design-system/js/cadre.js';

test('le protocole de cadre.js décrit les deux adresses que cadreHtml produit, pas une seule', () => {
  const source = readFileSync(new URL('../design-system/js/cadre.js', import.meta.url), 'utf8');
  const tete = source.slice(0, source.indexOf('import { estNom'));
  assert.ok(tete.length > 500, 'la tête n’a pas été délimitée : le test ne juge plus rien');
  const src = (html) => html.match(/<iframe[^>]*\bsrc="([^"]+)"/)[1];
  const profond = src(cadreHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 't' }));
  const racine = src(cadreHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 't', depuisRacine: true }));
  assert.equal(profond, '../exemples/bouton.html#variantes');
  assert.equal(racine, 'exemples/bouton.html#variantes');
  assert.ok(tete.includes('`../exemples/<fichier>#<demo>`'), 'la tête ne dit plus l’adresse depuis composants/');
  assert.ok(tete.includes('`exemples/<fichier>#<demo>`'), 'la tête ne dit pas l’adresse depuis la racine de design-system/');
  assert.match(tete, /depuisRacine/, 'la tête ne nomme pas l’option qui choisit entre les deux');
});
