// js/actions/bookings.js — réservations de la salle photo et états des lieux.
// Réserver la salle vaut responsabilité de son contenu (spec §5.3) : le matériel « salle »
// ne fait pas l’objet d’emprunts individuels, il est contrôlé à l’entrée et à la sortie.
import { store } from '../store.js';
import { BOOKING_STATES, CIRCUITS, ITEM_STATES, MAINT_TYPES, MAINT_STATES, ROLES } from '../models.js';
import { now, ymd, bookingStart, bookingEnd, isBookingActive, sortByDateDesc, REASONS, reasonLabel } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';
import { buildRoomChecklist, hasProblem, problemLines } from '../checklists.js';
import { selectionIsValid, startOfWeek, weekDays } from '../weekGrid.js';
import { fullName, formatSlots } from '../ui.js';

function refusal(reason) {
  // Le libellé cite les horaires RÉGLÉS : un message figé mentirait dès que la pédago les change.
  return Object.assign(new Error(reasonLabel(reason, store.settings.get()) || reason), { reason });
}

function requireBooking(id) {
  const booking = store.bookings.get(id);
  if (!booking) throw new Error(`Réservation introuvable (${id})`);
  return booking;
}

export function roomItems() {
  return store.items.list((i) => i.circuit === CIRCUITS.SALLE && i.etat !== ITEM_STATES.HS);
}

export function roomChecklist() {
  return buildRoomChecklist(roomItems());
}

export function createBooking({ userId, date, creneaux }) {
  const maintenant = now();
  const user = store.users.get(userId);
  if (!user || user.actif === false) throw refusal(REASONS.UTILISATEUR_INACTIF);
  const check = selectionIsValid({ ymd: date, creneaux: [...creneaux] }, { bookings: store.bookings.list(), settings: store.settings.get(), date: maintenant });
  if (!check.ok) throw refusal(check.reason);
  const ordonnes = [...creneaux].sort((a, b) => a - b);
  return store.transaction(() => {
    const booking = store.bookings.create({
      userId, date, creneaux: ordonnes, statut: BOOKING_STATES.A_VENIR, etatEntree: null, etatSortie: null,
    });
    logAction({ auteurId: userId, action: ACTIONS.BOOKING_CREEE, bookingId: booking.id, userId, detail: `Salle photo ${formatSlots(ordonnes)} — ${fullName(user)}` });
    return booking;
  });
}

export function cancelBooking(id, auteurId) {
  const booking = requireBooking(id);
  if (booking.statut !== BOOKING_STATES.A_VENIR && booking.statut !== BOOKING_STATES.EN_COURS) throw new Error('Cette réservation n’est plus annulable.');
  // Spec §5.3 : l’emprunteur annule tant que le créneau n’a pas commencé ; la pédago à tout moment.
  const auteur = store.users.get(auteurId);
  const estPedago = auteur && auteur.role === ROLES.PEDAGO;
  if (!estPedago) {
    if (booking.userId !== auteurId) throw new Error('Cette réservation ne vous appartient pas.');
    if (now() >= bookingStart(booking)) throw new Error('Le créneau a commencé : prévenez la pédago pour l’annuler.');
  }
  return store.transaction(() => {
    const updated = store.bookings.update(id, { statut: BOOKING_STATES.ANNULEE });
    logAction({ auteurId, action: ACTIONS.BOOKING_ANNULEE, bookingId: id, userId: booking.userId, detail: `Salle photo ${formatSlots(booking.creneaux)} du ${booking.date}` });
    return updated;
  });
}

