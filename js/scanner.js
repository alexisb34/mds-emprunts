// js/scanner.js — caméra, lecture de QR (vendor/html5-qrcode.min.js, globale Html5Qrcode) et photo.
// Les fonctions pures (fitWithin, normalizeScanText, resizeToJpeg) sont testées sous Node ;
// les autres touchent le DOM/les périphériques et sont vérifiées en navigateur.

export function fitWithin(width, height, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Les étiquettes objets sont imprimées en majuscules ; les codes de retrait (LOAN-…) contiennent
// un identifiant sensible à la casse et ne sont pas modifiés.
export function normalizeScanText(text) {
  const t = String(text || '').trim();
  return /^mds-\d{4}$/i.test(t) ? t.toUpperCase() : t;
}

const defaultCanvas = () => document.createElement('canvas');

export function resizeToJpeg(source, maxSide = 640, quality = 0.72, makeCanvas = defaultCanvas) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  const { width, height } = fitWithin(sw, sh, maxSide);
  const canvas = makeCanvas();
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function capturePhoto(videoEl) {
  return resizeToJpeg(videoEl, 640, 0.72);
}

// Image de démonstration quand aucune caméra n’est disponible (couleurs lues dans les tokens).
export function placeholderPhoto(label) {
  const css = getComputedStyle(document.documentElement);
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = css.getPropertyValue('--brand-primary-subtle').trim() || '#eee';
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = css.getPropertyValue('--brand-primary').trim() || '#000';
  ctx.font = '700 40px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Photo de démonstration', 320, 220);
  ctx.font = '400 28px Inter, sans-serif';
  ctx.fillText(String(label || ''), 320, 280);
  ctx.font = '400 20px Inter, sans-serif';
  ctx.fillText(new Date().toLocaleString('fr-FR'), 320, 330);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export async function hasCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return false;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

let stream = null;
let cameraGen = 0;

export async function startCamera(videoEl) {
  stopCamera();
  const gen = cameraGen;
  const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  // Entre-temps l’utilisateur a pu quitter l’écran : on relâche tout de suite ce qui vient d’être acquis.
  if (gen !== cameraGen) { media.getTracks().forEach((t) => t.stop()); throw new Error('Caméra annulée.'); }
  stream = media;
  videoEl.srcObject = media;
  await videoEl.play();
}

export function stopCamera() {
  cameraGen += 1;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

let scanner = null;
let scannerOp = Promise.resolve(); // chaîne d’opérations : jamais de start et de stop en parallèle
let scannerGen = 0;

// elementId : id d’un conteneur vide ; onCode reçoit le texte normalisé à chaque lecture.
export function startScanner(elementId, onCode) {
  const gen = ++scannerGen;
  scannerOp = scannerOp.then(async () => {
    const Lib = typeof window !== 'undefined' ? window.Html5Qrcode : null;
    if (!Lib) throw new Error('Bibliothèque de scan indisponible.');
    if (gen !== scannerGen) return;
    const s = new Lib(elementId, { verbose: false });
    await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (text) => { if (gen === scannerGen) onCode(normalizeScanText(text)); }, () => {});
    // Arrêt demandé pendant le démarrage : on arrête ce qui vient d’être lancé.
    if (gen !== scannerGen) { try { await s.stop(); } catch { /* déjà arrêté */ } try { s.clear(); } catch { /* conteneur retiré */ } return; }
    scanner = s;
  });
  return scannerOp;
}

export function stopScanner() {
  scannerGen += 1;
  scannerOp = scannerOp.then(async () => {
    const s = scanner;
    scanner = null;
    if (!s) return;
    try { await s.stop(); } catch { /* déjà arrêté */ }
    try { s.clear(); } catch { /* conteneur retiré */ }
  }).catch(() => {});
  return scannerOp;
}
