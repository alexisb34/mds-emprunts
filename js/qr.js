// js/qr.js — codes QR : formats des charges utiles et rendu via vendor/qrcode.min.js
// (bibliothèque globale `QRCode`, chargée par <script> dans les pages qui en ont besoin).
import { ITEM_CODE_RE } from './models.js';

export const LOAN_CODE_RE = /^LOAN-([^-\s]+)-([A-Z0-9]{6})$/;

export function isItemCode(text) {
  return ITEM_CODE_RE.test(String(text || '').trim());
}

export function parseLoanCode(text) {
  const m = LOAN_CODE_RE.exec(String(text || '').trim());
  return m ? { loanId: m[1], code6: m[2] } : null;
}

export function loanQrPayload(loan) {
  return `LOAN-${loan.id}-${loan.codeRetrait}`;
}

// Renvoie false (et affiche le texte brut) si la bibliothèque n’est pas chargée.
export function renderQr(container, text, size = 128) {
  container.innerHTML = '';
  const QR = typeof window !== 'undefined' ? window.QRCode : null;
  if (!QR) {
    container.textContent = text;
    return false;
  }
  new QR(container, { text, width: size, height: size, correctLevel: QR.CorrectLevel.M });
  container.setAttribute('aria-label', `QR code ${text}`);
  return true;
}
