// Le code montré sous une démonstration : extrait du cadre, réindenté, copiable.
//
// ## La promesse que ce module tient
//
// Le code qu'une page de composant affiche n'est écrit nulle part. Le cadre annonce le HTML
// qu'il a réellement rendu (`cadre-enfant.js`), `brancherCadres` (`cadre.js`) le remet à
// `poserCode`, qui le réindente et l'affiche. La démonstration et son code ne peuvent donc pas
// diverger : un changement dans l'exemple change les deux, et il n'existe aucune copie à
// oublier de mettre à jour. Une page n'écrit jamais de `<pre>` : elle appelle `codeHtml`.
//
// ## Le protocole, côté page
//
//   codeHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Les quatre variantes' })
//
// pose un bloc vide, adossé à la démonstration `variantes` de `exemples/bouton.html`. Il faut
// aussi, dans la MÊME page, un `cadreHtml` sur cette même démonstration : c'est lui qui envoie
// le HTML. Puis `brancherCadres(racine)` — une seule fois, il branche aussi les blocs — et le
// bouton « Copier » fonctionne. Un bloc sans cadre, ou dont le cadre ne répond pas, le dit
// dans le bloc au lieu de rester vide.
//
// ## Copier, et ce qu'on fait quand le navigateur refuse
//
// `navigator.clipboard` n'existe que sur une origine sécurisée (HTTPS, `localhost`), et même là
// l'écriture peut être refusée. Dans les deux cas, `copier` retombe sur la SÉLECTION du texte :
// la personne n'a plus qu'à faire Cmd+C ou Ctrl+C, et le bouton le lui dit. Un bouton qui
// échoue sans rien dire est le pire des résultats : la personne croit avoir copié et colle
// autre chose.

import { echapper, estNom, FICHIER_VALIDE, DEMO_VALIDE } from './texte.js';

// ---- Réindenter ----

// Les balises qui n'ont ni contenu ni balise fermante.
const VIDES = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Celles dont les espaces et les retours à la ligne font partie du contenu : on n'y touche pas.
const BRUTS = new Set(['pre', 'textarea', 'script', 'style']);
// Le texte courant. Un élément qui n'en contient que, avec du texte, reste sur sa ligne :
// couper `<p>Un <strong>seul</strong> bouton</p>` changerait la phrase qu'il dit.
const EN_LIGNE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);

// Un commentaire, ou une balise — avec ses attributs, dont une valeur peut contenir un « > ».
const JETON = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^\s>/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;

// Les attributs booléens. Le navigateur les sérialise avec une valeur vide (`disabled=""`), là
// où on écrit `disabled` : c'est équivalent, mais ce n'est pas ce que la personne tape, et la
// page dit « l'attribut `disabled` ». On ne touche qu'à cette liste : `alt=""` et `value=""`
// veulent dire quelque chose, eux.
const BOOLEENS = 'allowfullscreen|async|autofocus|autoplay|checked|controls|default|defer|disabled|formnovalidate|hidden|inert|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected';
// Une valeur entre guillemets est avalée d'abord, telle quelle : `title='un disabled=""'` reste.
const VALEUR_VIDE = new RegExp(`("[^"]*"|'[^']*')|(\\s(?:${BOOLEENS}))=(?:""|'')(?=[\\s/>])`, 'gi');
const sansValeurVide = (balise) => balise.replace(VALEUR_VIDE, (m, citee, booleen) => citee ?? booleen);

