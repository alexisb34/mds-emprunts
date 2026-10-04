// js/mobile/views/aVenir.js — écran de remplacement pour les fonctions des phases suivantes.
import { escapeHtml } from '../../ui.js';
import { setHeader } from '../layout.js';

export function aVenirHtml(title, phase) {
  return `<div class="card"><h2 class="h6">${escapeHtml(title)}</h2><p class="body-sm text-secondary">Cet écran arrive en phase ${phase} du prototype.</p></div>`;
}

export function aVenirView(title, phase, back = '/accueil') {
  return (container) => {
    setHeader({ title, back });
    container.innerHTML = aVenirHtml(title, phase);
  };
}
