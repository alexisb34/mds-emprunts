// js/admin/views/maintenance.js — écran Maintenance : les événements par statut,
// la création et la clôture d’interventions, et le matériel immobilisé.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { MAINT_STATES, MAINT_TYPES, LABELS } from '../../models.js';
import { escapeHtml, badge, fullName, formatDate, openModal, toast } from '../../ui.js';
import { createIntervention, startIntervention, closeEvent, maintenanceRows, immobilises } from '../../actions/maintenance.js';
import { setTopbar } from '../layout.js';

const FILTRES = [
  { key: 'tous', label: 'Tous' },
  { key: MAINT_STATES.OUVERT, label: 'Ouverts' },
  { key: MAINT_STATES.EN_COURS, label: 'En cours' },
  { key: MAINT_STATES.CLOS, label: 'Clos' },
];

// Un signalement d’état des lieux de salle n’a pas d’objet : il garde un titre lisible
// et pointe vers le planning plutôt que vers une fiche matériel inexistante.
function titreEtLien({ event, item }) {
  if (item) return { titre: item.nom, href: `/materiel/${item.id}` };
  if (event.bookingId) return { titre: 'Salle photo — état des lieux', href: '/salle' };
  return { titre: 'Sans objet', href: null };
}

function coutHtml(event) {
  if (!event.cout) return '';
  return `<span class="body-tiny text-secondary">${escapeHtml(String(event.cout))} €</span>`;
}

export function eventsTableHtml({ rows, filtre }) {
  const visibles = filtre === 'tous' ? rows : rows.filter((r) => r.event.statut === filtre);
  if (!visibles.length) return '<div class="empty-state">Aucun événement pour ce filtre.</div>';
  const lignes = visibles.map((row) => {
    const { event, auteur } = row;
    const { titre, href } = titreEtLien(row);
    const actions = [
      event.statut === MAINT_STATES.OUVERT ? `<button type="button" class="btn btn--secondary btn--sm" data-start="${escapeHtml(event.id)}">Démarrer</button>` : '',
      event.statut !== MAINT_STATES.CLOS ? `<button type="button" class="btn btn--primary btn--sm" data-close="${escapeHtml(event.id)}">Clôturer</button>` : '',
    ].join('');
    return `
      <tr${href ? ` data-href="${escapeHtml(href)}"` : ''}>
        <td><strong>${escapeHtml(titre)}</strong><span class="activity__detail">${escapeHtml(event.description)}</span></td>
        <td>${escapeHtml(LABELS.maintType?.[event.type] || event.type)}${event.prestataire ? `<span class="activity__detail">${escapeHtml(event.prestataire)}</span>` : ''}${coutHtml(event)}</td>
        <td>${escapeHtml(formatDate(event.date))}${auteur ? `<span class="activity__detail">${escapeHtml(fullName(auteur))}</span>` : ''}</td>
        <td>${badge('maint', event.statut)}</td>
        <td><div class="table__actions">${actions}</div></td>
      </tr>`;
  }).join('');
  return `
    <table class="table">
      <thead><tr><th>Objet</th><th>Type</th><th>Date</th><th>Statut</th><th></th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>`;
}

export function immobilisesHtml(rows) {
  if (!rows.length) return '<div class="empty-state">Aucun matériel immobilisé.</div>';
  return `<div class="list">${rows.map(({ item, aTraiter }) => `
    <div class="list__item" data-href="/materiel/${escapeHtml(item.id)}">
      <div class="list__grow"><strong>${escapeHtml(item.nom)}</strong><span class="activity__detail">${aTraiter.length ? `${aTraiter.length} à traiter` : 'rien à traiter'}</span></div>
      ${badge('item', item.etat)}
    </div>`).join('')}</div>`;
}

export function maintenanceHtml({ rows, bloques, filtre }) {
  const onglets = FILTRES.map((f) => {
    const n = f.key === 'tous' ? rows.length : rows.filter((r) => r.event.statut === f.key).length;
    return `<button type="button" data-filtre="${f.key}" class="tab${f.key === filtre ? ' is-active' : ''}">${escapeHtml(f.label)} <span class="tab__count">${n}</span></button>`;
  }).join('');
  return `
    <div class="grid-2">
      <div class="card">
        <div class="card__header">
          <div class="tabs">${onglets}</div>
          <button type="button" class="btn btn--primary btn--sm" data-action="new-intervention">Créer une intervention</button>
        </div>
        <div data-role="events">${eventsTableHtml({ rows, filtre })}</div>
      </div>
      <div class="card">
        <div class="card__header"><h2 class="card__title">Matériel immobilisé</h2><span class="body-sm text-secondary">${bloques.length}</span></div>
        ${immobilisesHtml(bloques)}
      </div>
    </div>`;
}

