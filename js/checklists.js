// js/checklists.js — checklists de retour / état des lieux, indexées par référence d'objet.
// Modifiable sans toucher aux vues. En phase 2 produit : éditable depuis Paramètres.

export const CHECKLISTS = {
  // Self-service (mini-checklist mobile)
  'multiprise': ["Câble intact", "Toutes les prises fonctionnent", "Interrupteur OK"],
  'kit-tableau': ["4 stylos présents (bleu, noir, vert, rouge)", "Télécommande vidéoprojecteur présente", "Brosse présente", "Boîte fermée"],
  'casque-audio': ["Son des deux côtés", "Câble / jack intact", "Mousses présentes"],
  'clavier': ["Toutes les touches présentes", "Câble / récepteur USB présent"],
  'souris': ["Clic et molette OK", "Câble / récepteur USB présent"],

  // Salle photo (état des lieux entrée / sortie) — une ligne résumée par objet
  'newer-eclairage': ["2 pieds, 2 softbox, 2 ampoules OK"],
  'newer-led': ["Panneau, batteries (nombre), chargeur"],
  'leofoto-trepied': ["3 sections, tête fluide, plateau rapide"],
  'mini-studio': ["Tente, fonds, éclairage intégré"],
  'sac-beschoi': ["Présent, fermetures OK"],

  // Matériel de valeur (checklist complète admin)
  'canon-r10': ["Boîtier", "Objectif 18-55", "Bague", "Bouchons", "Batterie", "Carte SD retirée", "Capteur / objectif propres", "Allumage OK", "Nombre de déclenchements (optionnel)"],
  'dji-rsc2': ["Stabilisateur", "Plateau", "Vis / accessoires", "Batterie chargée", "Allumage et calibration OK", "Mallette"],
  'tascam-dr70': ["Enregistreur", "Capsule / bonnette", "Câbles", "Piles / batterie", "Carte SD retirée", "Test d'enregistrement OK"],
  'zoom-h5': ["Enregistreur", "Capsule / bonnette", "Câbles", "Piles / batterie", "Carte SD retirée", "Test d'enregistrement OK"],
  'sd-256': ["Présente", "Vidée / formatée", "Verrou intact"],
  'sd-32': ["Présente", "Vidée / formatée", "Verrou intact"],
  'lpe17': ["Présente", "Chargée", "Pas de gonflement"],
  'hoya-nd': ["Verre sans rayure", "Bague tourne", "Étui"],
  'sennheiser': ["Son", "Câble", "Mousses", "Étui"],
  'at-streaming': ["Micro", "Bras / pied", "Câble XLR / USB", "Interface", "Test audio OK"],
};

export const SALLE_GLOBAL_LINE = "Salle rangée, rien d'anormal";

export function checklistFor(reference) {
  return CHECKLISTS[reference] ? [...CHECKLISTS[reference]] : [];
}

export function buildChecklist(reference) {
  return checklistFor(reference).map((ligne) => ({ ligne, ok: true, commentaire: '' }));
}

export function buildRoomChecklist(itemsSalle) {
  const lines = itemsSalle.map((item) => ({
    itemId: item.id,
    ligne: `${item.nom} — ${checklistFor(item.reference).join(', ') || 'présent et OK'}`,
    ok: true,
    commentaire: '',
  }));
  lines.push({ itemId: null, ligne: SALLE_GLOBAL_LINE, ok: true, commentaire: '' });
  return lines;
}

export function hasProblem(checklist) {
  return checklist.some((l) => l.ok === false);
}

export function problemLines(checklist) {
  return checklist.filter((l) => l.ok === false);
}
