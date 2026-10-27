// La dette de contraste du kit, publiée telle qu'elle est.
//
// Le 26 octobre 2026, il a été décidé de publier les chiffres de contraste réels du kit et de
// nommer les paires qui échouent, plutôt que de corriger la palette d'un prototype qui tourne ou
// de taire le problème. Ce module porte cette décision : il liste les paires, les mesure, et
// écrit le tableau. Il ne corrige rien. Corriger la palette revient à l'école, dans Figma ;
// `docs/correctifs-figma.md` tient la file d'attente.
//
// ## Ce qu'est une paire ici
//
// Une paire est un texte et un fond que `css/components.css` FORME réellement : un sélecteur dont
// la règle pose `color: var(--texte)`, et un fond posé par la même règle ou par la surface qui le
// porte. Rien n'est publié qui ne soit formé par le code : `tests/ds-dette.test.mjs` retrouve
// chaque paire dans la feuille, et retrouve dans les vues le HTML qui l'émet. Une seule exception,
// dite sur sa ligne : la carte KPI neutre, que le kit définit et que le tableau de bord n'émet pas.
//
// Chaque paire dit :
//   nom        l'identifiant que la page et le registre emploient (une classe, ou un sélecteur)
//   famille    'badge', 'kpi', 'tableau', 'alerte', 'bouton' ou 'notification' : le bloc où elle apparaît
//   texte/fond les NOMS de tokens, jamais leurs valeurs : elles sont lues dans `tokens.css`
//   elements   les éléments de la feuille qui forment la paire, avec leur taille réelle
//   px, gras   la taille la plus exigeante de ces éléments : la plus petite, et gras seulement
//              si tous le sont. C'est elle qui décide du seuil.
//
// ## Le verdict se juge sur le rapport exact
//
// `ratio` arrondit au centième pour l'AFFICHAGE. Un 4,4998 s'arrondit à 4,50 et passerait pour
// conforme : le verdict part donc de `ratioExact`, et l'affichage montre une décimale de plus
// quand l'arrondi ferait mentir le verdict.

import { echapper } from './texte.js';
import { ratio, ratioExact, verdict, GRAND_TEXTE } from './contraste.js';

export const DATE_CONSTAT = { iso: '2026-10-26', texte: '26 octobre 2026' };

// Les seuils de WCAG 2.1, niveau AA.
const SEUIL_TEXTE = 4.5;
const SEUIL_GRAND_TEXTE = 3;

// Les tons que ce module propose ne visent pas le seuil : ils visent le seuil plus cette marge. Le
// premier ton qui passe serait une limite, pas un conseil : quiconque y touche ensuite retomberait
// sous le seuil. La marge dit aussi dans quel sens on a le droit de bouger : on peut éclaircir
// un repère tant qu'il reste au-dessus du seuil, jamais en dessous.
export const MARGE_CONSEIL = 0.3;
export const CIBLE_CONSEIL = SEUIL_TEXTE + MARGE_CONSEIL;

// ---- Les paires ----

const KPI_ELEMENTS = [
  { selecteur: '.kpi__label', px: 14, gras: false },
  { selecteur: '.kpi__delta', px: 12, gras: false },
];

// Les badges, du plus faible au meilleur : une dette se lit en commençant par ce qui est pire.
const badge = (variante, libelle) => ({
  nom: `badge--${variante}`,
  famille: 'badge',
  libelle,
  texte: `--status-${variante}-fg`,
  fond: `--status-${variante}-bg`,
  px: 11,
  gras: true,
  elements: [{ selecteur: '.badge', px: 11, gras: true }],
});

// Une carte KPI : le texte discret du kit, sur le fond de la carte. La variation et le libellé ont
// la même couleur et des tailles différentes ; aucune des deux n'est un grand texte.
const kpi = (nom, libelle, fond, echantillon, note) => ({
  nom,
  famille: 'kpi',
  libelle,
  texte: '--text-secondary',
  fond,
  px: 12,
  gras: false,
  elements: KPI_ELEMENTS,
  echantillon,
  ...(note ? { note } : {}),
});

