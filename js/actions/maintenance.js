// js/actions/maintenance.js — cycle de vie des pannes : signalement, intervention, clôture.
// Spec §5.4 : clore le DERNIER événement ouvert d’un objet le remet en service (ou hors service).
import { store } from '../store.js';
import { MAINT_TYPES, MAINT_STATES, ITEM_STATES, ITEM_TRANSITIONS, LABELS } from '../models.js';
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

function cleanDescription(value) {
  const texte = String(value ?? '').trim();
  if (!texte) throw new Error('La description est obligatoire.');
  return texte;
}

// Les événements encore à traiter d’un objet : ouverts ou en cours.
export function openEvents(itemId) {
  return store.maintenance.list((m) => m.itemId === itemId && m.statut !== MAINT_STATES.CLOS);
}

// L’état que doit porter un objet au vu de ses événements ouverts. `souhaite` est ce que
// l’appelant voudrait (retour au catalogue, mise hors service) ; un événement encore ouvert
// prime sur une remise en service, jamais sur une mise hors service.
// Rend l’état courant quand la transition est interdite, et null quand l’objet n’existe pas.
// ATTENTION : l’appelant doit comparer à l’état courant avant d’écrire. `ITEM_TRANSITIONS`
// n’autorise aucune transition vers soi-même, donc passer directement ce retour à
// `applyItemState` lèverait « Transition matériel interdite » sur ces deux cas.
export function resolveItemState(itemId, souhaite) {
  const item = itemId ? store.items.get(itemId) : null;
  if (!item) return null;
  const cible = souhaite === ITEM_STATES.DISPONIBLE && openEvents(itemId).length > 0 ? ITEM_STATES.MAINTENANCE : souhaite;
  return (ITEM_TRANSITIONS[item.etat] || []).includes(cible) ? cible : item.etat;
}

// Un objet disponible part en maintenance dès le signalement ; emprunté ou réservé, il
// y partira à son retour (c’est `receiveLoan` qui s’en charge). Hors service, on n’y touche pas.
function immobiliser(itemId) {
  if (!itemId) return;
  const item = store.items.get(itemId);
  if (item && item.etat === ITEM_STATES.DISPONIBLE) applyItemState(itemId, ITEM_STATES.MAINTENANCE);
}

export function reportIssue({ itemId, auteurId, description, loanId = null, bookingId = null }) {
  const texte = cleanDescription(description);
  // Un identifiant vide (`''`, `null`, `undefined`) veut dire « sans objet » : signalement de salle.
  const cible = itemId || null;
  if (cible) requireItem(cible);
  const date = now();
  return store.transaction(() => {
    const event = store.maintenance.create({
      itemId: cible, type: MAINT_TYPES.SIGNALEMENT, auteurId, date: date.toISOString(),
      statut: MAINT_STATES.OUVERT, description: texte, prestataire: '', cout: 0,
      loanId, bookingId,
    });
    immobiliser(cible);
    logAction({ auteurId, action: ACTIONS.MAINT_SIGNALEMENT, itemId: cible, loanId, bookingId, detail: texte });
    return event;
  });
}

export function createIntervention({ itemId, type, prestataire = '', cout = 0, description, pedagoId }) {
  const item = requireItem(itemId);
  const texte = cleanDescription(description);
  if (type !== MAINT_TYPES.INTERNE && type !== MAINT_TYPES.EXTERNE) throw new Error('Type d’intervention inconnu.');
  const fournisseur = String(prestataire || '').trim();
  if (type === MAINT_TYPES.EXTERNE && !fournisseur) throw new Error('Une intervention externe demande un prestataire.');
  // Un coût absent ou vide vaut 0 ; un texte non numérique (« 12o ») est refusé, pas converti en 0.
  const montant = cout === '' || cout == null ? 0 : Number(cout);
  if (!Number.isFinite(montant)) throw new Error('Le coût doit être un nombre.');
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

// Un objet emprunté ou réservé n’est pas à nous : la clôture ne décide pas de son sort,
// c’est son retour (ou la fin de sa réservation) qui le remettra dans le circuit.
const estDehors = (item) => item.etat === ITEM_STATES.EMPRUNTE || item.etat === ITEM_STATES.RESERVE;

// `remettreEnService: false` → l’objet passe `hs` (définitif, masqué du catalogue, gardé à l’inventaire).
// `remettreEnService: true` → l’objet repasse `disponible` ; `undefined` → on ne touche pas à son état.
export function closeEvent(id, pedagoId, { remettreEnService } = {}) {
  const event = requireEvent(id);
  if (event.statut === MAINT_STATES.CLOS) throw new Error('Cet événement est déjà clos.');
  // Décider « hors service » d’un objet encore dehors serait perdu : son retour le remettrait au catalogue.
  if (remettreEnService === false && event.itemId) {
    const dehors = store.items.get(event.itemId);
    if (dehors && estDehors(dehors)) {
      throw new Error('Cet objet est encore dehors : attendez son retour pour le passer hors service.');
    }
  }
  return store.transaction(() => {
    const updated = store.maintenance.update(id, { statut: MAINT_STATES.CLOS });
    let suffixe = '';
    // Le dernier événement ouvert de l’objet décide de son sort ; sinon on ne touche à rien.
    if (event.itemId && openEvents(event.itemId).length === 0) {
      const item = store.items.get(event.itemId);
      const souhaite = remettreEnService === true ? ITEM_STATES.DISPONIBLE
        : remettreEnService === false ? ITEM_STATES.HS : null;
      if (item && souhaite && !estDehors(item)) {
        const cible = resolveItemState(item.id, souhaite);
        // Le journal ne mentionne l’état que s’il a vraiment changé.
        if (cible && cible !== item.etat) {
          applyItemState(item.id, cible);
          suffixe = ` — ${LABELS.itemState[cible].toLowerCase()}`;
        }
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
    // `ordre` : rang d’insertion. Les identifiants créés ne sont pas séquentiels (horodatage + aléa) ;
    // la liste, elle, est en ordre de création.
    .map((event, ordre) => ({
      ordre,
      event,
      item: items.find((i) => i.id === event.itemId) || null,
      auteur: users.find((u) => u.id === event.auteurId) || null,
    }))
    .sort((a, b) => (RANG[a.event.statut] - RANG[b.event.statut])
      || b.event.date.localeCompare(a.event.date)
      // Horloge de démo figée : deux événements partagent la même date, l’ordre d’insertion tranche.
      || b.ordre - a.ordre)
    .map(({ event, item, auteur }) => ({ event, item, auteur }));
}

// Matériel immobilisé : en maintenance ou hors service, avec ce qui reste à traiter.
export function immobilises() {
  return store.items
    .list((i) => i.etat === ITEM_STATES.MAINTENANCE || i.etat === ITEM_STATES.HS)
    .map((item) => ({ item, aTraiter: openEvents(item.id) }))
    .sort((a, b) => a.item.nom.localeCompare(b.item.nom, 'fr'));
}
