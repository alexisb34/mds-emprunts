// js/actions/loans.js — emprunts : circuit self-service (scan → emprunt / retour) et matériel de valeur (réservation, remise, réception, refus, expiration).
import { store } from '../store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, LOAN_TRANSITIONS, assertTransition } from '../models.js';
import {
  now, returnHour, canBorrowSelf, canReserveValeur, selfReturnDeadline, withDefaults, isLate, sortByDateDesc, pickupWindow, isInPickupWindow, isExpired, occupiesWindow, UNAVAILABLE_REASON, REASONS, reasonLabel,
} from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { reportIssue, resolveItemState } from './maintenance.js';
import { buildChecklist, hasProblem, problemLines } from '../checklists.js';
import { isItemCode, parseLoanCode, CODE_ALPHABET } from '../qr.js';
import { fullName } from '../ui.js';

const ACTIVE = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

// La photo atteste de l’état de l’objet : aucune action d’emprunt ou de retour sans elle (spec §5.1).
function assertPhoto(photo) {
  if (typeof photo !== 'string' || !photo.startsWith('data:image/')) throw new Error('Une photo de l’objet est obligatoire.');
}

function refusal(reason) {
  // Le libellé cite les horaires RÉGLÉS : un message figé mentirait dès que la pédago les change.
  return Object.assign(new Error(reasonLabel(reason, store.settings.get()) || reason), { reason });
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
  const heure = returnHour(store.settings.get());
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
    const updated = setLoanStatus(loanId, LOAN_STATES.RETOURNEE, { dateRetourReelle: date.toISOString(), photoRetour: photo, checklistRetour: lines });
    // L’objet peut déjà être en maintenance (intervention pédago pendant l’emprunt) : on ne force l’état
    // que s’il est encore « emprunté ».
    // Un signalement déposé pendant l’emprunt immobilise l’objet à son retour même si la
    // checklist est propre : `resolveItemState` ne le remet au catalogue que si rien n’est ouvert.
    if (item.etat === ITEM_STATES.EMPRUNTE) applyItemState(item.id, resolveItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE));
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId, detail: `${item.nom} rendu${problem ? ' avec un problème' : ''}` });
    if (!problem) return { loan: updated, maintenance: null };
    const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
    const maintenance = reportIssue({
      itemId: item.id, auteurId: userId,
      description: `Signalé au retour : ${detail}`,
      loanId, immobiliser: false, date,
    });
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
    // Le retrait le plus proche en premier.
    reservations: mine.filter((l) => l.statut === LOAN_STATES.RESERVEE).sort((a, b) => a.debutPrevu.localeCompare(b.debutPrevu)).map((loan) => ({
      loan, item: itemOf(loan),
      window: pickupWindow(loan, minutes),
      pickupOpen: isInPickupWindow(loan, date, minutes),
      expired: isExpired(loan, date, minutes),
    })),
    // Réservations expirées dans les dernières 24 h : l’accueil en informe l’emprunteur
    // (elles ne sont plus dans `reservations`, qui ne contient que les réservations en attente).
    expireesRecentes: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.EXPIREE && (date - pickupWindow(l, minutes).end) < 24 * 60 * 60 * 1000), (l) => l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
    // Réservations refusées dans les dernières 24 h : l’accueil en informe l’emprunteur avec le motif.
    refuseesRecentes: sortByDateDesc(mine.filter((l) => l.statut === LOAN_STATES.REFUSEE && l.dateRefus && (date - new Date(l.dateRefus)) < 24 * 60 * 60 * 1000), (l) => l.dateRefus).map((loan) => ({ loan, item: itemOf(loan) })),
    historique: sortByDateDesc(mine.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.dateRetrait || l.debutPrevu).map((loan) => ({ loan, item: itemOf(loan) })),
  };
}

// Code court lisible (sans I, L, O, 0, 1) : l’emprunteur peut le dicter si le QR ne passe pas.
export function code6() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');
}

function requireLoan(id) {
  const loan = store.loans.get(id);
  if (!loan) throw new Error(`Emprunt introuvable (${id})`);
  return loan;
}

// Spec §9 : la couche d’actions vérifie les transitions déclarées dans `models.js`.
// Les gardes métier en amont restent : elles donnent le message lisible, la table n’est
// qu’un filet pour un chemin imprévu.
function setLoanStatus(loanId, statut, patch = {}) {
  const loan = requireLoan(loanId);
  assertTransition(LOAN_TRANSITIONS, loan.statut, statut, 'emprunt');
  return store.loans.update(loanId, { statut, ...patch });
}

