// js/admin/views/maintenance.js — écran Maintenance : les événements par statut,
// la création et la clôture d’interventions, et le matériel immobilisé.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { MAINT_STATES, MAINT_TYPES, ITEM_STATES, LABELS } from '../../models.js';
import { escapeHtml, badge, fullName, formatDate, openModal, toast } from '../../ui.js';
import { reportIssue, createIntervention, startIntervention, closeEvent, maintenanceRows } from '../../actions/maintenance.js';
import { setItemState, deleteItem } from '../../actions/items.js';
import { ICONS } from '../../mobile/layout.js';
import { setTopbar } from '../layout.js';
import { renderTable, bindTable, sortRows, toggleSort } from '../table.js';
import { COLUMNS as ITEM_COLUMNS, filterItems, filtersHtml } from './materiel.js';

// Les quatre cartes du haut sont le filtre de l’écran. Les trois premières comptent des
// événements, la dernière compte des objets : c’est le seul panneau qui montre un inventaire.
export const CARTES = [
  { key: MAINT_STATES.OUVERT, label: 'Signalements', variante: 'kpi--retard' },
  { key: MAINT_STATES.EN_COURS, label: 'En maintenance', variante: 'kpi--maintenance' },
  { key: MAINT_STATES.CLOS, label: 'Clos', variante: 'kpi--disponible' },
  { key: 'hs', label: 'Hors service', variante: 'kpi--hs' },
];

