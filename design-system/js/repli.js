// Le repli des pages qui se construisent elles-mêmes (logo, couleurs, ressources).
//
// Ces pages écrivent dans leur HTML un message d'attente (`#repli`, avec `#raison`), puis le
// REMPLACENT par leur contenu une fois lu ce dont elles ont besoin. Un échec peut donc survenir
// à deux moments : avant le remplacement (un fichier introuvable, un fichier ouvert sans
// serveur), où le message existe et n'a qu'à apparaître ; ou après (une étape qui branche le
// contenu), où il a disparu. Dans ce second cas, le contenu est à l'écran, à moitié branché : on
// pose un message neuf EN TÊTE, qui le dit, plutôt que de lever une exception dans le `catch`.
//
// `lecture` : le début du message pour le premier cas, par exemple « Le logo n'a pas pu être lu ».
// Rend 'attente' ou 'remplace' pour dire dans lequel des deux cas on était.
export function montrerRepli(doc, erreur, lecture) {
  const repli = doc.getElementById('repli');
  if (repli) {
    repli.classList.remove('ds-message--attente');
    doc.getElementById('raison').textContent = `${lecture} (${erreur.message}). Si vous avez ouvert ce fichier directement, ouvrez plutôt le site depuis un serveur : npm run serve.`;
    return 'attente';
  }
  const message = doc.createElement('div');
  message.id = 'repli';
  message.className = 'ds-message';
  const raison = doc.createElement('p');
  raison.id = 'raison';
  raison.className = 'body';
  raison.textContent = `La page s’est affichée, mais une partie n’a pas pu se mettre en place (${erreur.message}). Rechargez-la ; si le message revient, c’est à corriger dans le site.`;
  message.append(raison);
  doc.getElementById('contenu').prepend(message);
  return 'remplace';
}
