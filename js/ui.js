// js/ui.js — helpers d’affichage. Partie pure (formatage, badges) + partie DOM (modale, toast).
// Ce module ne lit jamais le store ni l’horloge : les vues lui passent `now()` explicitement.
import { LABELS } from './models.js';

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const pad2 = (n) => String(n).padStart(2, '0');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatDate(d) {
  return dateFmt.format(toDate(d));
}

export function formatTime(d) {
  const x = toDate(d);
  return `${pad2(x.getHours())}h${pad2(x.getMinutes())}`;
}

export function formatDateTime(d) {
  return `${formatDate(d)} à ${formatTime(d)}`;
}

export function relativeDay(d, ref) {
  if (ref === undefined) throw new Error('relativeDay : passer now() en date de référence (horloge de démo)');
  const a = toDate(d); const b = toDate(ref);
  const dayA = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((dayA - dayB) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return formatDate(a);
}

export function formatSlots(creneaux) {
  if (!creneaux || creneaux.length === 0) return '';
  const s = [...creneaux].sort((a, b) => a - b);
  return `${s[0]}h-${s[s.length - 1] + 1}h`;
}

export function fullName(user) {
  return `${user.prenom} ${user.nom}`;
}

export function initials(user) {
  return `${(user.prenom || '')[0] || ''}${(user.nom || '')[0] || ''}`.toUpperCase();
}

// Variante visuelle (tokens --status-*) par famille et valeur
const VARIANTS = {
  item: { disponible: 'available', emprunte: 'borrowed', reserve: 'reserved', maintenance: 'maintenance', hs: 'hs' },
  loan: { reservee: 'reserved', en_cours: 'borrowed', retournee: 'available', refusee: 'hs', expiree: 'hs', annulee: 'hs', en_retard: 'late' },
  booking: { a_venir: 'reserved', en_cours: 'borrowed', terminee: 'available', annulee: 'hs' },
  maint: { ouvert: 'late', en_cours: 'maintenance', clos: 'available' },
  circuit: { self: 'available', salle: 'reserved', valeur: 'borrowed' },
  role: { eleve: 'reserved', intervenant: 'borrowed', pedago: 'available' },
  derived: { en_retard: 'late', sortie_non_faite: 'late', actif: 'available', desactive: 'hs', horloge_demo: 'maintenance', temps_reel: 'available' },
};
const LABEL_FAMILY = { item: 'itemState', loan: 'loanState', booking: 'bookingState', maint: 'maintState', circuit: 'circuit', role: 'role' };

export function badge(kind, value) {
  const variant = VARIANTS[kind]?.[value] || 'hs';
  const label = LABELS.derived[value] || LABELS[LABEL_FAMILY[kind]]?.[value] || value;
  return `<span class="badge badge--${variant}">${escapeHtml(label)}</span>`;
}

export function avatar(user, size = 'sm') {
  return `<span class="avatar avatar--${size}" title="${escapeHtml(fullName(user))}">${escapeHtml(initials(user))}</span>`;
}

// ---- DOM ----

let onCloseModal = null;

export function closeModal() {
  const cb = onCloseModal;
  onCloseModal = null;
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.classList.remove('has-modal');
  // Après le nettoyage du DOM : l’appelant libère ses ressources (caméra, minuteur…)
  // quelle que soit la façon dont la modale a été fermée (bouton, croix, fond).
  if (cb) cb();
}

// `title` et les libellés d’actions sont échappés ; `body` est du HTML brut fourni par
// l’appelant, qui doit échapper lui-même les données utilisateur via `escapeHtml`.
export function openModal({ title, body, actions = [], onClose = null }) {
  const root = document.getElementById('modal-root');
  onCloseModal = onClose;
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal__header">
          <h2 id="modal-title" class="h6">${escapeHtml(title)}</h2>
          <button class="modal__close" type="button" aria-label="Fermer" data-close>&times;</button>
        </header>
        <div class="modal__body">${body}</div>
        <footer class="modal__footer">
          ${actions.map((a, i) => `<button type="button" class="btn btn--${a.variant || 'secondary'}" data-action="${i}">${escapeHtml(a.label)}</button>`).join('')}
        </footer>
      </div>
    </div>`;
  document.body.classList.add('has-modal');
  root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', (e) => { if (e.target === el) closeModal(); }));
  root.querySelectorAll('[data-action]').forEach((btn) => btn.addEventListener('click', async () => {
    const a = actions[Number(btn.dataset.action)];
    const keepOpen = a.onClick ? (await a.onClick(root.querySelector('.modal'))) === false : false;
    if (a.close !== false && !keepOpen) closeModal();
  }));
  return closeModal;
}

export function toast(message, variant = 'info', ms = 3000) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.classList.add('toast--leaving'), Math.max(0, ms - 300));
  setTimeout(() => el.remove(), ms);
}