const TYPES = [
  { value: MAINT_TYPES.INTERNE, label: 'Interne' },
  { value: MAINT_TYPES.EXTERNE, label: 'Externe (prestataire)' },
];

// `item` null = l’objet reste à choisir dans la liste.
export function interventionFormHtml(item = null, items = []) {
  const choixObjet = item
    ? `<p class="body-sm"><strong>${escapeHtml(item.nom)}</strong></p><input type="hidden" name="itemId" value="${escapeHtml(item.id)}">`
    : `<label class="field"><span class="field__label">Matériel</span><select class="select" name="itemId">${items.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.nom)}</option>`).join('')}</select></label>`;
  return `
    <div class="stack">
      ${choixObjet}
      <label class="field"><span class="field__label">Type</span><select class="select" name="type">${TYPES.map((t) => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('')}</select></label>
      <label class="field"><span class="field__label">Prestataire (intervention externe)</span><input class="input" name="prestataire" placeholder="Objectif Service"></label>
      <label class="field"><span class="field__label">Coût en euros</span><input class="input" name="cout" type="text" inputmode="decimal" value="0" placeholder="120,50"></label>
      <label class="field"><span class="field__label">Description</span><textarea class="textarea" name="description" placeholder="Révision de la bague"></textarea></label>
    </div>`;
}

export function readInterventionForm(root) {
  const val = (name) => root.querySelector(`[name="${name}"]`)?.value ?? '';
  return {
    itemId: val('itemId'),
    type: val('type'),
    prestataire: val('prestataire').trim(),
    // `type="number"` rendrait « 120,50 » comme une valeur vide : on lit du texte et on
    // normalise la virgule décimale. `createIntervention` refuse ce qui n’est pas un nombre.
    cout: val('cout').trim().replace(',', '.'),
    description: val('description').trim(),
  };
}

export function maintenanceView(container) {
  let filtre = MAINT_STATES.OUVERT;
  const render = () => {
    const rows = maintenanceRows();
    const bloques = immobilises();
    setTopbar({ title: 'Maintenance', subtitle: `${rows.filter((r) => r.event.statut !== MAINT_STATES.CLOS).length} à traiter` });
    container.innerHTML = maintenanceHtml({ rows, bloques, filtre });
    container.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; render(); }));
    container.querySelectorAll('[data-href]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return;
      navigate(el.dataset.href);
    }));
    container.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { startIntervention(b.dataset.start, auth.currentUserId()); toast('Intervention démarrée', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    }));
    container.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.close;
      const event = store.maintenance.get(id);
      const avecObjet = !!(event && event.itemId);
      openModal({
        title: 'Clôturer l’événement',
        body: avecObjet
          ? '<p class="body-sm">Si c’est le dernier événement ouvert de cet objet, il repart dans le circuit. Choisissez « Hors service » s’il ne doit plus être emprunté.</p>'
          : '<p class="body-sm">Cet événement ne porte sur aucun objet : la clôture ne change rien à l’inventaire.</p>',
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          ...(avecObjet ? [{ label: 'Hors service', variant: 'danger', onClick: () => {
            try { closeEvent(id, auth.currentUserId(), { remettreEnService: false }); toast('Matériel passé hors service', 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } }] : []),
          { label: avecObjet ? 'Remettre en service' : 'Clôturer', variant: 'primary', onClick: () => {
            try { closeEvent(id, auth.currentUserId(), { remettreEnService: true }); toast('Événement clos', 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    }));
    container.querySelector('[data-action="new-intervention"]').addEventListener('click', () => {
      const items = store.items.list().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      openModal({
        title: 'Créer une intervention',
        body: interventionFormHtml(null, items),
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Créer', variant: 'primary', onClick: (modal) => {
            try {
              createIntervention({ ...readInterventionForm(modal), pedagoId: auth.currentUserId() });
              toast('Intervention créée', 'success');
            } catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    });
  };
  render();
  return store.subscribe(render);
}