export const PAIRES_KIT = [
  { ...badge('maintenance', 'Maintenance'), existant: '--status-maintenance-text', existantNote: 'Le kit l’a déjà : l’alerte d’avertissement l’emploie, le badge non.' },
  badge('available', 'Disponible'),
  badge('reserved', 'Réservé'),
  badge('hs', 'Hors service'),
  badge('late', 'En retard'),
  badge('borrowed', 'Emprunté'),

  kpi('kpi', 'Carte neutre', '--bg-muted',
    { libelle: 'Matériel disponible', variation: 'exemplaires prêts à être empruntés' },
    'L’outil d’emprunt n’emploie pas cette carte aujourd’hui : son tableau de bord pose toujours une teinte. Le kit la définit.'),
  kpi('kpi--retard', 'Carte retards', '--status-late-bg',
    { libelle: 'Retards', variation: 'à relancer' }),
  kpi('kpi--emprunte', 'Carte emprunts', '--status-borrowed-bg',
    { libelle: 'Emprunts en cours', variation: '2 remises prévues aujourd’hui' }),
  kpi('kpi--salle', 'Carte salle', '--status-reserved-bg',
    { libelle: 'Réservations salle à venir', variation: '1 signalement à traiter' }),
  kpi('kpi--disponible', 'Carte disponible', '--status-available-bg',
    { libelle: 'Matériel disponible', variation: 'exemplaires prêts à être empruntés' }),

  // Les retours : alertes, bouton de danger, notifications. Du plus faible au meilleur, comme le reste.
  // Les échantillons reprennent des textes que les vues écrivent vraiment (un test les y retrouve).
  {
    nom: 'toast--success',
    famille: 'notification',
    libelle: 'Notification de succès',
    texte: '--text-inverse',
    fond: '--feedback-success',
    px: 14,
    gras: true,
    elements: [{ selecteur: '.toast', px: 14, gras: true }],
    echantillon: { texte: 'Réglages enregistrés' },
  },
  {
    nom: 'alert--info',
    famille: 'alerte',
    libelle: 'Alerte d’information',
    texte: '--status-reserved-fg',
    fond: '--brand-secondary-subtle',
    px: 14,
    gras: false,
    elements: [{ selecteur: '.alert', px: 14, gras: false }],
    echantillon: { texte: 'Le matériel se retire au bureau des pédago' },
  },
  {
    nom: 'alert--error',
    famille: 'alerte',
    libelle: 'Alerte d’erreur',
    texte: '--status-late-fg',
    fond: '--status-late-bg',
    px: 14,
    gras: false,
    elements: [{ selecteur: '.alert', px: 14, gras: false }],
    echantillon: { texte: 'Réservation refusée' },
  },
  {
    nom: 'btn--danger',
    famille: 'bouton',
    libelle: 'Bouton de danger',
    texte: '--text-inverse',
    fond: '--feedback-error',
    px: 12,
    gras: true,
    elements: [{ selecteur: '.btn', px: 14, gras: true }, { selecteur: '.btn--sm', px: 12, gras: true }],
    existant: '--feedback-error-hover',
    existantRole: 'fond',
    existantNote: 'Le kit l’a déjà : c’est le fond du bouton de danger au survol. Le bouton serait alors identique à son état survolé et n’aurait plus de retour : il faut aussi assombrir l’état survolé.',
    echantillon: { texte: 'Annuler la réservation' },
  },
  {
    nom: 'toast--error',
    famille: 'notification',
    libelle: 'Notification d’erreur',
    texte: '--text-inverse',
    fond: '--feedback-error',
    px: 14,
    gras: true,
    elements: [{ selecteur: '.toast', px: 14, gras: true }],
    existant: '--feedback-error-hover',
    existantRole: 'fond',
    existantNote: 'Le kit l’a déjà : c’est le fond du bouton de danger au survol.',
    echantillon: { texte: 'Date invalide.' },
  },

  {
    nom: 'table th',
    famille: 'tableau',
    libelle: 'En-tête de colonne',
    texte: '--text-secondary',
    fond: '--bg-surface',
    px: 11,
    gras: true,
    elements: [{ selecteur: '.table th', px: 11, gras: true }],
    echantillon: { texte: 'Retour prévu', majuscules: true },
  },
  {
    nom: 'table tr:hover',
    famille: 'tableau',
    libelle: 'Texte discret, ligne survolée',
    texte: '--text-secondary',
    fond: '--bg-canvas',
    px: 11,
    gras: false,
    elements: [{ selecteur: '.body-tiny.text-secondary', px: 11, gras: false }],
    echantillon: { texte: '3 jours' },
  },
];

