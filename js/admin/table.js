// js/admin/table.js — table triable réutilisable : tri pur, rendu HTML pur, branchement DOM.
import { escapeHtml } from '../ui.js';

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

export function sortRows(rows, sort, columns) {
  if (!sort || !sort.key) return [...rows];
  const col = columns.find((c) => c.key === sort.key);
  const value = (r) => (col && col.sortValue ? col.sortValue(r) : r[sort.key]);
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return collator.compare(String(x), String(y)) * dir;
  });
}

export function toggleSort(sort, key) {
  if (sort && sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: 'asc' };
}

export function renderTable({ columns, rows, sort = null, rowHref = null, emptyText = 'Aucun résultat.' }) {
  const head = columns.map((c) => {
    const arrow = sort && sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
    const attrs = `${c.sortable ? ` data-sortable data-key="${c.key}"` : ''}${c.align ? ` style="text-align:${c.align}"` : ''}`;
    return `<th${attrs}>${escapeHtml(c.label)}${arrow}</th>`;
  }).join('');
  const table = (body) => `<table class="table"><thead><tr>${head}</tr></thead>${body}</table>`;
  if (!rows.length) return `${table('')}<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  const body = rows.map((r) => {
    const href = rowHref ? rowHref(r) : null;
    const cells = columns.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`).join('');
    return `<tr${href ? ` data-href="${escapeHtml(href)}"` : ''}>${cells}</tr>`;
  }).join('');
  return table(`<tbody>${body}</tbody>`);
}

// Branche le tri (clic sur en-tête) et la navigation (clic sur ligne, sauf sur un contrôle).
export function bindTable(root, { onSort, onRow }) {
  root.querySelectorAll('th[data-sortable]').forEach((th) => th.addEventListener('click', () => onSort(th.dataset.key)));
  root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, label, select')) return;
    onRow(tr.dataset.href);
  }));
}
