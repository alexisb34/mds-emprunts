// Les cadres d'exemple : le côté page de documentation.
//
// ## Pourquoi un cadre
//
// Le dépôt n'a pas une feuille de style mais cinq, et elles se contredisent. `.tabs` existe
// dans `css/components.css` (onglets soulignés, `.tab--active`) ET dans `css/admin.css`
// (onglets en pastille, `.is-active`) : deux composants différents sous le même nom.
// `.week-grid` est défini deux fois, avec des tailles de cellule différentes. Et chacune de
// ces feuilles pose de la mise en page globale — `.admin-shell` en grille plein écran,
// `.m-nav` en position fixe, `#toast-root` en position fixe — qui prendrait le contrôle de
// n'importe quelle page de documentation où on la chargerait.
//
// D'où la décision de la spec §4 : **chaque exemple est rendu dans son propre cadre isolé**,
// un fichier de `design-system/exemples/` qui charge exactement les feuilles dont ce
// composant a besoin, et rien d'autre. C'est la seule façon de tenir la promesse « c'est le
// vrai composant » sans que la documentation se fasse dévorer par la mise en page de
// l'application.
//
// ## Le protocole, en entier
//
// 1. La page de documentation appelle `cadreHtml({fichier, demo, titre})` et pose le résultat
//    dans son balisage. Un `<div class="ds-cadre">` qui porte un `<iframe>` vers
//    `../exemples/<fichier>#<demo>`.
// 2. Elle appelle `brancherCadres(racine)` une fois ses cadres posés.
// 3. Dans le cadre, `js/cadre-enfant.js` ne laisse voir que la `<section data-demo="…">`
//    demandée par le fragment, et annonce au parent, par `postMessage` :
//    `{ marque: 'ds-cadre', demo, hauteur, html? }`. `html` n'accompagne que la première
//    annonce d'une démonstration : c'est le HTML réellement rendu, dont la page tire le code
//    qu'elle montre — la démonstration et son code ne peuvent donc pas diverger.
// 4. `brancherCadres` donne au cadre la hauteur annoncée, et la suit quand elle change.
// 5. Si rien n'arrive dans `delaiMs` après le CHARGEMENT du cadre, le cadre est remplacé par
//    `messageCadreAbsent(fichier)`. Un cadre blanc de zéro pixel ne se voit pas ; un fichier
//    d'exemple perdu, oui.
//
// Ce module rend des chaînes HTML, comme `chrome.js` et `tokens.js`. Seule `brancherCadres`
// touche au document, et elle le reçoit en argument.

// La signature des messages du cadre. `cadre-enfant.js` en a sa propre copie — deux fichiers,
// une convention — et un test vérifie que les deux disent la même chose.
export const MARQUE_CADRE = 'ds-cadre';

// Le délai au bout duquel un cadre chargé qui n'a rien annoncé est déclaré introuvable.
export const DELAI_CADRE = 1000;

// Les exemples vivent à côté des pages de composants, dans le dossier frère.
const DOSSIER_EXEMPLES = '../exemples/';

// Le jumeau de `echapper` de `tokens.js`. Deux copies d'une ligne, plutôt qu'un module de
// plus ; au troisième emploi, il faudra un `js/texte.js`.
function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Un nom de fichier d'exemple, et un nom de démonstration : les deux formes que les tests
// savent lire dans une page. Les tenir ici évite qu'une page invente une adresse qu'aucun
// test ne pourrait suivre.
const FICHIER_VALIDE = /^[\w-]+\.html$/;
const DEMO_VALIDE = /^[\w-]+$/;

// On exige une chaîne, et pas seulement une valeur qui ressemble à une chaîne : `String(undefined)`
// vaut « undefined », qui passe le motif et produirait un cadre pointant vers `#undefined`.
const estNom = (valeur, motif) => typeof valeur === 'string' && motif.test(valeur);

