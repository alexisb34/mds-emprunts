// La landing du site : sept blocs qui entrent par les bords et forment une mosaïque.
//
// C'est TOUT ce que porte `index.html` — ni en-tête, ni pied, et rien en dessous. On en sort
// en choisissant un bloc, pas en continuant à faire défiler. C'est pour ça que la mosaïque
// porte ici le `<h1>` de la page.
//
// Le mouvement est piloté par le défilement, pas par une durée : la page réserve une piste
// de plusieurs hauteurs d'écran, la scène y reste collée, et la position dans la piste donne
// un avancement de 0 à 1. On ne regarde donc jamais une animation « passer » — on la déroule.
//
// Ce module rend une chaîne HTML, comme `chrome.js`, et n'a qu'une fonction qui touche au
// document : `brancherMosaique`, qui le reçoit en argument pour qu'un test lui en donne un faux.
// Sans elle, la mosaïque reste à son état final, montée : c'est un repli correct.
//
// Les adresses sont relatives à `design-system/`, comme partout ailleurs sur le site.
import { ACCUEIL } from './chrome.js';

// Les sept blocs, dans l'ordre de lecture. `aire` est le nom de la zone de la grille CSS ;
// `de` est le bord par lequel le bloc entre ; `retard` échelonne les entrées de 0 à 1.
//
// Chaque fond est mesuré par `tests/ds-socle.test.mjs` à travers `PAIRES` : les sept
// couleurs portent leur texte à 4,5:1 au moins, à n'importe quelle taille. Le turquoise de
// la marque n'en est pas, et ne pouvait pas en être — le chapitre Couleurs dit qu'il ne
// passe jamais sous du texte, et c'est vrai : du blanc dessus tombe à 2,39:1.
export const BLOCS = [
  { aire: 'guide', href: ACCUEIL, titre: 'Brand guidelines &amp; design system', de: 'gauche', retard: 0 },
  { aire: 'ton', href: 'ton.html', titre: 'Ton &amp; Voix', de: 'haut', retard: 0.18 },
  { aire: 'logo', href: 'logo.html', titre: 'Logo', de: 'haut', retard: 0.3 },
  { aire: 'typo', href: 'typographie.html', titre: 'Typographie', de: 'droite', retard: 0.12 },
  { aire: 'couleurs', href: 'couleurs.html', titre: 'Couleurs', de: 'bas', retard: 0.24 },
  { aire: 'composants', href: 'composants/demarrer.html', titre: 'Composants d’interface', de: 'bas', retard: 0.36 },
  { aire: 'ressources', href: 'ressources.html', titre: 'Ressources', de: 'droite', retard: 0.42 },
];

// Le signe décoratif de chaque bloc : du décor, jamais une information. Tous sont
// `aria-hidden` — un lecteur d'écran n'entend que le titre du bloc, qui dit déjà où il mène.
// Les couleurs saturées qui apparaissent ici (turquoise, rose) y sont employées en décor,
// l'un des deux usages que le chapitre Couleurs leur laisse.
// Ce qui s'écrit entre les guillemets de « Ton & Voix » au survol, une lettre à la fois.
// Chaque lettre est un élément qui porte son rang : la feuille ne fait apparaître la
// lettre `i` qu'au bout de `i` fois le pas de frappe. L'espace fine de la fin détache le
// dernier mot du guillemet fermant, et elle arrive avec le reste — au repos, les deux
// guillemets sont collés comme avant.
export const FRAPPE = 'Hello World ';

const frappeHtml = () => [...FRAPPE]
  .map((lettre, i) => `<span style="--i: ${i}">${lettre === ' ' ? '&#160;' : lettre}</span>`)
  .join('');

const SIGNES = {
  guide: `<svg class="ds-tuile__signe" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="20" height="20" rx="3"></rect><rect x="26" y="2" width="20" height="20" rx="3"></rect>
        <rect x="2" y="26" width="20" height="20" rx="3"></rect><rect x="26" y="26" width="20" height="20" rx="10"></rect>
      </svg>`,
  ton: `<span class="ds-tuile__signe ds-tuile__signe--texte" aria-hidden="true">«&#8201;<span class="ds-tuile__frappe">${frappeHtml()}</span>»</span>`,
  logo: `<img class="ds-tuile__signe ds-tuile__signe--logo" src="assets/logo.svg" alt="" width="150" height="88" aria-hidden="true">`,
  typo: `<span class="ds-tuile__signe ds-tuile__signe--texte" aria-hidden="true">Aa</span>`,
  couleurs: `<svg class="ds-tuile__signe ds-tuile__signe--disques" viewBox="0 0 72 48" aria-hidden="true" focusable="false">
        <circle cx="20" cy="24" r="18"></circle><circle cx="36" cy="24" r="18"></circle><circle cx="52" cy="24" r="18"></circle>
      </svg>`,
  composants: `<svg class="ds-tuile__signe" viewBox="0 0 56 48" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="52" height="14" rx="7"></rect>
        <rect x="2" y="22" width="30" height="10" rx="5"></rect><rect x="2" y="38" width="44" height="8" rx="4"></rect>
      </svg>`,
  ressources: `<span class="ds-tuile__signe ds-tuile__signe--texte" aria-hidden="true">↓</span>`,
};

