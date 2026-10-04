// js/mobile/layout.js — coquille mobile : header et barre de navigation basse.
// Builders HTML purs (testés) + montage DOM.
import { escapeHtml, avatar } from '../ui.js';
import { auth } from '../auth.js';

// Icônes SVG inline (trait 2px, 24×24), colorées par currentColor.
export const ICONS = {
  accueil: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  catalogue: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  salle: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  emprunts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
};

export const TABS = [
  { path: '/accueil', label: 'Accueil', icon: 'accueil' },
  { path: '/catalogue', label: 'Catalogue', icon: 'catalogue' },
  { path: '/salle', label: 'Salle', icon: 'salle' },
  { path: '/emprunts', label: 'Emprunts', icon: 'emprunts' },
];

export function isActive(tabPath, path) {
  return path === tabPath || path.startsWith(`${tabPath}/`);
}

export function bottomNavHtml(currentPath) {
  const tab = (t) => `<a class="m-nav__tab${isActive(t.path, currentPath) ? ' m-nav__tab--active' : ''}" href="#${t.path}">${ICONS[t.icon]}<span>${escapeHtml(t.label)}</span></a>`;
  return `
    ${tab(TABS[0])}${tab(TABS[1])}
    <a class="m-nav__scan" href="#/scan" aria-label="Scanner un QR code">${ICONS.scan}</a>
    ${tab(TABS[2])}${tab(TABS[3])}`;
}

export function headerHtml({ title, user, back = null }) {
  const backHtml = back ? `<a class="m-header__back" href="#${back}" aria-label="Retour">${ICONS.back}</a>` : '';
  const userHtml = user ? `<a class="m-header__avatar" href="#/profil" aria-label="Mon profil">${avatar(user)}</a>` : '';
  return `${backHtml}<h1 class="m-header__title">${escapeHtml(title)}</h1>${userHtml}`;
}

// ---- DOM ----

export function mountNav(el, currentPath) {
  el.innerHTML = bottomNavHtml(currentPath);
}

export function setHeader({ title, back = null }) {
  const el = document.getElementById('header');
  el.innerHTML = headerHtml({ title, user: auth.currentUser(), back });
}
