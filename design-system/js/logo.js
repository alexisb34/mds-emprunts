// Le chapitre Logo : les versions, leurs exports, les fonds, et les neuf interdits.
//
// ## Ce qui est stocké, ce qui est fabriqué
//
// Un seul fichier existe : `assets/logo.svg`, le logo officiel de mydigitalschool.com, sans
// une retouche. Les versions blanche et anthracite, la version violette qui sert de contre-
// exemple, et tous les PNG sont FABRIQUÉS dans le navigateur de la personne, au moment où elle
// arrive ou clique. Rien de binaire au dépôt, aucune étape de construction.
//
// ## Les mesures
//
// Les nombres que la page affiche (19 %, 80 px, 63 %, les rapports de contraste) ne sont écrits
// nulle part en dur dans le texte : ils viennent des constantes de ce module, et de
// `contraste.js` pour les rapports. `tests/ds-logo.test.mjs` recalcule les mesures du dessin
// depuis le SVG, avec son propre calcul de courbes, et compare.
//
// Le SVG a un `viewBox` de 150 × 88, mais le DESSIN n'en occupe qu'une partie : il touche les
// bords gauche et droit, et laisse du vide en haut et en bas. Les mesures de la zone de
// protection et du recadrage partent donc de `DESSIN`, pas du `viewBox`. Les exports, eux,
// gardent le `viewBox` entier : `tailleExport` suit `RATIO`, le rapport du fichier.
//
// ## Ce que ce module rend
//
// `pageHtml(sources)` rend le CONTENU de `<main>`, en une chaîne : pas de DOM, comme les autres
// modules du site. `sources` dit où trouver chaque version (`couleur`, `blanc`, `anthracite`,
// `violet`) ; `preparerSources` les fabrique depuis le texte du SVG.

import { echapper } from './texte.js';
import { ratio, ratioExact } from './contraste.js';

// ---- Le logo ----

export const COULEURS = { turquoise: '#2DB8C5', anthracite: '#3C3C3B' };

// Le rapport du fichier : 150 × 88. C'est celui des exports, vide compris.
export const RATIO = 150 / 88;

// Les largeurs des PNG fabriqués : l'écran, et l'impression courante.
export const TAILLES_PNG = [600, 1200];

// La boîte du dessin dans le viewBox, mesurée sur les dix-neuf tracés de `logo.svg`.
export const DESSIN = { x: 0, y: 17, largeur: 150, hauteur: 54.38 };

// La hauteur des lettres de SCHOOL (28,47) rapportée à la largeur du logo (150) : 0,19.
// C'est une mesure qui se trouve DANS le logo, donc elle suit sa taille sans qu'on la recalcule.
export const ZONE = 0.19;

// La hauteur des petites lettres de MY et de DIGITAL, la première ligne du logo : ce sont elles
// qui limitent la taille minimale.
const PETITES_LETTRES = 21.4;

// 80 px de large donnent aux petites lettres 11 px de haut, la taille de `.body-tiny`, le plus
// petit texte de lecture du kit. 25 mm donnent 3,6 mm, un corps d'environ 10 pt.
export const TAILLE_MINI = { ecranPx: 80, impressionMm: 25 };

// Les seuils de contraste. Le logo officiel est publié sur blanc, où son turquoise fait 2,39:1 :
// la version couleur n'en demande pas plus de 2. Une version d'une seule couleur porte tout le
// dessin sans seconde couleur pour la soutenir : on lui demande 4,5:1, le seuil du texte.
// WCAG dispense le texte d'un logo de contraste minimal : ces seuils sont ceux de ce site.
export const SEUILS = { couleur: 2, mono: 4.5 };

const BLANC = '#ffffff';

// Les trois versions. `marques` : les couleurs du dessin, dont la plus faible face au fond
// décide ; `seuil` : laquelle des deux exigences s'applique.
export const VERSIONS = [
  { id: 'couleur', nom: 'Couleur', marques: [{ nom: 'turquoise', hex: COULEURS.turquoise }, { nom: 'anthracite', hex: COULEURS.anthracite }], seuil: 'couleur' },
  { id: 'blanc', nom: 'Blanc', marques: [{ nom: 'blanc', hex: BLANC }], seuil: 'mono' },
  { id: 'anthracite', nom: 'Anthracite', marques: [{ nom: 'anthracite', hex: COULEURS.anthracite }], seuil: 'mono' },
];

// ---- Les versions dérivées ----

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const nonCouleur = (valeur) => new Error(`Ce n’est pas une couleur hexadécimale : ${String(valeur)}`);

