// js/admin/handoverModal.js — remise d’un matériel réservé (scan du QR de l’emprunteur ou code court)
// et formulaire de checklist pour la réception.
import { auth } from '../auth.js';
import { escapeHtml, toast } from '../ui.js';
import { checklistFor } from '../checklists.js';
import { handOver } from '../actions/loans.js';
import { openScanModal } from '../scanModal.js';

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
// `loan` : l’emprunt de la ligne cliquée. Son code est pré-rempli, et on refuse un code
// qui ne lui correspond pas — sinon le bouton d’une ligne pourrait en remettre une autre.
// `code` : valeur de départ sans emprunt attendu (code tapé dans la recherche globale).
export function openHandoverModal({ loan = null, code = '', onDone } = {}) {
  const attendu = loan ? loan.codeRetrait : null;
  return openScanModal({
    title: 'Remettre le matériel',
    hint: loan
      ? 'Scannez le QR affiché par l’emprunteur, ou vérifiez son code de retrait.'
      : 'Scannez le QR affiché par l’emprunteur, ou saisissez son code de retrait.',
    label: 'Code de retrait',
    placeholder: 'AB12CD',
    readerId: 'handover-reader',
    value: attendu || code || '',
    submitLabel: 'Remettre',
    onCode: (saisi) => {
      const remis = handOver({ code: saisi, pedagoId: auth.currentUserId() });
      if (loan && remis.id !== loan.id) throw new Error('Ce code correspond à une autre réservation.');
      toast('Matériel remis', 'success');
      if (onDone) onDone(remis);
    },
  });
}