// ---- Les mesures ----

const virgule = (nombre, decimales) => nombre.toFixed(decimales).replace('.', ',');

function seuilDe(paire) {
  const grand = paire.px >= GRAND_TEXTE.px || (paire.gras && paire.px >= GRAND_TEXTE.pxGras);
  return grand ? SEUIL_GRAND_TEXTE : SEUIL_TEXTE;
}

// Le rapport tel qu'on l'écrit. Au centième, sauf quand l'arrondi atteindrait le seuil alors que
// le rapport exact ne l'atteint pas : « 4,50 » à côté d'un échec se contredirait, on montre alors
// la troisième décimale, tronquée et non arrondie.
export function afficherRatio(exact, arrondi, seuil) {
  if (exact < seuil && arrondi >= seuil) return virgule(Math.floor(exact * 1000) / 1000, 3);
  return virgule(arrondi, 2);
}

export function jugerPaire(paire, valeurs) {
  const texte = valeurs[paire.texte];
  const fond = valeurs[paire.fond];
  const exact = ratioExact(texte, fond);
  const seuil = seuilDe(paire);
  const v = verdict(exact, paire.px, paire.gras);
  return { exact, seuil, verdict: v, echoue: v === 'echec', affiche: afficherRatio(exact, ratio(texte, fond), seuil) };
}

// Le nombre tel qu'on le dit, de zéro à vingt. Au-delà, des chiffres.
const EN_LETTRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt'];
export const enLettres = (n) => (EN_LETTRES[n] === undefined ? String(n) : EN_LETTRES[n]);

// ---- Ce qu'il faudrait faire ----

function hexDepuis([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
}

function enHsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}

function enRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

// Le ton le plus clair, de la même teinte et de la même saturation, qui atteint `cible` face à
// `contre` : on garde la teinte et on baisse la luminosité par pas de 0,2 %. `couleur` doit déjà
// être la plus sombre des deux. C'est un REPÈRE, pas un choix : la couleur retenue se décide
// dans Figma.
function foncer(couleur, contre, cible) {
  if (ratioExact(couleur, contre) >= cible) return couleur;
  if (ratioExact(couleur, '#ffffff') <= ratioExact(contre, '#ffffff')) {
    throw new Error('Il n’y a rien à foncer : la couleur n’est pas la plus sombre des deux');
  }
  const [h, s, l] = enHsl(couleur);
  for (let luminosite = l; luminosite >= 0; luminosite -= 0.002) {
    const ton = hexDepuis(enRgb([h, s, luminosite]));
    if (ratioExact(ton, contre) >= cible) return ton;
  }
  throw new Error(`Aucun ton de cette teinte n’atteint ${cible}:1 face à ${contre}`);
}

// Un texte sombre sur un fond clair : le texte à foncer. Ce qui passe déjà reste tel quel ; ce qui
// échoue reçoit un ton qui passe AVEC la marge, pas le premier qui passe.
export function tonConseille(texteHex, fondHex, seuil = SEUIL_TEXTE) {
  if (ratioExact(texteHex, fondHex) >= seuil) return texteHex;
  if (ratioExact(texteHex, '#ffffff') <= ratioExact(fondHex, '#ffffff')) {
    throw new Error('tonConseille ne sait que foncer un texte posé sur un fond plus clair que lui');
  }
  return foncer(texteHex, fondHex, seuil + MARGE_CONSEIL);
}

