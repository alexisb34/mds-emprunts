// js/mobile/views/accueil.js — accueil de l’emprunteur : emprunts en cours, salle, scanner.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isBookingActive } from '../../rules.js';
import { BOOKING_STATES } from '../../models.js';
import { escapeHtml, badge, formatTime, formatDate, formatSlots, relativeDay } from '../../ui.js';
import { userLoans, sweepExpirations } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

function loansCard(enCours, date) {
  if (!enCours.length) return '<div class="empty-state">Aucun emprunt en cours.</div>';
  return `<div class="m-list">${enCours.map(({ loan, item, late }) => `
    <a class="m-item" href="#/catalogue/${escapeHtml(item ? item.reference : '')}">
      <span class="m-item__body"><strong>${escapeHtml(item ? item.nom : loan.itemId)}</strong><span class="body-tiny text-secondary">Retour ${escapeHtml(relativeDay(loan.finPrevue, date).toLowerCase())} avant ${escapeHtml(formatTime(loan.finPrevue))}</span></span>
      ${late ? badge('loan', 'en_retard') : badge('loan', loan.statut)}
    </a>`).join('')}</div>`;
}

function bookingCard(nextBooking, date) {
  if (!nextBooking) return '<div class="empty-state">Aucune réservation de la salle photo.</div>';
  const active = isBookingActive(nextBooking, date);
  return `
    <a class="m-item" href="#/salle">
      <span class="m-item__body"><strong>${escapeHtml(relativeDay(nextBooking.date, date))} · ${escapeHtml(formatSlots(nextBooking.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(nextBooking.date))}${active ? ' · créneau en cours' : ''}</span></span>
      ${badge('booking', active ? 'en_cours' : nextBooking.statut)}
    </a>`;
}

function noticesHtml(reservations, expireesRecentes, refuseesRecentes) {
  const open = reservations.filter((r) => r.pickupOpen);
  if (!open.length && !expireesRecentes.length && !refuseesRecentes.length) return '';
  const lignes = [
    ...open.map((r) => `<div class="alert alert--info">${escapeHtml(r.item ? r.item.nom : '')} : à retirer avant ${escapeHtml(formatTime(r.window.end))} — <a href="#/emprunts">voir mon code</a>.</div>`),
    ...expireesRecentes.map((r) => `<div class="alert alert--warning">${escapeHtml(r.item ? r.item.nom : '')} : réservation expirée, le matériel est reparti dans le catalogue.</div>`),
    ...refuseesRecentes.map((r) => `<div class="alert alert--error">${escapeHtml(r.item ? r.item.nom : '')} : réservation refusée — ${escapeHtml(r.loan.motifRefus)}</div>`),
  ];
  return `<section class="stack">${lignes.join('')}</section>`;
}

export function accueilHtml({ user, enCours, nextBooking, date, reservations = [], expireesRecentes = [], refuseesRecentes = [] }) {
  const lateCount = enCours.filter((x) => x.late).length;
  return `
    <section class="m-hero">
      <p class="label-caps">${escapeHtml(formatDate(date))}</p>
      <h2 class="h5">Bonjour ${escapeHtml(user.prenom)} 👋</h2>
      <p class="m-hero__sub">${lateCount ? `${lateCount} emprunt${lateCount > 1 ? 's' : ''} en retard — pensez à le rendre.` : 'Scannez l’étiquette d’un objet pour l’emprunter ou le rendre.'}</p>
      <a class="btn btn--primary btn--block" href="#/scan">Scanner un QR code</a>
    </section>
    ${noticesHtml(reservations, expireesRecentes, refuseesRecentes)}
    <section class="card">
      <div class="card__header"><h3 class="card__title">Mes emprunts en cours</h3><a class="body-sm" href="#/emprunts">Tout voir →</a></div>
      ${loansCard(enCours, date)}
    </section>
    <section class="card">
      <div class="card__header"><h3 class="card__title">Salle photo</h3><a class="body-sm" href="#/salle">Réserver →</a></div>
      ${bookingCard(nextBooking, date)}
    </section>`;
}

export function accueilView(container) {
  const render = () => {
    const user = auth.currentUser();
    const date = now();
    sweepExpirations(date);
    const bookings = store.bookings.list((b) => b.userId === user.id && (b.statut === BOOKING_STATES.A_VENIR || b.statut === BOOKING_STATES.EN_COURS))
      .sort((a, b) => a.date.localeCompare(b.date) || a.creneaux[0] - b.creneaux[0]);
    const loans = userLoans(user.id, date);
    setHeader({ title: 'MDS Emprunts' });
    container.innerHTML = accueilHtml({ user, enCours: loans.enCours, reservations: loans.reservations, expireesRecentes: loans.expireesRecentes, refuseesRecentes: loans.refuseesRecentes, nextBooking: bookings[0] || null, date });
  };
  render();
  return store.subscribe(render);
}
