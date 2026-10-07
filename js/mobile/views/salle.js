// js/mobile/views/salle.js — réservation de la salle photo : grille de semaine tactile,
// mes réservations et états des lieux d’entrée et de sortie.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, addDays, isBookingActive, isWeekday, REASONS, reasonLabel } from '../../rules.js';
import { BOOKING_STATES } from '../../models.js';
import { escapeHtml, badge, formatDate, formatSlots, relativeDay, openModal, toast } from '../../ui.js';
import { buildWeekGrid, toggleSlot, selectionIsValid, startOfWeek, weekLabel } from '../../weekGrid.js';
import { createBooking, cancelBooking, recordEntry, recordExit, roomChecklist, userBookings, sweepBookings } from '../../actions/bookings.js';
import { setHeader } from '../layout.js';

const emptySelection = () => ({ ymd: null, creneaux: [] });

function slotClass(cell, selection) {
  if (selection.ymd === cell.ymdJour && selection.creneaux.includes(cell.heure)) return 'slot slot--selected';
  if (cell.booking) return cell.mine ? 'slot slot--mine' : 'slot slot--taken';
  if (cell.past) return 'slot slot--past';
  return 'slot slot--free';
}

// État dit à voix haute par le lecteur d’écran : le texte visible (« Vous », « Pris ») ne couvre ni libre ni passé.
function slotEtat(cell, selection) {
  if (selection.ymd === cell.ymdJour && selection.creneaux.includes(cell.heure)) return 'sélectionné';
  if (cell.booking) return cell.mine ? 'réservé par vous' : 'déjà pris';
  return cell.past ? 'passé' : 'libre';
}