// Un texte clair sur un aplat : c'est l'aplat qu'il faut foncer, le texte est déjà blanc.
export function fondConseille(texteHex, fondHex, seuil = SEUIL_TEXTE) {
  if (ratioExact(texteHex, fondHex) >= seuil) return fondHex;
  if (ratioExact(fondHex, '#ffffff') <= ratioExact(texteHex, '#ffffff')) {
    throw new Error('fondConseille ne sait que foncer un fond sous un texte plus clair que lui');
  }
  return foncer(fondHex, texteHex, seuil + MARGE_CONSEIL);
}

// Le texte est-il plus sombre que son fond ? Sinon c'est un texte clair sur un aplat.
export const texteSurFondClair = (paire, valeurs) => ratioExact(valeurs[paire.texte], '#ffffff') > ratioExact(valeurs[paire.fond], '#ffffff');

// Quand un même token de texte sert plusieurs lignes qui échouent (`--text-secondary` en sert six),
// le conseiller ligne par ligne donnerait six valeurs, et seule la plus sombre les règlerait toutes.
// Le ton est donc UN pour le token : celui qui passe, avec la marge, sur le fond le plus exigeant
// (le moins contrasté) de toutes les lignes en échec qui l'emploient sous un fond plus clair.
export function tonCommun(paire, valeurs, seuil = SEUIL_TEXTE) {
  const lignes = [paire, ...PAIRES_KIT.filter((q) => q.nom !== paire.nom && q.texte === paire.texte
    && jugerPaire(q, valeurs).echoue && texteSurFondClair(q, valeurs))];
  const pire = lignes.reduce((a, b) => (ratioExact(valeurs[b.texte], valeurs[b.fond]) < ratioExact(valeurs[a.texte], valeurs[a.fond]) ? b : a));
  return tonConseille(valeurs[paire.texte], valeurs[pire.fond], seuil);
}

// Le repère de correction d'une paire qui échoue : quelle couleur foncer, et jusqu'où. Rend `null`
// pour une paire qui passe, ou quand le kit a déjà de quoi la corriger (`existant`).
export function repereCorrection(paire, valeurs, seuil = SEUIL_TEXTE) {
  if (!jugerPaire(paire, valeurs).echoue || paire.existant) return null;
  return texteSurFondClair(paire, valeurs)
    ? { role: 'texte', hex: tonCommun(paire, valeurs, seuil) }
    : { role: 'fond', hex: fondConseille(valeurs[paire.texte], valeurs[paire.fond], seuil) };
}

// Les chiffres qui se retrouvent dans la page et dans le registre. Tout est calculé ici, pour
// qu'une phrase et un tableau ne puissent pas se contredire.
export function syntheseDette(paires, valeurs) {
  const jugees = paires.map((p) => ({ p, j: jugerPaire(p, valeurs) }));
  const echecs = jugees.filter(({ j }) => j.echoue);

  // Le texte discret tient à un seul token : un seul changement règle toutes ses lignes. Le ton
  // qui passe sur le fond le plus exigeant (le moins contrasté) passe sur les autres.
  const secondaires = echecs.filter(({ p }) => p.texte === '--text-secondary');
  const pire = secondaires.reduce((a, b) => (b.j.exact < a.j.exact ? b : a), secondaires[0]);
  const tonSecondaire = pire ? tonCommun(pire.p, valeurs) : null;

  // Sur un fond pâle, le texte principal est une solution de repli : il tient partout. Sur un aplat
  // (texte blanc sur rouge ou vert), il ne tient pas, et ce n'est pas la solution : on fonce l'aplat.
  const principal = valeurs['--text-primary'];
  const pales = echecs.filter(({ p }) => texteSurFondClair(p, valeurs));
  const textePrincipalMin = pales.length ? Math.min(...pales.map(({ p }) => ratioExact(principal, valeurs[p.fond]))) : null;

  return {
    mesurees: paires.length,
    echouent: echecs.length,
    conformes: paires.length - echecs.length,
    couvertes: secondaires.length,
    tonSecondaire,
    fondExigeant: pire ? pire.p.fond : null,
    fondsPales: pales.length,
    aplats: echecs.length - pales.length,
    textePrincipalMin,
  };
}

