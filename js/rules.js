// js/rules.js — règles temporelles et d'éligibilité. Fonctions pures : elles reçoivent
// les données et la date en paramètres. Seule now() lit les settings du store.
import { store } from './store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, BOOKING_STATES } from './models.js';

export const DEFAULT_SETTINGS = {
  horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }],
  dureeMaxReservationJours: 5,
  fenetreRetraitMinutes: 60,
  bloquerSiRetard: true,
  horlogeDemo: null, // ISO string ou null = temps réel
  heureRetourSelf: 17,
  salle: { heureDebut: 8, heureFin: 17 }, // créneaux 8 … 16 (16 = 16h-17h)
};

export const REASONS = {
  BUREAU_FERME: 'bureau_ferme',
  DEJA_UN_EXEMPLAIRE: 'deja_un_exemplaire',
  INDISPONIBLE: 'indisponible',
  RETARD_EN_COURS: 'retard_en_cours',
  MAUVAIS_CIRCUIT: 'mauvais_circuit',
  DUREE_TROP_LONGUE: 'duree_trop_longue',
  UTILISATEUR_INACTIF: 'utilisateur_inactif',
};

export const REASON_LABELS = {
  bureau_ferme: 'Le bureau des pédago est fermé : retrait possible uniquement aux heures d’ouverture.',
  deja_un_exemplaire: 'Vous avez déjà un exemplaire de ce matériel en cours.',
  indisponible: 'Ce matériel n’est pas disponible actuellement.',
  retard_en_cours: 'Vous avez un emprunt en retard : rendez-le avant d’emprunter à nouveau.',
  mauvais_circuit: 'Ce matériel ne s’emprunte pas de cette façon.',
  duree_trop_longue: 'La durée demandée dépasse le maximum autorisé.',
  utilisateur_inactif: 'Ce compte est désactivé.',
};

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const toDate = (d) => (d instanceof Date ? d : new Date(d));

export function now(settings) {
  const s = settings || store.settings.get();
  return s.horlogeDemo ? new Date(s.horlogeDemo) : new Date();
}

export function isWeekday(date) {
  const w = toDate(date).getDay();
  return w >= 1 && w <= 5;
}

export function isOfficeOpen(date, horaires = DEFAULT_SETTINGS.horaires) {
  const d = toDate(date);
  if (!isWeekday(d)) return false;
  const h = d.getHours() + d.getMinutes() / 60;
  return horaires.some((r) => h >= r.debut && h < r.fin);
}

export function atHour(date, hour, minute = 0) {
  const d = new Date(toDate(date));
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(toDate(date));
  d.setDate(d.getDate() + n);
  return d;
}

export function ymd(date) {
  const d = toDate(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromYmd(s, hour = 0) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

export function selfReturnDeadline(date, heureRetourSelf = DEFAULT_SETTINGS.heureRetourSelf) {
  return atHour(date, heureRetourSelf);
}

// ---- Emprunts ----

export function isLate(loan, date) {
  return loan.statut === LOAN_STATES.EN_COURS && toDate(date) > new Date(loan.finPrevue);
}

export function pickupWindow(loan, fenetreRetraitMinutes = DEFAULT_SETTINGS.fenetreRetraitMinutes) {
  const start = new Date(loan.debutPrevu);
  return { start, end: new Date(start.getTime() + fenetreRetraitMinutes * MIN) };
}

export function isInPickupWindow(loan, date, minutes) {
  const { start, end } = pickupWindow(loan, minutes);
  const d = toDate(date);
  return d >= start && d <= end;
}

export function isExpired(loan, date, minutes) {
  return loan.statut === LOAN_STATES.RESERVEE && toDate(date) > pickupWindow(loan, minutes).end;
}

// ---- Salle photo ----

export function bookingStart(b) {
  return fromYmd(b.date, Math.min(...b.creneaux));
}

export function bookingEnd(b) {
  return fromYmd(b.date, Math.max(...b.creneaux) + 1);
}

export function isBookingActive(b, date) {
  if (b.statut === BOOKING_STATES.ANNULEE || b.statut === BOOKING_STATES.TERMINEE) return false;
  const d = toDate(date);
  return d >= bookingStart(b) && d < bookingEnd(b);
}

export function isExitMissing(b, date) {
  if (b.statut === BOOKING_STATES.ANNULEE || b.etatSortie) return false;
  return toDate(date) > new Date(bookingEnd(b).getTime() + 60 * MIN);
}

export function slotsAreContiguous(creneaux) {
  if (!creneaux || creneaux.length === 0) return false;
  const s = [...creneaux].sort((a, b) => a - b);
  return s.every((v, i) => i === 0 || v === s[i - 1] + 1);
}

export function slotsInRoomHours(creneaux, salle = DEFAULT_SETTINGS.salle) {
  return creneaux.every((h) => Number.isInteger(h) && h >= salle.heureDebut && h < salle.heureFin);
}

export function slotsConflict(bookings, date, creneaux, ignoreId = null) {
  return bookings.some(
    (b) => b.id !== ignoreId
      && b.date === date
      && b.statut !== BOOKING_STATES.ANNULEE
      && b.creneaux.some((h) => creneaux.includes(h)),
  );
}

// ---- Éligibilité ----

const ACTIVE_LOAN_STATES = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

export function activeLoans(loans, userId) {
  return loans.filter((l) => l.userId === userId && ACTIVE_LOAN_STATES.includes(l.statut));
}

export function hasActiveLoanOfReference(loans, items, userId, reference) {
  const refOf = new Map(items.map((i) => [i.id, i.reference]));
  return activeLoans(loans, userId).some((l) => refOf.get(l.itemId) === reference);
}

export function userHasLateLoan(loans, userId, date) {
  return loans.some((l) => l.userId === userId && isLate(l, date));
}

function commonChecks({ item, user, loans, items, settings, date, circuit }) {
  if (!user || user.actif === false) return REASONS.UTILISATEUR_INACTIF;
  if (item.circuit !== circuit) return REASONS.MAUVAIS_CIRCUIT;
  if (item.etat !== ITEM_STATES.DISPONIBLE) return REASONS.INDISPONIBLE;
  if (circuit === CIRCUITS.SELF && !isOfficeOpen(date, settings.horaires)) return REASONS.BUREAU_FERME;
  if (hasActiveLoanOfReference(loans, items, user.id, item.reference)) return REASONS.DEJA_UN_EXEMPLAIRE;
  if (settings.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return REASONS.RETARD_EN_COURS;
  return null;
}

export function canBorrowSelf(ctx) {
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.SELF });
  return { ok: reason === null, reason };
}

export function canReserveValeur(ctx) {
  const { debutPrevu, finPrevue, settings } = ctx;
  const days = (toDate(finPrevue) - toDate(debutPrevu)) / DAY;
  if (days < 0 || days > settings.dureeMaxReservationJours) {
    return { ok: false, reason: REASONS.DUREE_TROP_LONGUE };
  }
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.VALEUR });
  return { ok: reason === null, reason };
}