export function gridHtml({ grid, selection }) {
  const entetes = grid.days.map((d) => `<th data-day="${escapeHtml(d.ymd)}"${d.isToday ? ' class="is-today"' : ''}>${escapeHtml(d.label)}</th>`).join('');
  const lignes = grid.hours.map((heure) => {
    const cases = grid.days.map((d) => {
      const cell = { ...grid.cells[d.ymd][heure], ymdJour: d.ymd };
      const cls = slotClass(cell, selection);
      const libelle = cell.booking ? (cell.mine ? 'Vous' : 'Pris') : '';
      const disabled = cell.booking || cell.past ? ' disabled' : '';
      return `<td><button type="button" data-slot="${escapeHtml(d.ymd)}:${heure}" class="${cls}"${disabled} aria-label="${escapeHtml(d.label)} ${heure}h, ${escapeHtml(slotEtat(cell, selection))}">${escapeHtml(libelle)}</button></td>`;
    }).join('');
    return `<tr><th>${heure}h</th>${cases}</tr>`;
  }).join('');
  return `<table class="week-grid"><thead><tr><th></th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}

export function selectionBarHtml({ selection, check, settings = null }) {
  const n = selection.creneaux.length;
  const resume = n
    ? `<strong>${escapeHtml(formatSlots(selection.creneaux))}</strong> · ${n} créneau${n > 1 ? 'x' : ''}`
    : 'Touchez un ou plusieurs créneaux qui se suivent.';
  // Sélection vide : le résumé invite déjà à choisir, inutile d’empiler un second message.
  const message = check.ok || check.reason === REASONS.CRENEAU_VIDE ? '' : `<p class="body-tiny text-secondary">${escapeHtml(reasonLabel(check.reason, settings) || '')}</p>`;
  return `
    <div class="selection-bar">
      <div class="selection-bar__resume body-sm">${resume}</div>
      ${message}
      <button type="button" class="btn btn--primary btn--block" data-action="book"${check.ok ? '' : ' disabled'}>Réserver</button>
    </div>`;
}

export function myBookingsHtml({ active, aVenir }, date) {
  const bloc = [];
  if (active) {
    const { booking, entreeFaite, sortieFaite } = active;
    // Un créneau resté ouvert hors de ses heures (autre jour, ou terminé depuis) n’est pas
    // « en cours » : il attend sa sortie.
    const titre = isBookingActive(booking, date) && booking.statut === BOOKING_STATES.EN_COURS
      ? 'Créneau en cours'
      : (booking.statut === BOOKING_STATES.EN_COURS ? 'Créneau non clôturé' : 'Créneau du jour');
    const action = !entreeFaite
      ? '<button type="button" class="btn btn--primary btn--block" data-action="entry">Faire l’état des lieux d’entrée</button>'
      : (!sortieFaite ? '<button type="button" class="btn btn--primary btn--block" data-action="exit">Faire l’état des lieux de sortie</button>' : '');
    bloc.push(`
      <div class="m-item m-item--stacked m-item--pickup">
        <div class="m-item__row"><span class="m-item__body"><strong>${titre} · ${escapeHtml(formatSlots(booking.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(booking.date))}</span></span>${badge('booking', booking.statut)}</div>
        ${action}
      </div>`);
  }
  for (const b of aVenir) {
    bloc.push(`
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${escapeHtml(relativeDay(b.date, date))} · ${escapeHtml(formatSlots(b.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(b.date))}</span></span>${badge('booking', b.statut)}</div>
        <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-booking="${escapeHtml(b.id)}">Annuler</button>
      </div>`);
  }
  if (!bloc.length) return '<div class="empty-state">Aucune réservation de la salle photo.</div>';
  return `<div class="m-list">${bloc.join('')}</div>`;
}

const etatTitre = (moment) => (moment === 'entree' ? 'État des lieux d’entrée' : 'État des lieux de sortie');

export function etatHtml({ booking, moment, lignes }) {
  const titre = etatTitre(moment);
  const aide = moment === 'entree'
    ? 'Vérifiez le matériel avant de commencer : ce que vous signalez maintenant ne vous sera pas reproché.'
    : 'Vérifiez le matériel avant de partir : la salle doit être rangée.';
  const rows = lignes.map((l, i) => `
    <div class="checklist__row${l.ok ? '' : ' checklist__row--problem'}" data-row="${i}">
      <span class="checklist__line">${escapeHtml(l.ligne)}</span>
      <div class="seg">
        <button type="button" data-line="${i}" data-ok="1" class="seg__btn${l.ok ? ' seg__btn--on' : ''}">OK</button>
        <button type="button" data-line="${i}" data-ok="0" class="seg__btn${l.ok ? '' : ' seg__btn--problem'}">Problème</button>
      </div>
      <textarea class="textarea checklist__comment" data-comment="${i}" placeholder="Décrivez le problème (optionnel)">${escapeHtml(l.commentaire)}</textarea>
    </div>`).join('');
  return `
    <h2 class="h6">${escapeHtml(titre)}</h2>
    <p class="body-sm text-secondary">${escapeHtml(aide)} · ${escapeHtml(formatSlots(booking.creneaux))}</p>
    <div class="checklist">${rows}</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-etat">Valider l’état des lieux</button>
    <button type="button" class="btn btn--ghost btn--block" data-action="cancel-etat">Retour</button>`;
}

// Semaine affichée à l’ouverture : le week-end, la semaine écoulée n’offre plus rien, on passe à la suivante.
export function openingWeek(date) {
  return isWeekday(date) ? date : addDays(startOfWeek(date), 7);
}

// `semaine` : une date de la semaine affichée ; `date` : l’instant présent, référence des jours relatifs.
export function salleHtml({ grid, selection, check, mine, semaine, date, settings = null }) {
  return `
    <section class="card">
      <div class="card__header">
        <button type="button" class="btn btn--ghost btn--sm" data-action="prev-week" aria-label="Semaine précédente">←</button>
        <h2 class="card__title">${escapeHtml(weekLabel(semaine))}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="next-week" aria-label="Semaine suivante">→</button>
      </div>
      ${gridHtml({ grid, selection })}
    </section>
    ${selectionBarHtml({ selection, check, settings })}
    <section class="m-section">
      <h2 class="label-caps text-secondary">Mes réservations</h2>
      ${myBookingsHtml(mine, date)}
    </section>`;
}

export function salleView(container, params = {}) {
  const user = auth.currentUser();
  let semaine = openingWeek(now());
  let selection = emptySelection();
  let etat = null; // { bookingId, moment, lignes } quand un état des lieux est ouvert
  // #/salle/sortie ouvre l’état des lieux demandé sans passer par le planning : depuis l’accueil,
  // le bouton mène à ce qu’il annonce. Consommé une seule fois, sinon « Retour » le rouvrirait.
  let aOuvrir = ['entree', 'sortie'].includes(params.etat) ? params.etat : null;

  const render = () => {
    sweepBookings(now());
    const date = now();
    const bookings = store.bookings.list();
    const settings = store.settings.get();
    if (aOuvrir) {
      const actif = userBookings(user.id, date).active;
      const attendu = actif && (aOuvrir === 'entree' ? !actif.entreeFaite : actif.entreeFaite && !actif.sortieFaite);
      if (attendu) etat = { bookingId: actif.booking.id, moment: aOuvrir, lignes: roomChecklist() };
      aOuvrir = null;
    }
    if (etat) {
      const booking = store.bookings.get(etat.bookingId);
      // Sous-état de la route /salle : pas de flèche de retour (le lien ne changerait pas le hash), le bouton « Retour » suffit.
      setHeader({ title: etatTitre(etat.moment) });
      container.innerHTML = etatHtml({ booking, moment: etat.moment, lignes: etat.lignes });
      container.querySelectorAll('[data-line]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.line);
        const ok = b.dataset.ok === '1';
        etat.lignes = etat.lignes.map((l, k) => (k === i ? { ...l, ok, commentaire: ok ? '' : l.commentaire } : l));
        render();
      }));
      container.querySelectorAll('[data-comment]').forEach((t) => t.addEventListener('input', () => {
        const i = Number(t.dataset.comment);
        etat.lignes = etat.lignes.map((l, k) => (k === i ? { ...l, commentaire: t.value } : l));
      }));
      container.querySelector('[data-action="cancel-etat"]').addEventListener('click', () => { etat = null; render(); });
      container.querySelector('[data-action="confirm-etat"]').addEventListener('click', () => {
        try {
          const args = { bookingId: etat.bookingId, userId: user.id, checklist: etat.lignes };
          const r = etat.moment === 'entree' ? recordEntry(args) : recordExit(args);
          toast(r.maintenance ? 'État des lieux enregistré — problème signalé' : 'État des lieux enregistré', r.maintenance ? 'warning' : 'success');
          etat = null;
          // Le parcours est fini : on rend la main à l’accueil plutôt que de renvoyer au planning.
          navigate('/accueil');
        } catch (e) {
          toast(e.message, 'error');
        }
      });
      return;
    }
    const grid = buildWeekGrid({ date: semaine, bookings, settings, userId: user.id, now: date });
    const check = selectionIsValid(selection, { bookings, settings, date });
    setHeader({ title: 'Salle photo' });
    container.innerHTML = salleHtml({ grid, selection, check, mine: userBookings(user.id, date), semaine, date, settings });
    container.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      const [jour, heure] = b.dataset.slot.split(':');
      selection = toggleSlot(selection, { ymd: jour, heure: Number(heure) });
      render();
    }));
    container.querySelector('[data-action="prev-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), -7); selection = emptySelection(); render(); });
    container.querySelector('[data-action="next-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), 7); selection = emptySelection(); render(); });
    container.querySelector('[data-action="book"]').addEventListener('click', () => {
      try {
        const b = createBooking({ userId: user.id, date: selection.ymd, creneaux: selection.creneaux });
        toast(`Salle réservée ${formatSlots(b.creneaux)} le ${formatDate(b.date)}`, 'success');
        selection = emptySelection();
        render();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    const entry = container.querySelector('[data-action="entry"]');
    if (entry) entry.addEventListener('click', () => { etat = { bookingId: userBookings(user.id, date).active.booking.id, moment: 'entree', lignes: roomChecklist() }; render(); });
    const exit = container.querySelector('[data-action="exit"]');
    if (exit) exit.addEventListener('click', () => { etat = { bookingId: userBookings(user.id, date).active.booking.id, moment: 'sortie', lignes: roomChecklist() }; render(); });
    container.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener('click', () => openModal({
      title: 'Annuler la réservation',
      body: '<p class="body-sm">Le créneau redeviendra libre pour les autres.</p>',
      actions: [
        { label: 'Garder', variant: 'ghost' },
        { label: 'Annuler la réservation', variant: 'danger', onClick: () => {
          try { cancelBooking(b.dataset.booking, user.id); toast('Réservation annulée', 'success'); }
          catch (e) { toast(e.message, 'error'); return false; }
        } },
      ],
    })));
  };

  render();
  return store.subscribe(render);
}
