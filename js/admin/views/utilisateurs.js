// js/admin/views/utilisateurs.js — liste des utilisateurs : filtres, ajout, import/export CSV,
// sélection et suppression.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now } from '../../rules.js';
import { ROLES, PROMOS, LABELS } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, openModal, toast } from '../../ui.js';
import { createUser, deleteUser, userStats } from '../../actions/users.js';
import { setTopbar } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';
import { toCsv, parseCsv } from '../csv.js';

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

// Hors de USER_COLUMNS : une case à cocher ne se trie pas et ne s’exporte pas.
const SELECT_COLUMN = {
  key: '__select',
  label: '',
  header: '<input type="checkbox" data-select-all aria-label="Tout sélectionner">',
  render: (u) => `<input type="checkbox" data-select="${escapeHtml(u.id)}" aria-label="Sélectionner ${escapeHtml(fullName(u))}">`,
};

// Les colonnes de l’export sont exactement celles que l’import sait relire : aller-retour garanti.
export const CSV_HEADERS = ['prenom', 'nom', 'email', 'role', 'promo'];

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
      <div class="toolbar">
        <button type="button" class="btn btn--secondary btn--sm" data-action="export-csv">Exporter en CSV</button>
        <button type="button" class="btn btn--secondary btn--sm" data-action="import-csv">Importer un CSV</button>
        <button type="button" class="btn btn--danger btn--sm" data-action="delete-selected" disabled>Supprimer la sélection (0)</button>
        <input type="file" accept=".csv,text/csv" data-role="csv-file" hidden>
      </div>
      <div data-role="table">${renderTable({ columns: [SELECT_COLUMN, ...USER_COLUMNS], rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' })}</div>
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

  const selected = new Set();
  const syncDeleteButton = () => {
    const btn = container.querySelector('[data-action="delete-selected"]');
    btn.disabled = selected.size === 0;
    btn.textContent = `Supprimer la sélection (${selected.size})`;
  };

  // Une ligne que le filtre cache sort de la sélection : on ne supprime pas ce qu’on ne voit pas.
  const syncSelection = (rows) => {
    const visibles = new Set(rows.map((u) => u.id));
    for (const id of selected) if (!visibles.has(id)) selected.delete(id);
    const toutes = container.querySelector('[data-select-all]');
    container.querySelectorAll('[data-select]').forEach((cb) => {
      cb.checked = selected.has(cb.dataset.select);
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(cb.dataset.select); else selected.delete(cb.dataset.select);
        if (toutes) toutes.checked = rows.length > 0 && selected.size === rows.length;
        syncDeleteButton();
      });
    });
    if (toutes) {
      toutes.checked = rows.length > 0 && selected.size === rows.length;
      toutes.addEventListener('change', () => {
        if (toutes.checked) rows.forEach((u) => selected.add(u.id)); else selected.clear();
        renderTableOnly();
      });
    }
    syncDeleteButton();
  };

  const renderTableOnly = () => {
    const rows = currentRows();
    container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: [SELECT_COLUMN, ...USER_COLUMNS], rows, sort, rowHref: (u) => `/utilisateurs/${u.id}`, emptyText: 'Aucun utilisateur ne correspond à ces filtres.' });
    container.querySelector('[data-role="count"]').textContent = plural(rows.length, 'résultat', 'résultats');
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
    syncSelection(rows);
  };

  // Exporte ce que les filtres affichent : ce qu’on voit est ce qu’on télécharge.
  const exportCsv = () => {
    const blob = new Blob([`\ufeff${toCsv(CSV_HEADERS, currentRows())}`], { type: 'text/csv;charset=utf-8' });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = `utilisateurs-${now().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(lien.href);
  };

  const importCsv = async (fichier) => {
    const lignes = parseCsv(await fichier.text());
    if (!lignes.length) { toast('Ce fichier ne contient aucune ligne.', 'error'); return; }
    const erreurs = [];
    let ajoutes = 0;
    // Une seule écriture pour tout le fichier ; une ligne refusée n’annule pas les précédentes.
    store.transaction(() => lignes.forEach((l, i) => {
      try {
        createUser({ prenom: l.prenom, nom: l.nom, email: l.email, role: l.role, promo: l.promo || null }, auth.currentUserId());
        ajoutes += 1;
      } catch (e) {
        erreurs.push(`Ligne ${i + 2} (${l.email || l.nom || '—'}) : ${e.message}`);
      }
    }));
    if (ajoutes) toast(plural(ajoutes, 'utilisateur importé', 'utilisateurs importés'), 'success');
    if (erreurs.length) {
      openModal({
        title: plural(erreurs.length, 'ligne ignorée', 'lignes ignorées'),
        body: `<ul class="activity">${erreurs.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
          <p class="body-sm text-secondary">Colonnes attendues : ${CSV_HEADERS.join(', ')}. Le rôle s’écrit comme dans l’export (${Object.values(ROLES).join(', ')}).</p>`,
        actions: [{ label: 'Fermer', variant: 'primary' }],
      });
    } else if (!ajoutes) toast('Aucune ligne importable.', 'error');
  };

  const openDeleteModal = () => {
    const users = [...selected].map((id) => store.users.get(id)).filter(Boolean);
    if (!users.length) return;
    openModal({
      title: users.length > 1 ? `Supprimer ${users.length} comptes ?` : 'Supprimer ce compte ?',
      body: `<p class="body">La suppression est définitive.</p>
        <ul class="activity">${users.map((u) => `<li>${escapeHtml(fullName(u))} — ${escapeHtml(u.email)}</li>`).join('')}</ul>
        <p class="body-sm text-secondary">Un compte qui a déjà emprunté ou réservé la salle ne peut pas être supprimé : désactivez-le depuis sa fiche.</p>`,
      actions: [
        { label: 'Annuler', variant: 'ghost' },
        {
          label: 'Supprimer', variant: 'danger',
          onClick: () => {
            const erreurs = [];
            let supprimes = 0;
            for (const u of users) {
              try { deleteUser(u.id, auth.currentUserId()); selected.delete(u.id); supprimes += 1; } catch (e) { erreurs.push(e.message); }
            }
            if (supprimes) toast(plural(supprimes, 'compte supprimé', 'comptes supprimés'), 'success');
            for (const message of erreurs.slice(0, 2)) toast(message, 'error');
            if (!supprimes) renderTableOnly(); // aucune écriture : le store ne notifie pas
          },
        },
      ],
    });
  };

  const render = () => {
    container.innerHTML = utilisateursHtml({ rows: currentRows(), total: store.users.list().length, filters, sort });
    container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
    for (const name of ['role', 'promo']) {
      container.querySelector(`[name="${name}"]`).addEventListener('change', (e) => { filters[name] = e.target.value; renderTableOnly(); });
    }
    container.querySelector('[name="actifs"]').addEventListener('change', (e) => { filters.actifs = e.target.checked; renderTableOnly(); });
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
    const fichier = container.querySelector('[data-role="csv-file"]');
    container.querySelector('[data-action="export-csv"]').addEventListener('click', exportCsv);
    container.querySelector('[data-action="import-csv"]').addEventListener('click', () => fichier.click());
    fichier.addEventListener('change', () => {
      const choisi = fichier.files[0];
      fichier.value = ''; // pour que le même fichier puisse être re-choisi après correction
      if (choisi) importCsv(choisi);
    });
    container.querySelector('[data-action="delete-selected"]').addEventListener('click', openDeleteModal);
    syncSelection(currentRows());
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
