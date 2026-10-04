// js/admin/views/emprunts.js — suivi des emprunts : en cours, réservés, en retard, historique.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, isLate, sortByDateDesc, addDays, ymd, fromYmd } from '../../rules.js';
import { LOAN_STATES } from '../../models.js';
import { escapeHtml, badge, avatar, fullName, formatDate, formatDateTime, openModal, toast } from '../../ui.js';
import { receiveLoan, refuseLoan, extendLoan, sweepExpirations } from '../../actions/loans.js';
import { setTopbar } from '../layout.js';
import { sortRows, toggleSort, renderTable, bindTable } from '../table.js';
import { openHandoverModal, checklistFormHtml, readChecklistForm } from '../handoverModal.js';

export const TABS_ADMIN_LOANS = [
  { key: 'enCours', label: 'En cours' },
  { key: 'reserves', label: 'Réservés' },
  { key: 'retards', label: 'En retard' },
  { key: 'historique', label: 'Historique' },
];

const ACTIVE = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

// Tri initial de chaque onglet : les retraits à venir en premier, les pires retards en premier.
export const DEFAULT_SORT = {
  enCours: { key: 'debut', dir: 'desc' },
  reserves: { key: 'debut', dir: 'asc' },
  retards: { key: 'fin', dir: 'asc' },
  historique: { key: 'debut', dir: 'desc' },
};

export function loanRows(tab, date) {
  const items = store.items.list();
  const users = store.users.list();
  const join = (loan) => ({ loan, item: items.find((i) => i.id === loan.itemId) || null, user: users.find((u) => u.id === loan.userId) || null, late: isLate(loan, date) });
  const all = store.loans.list();
  if (tab === 'reserves') return all.filter((l) => l.statut === LOAN_STATES.RESERVEE).sort((a, b) => a.debutPrevu.localeCompare(b.debutPrevu)).map(join);
  if (tab === 'retards') return all.filter((l) => isLate(l, date)).map(join).sort((a, b) => a.loan.finPrevue.localeCompare(b.loan.finPrevue));
  if (tab === 'historique') return sortByDateDesc(all.filter((l) => !ACTIVE.includes(l.statut)), (l) => l.dateRetourReelle || l.dateRetrait || l.debutPrevu).map(join);
  return sortByDateDesc(all.filter((l) => l.statut === LOAN_STATES.EN_COURS && !isLate(l, date)), (l) => l.dateRetrait).map(join);
}

export const LOAN_COLUMNS = [
  { key: 'item', label: 'Matériel', sortable: true, sortValue: (r) => (r.item ? r.item.nom : ''), render: (r) => `<strong>${escapeHtml(r.item ? r.item.nom : r.loan.itemId)}</strong><br><span class="body-tiny text-secondary">${escapeHtml(r.item ? r.item.code : '')}</span>` },
  { key: 'user', label: 'Emprunteur', sortable: true, sortValue: (r) => (r.user ? `${r.user.nom} ${r.user.prenom}` : ''), render: (r) => (r.user ? `<span class="row">${avatar(r.user)}${escapeHtml(fullName(r.user))}</span>` : '—') },
  { key: 'debut', label: 'Retrait', sortable: true, sortValue: (r) => r.loan.dateRetrait || r.loan.debutPrevu, render: (r) => escapeHtml(formatDateTime(r.loan.dateRetrait || r.loan.debutPrevu)) },
  { key: 'fin', label: 'Retour prévu', sortable: true, sortValue: (r) => r.loan.finPrevue, render: (r) => escapeHtml(formatDate(r.loan.finPrevue)) },
  { key: 'statut', label: 'Statut', sortable: true, sortValue: (r) => (r.late ? 'zz' : r.loan.statut), render: (r) => badge('loan', r.late ? 'en_retard' : r.loan.statut) },
];