// Un état des lieux : horodaté, enregistré tel quel, et tout problème ouvre un signalement
// par objet concerné (l’objet passe en maintenance). La ligne globale « salle rangée »
// n’a pas d’itemId : son problème est signalé sans changement d’état.
function recordEtatDesLieux({ booking, userId, checklist, moment }) {
  const date = now();
  const lignes = checklist || roomChecklist();
  const problem = hasProblem(lignes);
  const entree = moment === 'entree';
  const patch = entree
    ? { statut: BOOKING_STATES.EN_COURS, etatEntree: { date: date.toISOString(), lignes } }
    : { statut: BOOKING_STATES.TERMINEE, etatSortie: { date: date.toISOString(), lignes } };
  return store.transaction(() => {
    const updated = store.bookings.update(booking.id, patch);
    logAction({
      auteurId: userId, action: entree ? ACTIONS.BOOKING_ENTREE : ACTIONS.BOOKING_SORTIE,
      bookingId: booking.id, userId: booking.userId,
      detail: `État des lieux ${entree ? 'd’entrée' : 'de sortie'}${problem ? ' — problème signalé' : ' OK'}`,
    });
    if (!problem) return { booking: updated, maintenance: null };
    const lignesProblemes = problemLines(lignes);
    const libelleMoment = entree ? 'd’entrée' : 'de sortie';
    const events = lignesProblemes.map((ligne) => {
      const description = `Signalé à l’état des lieux ${libelleMoment} : ${ligne.ligne}${ligne.commentaire ? ` → ${ligne.commentaire}` : ''}`;
      const event = store.maintenance.create({
        itemId: ligne.itemId || null, type: MAINT_TYPES.SIGNALEMENT, auteurId: userId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
        description, prestataire: '', cout: 0, loanId: null, bookingId: booking.id,
      });
      const item = ligne.itemId ? store.items.get(ligne.itemId) : null;
      if (item && item.etat === ITEM_STATES.DISPONIBLE) applyItemState(item.id, ITEM_STATES.MAINTENANCE);
      logAction({ auteurId: userId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: ligne.itemId || null, bookingId: booking.id, detail: description });
      return event;
    });
    // `maintenance` reste le premier signalement (interface inchangée pour les vues) ;
    // `maintenances` donne la liste complète.
    return { booking: updated, maintenance: events[0], maintenances: events };
  });
}

