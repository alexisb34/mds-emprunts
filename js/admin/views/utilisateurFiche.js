// js/admin/views/utilisateurFiche.js — fiche d’un utilisateur : identité, statistiques, historiques, activation.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isLate } from '../../rules.js';
import { navigate } from '../../router.js';
import { LABELS } from '../../models.js';
import { ACTION_LABELS } from '../../log.js';
import { escapeHtml, badge, avatar, formatDate, formatDateTime, formatTime, formatSlots, relativeDay, fullName, openModal, toast } from '../../ui.js';
import { updateUser, setUserActive, userStats, userHistory } from '../../actions/users.js';
import { setTopbar } from '../layout.js';
import { userFormHtml, readUserForm, bindUserForm } from './utilisateurs.js';

const itemName = (items, id) => { const i = items.find((x) => x.id === id); return i ? i.nom : id; };

function loansTable(loans, items, date) {
  if (!loans.length) return '<div class="empty-state">Aucun emprunt.</div>';
  return `<table class="table"><thead><tr><th>Matériel</th><th>Retrait</th><th>Retour prévu</th><th>Retour réel</th><th>Statut</th></tr></thead><tbody>${loans.map((l) => `
    <tr data-href="/materiel/${escapeHtml(l.itemId)}">
      <td><strong>${escapeHtml(itemName(items, l.itemId))}</strong></td>
      <td>${escapeHtml(l.dateRetrait ? formatDateTime(l.dateRetrait) : formatDate(l.debutPrevu))}</td>
      <td>${escapeHtml(formatDate(l.finPrevue))}</td>
      <td>${l.dateRetourReelle ? escapeHtml(formatDate(l.dateRetourReelle)) : '—'}</td>
      <td>${badge('loan', isLate(l, date) ? 'en_retard' : l.statut)}</td>
    </tr>`).join('')}</tbody></table>`;
}

function bookingsList(bookings) {
  if (!bookings.length) return '<div class="empty-state">Aucune réservation.</div>';
  return `<div class="list">${bookings.map((b) => `
    <div class="list__item">
      <div class="list__grow"><strong>${escapeHtml(formatDate(b.date))}</strong> · ${escapeHtml(formatSlots(b.creneaux))}<span class="activity__detail">${b.etatEntree ? 'État des lieux d’entrée fait' : 'Pas d’état des lieux d’entrée'}${b.etatSortie ? ' · sortie faite' : ''}</span></div>
      ${badge('booking', b.statut)}
    </div>`).join('')}</div>`;
}

function journal(entries, date) {
  if (!entries.length) return '<div class="empty-state">Aucune activité.</div>';
  return `<div class="activity">${entries.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function userFicheHtml({ user, stats, history, items, date }) {
  const active = user.actif !== false;
  return `
    <div class="page-header">
      <div>
        <a class="back-link" href="#/utilisateurs">← Utilisateurs</a>
        <h2 class="h5 row">${avatar(user, 'md')}${escapeHtml(fullName(user))}</h2>
        <p class="page-header__meta">${badge('role', user.role)} ${user.promo ? escapeHtml(user.promo) + ' · ' : ''}${escapeHtml(user.email)} ${active ? badge('derived', 'actif') : badge('derived', 'desactive')}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Informations</h3></div>
          <form data-role="user-form">${userFormHtml(user)}<div class="form-actions"><button type="submit" class="btn btn--primary">Enregistrer</button></div></form>
        </div>
        <div class="card"><div class="card__header"><h3 class="card__title">Emprunts</h3><span class="body-sm text-secondary">${history.loans.length}</span></div>${loansTable(history.loans, items, date)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Réservations de la salle photo</h3></div>${bookingsList(history.bookings)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Journal</h3></div>${journal(history.log, date)}</div>
      </div>
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Statistiques</h3></div>
          <div class="stat-row">
            <div class="stat"><div class="stat__label">En cours</div><div class="stat__value">${stats.enCours}</div></div>
            <div class="stat"><div class="stat__label">Retards</div><div class="stat__value${stats.retards ? ' stat__value--alert' : ''}">${stats.retards}</div></div>
            <div class="stat"><div class="stat__label">Réservations</div><div class="stat__value">${stats.reservations}</div></div>
            <div class="stat"><div class="stat__label">Total</div><div class="stat__value">${stats.total}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">Compte</h3></div>
          <p class="body-sm text-secondary">${active ? 'Ce compte peut emprunter et réserver.' : 'Ce compte est désactivé : aucune connexion ni emprunt possible.'}</p>
          <div class="form-actions"><button type="button" class="btn ${active ? 'btn--danger' : 'btn--primary'} btn--sm" data-action="toggle-active">${active ? 'Désactiver le compte' : 'Réactiver le compte'}</button></div>
        </div>
      </div>
    </div>`;
}

export function utilisateurFicheView(container, { id }) {
  // Une saisie en cours dans le formulaire ne doit jamais être écrasée par un re-rendu
  // déclenché ailleurs (autre onglet, autre action) : on avertit et on ne touche à rien.
  let dirty = false;

  const render = () => {
    if (dirty && container.querySelector('[data-role="user-form"]')) {
      toast('Données mises à jour ailleurs — enregistrez ou rechargez la fiche', 'warning');
      return;
    }
    const user = store.users.get(id);
    if (!user) {
      setTopbar({ title: 'Utilisateur introuvable' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Utilisateur introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
      return;
    }
    const date = now();
    setTopbar({ title: fullName(user), subtitle: `${LABELS.role[user.role]}${user.promo ? ` · ${user.promo}` : ''}` });
    container.innerHTML = userFicheHtml({ user, stats: userStats(id, date), history: userHistory(id), items: store.items.list(), date });
    const form = container.querySelector('[data-role="user-form"]');
    bindUserForm(form);
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      dirty = false;
      try {
        updateUser(id, readUserForm(form), auth.currentUserId());
        toast('Modifications enregistrées', 'success');
      } catch (err) {
        dirty = true;
        toast(err.message, 'error');
      }
    });
    container.querySelector('[data-action="toggle-active"]').addEventListener('click', () => {
      const activate = user.actif === false;
      openModal({
        title: activate ? `Réactiver ${fullName(user)}` : `Désactiver ${fullName(user)}`,
        body: `<p class="body-sm">${activate ? 'Le compte pourra de nouveau emprunter et réserver.' : 'Le compte ne pourra plus se connecter ni emprunter. Les emprunts en cours restent visibles.'}</p>`,
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: activate ? 'Réactiver' : 'Désactiver', variant: activate ? 'primary' : 'danger', onClick: () => { setUserActive(id, activate, auth.currentUserId()); toast(activate ? 'Compte réactivé' : 'Compte désactivé', 'success'); } },
        ],
      });
    });
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      navigate(el.dataset.href);
    }));
  };
  render();
  return store.subscribe(render);
}
