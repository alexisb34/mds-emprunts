// js/weekGrid.js — grille de semaine de la salle photo, partagée par le mobile et l’admin.
// Fonctions pures : elles reçoivent les réservations, les réglages et la date.
import { ymd, fromYmd, addDays, isWeekday, withDefaults, slotsAreContiguous, slotsInRoomHours, slotsConflict, REASONS } from './rules.js';
import { BOOKING_STATES } from './models.js';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

// Lundi 00h00 de la semaine contenant `date` (le week-end rattache à la semaine écoulée).
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const delta = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - delta);
  return d;
}

export function weekDays(date) {
  const lundi = startOfWeek(date);
  const today = ymd(date);
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDays(lundi, i);
    return { ymd: ymd(d), date: d, label: dayFmt.format(d), isToday: ymd(d) === today };
  });
}

export function roomHours(settings) {
  const salle = withDefaults(settings).salle;
  const hours = [];
  for (let h = salle.heureDebut; h < salle.heureFin; h += 1) hours.push(h);
  return hours;
}

// cells[ymd][heure] : qui occupe, est-ce moi, est-ce passé, est-ce libre.
export function buildWeekGrid({ date, bookings, settings, userId, now }) {
  const days = weekDays(date);
  const hours = roomHours(settings);
  const actives = bookings.filter((b) => b.statut !== BOOKING_STATES.ANNULEE);
  const cells = {};
  for (const day of days) {
    cells[day.ymd] = {};
    for (const heure of hours) {
      const booking = actives.find((b) => b.date === day.ymd && b.creneaux.includes(heure)) || null;
      const past = fromYmd(day.ymd, heure + 1) <= now;
      cells[day.ymd][heure] = { heure, booking, mine: !!booking && booking.userId === userId, past, free: !booking && !past };
    }
  }
  return { days, hours, cells };
}

export function toggleSlot(selection, { ymd: jour, heure }) {
  if (selection.ymd !== jour) return { ymd: jour, creneaux: [heure] };
  const creneaux = selection.creneaux.includes(heure)
    ? selection.creneaux.filter((h) => h !== heure)
    : [...selection.creneaux, heure].sort((a, b) => a - b);
  return creneaux.length ? { ymd: jour, creneaux } : { ymd: null, creneaux: [] };
}

export function selectionIsValid(selection, { bookings, settings, date }) {
  const S = withDefaults(settings);
  if (!selection.ymd || !selection.creneaux.length) return { ok: false, reason: REASONS.CRENEAU_VIDE };
  if (!isWeekday(fromYmd(selection.ymd)) || !slotsInRoomHours(selection.creneaux, S.salle)) return { ok: false, reason: REASONS.SALLE_FERMEE };
  if (!slotsAreContiguous(selection.creneaux)) return { ok: false, reason: REASONS.CRENEAUX_NON_CONTIGUS };
  if (fromYmd(selection.ymd, Math.max(...selection.creneaux) + 1) <= date) return { ok: false, reason: REASONS.CRENEAU_PASSE };
  if (slotsConflict(bookings, selection.ymd, selection.creneaux)) return { ok: false, reason: REASONS.CRENEAU_OCCUPE };
  return { ok: true, reason: null };
}
