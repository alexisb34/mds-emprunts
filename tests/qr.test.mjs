import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isItemCode, parseLoanCode, loanQrPayload, renderQr } from '../js/qr.js';

test('isItemCode', () => {
  assert.equal(isItemCode('MDS-0042'), true);
  assert.equal(isItemCode(' MDS-0042 '), true);
  assert.equal(isItemCode('MDS-42'), false);
  assert.equal(isItemCode('LOAN-x-ABCDEF'), false);
  assert.equal(isItemCode(null), false);
});

test('loanQrPayload et parseLoanCode sont symétriques', () => {
  const payload = loanQrPayload({ id: 'loan_001', codeRetrait: 'AB12CD' });
  assert.equal(payload, 'LOAN-loan_001-AB12CD');
  assert.deepEqual(parseLoanCode(payload), { loanId: 'loan_001', code6: 'AB12CD' });
  assert.deepEqual(parseLoanCode(' LOAN-loan_kx9abc-ZZ9999 '), { loanId: 'loan_kx9abc', code6: 'ZZ9999' });
  assert.equal(parseLoanCode('LOAN-abc'), null);
  assert.equal(parseLoanCode('MDS-0001'), null);
});

test('renderQr sans bibliothèque : repli texte, renvoie false', () => {
  const calls = [];
  const c = { innerHTML: 'x', textContent: '', setAttribute: (k, v) => calls.push([k, v]) };
  assert.equal(renderQr(c, 'MDS-0001'), false);
  assert.equal(c.innerHTML, '');
  assert.equal(c.textContent, 'MDS-0001');
});
