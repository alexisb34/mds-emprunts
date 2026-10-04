// js/admin/handoverModal.js — remise d’un matériel réservé (scan du QR de l’emprunteur ou code court)
// et formulaire de checklist pour la réception.
import { auth } from '../auth.js';
import { escapeHtml, openModal, toast } from '../ui.js';
import { checklistFor } from '../checklists.js';
import { handOver } from '../actions/loans.js';
import { startScanner, stopScanner, hasCamera, normalizeScanText } from '../scanner.js';

export function checklistFormHtml(reference) {
  const lignes = checklistFor(reference);
  return `
    <div class="checklist-admin">
      ${lignes.map((ligne, i) => `
        <div class="checklist-admin__row">
          <label class="checkbox"><input type="checkbox" data-line="${i}" checked> ${escapeHtml(ligne)}</label>
          <input class="input input--sm" placeholder="Problème constaté (optionnel)" data-comment="${i}">
        </div>`).join('')}
    </div>
    <label class="field"><span class="field__label">Commentaire de réception (optionnel)</span><textarea class="textarea" name="commentaire"></textarea></label>`;
}

// `root` : l’élément de la modale. Une ligne décochée = problème ; son champ texte devient le commentaire.
export function readChecklistForm(root, reference) {
  const lignes = checklistFor(reference);
  const checklist = [...root.querySelectorAll('[data-line]')].map((cb) => {
    const i = Number(cb.dataset.line);
    const commentaire = cb.closest('.checklist-admin__row').querySelector(`[data-comment="${i}"]`).value.trim();
    return { ligne: lignes[i], ok: cb.checked, commentaire: cb.checked ? '' : commentaire };
  });
  const c = root.querySelector('[name="commentaire"]');
  return { checklist, commentaire: c ? c.value.trim() : '' };
}

// Modale de remise : la pédago scanne le QR affiché par l’emprunteur, ou saisit son code à 6 caractères.
export function openHandoverModal({ onDone } = {}) {
  const close = openModal({
    title: 'Remettre le matériel',
    onClose: () => { stopScanner(); },
    body: `
      <p class="body-sm text-secondary">Scannez le QR affiché par l’emprunteur, ou saisissez son code de retrait.</p>
      <div id="handover-reader" class="reader reader--admin"></div>
      <label class="field"><span class="field__label">Code de retrait</span><input class="input" name="code" placeholder="AB12CD" autocapitalize="characters" maxlength="24"></label>`,
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: 'Remettre', variant: 'primary',
        onClick: (modal) => {
          try {
            const loan = handOver({ code: modal.querySelector('[name="code"]').value, pedagoId: auth.currentUserId() });
            stopScanner();
            toast('Matériel remis', 'success');
            if (onDone) onDone(loan);
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
    const reader = root.querySelector('#handover-reader');
    if (!reader) return; // modale déjà fermée
    if (!ok) { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; return; }
    startScanner('handover-reader', (text) => {
      input.value = normalizeScanText(text);
      try {
        const loan = handOver({ code: input.value, pedagoId: auth.currentUserId() });
        stopScanner();
        toast('Matériel remis', 'success');
        close();
        if (onDone) onDone(loan);
      } catch (e) {
        toast(e.message, 'error');
      }
    }).catch(() => { reader.innerHTML = '<p class="body-sm">Caméra indisponible : saisissez le code.</p>'; });
  });
  return close;
}
