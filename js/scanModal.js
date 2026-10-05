// js/scanModal.js — la modale « scannez le QR, ou saisissez le code » : le lecteur, le champ,
// l’anti-répétition des erreurs et la libération de la caméra. Deux écrans l’utilisent déjà
// (remise d’un matériel de valeur, recherche par code) ; elle n’a pas à être réécrite à chaque fois.
import { escapeHtml, openModal, toast } from './ui.js';
import { startScanner, stopScanner, hasCamera, normalizeScanText } from './scanner.js';

export function scanModalBodyHtml({ hint, label, placeholder = '', readerId, value = '' }) {
  return `
    <p class="body-sm text-secondary">${escapeHtml(hint)}</p>
    <div id="${escapeHtml(readerId)}" class="reader reader--admin"></div>
    <label class="field"><span class="field__label">${escapeHtml(label)}</span><input class="input" name="code" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocapitalize="characters" maxlength="48"></label>`;
}

/**
 * `onCode(code, { close })` est appelé au scan ET à la validation ; il lève pour refuser.
 * Au scan, une erreur s’affiche en toast (sans se répéter) et la modale reste ouverte ;
 * à la validation, elle s’affiche et la modale reste ouverte aussi.
 */
export function openScanModal({ title, hint, label = 'Code', placeholder = '', readerId = 'scan-reader', value = '', submitLabel = 'Valider', onCode }) {
  // Le scanner relit le même QR plusieurs fois par seconde : on n’affiche pas deux fois
  // la même erreur à moins de 3 secondes d’intervalle.
  let dernierMessage = '';
  let dernierAffichage = 0;
  const signaler = (message) => {
    const t = Date.now();
    if (message === dernierMessage && t - dernierAffichage < 3000) return;
    dernierMessage = message;
    dernierAffichage = t;
    toast(message, 'error');
  };
  const close = openModal({
    title,
    onClose: () => { stopScanner(); },
    body: scanModalBodyHtml({ hint, label, placeholder, readerId, value }),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: submitLabel, variant: 'primary',
        onClick: (modal) => {
          try {
            onCode(modal.querySelector('[name="code"]').value, { close });
            stopScanner();
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        },
      },
    ],
  });
  const root = document.getElementById('modal-root');
  const input = root.querySelector('[name="code"]');
  input.focus();
  hasCamera().then((ok) => {
    const reader = root.querySelector(`#${readerId}`);
    if (!reader) return; // modale déjà fermée
    if (!ok) { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; return; }
    startScanner(readerId, (text) => {
      input.value = normalizeScanText(text);
      try {
        onCode(input.value, { close });
        stopScanner();
        close();
      } catch (e) {
        signaler(e.message);
      }
    }).catch(() => { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; });
  });
  return close;
}
