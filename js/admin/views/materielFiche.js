// js/admin/views/materielFiche.js — fiche d’un exemplaire : infos éditables, état, QR, historiques.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, isLate } from '../../rules.js';
import { navigate } from '../../router.js';
import { LABELS, ITEM_STATES } from '../../models.js';
import { ACTION_LABELS } from '../../log.js';
import { escapeHtml, badge, formatDate, formatDateTime, formatTime, relativeDay, fullName, openModal, toast } from '../../ui.js';
import { updateItem, setItemState, manualTransitions, itemHistory } from '../../actions/items.js';
import { renderQr } from '../../qr.js';
import { setTopbar } from '../layout.js';
import { itemFormHtml, readItemForm } from './materiel.js';

const nameOf = (users, id) => { const u = users.find((x) => x.id === id); return u ? fullName(u) : (id || '—'); };

function loansTable(loans, users, date) {
  if (!loans.length) return '<div class="empty-state">Aucun emprunt enregistré.</div>';
  const photo = (src, alt) => (src ? `<img class="thumb" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">` : '');
  const rows = loans.map((l) => `
    <tr data-href="/utilisateurs/${escapeHtml(l.userId)}">
      <td>${escapeHtml(nameOf(users, l.userId))}</td>
      <td>${escapeHtml(l.dateRetrait ? formatDateTime(l.dateRetrait) : formatDate(l.debutPrevu))}</td>
      <td>${escapeHtml(formatDate(l.finPrevue))}</td>
      <td>${l.dateRetourReelle ? escapeHtml(formatDate(l.dateRetourReelle)) : '—'}</td>
      <td>${badge('loan', isLate(l, date) ? 'en_retard' : l.statut)}</td>
      <td>${photo(l.photoEmprunt, 'Photo à l’emprunt')} ${photo(l.photoRetour, 'Photo au retour')}</td>
    </tr>`).join('');
  return `<table class="table"><thead><tr><th>Emprunteur</th><th>Retrait</th><th>Retour prévu</th><th>Retour réel</th><th>Statut</th><th>Photos</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function maintenanceList(events) {
  if (!events.length) return '<div class="empty-state">Aucune intervention.</div>';
  return `<div class="list">${events.map((m) => `
    <div class="list__item">
      <div class="list__grow">
        <strong>${escapeHtml(LABELS.maintType[m.type] || m.type)}</strong>${m.prestataire ? ` · ${escapeHtml(m.prestataire)}` : ''}${m.cout ? ` · ${escapeHtml(m.cout)} €` : ''}
        <span class="activity__detail">${escapeHtml(m.description)}</span>
        <span class="activity__detail">${escapeHtml(formatDate(m.date))}</span>
      </div>
      ${badge('maint', m.statut)}
    </div>`).join('')}</div>`;
}

function journal(entries, users, date) {
  if (!entries.length) return '<div class="empty-state">Aucune activité.</div>';
  return `<div class="activity">${entries.map((e) => `
    <div class="activity__item">
      <span class="activity__time">${escapeHtml(relativeDay(e.date, date))}<br>${escapeHtml(formatTime(e.date))}</span>
      <div><strong>${escapeHtml(ACTION_LABELS[e.action] || e.action)}</strong> <span class="text-secondary">· ${escapeHtml(nameOf(users, e.auteurId))}</span><span class="activity__detail">${escapeHtml(e.detail)}</span></div>
    </div>`).join('')}</div>`;
}

export function ficheHtml({ item, history, users, transitions, references, date }) {
  const stateButtons = transitions.length
    ? `<div class="state-actions">${transitions.map((s) => `<button type="button" class="btn btn--secondary btn--sm" data-state="${s}">Passer en « ${escapeHtml(LABELS.itemState[s])} »</button>`).join('')}</div>`
    : '<p class="body-tiny text-secondary">L’état est piloté par l’emprunt ou la réservation en cours.</p>';
  return `
    <div class="page-header">
      <div>
        <a class="back-link" href="#/materiel">← Matériel</a>
        <h2 class="h5">${escapeHtml(item.nom)}</h2>
        <p class="page-header__meta">${escapeHtml(item.code)} · ${escapeHtml(item.categorie)} · ${badge('circuit', item.circuit)} ${badge('item', item.etat)}</p>
      </div>
    </div>
    <div class="detail-grid">
      <div class="stack">
        <div class="card">
          <div class="card__header"><h3 class="card__title">Informations</h3></div>
          <form data-role="item-form">${itemFormHtml(item, references)}<div class="form-actions"><button type="submit" class="btn btn--primary">Enregistrer</button></div></form>
        </div>
        <div class="card"><div class="card__header"><h3 class="card__title">Historique des emprunts</h3><span class="body-sm text-secondary">${history.loans.length}</span></div>${loansTable(history.loans, users, date)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Maintenance</h3></div>${maintenanceList(history.maintenance)}</div>
        <div class="card"><div class="card__header"><h3 class="card__title">Journal</h3></div>${journal(history.log, users, date)}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card__header"><h3 class="card__title">État</h3>${badge('item', item.etat)}</div>${stateButtons}</div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">QR code</h3></div>
          <div class="qr-box">
            <div id="qr" data-code="${escapeHtml(item.code)}"></div>
            <strong class="label-lg">${escapeHtml(item.code)}</strong>
            <a class="btn btn--secondary btn--sm" href="etiquettes.html?codes=${encodeURIComponent(item.code)}" target="_blank" rel="noopener">Imprimer l’étiquette</a>
          </div>
        </div>
        <div class="card">
          <div class="card__header"><h3 class="card__title">Détails</h3></div>
          <div class="stat-row">
            <div class="stat"><div class="stat__label">Valeur</div><div class="stat__value">${escapeHtml(item.valeurEstimee)} €</div></div>
            <div class="stat"><div class="stat__label">Emprunts</div><div class="stat__value">${history.loans.length}</div></div>
          </div>
          <p class="body-tiny text-secondary form-actions">Ajouté le ${escapeHtml(formatDate(item.createdAt))} · modifié le ${escapeHtml(formatDate(item.updatedAt))}</p>
        </div>
      </div>
    </div>`;
}

export function materielFicheView(container, { id }) {
  // Une saisie en cours dans le formulaire ne doit jamais être écrasée par un re-rendu
  // déclenché ailleurs (autre onglet, autre action) : on avertit et on ne touche à rien.
  let dirty = false;

  const askStateChange = (item, etat) => openModal({
    title: `Passer « ${item.nom} » en ${LABELS.itemState[etat]}`,
    body: '<label class="field"><span class="field__label">Motif (optionnel)</span><textarea class="textarea" name="motif" placeholder="Ex. : câble sectionné, envoyé chez le prestataire…"></textarea></label>',
    actions: [
      { label: 'Annuler', variant: 'ghost' },
      {
        label: 'Confirmer', variant: etat === ITEM_STATES.HS ? 'danger' : 'primary',
        onClick: (modal) => {
          try {
            setItemState(item.id, etat, auth.currentUserId(), modal.querySelector('[name="motif"]').value.trim());
            toast(`État mis à jour : ${LABELS.itemState[etat]}`, 'success');
          } catch (err) {
            toast(err.message, 'error');
            return false;
          }
        },
      },
    ],
  });

  const render = () => {
    if (dirty && container.querySelector('[data-role="item-form"]')) {
      toast('Données mises à jour ailleurs — enregistrez ou rechargez la fiche', 'warning');
      return;
    }
    const item = store.items.get(id);
    if (!item) {
      setTopbar({ title: 'Matériel introuvable' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
      return;
    }
    const date = now();
    const users = store.users.list();
    const references = [...new Set(store.items.list().map((i) => i.reference))].sort();
    setTopbar({ title: item.nom, subtitle: `${item.code} · ${LABELS.itemState[item.etat]}` });
    container.innerHTML = ficheHtml({ item, history: itemHistory(id), users, transitions: manualTransitions(item), references, date });
    renderQr(container.querySelector('#qr'), item.code, 160);
    const form = container.querySelector('[data-role="item-form"]');
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      dirty = false;
      try {
        updateItem(id, readItemForm(e.target), auth.currentUserId());
        toast('Modifications enregistrées', 'success');
      } catch (err) {
        dirty = true;
        toast(err.message, 'error');
      }
    });
    container.querySelectorAll('[data-state]').forEach((btn) => btn.addEventListener('click', () => askStateChange(item, btn.dataset.state)));
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('a, button, img')) return;
      navigate(el.dataset.href);
    }));
  };

  render();
  return store.subscribe(render);
}