// Les deux phrases d'ouverture, dans l'ordre où le défilement les révèle.
export const OUVERTURE = [
  'Chez MyDigitalSchool, le guide de marque sert à mettre de l’identité dans tout ce que nous fabriquons.',
  'Des icônes aux illustrations, du logo à la façon d’écrire, cette collection est le socle de ce que l’école donne à voir, à lire et à entendre.',
];

// `base` : ce qu'il faut mettre devant une adresse relative à `design-system/`. L'accueil
// est la seule page qui pose la mosaïque, donc `''` en pratique ; l'argument existe pour
// que la règle d'adresse du site reste la même partout.
export function mosaiqueHtml(base = '') {
  const tuiles = BLOCS.map((b) => `
        <a class="ds-tuile ds-tuile--${b.aire} ds-tuile--de-${b.de}" style="--retard: ${b.retard}" href="${base}${b.href}">
          <span class="ds-tuile__titre h5">${b.titre}</span>
          ${SIGNES[b.aire].replace('src="assets/', `src="${base}assets/`)}
        </a>`).join('');

  return `<section class="ds-mosaique" aria-labelledby="ds-ouverture">
  <div class="ds-mosaique__piste">
    <div class="ds-mosaique__scene">
      <div class="ds-mosaique__carte">
        <h1 class="ds-mosaique__phrase ds-mosaique__phrase--un" id="ds-ouverture">${OUVERTURE[0]}</h1>
        <p class="ds-mosaique__phrase ds-mosaique__phrase--deux" aria-hidden="true">${OUVERTURE[1]}</p>
        <img class="ds-mosaique__logo" src="${base}assets/logo.svg" alt="MyDigitalSchool" width="150" height="88">
      </div>
      <div class="ds-mosaique__grille">${tuiles}
      </div>
      <span class="ds-mosaique__repere" aria-hidden="true">
        <span class="ds-mosaique__repere-texte label-caps">SCROLL</span>
        <svg viewBox="0 0 24 24" focusable="false"><path d="M4 7l8 7 8-7M4 13l8 7 8-7"></path></svg>
      </span>
    </div>
  </div>
</section>`;
}

// L'avancement global `p` découpé en trois gestes. Chacun va de 0 à 1 sur sa propre
// tranche de la piste, et reste à 1 ensuite : l'état final est donc celui de `p = 1`.
// Fonction pure, pour qu'un test lise les bornes plutôt que de les croire.
export function etapes(p) {
  const borne = (x) => Math.min(1, Math.max(0, x));
  return {
    // La colonne du milieu se remplit de violet et passe à la seconde phrase.
    carte: borne((p - 0.16) / 0.18),
    // Les sept blocs entrent par les bords.
    tuiles: borne((p - 0.38) / 0.40),
    // La carte se replie sur le petit logo du centre.
    reduit: borne((p - 0.82) / 0.18),
  };
}

// À appeler une fois la mosaïque posée dans la page. Elle écrit l'avancement en variables
// CSS sur la section ; toute la mise en mouvement est dans la feuille.
export function brancherMosaique(doc = document, fenetre = window) {
  const section = doc.querySelector('.ds-mosaique');
  const piste = section && section.querySelector('.ds-mosaique__piste');
  if (!piste) return;

  // Le navigateur rend sa position de défilement à une page qu'on recharge ou vers laquelle
  // on revient : la mosaïque reprendrait au milieu de son déroulé, blocs à moitié entrés.
  // Cette page-là doit toujours s'ouvrir sur sa première phrase. `pageshow` couvre le retour
  // depuis le cache de navigation, où la restauration a lieu quoi qu'on demande ici.
  if (fenetre.history) fenetre.history.scrollRestoration = 'manual';
  const auDebut = () => fenetre.scrollTo(0, 0);
  auDebut();
  fenetre.addEventListener('pageshow', auDebut);

  const poser = () => {
    // L'en-tête du site est collant : sans ça, il recouvrirait la première rangée de blocs
    // et ses titres. Sa hauteur n'est pas un token — elle dépend du logo et des paddings,
    // qui changent avec la largeur — donc on la mesure, et on la remesure au redimensionnement.
    const entete = doc.querySelector('.ds-entete');
    section.style.setProperty('--entete', `${entete ? Math.round(entete.getBoundingClientRect().height) : 0}px`);

    const cadre = piste.getBoundingClientRect();
    // La course utile : ce qui dépasse de l'écran. Au-delà, la scène n'est plus collée.
    const course = cadre.height - fenetre.innerHeight;
    const p = course > 0 ? Math.min(1, Math.max(0, -cadre.top / course)) : 1;
    const valeurs = { p, ...etapes(p) };
    for (const [nom, v] of Object.entries(valeurs)) section.style.setProperty(`--${nom}`, v.toFixed(4));
  };

  poser();
  fenetre.addEventListener('scroll', poser, { passive: true });
  fenetre.addEventListener('resize', poser);
}