// Remplace des couleurs de `fill` en UNE passe : un échange (turquoise ↔ anthracite) fait en deux
// passes rendrait tout de la même couleur. La casse de la source est ignorée, celle de la
// destination est gardée telle quelle. `fill="none"` n'est jamais une clé : il n'est pas touché.
export function remplacerCouleurs(svgTexte, table) {
  const par = new Map(Object.entries(table).map(([de, vers]) => {
    if (!HEX.test(de)) throw nonCouleur(de);
    if (!HEX.test(vers)) throw nonCouleur(vers);
    return [de.toLowerCase(), vers];
  }));
  return String(svgTexte).replace(/fill=(["'])(#[0-9a-fA-F]{3,8})\1/g, (entier, guillemet, valeur) => {
    const vers = par.get(valeur.toLowerCase());
    return vers === undefined ? entier : `fill=${guillemet}${vers}${guillemet}`;
  });
}

// Le logo d'une seule couleur : les deux couleurs d'origine deviennent `couleur`.
export function versionMono(svgTexte, couleur) {
  if (typeof couleur !== 'string' || !HEX.test(couleur)) throw nonCouleur(couleur);
  return remplacerCouleurs(svgTexte, { [COULEURS.turquoise]: couleur, [COULEURS.anthracite]: couleur });
}

// ---- Les mesures ----

export function tailleExport(largeur) {
  return { largeur, hauteur: Math.round(largeur / RATIO) };
}

// Le vide à laisser autour du logo, pour un logo de cette largeur, dans la même unité.
export const zoneProtection = (largeur) => largeur * ZONE;

// La plus grande largeur de logo qui tient, avec sa zone de protection, dans un rond de ce
// diamètre : le rectangle (dessin + zone sur chaque côté) est inscrit dans le cercle, donc sa
// diagonale est au plus le diamètre.
export function largeurMaxDansRond(diametre) {
  const largeurUnitaire = 1 + 2 * ZONE;
  const hauteurUnitaire = DESSIN.hauteur / DESSIN.largeur + 2 * ZONE;
  return diametre / Math.hypot(largeurUnitaire, hauteurUnitaire);
}

function canaux(hex) {
  if (!HEX.test(hex)) throw nonCouleur(hex);
  const h = hex.slice(1);
  const plein = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(plein.slice(i, i + 2), 16));
}

