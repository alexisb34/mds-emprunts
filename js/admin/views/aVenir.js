// js/admin/views/aVenir.js — vue de remplacement pour les écrans des phases suivantes.
import { escapeHtml } from '../../ui.js';
import { setTopbar } from '../layout.js';

export function aVenirHtml(title, phase) {
  return `
    <div class="card">
      <h2 class="h6">${escapeHtml(title)}</h2>
      <p class="body-sm text-secondary">Cet écran arrive en phase ${phase} du prototype.</p>
    </div>`;
}

export function aVenirView(title, phase) {
  return (container) => {
    setTopbar({ title });
    container.innerHTML = aVenirHtml(title, phase);
  };
}
