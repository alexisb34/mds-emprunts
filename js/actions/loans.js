// js/actions/loans.js — emprunts : circuit self-service (scan → emprunt / retour) et matériel de valeur (réservation, remise, réception, refus, expiration).
import { store } from '../store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, MAINT_TYPES, MAINT_STATES } from '../models.js';
import {
  now, canBorrowSelf, canReserveValeur, selfReturnDeadline, withDefaults, isLate, sortByDateDesc, pickupWindow, isInPickupWindow, isExpired, ymd, REASONS, REASON_LABELS,
} from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { buildChecklist, hasProblem, problemLines } from '../checklists.js';
import { isItemCode, parseLoanCode } from '../qr.js';
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
    // L’objet peut déjà être en maintenance (intervention pédago pendant l’emprunt) : on ne force l’état
    // que s’il est encore « emprunté ».
    if (item.etat === ITEM_STATES.EMPRUNTE) applyItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE);
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
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  const items = store.items.list();
  const itemOf = (l) => items.find((i) => i.id === l.itemId) || null;
  const mine = store.loans.list((l) => l.userId === userId);
  return {
    enCours: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.EN_COURS), (l) => l.dateRetrait).map((loan) => ({ loan, item: itemOf(loan), late: isLate(loan, date) })),
    reservations: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.RESERVEE), (l) => l.debutPrevu).map((loan) => ({
      loan, item: itemOf(loan),
      window: pickupWindow(loan, minutes),
      pickupOpen: isInPickupWindow(loan, date, minutes),
      expired: isExpired(loan, date, minutes),
    })),
    // Réservations expirées dans les dernières 24 h : l’accueil en informe l’emprunteur
    // (elles ne sont plus dans `reservations`, qui ne contient que les réservations en attente).
    expireesRecentes: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.EXPIREE && (date - pickupWindow(l, minutes).end) < 24 * 60 * 60 * 1000), (l) => l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
    // Réservations refusées dans les dernières 24 h : l’accueil en informe l’emprunteur avec le motif.
    refuseesRecentes: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.REFUSEE && (date - new Date(l.updatedAt)) < 24 * 60 * 60 * 1000), (l) => l.updatedAt).map((loan) => ({ loan, item: itemOf(loan) })),
    historique: sortByDateDesc(mine.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.dateRetrait || l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
  };
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Code court lisible (sans I, L, O, 0, 1) : l’emprunteur peut le dicter si le QR ne passe pas.
export function code6() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

function requireLoan(id) {
  const loan = store.loans.get(id);
  if (!loan) throw new Error(`Emprunt introuvable (${id})`);
  return loan;
}

export function reserveValeur({ itemId, userId, debutPrevu, finPrevue, motif = '' }) {
  const date = now();
  const item = store.items.get(itemId);
  if (!item) throw refusal(REASONS.CODE_INCONNU);
  const user = store.users.get(userId);
  const debut = new Date(debutPrevu);
  const fin = new Date(finPrevue);
  if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) throw new Error('Dates invalides.');
  if (debut < new Date(date.getFullYear(), date.getMonth(), date.getDate())) throw refusal(REASONS.DATE_PASSEE);
  // Une réservation dont la fenêtre de retrait est déjà close serait balayée par expireDueLoans
  // dès le prochain rendu : autant la refuser tout de suite.
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  if (new Date(debut.getTime() + minutes * 60000) < date) throw refusal(REASONS.DATE_PASSEE);
  const loans = store.loans.list();
  // « Un exemplaire par référence » couvre déjà les autres exemplaires, mais le message doit être
  // explicite quand c’est l’emprunteur lui-même qui a déjà réservé cette référence.
  const check = canReserveValeur({ item, user, loans, items: store.items.list(), settings: store.settings.get(), debutPrevu: debut, finPrevue: fin, date });
  if (!check.ok) {
    const sienne = check.reason === REASONS.DEJA_UN_EXEMPLAIRE;
    throw refusal(sienne ? REASONS.DEJA_RESERVE : check.reason);
  }
  return store.transaction(() => {
    const loan = store.loans.create({
      itemId, userId, statut: LOAN_STATES.RESERVEE, motif: String(motif || '').trim(), motifRefus: '', codeRetrait: code6(),
      dateReservation: date.toISOString(), debutPrevu: debut.toISOString(), finPrevue: fin.toISOString(),
      dateRetrait: null, dateRetourReelle: null, remisPar: null, receptionnePar: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
    });
    applyItemState(itemId, ITEM_STATES.RESERVE);
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RESERVEE, itemId, loanId: loan.id, userId, detail: `${item.nom} — ${fullName(user)}` });
    return loan;
  });
}

// La pédago scanne le QR de l’emprunteur (LOAN-…) ou saisit son code court.
export function handOver({ code, pedagoId, date = now() }) {
  const text = String(code || '').trim().toUpperCase();
  const parsed = parseLoanCode(String(code || '').trim());
  // On cherche d’abord une réservation en attente, puis n’importe quel emprunt portant ce code :
  // ainsi un code déjà utilisé donne « plus en attente de remise » et non « code inconnu ».
  const byCode = store.loans.list((l) => l.codeRetrait === text);
  const loan = parsed
    ? store.loans.get(parsed.loanId)
    : (byCode.find((l) => l.statut === LOAN_STATES.RESERVEE) || byCode[0]);
  if (!loan || (parsed && loan.codeRetrait !== parsed.code6)) throw refusal(REASONS.CODE_INCONNU);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus en attente de remise.');
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  if (!isInPickupWindow(loan, date, minutes)) throw refusal(REASONS.FENETRE_RETRAIT);
  const item = store.items.get(loan.itemId);
  const user = store.users.get(loan.userId);
  return store.transaction(() => {
    const updated = store.loans.update(loan.id, { statut: LOAN_STATES.EN_COURS, dateRetrait: date.toISOString(), remisPar: pedagoId });
    applyItemState(item.id, ITEM_STATES.EMPRUNTE);
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_REMISE, itemId: item.id, loanId: loan.id, userId: loan.userId, detail: `${item.nom} remis à ${fullName(user)}` });
    return updated;
  });
}