// Ce qu'on voit d'une couche de couleur `dessus` posée à `alpha` sur `dessous`.
export function melange(dessus, dessous, alpha) {
  const [a, b] = [canaux(dessus), canaux(dessous)];
  return `#${a.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}

// Le logo d'une version, posé sur un fond uni : le rapport de chacune de ses couleurs face au
// fond, le plus faible, le seuil que la version doit tenir, et le verdict. Le verdict se juge
// sur le rapport exact, l'affichage sur le rapport arrondi au centième.
export function mesureFond(versionId, fondHex) {
  const version = VERSIONS.find((v) => v.id === versionId);
  if (!version) throw new Error(`Version inconnue : ${versionId}`);
  const mesures = version.marques.map((m) => ({ repere: m.nom, rapport: ratio(m.hex, fondHex), exact: ratioExact(m.hex, fondHex) }));
  const faible = mesures.reduce((a, b) => (b.exact < a.exact ? b : a));
  const seuil = SEUILS[version.seuil];
  return { mesures, plusFaible: faible.rapport, repere: faible.repere, seuil, ok: faible.exact >= seuil };
}

// 1,13 · 9,79 · 1,00 : la virgule française, toujours deux décimales.
export const fmtRatio = (valeur) => valeur.toFixed(2).replace('.', ',');
// Un seuil s'écrit comme on le dit : 2:1, 4,5:1.
const fmtSeuil = (valeur) => String(valeur).replace('.', ',');
// « le turquoise », « le blanc », « l’anthracite » : le repère le plus faible, dans une phrase.
const leRepere = (nom) => (/^[aeiouyh]/.test(nom) ? `l’${nom}` : `le ${nom}`);

// ---- Les fonds ----

// Les fonds de la page. Un fond « plat » vient d'un token de `css/tokens.css` : la démonstration
// l'écrit `var(--jeton)`, la mesure lit `hex`, et un test vérifie que les deux disent la même
// chose. Les deux photos n'ont pas de couleur : elles sont dessinées ici, en CSS, et figurent un
// type de photo, pas une photo précise. Elles ne se mesurent pas, elles se jugent.
export const FONDS = [
  { id: 'blanc', nom: 'Blanc', jeton: '--bg-surface', hex: '#ffffff' },
  { id: 'canvas', nom: 'Gris clair de l’outil', jeton: '--bg-canvas', hex: '#f2f4f8' },
  { id: 'violet', nom: 'Violet', jeton: '--brand-primary', hex: '#662483' },
  { id: 'anthracite', nom: 'Anthracite', jeton: '--text-primary', hex: '#3c3c3b' },
  {
    id: 'photo-claire',
    nom: 'Photo claire et calme',
    photo: true,
    versions: ['couleur', 'anthracite'],
    css: 'radial-gradient(circle at 82% 18%, #fff7e3 0, transparent 38%), linear-gradient(165deg, #cfe5f2 0%, #efe7d8 58%, #dfeadb 100%)',
  },
  {
    id: 'photo-chargee',
    nom: 'Photo chargée',
    photo: true,
    versions: [],
    css: 'radial-gradient(circle at 24% 32%, #e63247 0 15%, transparent 16%), radial-gradient(circle at 74% 70%, #2db8c5 0 19%, transparent 20%), radial-gradient(circle at 80% 22%, #faad14 0 11%, transparent 12%), conic-gradient(from 10deg at 36% 44%, #e63247 0 8%, #faad14 8% 16%, #2db8c5 16% 24%, #662483 24% 32%, #47b036 32% 40%, #e71d73 40% 48%, #faad14 48% 56%, #2db8c5 56% 64%, #662483 64% 72%, #e63247 72% 80%, #47b036 80% 88%, #e71d73 88% 100%)',
  },
];

const fond = (id) => FONDS.find((f) => f.id === id);
const cssFond = (f) => (f.jeton ? `var(${f.jeton})` : f.css);

// Les versions que ce fond admet. Pour un aplat, c'est la mesure qui répond ; pour une photo,
// c'est la liste écrite ci-dessus.
export function versionsAdmises(f) {
  return f.photo ? f.versions : VERSIONS.filter((v) => mesureFond(v.id, f.hex).ok).map((v) => v.id);
}

// ---- Les sources ----

// Fabrique les versions dérivées depuis le texte du SVG officiel. `creerUrl` reçoit un texte
// SVG et rend une adresse (dans le navigateur : une URL d'objet). La version couleur n'est pas
// recopiée : c'est le fichier lui-même.
export function preparerSources(svgTexte, creerUrl) {
  const texte = String(svgTexte);
  if (!/viewBox="0 0 150 88"/.test(texte) || !/fill="#2DB8C5"/i.test(texte)) {
    throw new Error('Ce fichier n’est pas le logo officiel : il n’a ni le viewBox 150 × 88 ni le turquoise attendu.');
  }
  return {
    couleur: 'assets/logo.svg',
    blanc: creerUrl(versionMono(texte, BLANC)),
    anthracite: creerUrl(versionMono(texte, COULEURS.anthracite)),
    violet: creerUrl(versionMono(texte, fond('violet').hex)),
  };
}

// ---- Les exports ----

// Dessine le SVG sur un canevas de la taille de `tailleExport(largeur)` et rend le PNG. Le
// canevas est rempli en entier : le vide du fichier est transparent, il n'y a pas de bord blanc.
// `env` : ce dont la fonction a besoin du navigateur, pour qu'un test lui en donne un faux.
export function fabriquerPng(urlSvg, largeur, env = globalThis) {
  const { largeur: l, hauteur: h } = tailleExport(largeur);
  return new Promise((resolve, reject) => {
    const image = new env.Image();
    image.onerror = () => reject(new Error('Le navigateur n’a pas pu lire l’image du logo.'));
    image.onload = () => {
      try {
        const canevas = env.document.createElement('canvas');
        canevas.width = l;
        canevas.height = h;
        const contexte = canevas.getContext('2d');
        if (!contexte) throw new Error('Le navigateur n’a pas fourni de canevas (contexte 2D).');
        contexte.drawImage(image, 0, 0, l, h);
        canevas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Le navigateur n’a pas pu produire le PNG.'))), 'image/png');
      } catch (erreur) { reject(erreur); }
    };
    image.src = urlSvg;
  });
}

// Le geste de téléchargement : un lien posé le temps d'un clic. Seule fonction du module qui
// touche vraiment le document, avec `fabriquerPng` — et elle est vérifiée dans un navigateur.
export function telechargerBlob(blob, nom, doc = document, api = URL) {
  const url = api.createObjectURL(blob);
  const lien = doc.createElement('a');
  lien.href = url;
  lien.download = nom;
  doc.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => api.revokeObjectURL(url), 1000);
}

// Branche les boutons « PNG » de la page. Un seul écouteur sur la racine : les boutons sont
// posés par `pageHtml`, ils n'existent pas encore quand la page se charge. Le message d'échec
// dit quoi faire (le SVG marche toujours) et n'affiche pas l'exception brute.
export function brancherExports(racine, sources, { fabriquer = fabriquerPng, telecharger = telechargerBlob } = {}) {
  racine.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('[data-export-png]');
    if (!bouton) return;
    const { version } = bouton.dataset;
    const largeur = Number(bouton.dataset.largeur);
    // Seules les versions et les largeurs que la page propose : un attribut modifié à la main
    // dans l'inspecteur ne fabrique pas un PNG de 99 999 px.
    if (!VERSIONS.some((v) => v.id === version) || !Object.hasOwn(sources, version) || !TAILLES_PNG.includes(largeur)) return;
    const statut = racine.querySelector('[data-export-statut]');
    const dire = (message) => { if (statut) statut.textContent = message; };
    const nom = `mds-logo-${version}-${largeur}.png`;
    dire(`Fabrication de ${nom}…`);
    try {
      telecharger(await fabriquer(sources[version], largeur), nom);
      dire(`${nom} est téléchargé.`);
    } catch {
      dire('Ce navigateur n’a pas pu fabriquer le PNG. Téléchargez le SVG : il fonctionne partout et se redimensionne sans perte.');
    }
  });
}

// ---- Les démonstrations ----

// Une démonstration : un cadre qui porte son fond, et le logo dedans. Le cadre est une image
// pour les lecteurs d'écran (`role="img"` et son nom) : le texte qui l'explique est ailleurs,
// dans la légende. Le fond est posé en ligne parce que c'est une DONNÉE de la démonstration
// (la mesure lit la même), et qu'aucun texte n'est jamais posé dessus.
//
// `l` est la largeur du logo, en `cqw` : une part de la largeur du cadre, qui est un conteneur.
// Les deux démonstrations d'un même interdit ont donc le même `l`, et leur comparaison tient
// à toutes les largeurs.
function scene({ fondId, version, src, nom, l = '68cqw', logo = '', dedans = null, classe = '', style = '' }) {
  const f = fond(fondId);
  const image = `<img class="lg-logo" src="${src}" alt="" style="--l:${l};${logo}">`;
  return `<div class="lg-scene${classe ? ` ${classe}` : ''}" role="img" aria-label="${echapper(nom)}" data-fond="${f.id}" data-version="${version}" style="background:${cssFond(f)};${style}">${dedans === null ? image : dedans(image)}</div>`;
}

// La paire de démonstrations d'un interdit, ou une carte de la page : une figure et sa légende.
function cas(sorte, scene_, legende, apres = '') {
  const faux = sorte === 'faux';
  return `<figure class="lg-cas lg-cas--${sorte}">
  ${scene_}
  <figcaption class="lg-cas__legende body-sm">
    <span class="lg-cas__marque" aria-hidden="true">${faux ? '✕' : '✓'}</span>
    <span><strong>${faux ? 'À ne pas faire' : 'À faire'}</strong>&nbsp;: ${legende}</span>
  </figcaption>${apres ? `\n  ${apres}` : ''}
</figure>`;
}

// Les nombres que les raisons citent : calculés ici, depuis les mêmes constantes que le reste.
const VIOLET = fond('violet').hex;
const TURQUOISE_PLEIN = COULEURS.turquoise;
const VOILE = 0.8;
const PIRE_CAS_VOILE = ratio(BLANC, melange(COULEURS.anthracite, BLANC, VOILE));
const PART_DANS_ROND = Math.floor(largeurMaxDansRond(100));
const pct = (x) => `${x}&nbsp;%`;

// La coupe du logo en trois morceaux, pour la démonstration de « réarranger » : l'hémisphère
// gauche, le nom, l'hémisphère droit, en parts de la largeur du dessin.
const COUPE = { gauche: 27.12 / DESSIN.largeur, droite: 122.88 / DESSIN.largeur };
const morceau = (de, a, src) => `<span class="lg-piece" style="--de:${de.toFixed(3)};--a:${a.toFixed(3)}"><img class="lg-logo" src="${src}" alt=""></span>`;

// Les neuf interdits, dans l'ordre de la spec. Chacun : un titre, la raison qui fait appliquer
// la règle, et les deux démonstrations. La raison dit POURQUOI, pas seulement quoi : c'est ce
// qu'une personne retient, et ce qui lui permet de trancher un cas que la page n'a pas prévu.
export const INTERDITS = [
  {
    id: 'etirer',
    titre: 'Ne l’étirez pas',
    raison: 'Les lettres du logo sont dessinées hautes et étroites. Étirées ou écrasées, elles deviennent un autre alphabet, et les deux hémisphères cessent d’être ronds. Pour changer sa taille, fixez la largeur et laissez la hauteur se calculer : <code>height: auto</code>.',
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo étiré en largeur : plus large qu’il ne devrait l’être', l: '92cqw', logo: 'aspect-ratio:230 / 100;object-fit:fill;' }), 'étiré en largeur', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo avec ses proportions d’origine' }), 'proportions gardées', ''),
    }),
  },
  {
    id: 'recolorer',
    titre: 'Ne le recolorez pas',
    raison: 'Dans le logo, le turquoise est la seule couleur qui ne soit pas un gris sombre : c’est elle qu’on reconnaît. Une autre teinte, même le violet de nos outils, et c’est le logo d’une autre école. Quand la couleur est impossible, il existe deux versions d’une seule couleur : le blanc et l’anthracite.',
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'blanc', version: 'violet', src: s.violet, nom: 'Le logo entièrement en violet' }), 'repeint en violet', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo dans ses couleurs d’origine' }), 'turquoise et anthracite', ''),
    }),
  },
  {
    id: 'ombre',
    titre: 'Pas d’ombre portée',
    raison: 'Le logo est un aplat : deux teintes, des bords nets. Une ombre lui ajoute une troisième teinte et un flou, que la sérigraphie, la gravure et la broderie ne savent pas reproduire. S’il ne se détache pas du fond, c’est le fond qu’il faut changer, pas le logo.',
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo avec une ombre portée', logo: 'filter:drop-shadow(1.6cqw 2.4cqw 1.6cqw rgba(0, 0, 0, 0.55));' }), 'avec une ombre', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo à plat, sans ombre' }), 'à plat', ''),
    }),
  },
  {
    id: 'contraste',
    titre: 'Pas sur un fond qui l’efface',
    raison: `Un logo qu’on ne distingue pas n’identifie personne. La règle est mesurée : chaque couleur du logo couleur doit se détacher du fond d’au moins ${SEUILS.couleur}:1, et ${fmtSeuil(SEUILS.mono)}:1 pour une version d’une seule couleur. Posé sur le violet, l’anthracite du logo couleur tombe à ${fmtRatio(mesureFond('couleur', VIOLET).plusFaible)}:1 : il disparaît.`,
    mesures: () => [
      { version: 'couleur', fond: VIOLET, texte: 'Logo couleur sur le violet' },
      { version: 'couleur', fond: TURQUOISE_PLEIN, texte: 'Logo couleur sur le turquoise' },
      { version: 'blanc', fond: VIOLET, texte: 'Logo blanc sur le violet' },
    ],
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'violet', version: 'couleur', src: s.couleur, nom: 'Le logo couleur sur un fond violet : l’anthracite s’y perd' }), 'logo couleur sur violet', ''),
      juste: cas('juste', scene({ fondId: 'violet', version: 'blanc', src: s.blanc, nom: 'Le logo blanc sur le même fond violet' }), 'logo blanc sur violet', ''),
    }),
  },
  {
    id: 'photo',
    titre: 'Pas sur une photo chargée',
    raison: `Sur une photo chargée il n’y a pas de fond : il y en a cent. Les deux couleurs du logo croisent des détails de toutes les teintes et les lettres fines s’y perdent. Assombrissez la photo d’un voile anthracite à ${pct(Math.round(VOILE * 100))}, puis posez la version blanche : même sur la partie la plus claire possible de la photo, du blanc pur, le logo blanc garde ${fmtRatio(PIRE_CAS_VOILE)}:1.`,
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'photo-chargee', version: 'couleur', src: s.couleur, nom: 'Le logo couleur posé directement sur une photo très chargée' }), 'logo couleur sur la photo', ''),
      juste: cas('juste', scene({
        fondId: 'photo-chargee',
        version: 'blanc',
        src: s.blanc,
        nom: 'La même photo, assombrie d’un voile, avec le logo blanc',
        dedans: (image) => `<div class="lg-voile" style="background:rgba(60, 60, 59, ${VOILE})"></div>${image}`,
      }), 'photo voilée, logo blanc', ''),
    }),
  },
  {
    id: 'pivoter',
    titre: 'Ne le penchez pas',
    raison: 'Le logo se lit comme une enseigne : une horizontale, deux hémisphères à la même hauteur. Penché, il ressemble à un tampon ou à un autocollant, et il ne s’aligne plus sur rien dans la page. Si la mise en page est en diagonale, c’est elle qui bouge, pas le logo.',
    demo: (s) => ({
      faux: cas('faux', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo penché de douze degrés', logo: 'transform:rotate(-12deg);' }), 'penché', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo à l’horizontale' }), 'à l’horizontale', ''),
    }),
  },
  {
    id: 'reorganiser',
    titre: 'Ne déplacez pas ses éléments',
    raison: 'Le nom est encadré par les deux moitiés du cerveau, l’une anthracite, l’autre turquoise : c’est cet assemblage qu’on reconnaît. Séparé, recomposé en colonne ou mis à l’envers, c’est un autre logo, que la marque n’a pas dessiné. Il n’existe qu’une seule composition.',
    demo: (s) => ({
      faux: cas('faux', scene({
        fondId: 'blanc',
        version: 'couleur',
        src: s.couleur,
        nom: 'Le logo recomposé : le nom au-dessus, les deux hémisphères séparés en dessous',
        l: '56cqw',
        dedans: () => `<div class="lg-recompose" style="--l:56cqw">${morceau(COUPE.gauche, COUPE.droite, s.couleur)}<div class="lg-recompose__ligne">${morceau(0, COUPE.gauche, s.couleur)}${morceau(COUPE.droite, 1, s.couleur)}</div></div>`,
      }), 'recomposé', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo dans sa composition d’origine', l: '56cqw' }), 'composition d’origine', ''),
    }),
  },
  {
    id: 'forme',
    titre: 'Ne l’enfermez pas dans une forme',
    raison: `Les deux hémisphères sont déjà la silhouette du logo. Un rond, un carré ou une pastille autour lui oppose une seconde silhouette, et rogne la zone de protection. Pour un avatar rond que la plateforme découpe, posez le logo sur un fond uni, à ${pct(PART_DANS_ROND)} du diamètre au plus : à cette taille, sa zone de protection tient encore dans le rond.`,
    demo: (s) => ({
      faux: cas('faux', scene({
        fondId: 'blanc',
        version: 'couleur',
        src: s.couleur,
        nom: 'Le logo enfermé dans un rond, dont il touche le bord',
        dedans: () => `<div class="lg-forme" style="--d:50cqw;background:var(--bg-muted);border-radius:50%"><img class="lg-logo" src="${s.couleur}" alt="" style="--l:50cqw"></div>`,
      }), 'enfermé dans un rond', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo libre, sans forme autour' }), 'libre, sans forme', ''),
    }),
  },
  {
    id: 'contour',
    titre: 'Pas de contour',
    raison: 'Un trait autour des lettres les épaissit et comble les ouvertures des plus petites, celles de MY et de DIGITAL. Le logo est dessiné pour tenir seul, sans cadre ni trait. S’il a besoin d’être détaché du fond, changez de fond ou de version.',
    demo: (s) => ({
      faux: cas('faux', scene({
        fondId: 'blanc',
        version: 'couleur',
        src: s.couleur,
        nom: 'Le logo cerné d’un trait violet',
        logo: 'filter:drop-shadow(0.9cqw 0 0 var(--brand-primary)) drop-shadow(-0.9cqw 0 0 var(--brand-primary)) drop-shadow(0 0.9cqw 0 var(--brand-primary)) drop-shadow(0 -0.9cqw 0 var(--brand-primary));',
      }), 'avec un contour', ''),
      juste: cas('juste', scene({ fondId: 'blanc', version: 'couleur', src: s.couleur, nom: 'Le logo sans contour' }), 'sans contour', ''),
    }),
  },
];

// ---- Les morceaux de la page ----

const lien = (href, texte) => `<a class="ds-lien-texte" href="${href}">${texte}</a>`;

function heroHtml(s) {
  return `<section class="ds-hero">
  <div class="ds-hero__section lg-hero">
    <div class="lg-hero__texte">
      <h1 class="ds-titre-page">Le logo</h1>
      <p class="ds-chapeau ds-mesure">Une seule forme, trois versions, neuf interdits. Chacun est montré, puis expliqué.</p>
    </div>
    <img class="lg-logo lg-hero__logo" src="${s.couleur}" alt="Logo MyDigitalSchool" style="width:min(100%, 440px)">
  </div>
</section>`;
}

// La réserve : dite en haut de la page, avant la première section, pas seulement dans le pied.
function reserveHtml() {
  return `<div class="ds-bande">
  <div class="ds-section lg-reserve">
    <aside class="ds-message">
      <p class="body-bold">Ces règles ne sont pas une charte officielle.</p>
      <p class="body">Elles ont été construites pour ce site. Personne du côté de la marque ne les a validées. Le fichier du logo est celui de mydigitalschool.com&nbsp;; les versions blanche et anthracite, elles, sont fabriquées ici, en remplaçant les deux couleurs du fichier officiel.</p>
      <p class="body">Ce site est public, ses fichiers sont servis publiquement&nbsp;: ne le citez pas comme une règle de la marque.</p>
    </aside>
  </div>
</div>`;
}

function exportHtml(v, s) {
  const nom = v.nom.toLowerCase();
  const png = TAILLES_PNG.map((l) => `<button type="button" class="lg-telecharger label-md" data-export-png data-version="${v.id}" data-largeur="${l}">PNG ${l}&nbsp;px<span class="visually-hidden"> du logo ${nom}</span></button>`).join('\n      ');
  return `<div class="lg-export">
      <a class="lg-telecharger label-md" href="${s[v.id]}" download="mds-logo-${v.id}.svg">SVG<span class="visually-hidden"> du logo ${nom}</span></a>
      ${png}
    </div>`;
}

const PRESENTATION = {
  couleur: { fond: 'blanc', phrase: 'La version par défaut, sur fond clair. Turquoise et anthracite, comme sur mydigitalschool.com.' },
  blanc: { fond: 'violet', phrase: 'Sur un fond sombre ou coloré&nbsp;: le violet, l’anthracite, une photo assombrie.' },
  anthracite: { fond: 'blanc', phrase: 'Quand il n’y a qu’une encre&nbsp;: photocopie, tampon, gravure, impression en une couleur.' },
};

function versionsHtml(s) {
  const cartes = VERSIONS.map((v) => `<article class="lg-version" id="version-${v.id}">
    ${scene({ fondId: PRESENTATION[v.id].fond, version: v.id, src: s[v.id], nom: `Le logo, version ${v.nom.toLowerCase()}`, l: '58cqw' })}
    <h3 class="h6">${v.nom}</h3>
    <p class="body-sm ds-oeil">${PRESENTATION[v.id].phrase}</p>
    ${exportHtml(v, s)}
  </article>`).join('\n  ');
  return `<section class="ds-bande" id="versions">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Trois versions</h2>
      <p class="ds-chapeau">Choisissez selon le fond. Fond clair&nbsp;: la couleur. Fond sombre ou coloré&nbsp;: le blanc. Une seule encre&nbsp;: l’anthracite.</p>
    </div>
    <div class="ds-grille ds-grille--3">
  ${cartes}
    </div>
    <div class="ds-mesure lg-notes">
      <p class="body-sm ds-oeil">Les PNG sont fabriqués par votre navigateur au moment du clic, à partir du SVG&nbsp;: fond transparent, ${TAILLES_PNG.join(' ou ').replace(/(\d+)/g, '$1&nbsp;px')} de large. Pour imprimer, préférez le SVG, qui se redimensionne sans perte.</p>
      <p class="body-sm ds-oeil" role="status" data-export-statut></p>
    </div>
  </div>
</section>`;
}

function zoneHtml(s) {
  const exemples = [120, 240, 480].map((l) => `<li class="body-sm">Logo de ${l}&nbsp;px de large, ${Math.round(zoneProtection(l))}&nbsp;px de vide.</li>`).join('');
  const zone = scene({
    fondId: 'blanc',
    version: 'couleur',
    src: s.couleur,
    nom: `Le logo entouré de sa zone de protection, une bande de ${Math.round(ZONE * 100)} % de sa largeur sur chaque côté`,
    classe: 'lg-scene--zone',
    dedans: () => `<div class="lg-zone" style="--l:54cqw;--z:${ZONE}"><div class="lg-zone__dessin"><img class="lg-logo" src="${s.couleur}" alt="" style="--l:54cqw"></div></div>`,
  });
  return `<section class="ds-bande ds-bande--doux" id="zone">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Laissez-lui de l’air</h2>
      <p class="ds-chapeau">Rien ne s’approche à moins d’une lettre de SCHOOL&nbsp;: ${pct(Math.round(ZONE * 100))} de sa largeur, sur les quatre côtés.</p>
    </div>
    <div class="ds-grille ds-grille--2 lg-zone-grille">
      <figure class="lg-cas lg-cas--zone">
        ${zone}
        <figcaption class="body-sm ds-oeil">La bande colorée est la zone de protection. Ni texte, ni image, ni bord de page, ni autre logo n’y entre.</figcaption>
      </figure>
      <div class="lg-zone-texte">
        <p class="body">Cette mesure est dans le logo lui-même&nbsp;: elle suit sa taille, à toutes les échelles.</p>
        <ul class="ds-liste">${exemples}</ul>
        <p class="body-sm ds-oeil">On mesure depuis le dessin, pas depuis le bord du fichier. Le SVG et les PNG ont déjà du vide en haut et en bas, près d’un cinquième de leur hauteur de chaque côté, et aucun sur les côtés.</p>
      </div>
    </div>
  </div>
</section>`;
}

function taillesHtml(s) {
  const px = Math.round((PETITES_LETTRES / DESSIN.largeur) * TAILLE_MINI.ecranPx);
  const mm = ((PETITES_LETTRES / DESSIN.largeur) * TAILLE_MINI.impressionMm).toFixed(1).replace('.', ',');
  const montre = (largeurCss, nom) => scene({
    fondId: 'blanc',
    version: 'couleur',
    src: s.couleur,
    nom,
    classe: 'lg-scene--taille',
    dedans: () => `<img class="lg-logo" src="${s.couleur}" alt="" style="width:${largeurCss}">`,
  });
  return `<section class="ds-bande" id="tailles">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Pas plus petit que ça</h2>
      <p class="ds-chapeau">À l’écran&nbsp;: ${TAILLE_MINI.ecranPx}&nbsp;px de large. À l’impression&nbsp;: ${TAILLE_MINI.impressionMm}&nbsp;mm de large.</p>
    </div>
    <div class="ds-grille ds-grille--2">
      <figure class="lg-cas lg-cas--juste">
        ${montre(`${TAILLE_MINI.ecranPx}px`, `Le logo à sa taille minimale à l’écran, ${TAILLE_MINI.ecranPx} pixels de large`)}
        <figcaption class="lg-cas__legende body-sm"><span class="lg-cas__marque" aria-hidden="true">✓</span><span><strong>Écran</strong>&nbsp;: ${TAILLE_MINI.ecranPx}&nbsp;px de large</span></figcaption>
      </figure>
      <figure class="lg-cas lg-cas--juste">
        ${montre(`${TAILLE_MINI.impressionMm}mm`, `Le logo à sa taille minimale imprimée, ${TAILLE_MINI.impressionMm} millimètres de large`)}
        <figcaption class="lg-cas__legende body-sm"><span class="lg-cas__marque" aria-hidden="true">✓</span><span><strong>Impression</strong>&nbsp;: ${TAILLE_MINI.impressionMm}&nbsp;mm de large</span></figcaption>
      </figure>
    </div>
    <p class="body ds-mesure lg-lecture">À ${TAILLE_MINI.ecranPx}&nbsp;px de large, les petites lettres de MY et de DIGITAL font ${px}&nbsp;px de haut, ${mm}&nbsp;mm à l’impression. C’est la taille de <code>.body-tiny</code>, le plus petit texte de lecture de nos interfaces&nbsp;: le logo ne descend pas sous le plus petit texte qui l’accompagne.</p>
  </div>
</section>`;
}

function fondsHtml(s) {
  const cartes = FONDS.map((f) => {
    const admises = versionsAdmises(f);
    const version = admises[0] || 'couleur';
    const bon = admises.length > 0;
    const v = VERSIONS.find((x) => x.id === version);
    let detail;
    if (f.photo) {
      detail = bon
        ? 'Logo couleur ou anthracite, sur une zone calme de la photo. Se juge, ne se mesure pas.'
        : `Refusée, même avec la version couleur. ${lien('#interdit-photo', 'Voir l’interdit 5')}.`;
    } else {
      const m = mesureFond(version, f.hex);
      detail = `Le plus faible, ${leRepere(m.repere)}&nbsp;: ${fmtRatio(m.plusFaible)}:1, pour un seuil de ${fmtSeuil(m.seuil)}:1.`;
    }
    const liste = f.photo ? '' : ` Versions admises&nbsp;: ${admises.map((id) => VERSIONS.find((x) => x.id === id).nom.toLowerCase()).join(', ')}.`;
    return cas(bon ? 'juste' : 'faux', scene({ fondId: f.id, version, src: s[version], nom: `Le logo, version ${v.nom.toLowerCase()}, sur le fond ${f.nom.toLowerCase()}`, l: '52cqw' }), `version ${v.nom.toLowerCase()}`,
      `<div class="lg-fond"><p class="body-sm"><strong>${f.nom}</strong></p>\n  <p class="body-sm ds-oeil">${detail}${liste}</p></div>`);
  }).join('\n    ');
  return `<section class="ds-bande ds-bande--frais" id="fonds">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Sur quoi le poser</h2>
      <p class="ds-chapeau">Là où ses couleurs se détachent du fond. Sur un aplat, on le mesure&nbsp;; sur une photo, on le juge.</p>
      <p class="body">La mesure est un contraste, comme pour du texte&nbsp;: chaque couleur du logo face au fond. Le logo couleur doit tenir au moins ${SEUILS.couleur}:1&nbsp;; son turquoise fait ${fmtRatio(ratio(COULEURS.turquoise, BLANC))}:1 sur blanc, le fond où la marque le publie. Une version d’une seule couleur doit tenir ${fmtSeuil(SEUILS.mono)}:1, le seuil du texte. WCAG dispense le texte d’un logo de contraste minimal&nbsp;: ces seuils sont ceux de ce site.</p>
    </div>
    <div class="ds-grille ds-grille--3">
    ${cartes}
    </div>
    <p class="body-sm ds-oeil ds-mesure lg-lecture">Les deux photos sont dessinées en CSS&nbsp;: elles figurent un type de photo, pas une photo précise.</p>
  </div>
</section>`;
}

function interditHtml(interdit, rang, s) {
  const { faux, juste } = interdit.demo(s);
  const mesures = interdit.mesures
    ? `<ul class="lg-mesures body-sm">${interdit.mesures().map((m) => {
      const r = mesureFond(m.version, m.fond);
      return `<li><span aria-hidden="true">${r.ok ? '✓' : '✕'}</span> ${m.texte}&nbsp;: ${leRepere(r.repere)} fait ${fmtRatio(r.plusFaible)}:1, ${r.ok ? 'au-dessus du' : 'sous le'} seuil de ${fmtSeuil(r.seuil)}:1.</li>`;
    }).join('')}</ul>`
    : '';
  return `<li><article class="lg-interdit" id="interdit-${interdit.id}">
  <h3 class="h6"><span class="lg-num" aria-hidden="true">${rang}</span> ${interdit.titre}</h3>
  <div class="lg-paire">
    ${faux}
    ${juste}
  </div>
  <p class="body-sm lg-raison">${interdit.raison}</p>
  ${mesures}
</article></li>`;
}

function interditsHtml(s) {
  return `<section class="ds-bande" id="interdits">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Neuf interdits</h2>
      <p class="ds-chapeau">Chacun est montré, avec ce qu’il faut faire à la place. Retenez la raison&nbsp;: c’est elle qui dit quoi faire dans les cas que cette page n’a pas prévus.</p>
    </div>
    <ol class="lg-interdits ds-grille ds-grille--3">
  ${INTERDITS.map((i, n) => interditHtml(i, n + 1, s)).join('\n  ')}
    </ol>
  </div>
</section>`;
}

function douteHtml() {
  return `<section class="ds-bande ds-bande--doux" id="doute">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre">Un doute&nbsp;?</h2>
      <p class="ds-chapeau">Posez-vous une seule question&nbsp;: le logo se reconnaît-il d’un coup d’œil&nbsp;? Si la réponse n’est pas oui, changez de fond ou de version.</p>
      <p class="body">Les fichiers, dans tous leurs formats, sont réunis dans ${lien('ressources.html', 'Ressources')}.</p>
    </div>
  </div>
</section>`;
}

// Le contenu de `<main>`. `sources` : où trouver chaque version. Rend une chaîne, sans toucher
// au document : la page la pose, puis appelle `brancherExports`.
export function pageHtml(sources) {
  for (const cle of ['couleur', 'blanc', 'anthracite', 'violet']) {
    if (!sources || typeof sources[cle] !== 'string' || !sources[cle]) throw new Error(`Source manquante pour la version « ${cle} »`);
  }
  return [heroHtml(sources), reserveHtml(), versionsHtml(sources), zoneHtml(sources), taillesHtml(sources), fondsHtml(sources), interditsHtml(sources), douteHtml()].join('\n');
}
