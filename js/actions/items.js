// js/actions/items.js — mutations métier sur le matériel. Toute écriture passe ici,
// valide les données, respecte les transitions d’état et écrit le journal.
import { store } from '../store.js';
import { ITEM_STATES, ITEM_TRANSITIONS, LOAN_STATES, CIRCUITS, CATEGORIES, LABELS, assertTransition } from '../models.js';
import { logAction, ACTIONS, logForItem } from '../log.js';
import { sortByDateDesc } from '../rules.js';

const PROTECTED_FIELDS = ['id', 'code', 'etat', 'createdAt', 'updatedAt'];

// États que la pédago peut fixer à la main ; `emprunte` est piloté par les emprunts ; une réservation n’écrit aucun état.
export const MANUAL_STATES = [ITEM_STATES.DISPONIBLE, ITEM_STATES.MAINTENANCE, ITEM_STATES.HS];

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Les codes ne sont jamais réutilisés. Supprimer un matériel libère sa place dans l’inventaire,
// pas son numéro : des étiquettes imprimées le portent encore. Le journal garde chaque code émis,
// le compteur repart donc du plus grand des deux.
export function nextItemCode() {
  const textes = [...store.items.list().map((i) => i.code), ...store.log.list().map((e) => e.detail)];
  const max = textes.reduce((plusGrand, texte) => {
    for (const [, n] of String(texte).matchAll(/MDS-(\d{4})/g)) plusGrand = Math.max(plusGrand, Number(n));
    return plusGrand;
  }, 0);
  return `MDS-${String(max + 1).padStart(4, '0')}`;
}

export function validateItem(data) {
  const errors = [];
  if (!data.nom || !String(data.nom).trim()) errors.push('Le nom est obligatoire.');
  if (!data.reference || !String(data.reference).trim()) errors.push('La référence est obligatoire.');
  if (!CATEGORIES.includes(data.categorie)) errors.push('La catégorie est invalide.');
  if (!Object.values(CIRCUITS).includes(data.circuit)) errors.push('Le circuit est invalide.');
  if (data.valeurEstimee !== undefined && (Number.isNaN(Number(data.valeurEstimee)) || Number(data.valeurEstimee) < 0)) {
    errors.push('La valeur estimée doit être un nombre positif.');
  }
  return errors;
}

function assertValid(data) {
  const errors = validateItem(data);
  if (errors.length) throw new Error(errors.join(' '));
}

function requireItem(id) {
  const item = store.items.get(id);
  if (!item) throw new Error(`Matériel introuvable (${id})`);
  return item;
}

export function createItem(data, auteurId) {
  const clean = {
    nom: String(data.nom || '').trim(),
    reference: slugify(data.reference),
    categorie: data.categorie,
    circuit: data.circuit,
    localisation: data.localisation || '',
    dateAchat: data.dateAchat || '',
    valeurEstimee: Number(data.valeurEstimee || 0),
    notes: data.notes || '',
    photoUrl: data.photoUrl || '',
  };
  assertValid(clean);
  const item = store.items.create({ ...clean, code: nextItemCode(), etat: ITEM_STATES.DISPONIBLE });
  logAction({ auteurId, action: ACTIONS.ITEM_CREE, itemId: item.id, detail: `${item.nom} (${item.code})` });
  return item;
}

export function updateItem(id, patch, auteurId) {
  const current = requireItem(id);
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => !PROTECTED_FIELDS.includes(k)));
  if (safe.nom !== undefined) safe.nom = String(safe.nom).trim();
  if (safe.reference !== undefined) safe.reference = slugify(safe.reference);
  if (safe.valeurEstimee !== undefined) safe.valeurEstimee = Number(safe.valeurEstimee);
  assertValid({ ...current, ...safe });
  const changed = Object.keys(safe).filter((k) => safe[k] !== current[k]);
  if (!changed.length) return current;
  const item = store.items.update(id, Object.fromEntries(changed.map((k) => [k, safe[k]])));
  logAction({ auteurId, action: ACTIONS.ITEM_MODIFIE, itemId: id, detail: `${item.nom} : ${changed.join(', ')}` });
  return item;
}

// Change l’état sans journaliser : réservé aux actions (emprunts, maintenance) qui écrivent
// leur propre entrée de journal. Les vues utilisent setItemState.
export function applyItemState(id, etat) {
  const item = requireItem(id);
  assertTransition(ITEM_TRANSITIONS, item.etat, etat, 'matériel');
  return store.items.update(id, { etat });
}

export function setItemState(id, etat, auteurId, detail = '') {
  const item = requireItem(id);
  const updated = applyItemState(id, etat);
  const suffix = detail ? ` — ${detail}` : '';
  logAction({
    auteurId, action: ACTIONS.ITEM_ETAT, itemId: id,
    detail: `${item.nom} : ${LABELS.itemState[item.etat]} → ${LABELS.itemState[etat]}${suffix}`,
  });
  return updated;
}

// Sortir d’inventaire, pas désactiver : réservé au matériel hors service, quand il part à la
// benne. Ses interventions partent avec lui — elles n’ont plus d’objet — ; les emprunts passés
// restent, les vues les affichent sans leur objet, et le journal garde le code.
export function deleteItem(id, auteurId) {
  const item = requireItem(id);
  if (item.etat !== ITEM_STATES.HS) throw new Error(`${item.nom} n’est pas hors service : seul un matériel hors service se supprime.`);
  const ouverts = store.loans.list((l) => l.itemId === id && [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS].includes(l.statut)).length;
  if (ouverts) throw new Error(`${item.nom} a ${ouverts} emprunt(s) ou réservation(s) en cours : clôturez-les d’abord.`);
  return store.transaction(() => {
    for (const event of store.maintenance.list((m) => m.itemId === id)) store.maintenance.remove(event.id);
    store.items.remove(id);
    logAction({ auteurId, action: ACTIONS.ITEM_SUPPRIME, itemId: id, detail: `${item.nom} (${item.code})` });
    return item;
  });
}

export function manualTransitions(item) {
  if (!MANUAL_STATES.includes(item.etat)) return [];
  return (ITEM_TRANSITIONS[item.etat] || []).filter((s) => MANUAL_STATES.includes(s));
}

export function itemHistory(id) {
  return {
    loans: sortByDateDesc(store.loans.list((l) => l.itemId === id), (l) => l.dateRetrait || l.debutPrevu || l.dateReservation),
    maintenance: sortByDateDesc(store.maintenance.list((m) => m.itemId === id), (m) => m.date),
    log: logForItem(id),
  };
}