// Le HTML en arbre. Tout est conservé : une balise fermante sans ouvrante devient un nœud
// `orphelin`, une balise jamais refermée reste sans `fermante`.
function lire(brut) {
  const racine = { enfants: [] };
  const pile = [racine];
  const ajouter = (noeud) => pile[pile.length - 1].enfants.push(noeud);
  let position = 0;
  JETON.lastIndex = 0;
  let m;
  while ((m = JETON.exec(brut)) !== null) {
    if (m.index > position) ajouter({ type: 'texte', texte: brut.slice(position, m.index) });
    position = JETON.lastIndex;
    const balise = m[0];
    if (balise.startsWith('<!--')) { ajouter({ type: 'commentaire', brut: balise }); continue; }

    const nom = balise.match(/^<\/?([^\s>/]+)/)[1].toLowerCase();
    if (balise.startsWith('</')) {
      let i = pile.length - 1;
      while (i > 0 && pile[i].nom !== nom) i -= 1;
      if (i === 0) { ajouter({ type: 'orphelin', brut: balise }); continue; }
      pile[i].fermante = balise;
      pile.length = i;
      continue;
    }

    if (BRUTS.has(nom)) {
      // Du ouvrant au fermant, d'un seul tenant et tel quel.
      const fin = new RegExp(`</${nom}\\s*>`, 'ig');
      fin.lastIndex = position;
      const f = fin.exec(brut);
      const arret = f ? f.index + f[0].length : brut.length;
      ajouter({ type: 'brut', brut: brut.slice(m.index, arret) });
      position = arret;
      JETON.lastIndex = arret;
      continue;
    }

    const noeud = { type: 'element', nom, ouvrante: sansValeurVide(balise), fermante: null, enfants: [] };
    ajouter(noeud);
    if (VIDES.has(nom) || balise.endsWith('/>')) noeud.vide = true;
    else pile.push(noeud);
  }
  if (position < brut.length) ajouter({ type: 'texte', texte: brut.slice(position) });
  return racine.enfants;
}

const aDuTexte = (noeud) => (noeud.type === 'texte' ? noeud.texte.trim() !== '' : (noeud.enfants || []).some(aDuTexte));

// Du texte courant : du texte, un saut de ligne, ou un élément de texte courant fermé dont tout
// le contenu en est aussi.
const estCourant = (n) => n.type === 'texte'
  || (n.type === 'element' && (n.vide ? n.nom === 'br' || n.nom === 'wbr' : EN_LIGNE.has(n.nom) && !!n.fermante && n.enfants.every(estCourant)));

// Peut-on écrire cet élément sur une seule ligne ? Oui s'il est fermé et vide, ou s'il ne
// contient que du texte courant et qu'il y a du texte à lire.
function tientSurUneLigne(noeud) {
  if (noeud.vide) return true;
  if (!noeud.fermante) return false;
  if (!noeud.enfants.length) return true;
  return noeud.enfants.every(estCourant) && aDuTexte(noeud);
}

function enLigne(noeud) {
  if (noeud.type === 'texte') return noeud.texte.replace(/\s+/g, ' ');
  if (noeud.vide) return noeud.ouvrante;
  return noeud.ouvrante + noeud.enfants.map(enLigne).join('') + (noeud.fermante || '');
}

function ecrire(noeuds, niveau, lignes) {
  const retrait = '  '.repeat(niveau);
  for (const n of noeuds) {
    if (n.type === 'texte') {
      const texte = n.texte.replace(/\s+/g, ' ').trim();
      if (texte) lignes.push(retrait + texte);
    } else if (n.type === 'commentaire' || n.type === 'orphelin' || n.type === 'brut') {
      lignes.push(retrait + n.brut);
    } else if (tientSurUneLigne(n)) {
      // Les blancs aux deux bouts d'un élément ne se voient pas : `<button> OK </button>` vaut
      // `<button>OK</button>`.
      const dedans = n.vide ? '' : n.enfants.map(enLigne).join('').replace(/\s+/g, ' ').trim();
      lignes.push(retrait + (n.vide ? n.ouvrante : n.ouvrante + dedans + n.fermante));
    } else {
      lignes.push(retrait + n.ouvrante);
      ecrire(n.enfants, niveau + 1, lignes);
      if (n.fermante) lignes.push(retrait + n.fermante);
    }
  }
}

// Réindente un morceau de HTML : une balise par ligne, deux espaces par niveau. Un élément qui
// ne porte que du texte reste sur sa ligne, et ce qui est préformaté (`<pre>`, `<textarea>`) ne
// bouge pas. Seuls les blancs entre les éléments changent : balises, attributs et texte
// sortent tels qu'ils sont entrés — à une exception près, les attributs booléens que le
// navigateur sérialise avec une valeur vide (voir `BOOLEENS`).
export function formaterHtml(brut) {
  const lignes = [];
  ecrire(lire(String(brut ?? '')), 0, lignes);
  return lignes.join('\n');
}

// ---- Copier ----

