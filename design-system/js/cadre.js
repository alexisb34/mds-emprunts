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
//    `../exemples/<fichier>#<demo>` depuis une page de `composants/`, ou
//    `exemples/<fichier>#<demo>` depuis un chapitre à la racine de `design-system/` (option
//    `depuisRacine`).
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
//    **Pas d'`await` entre la pose des cadres (et des blocs de code) et `brancherCadres`** : les
//    cadres sont chargés d'emblée quand ils ont un bloc de code, et annoncent leur HTML UNE
//    seule fois. Un cadre qui a annoncé avant qu'on l'écoute ne le dira plus ; `brancherCadres`
//    le détecte et le bloc le déclare (raison « tard »), mais le code est perdu. Un test de
//    `tests/ds-code.test.mjs` tient la règle sur toutes les pages.
// 6. Le code : la page pose `codeHtml({fichier, demo, titre})` (`code.js`) à l'endroit où elle
//    veut montrer le code d'une démonstration. `brancherCadres` remet à ce bloc le `html` de
//    la première annonce du cadre qui montre la même démonstration — réindenté, avec un bouton
//    « Copier ». Le cadre ne l'envoie qu'une fois : c'est le bloc de la page qui le garde, et
//    la page n'a donc rien à mémoriser d'autre.
//
// Ce module rend des chaînes HTML, comme `chrome.js` et `tokens.js`. Seule `brancherCadres`
// touche au document, et elle le reçoit en argument.

import { estNom, echapper, FICHIER_VALIDE, DEMO_VALIDE } from './texte.js';
import { poserCode, brancherCode, signalerCodeAbsent } from './code.js';

// La signature des messages du cadre. `cadre-enfant.js` en a sa propre copie — deux fichiers,
// une convention — et un test vérifie que les deux disent la même chose.
export const MARQUE_CADRE = 'ds-cadre';

// Le délai au bout duquel un cadre chargé qui n'a rien annoncé est déclaré introuvable.
export const DELAI_CADRE = 1000;

// Les exemples vivent à côté des pages de composants, dans le dossier frère. Une page de la
// racine de `design-system/` (un chapitre de la marque) les a, elle, juste en dessous d'elle.
const DOSSIER_EXEMPLES = '../exemples/';
const DOSSIER_EXEMPLES_DEPUIS_RACINE = 'exemples/';

