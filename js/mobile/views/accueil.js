// js/mobile/views/accueil.js — accueil de l’emprunteur : emprunts en cours, salle, scanner.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isBookingActive } from '../../rules.js';
import { escapeHtml, badge, formatTime, formatDate, formatSlots, relativeDay } from '../../ui.js';
import { userLoans, sweepExpirations } from '../../actions/loans.js';
import { userBookings, sweepBookings } from '../../actions/bookings.js';
import { setHeader, ICONS } from '../layout.js';

// La carte réunit ce que l’emprunteur a entre les mains et ce qu’il a réservé : deux listes
// séparées, il fallait ouvrir « Mes emprunts » pour savoir qu’une réservation l’attendait.
function loansCard(enCours, reservations, date) {
  const ligne = (href, nom, sous, pastille) => `
    <a class="m-item" href="#${href}">
      <span class="m-item__body"><strong>${escapeHtml(nom)}</strong><span class="body-tiny text-secondary">${escapeHtml(sous)}</span></span>
      ${pastille}
    </a>`;
  const lignes = [
    ...enCours.map(({ loan, item, late }) => ligne(
      `/catalogue/${item ? item.reference : ''}`,
      item ? item.nom : loan.itemId,
      `Retour ${relativeDay(loan.finPrevue, date).toLowerCase()} avant ${formatTime(loan.finPrevue)}`,
      late ? badge('loan', 'en_retard') : badge('loan', loan.statut),
    )),
    ...reservations.filter((r) => !r.expired).map(({ loan, item }) => ligne(
      '/emprunts/reservations',
      item ? item.nom : loan.itemId,
      `Réservé pour ${relativeDay(loan.debutPrevu, date).toLowerCase()} à ${formatTime(loan.debutPrevu)}`,
      badge('loan', loan.statut),
    )),
  ];
  if (!lignes.length) return '<div class="empty-state">Aucun emprunt en cours.</div>';
  return `<div class="m-list">${lignes.join('')}</div>`;
}

function bookingCard(nextBooking, date, active = null) {
  // L’état des lieux attendu (entrée, puis sortie) est proposé tant que le créneau en cours n’est pas bouclé.
  // Quand il porte sur un AUTRE créneau que celui de la carte (créneau passé resté ouvert), il le nomme :
  // sinon le bouton semble appartenir à la réservation affichée juste au-dessus.
  const aFaire = active && !(active.entreeFaite && active.sortieFaite)
    ? (() => {
      const b = active.booking;
      const autre = !nextBooking || nextBooking.id !== b.id;
      const quoi = active.entreeFaite ? 'de sortie' : 'd’entrée';
      const precision = autre ? ` — ${relativeDay(b.date, date)} ${formatSlots(b.creneaux)}` : '';
      const route = active.entreeFaite ? 'sortie' : 'entree';
      return `<a class="btn btn--primary btn--block" href="#/salle/${route}">${escapeHtml(`Faire l’état des lieux ${quoi}${precision}`)}</a>`;
    })()
    : '';
  if (!nextBooking) return aFaire || '<div class="empty-state">Aucune réservation de la salle photo.</div>';
  const enCours = isBookingActive(nextBooking, date);
  return `
    <a class="m-item" href="#/salle">
      <span class="m-item__body"><strong>${escapeHtml(relativeDay(nextBooking.date, date))} · ${escapeHtml(formatSlots(nextBooking.creneaux))}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(nextBooking.date))}${enCours ? ' · créneau en cours' : ''}</span></span>
      ${badge('booking', enCours ? 'en_cours' : nextBooking.statut)}
    </a>${aFaire}`;
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

// Réservation mise en avant sur la carte « Salle photo » : le créneau réellement en cours, sinon
// le prochain à venir. Un créneau passé resté ouvert (sortie jamais faite) n’y figure pas : il
// masquerait la réservation à venir, et son état des lieux reste proposé par le bouton de la carte.
export function salleCardBooking(salle, date) {
  const actif = salle.active?.booking;
  if (actif && isBookingActive(actif, date)) return actif;
  return salle.aVenir[0] ?? null;
}

export function accueilHtml({ user, enCours, nextBooking, date, reservations = [], expireesRecentes = [], refuseesRecentes = [], salle = null }) {
  const lateCount = enCours.filter((x) => x.late).length;
  return `
    <section class="m-hero">
      <p class="label-caps">${escapeHtml(formatDate(date))}</p>
      <h2 class="h5">Bonjour ${escapeHtml(user.prenom)} 👋</h2>
      <p class="m-hero__sub">${lateCount ? `${lateCount} emprunt${lateCount > 1 ? 's' : ''} en retard — pensez à le rendre.` : 'Scannez l’étiquette d’un objet pour l’emprunter ou le rendre.'}</p>
      <a class="btn btn--primary btn--block" href="#/scan">${ICONS.scan}<span>Scanner un QR code</span></a>
    </section>
    ${noticesHtml(reservations, expireesRecentes, refuseesRecentes)}
    <section class="card">
      <div class="card__header"><h3 class="card__title">Mes emprunts</h3><a class="body-sm" href="#/emprunts">Tout voir →</a></div>
      ${loansCard(enCours, reservations, date)}
    </section>
    <section class="card">
      <div class="card__header"><h3 class="card__title">Salle photo</h3><a class="body-sm" href="#/salle">Réserver →</a></div>
      ${bookingCard(nextBooking, date, salle ? salle.active : null)}
    </section>`;
}

export function accueilView(container) {
  const render = () => {
    const user = auth.currentUser();
    const date = now();
    sweepExpirations(date);
    sweepBookings(date);
    const loans = userLoans(user.id, date);
    const salle = userBookings(user.id, date);
    setHeader({ title: 'MDS Emprunts' });
    container.innerHTML = accueilHtml({ user, enCours: loans.enCours, reservations: loans.reservations, expireesRecentes: loans.expireesRecentes, refuseesRecentes: loans.refuseesRecentes, nextBooking: salleCardBooking(salle, date), salle, date });
  };
  render();
  return store.subscribe(render);
}
