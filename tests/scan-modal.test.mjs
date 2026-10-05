import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanModalBodyHtml } from '../js/scanModal.js';

test('scanModalBodyHtml : lecteur, champ de saisie et texte d’aide', () => {
  const html = scanModalBodyHtml({ hint: 'Scannez le QR affiché par l’emprunteur.', label: 'Code de retrait', placeholder: 'AB12CD', readerId: 'handover-reader' });
  assert.match(html, /id="handover-reader"/);
  assert.match(html, /Scannez le QR affiché par l’emprunteur\./);
  assert.match(html, /name="code"/);
  assert.match(html, /placeholder="AB12CD"/);
  assert.match(html, /Code de retrait/);
});

test('scanModalBodyHtml : la valeur de départ pré-remplit le champ', () => {
  const html = scanModalBodyHtml({ hint: 'x', label: 'Code', placeholder: '', readerId: 'r', value: 'AB12CD' });
  assert.match(html, /value="AB12CD"/);
});
