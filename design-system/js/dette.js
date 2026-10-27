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
//   famille    'badge', 'kpi' ou 'tableau' : le tableau où elle apparaît
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
  { ...badge('maintenance', 'Maintenance'), existant: '--status-maintenance-text' },
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

// Le ton le plus clair, de la même teinte et de la même saturation, qui passe `seuil` sur ce
// fond : on garde la teinte et on baisse la luminosité par pas de 0,2 %. C'est un REPÈRE, pas
// un choix : la couleur retenue se décide dans Figma.
export function tonMinimal(texteHex, fondHex, seuil = SEUIL_TEXTE) {
  if (ratioExact(texteHex, fondHex) >= seuil) return texteHex;
  if (ratioExact(texteHex, '#ffffff') <= ratioExact(fondHex, '#ffffff')) {
    throw new Error('tonMinimal ne sait que foncer un texte posé sur un fond plus clair que lui');
  }
  const [h, s, l] = enHsl(texteHex);
  for (let luminosite = l; luminosite >= 0; luminosite -= 0.002) {
    const ton = hexDepuis(enRgb([h, s, luminosite]));
    if (ratioExact(ton, fondHex) >= seuil) return ton;
  }
  throw new Error(`Aucun ton de cette teinte ne passe ${seuil}:1 sur ${fondHex}`);
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
  const tonSecondaire = pire ? tonMinimal(valeurs[pire.p.texte], valeurs[pire.p.fond]) : null;

  const principal = valeurs['--text-primary'];
  const textePrincipalMin = echecs.length ? Math.min(...echecs.map(({ p }) => ratioExact(principal, valeurs[p.fond]))) : null;

  return {
    mesurees: paires.length,
    echouent: echecs.length,
    conformes: paires.length - echecs.length,
    couvertes: secondaires.length,
    tonSecondaire,
    fondExigeant: pire ? pire.p.fond : null,
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
  const classes = `dt-echantillon dt-echantillon--texte${e && e.majuscules ? ' dt-echantillon--majuscules' : ''}`;
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
    const exact = ratioExact(valeurs[p.existant], valeurs[p.fond]);
    return `<p class="body-sm">Employer ${code(p.existant)} (${afficherRatio(exact, ratio(valeurs[p.existant], valeurs[p.fond]), j.seuil)}:1 sur ce fond), que le kit a déjà et que l’alerte d’avertissement emploie. Le badge n’en fait pas usage.</p>`;
  }
  const ton = tonMinimal(valeurs[p.texte], valeurs[p.fond], j.seuil);
  const obtenu = afficherRatio(ratioExact(ton, valeurs[p.fond]), ratio(ton, valeurs[p.fond]), j.seuil);
  if (p.texte === '--text-secondary') {
    return `<p class="body-sm">Foncer ${code('--text-secondary')} jusqu’à ${code(ton)} (${obtenu}:1 sur ce fond). Ce token sert aussi à d’autres lignes&nbsp;: <a class="ds-lien-texte" href="#dette-secondaire">un seul changement les règle toutes</a>.</p>`;
  }
  return `<p class="body-sm">Foncer le texte jusqu’à ${code(ton)} (${obtenu}:1 sur ce fond), de la même teinte. Le fond ne bouge pas.</p>`;
}

const COLONNES = ['Composant', 'Aperçu', 'Texte sur fond', 'Taille', 'Ratio', 'Verdict', 'Ce qu’il faudrait faire'];

function ligneHtml(p, valeurs) {
  const j = jugerPaire(p, valeurs);
  const taille = p.elements.map((e) => `<span class="dt-taille">${code(e.selecteur)}&nbsp;: ${e.px}&nbsp;px${e.gras ? ', gras' : ''}</span>`).join('');
  const verdictHtml = j.echoue
    ? `<strong class="dt-verdict body-bold"><span aria-hidden="true">✕</span> échoue</strong><span class="body-sm">à corriger</span>`
    : `<strong class="dt-verdict body-bold"><span aria-hidden="true">✓</span> conforme</strong><span class="body-sm">AA${j.exact - j.seuil < 0.1 ? ', de justesse' : ''}</span>`;
  return `    <tr class="dt-ligne dt-ligne--${j.echoue ? 'echec' : 'ok'}" role="row" data-paire="${echapper(p.nom)}">
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