export function recordEntry({ bookingId, userId, checklist = null }) {
  const booking = requireBooking(bookingId);
  if (booking.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  if (booking.statut === BOOKING_STATES.ANNULEE || booking.statut === BOOKING_STATES.TERMINEE) throw new Error('Cette réservation est close.');
  if (booking.etatEntree) throw new Error('L’état des lieux d’entrée a déjà été fait.');
  const date = now();
  if (date < bookingStart(booking)) throw new Error('Le créneau n’a pas encore commencé.');
  if (date >= bookingEnd(booking)) throw refusal(REASONS.CRENEAU_PASSE);
  return recordEtatDesLieux({ booking, userId, checklist, moment: 'entree' });
}

export function recordExit({ bookingId, userId, checklist = null }) {
  const booking = requireBooking(bookingId);
  if (booking.userId !== userId) throw new Error('Cette réservation ne vous appartient pas.');
  // L’ordre compte : sans entrée la réservation est encore `a_venir`, et le message utile
  // est « faites d’abord l’entrée », pas « plus en cours ».
  if (booking.statut === BOOKING_STATES.ANNULEE || booking.statut === BOOKING_STATES.TERMINEE) throw new Error('Cette réservation n’est plus en cours.');
  if (!booking.etatEntree) throw new Error('Faites d’abord l’état des lieux d’entrée.');
  if (booking.statut !== BOOKING_STATES.EN_COURS) throw new Error('Cette réservation n’est plus en cours.');
  return recordEtatDesLieux({ booking, userId, checklist, moment: 'sortie' });
}

// Clôture les créneaux terminés : une réservation jamais ouverte ou dont la sortie a été faite
// passe `terminee`. Celles dont la sortie manque restent `en_cours` et remontent via `isExitMissing`.
export function closeDueBookings(date = now()) {
  const dues = store.bookings.list((b) => (b.statut === BOOKING_STATES.A_VENIR || b.statut === BOOKING_STATES.EN_COURS) && date >= bookingEnd(b) && !b.etatEntree);
  if (!dues.length) return 0;
  let closes = 0;
  // Une seule transaction pour tout le balayage : une persistance, une notification. Une
  // transaction par réservation relançait N rendus imbriqués (la vue est l’abonné qui balaie).
  // Si une écriture échoue, les clôtures déjà faites sont annulées avec elle : le balayage
  // suivant reprend le tout.
  return store.transaction(() => {
    for (const candidat of dues) {
      const booking = store.bookings.get(candidat.id);
      if (!booking || booking.etatEntree || booking.statut === BOOKING_STATES.TERMINEE || booking.statut === BOOKING_STATES.ANNULEE) continue;
      store.bookings.update(booking.id, { statut: BOOKING_STATES.TERMINEE });
      logAction({ auteurId: booking.userId, action: ACTIONS.BOOKING_SORTIE, bookingId: booking.id, userId: booking.userId, detail: `Créneau ${formatSlots(booking.creneaux)} terminé — salle non occupée` });
      closes += 1;
    }
    return closes;
  });
}

// Clôture administrative d’un créneau dont l’état des lieux de sortie n’a jamais été fait :
// la pédago constate l’état de la salle elle-même et retire l’alerte.
export function forceCloseBooking(id, pedagoId) {
  const booking = requireBooking(id);
  // Même garde que cancelBooking : la clôture d’office est un geste de la pédago, on ne
  // s’appuie pas uniquement sur la garde de route de l’admin.
  const auteur = store.users.get(pedagoId);
  if (!auteur || auteur.role !== ROLES.PEDAGO) throw new Error('Seule la pédagogie peut clore un créneau.');
  if (booking.statut !== BOOKING_STATES.EN_COURS) throw new Error('Ce créneau n’est pas en cours.');
  return store.transaction(() => {
    const updated = store.bookings.update(id, { statut: BOOKING_STATES.TERMINEE });
    logAction({ auteurId: pedagoId, action: ACTIONS.BOOKING_SORTIE, bookingId: id, userId: booking.userId, detail: `Créneau ${formatSlots(booking.creneaux)} clos par la pédagogie — état des lieux de sortie manquant` });
    return updated;
  });
}

// Balayage défensif appelé par les vues et les gardes : une écriture qui échoue
// (stockage plein) ne doit jamais empêcher l’affichage.
export function sweepBookings(date = now()) {
  try {
    return closeDueBookings(date);
  } catch (e) {
    console.error('Clôture des créneaux impossible :', e);
    return 0;
  }
}

export function userBookings(userId, date = now()) {
  const mine = store.bookings.list((b) => b.userId === userId && b.statut !== BOOKING_STATES.ANNULEE);
  // Un créneau terminé dont la sortie manque reste « actif » pour l’emprunteur : c’est le seul
  // endroit d’où il peut encore faire son état des lieux de sortie.
  // On privilégie le créneau réellement en cours à cet instant ; un créneau plus ancien resté
  // ouvert ne vient qu’en second, sinon il masquerait la réservation du moment.
  const active = mine.find((b) => isBookingActive(b, date))
    || mine.find((b) => b.statut === BOOKING_STATES.EN_COURS && !b.etatSortie)
    || null;
  const today = ymd(date);
  return {
    active: active ? { booking: active, entreeFaite: !!active.etatEntree, sortieFaite: !!active.etatSortie } : null,
    aVenir: mine.filter((b) => b.statut === BOOKING_STATES.A_VENIR && b.date >= today && b.id !== active?.id).sort((a, b) => a.date.localeCompare(b.date) || a.creneaux[0] - b.creneaux[0]),
    passees: sortByDateDesc(mine.filter((b) => b.statut === BOOKING_STATES.TERMINEE), (b) => b.date),
  };
}

export function weekBookings(date) {
  const jours = weekDays(startOfWeek(date), date).map((d) => d.ymd);
  return store.bookings.list((b) => jours.includes(b.date));
}
