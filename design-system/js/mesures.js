// Les contrastes qu'une page de composant AFFICHE : mesurés dans `css/tokens.css` au chargement,
// jamais écrits dans la page. Le jour où un token change, le chiffre change avec lui.
//
// Trois sortes de mesure, parce qu'une page en a besoin de trois :
//   - une paire que le kit publie déjà (`PAIRES_KIT` de dette.js) : on la nomme, le module sait
//     sa taille et son seuil ;
//   - un couple texte/fond que le kit ne publie pas : on donne les tokens et la taille ;
//   - un couple non textuel (un anneau de focus, un contour) : le seuil est de 3:1, pas de 4,5:1.
//
// Chaque fonction rend la phrase toute faite, « 4,28:1 — échoue », ou `null` quand un token manque :
// la page garde alors sa phrase de repli plutôt que d'écrire un chiffre faux.

import { PAIRES_KIT, jugerPaire, afficherRatio } from './dette.js';
import { ratio, ratioExact } from './contraste.js';

const SEUIL_NON_TEXTE = 3;

const phrase = (affiche, echoue) => `${affiche}:1 — ${echoue ? 'échoue' : 'conforme'}`;

// `lecture` : ce que rend `lireTokensDepuisDocument`. Le dictionnaire nom → valeur.
export function valeursDe(lecture) {
  if (!lecture || !lecture.ok) return null;
  return Object.fromEntries(lecture.groupes.flatMap((g) => g.tokens.map((t) => [t.nom, t.valeur])));
}

// Une paire publiée par le kit, désignée par son nom (`badge--late`, `kpi--retard`, `table th`).
export function mesurePaire(valeurs, nom) {
  const paire = PAIRES_KIT.find((p) => p.nom === nom);
  if (!paire) throw new Error(`Aucune paire nommée « ${nom} » dans PAIRES_KIT`);
  if (!valeurs || !valeurs[paire.texte] || !valeurs[paire.fond]) return null;
  const j = jugerPaire(paire, valeurs);
  return phrase(j.affiche, j.echoue);
}

// Un texte sur un fond, à une taille donnée : le seuil est celui de WCAG pour cette taille.
export function mesureTexte(valeurs, texte, fond, px, gras = false) {
  if (!valeurs || !valeurs[texte] || !valeurs[fond]) return null;
  const j = jugerPaire({ texte, fond, px, gras }, valeurs);
  return phrase(j.affiche, j.echoue);
}

// Deux couleurs qui ne portent pas de texte : un anneau, un contour. WCAG 1.4.11 : 3:1.
export function mesureNonTexte(valeurs, a, b) {
  if (!valeurs || !valeurs[a] || !valeurs[b]) return null;
  const exact = ratioExact(valeurs[a], valeurs[b]);
  return phrase(afficherRatio(exact, ratio(valeurs[a], valeurs[b]), SEUIL_NON_TEXTE), exact < SEUIL_NON_TEXTE);
}

// Pose chaque phrase dans l'élément qui porte l'id. Un id absent ou une mesure nulle ne change
// rien : la phrase de repli de la page reste affichée.
export function poserMesures(doc, table) {
  for (const [id, texte] of Object.entries(table)) {
    const champ = doc.getElementById(id);
    if (champ && texte) champ.textContent = texte;
  }
}
