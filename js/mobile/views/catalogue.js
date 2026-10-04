// js/mobile/views/catalogue.js — catalogue : recherche, chips de catégorie, une carte par référence.
import { store } from '../../store.js';
import { CATEGORIES } from '../../models.js';
import { escapeHtml, badge } from '../../ui.js';
import { groupByReference, filterCatalog, availability } from '../catalog.js';
import { setHeader } from '../layout.js';

function cardHtml(g) {
  const av = availability(g);
  const media = g.photoUrl ? `<img src="${escapeHtml(g.photoUrl)}" alt="">` : escapeHtml(g.nom[0] || '?');
  return `
    <a class="m-card" href="#/catalogue/${escapeHtml(g.reference)}">
      <div class="m-card__media">${media}</div>
      <div class="m-card__body">
        <span class="label-mini-caps text-secondary">${escapeHtml(g.categorie)}</span>
        <strong>${escapeHtml(g.nom)}</strong>
        <span class="m-card__meta">${badge(av.kind, av.value)}${av.text ? `<span class="body-tiny text-secondary">${escapeHtml(av.text)}</span>` : ''}</span>
        <span class="m-card__meta">${badge('circuit', g.circuit)}</span>
      </div>
    </a>`;
}

export function catalogueResultsHtml(groups) {
  return groups.length ? `<div class="m-grid">${groups.map(cardHtml).join('')}</div>` : '<div class="empty-state">Aucun matériel ne correspond à votre recherche.</div>';
}

export function catalogueHtml({ groups, filters, categories }) {
  const chip = (value, label) => `<button type="button" class="chip${filters.categorie === value ? ' chip--active' : ''}" data-categorie="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  return `
    <input class="input input--search" type="search" name="q" placeholder="Rechercher un matériel…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
    <div class="chips">${chip('', 'Tout')}${categories.map((c) => chip(c, c)).join('')}</div>
    <div data-role="results">${catalogueResultsHtml(groups)}</div>`;
}

export function catalogueView(container) {
  const filters = { q: '', categorie: '' };
  const render = () => {
    const groups = filterCatalog(groupByReference(store.items.list()), filters);
    setHeader({ title: 'Catalogue' });
    container.innerHTML = catalogueHtml({ groups, filters, categories: CATEGORIES });
    // La saisie ne re-rend que la grille : le champ de recherche garde le focus (le clavier reste ouvert).
    container.querySelector('[name="q"]').addEventListener('input', (e) => {
      filters.q = e.target.value;
      container.querySelector('[data-role="results"]').innerHTML = catalogueResultsHtml(filterCatalog(groupByReference(store.items.list()), filters));
    });
    container.querySelectorAll('[data-categorie]').forEach((b) => b.addEventListener('click', () => { filters.categorie = b.dataset.categorie; render(); }));
  };
  render();
  return store.subscribe(render);
}