// Réception par la pédago : checklist complète. Accepte aussi un emprunt self qu’un élève
// n’a pas pu clôturer lui-même (compte désactivé, oubli).
export function receiveLoan({ loanId, pedagoId, checklist = null, commentaire = '' }) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  const item = store.items.get(loan.itemId);
  const date = now();
  const lines = checklist || buildChecklist(item.reference);
  const problem = hasProblem(lines);
  return store.transaction(() => {
    const updated = store.loans.update(loanId, {
      statut: LOAN_STATES.RETOURNEE, dateRetourReelle: date.toISOString(), receptionnePar: pedagoId,
      checklistRetour: lines, commentaire: String(commentaire || '').trim(),
    });
    if (item.etat === ITEM_STATES.EMPRUNTE) applyItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE);
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId: loan.userId, detail: `${item.nom} réceptionné${problem ? ' avec un problème' : ''}` });
    if (!problem) return { loan: updated, maintenance: null };
    const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
    const maintenance = store.maintenance.create({
      itemId: item.id, type: MAINT_TYPES.SIGNALEMENT, auteurId: pedagoId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description: `Signalé à la réception : ${detail}`, prestataire: '', cout: 0, loanId, bookingId: null,
    });
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: item.id, loanId, detail: maintenance.description });
    return { loan: updated, maintenance };
  });
}

function releaseReservation(loan, { statut, action, auteurId, detail, patch = {} }) {
  const item = store.items.get(loan.itemId);
  return store.transaction(() => {
    const updated = store.loans.update(loan.id, { statut, ...patch });
    if (item && item.etat === ITEM_STATES.RESERVE) applyItemState(item.id, ITEM_STATES.DISPONIBLE);
    logAction({ auteurId, action, itemId: loan.itemId, loanId: loan.id, userId: loan.userId, detail });
    return updated;
  });
}

export function refuseLoan(loanId, pedagoId, motifRefus) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus en attente.');
  const motif = String(motifRefus || '').trim();
  if (!motif) throw new Error('Le motif du refus est obligatoire.');
  const item = store.items.get(loan.itemId);
  return releaseReservation(loan, { statut: LOAN_STATES.REFUSEE, action: ACTIONS.LOAN_REFUSEE, auteurId: pedagoId, detail: `${item ? item.nom : loan.itemId} — ${motif}`, patch: { motifRefus: motif } });
}

export function cancelLoan(loanId, userId) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus annulable.');
  if (loan.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  const item = store.items.get(loan.itemId);
  return releaseReservation(loan, { statut: LOAN_STATES.ANNULEE, action: ACTIONS.LOAN_ANNULEE, auteurId: userId, detail: `${item ? item.nom : loan.itemId} — annulée par l’emprunteur` });
}

export function extendLoan(loanId, finPrevue, pedagoId) {
  const loan = requireLoan(loanId);
  if (loan.statut !== LOAN_STATES.EN_COURS) throw new Error('Cet emprunt n’est plus en cours.');
  const fin = new Date(finPrevue);
  if (Number.isNaN(fin.getTime())) throw new Error('Date invalide.');
  if (fin <= new Date(loan.finPrevue)) throw new Error('La nouvelle date doit être postérieure à la date de retour actuelle.');
  const item = store.items.get(loan.itemId);
  return store.transaction(() => {
    const updated = store.loans.update(loanId, { finPrevue: fin.toISOString() });
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_PROLONGEE, itemId: loan.itemId, loanId, userId: loan.userId, detail: `${item ? item.nom : loan.itemId} jusqu’au ${new Date(fin).toLocaleDateString('fr-FR')}` });
    return updated;
  });
}

// Appelé au rendu des vues : libère les réservations non retirées dans la fenêtre. Idempotent.
export function expireDueLoans(date = now()) {
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  const due = store.loans.list((l) => isExpired(l, date, minutes));
  let libérées = 0;
  for (const candidat of due) {
    // Une écriture de la boucle notifie les abonnés, dont un rendu qui rappelle expireDueLoans :
    // on relit l’emprunt pour ne pas rejouer une expiration déjà effectuée.
    const loan = store.loans.get(candidat.id);
    if (!loan || loan.statut !== LOAN_STATES.RESERVEE) continue;
    const item = store.items.get(loan.itemId);
    releaseReservation(loan, { statut: LOAN_STATES.EXPIREE, action: ACTIONS.LOAN_EXPIREE, auteurId: loan.userId, detail: `${item ? item.nom : loan.itemId} — non retiré dans l’heure` });
    libérées += 1;
  }
  return libérées;
}

// Réservations à remettre le jour de `date`, avec leur fenêtre de retrait.
export function pendingHandovers(date = now()) {
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  const items = store.items.list();
  const users = store.users.list();
  const jour = ymd(date);
  return store.loans
    .list((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === jour)
    .sort((a, b) => a.debutPrevu.localeCompare(b.debutPrevu))
    .map((loan) => ({
      loan,
      item: items.find((i) => i.id === loan.itemId) || null,
      user: users.find((u) => u.id === loan.userId) || null,
      window: pickupWindow(loan, minutes),
      open: isInPickupWindow(loan, date, minutes),
    }));
}
