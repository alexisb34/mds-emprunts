// js/admin/views/utilisateurs.js — liste des utilisateurs, filtres, ajout.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now } from '../../rules.js';
import { ROLES, PROMOS, LABELS } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, openModal, toast } from '../../ui.js';
import { createUser, userStats } from '../../actions/users.js';
import { setTopbar } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';

export function filterUsers(users, { q = '', role = '', promo = '', actifs = false } = {}) {
  const needle = q.trim().toLowerCase();
  return users.filter((u) => (!role || u.role === role)
    && (!promo || u.promo === promo)
    && (!actifs || u.actif !== false)
    && (!needle || [u.prenom, u.nom, u.email].some((v) => String(v || '').toLowerCase().includes(needle))));
}

export function withStats(users, date) {
  return users.map((u) => ({ ...u, stats: userStats(u.id, date) }));
}

export const USER_COLUMNS = [
  { key: 'nom', label: 'Utilisateur', sortable: true, sortValue: (u) => `${u.nom} ${u.prenom}`, render: (u) => `<span class="row">${avatar(u)}<strong>${escapeHtml(fullName(u))}</strong></span>` },
  { key: 'role', label: 'Rôle', sortable: true, render: (u) => badge('role', u.role) },
  { key: 'promo', label: 'Promo', sortable: true, render: (u) => escapeHtml(u.promo || '—') },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'enCours', label: 'En cours', sortable: true, align: 'right', sortValue: (u) => u.stats.enCours, render: (u) => String(u.stats.enCours) },
  { key: 'retards', label: 'Retards', sortable: true, align: 'right', sortValue: (u) => u.stats.retards, render: (u) => (u.stats.retards ? `<span class="badge badge--late">${u.stats.retards}</span>` : '0') },
  { key: 'actif', label: 'Compte', sortable: true, sortValue: (u) => (u.actif === false ? 0 : 1), render: (u) => (u.actif === false ? badge('derived', 'desactive') : badge('derived', 'actif')) },
];

const options = (values, labelOf, selected, emptyLabel) => `<option value="">${escapeHtml(emptyLabel)}</option>${values.map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(labelOf(v))}</option>`).join('')}`;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function utilisateursHtml({ rows, total, filters, sort }) {
  return `
    <div class="page-header">
      <div><h2 class="h6">Utilisateurs</h2><p class="page-header__meta">${total} comptes</p></div>
      <p class="page-header__meta" data-role="count">${plural(rows.length, 'résultat', 'résultats')}</p>
    </div>
    <div class="card">
      <div class="filters">
        <input class="input input--search" type="search" name="q" placeholder="Nom, prénom, email…" value="${escapeHtml(filters.q)}" aria-label="Rechercher">
        <select class="select" name="role" aria-label="Rôle">${options(Object.values(ROLES), (v) => LABELS.role[v], filters.role, 'Tous les rôles')}</select>
        <select class="select" name="promo" aria-label="Promo">${options(PROMOS, (v) => v, filters.promo, 'Toutes les promos')}</select>
        <label class="toggle"><input type="checkbox" name="actifs"${filters.actifs ? ' checked' : ''}><span class="toggle__track"></span> Comptes actifs uniquement</label>
      </div>
      <div data-role="table">${renderTable({ columns: USER_COLUMNS, rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' })}</div>
    </div>`;
}

export function userFormHtml(user = {}) {
  const role = user.role || ROLES.ELEVE;
  const field = (label, input, full = false) => `<label class="field${full ? ' field--full' : ''}"><span class="field__label">${label}</span>${input}</label>`;
  return `
    <div class="form-grid">
      ${field('Prénom', `<input class="input" name="prenom" value="${escapeHtml(user.prenom || '')}" required>`)}
      ${field('Nom', `<input class="input" name="nom" value="${escapeHtml(user.nom || '')}" required>`)}
      ${field('Email', `<input class="input" name="email" type="email" value="${escapeHtml(user.email || '')}" placeholder="prenom.nom@mds-demo.fr" required>`, true)}
      ${field('Rôle', `<select class="select" name="role">${Object.values(ROLES).map((r) => `<option value="${r}"${r === role ? ' selected' : ''}>${escapeHtml(LABELS.role[r])}</option>`).join('')}</select>`)}
      ${field('Promo (élèves)', `<select class="select" name="promo"${role === ROLES.ELEVE ? '' : ' disabled'}><option value="">—</option>${PROMOS.map((p) => `<option value="${escapeHtml(p)}"${p === user.promo ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('')}</select>`)}
    </div>`;
}

export function readUserForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  return { prenom: value('prenom'), nom: value('nom'), email: value('email'), role: value('role'), promo: value('promo') || null };
}

// Active/désactive le sélecteur de promo selon le rôle choisi.
export function bindUserForm(root) {
  const roleEl = root.querySelector('[name="role"]');
  const promoEl = root.querySelector('[name="promo"]');
  roleEl.addEventListener('change', () => { promoEl.disabled = roleEl.value !== ROLES.ELEVE; if (promoEl.disabled) promoEl.value = ''; });
}

export function utilisateursView(container) {
  const filters = { q: '', role: '', promo: '', actifs: true };
  let sort = { key: 'nom', dir: 'asc' };

  const currentRows = () => sortRows(withStats(filterUsers(store.users.list(), filters), now()), sort, USER_COLUMNS);

  const renderTableOnly = () => {
    const rows = currentRows();
    container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: USER_COLUMNS, rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' });
    container.querySelector('[data-role="count"]').textContent = plural(rows.length, 'résultat', 'résultats');
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const render = () => {
    container.innerHTML = utilisateursHtml({ rows: currentRows(), total: store.users.list().length, filters, sort });
    container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
    for (const name of ['role', 'promo']) {
      container.querySelector(`[name="${name}"]`).addEventListener('change', (e) => { filters[name] = e.target.value; renderTableOnly(); });
    }
    container.querySelector('[name="actifs"]').addEventListener('change', (e) => { filters.actifs = e.target.checked; renderTableOnly(); });
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
  };

  const openAddModal = () => {
    openModal({
      title: 'Ajouter un utilisateur',
      body: userFormHtml(),
      actions: [
        { label: 'Annuler', variant: 'ghost' },
        {
          label: 'Ajouter', variant: 'primary',
          onClick: (modal) => {
            try {
              const user = createUser(readUserForm(modal), auth.currentUserId());
              toast(`${fullName(user)} ajouté`, 'success');
              navigate(`/utilisateurs/${user.id}`);
            } catch (e) {
              toast(e.message, 'error');
              return false;
            }
          },
        },
      ],
    });
    bindUserForm(document.getElementById('modal-root'));
  };

  setTopbar({ title: 'Utilisateurs', subtitle: 'Élèves, intervenants et pédagogie', action: { label: '+ Ajouter un utilisateur', onClick: openAddModal } });
  render();
  return store.subscribe(render);
}
