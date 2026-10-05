// js/admin/layout.js — coquille admin : sidebar et topbar.
// Builders HTML purs (testés sous Node) + fonctions de montage DOM.
import { escapeHtml, avatar, fullName } from '../ui.js';
import { LABELS } from '../models.js';
import { navigate, currentPath } from '../router.js';

export const NAV = [
  { path: '/dashboard', label: 'Tableau de bord' },
  { path: '/materiel', label: 'Matériel' },
  { path: '/emprunts', label: 'Emprunts', countKey: 'emprunts' },
  { path: '/salle', label: 'Salle photo' },
  { path: '/maintenance', label: 'Maintenance', countKey: 'maintenance' },
  { path: '/utilisateurs', label: 'Utilisateurs' },
  { path: '/parametres', label: 'Paramètres' },
];

export const SEARCH_KEY = 'mds-emprunts:adminSearch';

// Un code de retrait saisi dans la recherche globale ouvre directement la remise (spec §6).
// L’alphabet des codes de retrait (js/actions/loans.js) exclut I, L, O, 0 et 1 pour
// éviter les confusions à la lecture. Un jeton de six caractères qui s’y conforme est
// un code *possible* : c’est l’appelant, qui a le store, qui tranche.
const CODE6 = /^[A-HJKMNP-Z2-9]{6}$/;
export function parseAdminSearch(q) {
  const texte = String(q || '').trim();
  // Un QR d’emprunt est rendu tel quel : `LOAN_CODE_RE` exige le préfixe `LOAN-` en
  // majuscules et capture l’identifiant, que `store.loans.get()` lit en respectant la casse.
  if (texte.startsWith('LOAN-')) return { type: 'code', code: texte };
  const majuscules = texte.toUpperCase();
  if (CODE6.test(majuscules)) return { type: 'code_possible', code: majuscules };
  return { type: 'texte', texte };
}

// Pour éviter une dépendance de ce module vers une modale ou le store, `app.js` installe
// une fois au démarrage une fonction `(parsed) => boolean` : elle ouvre la remise et rend
// true si elle prend la saisie en charge, false sinon (le champ est alors traité comme
// une recherche de matériel ordinaire).
let onSearchCode = () => false;
export function setSearchCodeHandler(fn) { onSearchCode = fn; }

export function isActive(navPath, path) {
  return path === navPath || path.startsWith(`${navPath}/`);
}

export function sidebarHtml({ currentPath: path, counts = {}, user }) {
  const items = NAV.map((n) => {
    const count = n.countKey ? counts[n.countKey] || 0 : 0;
    const active = isActive(n.path, path) ? ' nav-item--active' : '';
    const countHtml = count > 0 ? `<span class="nav-item__count">${count}</span>` : '';
    return `<a class="nav-item${active}" href="#${n.path}">${escapeHtml(n.label)}${countHtml}</a>`;
  }).join('');
  const footer = user ? `
    <div class="sidebar__footer">
      ${avatar(user)}
      <div class="sidebar__user"><strong>${escapeHtml(fullName(user))}</strong>${escapeHtml(LABELS.role[user.role] || user.role)}</div>
      <button type="button" class="sidebar__logout" data-action="logout">Déconnexion</button>
    </div>` : '';
  return `
    <div class="sidebar__logo">MDS Emprunts<small>Administration</small></div>
    <div class="sidebar__section">Gestion</div>
    <nav class="sidebar__nav">${items}</nav>
    ${footer}`;
}

export function topbarHtml({ title, subtitle = '', action = null, searchValue = '' }) {
  const actionHtml = action ? `<button type="button" class="btn btn--primary" data-action="primary">${escapeHtml(action.label)}</button>` : '';
  return `
    <div class="topbar__title"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
    <input class="input input--search topbar__search" type="search" placeholder="Rechercher un matériel…" value="${escapeHtml(searchValue)}" data-role="global-search" aria-label="Recherche globale">
    ${actionHtml}`;
}

// ---- DOM ----

export function mountSidebar({ el, currentPath: path, counts, user, onLogout }) {
  el.innerHTML = sidebarHtml({ currentPath: path, counts, user });
  const logout = el.querySelector('[data-action="logout"]');
  if (logout) logout.addEventListener('click', onLogout);
}

// Appelé par chaque vue au montage. La recherche globale envoie vers la liste du matériel.
// La saisie en cours dans le champ de recherche est préservée d’un re-rendu à l’autre
// (le store peut redéclencher setTopbar pendant que l’utilisateur tape).
export function setTopbar({ title, subtitle = '', action = null }) {
  const el = document.getElementById('topbar');
  const current = el.querySelector('[data-role="global-search"]')?.value ?? '';
  el.innerHTML = topbarHtml({ title, subtitle, action, searchValue: current });
  if (action) el.querySelector('[data-action="primary"]').addEventListener('click', action.onClick);
  el.querySelector('[data-role="global-search"]').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const parsed = parseAdminSearch(e.target.value);
    // Le champ n’est vidé que si la saisie a bien été prise pour un code.
    if (parsed.type !== 'texte' && onSearchCode(parsed)) {
      e.target.value = '';
      return;
    }
    sessionStorage.setItem(SEARCH_KEY, parsed.type === 'texte' ? parsed.texte : e.target.value.trim());
    if (currentPath() === '/materiel') window.dispatchEvent(new Event('hashchange'));
    else navigate('/materiel');
  });
}

// La vue Matériel consomme (et efface) la recherche déposée par la topbar.
export function takeSearch() {
  const q = sessionStorage.getItem(SEARCH_KEY) || '';
  sessionStorage.removeItem(SEARCH_KEY);
  return q;
}