function actionsColumn(tab) {
  return {
    key: 'actions', label: '', align: 'right',
    render: (r) => {
      const id = escapeHtml(r.loan.id);
      if (tab === 'reserves') {
        return `<div class="table__actions"><button type="button" class="btn btn--primary btn--sm" data-action="handover" data-loan="${id}">Remettre</button><button type="button" class="btn btn--ghost btn--sm" data-action="refuse" data-loan="${id}">Refuser</button></div>`;
      }
      if (tab === 'enCours' || tab === 'retards') {
        return `<div class="table__actions"><button type="button" class="btn btn--primary btn--sm" data-action="receive" data-loan="${id}">Réceptionner</button><button type="button" class="btn btn--ghost btn--sm" data-action="extend" data-loan="${id}">Prolonger</button></div>`;
      }
      return '';
    },
  };
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function empruntsHtml({ tab, rows, counts, sort, date }) {
  const tabs = TABS_ADMIN_LOANS.map((t) => `<button type="button" class="tab${t.key === tab ? ' tab--active' : ''}" data-tab="${t.key}">${escapeHtml(t.label)} <span class="tab__count">${counts[t.key]}</span></button>`).join('');
  const columns = [...LOAN_COLUMNS, actionsColumn(tab)];
  return `
    <div class="page-header">
      <div><h2 class="h6">Emprunts</h2><p class="page-header__meta">${plural(counts.enCours + counts.reserves + counts.retards, 'dossier actif', 'dossiers actifs')} · ${plural(counts.retards, 'retard', 'retards')}</p></div>
    </div>
    <div class="card">
      <div class="tabs">${tabs}</div>
      <div data-role="results">${renderTable({ columns, rows, sort, rowHref: (r) => `/materiel/${r.loan.itemId}`, emptyText: 'Aucun emprunt dans cet onglet.' })}</div>
    </div>`;
}

export function empruntsView(container) {
  let tab = 'enCours';
  let sort = { ...DEFAULT_SORT.enCours };

  const counts = (date) => ({
    enCours: loanRows('enCours', date).length, reserves: loanRows('reserves', date).length,
    retards: loanRows('retards', date).length, historique: loanRows('historique', date).length,
  });

  const askReceive = (row) => openModal({
    title: `Réceptionner — ${row.item ? row.item.nom : ''}`,
    body: checklistFormHtml(row.item ? row.item.reference : ''),
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Valider le retour', variant: 'primary', onClick: (modal) => {
        try {
          const { checklist, commentaire } = readChecklistForm(modal, row.item.reference);
          const r = receiveLoan({ loanId: row.loan.id, pedagoId: auth.currentUserId(), checklist, commentaire });
          toast(r.maintenance ? 'Retour enregistré — problème signalé' : 'Retour enregistré', r.maintenance ? 'warning' : 'success');
        } catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const askRefuse = (row) => openModal({
    title: `Refuser la réservation — ${row.item ? row.item.nom : ''}`,
    body: '<label class="field"><span class="field__label">Motif (communiqué à l’emprunteur)</span><textarea class="textarea" name="motif" placeholder="Matériel réservé pour un cours"></textarea></label>',
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Refuser', variant: 'danger', onClick: (modal) => {
        try { refuseLoan(row.loan.id, auth.currentUserId(), modal.querySelector('[name="motif"]').value); toast('Réservation refusée', 'success'); }
        catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const askExtend = (row) => openModal({
    title: `Prolonger — ${row.item ? row.item.nom : ''}`,
    body: `<label class="field"><span class="field__label">Nouvelle date de retour</span><input class="input" type="date" name="fin" value="${escapeHtml(ymd(addDays(new Date(row.loan.finPrevue), 2)))}"></label>`,
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      { label: 'Prolonger', variant: 'primary', onClick: (modal) => {
        const v = modal.querySelector('[name="fin"]').value;
        try { extendLoan(row.loan.id, fromYmd(v, 17), auth.currentUserId()); toast('Emprunt prolongé', 'success'); }
        catch (e) { toast(e.message, 'error'); return false; }
      } },
    ],
  });

  const render = () => {
    const date = now();
    sweepExpirations(date);
    const rows = sortRows(loanRows(tab, date), sort, LOAN_COLUMNS);
    setTopbar({ title: 'Emprunts', subtitle: 'Suivi des prêts et des réservations', action: { label: 'Remettre un matériel', onClick: () => openHandoverModal({}) } });
    container.innerHTML = empruntsHtml({ tab, rows, counts: counts(date), sort, date });
    container.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; sort = { ...DEFAULT_SORT[tab] }; render(); }));
    bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); render(); }, onRow: navigate });
    const rowOf = (id) => rows.find((r) => r.loan.id === id);
    container.querySelectorAll('[data-action="receive"]').forEach((b) => b.addEventListener('click', () => askReceive(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="refuse"]').forEach((b) => b.addEventListener('click', () => askRefuse(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="extend"]').forEach((b) => b.addEventListener('click', () => askExtend(rowOf(b.dataset.loan))));
    container.querySelectorAll('[data-action="handover"]').forEach((b) => b.addEventListener('click', () => openHandoverModal({})));
  };

  render();
  return store.subscribe(render);
}
