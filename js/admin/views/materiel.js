// js/admin/views/materiel.js — inventaire : liste filtrable/triable, ajout d’un exemplaire.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { CATEGORIES, CIRCUITS, ITEM_STATES, LABELS } from '../../models.js';
import { escapeHtml, badge, openModal, toast } from '../../ui.js';
import { createItem } from '../../actions/items.js';
import { setTopbar, takeSearch } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';

export function filterItems(items, { q = '', categorie = '', circuit = '', etat = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return items.filter((i) => (!categorie || i.categorie === categorie)
    && (!circuit || i.circuit === circuit)
    && (!etat || i.etat === etat)
    && (!needle || [i.nom, i.code, i.reference, i.localisation].some((v) => String(v || '').toLowerCase().includes(needle))));
}

export const COLUMNS = [
  { key: 'code', label: 'Code', sortable: true },
  { key: 'nom', label: 'Matériel', sortable: true, render: (i) => `<strong>${escapeHtml(i.nom)}</strong>` },
  { key: 'categorie', label: 'Catégorie', sortable: true },
  { key: 'circuit', label: 'Circuit', sortable: true, render: (i) => badge('circuit', i.circuit) },
  { key: 'etat', label: 'État', sortable: true, render: (i) => badge('item', i.etat) },
  { key: 'localisation', label: 'Localisation', sortable: true },
  { key: 'valeurEstimee', label: 'Valeur', sortable: true, align: 'right', render: (i) => `${escapeHtml(i.valeurEstimee)} €` },
];

const options = (values, labelOf, selected, emptyLabel) => `<option value="">${escapeHtml(emptyLabel)}</option>${values.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(labelOf(v))}</option>`).join('')}`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function materielHtml({ items, total, disponibles, filters, sort }) {
  return `
    <div class="page-header">
      <div><h2 class="h6">Inventaire</h2><p class="page-header__meta">${total} exemplaires · ${disponibles} disponibles</p></div>
      <p class="page-header__meta" data-role="count">${plural(items.length, 'résultat', 'résultats')}</p>
    </div>
    <div class="card">
      <div class="filters">
        <input class="input input--search" type="search" name="q" placeholder="Nom, code, référence, localisation…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
        <select class="select" name="categorie" aria-label="Catégorie">${options(CATEGORIES, (v) => v, filters.categorie, 'Toutes les catégories')}</select>
        <select class="select" name="circuit" aria-label="Circuit">${options(Object.values(CIRCUITS), (v) => LABELS.circuit[v], filters.circuit, 'Tous les circuits')}</select>
        <select class="select" name="etat" aria-label="État">${options(Object.values(ITEM_STATES), (v) => LABELS.itemState[v], filters.etat, 'Tous les états')}</select>
      </div>
      <div class="toolbar" data-role="toolbar"></div>
      <div data-role="table">${renderTable({ columns: COLUMNS, rows: items, sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel ne correspond à ces filtres.' })}</div>
    </div>`;
}

export function itemFormHtml(item = {}, references = []) {
  const field = (label, name, input) => `<label class="field"><span class="field__label">${label}</span>${input}</label>`;
  return `
    <div class="form-grid">
      ${field('Nom', 'nom', `<input class="input" name="nom" value="${escapeHtml(item.nom || '')}" placeholder="Canon R10 + 18-55" required>`)}
      ${field('Référence (regroupe les exemplaires identiques)', 'reference', `<input class="input" name="reference" list="ref-list" value="${escapeHtml(item.reference || '')}" placeholder="canon-r10" required>`)}
      ${field('Catégorie', 'categorie', `<select class="select" name="categorie">${CATEGORIES.map((c) => `<option value="${escapeHtml(c)}"${c === (item.categorie || CATEGORIES[0]) ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>`)}
      ${field('Circuit', 'circuit', `<select class="select" name="circuit">${Object.values(CIRCUITS).map((c) => `<option value="${c}"${c === (item.circuit || CIRCUITS.SELF) ? ' selected' : ''}>${escapeHtml(LABELS.circuit[c])}</option>`).join('')}</select>`)}
      ${field('Valeur estimée (€)', 'valeurEstimee', `<input class="input" name="valeurEstimee" type="number" min="0" step="1" value="${escapeHtml(item.valeurEstimee ?? 0)}">`)}
      ${field('Localisation', 'localisation', `<input class="input" name="localisation" value="${escapeHtml(item.localisation || '')}" placeholder="Armoire sécurisée">`)}
      ${field('Date d’achat', 'dateAchat', `<input class="input" name="dateAchat" type="date" value="${escapeHtml(item.dateAchat || '')}">`)}
      <label class="field field--full"><span class="field__label">Notes</span><textarea class="textarea" name="notes">${escapeHtml(item.notes || '')}</textarea></label>
    </div>
    <datalist id="ref-list">${references.map((r) => `<option value="${escapeHtml(r)}">`).join('')}</datalist>`;
}

export function readItemForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  return {
    nom: value('nom'), reference: value('reference'), categorie: value('categorie'), circuit: value('circuit'),
    valeurEstimee: value('valeurEstimee'), localisation: value('localisation'), dateAchat: value('dateAchat'), notes: value('notes'),
  };
}

export function materielView(container) {
  const filters = { q: takeSearch(), categorie: '', circuit: '', etat: '' };
  let sort = { key: 'code', dir: 'asc' };

  const currentRows = () => sortRows(filterItems(store.items.list(), filters), sort, COLUMNS);
  const references = () => [...new Set(store.items.list().map((i) => i.reference))].sort();

  // Ne re-rend que la table (et le compteur) pour garder le focus dans les filtres.
  const renderTableOnly = () => {
    const rows = currentRows();
    container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: COLUMNS, rows, sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel ne correspond à ces filtres.' });
    container.querySelector('[data-role="count"]').textContent = plural(rows.length, 'résultat', 'résultats');
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const render = () => {
    const all = store.items.list();
    container.innerHTML = materielHtml({
      items: currentRows(), total: all.length, disponibles: all.filter((i) => i.etat === ITEM_STATES.DISPONIBLE).length,
      filters, sort,
    });
    container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
    for (const name of ['categorie', 'circuit', 'etat']) {
      container.querySelector(`[name="${name}"]`).addEventListener('change', (e) => { filters[name] = e.target.value; renderTableOnly(); });
    }
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const openAddModal = () => openModal({
    title: 'Ajouter du matériel',
    body: itemFormHtml({}, references()),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: 'Ajouter', variant: 'primary',
        onClick: (modal) => {
          try {
            const item = createItem(readItemForm(modal), auth.currentUserId());
            toast(`${item.nom} ajouté (${item.code})`, 'success');
            navigate(`/materiel/${item.id}`);
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        },
      },
    ],
  });

  setTopbar({ title: 'Matériel', subtitle: 'Inventaire complet', action: { label: '+ Ajouter du matériel', onClick: openAddModal } });
  render();
  return store.subscribe(render);
}
