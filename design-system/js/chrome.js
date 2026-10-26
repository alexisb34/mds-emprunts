// Le chrome du site : en-tête de navigation, sommaire de l'étage composants, pied.
// Module pur, sans DOM — il rend des chaînes HTML, à la manière de `js/demoClock.js`.
// Chaque page le pose depuis un script en ligne.
//
// ## La convention d'adresse, qui vaut pour tout le site
//
// `CHAPITRES` et `COMPOSANTS` portent des adresses relatives à `design-system/` :
// `logo.html`, `composants/badge.html`. C'est la seule façon d'avoir une liste unique pour
// les deux étages.
//
// `enteteHtml(courant)` et `sommaireHtml(courant)` reçoivent eux aussi l'adresse de la
// page COURANTE relative à `design-system/`, et en déduisent de combien de crans remonter.
// Une page de `composants/` appelle donc `enteteHtml('composants/badge.html')`, jamais
// `enteteHtml('badge.html')` : sans ça, le lien « Logo » viserait `composants/logo.html`.
//
// Le site est publié dans un sous-répertoire : aucune adresse ne commence par `/`.

// Étage 1 — la vitrine de marque. Un chapitre par page, un résumé par chapitre : c'est le
// texte des cartes de l'accueil, écrit une fois.
export const CHAPITRES = [
  { href: 'logo.html', titre: 'Logo', resume: 'Les versions, la zone de protection, les fonds autorisés et les interdits, chacun avec sa raison.' },
  { href: 'couleurs.html', titre: 'Couleurs', resume: 'Le turquoise de la marque, le violet du produit, et laquelle sert à quoi. Contrastes mesurés.' },
  { href: 'typographie.html', titre: 'Typographie', resume: 'Bricolage Grotesque pour les titres, Inter pour le reste. L’échelle complète.' },
  { href: 'ton.html', titre: 'Ton', resume: 'Comment on écrit dans les interfaces de l’école : phrases courtes, pas de jargon, erreurs qui disent quoi faire.' },
  { href: 'ressources.html', titre: 'Ressources', resume: 'Le logo dans tous les formats utiles, la palette à coller, les polices.' },
];

// Étage 2 — la documentation des composants. L'ordre est celui du sommaire latéral :
// la porte d'entrée, les fondations, puis les familles du kit.
export const COMPOSANTS = [
  { href: 'composants/demarrer.html', titre: 'Démarrer' },
  { href: 'composants/fondations.html', titre: 'Fondations' },
  { href: 'composants/icones.html', titre: 'Icônes' },
  { href: 'composants/bouton.html', titre: 'Bouton' },
  { href: 'composants/badge.html', titre: 'Badge et étiquette' },
  { href: 'composants/avatar.html', titre: 'Avatar' },
  { href: 'composants/formulaires.html', titre: 'Formulaires' },
  { href: 'composants/tableau.html', titre: 'Tableau' },
  { href: 'composants/kpi.html', titre: 'Carte KPI' },
  { href: 'composants/cartes.html', titre: 'Cartes' },
  { href: 'composants/navigation.html', titre: 'Navigation' },
  { href: 'composants/modale.html', titre: 'Modale et retours' },
  { href: 'composants/mobile.html', titre: 'Mobile' },
];

// L'adresse de l'accueil de l'étage composants, la porte par laquelle on y entre.
const ENTREE_COMPOSANTS = COMPOSANTS[0].href;

// Le préfixe qui ramène à la racine du site depuis la page courante : `''` à la racine,
// `'../'` depuis `composants/`. Un cran par barre oblique dans l'adresse courante.
function racineDepuis(courant) {
  return '../'.repeat((String(courant).match(/\//g) || []).length);
}

// Les libellés et les adresses sont des constantes de ce module : rien à échapper.
function lien(href, texte, { classe = '', courant = '' } = {}) {
  const marque = courant ? ` aria-current="${courant}"` : '';
  return `<a${classe ? ` class="${classe}"` : ''} href="${href}"${marque}>${texte}</a>`;
}

// `courant` : l'adresse de la page affichée, relative à `design-system/`.
// Le chapitre affiché est marqué `aria-current="page"`. Sur une page de composant, la page
// courante est marquée par le sommaire latéral ; l'en-tête se contente d'un
// `aria-current="true"` sur l'entrée de l'étage, qui dit « vous êtes là-dedans » sans
// prétendre être cette page.
export function enteteHtml(courant) {
  const base = racineDepuis(courant);
  const dansComposants = courant !== ENTREE_COMPOSANTS && String(courant).startsWith('composants/');

  const chapitres = CHAPITRES.map((c) => `
        <li>${lien(base + c.href, c.titre, { classe: 'ds-nav__lien label-md', courant: c.href === courant ? 'page' : '' })}</li>`).join('');

  return `<header class="ds-entete">
  <a class="ds-saut label-md" href="#contenu">Aller au contenu</a>
  <div class="ds-entete__barre">
    ${lien(`${base}index.html`, `<img class="ds-entete__logo" src="${base}assets/logo.svg" alt="MyDigitalSchool" width="150" height="88"><span class="ds-entete__titre label-sm">Guide de marque<span class="ds-entete__titre-suite"> &amp; design system</span></span>`, { classe: 'ds-entete__marque', courant: courant === 'index.html' ? 'page' : '' })}
    <nav class="ds-nav" aria-label="Chapitres de la marque">
      <ul class="ds-nav__liste">${chapitres}
      </ul>
    </nav>
    ${lien(base + ENTREE_COMPOSANTS, 'Composants', { classe: 'ds-entete__etage label-md', courant: courant === ENTREE_COMPOSANTS ? 'page' : (dansComposants ? 'true' : '') })}
  </div>
</header>`;
}

// Le sommaire de l'étage composants. Ses adresses sont relatives au dossier `composants/`,
// où vivent toutes ses pages.
export function sommaireHtml(courant) {
  const entrees = COMPOSANTS.map((c) => {
    const href = c.href.replace(/^composants\//, '');
    return `
      <li>${lien(href, c.titre, { classe: 'ds-sommaire__lien body-sm', courant: c.href === courant ? 'page' : '' })}</li>`;
  }).join('');

  return `<nav class="ds-sommaire" aria-label="Pages des composants">
  <p class="label-caps ds-sommaire__titre">Composants</p>
  <ul>${entrees}
  </ul>
</nav>`;
}

// Le pied, identique partout. Il dit d'où vient ce que le site affiche, et ce que ce site
// n'est pas : les règles d'usage du logo n'ont été validées par personne du côté de la
// marque, et les fichiers sont servis publiquement (spec §9).
//
// `courant` suit la même convention que `enteteHtml` ; à la racine du site, il est inutile.
export function piedHtml(courant = '') {
  const base = racineDepuis(courant);
  return `<footer class="ds-pied">
  <div class="ds-pied__corps">
    <p class="body-sm">Les couleurs, les espacements et les composants montrés ici sont lus dans le code de l’outil d’emprunt. Quand le code change, ce site change.</p>
    <p class="body-sm ds-pied__reserve">Les règles d’usage du logo ont été construites pour ce guide. Elles ne sont validées par personne du côté de la marque : ce site n’est pas une charte officielle.</p>
    <ul class="ds-pied__liens">
      <li>${lien(`${base}index.html`, 'Accueil', { classe: 'ds-pied__lien' })}</li>
      <li>${lien(base + ENTREE_COMPOSANTS, 'Démarrer avec les composants', { classe: 'ds-pied__lien' })}</li>
    </ul>
  </div>
</footer>`;
}
