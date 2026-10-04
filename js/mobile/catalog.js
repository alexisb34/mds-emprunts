// js/mobile/catalog.js — regroupement du matériel par référence pour le catalogue mobile (pur).
import { ITEM_STATES } from '../models.js';

export function baseName(nom) {
  return String(nom || '').replace(/\s#\d+$/, '');
}

export function groupByReference(items) {
  const map = new Map();
  for (const item of items) {
    if (item.etat === ITEM_STATES.HS) continue; // hors service : masqué du catalogue (spec §5.4)
    let g = map.get(item.reference);
    if (!g) {
      g = { reference: item.reference, nom: baseName(item.nom), categorie: item.categorie, circuit: item.circuit, photoUrl: item.photoUrl || '', total: 0, disponibles: 0, exemplaires: [] };
      map.set(item.reference, g);
    }
    g.total += 1;
    if (item.etat === ITEM_STATES.DISPONIBLE) g.disponibles += 1;
    if (!g.photoUrl && item.photoUrl) g.photoUrl = item.photoUrl;
    g.exemplaires.push(item);
  }
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export function filterCatalog(groups, { q = '', categorie = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return groups.filter((g) => (!categorie || g.categorie === categorie)
    && (!needle || [g.nom, g.reference, g.categorie].some((v) => String(v).toLowerCase().includes(needle))));
}

export function availability(group) {
  // `text` complète le badge (jamais redondant avec son libellé) : vide quand le badge suffit.
  if (group.disponibles > 0) {
    return { kind: 'item', value: ITEM_STATES.DISPONIBLE, text: group.total > 1 ? `${group.disponibles} sur ${group.total} disponibles` : '' };
  }
  const etats = group.exemplaires.map((i) => i.etat);
  if (etats.includes(ITEM_STATES.EMPRUNTE)) return { kind: 'item', value: ITEM_STATES.EMPRUNTE, text: '' };
  if (etats.includes(ITEM_STATES.RESERVE)) return { kind: 'item', value: ITEM_STATES.RESERVE, text: '' };
  return { kind: 'item', value: ITEM_STATES.MAINTENANCE, text: 'Indisponible' };
}