// Sélectionne le contenu de `champ`, pour que Cmd+C / Ctrl+C le copie. Un champ de formulaire
// se sélectionne lui-même (`select()`, après un `focus()` : Safari l'exige) ; un `<pre>` ou un
// `<code>` passe par une plage du document, et GARDE le focus ailleurs — la personne au clavier
// ne perd pas sa place sur le bouton, dont le message est lu là où elle est.
function selectionner(champ) {
  if (champ && typeof champ.select === 'function') {
    if (typeof champ.focus === 'function') champ.focus({ preventScroll: true });
    champ.select();
    return;
  }
  const doc = champ && champ.ownerDocument;
  const vue = doc && doc.defaultView;
  const selection = vue && typeof vue.getSelection === 'function' ? vue.getSelection() : null;
  if (!doc || !selection || typeof doc.createRange !== 'function') {
    throw new Error('copier : rien à sélectionner — `champ` doit être un champ de formulaire ou un élément du document');
  }
  const plage = doc.createRange();
  plage.selectNodeContents(champ);
  selection.removeAllRanges();
  selection.addRange(plage);
}

// Copie `texte` dans le presse-papiers. S'il est absent (origine non sécurisée) ou refuse
// l'écriture, sélectionne `champ` à la place et le dit par son retour : l'appelant annonce
// alors à la personne qu'elle doit finir le geste elle-même.
//
// Ne lève que si la sélection elle-même est impossible (`champ` n'est pas un élément du
// document) : ni copie ni sélection, c'est une erreur d'appel, et l'avaler ferait annoncer
// « sélectionné » à une personne devant un texte qui ne l'est pas.
export async function copier(texte, champ) {
  const presse = globalThis.navigator && globalThis.navigator.clipboard;
  if (presse && typeof presse.writeText === 'function') {
    try {
      await presse.writeText(texte);
      return 'presse-papiers';
    } catch {
      // Refusé : permission, document sans focus, politique de la page. On se rabat.
    }
  }
  selectionner(champ);
  return 'selection';
}

// Le raccourci que cette personne a sous les doigts. « Faites Cmd+C » dit à quelqu'un sous
// Windows de chercher une touche qu'il n'a pas.
export function raccourciCopie(nav = globalThis.navigator) {
  const plateforme = String((nav && nav.userAgentData && nav.userAgentData.platform) || (nav && nav.platform) || '');
  return /mac|iphone|ipad|ipod/i.test(plateforme) ? 'Cmd+C' : 'Ctrl+C';
}

// Ce que le bouton affiche selon ce qui s'est passé.
export function messageCopie(resultat, raccourci) {
  return resultat === 'presse-papiers' ? 'Copié' : `Sélectionné, faites ${raccourci}`;
}

const MESSAGE_ECHEC = 'Copie impossible, sélectionnez le code à la main';
// Combien de temps le bouton garde son message avant de redevenir « Copier ». Celui qui demande
// un geste à la personne dure plus longtemps : elle a besoin de le lire, puis de le faire.
const DUREE_COPIE = 2000;
const DUREE_CONSIGNE = 8000;

// ---- Le bloc de la page ----

const SELECTEUR_TEXTE = '.ds-code-bloc__texte';
const SELECTEUR_BOUTON = '.ds-copier';
const SELECTEUR_ETAT = '.ds-code-bloc__etat';

// Un bloc de code adossé à la démonstration `demo` de `exemples/<fichier>`. Il est posé vide :
// son contenu arrive du cadre (voir `brancherCadres`).
//
// `titre` nomme le bloc pour un lecteur d'écran — le `<pre>` défile, il est donc focalisable
// (`tabindex="0"`), et une région focalisable sans nom est annoncée « groupe » sans plus.
// Le bouton est inactif tant qu'il n'y a rien à copier.
export function codeHtml({ fichier, demo, titre } = {}) {
  if (!estNom(fichier, FICHIER_VALIDE)) {
    throw new Error(`codeHtml : fichier « ${fichier} » — attendu le nom d’un fichier de design-system/exemples/, par exemple « bouton.html »`);
  }
  if (!estNom(demo, DEMO_VALIDE)) {
    throw new Error(`codeHtml : demo « ${demo} » — attendu la valeur d’un data-demo du fichier d’exemple, par exemple « variantes »`);
  }
  if (!titre || !String(titre).trim()) {
    throw new Error(`codeHtml : titre manquant pour ${fichier}#${demo} — une région sans nom est muette pour un lecteur d’écran`);
  }
  return `<div class="ds-code-bloc" data-fichier="${echapper(fichier)}" data-demo="${echapper(demo)}">
  <pre class="ds-code body-sm" tabindex="0" role="region" aria-label="Code HTML : ${echapper(titre)}"><code class="ds-code-bloc__texte">Le code apparaît quand la démonstration est chargée.</code></pre>
  <div class="ds-code-bloc__barre">
    <button type="button" class="ds-copier label-md" disabled>Copier</button>
    <span class="ds-code-bloc__etat visually-hidden" role="status"></span>
  </div>
</div>`;
}