// ---- Le tableau ----

const code = (texte) => `<code>${echapper(texte)}</code>`;

function echantillonHtml(p) {
  const couleurs = `color:var(${p.texte});background:var(${p.fond})`;
  const marque = (classes) => `class="${classes}" data-echantillon="${echapper(p.nom)}" aria-hidden="true"`;
  const e = p.echantillon;
  if (p.famille === 'badge') {
    return `<span ${marque('dt-echantillon dt-echantillon--badge')} style="${couleurs};font-size:${p.px}px;font-weight:700"><span class="dt-point"></span>${echapper(p.libelle)}</span>`;
  }
  if (p.famille === 'kpi' && e) {
    const [libelle, variation] = p.elements;
    return `<span ${marque('dt-echantillon dt-echantillon--kpi')} style="${couleurs}"><span style="font-size:${libelle.px}px">${echapper(e.libelle)}</span><span style="font-size:${variation.px}px">${echapper(e.variation)}</span></span>`;
  }
  const texte = e && e.texte ? e.texte : (p.libelle || p.nom);
  const classes = `dt-echantillon dt-echantillon--texte${p.famille ? ` dt-echantillon--${p.famille}` : ''}${e && e.majuscules ? ' dt-echantillon--majuscules' : ''}`;
  return `<span ${marque(classes)} style="${couleurs};font-size:${p.px}px;font-weight:${p.gras ? 700 : 400}">${echapper(texte)}</span>`;
}

function correctionHtml(p, valeurs, j) {
  if (!j.echoue) {
    // Conforme : rien à changer. Quand la marge est mince et que le même texte tomberait sous le
    // seuil sur le fond de l'application, on le dit, parce que c'est là que quelqu'un se trompera.
    const canvas = valeurs['--bg-canvas'];
    const sur = canvas ? ratioExact(valeurs[p.texte], canvas) : Infinity;
    const mince = j.exact - j.seuil < 0.1;
    const alerte = mince && sur < j.seuil
      ? ` La marge est mince&nbsp;: posé sur ${code('--bg-canvas')}, le même texte tomberait à ${afficherRatio(sur, ratio(valeurs[p.texte], canvas), j.seuil)}:1.`
      : '';
    return `<p class="body-sm">Rien à changer.${alerte}</p>`;
  }
  if (p.existant) {
    const fondRole = p.existantRole === 'fond';
    const [t, f] = fondRole ? [valeurs[p.texte], valeurs[p.existant]] : [valeurs[p.existant], valeurs[p.fond]];
    const dit = afficherRatio(ratioExact(t, f), ratio(t, f), j.seuil);
    return `<p class="body-sm">Employer ${code(p.existant)}${fondRole ? ' comme fond' : ''} (${dit}:1 ${fondRole ? 'sous ce texte' : 'sur ce fond'}). ${echapper(p.existantNote || '')}</p>`;
  }
  const repere = repereCorrection(p, valeurs, j.seuil);
  const [tFin, fFin] = repere.role === 'texte' ? [repere.hex, valeurs[p.fond]] : [valeurs[p.texte], repere.hex];
  const obtenu = afficherRatio(ratioExact(tFin, fFin), ratio(tFin, fFin), j.seuil);
  if (p.texte === '--text-secondary') {
    return `<p class="body-sm">Foncer ${code('--text-secondary')} jusqu’à ${code(repere.hex)} (${obtenu}:1 sur ce fond). C’est la même valeur pour toutes les lignes en ${code('--text-secondary')}&nbsp;: <a class="ds-lien-texte" href="#dette-secondaire">un seul changement les règle toutes</a>.</p>`;
  }
  if (repere.role === 'fond') {
    return `<p class="body-sm">Foncer le fond jusqu’à ${code(repere.hex)} (${obtenu}:1 sous le texte), de la même teinte. Le texte ne bouge pas.</p>`;
  }
  return `<p class="body-sm">Foncer le texte jusqu’à ${code(repere.hex)} (${obtenu}:1 sur ce fond), de la même teinte. Le fond ne bouge pas.</p>`;
}