// Un signalement d’état des lieux de salle n’a pas d’objet : il garde un titre lisible
// et pointe vers le planning plutôt que vers une fiche matériel inexistante.
function titreEtLien({ event, item }) {
  if (item) return { titre: item.nom, href: `/materiel/${item.id}` };
  if (event.bookingId) return { titre: 'Salle photo — état des lieux', href: '/salle' };
  return { titre: 'Sans objet', href: null };
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

function coutHtml(event) {
  if (!event.cout) return '';
  return `<span class="body-tiny text-secondary">${escapeHtml(EUROS.format(event.cout))}</span>`;
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

// Deux actions sur un matériel hors service : le remettre en circuit, ou le sortir pour de bon.
// Le libellé est sur aria-label, l’infobulle le lit.
export const ACTIONS_HS = {
  key: 'actions', label: 'Actions', align: 'right',
  render: (item) => {
    const bouton = (action, libelle, icone) => `<button type="button" class="btn btn--ghost btn--sm btn--icon tooltip" data-${action}="${escapeHtml(item.id)}" aria-label="${escapeHtml(libelle)}">${icone}</button>`;
    return `<div class="table__actions">${bouton('remettre', 'Remettre en service', ICONS.remettre)}${bouton('supprimer', 'Supprimer définitivement', ICONS.corbeille)}</div>`;
  },
};

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function horsServiceHtml({ items, filters, sort }) {
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Hors service</h2><span class="body-sm text-secondary">${plural(items.length, 'produit', 'produits')}</span></div>
      ${filtersHtml(filters)}
      <div data-role="table">${renderTable({ columns: [...ITEM_COLUMNS, ACTIONS_HS], rows: items, sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel hors service.' })}</div>
    </div>`;
}

export function maintenanceHtml({ rows, hs, filtre, filters, sort }) {
  const compte = (key) => (key === 'hs' ? hs.length : rows.filter((r) => r.event.statut === key).length);
  const cartes = CARTES.map((c) => `<button type="button" class="kpi kpi--link ${c.variante}${c.key === filtre ? ' kpi--actif' : ''}" data-filtre="${c.key}" aria-pressed="${c.key === filtre}"><span class="kpi__label">${escapeHtml(c.label)}</span><span class="kpi__value">${compte(c.key)}</span><span class="kpi__go" aria-hidden="true">↗</span></button>`).join('');
  const panneau = filtre === 'hs'
    ? horsServiceHtml({ items: hs, filters, sort })
    : `<div class="card">
      <div class="card__header">
        <h2 class="card__title">${escapeHtml(CARTES.find((c) => c.key === filtre).label)}</h2>
        <div class="table__actions">
          <button type="button" class="btn btn--secondary btn--sm" data-action="new-signalement">+ Ajouter un signalement</button>
          <button type="button" class="btn btn--primary btn--sm" data-action="new-intervention">+ Ajouter une maintenance</button>
        </div>
      </div>
      <div>${eventsTableHtml({ rows, filtre })}</div>
    </div>`;
  return `
    <div class="kpi-band"><div class="grid-4">${cartes}</div></div>
    ${panneau}`;
}

// Les libellés viennent de `LABELS.maintType`, comme dans le tableau : un seul vocabulaire.
const TYPES = [MAINT_TYPES.INTERNE, MAINT_TYPES.EXTERNE].map((value) => ({ value, label: LABELS.maintType[value] }));

// Le choix du matériel, commun au signalement et à l’intervention.
function itemSelectHtml(items) {
  return `<label class="field"><span class="field__label">Matériel</span><select class="select" name="itemId">${items.map((i) => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.nom)}</option>`).join('')}</select></label>`;
}

// `item` null = l’objet reste à choisir dans la liste.
export function interventionFormHtml(item = null, items = []) {
  const choixObjet = item
    ? `<p class="body-sm"><strong>${escapeHtml(item.nom)}</strong></p><input type="hidden" name="itemId" value="${escapeHtml(item.id)}">`
    : itemSelectHtml(items);
  return `
    <div class="stack">
      ${choixObjet}
      <label class="field"><span class="field__label">Type</span><select class="select" name="type">${TYPES.map((t) => `<option value="${t.value}">${escapeHtml(t.label)}</option>`).join('')}</select></label>
      <label class="field"><span class="field__label">Prestataire</span><input class="input" name="prestataire" placeholder="Objectif Service"><span class="field__hint">Pour une intervention externe.</span></label>
      <label class="field"><span class="field__label">Coût en euros</span><input class="input" name="cout" type="text" inputmode="decimal" value="0" placeholder="120,50"></label>
      <label class="field"><span class="field__label">N° ou lien de facture</span><input class="input" name="facture" placeholder="FA-2026-0142"><span class="field__hint">Pour retrouver la dépense. Cochez la case si le prestataire n’en a pas établi.</span></label>
      <label class="checkbox"><input type="checkbox" name="sansFacture"> Sans facture</label>
      <label class="field"><span class="field__label">Description</span><textarea class="textarea" name="description" placeholder="Révision de la bague"></textarea></label>
    </div>`;
}

// Signalement créé à la main par la pédago (spec §5.4) : un objet et ce qui ne va pas.
export function signalementFormHtml(items = []) {
  return `
    <div class="stack">
      ${itemSelectHtml(items)}
      <label class="field"><span class="field__label">Description</span><textarea class="textarea" name="description" placeholder="Câble d’alimentation manquant"></textarea></label>
    </div>`;
}

export function readSignalementForm(root) {
  const val = (name) => root.querySelector(`[name="${name}"]`)?.value ?? '';
  return { itemId: val('itemId'), description: val('description').trim() };
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
    // La case cochée l’emporte sur le champ : « sans facture » est une réponse, pas un oubli.
    facture: root.querySelector('[name="sansFacture"]')?.checked ? '' : val('facture').trim(),
    sansFacture: !!root.querySelector('[name="sansFacture"]')?.checked,
    description: val('description').trim(),
  };
}

export function maintenanceView(container) {
  let filtre = MAINT_STATES.OUVERT;
  // Les filtres du tableau du hors service, et son tri : ils ne vivent que dans ce panneau.
  const filters = { q: '', categorie: '', circuit: '', etat: '' };
  let sort = { key: 'code', dir: 'asc' };
  const horsService = () => sortRows(filterItems(store.items.list((i) => i.etat === ITEM_STATES.HS), filters), sort, ITEM_COLUMNS);

  const render = () => {
    const rows = maintenanceRows();
    const hs = horsService();
    setTopbar({ title: 'Maintenance', subtitle: `${rows.filter((r) => r.event.statut !== MAINT_STATES.CLOS).length} à traiter` });
    container.innerHTML = maintenanceHtml({ rows, hs, filtre, filters, sort });
    container.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => { filtre = b.dataset.filtre; render(); }));
    if (filtre === 'hs') {
      // Le tableau seul est re-rendu : les champs gardent le focus pendant la frappe.
      const renderTableOnly = () => {
        container.querySelector('[data-role="table"]').innerHTML = renderTable({ columns: [...ITEM_COLUMNS, ACTIONS_HS], rows: horsService(), sort, rowHref: (i) => `/materiel/${i.id}`, emptyText: 'Aucun matériel hors service.' });
        bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
        bindHsActions();
      };
      container.querySelector('[name="q"]').addEventListener('input', (e) => { filters.q = e.target.value; renderTableOnly(); });
      for (const nom of ['categorie', 'circuit', 'etat']) {
        container.querySelector(`[name="${nom}"]`).addEventListener('change', (e) => { filters[nom] = e.target.value; renderTableOnly(); });
      }
      bindTable(container, { onSort: (key) => { sort = toggleSort(sort, key); renderTableOnly(); }, onRow: navigate });
    }
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
    bindHsActions();
    function bindHsActions() {
    container.querySelectorAll('[data-remettre]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      try { const item = setItemState(b.dataset.remettre, ITEM_STATES.DISPONIBLE, auth.currentUserId()); toast(`${item.nom} est de nouveau disponible`, 'success'); }
      catch (err) { toast(err.message, 'error'); }
    }));
    container.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = store.items.get(b.dataset.supprimer);
      if (!item) return;
      openModal({
        title: 'Supprimer définitivement',
        body: `<p class="body-sm"><strong>${escapeHtml(item.nom)}</strong> (${escapeHtml(item.code)}) quitte l’inventaire pour de bon, avec ses interventions. Les emprunts passés et le journal gardent la trace. Le numéro ne sera pas réattribué.</p>`,
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Supprimer', variant: 'danger', onClick: () => {
            try { deleteItem(item.id, auth.currentUserId()); toast(`${item.nom} supprimé`, 'success'); }
            catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    }));
    }
    const itemsParNom = () => store.items.list().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    // Le panneau du hors service est un inventaire : il ne porte pas ces deux boutons.
    container.querySelector('[data-action="new-signalement"]')?.addEventListener('click', () => {
      openModal({
        title: 'Signaler une panne',
        body: signalementFormHtml(itemsParNom()),
        actions: [
          { label: 'Annuler', variant: 'ghost' },
          { label: 'Signaler', variant: 'primary', onClick: (modal) => {
            try {
              reportIssue({ ...readSignalementForm(modal), auteurId: auth.currentUserId() });
              toast('Panne signalée', 'success');
            } catch (err) { toast(err.message, 'error'); return false; }
          } },
        ],
      });
    });
    container.querySelector('[data-action="new-intervention"]')?.addEventListener('click', () => {
      const items = itemsParNom();
      const modale = openModal({
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
      // `openModal` a fini de poser la modale avant de rendre la main : le champ de facture
      // se grise ici, quand la case « sans facture » est cochée.
      const sans = document.querySelector('#modal-root [name="sansFacture"]');
      const facture = document.querySelector('#modal-root [name="facture"]');
      sans.addEventListener('change', () => { facture.disabled = sans.checked; if (sans.checked) facture.value = ''; });
      return modale;
    });
  };
  render();
  return store.subscribe(render);
}
