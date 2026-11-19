// js/weekGrid.js — grille de semaine de la salle photo, partagée par le mobile et l’admin.
// Fonctions pures : elles reçoivent les réservations, les réglages et la date.
import { ymd, fromYmd, addDays, isWeekday, withDefaults, slotsAreContiguous, slotsInRoomHours, slotsConflict, freeExemplaires, REASONS } from './rules.js';
import { BOOKING_STATES } from './models.js';
import { escapeHtml } from './ui.js';

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' });

// Lundi 00h00 de la semaine contenant `date` (le week-end rattache à la semaine écoulée).
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const delta = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - delta);
  return d;
}

// `maintenant` distingue la semaine AFFICHÉE de la date du jour : sans lui, naviguer
// d’une semaine mettait en évidence le lundi de la semaine affichée comme « aujourd’hui ».
export function weekDays(date, maintenant = date) {
  const lundi = startOfWeek(date);
  const today = ymd(maintenant);
  return Array.from({ length: 5 }, (_, i) => {
    const d = addDays(lundi, i);
    return { ymd: ymd(d), date: d, label: dayFmt.format(d), isToday: ymd(d) === today };
  });
}

// « 14 – 18 sept. », et « 28 sept. – 2 oct. » quand la semaine chevauche deux mois.
export function weekLabel(date) {
  const jours = weekDays(date);
  const [debut, fin] = [jours[0].date, jours[4].date];
  const avecMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const jourSeul = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' });
  const memeMois = debut.getMonth() === fin.getMonth();
  return `${(memeMois ? jourSeul : avecMois).format(debut)} – ${avecMois.format(fin)}`;
}

export function roomHours(settings) {
  const salle = withDefaults(settings).salle;
  const hours = [];
  for (let h = salle.heureDebut; h < salle.heureFin; h += 1) hours.push(h);
  return hours;
}

