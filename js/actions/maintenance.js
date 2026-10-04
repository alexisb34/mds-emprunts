// js/actions/maintenance.js — cycle de vie des pannes : signalement, intervention, clôture.
// Spec §5.4 : clore le DERNIER événement ouvert d’un objet le remet en service (ou hors service).
import { store } from '../store.js';
import { MAINT_TYPES, MAINT_STATES, ITEM_STATES, LABELS } from '../models.js';
import { now } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { applyItemState } from './items.js';

function requireEvent(id) {
  const event = store.maintenance.get(id);
  if (!event) throw new Error('Événement de maintenance introuvable.');
  return event;
}

function requireItem(id) {
  const item = store.items.get(id);
  if (!item) throw new Error('Matériel introuvable.');
  return item;
}

function cleanText(value, champ) {
  const texte = String(value ?? '').trim();
  if (!texte) throw new Error(`La ${champ} est obligatoire.`);
  return texte;
}

// Les événements encore à traiter d’un objet : ouverts ou en cours.
export function openEvents(itemId) {
  return store.maintenance.list((m) => m.itemId === itemId && m.statut !== MAINT_STATES.CLOS);
}

// Un objet disponible part en maintenance dès le signalement ; emprunté ou réservé, il
// y partira à son retour (c’est `receiveLoan` qui s’en charge). Hors service, on n’y touche pas.
function immobiliser(itemId) {
  if (!itemId) return;
  const item = store.items.get(itemId);
  if (item && item.etat === ITEM_STATES.DISPONIBLE) applyItemState(itemId, ITEM_STATES.MAINTENANCE);
}

export function reportIssue({ itemId, auteurId, description, loanId = null, bookingId = null }) {
  const texte = cleanText(description, 'description');
  if (itemId) requireItem(itemId);
  const date = now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId: itemId || null, type: MAINT_TYPES.SIGNALEMENT, auteurId, date: date.toISOString(),
      statut: MAINT_STATES.OUVERT, description: texte, prestataire: '', cout: 0,
      loanId, bookingId,
    });
    immobiliser(itemId);
    logAction({ auteurId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: itemId || null, loanId, bookingId, detail: texte });
    return event;
  });
}

export function createIntervention({ itemId, type, prestataire = '', cout = 0, description, pedagoId }) {
  const item = requireItem(itemId);
  const texte = cleanText(description, 'description');
  if (type !== MAINT_TYPES.INTERNE && type !== MAINT_TYPES.EXTERNE) throw new Error('Type d’intervention inconnu.');
  const fournisseur = String(prestataire || '').trim();
  if (type === MAINT_TYPES.EXTERNE && !fournisseur) throw new Error('Une intervention externe demande un prestataire.');
  const montant = Number(cout) || 0;
  if (montant < 0) throw new Error('Le coût ne peut pas être négatif.');
  const date = now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId, type, auteurId: pedagoId, date: date.toISOString(), statut: MAINT_STATES.OUVERT,
      description: texte, prestataire: type === MAINT_TYPES.EXTERNE ? fournisseur : '', cout: montant,
      loanId: null, bookingId: null,
    });
    immobiliser(itemId);
    const suffixe = type === MAINT_TYPES.EXTERNE ? ` — ${fournisseur}${montant ? ` (${montant} €)` : ''}` : '';
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_INTERVENTION, itemId, detail: `${item.nom} : ${texte}${suffixe}` });
    return event;
  });
}

export function startIntervention(id, pedagoId) {
  const event = requireEvent(id);
  if (event.statut !== MAINT_STATES.OUVERT) {
    throw new Error(event.statut === MAINT_STATES.EN_COURS ? 'Cette intervention est déjà en cours.' : 'Cet événement est déjà clos.');
  }
  return store.transaction(() => {
    const updated = store.maintenance.update(id, { statut: MAINT_STATES.EN_COURS });
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_EN_COURS, itemId: event.itemId, detail: event.description });
    return updated;
  });
}

// Depuis quels états la clôture peut décider du sort de l’objet : un objet emprunté ou réservé
// n’est pas à nous — son retour le remettra dans le circuit.
const MAINT_RESOLVABLE = [ITEM_STATES.MAINTENANCE, ITEM_STATES.HS];

// `remettreEnService: false` → l’objet passe `hs` (définitif, masqué du catalogue, gardé à l’inventaire).
export function closeEvent(id, pedagoId, { remettreEnService = true } = {}) {
  const event = requireEvent(id);
  if (event.statut === MAINT_STATES.CLOS) throw new Error('Cet événement est déjà clos.');
  return store.transaction(() => {
    const updated = store.maintenance.update(id, { statut: MAINT_STATES.CLOS });
    let suffixe = '';
    // Le dernier événement ouvert de l’objet décide de son sort ; sinon on ne touche à rien.
    if (event.itemId && openEvents(event.itemId).length === 0) {
      const item = store.items.get(event.itemId);
      const cible = remettreEnService ? ITEM_STATES.DISPONIBLE : ITEM_STATES.HS;
      if (item && item.etat !== cible && MAINT_RESOLVABLE.includes(item.etat)) {
        applyItemState(event.itemId, cible);
        suffixe = ` — ${LABELS.itemState[cible].toLowerCase()}`;
      }
    }
    logAction({ auteurId: pedagoId, action: ACTIONS.MAINT_CLOS, itemId: event.itemId, detail: `${event.description}${suffixe}` });
    return updated;
  });
}


const RANG = { [MAINT_STATES.OUVERT]: 0, [MAINT_STATES.EN_COURS]: 1, [MAINT_STATES.CLOS]: 2 };

// Lignes de l’écran Maintenance : à traiter d’abord, plus récentes en tête.
export function maintenanceRows() {
  const items = store.items.list();
  const users = store.users.list();
  return store.maintenance.list()
    .map((event) => ({
      event,
      item: items.find((i) => i.id === event.itemId) || null,
      auteur: users.find((u) => u.id === event.auteurId) || null,
    }))
    .sort((a, b) => (RANG[a.event.statut] - RANG[b.event.statut]) || b.event.date.localeCompare(a.event.date));
}

// Matériel immobilisé : en maintenance ou hors service, avec ce qui reste à traiter.
export function immobilises() {
  return store.items
    .list((i) => i.etat === ITEM_STATES.MAINTENANCE || i.etat === ITEM_STATES.HS)
    .map((item) => ({ item, ouverts: openEvents(item.id) }))
    .sort((a, b) => a.item.nom.localeCompare(b.item.nom, 'fr'));
}
