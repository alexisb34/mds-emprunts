// js/admin/views/salle.js — planning hebdomadaire de la salle photo pour la pédagogie.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, addDays, isExitMissing } from '../../rules.js';
import { BOOKING_STATES } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, formatDate, formatDateTime, formatSlots, openModal, toast } from '../../ui.js';
import { buildWeekGrid, startOfWeek, weekDays } from '../../weekGrid.js';
import { weekBookings, cancelBooking, forceCloseBooking, sweepBookings } from '../../actions/bookings.js';
import { setTopbar } from '../layout.js';

const initials = (user) => (user ? `${(user.prenom || '')[0] || ''}${(user.nom || '')[0] || ''}`.toUpperCase() : '?');

export function planningHtml({ grid, users }) {
  const entetes = grid.days.map((d) => `<th data-day="${escapeHtml(d.ymd)}"${d.isToday ? ' class="is-today"' : ''}>${escapeHtml(d.label)}</th>`).join('');
  const lignes = grid.hours.map((heure) => {
    const cases = grid.days.map((d) => {
      const cell = grid.cells[d.ymd][heure];
      if (!cell.booking) return `<td><div class="slot ${cell.past ? 'slot--past' : 'slot--free'}"></div></td>`;
      const user = users.find((u) => u.id === cell.booking.userId) || null;
      return `<td><button type="button" class="slot slot--taken" data-booking="${escapeHtml(cell.booking.id)}" title="${escapeHtml(user ? fullName(user) : '')}">${escapeHtml(initials(user))}</button></td>`;
    }).join('');
    return `<tr><th>${heure}h</th>${cases}</tr>`;
  }).join('');
  return `<table class="week-grid week-grid--admin"><thead><tr><th></th>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}

export function exitMissingRows(bookings, users, date) {
  return bookings
    .filter((b) => b.statut === BOOKING_STATES.EN_COURS && isExitMissing(b, date))
    .map((booking) => ({ booking, user: users.find((u) => u.id === booking.userId) || null }))
    .sort((a, b) => a.booking.date.localeCompare(b.booking.date));
}

function etatBloc(titre, etat) {
  if (!etat) return `<p class="body-sm text-secondary">${escapeHtml(titre)} : pas encore faite.</p>`;
  const problemes = etat.lignes.filter((l) => !l.ok);
  return `
    <div class="stack">
      <p class="body-sm"><strong>${escapeHtml(titre)}</strong> · ${escapeHtml(formatDateTime(etat.date))}</p>
      ${problemes.length
        ? `<div class="alert alert--warning">${problemes.map((l) => `${escapeHtml(l.ligne)}${l.commentaire ? ` → ${escapeHtml(l.commentaire)}` : ''}`).join('<br>')}</div>`
        : '<p class="body-tiny text-secondary">Tout était conforme.</p>'}
    </div>`;
}

export function bookingDetailHtml({ booking, user }) {
  const annulable = booking.statut === BOOKING_STATES.A_VENIR || booking.statut === BOOKING_STATES.EN_COURS;
  return `
    <div class="stack">
      <p class="body-sm">${user ? `<span class="row">${avatar(user)}${escapeHtml(fullName(user))}</span>` : '—'}</p>
      <p class="body-sm">${escapeHtml(formatDate(booking.date))} · <strong>${escapeHtml(formatSlots(booking.creneaux))}</strong> ${badge('booking', booking.statut)}</p>
      ${etatBloc('État des lieux d’entrée', booking.etatEntree)}
      ${etatBloc('État des lieux de sortie', booking.etatSortie)}
      ${annulable ? `<button type="button" class="btn btn--danger btn--sm" data-cancel-booking="${escapeHtml(booking.id)}">Annuler la réservation</button>` : ''}
    </div>`;
}

const weekLabel = (date) => {
  const jours = weekDays(date);
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  return `${new Intl.DateTimeFormat('fr-FR', { day: 'numeric' }).format(jours[0].date)} – ${fmt.format(jours[4].date)}`;
};

export function salleHtml({ grid, users, missing, semaine }) {
  const bandeau = missing.length
    ? `<div class="card"><div class="card__header"><h2 class="card__title">Sorties non faites</h2><span class="body-sm text-secondary">${missing.length}</span></div>
        ${missing.map(({ booking, user }) => `<div class="alert alert--warning"><span>${escapeHtml(formatDate(booking.date))} · ${escapeHtml(formatSlots(booking.creneaux))} — ${escapeHtml(user ? fullName(user) : booking.userId)} n’a pas fait l’état des lieux de sortie.</span><button type="button" class="btn btn--secondary btn--sm" data-action="force-close" data-booking="${escapeHtml(booking.id)}">Clore le créneau</button></div>`).join('')}
      </div>`
    : '';
  return `
    ${bandeau}
    <div class="card">
      <div class="card__header">
        <button type="button" class="btn btn--ghost btn--sm" data-action="prev-week">← Semaine précédente</button>
        <h2 class="card__title">${escapeHtml(weekLabel(semaine))}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="next-week">Semaine suivante →</button>
      </div>
      ${planningHtml({ grid, users })}
      <p class="body-tiny text-secondary">Cliquez sur un créneau occupé pour voir le détail et les états des lieux.</p>
    </div>`;
}

export function salleView(container) {
  let semaine = now();
  const render = () => {
    sweepBookings(now());
    const date = now();
    const users = store.users.list();
    const grid = buildWeekGrid({ date: semaine, bookings: weekBookings(semaine), settings: store.settings.get(), userId: null, now: date });
    const missing = exitMissingRows(store.bookings.list(), users, date);
    setTopbar({ title: 'Salle photo', subtitle: 'Planning et états des lieux' });
    container.innerHTML = salleHtml({ grid, users, missing, semaine });
    container.querySelector('[data-action="prev-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), -7); render(); });
    container.querySelector('[data-action="next-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), 7); render(); });
    container.querySelectorAll('[data-action="force-close"]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal({
        title: 'Clore le créneau',
        body: '<p class="body-sm">L’état des lieux de sortie n’a pas été fait. Clore le créneau le retire des alertes ; vérifiez la salle avant de valider.</p>',
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Clore le créneau', variant: 'primary', onClick: () => {
            try { forceCloseBooking(b.dataset.booking, auth.currentUserId()); toast('Créneau clos', 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    }));
    container.querySelectorAll('.week-grid [data-booking]').forEach((b) => b.addEventListener('click', () => {
      const booking = store.bookings.get(b.dataset.booking);
      const user = users.find((u) => u.id === booking.userId) || null;
      const close = openModal({
        title: `Créneau du ${formatDate(booking.date)}`,
        body: bookingDetailHtml({ booking, user }),
        actions: [{ label: 'Fermer', variant: 'ghost' }],
      });
      const root = document.getElementById('modal-root');
      // L’attribut est à nous, pas `data-action` : openModal câble tous ses `[data-action]`
      // sur son tableau d’actions, et un libellé non numérique y lèverait une TypeError.
      const annuler = root.querySelector('[data-cancel-booking]');
      if (annuler) annuler.addEventListener('click', () => {
        try {
          cancelBooking(annuler.dataset.cancelBooking, auth.currentUserId());
          toast('Réservation annulée', 'success');
          close(); // sinon la modale reste ouverte sur un détail périmé
        } catch (e) { toast(e.message, 'error'); }
      });
    }));
  };
  render();
  return store.subscribe(render);
}
