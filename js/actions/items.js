// js/actions/items.js — mutations métier sur le matériel. Toute écriture passe ici,
// valide les données, respecte les transitions d’état et écrit le journal.
import { store } from '../store.js';
import { ITEM_STATES, ITEM_TRANSITIONS, ITEM_CODE_RE, CIRCUITS, CATEGORIES, LABELS, assertTransition } from '../models.js';
import { logAction, ACTIONS, logForItem } from '../log.js';
import { sortByDateDesc } from '../rules.js';

const PROTECTED_FIELDS = ['id', 'code', 'etat', 'createdAt', 'updatedAt'];

// États que la pédago peut fixer à la main ; emprunte/reserve sont pilotés par les emprunts.
export const MANUAL_STATES = [ITEM_STATES.DISPONIBLE, ITEM_STATES.MAINTENANCE, ITEM_STATES.HS];

export function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function nextItemCode() {
  const max = store.items.list().reduce((m, i) => {
    const n = Number((ITEM_CODE_RE.exec(i.code) || [])[1] || 0);
    return n > m ? n : m;
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
  const item = store.items.update(id, safe);
  logAction({ auteurId, action: ACTIONS.ITEM_MODIFIE, itemId: id, detail: `${item.nom} : ${Object.keys(safe).join(', ')}` });
  return item;
}

export function setItemState(id, etat, auteurId, detail = '') {
  const item = requireItem(id);
  assertTransition(ITEM_TRANSITIONS, item.etat, etat, 'matériel');
  const updated = store.items.update(id, { etat });
  const suffix = detail ? ` — ${detail}` : '';
  logAction({
    auteurId, action: ACTIONS.ITEM_ETAT, itemId: id,
    detail: `${item.nom} : ${LABELS.itemState[item.etat]} → ${LABELS.itemState[etat]}${suffix}`,
  });
  return updated;
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
