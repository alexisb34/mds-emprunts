// js/admin/handoverModal.js — remise d’un matériel réservé (scan du QR de l’emprunteur ou code court)
// et formulaire de checklist pour la réception.
import { auth } from '../auth.js';
import { escapeHtml, toast } from '../ui.js';
import { checklistFor } from '../checklists.js';
import { handOver } from '../actions/loans.js';
import { parseLoanCode, loanQrPayload } from '../qr.js';
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

// Le code saisi désigne-t-il bien la réservation d’où la modale a été ouverte ?
// À vérifier AVANT `handOver`, qui écrit puis rend l’emprunt : comparer après coup
// remettrait pour de bon une réservation qu’on prétend refuser.
export function codeMatchesLoan(saisi, loan) {
  if (!loan) return true;
  const parsed = parseLoanCode(String(saisi || '').trim());
  if (parsed) return parsed.loanId === loan.id;
  return String(saisi || '').trim().toUpperCase() === loan.codeRetrait;
}

// Un code court tapé dans la recherche globale est-il celui d’un emprunt connu ?
// (Un emprunt déjà remis compte : la remise répondra alors « plus en attente ».)
export function isKnownRetraitCode(code, loans) {
  return loans.some((l) => l.codeRetrait === code);
}

// Refuse le code d’une autre réservation sans rien écrire, puis remet.
export function handOverChecked({ saisi, loan = null, pedagoId }) {
  if (!codeMatchesLoan(saisi, loan)) throw new Error('Ce code correspond à une autre réservation.');
  // Ligne connue : on remet par identifiant plutôt que par code. Rien n’impose l’unicité
  // du code court au tirage (`code6`), et `handOver` prendrait sinon la première
  // réservation en attente portant ce code — pas forcément celle de la ligne.
  return handOver({ code: loan ? loanQrPayload(loan) : saisi, pedagoId });
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
    placeholder: 'AB23CD', // l’alphabet des codes exclut I, L, O, 0 et 1
    readerId: 'handover-reader',
    value: attendu || code || '',
    submitLabel: 'Remettre',
    onCode: (saisi) => {
      const remis = handOverChecked({ saisi, loan, pedagoId: auth.currentUserId() });
      toast('Matériel remis', 'success');
      if (onDone) onDone(remis);
    },
  });
}
