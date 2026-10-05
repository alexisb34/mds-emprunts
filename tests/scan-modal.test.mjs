import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanModalBodyHtml } from '../js/scanModal.js';
import { loanQrPayload, parseLoanCode } from '../js/qr.js';

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

test('scanModalBodyHtml : le champ accepte une charge utile LOAN-… saisie en entier', () => {
  // Un identifiant d’emprunt créé à l’exécution a la forme loan_<horodatage base 36><6 caractères> (voir store.js).
  const loan = { id: `loan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, codeRetrait: 'AB2CD3' };
  const payload = loanQrPayload(loan);
  assert.ok(payload.length > 24, `la charge utile fait ${payload.length} caractères`);
  const max = Number(scanModalBodyHtml({ hint: 'x', label: 'Code', readerId: 'r' }).match(/maxlength="(\d+)"/)[1]);
  assert.ok(max >= payload.length, `maxlength=${max} tronquerait « ${payload} »`);
  assert.ok(parseLoanCode(payload.slice(0, max)), 'saisie tronquée au maxlength : elle doit rester reconnue');
});
