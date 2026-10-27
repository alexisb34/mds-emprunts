// Les deux petits outils que les modules du site se partagent pour écrire du HTML.
//
// `echapper` était écrit deux fois (`tokens.js`, `cadre.js`) ; `code.js` en a fait le troisième
// emploi, le seuil que `cadre.js` s'était fixé pour en faire un module. Les noms de fichier et
// de démonstration vont avec : `cadreHtml` et `codeHtml` parlent de la même adresse, et elles
// doivent la juger de la même façon.

export function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Un nom de fichier d'exemple, et un nom de démonstration : les deux formes que les tests
// savent lire dans une page. Les tenir ici évite qu'une page invente une adresse qu'aucun
// test ne pourrait suivre.
export const FICHIER_VALIDE = /^[\w-]+\.html$/;
export const DEMO_VALIDE = /^[\w-]+$/;

// On exige une chaîne, et pas seulement une valeur qui ressemble à une chaîne : `String(undefined)`
// vaut « undefined », qui passe le motif et produirait une adresse `#undefined`.
export const estNom = (valeur, motif) => typeof valeur === 'string' && motif.test(valeur);
