import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, parseCsv } from '../js/admin/csv.js';

const HEADERS = ['prenom', 'nom', 'email'];

test('toCsv : point-virgule, CRLF, guillemets doublés, valeurs absentes', () => {
  const csv = toCsv(HEADERS, [
    { prenom: 'Léa', nom: 'Pezzetti', email: 'lea@x.fr' },
    { prenom: 'Jean "JP"', nom: 'A;B', email: null },
  ]);
  assert.equal(csv, 'prenom;nom;email\r\nLéa;Pezzetti;lea@x.fr\r\n"Jean ""JP""";"A;B";');
});

test('parseCsv : en-têtes en minuscules, BOM, lignes vides, cellules manquantes', () => {
  const rows = parseCsv('﻿Prenom;NOM;Email\r\nLéa;Pezzetti;lea@x.fr\r\n\r\nPaul;Durand\n');
  assert.deepEqual(rows, [
    { prenom: 'Léa', nom: 'Pezzetti', email: 'lea@x.fr' },
    { prenom: 'Paul', nom: 'Durand', email: '' },
  ]);
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual(parseCsv('prenom;nom\n'), []);
});

test('parseCsv : virgule détectée, champ cité contenant séparateur et retour à la ligne', () => {
  assert.deepEqual(parseCsv('prenom,nom\nLéa,"Pez,zetti"'), [{ prenom: 'Léa', nom: 'Pez,zetti' }]);
  assert.deepEqual(parseCsv('prenom;nom\n"Lé\na";B'), [{ prenom: 'Lé\na', nom: 'B' }]);
});

test('aller-retour : ce qui est exporté se relit à l’identique', () => {
  const rows = [{ prenom: 'A;"x"', nom: 'B\nC', email: 'a@b.fr' }];
  assert.deepEqual(parseCsv(toCsv(HEADERS, rows)), rows);
});
