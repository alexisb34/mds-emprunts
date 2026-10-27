// Les cadres d'exemple : le côté DANS le cadre.
//
// Un fichier de `design-system/exemples/` est une page complète et autonome : les polices,
// `css/tokens.css`, `css/base.css`, puis seulement les feuilles que ce composant réclame.
// Chaque démonstration y est une `<section data-demo="…">`. Ce module :
//
// 1. ne laisse voir que la section demandée par le fragment de l'adresse (`…#variantes`) ;
// 2. annonce sa hauteur à la page parente, et la réannonce quand elle change ;
// 3. envoie avec la première annonce le HTML de la section — c'est le code que la page de
//    documentation montre, pris dans ce qui est rendu plutôt que recopié à côté.
//
// Un exemple ouvert directement, sans fragment, montre toutes ses démonstrations : c'est la
// façon la plus courte de voir d'un coup ce que le fichier contient.
//
// **La règle que tout fichier d'exemple doit tenir** : sa hauteur vient de son CONTENU, jamais
// de la fenêtre. Un `100vh` ou un `height: 100%` dans un exemple ferait dépendre sa hauteur de
// celle que le parent vient de lui donner, et les deux se poursuivraient sans fin. Un écran de
// téléphone se simule par une largeur (`ds-cadre--etroit`), pas par une hauteur. Un test de
// `tests/ds-cadre.test.mjs` tient cette règle.
//
// Le module est chargé par `<script type="module" src="../js/cadre-enfant.js"></script>` et
// s'installe tout seul dans un navigateur. Il n'expose que des fonctions pures et un
// `installer(fenetre)` qui reçoit la fenêtre, pour qu'un test lui en donne une fausse.

// La signature des messages du cadre. `cadre.js` en a sa propre copie — deux fichiers, une
// convention — et un test vérifie que les deux disent la même chose. Les importer l'un de
// l'autre ferait charger le module du parent dans chaque cadre, ou l'inverse.
export const MARQUE_CADRE = 'ds-cadre';

// L'identifiant du message « cette démonstration n'existe pas dans ce fichier », posé dans
// la page de l'exemple pour pouvoir être retiré ensuite.
const ID_MANQUE = 'ds-demo-absente';

