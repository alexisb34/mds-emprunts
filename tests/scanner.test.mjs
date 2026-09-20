import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, normalizeScanText, resizeToJpeg } from '../js/scanner.js';

test('fitWithin : réduit au grand côté, jamais agrandi, jamais 0', () => {
  assert.deepEqual(fitWithin(1920, 1080, 640), { width: 640, height: 360 });
  assert.deepEqual(fitWithin(1080, 1920, 640), { width: 360, height: 640 });
  assert.deepEqual(fitWithin(320, 240, 640), { width: 320, height: 240 });
  assert.deepEqual(fitWithin(5000, 1, 640), { width: 640, height: 1 });
});

test('normalizeScanText : trim, code objet en majuscules, autres codes intacts', () => {
  assert.equal(normalizeScanText('  mds-0042 '), 'MDS-0042');
  assert.equal(normalizeScanText('LOAN-loan_ab12-XY34ZZ'), 'LOAN-loan_ab12-XY34ZZ');
  assert.equal(normalizeScanText(null), '');
});

test('resizeToJpeg : utilise fitWithin et le canvas fourni par la fabrique', () => {
  const calls = [];
  const ctx = { drawImage: (...a) => calls.push(a) };
  const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL: (type, q) => `${type};q=${q};${canvas.width}x${canvas.height}` };
  const out = resizeToJpeg({ videoWidth: 1280, videoHeight: 960 }, 640, 0.5, () => canvas);
  assert.equal(out, 'image/jpeg;q=0.5;640x480');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1), [0, 0, 640, 480]);
});
