// js/mobile/layout.js — coquille mobile : header et barre de navigation basse.
// Builders HTML purs (testés) + montage DOM.
import { escapeHtml, avatar } from '../ui.js';
import { auth } from '../auth.js';

// Icônes SVG inline (trait 2px, 24×24), colorées par currentColor.
export const ICONS = {
  accueil: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  catalogue: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>',
  salle: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  emprunts: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 13 4 4 10-10"/></svg>',
  croix: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>',
};

export const TABS = [
  { path: '/accueil', label: 'Accueil', icon: 'accueil' },
  { path: '/catalogue', label: 'Catalogue', icon: 'catalogue' },
  { path: '/salle', label: 'Salle photo', icon: 'salle' },
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