const COLONNES = ['Composant', 'Aperçu', 'Texte sur fond', 'Taille', 'Ratio', 'Verdict', 'Ce qu’il faudrait faire'];

// L'ancre d'une paire : de quoi la retrouver depuis l'index. Un nom de classe ou de sélecteur n'est pas un id valide tel quel.
export const ancrePaire = (nom) => `paire-${String(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

function ligneHtml(p, valeurs) {
  const j = jugerPaire(p, valeurs);
  const taille = p.elements.map((e) => `<span class="dt-taille">${code(e.selecteur)}&nbsp;: ${e.px}&nbsp;px${e.gras ? ', gras' : ''}</span>`).join('');
  const verdictHtml = j.echoue
    ? `<strong class="dt-verdict body-bold"><span aria-hidden="true">✕</span> échoue</strong><span class="body-sm">à corriger</span>`
    : `<strong class="dt-verdict body-bold"><span aria-hidden="true">✓</span> conforme</strong><span class="body-sm">AA${j.exact - j.seuil < 0.1 ? ', de justesse' : ''}</span>`;
  return `    <tr class="dt-ligne dt-ligne--${j.echoue ? 'echec' : 'ok'}" role="row" id="${ancrePaire(p.nom)}" data-paire="${echapper(p.nom)}">
      <th scope="row" role="rowheader" class="dt-nom" data-etiquette="${COLONNES[0]}">${code(p.nom)}<span class="body-sm ds-oeil">${echapper(p.libelle || '')}</span>${p.note ? `<span class="body-sm dt-note">${echapper(p.note).replace(/`([^`]+)`/g, '<code>$1</code>')}</span>` : ''}</th>
      <td role="cell" class="dt-apercu" data-etiquette="${COLONNES[1]}">${echantillonHtml(p)}</td>
      <td role="cell" data-etiquette="${COLONNES[2]}"><span class="dt-couleur">Texte&nbsp;: ${code(p.texte)} <span class="body-sm ds-oeil">${echapper(valeurs[p.texte])}</span></span><span class="dt-couleur">Fond&nbsp;: ${code(p.fond)} <span class="body-sm ds-oeil">${echapper(valeurs[p.fond])}</span></span></td>
      <td role="cell" data-etiquette="${COLONNES[3]}">${taille}</td>
      <td role="cell" data-etiquette="${COLONNES[4]}"><strong class="dt-ratio h5">${j.affiche}:1</strong><span class="body-sm ds-oeil">seuil ${virgule(j.seuil, 1).replace(/,0$/, '')}:1</span></td>
      <td role="cell" data-etiquette="${COLONNES[5]}">${verdictHtml}</td>
      <td role="cell" data-etiquette="${COLONNES[6]}">${correctionHtml(p, valeurs, j)}</td>
    </tr>`;
}

// Le tableau d'une famille de paires. `valeurs` : le dictionnaire nom → valeur de `tokens.css`.
// `titreId` : l'id du titre qui nomme le tableau ; sans lui, une légende cachée le nomme.
//
// Les rôles sont posés à la main : quand la feuille du site replie le tableau en cartes, certains
// navigateurs retirent sa sémantique de tableau à un `<table>` dont le `display` a changé.
export function tableauDetteHtml(paires, valeurs, { titreId = '' } = {}) {
  const nom = titreId ? `aria-labelledby="${echapper(titreId)}"` : '';
  const legende = titreId ? '' : '\n  <caption class="visually-hidden">Contrastes mesurés</caption>';
  const entetes = COLONNES.map((c) => `<th scope="col" role="columnheader">${c}</th>`).join('');
  return `<div class="dt-defilement">
<table class="dt-table" role="table" ${nom}>${legende}
  <thead class="dt-entete"><tr role="row">${entetes}</tr></thead>
  <tbody>
${paires.map((p) => ligneHtml(p, valeurs)).join('\n')}
  </tbody>
</table>
</div>`;
}
