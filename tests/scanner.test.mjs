import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Fausse bibliothèque de scan : installée avant l’import du module (qui lit window.Html5Qrcode à l’appel).
const instances = [];
const tick = () => new Promise((resolve) => setImmediate(resolve));
class FakeHtml5Qrcode {
  constructor(id) { this.id = id; this.stops = 0; this.clears = 0; instances.push(this); }
  async start(_cam, _cfg, onSuccess) { this.onSuccess = onSuccess; await FakeHtml5Qrcode.gate; }
  async stop() { this.stops += 1; }
  clear() { this.clears += 1; }
}
FakeHtml5Qrcode.gate = Promise.resolve();
globalThis.window = { Html5Qrcode: FakeHtml5Qrcode };

const { fitWithin, normalizeScanText, resizeToJpeg, startScanner, stopScanner } = await import('../js/scanner.js');

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

test('stopScanner pendant le démarrage : ce qui vient d’être lancé est arrêté, les lectures tardives sont ignorées', async () => {
  instances.length = 0;
  let release;
  FakeHtml5Qrcode.gate = new Promise((resolve) => { release = resolve; });
  const codes = [];
  const started = startScanner('x', (t) => codes.push(t));
  await tick(); // start() de la bibliothèque est en cours
  const stopped = stopScanner();
  release();
  FakeHtml5Qrcode.gate = Promise.resolve();
  await Promise.all([started, stopped]);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].stops, 1);
  assert.equal(instances[0].clears, 1);
  instances[0].onSuccess('mds-0001');
  assert.deepEqual(codes, []);
});

test('stopScanner immédiatement après startScanner : rien n’est démarré', async () => {
  instances.length = 0;
  const codes = [];
  const started = startScanner('x', (t) => codes.push(t));
  const stopped = stopScanner();
  await Promise.all([started, stopped]);
  assert.equal(instances.length, 0);
  assert.deepEqual(codes, []);
});

test('startScanner seul : le callback reçoit le texte normalisé ; stopScanner arrête une seule fois', async () => {
  instances.length = 0;
  const codes = [];
  await startScanner('x', (t) => codes.push(t));
  instances[0].onSuccess(' mds-0042 ');
  assert.deepEqual(codes, ['MDS-0042']);
  await stopScanner();
  await stopScanner();
  assert.equal(instances[0].stops, 1);
  assert.equal(instances[0].clears, 1);
});
