// La page Ressources : le logo en SVG et en PNG, les tokens à coller, les liens des polices.
//
// ## Ce qui est stocké, ce qui est fabriqué
//
// Rien de nouveau n'est stocké. Le logo officiel est `assets/logo.svg` ; ses versions blanche et
// anthracite, et tous les PNG, sont fabriqués dans le navigateur de la personne (voir `logo.js`, qui
// en détient la mécanique : `preparerSources`, `fabriquerPng`, `brancherExports`). Ce module n'en
// refait aucune : il nomme les fichiers, met les tokens en texte, et compose la page.
//
// ## Les polices : liées, pas hébergées
//
// Aucun fichier de police au dépôt. L'outil d'emprunt et ce site les chargent depuis Google Fonts ;
// la page donne les liens des deux familles et les trois lignes à coller dans un `<head>`.
//
// ## Pas de lien vers le Figma
//
// Le fichier Figma est privé, et ce site se suffit à lui-même : la page le dit en une phrase.

import { VERSIONS, versionsHtml } from './logo.js';
import { echapper } from './texte.js';

// ---- Les noms de fichiers ----

const FORMATS = ['svg', 'png'];

// `mds-logo-<version>.svg`, `mds-logo-<version>-<largeur>.png` : en minuscules, sans accent ni
// espace, pour qu'un nom survive à n'importe quel système et se lise dans un dossier de téléchargements.
// Un SVG n'a pas de largeur dans son nom : il se redimensionne sans perte, donc `largeur` est ignorée.
//
// Le chapitre Logo écrit les mêmes noms de son côté (`logo.js`) ; un test compare les deux. Il ne
// peut pas importer cette fonction : ce module importe `logo.js`, et l'import inverse ferait un cycle.
export function nomFichier(version, format, largeur) {
  if (!VERSIONS.some((v) => v.id === version)) {
    throw new Error(`nomFichier : version « ${version} » — attendu ${VERSIONS.map((v) => `« ${v.id} »`).join(', ')}`);
  }
  if (!FORMATS.includes(format)) throw new Error(`nomFichier : format « ${format} » — attendu « svg » ou « png »`);
  if (format === 'svg') return `mds-logo-${version}.svg`;
  if (!Number.isInteger(largeur) || largeur <= 0) {
    throw new Error(`nomFichier : largeur « ${largeur} » — un PNG se nomme avec sa largeur, un entier positif`);
  }
  return `mds-logo-${version}-${largeur}.png`;
}

// ---- Les tokens, en texte ----

// Un bloc CSS à coller en tête d'une feuille : `:root { … }`, un commentaire par groupe, une ligne vide
// entre deux groupes. `groupes` est ce que rend `lireTokens` : les groupes vides sont omis, comme sur
// la page Fondations. Le bloc relu par `lireTokens` redonne les mêmes tokens (un test le tient).
export function tokensEnTexte(groupes) {
  const blocs = (groupes || [])
    .filter((g) => g.tokens.length)
    .map((g) => [`  /* ${g.titre} */`, ...g.tokens.map((t) => `  ${t.nom}: ${t.valeur};`)].join('\n'));
  return [':root {', ...(blocs.length ? [blocs.join('\n\n')] : []), '}'].join('\n');
}

// ---- Les polices ----

export const GOOGLE_FONTS = [
  { nom: 'Bricolage Grotesque', url: 'https://fonts.google.com/specimen/Bricolage+Grotesque', role: 'pour les titres' },
  { nom: 'Inter', url: 'https://fonts.google.com/specimen/Inter', role: 'pour le reste' },
];

// Les trois lignes que toute page de ce site écrit dans son <head> : celles de `index.html`, mot pour
// mot (un test les compare). `&amp;` est la bonne écriture dans un attribut HTML : le texte se colle tel quel.
export const LIENS_POLICES = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&amp;family=Bricolage+Grotesque:wght@800&amp;display=swap">',
].join('\n');

// ---- La page ----

// Un bloc de texte à copier. Il reprend le balisage de `codeHtml` (`code.js`) — mêmes classes, même
// zone de statut, même bouton — et `brancherCode` le branche tel quel. À la différence de `codeHtml`,
// son texte est déjà là : il vient d'une fonction, pas d'un cadre, donc il est posé prêt. Le texte est
// échappé : c'est du texte à montrer, jamais du HTML à poser.
function blocHtml(texte, titre) {
  return `<div class="ds-code-bloc" data-etat="pret">
  <pre class="ds-code rs-code body-sm" tabindex="0" role="region" aria-label="${echapper(titre)}"><code class="ds-code-bloc__texte">${echapper(texte)}</code></pre>
  <div class="ds-code-bloc__barre">
    <button type="button" class="ds-copier label-md" aria-label="Copier : ${echapper(titre)}">Copier</button>
    <span class="ds-code-bloc__etat visually-hidden" role="status"></span>
  </div>
</div>`;
}

