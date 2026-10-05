// js/etiquettes.js — quels exemplaires la page d’étiquettes doit-elle afficher ?
// Pure : reçoit la valeur du paramètre `?codes=` (ou null) et la liste du matériel.
//   - paramètre absent ou vide : tout l’inventaire (ce que promet le titre de la page),
//     trié par code pour que les planches s’impriment dans l’ordre ;
//   - codes donnés : seulement ceux-là, dans l’ordre demandé ; ceux qui ne désignent aucun
//     exemplaire sont rendus à part pour que la page puisse les signaler.
export function selectLabels(codesParam, allItems) {
  const codes = String(codesParam ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!codes.length) {
    const items = [...allItems].sort((a, b) => a.code.localeCompare(b.code));
    return { mode: 'inventaire', items, inconnus: [] };
  }
  const items = codes.map((code) => allItems.find((i) => i.code === code)).filter(Boolean);
  const inconnus = codes.filter((code) => !items.some((i) => i.code === code));
  return { mode: 'selection', items, inconnus };
}
