// js/mobile/views/login.js — choix du compte de démo (élèves, intervenants, pédagogie), sans mot de passe.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { ROLES, LABELS } from '../../models.js';
import { escapeHtml, avatar, fullName, toast } from '../../ui.js';

const ROLE_PLURAL = { eleve: 'Élèves', intervenant: 'Intervenants', pedago: 'Pédagogie' };
const ORDER = [ROLES.ELEVE, ROLES.INTERVENANT, ROLES.PEDAGO];

export function groupUsersByRole(users, q = '') {
  const needle = q.trim().toLowerCase();
  const keep = (u) => u.actif !== false && (!needle || [u.prenom, u.nom, u.promo].some((v) => String(v || '').toLowerCase().includes(needle)));
  return ORDER.map((role) => ({
    role,
    label: ROLE_PLURAL[role] || LABELS.role[role],
    users: users.filter((u) => u.role === role && keep(u)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  })).filter((g) => g.users.length > 0);
}

export function loginHtml(groups, q = '') {
  const groupHtml = (g) => `
    <section class="m-section">
      <h2 class="label-caps text-secondary">${escapeHtml(g.label)} (${g.users.length})</h2>
      <div class="m-list">${g.users.map((u) => `
        <button type="button" class="m-item m-item--button" data-user="${escapeHtml(u.id)}">
          ${avatar(u)}
          <span class="m-item__body"><strong>${escapeHtml(fullName(u))}</strong>${u.promo ? `<span class="body-tiny text-secondary">${escapeHtml(u.promo)}</span>` : ''}</span>
        </button>`).join('')}</div>
    </section>`;
  return `
    <div class="m-login">
      <p class="label-caps text-secondary">MDS Emprunts</p>
      <h1 class="h5">Qui êtes-vous ?</h1>
      <p class="body-sm text-secondary">Comptes de démonstration — aucun mot de passe.</p>
      <input class="input input--search" type="search" name="q" placeholder="Nom, prénom, promo…" value="${escapeHtml(q)}" aria-label="Rechercher un compte">
      ${groups.length ? groups.map(groupHtml).join('') : '<div class="empty-state">Aucun compte ne correspond.</div>'}
      <p class="body-tiny text-secondary"><a href="index.html">← Retour à l’accueil</a></p>
    </div>`;
}

export function loginView(container) {
  let q = '';
  const render = () => {
    container.innerHTML = loginHtml(groupUsersByRole(store.users.list(), q), q);
    const input = container.querySelector('[name="q"]');
    input.addEventListener('input', (e) => { q = e.target.value; render(); input.focus(); });
    container.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => {
      try {
        auth.login(b.dataset.user);
        navigate('/accueil');
      } catch (e) {
        toast(e.message, 'error');
      }
    }));
  };
  render();
}