// Dit dans le bloc que son code ne viendra pas, et pourquoi. `raison` :
//   'muet'       le cadre ne répond pas ;
//   'vide'       le cadre répond, mais n'a pas cette démonstration ;
//   'sans-cadre' aucun cadre de la page ne montre cette démonstration.
export function signalerCodeAbsent(bloc, raison = 'vide') {
  const texte = bloc.querySelector(SELECTEUR_TEXTE);
  const bouton = bloc.querySelector(SELECTEUR_BOUTON);
  const etat = bloc.querySelector(SELECTEUR_ETAT);
  const { fichier, demo } = bloc.dataset;
  const cause = {
    muet: `la démonstration « ${demo} » ne s’est pas affichée`,
    'sans-cadre': `aucun cadre de cette page ne montre la démonstration « ${demo} » de exemples/${fichier}`,
  }[raison] || `la démonstration « ${demo} » est introuvable dans exemples/${fichier}`;
  const message = `Le code n’a pas pu être lu : ${cause}.`;
  bloc.dataset.etat = 'absent';
  if (texte) texte.textContent = message;
  if (bouton) bouton.disabled = true;
  // La zone de statut le fait lire à qui ne regarde pas : le bloc change APRÈS le chargement.
  if (etat) etat.textContent = message;
}

// Pose dans le bloc le HTML annoncé par le cadre, réindenté, et libère le bouton. Le HTML est
// posé comme TEXTE (`textContent`) : c'est une chaîne à montrer, jamais un morceau de page.
export function poserCode(bloc, brut) {
  const formate = formaterHtml(brut);
  if (!formate) { signalerCodeAbsent(bloc, 'vide'); return; }
  const texte = bloc.querySelector(SELECTEUR_TEXTE);
  const bouton = bloc.querySelector(SELECTEUR_BOUTON);
  const etat = bloc.querySelector(SELECTEUR_ETAT);
  if (texte) texte.textContent = formate;
  if (bouton) bouton.disabled = false;
  if (etat && bloc.dataset.etat === 'absent') etat.textContent = '';
  bloc.dataset.etat = 'pret';
}

// Branche le bouton « Copier » d'un bloc. À appeler une fois ; `brancherCadres` s'en charge.
// `fenetre` est reçue en argument, comme ailleurs, pour qu'un test lui en donne une fausse.
export function brancherCode(bloc, fenetre = window) {
  const texte = bloc.querySelector(SELECTEUR_TEXTE);
  const bouton = bloc.querySelector(SELECTEUR_BOUTON);
  const etat = bloc.querySelector(SELECTEUR_ETAT);
  if (!texte || !bouton || bloc.dataset.branche) return;
  bloc.dataset.branche = 'oui';

  let minuteur = 0;
  const annoncer = (message, duree) => {
    bouton.textContent = message;
    if (etat) etat.textContent = message;
    if (minuteur) fenetre.clearTimeout(minuteur);
    minuteur = fenetre.setTimeout(() => {
      minuteur = 0;
      bouton.textContent = 'Copier';
      if (etat) etat.textContent = '';
    }, duree);
  };

  bouton.addEventListener('click', async () => {
    // Pas de code, pas de copie : le texte d'attente n'est pas du code.
    if (bloc.dataset.etat !== 'pret') return;
    try {
      const resultat = await copier(texte.textContent, texte);
      annoncer(messageCopie(resultat, raccourciCopie()), resultat === 'presse-papiers' ? DUREE_COPIE : DUREE_CONSIGNE);
    } catch {
      annoncer(MESSAGE_ECHEC, DUREE_CONSIGNE);
    }
  });
}
