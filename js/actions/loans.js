// js/actions/loans.js — emprunts. Phase 2 : circuit self-service (scan → emprunt / retour).
// Phase 3 ajoutera les réservations de matériel de valeur (remise, réception, expiration).
import { store } from '../store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, MAINT_TYPES, MAINT_STATES } from '../models.js';
import { now, canBorrowSelf, selfReturnDeadline, withDefaults, isLate, sortByDateDesc, REASONS, REASON_LABELS } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { buildChecklist, hasProblem, problemLines } from '../checklists.js';
import { isItemCode } from '../qr.js';
import { fullName } from '../ui.js';

const ACTIVE = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

// La photo atteste de l’état de l’objet : aucune action d’emprunt ou de retour sans elle (spec §5.1).
function assertPhoto(photo) {
  if (typeof photo !== 'string' || !photo.startsWith('data:image/')) throw new Error('Une photo de l’objet est obligatoire.');
}

function refusal(reason) {
  return Object.assign(new Error(REASON_LABELS[reason] || reason), { reason });
}

export function findOpenLoanForItem(itemId) {
  return store.loans.list((l) => l.itemId === itemId && l.statut === LOAN_STATES.EN_COURS)[0] || null;
}

// Que faire de ce code pour cet utilisateur ? retour de son emprunt en cours, nouvel emprunt self, ou refus.
export function resolveScan(code, userId, date = now()) {
  const text = String(code || '').trim();
  const nothing = { item: null, loan: null };
  if (!isItemCode(text)) return { mode: 'erreur', reason: REASONS.CODE_INCONNU, ...nothing };
  const item = store.items.list((i) => i.code === text)[0];
  if (!item) return { mode: 'erreur', reason: REASONS.CODE_INCONNU, ...nothing };
  const loan = findOpenLoanForItem(item.id);
  if (loan && loan.userId === userId) {
    // Seul le self-service se rend par scan : le matériel de valeur passe par la réception pédago (spec §5.2).
    if (item.circuit !== CIRCUITS.SELF) return { mode: 'erreur', item, loan, reason: REASONS.RENDU_A_LA_PEDAGO };
    return { mode: 'retour', item, loan, reason: null };
  }
  const user = store.users.get(userId);
  const check = canBorrowSelf({ item, user, loans: store.loans.list(), items: store.items.list(), settings: store.settings.get(), date });
  if (!check.ok) return { mode: 'erreur', item, loan, reason: check.reason };
  return { mode: 'emprunt', item, loan: null, reason: null };
}

export function borrowSelf({ itemCode, userId, photo = null }) {
  const date = now();
  const r = resolveScan(itemCode, userId, date);
  if (r.mode !== 'emprunt') throw refusal(r.reason || REASONS.INDISPONIBLE);
  assertPhoto(photo);
  const { item } = r;
  const user = store.users.get(userId);
  const heure = withDefaults(store.settings.get()).heureRetourSelf;
  return store.transaction(() => {
    const loan = store.loans.create({
      itemId: item.id, userId, statut: LOAN_STATES.EN_COURS, motif: '', motifRefus: '', codeRetrait: null,
      dateReservation: date.toISOString(), debutPrevu: date.toISOString(), finPrevue: selfReturnDeadline(date, heure).toISOString(),
      dateRetrait: date.toISOString(), dateRetourReelle: null, remisPar: null, receptionnePar: null,
      photoEmprunt: photo, photoRetour: null, checklistRetour: null, commentaire: '',
    });
    applyItemState(item.id, ITEM_STATES.EMPRUNTE);
    logAction({ auteurId: userId, action: ACTIONS.LOAN_EMPRUNT, itemId: item.id, loanId: loan.id, userId, detail: `${item.nom} — ${fullName(user)}` });
    return loan;
  });
}

// Le retour est toujours possible (pas de contrôle d’horaires) ; un problème coché crée un signalement.
export function returnSelf({ loanId, userId, photo = null, checklist = null }) {
  const loan = store.loans.get(loanId);
  if (!loan) throw new Error(`Emprunt introuvable (${loanId})`);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  if (loan.userId !== userId) throw new Error('Cet emprunt ne vous appartient pas.');
  const item = store.items.get(loan.itemId);
  if (item.circuit !== CIRCUITS.SELF) throw refusal(REASONS.RENDU_A_LA_PEDAGO);
  assertPhoto(photo);
  const date = now();
  const lines = checklist || buildChecklist(item.reference);
  const problem = hasProblem(lines);
  return store.transaction(() => {
    const updated = store.loans.update(loanId, { statut: LOAN_STATES.RETOURNEE, dateRetourReelle: date.toISOString(), photoRetour: photo, checklistRetour: lines });
    applyItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE);
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId, detail: `${item.nom} rendu${problem ? ' avec un problème' : ''}` });
    if (!problem) return { loan: updated, maintenance: null };
    const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
    const maintenance = store.maintenance.create({
      itemId: item.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: userId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description: `Signalé au retour : ${detail}`, prestataire: '', cout: 0, loanId, bookingId: null,
    });
    logAction({ auteurId: userId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: item.id, loanId, detail: maintenance.description });
    return { loan: updated, maintenance };
  });
}

export function userLoans(userId, date = now()) {
  const items = store.items.list();
  const itemOf = (l) => items.find((i) => i.id === l.itemId) || null;
  const mine = store.loans.list((l) => l.userId === userId);
  return {
    enCours: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.EN_COURS), (l) => l.dateRetrait).map((loan) => ({ loan, item: itemOf(loan), late: isLate(loan, date) })),
    reservations: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.RESERVEE), (l) => l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
    historique: sortByDateDesc(mine.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.finPrevue).map((loan) => ({ loan, item: itemOf(loan) })),
  };
}