function heroHtml() {
  return `<section class="ds-bande">
  <div class="ds-section">
    <div class="ds-groupe">
      <h1 class="ds-titre-page">Les ressources</h1>
      <p class="ds-chapeau ds-mesure">Le logo en SVG et en PNG, les couleurs à coller dans une feuille de style, les liens des polices. Rien à demander à personne.</p>
      <aside class="ds-message">
        <p class="body">Le fichier couleur du logo est celui de mydigitalschool.com. Les versions blanche et anthracite sont fabriquées ici, en remplaçant ses deux couleurs&nbsp;: personne du côté de la marque ne les a validées.</p>
        <p class="body">Les règles d’usage du logo sont dans le <a class="ds-lien-texte" href="logo.html">chapitre Logo</a>.</p>
      </aside>
    </div>
  </div>
</section>`;
}

function tokensHtml(groupes) {
  return `<section class="ds-bande" id="tokens">
  <div class="ds-section">
    <div class="ds-groupe">
      <h2 class="ds-titre">Les couleurs et les mesures</h2>
      <p class="ds-chapeau ds-mesure">Les variables CSS de l’outil d’emprunt, telles quelles. Collez-les en tête d’une feuille de style.</p>
    </div>
    ${blocHtml(tokensEnTexte(groupes), 'Les variables CSS de l’outil d’emprunt')}
    <div class="ds-groupe">
      <p class="body-sm ds-oeil ds-mesure">Ce bloc est lu dans le code de l’outil quand la page s’ouvre.</p>
      <p class="body ds-mesure">Quelle couleur sert à quoi&nbsp;? Le <a class="ds-lien-texte" href="couleurs.html">chapitre Couleurs</a> le dit.</p>
    </div>
  </div>
</section>`;
}

function policesHtml() {
  const liens = GOOGLE_FONTS.map((f) => `<li><a class="ds-lien-texte" href="${f.url}">${f.nom}</a>, ${f.role}.</li>`).join('\n        ');
  return `<section class="ds-bande" id="polices">
  <div class="ds-section">
    <div class="ds-groupe">
      <h2 class="ds-titre">Les polices</h2>
      <p class="ds-chapeau ds-mesure">Elles ne sont pas stockées sur ce site&nbsp;: l’outil d’emprunt et ce site les chargent depuis Google Fonts.</p>
      <ul class="ds-liste body">
        ${liens}
      </ul>
    </div>
    <div class="ds-groupe">
      <p class="body ds-mesure">Pour une page web, collez ces trois lignes dans le <code>&lt;head&gt;</code>, avant vos feuilles de style&nbsp;:</p>
      ${blocHtml(LIENS_POLICES, 'Les trois lignes de liens vers les polices')}
    </div>
    <p class="body-sm ds-oeil ds-mesure">Pour une affiche ou un diaporama, les deux liens ci-dessus sont le point de départ pour installer les polices sur votre ordinateur.</p>
  </div>
</section>`;
}

function figmaHtml() {
  return `<section class="ds-bande ds-bande--doux" id="figma">
  <div class="ds-section">
    <div class="ds-groupe">
      <h2 class="ds-titre">Et le fichier Figma&nbsp;?</h2>
      <p class="body ds-mesure">Il n’y a pas de lien vers le Figma&nbsp;: le fichier est privé, et ce site se suffit à lui-même.</p>
    </div>
  </div>
</section>`;
}

// Le contenu de `<main>`. `sources` : où trouver chaque version du logo (`preparerSources`) ;
// `groupes` : ce que rend `lireTokens`. Rend une chaîne, sans toucher au document : la page la pose,
// puis appelle `brancherExports` et `brancherCode`.
export function pageHtml({ sources, groupes } = {}) {
  for (const v of VERSIONS) {
    if (!sources || typeof sources[v.id] !== 'string' || !sources[v.id]) throw new Error(`Source manquante pour la version « ${v.id} »`);
  }
  if (!Array.isArray(groupes) || groupes.every((g) => !g.tokens.length)) throw new Error('Aucun token à montrer : css/tokens.css n’a rien rendu.');
  return [heroHtml(), versionsHtml(sources), tokensHtml(groupes), policesHtml(), figmaHtml()].join('\n');
}