// cells[ymd][heure] : qui occupe, est-ce moi, est-ce passé, est-ce libre.
export function buildWeekGrid({ date, bookings, settings, userId, now }) {
  const days = weekDays(date, now);
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

// ---- Rendu partagé (salle photo et réservation de matériel) ----

function slotClass(cell, selectionne) {
  if (selectionne) return 'slot slot--selected';
  if (cell.booking) return cell.mine ? 'slot slot--mine' : 'slot slot--taken';
  if (cell.past) return 'slot slot--past';
  return 'slot slot--free';
}

// État dit à voix haute par le lecteur d’écran : le texte visible (« Vous », « Pris ») ne couvre ni libre ni passé.
function slotEtat(cell, selectionne) {
  if (selectionne) return 'sélectionné';
  if (cell.booking) return cell.mine ? 'réservé par vous' : 'déjà pris';
  return cell.past ? 'passé' : 'libre';
}

// `estSelectionne(ymd, heure)` et `etatJour(ymd)` → 'aucun' | 'partiel' | 'tous' viennent de
// l’appelant : la salle retient une journée, le matériel une période de plusieurs jours.
// La case d’en-tête prend ou libère toute la journée d’un geste.
// `coche` est le dessin posé dans un créneau retenu : sur un écran tactile, un simple aplat
// violet ne disait pas si l’on venait de le prendre ou s’il était déjà pris. L’appelant le
// fournit (`ICONS.check`) : les dessins restent tous dans `js/mobile/layout.js`.
export function weekGridHtml({ grid, estSelectionne, etatJour = () => 'aucun', coche = '' }) {
  const entetes = grid.days.map((d) => {
    const etat = etatJour(d.ymd);
    return `<th${d.isToday ? ' class="is-today"' : ''}><label class="day-check"><input type="checkbox" data-day-check="${escapeHtml(d.ymd)}" data-etat="${etat}"${etat === 'tous' ? ' checked' : ''} aria-label="Toute la journée du ${escapeHtml(d.label)}"><span>${escapeHtml(d.label)}</span></label></th>`;
  }).join('');
  const lignes = grid.hours.map((heure) => {
    const cases = grid.days.map((d) => {
      const cell = grid.cells[d.ymd][heure];
      const selectionne = estSelectionne(d.ymd, heure);
      const libelle = selectionne ? coche : (cell.booking ? (cell.mine ? 'Vous' : 'Pris') : '');
      const disabled = !selectionne && (cell.booking || cell.past) ? ' disabled' : '';
      return `<td><button type="button" data-slot="${escapeHtml(d.ymd)}:${heure}" class="${slotClass(cell, selectionne)}"${disabled} aria-label="${escapeHtml(d.label)} ${heure}h, ${escapeHtml(slotEtat(cell, selectionne))}">${libelle}</button></td>`;
    }).join('');
    return `<tr><th>${heure}h</th>${cases}</tr>`;
  }).join('');
  return `<table class="week-grid"><thead><tr><th></th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}

// `indeterminate` ne s’écrit pas en HTML : le rendu pose l’état dans `data-etat`, le DOM le relit.
export function bindDayChecks(root) {
  root.querySelectorAll('[data-day-check]').forEach((c) => { c.indeterminate = c.dataset.etat === 'partiel'; });
}

// Les heures libres d’une journée, dans l’ordre : ce que coche la case d’en-tête.
export function freeHoursOfDay(grid, jour) {
  return grid.hours.filter((h) => grid.cells[jour][h].free);
}

// ---- Réservation de matériel sur la même grille ----

// Une case est libre quand au moins un exemplaire de la référence l’est sur cette heure.
// `booking` ne porte pas une réservation précise ici : le rendu n’en lit que la présence.
export function buildItemWeekGrid({ date, reference, items, loans, settings, now }) {
  const days = weekDays(date, now);
  const hours = roomHours(settings);
  const cells = {};
  for (const day of days) {
    cells[day.ymd] = {};
    for (const heure of hours) {
      const past = fromYmd(day.ymd, heure + 1) <= now;
      const libre = !past && freeExemplaires({
        items, loans, reference, debut: fromYmd(day.ymd, heure), fin: fromYmd(day.ymd, heure + 1), date: now,
      }).length > 0;
      cells[day.ymd][heure] = { heure, booking: !past && !libre, mine: false, past, free: libre };
    }
  }
  return { days, hours, cells };
}

// Une réservation de matériel tient l’objet d’un bout à l’autre : elle se décrit par son
// premier et son dernier créneau, même à cheval sur plusieurs jours (`AAAA-MM-JJ:HH` se
// compare comme du texte dans l’ordre chronologique).
const cle = (jour, heure) => `${jour}:${String(heure).padStart(2, '0')}`;

export function periodeContient(periode, jour, heure) {
  if (!periode) return false;
  const k = cle(jour, heure);
  return k >= cle(periode.debut.ymd, periode.debut.heure) && k <= cle(periode.fin.ymd, periode.fin.heure);
}

// Toucher un créneau étend la période vers lui, ou la raccourcit s’il tombe dedans ;
// retoucher le seul créneau retenu l’efface.
export function togglePeriode(periode, jour, heure) {
  const borne = { ymd: jour, heure };
  if (!periode) return { debut: borne, fin: borne };
  const k = cle(jour, heure);
  const kDebut = cle(periode.debut.ymd, periode.debut.heure);
  const kFin = cle(periode.fin.ymd, periode.fin.heure);
  if (k === kDebut && k === kFin) return null;
  if (k < kDebut) return { debut: borne, fin: periode.fin };
  return { debut: periode.debut, fin: borne };
}

// Cocher une journée retient tous ses créneaux libres ; la décocher efface la période.
export function togglePeriodeJour(periode, grid, jour) {
  const libres = freeHoursOfDay(grid, jour);
  if (!libres.length || libres.every((h) => periodeContient(periode, jour, h))) return null;
  return { debut: { ymd: jour, heure: libres[0] }, fin: { ymd: jour, heure: libres[libres.length - 1] } };
}

export function etatJourPeriode(periode, grid, jour) {
  const libres = freeHoursOfDay(grid, jour);
  const n = libres.filter((h) => periodeContient(periode, jour, h)).length;
  if (!n) return 'aucun';
  return n === libres.length ? 'tous' : 'partiel';
}

// Les bornes réelles de l’emprunt : du début du premier créneau à la fin du dernier.
export function periodeBornes(periode) {
  if (!periode) return null;
  return { debutPrevu: fromYmd(periode.debut.ymd, periode.debut.heure), finPrevue: fromYmd(periode.fin.ymd, periode.fin.heure + 1) };
}
