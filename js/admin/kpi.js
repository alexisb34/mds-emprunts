// js/admin/kpi.js — calculs du tableau de bord (fonctions pures sur des tableaux).
import { ITEM_STATES, LOAN_STATES, BOOKING_STATES, MAINT_STATES } from '../models.js';
import { isLate, isExitMissing, ymd } from '../rules.js';

const DAY = 24 * 60 * 60 * 1000;

// « À traiter » : ouvert ou en cours. Même définition que le badge de la barre latérale
// et le sous-titre de l’écran Maintenance.
const aTraiter = (m) => m.statut !== MAINT_STATES.CLOS;

export function computeKpis({ items, loans, bookings, maintenance }, date) {
  const today = ymd(date);
  return {
    disponibles: items.filter((i) => i.etat === ITEM_STATES.DISPONIBLE).length,
    enCours: loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length,
    retards: loans.filter((l) => isLate(l, date)).length,
    reservationsSalle: bookings.filter((b) => b.statut === BOOKING_STATES.A_VENIR && b.date >= today).length,
    signalements: maintenance.filter(aTraiter).length,
    aRemettre: loans.filter((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === today).length,
  };
}

export function joinLoan(loan, items, users) {
  return {
    loan,
    item: items.find((i) => i.id === loan.itemId) || null,
    user: users.find((u) => u.id === loan.userId) || null,
  };
}

export function lateLoans({ loans, items, users }, date) {
  return loans
    .filter((l) => isLate(l, date))
    .map((l) => ({ ...joinLoan(l, items, users), joursRetard: Math.max(1, Math.ceil((date - new Date(l.finPrevue)) / DAY)) }))
    .sort((a, b) => b.joursRetard - a.joursRetard);
}

export function dueTodayReservations({ loans, items, users }, date) {
  const today = ymd(date);
  return loans
    .filter((l) => l.statut === LOAN_STATES.RESERVEE && ymd(l.debutPrevu) === today)
    .map((l) => joinLoan(l, items, users))
    .sort((a, b) => a.loan.debutPrevu.localeCompare(b.loan.debutPrevu));
}

export function openReports({ maintenance, items, users }) {
  return maintenance
    .filter(aTraiter)
    .map((event) => ({
      event,
      item: items.find((i) => i.id === event.itemId) || null,
      auteur: users.find((u) => u.id === event.auteurId) || null,
    }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date));
}

// Créneaux dont l’état des lieux de sortie manque depuis plus d’une heure (spec §6).
export function exitMissingRows(bookings, users, date) {
  return bookings
    .filter((b) => b.statut === BOOKING_STATES.EN_COURS && isExitMissing(b, date))
    .map((booking) => ({ booking, user: users.find((u) => u.id === booking.userId) || null }))
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date));
}
