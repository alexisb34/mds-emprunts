// js/mobile/views/emprunts.js — mes emprunts : en cours, réservations, historique.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now } from '../../rules.js';
import { escapeHtml, badge, formatDate, formatTime, formatDateTime, relativeDay, openModal, toast } from '../../ui.js';
import { loanQrPayload, renderQr } from '../../qr.js';
import { userLoans, cancelLoan, sweepExpirations } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

export const TABS_EMPRUNTS = [
  { key: 'enCours', label: 'En cours' },
  { key: 'reservations', label: 'Réservations' },
  { key: 'historique', label: 'Historique' },
];

const photo = (src, alt) => (src ? `<img class="thumb-lg" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : '');
const nameOf = (item, loan) => escapeHtml(item ? item.nom : loan.itemId);

function enCoursHtml(rows, date) {
  if (!rows.length) return '<div class="empty-state">Aucun emprunt en cours.</div>';
  return `<div class="m-list">${rows.map(({ loan, item, late }) => `
    <div class="m-item m-item--stacked">
      <div class="m-item__row"><span class="m-item__body"><strong>${nameOf(item, loan)}</strong><span class="body-tiny text-secondary">Retiré ${escapeHtml(formatDateTime(loan.dateRetrait || loan.debutPrevu))}</span><span class="body-tiny text-secondary">Retour ${escapeHtml(relativeDay(loan.finPrevue, date).toLowerCase())} avant ${escapeHtml(formatTime(loan.finPrevue))}</span></span>${late ? badge('loan', 'en_retard') : badge('loan', loan.statut)}</div>
      ${loan.photoEmprunt ? `<div class="m-item__photos">${photo(loan.photoEmprunt, 'Photo à l’emprunt')}</div>` : ''}
    </div>`).join('')}</div>
    <p class="body-tiny text-secondary">Pour rendre un objet, scannez son étiquette depuis le bouton Scanner.</p>`;
}

// Une réservation : avant la fenêtre on annonce l’heure, pendant on affiche le QR de retrait
// (que la pédago scanne) et le code court de secours, après elle est expirée.
export function reservationCardHtml({ loan, item, pickupOpen, expired, window }, date) {
  const nom = escapeHtml(item ? item.nom : loan.itemId);
  if (expired) {
    return `
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">Non retiré avant ${escapeHtml(formatTime(window.end))} — le matériel est reparti dans le catalogue.</span></span>${badge('loan', 'expiree')}</div>
        <p class="body-tiny text-secondary">Réservation expirée : vous pouvez en créer une nouvelle depuis le catalogue.</p>
      </div>`;
  }
  if (!pickupOpen) {
    return `
      <div class="m-item m-item--stacked">
        <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">Retrait ${escapeHtml(relativeDay(loan.debutPrevu, date).toLowerCase())} à ${escapeHtml(formatTime(loan.debutPrevu))} · retour le ${escapeHtml(formatDate(loan.finPrevue))}</span></span>${badge('loan', loan.statut)}</div>
        <p class="body-tiny text-secondary">Votre code de retrait s’affichera à l’heure prévue.</p>
        <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-loan="${escapeHtml(loan.id)}">Annuler la réservation</button>
      </div>`;
  }
  return `
    <div class="m-item m-item--stacked m-item--pickup">
      <div class="m-item__row"><span class="m-item__body"><strong>${nom}</strong><span class="body-tiny text-secondary">À retirer avant ${escapeHtml(formatTime(window.end))}</span></span>${badge('loan', loan.statut)}</div>
      <div class="pickup"><div data-role="qr" data-code="${escapeHtml(loanQrPayload(loan))}"></div><strong class="label-lg">${escapeHtml(loan.codeRetrait)}</strong><span class="body-tiny text-secondary">Montrez ce code à la pédago pour récupérer le matériel.</span></div>
      <button type="button" class="btn btn--ghost btn--sm" data-action="cancel" data-loan="${escapeHtml(loan.id)}">Annuler la réservation</button>
    </div>`;
}

function reservationsHtml(rows, date) {
  if (!rows.length) return '<div class="empty-state">Aucune réservation.</div>';
  return `<div class="m-list">${rows.map((r) => reservationCardHtml(r, date)).join('')}</div>`;
}

function historiqueHtml(rows) {
  if (!rows.length) return '<div class="empty-state">Aucun emprunt passé.</div>';
  return `<div class="m-list">${rows.map(({ loan, item }) => `
    <div class="m-item m-item--stacked">
      <div class="m-item__row"><span class="m-item__body"><strong>${nameOf(item, loan)}</strong><span class="body-tiny text-secondary">${escapeHtml(formatDate(loan.dateRetrait || loan.debutPrevu))}${loan.dateRetourReelle ? ` → ${escapeHtml(formatDate(loan.dateRetourReelle))}` : ''}</span>${loan.motifRefus ? `<span class="body-tiny text-secondary">Motif : ${escapeHtml(loan.motifRefus)}</span>` : ''}</span>${badge('loan', loan.statut)}</div>
      ${loan.photoEmprunt || loan.photoRetour ? `<div class="m-item__photos">${photo(loan.photoEmprunt, 'Photo à l’emprunt')}${photo(loan.photoRetour, 'Photo au retour')}</div>` : ''}
    </div>`).join('')}</div>`;
}

export function empruntsHtml({ tab, data, date }) {
  const tabs = TABS_EMPRUNTS.map((t) => `<button type="button" class="tab${t.key === tab ? ' tab--active' : ''}" data-tab="${t.key}">${escapeHtml(t.label)} <span class="tab__count">${data[t.key].length}</span></button>`).join('');
  const body = tab === 'reservations' ? reservationsHtml(data.reservations, date) : tab === 'historique' ? historiqueHtml(data.historique) : enCoursHtml(data.enCours, date);
  return `<div class="card"><div class="tabs">${tabs}</div><div class="stack" data-role="list">${body}</div></div>`;
}

export function empruntsView(container) {
  let tab = 'enCours';
  const render = () => {
    sweepExpirations(now());
    const user = auth.currentUser();
    setHeader({ title: 'Mes emprunts' });
    container.innerHTML = empruntsHtml({ tab, data: userLoans(user.id, now()), date: now() });
    container.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    container.querySelectorAll('[data-role="qr"]').forEach((el) => renderQr(el, el.dataset.code, 148));
    container.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener('click', () => {
      openModal({
        title: 'Annuler la réservation',
        body: '<p class="body-sm">Le matériel redeviendra disponible pour les autres emprunteurs.</p>',
        actions: [
          { label: 'Garder', variant: 'ghost' },
          { label: 'Annuler la réservation', variant: 'danger', onClick: () => {
            try { cancelLoan(b.dataset.loan, auth.currentUserId()); toast('Réservation annulée', 'success'); }
            catch (e) { toast(e.message, 'error'); return false; }
          } },
        ],
      });
    }));
  };
  render();
  return store.subscribe(render);
}
