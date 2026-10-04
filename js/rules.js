// js/rules.js — règles temporelles et d’éligibilité. Fonctions pures : elles reçoivent
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
  EMPRUNTE_PAR_AUTRE: 'emprunte_par_autre',
  RESERVE_PAR_AUTRE: 'reserve_par_autre',
  EN_MAINTENANCE: 'en_maintenance',
  HORS_SERVICE: 'hors_service',
  RETARD_EN_COURS: 'retard_en_cours',
  MAUVAIS_CIRCUIT: 'mauvais_circuit',
  DUREE_TROP_LONGUE: 'duree_trop_longue',
  UTILISATEUR_INACTIF: 'utilisateur_inactif',
  CODE_INCONNU: 'code_inconnu',
  CODE_RETRAIT_INCONNU: 'code_retrait_inconnu',
  FENETRE_RETRAIT: 'fenetre_retrait',
  DATE_PASSEE: 'date_passee',
  DATES_INCOHERENTES: 'dates_incoherentes',
  HORS_OUVERTURE: 'hors_ouverture',
  RENDU_A_LA_PEDAGO: 'rendu_a_la_pedago',
  CRENEAU_VIDE: 'creneau_vide',
  CRENEAUX_NON_CONTIGUS: 'creneaux_non_contigus',
  CRENEAU_OCCUPE: 'creneau_occupe',
  CRENEAU_PASSE: 'creneau_passe',
  SALLE_FERMEE: 'salle_fermee',
};

export const REASON_LABELS = {
  bureau_ferme: 'Le bureau des pédago est fermé : retrait possible uniquement aux heures d’ouverture.',
  deja_un_exemplaire: 'Vous avez déjà un exemplaire de ce matériel (emprunt ou réservation en cours).',
  indisponible: 'Ce matériel n’est pas disponible actuellement.',
  emprunte_par_autre: 'Ce matériel est déjà emprunté par quelqu’un d’autre.',
  reserve_par_autre: 'Ce matériel est réservé par quelqu’un d’autre.',
  en_maintenance: 'Ce matériel est en maintenance.',
  hors_service: 'Ce matériel est hors service.',
  retard_en_cours: 'Vous avez un emprunt en retard : rendez-le avant d’emprunter à nouveau.',
  mauvais_circuit: 'Ce matériel ne s’emprunte pas de cette façon.',
  duree_trop_longue: 'La durée demandée dépasse le maximum autorisé.',
  utilisateur_inactif: 'Ce compte est désactivé.',
  code_inconnu: 'Code non reconnu : scannez l’étiquette MDS-XXXX collée sur l’objet.',
  code_retrait_inconnu: 'Aucune réservation en attente ne correspond à ce code de retrait.',
  fenetre_retrait: 'Hors de la fenêtre de retrait : le matériel se retire dans l’heure qui suit le début de la réservation.',
  date_passee: 'La date de début est déjà passée.',
  dates_incoherentes: 'La date de retour doit être postérieure ou égale à la date de retrait.',
  hors_ouverture: 'Le retrait doit tomber pendant les heures d’ouverture du bureau (jours ouvrés, 8h-12h et 13h-17h).',
  rendu_a_la_pedago: 'Ce matériel se rend directement à la pédago, qui vérifie son état.',
  creneau_vide: 'Choisissez au moins un créneau.',
  creneaux_non_contigus: 'Les créneaux doivent se suivre sans interruption.',
  creneau_occupe: 'Un de ces créneaux est déjà réservé.',
  creneau_passe: 'Ce créneau est déjà passé.',
  salle_fermee: 'La salle photo est ouverte du lundi au vendredi, de 8h à 17h.',
};

const UNAVAILABLE_REASON = {
  emprunte: REASONS.EMPRUNTE_PAR_AUTRE,
  reserve: REASONS.RESERVE_PAR_AUTRE,
  maintenance: REASONS.EN_MAINTENANCE,
  hs: REASONS.HORS_SERVICE,
};

// Fusionne des settings partiels avec les défauts : toute fonction qui reçoit des
// `settings` incomplets (formulaire en cours, tests) reste utilisable sans planter.
export function withDefaults(settings) {
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const toDate = (d) => (d instanceof Date ? d : new Date(d));

export function now(settings) {
  const s = withDefaults(settings || store.settings.get());
  return s.horlogeDemo ? new Date(s.horlogeDemo) : new Date();
}

export function isWeekday(date) {
  const w = toDate(date).getDay();
  return w >= 1 && w <= 5;
}

export function isOfficeOpen(date, horaires) {
  const h0 = horaires ?? DEFAULT_SETTINGS.horaires;
  const d = toDate(date);
  if (!isWeekday(d)) return false;
  const h = d.getHours() + d.getMinutes() / 60;
  return h0.some((r) => h >= r.debut && h < r.fin);
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

// ---- Tri ----

// Tri décroissant par une date métier (ISO), avec createdAt en départage ; jamais createdAt seul
// (horloge réelle) pour ordonner ce que l’utilisateur voit (horloge de démo).
export function sortByDateDesc(rows, pick) {
  return [...rows].sort((a, b) => (String(pick(b) || '').localeCompare(String(pick(a) || ''))) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
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
  const S = withDefaults(settings);
  if (!user || user.actif === false) return REASONS.UTILISATEUR_INACTIF;
  if (item.circuit !== circuit) return REASONS.MAUVAIS_CIRCUIT;
  if (hasActiveLoanOfReference(loans, items, user.id, item.reference)) return REASONS.DEJA_UN_EXEMPLAIRE;
  if (item.etat !== ITEM_STATES.DISPONIBLE) return UNAVAILABLE_REASON[item.etat] || REASONS.INDISPONIBLE;
  if (circuit === CIRCUITS.SELF && !isOfficeOpen(date, S.horaires)) return REASONS.BUREAU_FERME;
  if (S.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return REASONS.RETARD_EN_COURS;
  return null;
}

export function canBorrowSelf(ctx) {
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.SELF });
  return { ok: reason === null, reason };
}

export function canReserveValeur(ctx) {
  const { debutPrevu, finPrevue, settings } = ctx;
  const S = withDefaults(settings);
  if (toDate(finPrevue) < fromYmd(ymd(debutPrevu))) return { ok: false, reason: REASONS.DATES_INCOHERENTES };
  if (!isOfficeOpen(debutPrevu, S.horaires)) return { ok: false, reason: REASONS.HORS_OUVERTURE };
  const days = Math.round((fromYmd(ymd(finPrevue)) - fromYmd(ymd(debutPrevu))) / DAY);
  if (days > S.dureeMaxReservationJours) {
    return { ok: false, reason: REASONS.DUREE_TROP_LONGUE };
  }
  const reason = commonChecks({ ...ctx, settings: S, circuit: CIRCUITS.VALEUR });
  return { ok: reason === null, reason };
}