export function reserveValeur({ reference, userId, debutPrevu, finPrevue, motif = '' }) {
  const date = now();
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
  const items = store.items.list();
  const check = canReserveValeur({ reference, user, loans, items, settings: store.settings.get(), debutPrevu: debut, finPrevue: fin, date });
  if (!check.ok) throw refusal(check.reason);
  // L’exemplaire vient du verdict lui-même : refaire le calcul ici, c’est risquer de tomber
  // sur une autre réponse que celle qui vient d’autoriser la réservation.
  // L’ordre de la liste est l’ordre de création, donc stable.
  const exemplaire = check.libres[0];
  return store.transaction(() => {
    const loan = store.loans.create({
      itemId: exemplaire.id, userId, statut: LOAN_STATES.RESERVEE, motif: String(motif || '').trim(), motifRefus: '', dateRefus: null, codeRetrait: code6(),
      dateReservation: date.toISOString(), debutPrevu: debut.toISOString(), finPrevue: fin.toISOString(),
      dateRetrait: null, dateRetourReelle: null, remisPar: null, receptionnePar: null,
      photoEmprunt: null, photoRetour: null, checklistRetour: null, commentaire: '',
    });
    // Aucun état d’objet n’est écrit : la réservation occupe une période, pas un objet.
    logAction({ auteurId: userId, action: ACTIONS.LOAN_RESERVEE, itemId: exemplaire.id, loanId: loan.id, userId, detail: `${exemplaire.nom} — ${fullName(user)}` });
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
  if (!loan || (parsed && loan.codeRetrait !== parsed.code6)) throw refusal(REASONS.CODE_RETRAIT_INCONNU);
  if (loan.statut !== LOAN_STATES.RESERVEE) throw new Error('Cette réservation n’est plus en attente de remise.');
  const minutes = withDefaults(store.settings.get()).fenetreRetraitMinutes;
  if (!isInPickupWindow(loan, date, minutes)) throw refusal(REASONS.FENETRE_RETRAIT);
  const item = store.items.get(loan.itemId);
  // Réserver n’immobilise plus l’objet : entre la réservation et la remise, il peut être parti
  // avec l’emprunteur du créneau précédent ou avoir été signalé. Sans cette garde, la pédago
  // lirait au comptoir le message brut de la table des transitions.
  if (!item) throw refusal(REASONS.CODE_INCONNU);
  if (item.etat !== ITEM_STATES.DISPONIBLE) throw refusal(UNAVAILABLE_REASON[item.etat] || REASONS.INDISPONIBLE);
  const user = store.users.get(loan.userId);
  return store.transaction(() => {
    const updated = setLoanStatus(loan.id, LOAN_STATES.EN_COURS, { dateRetrait: date.toISOString(), remisPar: pedagoId });
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
    const updated = setLoanStatus(loanId, LOAN_STATES.RETOURNEE, {
      dateRetourReelle: date.toISOString(), receptionnePar: pedagoId,
      checklistRetour: lines, commentaire: String(commentaire || '').trim(),
    });
    // Un signalement déposé pendant l’emprunt immobilise l’objet à son retour même si la
    // checklist est propre : `resolveItemState` ne le remet au catalogue que si rien n’est ouvert.
    if (item.etat === ITEM_STATES.EMPRUNTE) applyItemState(item.id, resolveItemState(item.id, problem ? ITEM_STATES.MAINTENANCE : ITEM_STATES.DISPONIBLE));
    logAction({ auteurId: pedagoId, action: ACTIONS.LOAN_RETOUR, itemId: item.id, loanId, userId: loan.userId, detail: `${item.nom} réceptionné${problem ? ' avec un problème' : ''}` });
    if (!problem) return { loan: updated, maintenance: null };
    const detail = problemLines(lines).map((l) => `${l.ligne}${l.commentaire ? ` → ${l.commentaire}` : ''}`).join(' ; ');
    const maintenance = reportIssue({
      itemId: item.id, auteurId: pedagoId,
      description: `Signalé à la réception : ${detail}`,
      loanId, immobiliser: false, date,
    });
    return { loan: updated, maintenance };
  });
}

function releaseReservation(loan, { statut, action, auteurId, detail, patch = {} }) {
  return store.transaction(() => {
    const updated = setLoanStatus(loan.id, statut, patch);
    // Rien à restituer à l’objet : une réservation n’écrit aucun état, donc sa fin n’en défait aucun.
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
  return releaseReservation(loan, { statut: LOAN_STATES.REFUSEE, action: ACTIONS.LOAN_REFUSEE, auteurId: pedagoId, detail: `${item ? item.nom : loan.itemId} — ${motif}`, patch: { motifRefus: motif, dateRefus: now().toISOString() } });
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
  // Prolonger, c’est occuper une période de plus sur CE exemplaire : la réservation suivante
  // y aurait droit, et c’est la seule écriture qui créait une occupation sans rien demander.
  const date = now();
  const suivante = store.loans.list((l) => l.itemId === loan.itemId && l.id !== loanId
    && occupiesWindow(l, new Date(loan.finPrevue), fin, date));
  if (suivante.length) throw refusal(REASONS.RESERVE_SUR_LA_PERIODE);
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

// Balayage défensif appelé par les vues : une écriture qui échoue (stockage plein) ne doit jamais
// empêcher l’affichage. L’erreur est tracée en console, les données restent cohérentes
// (store.transaction restaure l’état) et le prochain rendu retentera.
export function sweepExpirations(date = now()) {
  try {
    return expireDueLoans(date);
  } catch (e) {
    console.error('Expiration des réservations impossible :', e);
    return 0;
  }
}