// `fichier` : le nom du fichier dans `design-system/exemples/`, sans chemin.
// `demo` : la valeur du `data-demo` de la section à montrer, dans ce fichier.
// `titre` : ce que le cadre est, en une phrase. C'est le nom que lit un lecteur d'écran, et
// le seul moyen d'annoncer un `<iframe>` : il est obligatoire.
// `etroit` : un cadre à largeur de téléphone, pour les motifs mobiles.
// `depuisRacine` : la page est à la racine de `design-system/` (typographie.html), pas dans
// `composants/` : l'adresse du cadre est alors `exemples/…` et non `../exemples/…`.
export function cadreHtml({ fichier, demo, titre, etroit = false, depuisRacine = false } = {}) {
  if (!estNom(fichier, FICHIER_VALIDE)) {
    throw new Error(`cadreHtml : fichier « ${fichier} » — attendu le nom d’un fichier de design-system/exemples/, par exemple « bouton.html »`);
  }
  if (!estNom(demo, DEMO_VALIDE)) {
    throw new Error(`cadreHtml : demo « ${demo} » — attendu la valeur d’un data-demo du fichier d’exemple, par exemple « variantes »`);
  }
  if (!titre || !String(titre).trim()) {
    throw new Error(`cadreHtml : titre manquant pour ${fichier}#${demo} — un <iframe> sans titre est muet pour un lecteur d’écran`);
  }

  if (typeof depuisRacine !== 'boolean') {
    throw new Error(`cadreHtml : depuisRacine « ${depuisRacine} » — attendu true ou false`);
  }
  const dossier = depuisRacine ? DOSSIER_EXEMPLES_DEPUIS_RACINE : DOSSIER_EXEMPLES;

  // `loading="lazy"` : une page de composant porte quatre à six cadres, et les charger tous
  // au premier rendu ferait six requêtes de page complète pour un écran qui n'en montre qu'un.
  return `<div class="ds-cadre${etroit ? ' ds-cadre--etroit' : ''}" data-fichier="${echapper(fichier)}" data-demo="${echapper(demo)}">
  <iframe class="ds-cadre__vue" src="${echapper(`${dossier}${fichier}#${demo}`)}" title="${echapper(titre)}" loading="lazy"></iframe>
</div>`;
}

// Ce qui remplace un cadre qui ne répond pas. Il nomme le fichier : c'est la seule
// information qui permette de corriger sans chercher.
// `role="status"` : le message remplace un cadre APRÈS le chargement de la page, donc il
// apparaît sans que rien ne l'annonce. Une région de statut le fait lire à qui ne regarde pas.
export function messageCadreAbsent(fichier) {
  return `<div class="ds-message" role="status">
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

// Le cadre n'a-t-il encore chargé que son document vide ? Firefox émet un `load` sur
// l'`about:blank` initial d'un `<iframe>`, avant même que l'adresse demandée commence à
// charger : armer le compte à rebours dessus déclarerait introuvable un cadre qu'on n'a pas
// encore cherché. Une adresse illisible n'est pas `about:blank` — c'est une vraie page.
function estVierge(vue) {
  try {
    return !vue.contentWindow || vue.contentWindow.location.href === 'about:blank';
  } catch {
    return false;
  }
}

// Le cadre a-t-il fini de charger, c'est-à-dire : son `load` est-il déjà passé ? Alors une
// annonce a pu partir avant que la page l'écoute, et personne ne la renverra. Un document encore
// en cours de chargement, lui, déclenchera `load` plus tard, et le compte à rebours du cadre
// fera son travail ; un cadre qui n'a que son document vide n'a encore rien dit.
function dejaCharge(vue) {
  if (estVierge(vue)) return false;
  try {
    return !vue.contentDocument || vue.contentDocument.readyState === 'complete';
  } catch {
    return true;
  }
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
    // `blocs` : les blocs de code de la page qui montrent le code de CETTE démonstration.
    const etat = { cadre, vue, fichier, demo: cadre.dataset && cadre.dataset.demo, repondu: false, minuteur: 0, blocs: [] };
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
        // Le cadre porte déjà une bordure : il la rend au message, qui a la sienne, pour
        // qu'un seul trait entoure un seul objet.
        if (cadre.classList) cadre.classList.add('ds-cadre--muet');
        cadre.innerHTML = messageCadreAbsent(fichier);
        // Le code de cette démonstration ne viendra pas non plus : le bloc le dit.
        for (const bloc of etat.blocs) signalerCodeAbsent(bloc, 'muet');
      }, delaiMs);
    };
    // `load` sur le document vide ne compte pas (voir `estVierge`) ; `error`, si : il ne ment
    // pas, le cadre a vraiment échoué.
    vue.addEventListener('load', () => { if (!estVierge(vue)) armer(); });
    vue.addEventListener('error', armer);
  }

  // Les blocs de code : chacun s'adosse au cadre qui montre la même démonstration du même
  // fichier. Un bloc que rien n'alimente le dit tout de suite, il ne reste pas à attendre.
  for (const bloc of [...racine.querySelectorAll('.ds-code-bloc')]) {
    brancherCode(bloc, fenetre);
    const etat = etats.find((e) => e.fichier === bloc.dataset.fichier && e.demo === bloc.dataset.demo);
    if (!etat) { signalerCodeAbsent(bloc, 'sans-cadre'); continue; }
    etat.blocs.push(bloc);
    // `loading="lazy"` ne charge un cadre que s'il approche de l'écran. Le code, lui, peut être
    // ailleurs — on y saute depuis le sommaire — et resterait vide tant qu'on n'a pas fait
    // défiler jusqu'au cadre. Un cadre dont le code est montré se charge donc d'emblée.
    if (typeof etat.vue.setAttribute === 'function') etat.vue.setAttribute('loading', 'eager');
    // Garde contre le silence. Si le cadre a déjà fini de charger, il a déjà annoncé — sa
    // première annonce est la seule à porter le HTML, et elle est perdue : `load` est passé, donc
    // le compte à rebours du cadre ne s'armera jamais non plus. Sans cette garde, un `await`
    // glissé entre la pose des cadres et ce branchement laisserait le bloc sur « Le code
    // apparaît… » pour toujours, sans message et sans état. Le délai laisse au code le temps
    // d'arriver s'il est encore en route ; passé ce délai, le bloc dit qu'il ne viendra pas.
    if (dejaCharge(etat.vue)) {
      fenetre.setTimeout(() => { if (!bloc.dataset.etat) signalerCodeAbsent(bloc, 'tard'); }, delaiMs);
    }
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

    // Le HTML n'accompagne que la première annonce d'une démonstration, et c'est ici qu'on le
    // pose : il n'est pas renvoyé. Seule compte la démonstration que CE cadre doit montrer —
    // un lien dans l'exemple peut faire passer le cadre à une autre section du même fichier,
    // dont le code n'est pas celui que ces blocs montrent.
    if (typeof donnees.html === 'string' && donnees.demo === etat.demo) {
      for (const bloc of etat.blocs) poserCode(bloc, donnees.html);
    }
  });
}