// `fichier` : le nom du fichier dans `design-system/exemples/`, sans chemin.
// `demo` : la valeur du `data-demo` de la section à montrer, dans ce fichier.
// `titre` : ce que le cadre est, en une phrase. C'est le nom que lit un lecteur d'écran, et
// le seul moyen d'annoncer un `<iframe>` : il est obligatoire.
// `etroit` : un cadre à largeur de téléphone, pour les motifs mobiles.
export function cadreHtml({ fichier, demo, titre, etroit = false } = {}) {
  if (!estNom(fichier, FICHIER_VALIDE)) {
    throw new Error(`cadreHtml : fichier « ${fichier} » — attendu le nom d’un fichier de design-system/exemples/, par exemple « bouton.html »`);
  }
  if (!estNom(demo, DEMO_VALIDE)) {
    throw new Error(`cadreHtml : demo « ${demo} » — attendu la valeur d’un data-demo du fichier d’exemple, par exemple « variantes »`);
  }
  if (!titre || !String(titre).trim()) {
    throw new Error(`cadreHtml : titre manquant pour ${fichier}#${demo} — un <iframe> sans titre est muet pour un lecteur d’écran`);
  }

  // `loading="lazy"` : une page de composant porte quatre à six cadres, et les charger tous
  // au premier rendu ferait six requêtes de page complète pour un écran qui n'en montre qu'un.
  return `<div class="ds-cadre${etroit ? ' ds-cadre--etroit' : ''}" data-fichier="${echapper(fichier)}" data-demo="${echapper(demo)}">
  <iframe class="ds-cadre__vue" src="${echapper(`${DOSSIER_EXEMPLES}${fichier}#${demo}`)}" title="${echapper(titre)}" loading="lazy"></iframe>
</div>`;
}

// Ce qui remplace un cadre qui ne répond pas. Il nomme le fichier : c'est la seule
// information qui permette de corriger sans chercher.
export function messageCadreAbsent(fichier) {
  return `<div class="ds-message">
    <p class="body">Cette démonstration ne s’affiche pas&nbsp;: <code>exemples/${echapper(fichier)}</code> est introuvable, ou n’a pas répondu.</p>
    <p class="body">Le fichier devrait se trouver dans <code>design-system/exemples/</code>. Rechargez la page&nbsp;; si le message revient, le site a perdu un fichier et c’est à corriger.</p>
  </div>`;
}

// Le nom du fichier que le cadre montre, pour le message d'absence. `cadreHtml` le pose en
// `data-fichier` ; un cadre écrit à la main dans un balisage peut l'avoir oublié, et on le
// retrouve alors dans l'adresse.
function fichierDe(cadre, vue) {
  const pose = cadre.dataset && cadre.dataset.fichier;
  if (pose) return pose;
  const src = (vue.getAttribute && vue.getAttribute('src')) || '';
  return (src.match(/([\w-]+\.html)/) || [])[1] || '';
}

// À appeler une fois les cadres posés dans la page, DANS LE MÊME SCRIPT : un cadre déjà
// chargé quand on arrive n'armerait jamais son compte à rebours, et un fichier manquant
// resterait un rectangle vide. `racine` est l'élément qui contient les cadres (le `<main>` de
// la page, ou le document). `fenetre` est reçue en argument, comme pour `brancherSommaire`,
// pour qu'un test lui en donne une fausse.
export function brancherCadres(racine, delaiMs = DELAI_CADRE, fenetre = window) {
  if (!racine || !racine.querySelectorAll) return;
  const cadres = [...racine.querySelectorAll('.ds-cadre')];
  const etats = [];

  for (const cadre of cadres) {
    const vue = cadre.querySelector('.ds-cadre__vue');
    if (!vue) continue;
    const fichier = fichierDe(cadre, vue);
    const etat = { cadre, vue, repondu: false, minuteur: 0 };
    etats.push(etat);

    // Le compte à rebours part au CHARGEMENT du cadre, pas au branchement : avec
    // `loading="lazy"`, un cadre en bas de page peut n'être chargé que dans dix minutes, et
    // le déclarer introuvable avant qu'il ait été demandé serait un faux diagnostic. Un
    // fichier absent, lui, charge quand même quelque chose (la page d'erreur du serveur) :
    // `load` part, aucune annonce ne suit, et le délai fait son travail.
    const armer = () => {
      if (etat.repondu || etat.minuteur) return;
      etat.minuteur = fenetre.setTimeout(() => {
        etat.minuteur = 0;
        if (etat.repondu) return;
        cadre.innerHTML = messageCadreAbsent(fichier);
      }, delaiMs);
    };
    vue.addEventListener('load', armer);
    vue.addEventListener('error', armer);
  }

  if (!etats.length) return;

  fenetre.addEventListener('message', (evenement) => {
    const donnees = evenement.data;
    if (!donnees || typeof donnees !== 'object' || donnees.marque !== MARQUE_CADRE) return;
    // Un `message` peut venir de n'importe quelle fenêtre : une extension, un autre onglet.
    // Seule l'identité de la fenêtre émettrice fait foi — nos cadres sont de même origine,
    // donc leur `contentWindow` est comparable et ne peut pas être imité.
    const etat = etats.find((e) => e.vue.contentWindow === evenement.source);
    if (!etat) return;

    etat.repondu = true;
    if (etat.minuteur) { fenetre.clearTimeout(etat.minuteur); etat.minuteur = 0; }

    // Arrondi au pixel supérieur : un demi-pixel manquant suffit à faire apparaître une
    // barre de défilement dans le cadre.
    if (typeof donnees.hauteur === 'number' && Number.isFinite(donnees.hauteur) && donnees.hauteur > 0) {
      etat.vue.style.height = `${Math.ceil(donnees.hauteur)}px`;
    }
  });
}