// Le fragment d'une adresse, décodé : `#états` arrive encodé.
export function demoDe(hash) {
  const brut = String(hash ?? '').replace(/^#/, '');
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}

export function sectionsDe(doc) {
  return [...doc.querySelectorAll('[data-demo]')];
}

// Ne laisse voir que la section `cle`. Sans `cle`, montre tout.
//
// Le masquage passe par `style.display`, pas par une classe ni par l'attribut `hidden` :
// un exemple ne charge pas la feuille du site, il n'y a donc aucune classe utilitaire sur
// laquelle compter, et une section posée en `display: grid` ignorerait `hidden`.
export function montrerDemo(doc, cle) {
  const sections = sectionsDe(doc);
  const voulue = cle ? sections.find((s) => s.dataset.demo === cle) : null;
  for (const s of sections) s.style.display = (!cle || s === voulue) ? '' : 'none';

  const manque = doc.getElementById(ID_MANQUE);
  if (cle && !voulue) {
    const message = manque || doc.createElement('p');
    message.id = ID_MANQUE;
    message.className = 'body';
    message.textContent = `La démonstration « ${cle} » est introuvable dans ce fichier d’exemple.`;
    if (!manque) doc.body.prepend(message);
    return { trouvee: false, section: null };
  }
  if (manque) manque.remove();
  return { trouvee: true, section: voulue };
}

// La hauteur du contenu, en pixels. On prend la plus grande des deux mesures : selon la
// mise en page de l'exemple, c'est la racine ou le corps qui porte la hauteur réelle.
export function hauteurDe(doc) {
  const mesures = [doc.documentElement, doc.body]
    .filter((e) => e && typeof e.getBoundingClientRect === 'function')
    .map((e) => e.getBoundingClientRect().height);
  return Math.ceil(Math.max(0, ...mesures));
}

// Sur un fichier local, `location.origin` vaut la chaîne « null » et aucune origine précise
// n'est acceptée. Le repli sur `*` est sans conséquence : le message ne transporte que de la
// documentation publique, et c'est le parent qui authentifie l'émetteur, par l'identité de
// sa fenêtre (voir `cadre.js`).
function origineCible(fenetre) {
  const origine = fenetre.location && fenetre.location.origin;
  return origine && origine !== 'null' ? origine : '*';
}

export function installer(fenetre) {
  const doc = fenetre.document;
  if (!doc) return;

  // La dernière hauteur annoncée. Comparer avant d'envoyer évite deux choses : du bruit sur
  // chaque mesure, et la boucle où le parent change la taille du cadre, ce qui refait mesurer.
  let derniere = -1;
  let demoEnvoyee = null;
  // Ce qui est AFFICHÉ, qui n'est pas forcément ce que dit l'adresse : un lien de
  // démonstration peut changer le fragment sans changer la démonstration. L'annonce suit
  // l'affichage, jamais l'adresse — sinon un fragment étranger ferait repartir un message
  // avec une démonstration vide, et le code montré par la page se viderait avec elle.
  let demoAffichee = '';

  const annoncer = () => {
    const hauteur = hauteurDe(doc);
    if (hauteur === derniere && demoAffichee === demoEnvoyee) return;
    const premiere = demoAffichee !== demoEnvoyee;
    derniere = hauteur;
    demoEnvoyee = demoAffichee;
    if (!fenetre.parent || fenetre.parent === fenetre) return;   // ouvert tout seul : personne à qui parler
    const message = { marque: MARQUE_CADRE, demo: demoAffichee, hauteur };
    if (premiere) {
      const section = sectionsDe(doc).find((s) => s.dataset.demo === demoAffichee);
      message.html = section ? String(section.innerHTML).trim() : '';
    }
    fenetre.parent.postMessage(message, origineCible(fenetre));
  };

  const choisir = (cle) => {
    montrerDemo(doc, cle);
    demoAffichee = cle;
    annoncer();
  };

  // Au chargement, le fragment commande : c'est le parent qui l'a écrit dans l'adresse du
  // cadre. Sans fragment, l'exemple est ouvert directement et montre tout.
  choisir(demoDe(fenetre.location && fenetre.location.hash));

  // Ensuite, non. Une démonstration contient des liens — un bouton-lien, un onglet, un fil
  // d'Ariane, une ligne de tableau cliquable — et les cliquer change le fragment de l'adresse
  // du cadre sans rien dire d'une démonstration. Un `href="#/emprunts"`, celui que l'outil
  // d'emprunt écrit vraiment, ferait sinon réapparaître les quatre démonstrations du fichier
  // d'un coup. Le cadre ne suit donc un changement de fragment que s'il nomme une
  // démonstration de ce fichier.
  fenetre.addEventListener('hashchange', () => {
    const cle = demoDe(fenetre.location && fenetre.location.hash);
    if (cle && sectionsDe(doc).some((s) => s.dataset.demo === cle)) choisir(cle);
  });

  // Les polices changent la hauteur du texte en arrivant : Bricolage Grotesque et Inter sont
  // chargées en `display: swap`, donc le premier rendu se fait dans une police de repli.
  if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
    doc.fonts.ready.then(annoncer);
  }
  // `ResizeObserver` couvre tout : la largeur du cadre qui change, une image qui arrive, un
  // bouton qui passe à la ligne. Sans lui, on se rabat sur le redimensionnement de la fenêtre.
  if (typeof fenetre.ResizeObserver === 'function') {
    new fenetre.ResizeObserver(annoncer).observe(doc.body);
  } else {
    fenetre.addEventListener('resize', annoncer);
  }
}

// Dans un navigateur, le module s'installe de lui-même. Sous Node — un test qui importe ce
// fichier — il n'y a pas de `window` et rien ne se produit.
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
  installer(window);
}
