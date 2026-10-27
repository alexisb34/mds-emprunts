// Le chapitre Couleurs : quelle couleur sert à quoi, la palette, les noms, et la dette de contraste.
//
// ## Ce qui est écrit ici, ce qui est lu
//
// Aucune valeur de couleur n'est écrite dans ce module. Il reçoit `valeurs`, le dictionnaire
// nom → valeur que `valeursDepuis` tire de `css/tokens.css`, et il range, nomme et mesure. Les
// seules couleurs qu'il connaît d'avance sont celles du logo (`COULEURS`, dans `logo.js`).
// Les nombres que la page affiche (2,39:1, 9,79:1, le nombre de paires qui échouent) sont
// calculés ici, depuis les mêmes valeurs : changer un token change la page.
//
// Ce qui est écrit à la main, ce sont les FAMILLES (quelle couleur est un violet, un turquoise)
// et les USAGES (à quoi sert `--bg-muted`). Un test retrouve chaque usage dans les feuilles du
// kit : un token décrit comme employé doit l'être, et un token décrit comme non employé ne doit
// l'être par aucune feuille de `css/`.
//
// `pageHtml(valeurs)` rend le CONTENU de `<main>`, en une chaîne : pas de DOM, comme les autres
// modules du site.

import { echapper } from './texte.js';
import { ratio, ratioExact, GRAND_TEXTE } from './contraste.js';
import { COULEURS, fmtRatio } from './logo.js';
import { PAIRES_KIT, DATE_CONSTAT, tableauDetteHtml, syntheseDette, jugerPaire, enLettres, afficherRatio, ancrePaire } from './dette.js';

const BLANC = '#ffffff';
const SEUIL = 4.5;

// ---- La palette ----

// Les couleurs de `tokens.css` regroupées par famille de teinte. Ce sont les « primitives » :
// le code ne les nomme pas, il ne garde que leurs rôles, et la page les remet ensemble. L'ordre
// compte : un token va dans la première famille qui le réclame. `--text-brand` est un violet
// avant d'être un texte, `--status-reserved-fg` un turquoise avant d'être un statut.
export const FAMILLES = [
  { cle: 'violets', titre: 'Violets', motif: /^--(?:brand-primary|text-brand|border-brand|status-borrowed)(?:-|$)/ },
  { cle: 'turquoises', titre: 'Turquoises', motif: /^--(?:brand-secondary|status-reserved)(?:-|$)/ },
  { cle: 'roses', titre: 'Roses', motif: /^--brand-accent(?:-|$)/ },
  { cle: 'etats', titre: 'États', motif: /^--(?:feedback|status-(?:available|maintenance|late))(?:-|$)/ },
  { cle: 'neutres', titre: 'Neutres', motif: /^--(?:text|bg|border|status-hs)(?:-|$)/ },
  // Ramasse le reste : un token ne disparaît jamais de la page faute de famille. Un test
  // échoue si ce groupe sert un jour, pour qu'on lui en trouve une.
  { cle: 'autres', titre: 'Autres', motif: /./ },
];

export const familleDe = (nom) => FAMILLES.find((f) => f.motif.test(nom));

// Les tokens de couleur opaque que AUCUNE feuille de `css/` n'emploie. Le turquoise du logo en
// est un : il est déclaré, mais le kit n'en pose aucun aplat. Un test le vérifie dans les deux
// sens, et la liste est donc complète.
export const NON_EMPLOYES = ['--brand-secondary', '--brand-accent', '--border-strong'];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

// Rend les familles non vides, chacune avec ses couleurs, chaque couleur avec TOUS les tokens qui
// la portent. Les plus sombres d'abord : on lit une famille comme une échelle.
export function palette(valeurs) {
  const parHex = new Map();
  for (const [nom, valeur] of Object.entries(valeurs)) {
    if (!HEX.test(valeur)) continue;
    const hex = valeur.toLowerCase();
    if (!parHex.has(hex)) parHex.set(hex, { hex, jetons: [] });
    parHex.get(hex).jetons.push(nom);
  }
  const groupes = FAMILLES.map((f) => ({ cle: f.cle, titre: f.titre, couleurs: [] }));
  for (const couleur of parHex.values()) groupes.find((g) => g.cle === familleDe(couleur.jetons[0]).cle).couleurs.push(couleur);
  for (const g of groupes) g.couleurs.sort((a, b) => ratioExact(b.hex, BLANC) - ratioExact(a.hex, BLANC));
  return groupes.filter((g) => g.couleurs.length);
}

// ---- Les noms à utiliser ----

// À quoi sert chaque nom, en une phrase, d'après le CSS du kit. Les groupes ne sont pas ceux de
// la page Fondations (qui les range par préfixe) : ceux-ci sont rangés par ce qu'on veut faire.
export const SEMANTIQUES = [
  {
    cle: 'marque',
    titre: 'La marque et l’action',
    jetons: [
      { jeton: '--brand-primary', usage: 'L’action principale et ce qui est actif : le bouton plein, la case cochée, le bord de l’onglet sélectionné, l’anneau d’un champ en saisie.' },
      { jeton: '--brand-primary-hover', usage: 'Le bouton plein quand on le survole.' },
      { jeton: '--brand-primary-subtle', usage: 'Un fond violet très clair : le survol des boutons secondaires, l’entrée de navigation active.' },
      { jeton: '--brand-secondary', usage: 'Le turquoise du logo. Déclaré, mais aucune feuille de css/ ne l’emploie.' },
      { jeton: '--brand-secondary-subtle', usage: 'Un turquoise très clair : le fond de l’alerte d’information.' },
      { jeton: '--brand-accent', usage: 'Le rose d’accent. Déclaré, mais aucune feuille de css/ ne l’emploie.' },
    ],
  },
  {
    cle: 'texte',
    titre: 'Le texte',
    jetons: [
      { jeton: '--text-primary', usage: 'Le texte courant. C’est l’anthracite du logo.' },
      { jeton: '--text-secondary', usage: 'Le texte discret : libellés, légendes, métadonnées. Il est au cœur de la dette, plus bas.' },
      { jeton: '--text-disabled', usage: 'Le texte d’un champ vide, et les intitulés de section de la barre latérale.' },
      { jeton: '--text-brand', usage: 'Les liens et les libellés actifs.' },
      { jeton: '--text-on-brand', usage: 'Le texte posé sur un aplat violet.' },
      { jeton: '--text-inverse', usage: 'Le texte clair posé sur un aplat sombre ou rouge : le bouton de danger, les notifications.' },
    ],
  },
  {
    cle: 'fonds',
    titre: 'Les fonds et les filets',
    jetons: [
      { jeton: '--bg-canvas', usage: 'Le fond de l’application, derrière les cartes.' },
      { jeton: '--bg-surface', usage: 'Ce qui se pose dessus : les cartes, les champs, les barres.' },
      { jeton: '--bg-muted', usage: 'Un remplissage discret : la carte KPI neutre, la jauge, un créneau passé.' },
      { jeton: '--border-default', usage: 'Les filets des cartes, des tableaux et des champs.' },
      { jeton: '--border-brand', usage: 'Le bord violet du bouton secondaire.' },
    ],
  },
  {
    cle: 'retours',
    titre: 'Les retours',
    jetons: [
      { jeton: '--feedback-success', usage: 'Le vert du succès : la notification de succès.' },
      { jeton: '--feedback-warning', usage: 'L’ambre de l’avertissement : la notification d’avertissement.' },
      { jeton: '--feedback-error', usage: 'Le rouge de l’erreur : le bouton de danger, l’erreur de champ, la notification d’erreur.' },
    ],
  },
  {
    cle: 'statuts',
    titre: 'Les états d’un équipement',
    jetons: [
      { jeton: '--status-available-fg', usage: 'Le texte d’un badge de statut. Il en existe un par état : disponible, emprunté, réservé, en retard, maintenance, hors service.' },
      { jeton: '--status-available-bg', usage: 'Le fond pâle du même badge, et celui des cartes KPI teintées.' },
      { jeton: '--status-maintenance-text', usage: 'Un ambre assez sombre pour du texte. Seule l’alerte d’avertissement l’emploie.' },
    ],
  },
];

// ---- Les morceaux de la page ----

const code = (texte) => `<code>${echapper(texte)}</code>`;
const majuscule = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);
const r = (a, b) => `${fmtRatio(ratio(a, b))}:1`;

// Ce que donne un texte de cette couleur sur ce fond : le rapport tel qu'on l'écrit, et s'il passe.
// Le verdict part du rapport exact, comme dans le tableau de dette : un 4,4998 ne passe pas, et
// on l'écrit 4,499 plutôt que 4,50, qui se lirait comme un rapport atteint.
function lecture(texteHex, fondHex) {
  const exact = ratioExact(texteHex, fondHex);
  return { passe: exact >= SEUIL, affiche: afficherRatio(exact, ratio(texteHex, fondHex), SEUIL) };
}

function teinteHtml(c, anthracite) {
  const lisible = (texteHex, nom) => {
    const l = lecture(texteHex, c.hex);
    return `<li>${nom}&nbsp;: ${l.affiche}:1, ${l.passe ? 'passe' : `sous le seuil de ${String(SEUIL).replace('.', ',')}:1`}</li>`;
  };
  const jetons = c.jetons.map((j) => `<li>${code(j)}${NON_EMPLOYES.includes(j) ? ' <span class="body-sm ds-oeil">aucune feuille de css/ ne l’emploie</span>' : ''}</li>`).join('');
  return `<li class="cl-teinte">
        <span class="ds-pastille cl-pastille" style="background: var(${c.jetons[0]})" aria-hidden="true"></span>
        <div class="cl-teinte__corps">
          <p class="body-bold">${echapper(c.hex)}</p>
          <ul class="cl-jetons body-sm">${jetons}</ul>
          <ul class="cl-lecture body-sm ds-oeil">
            ${lisible(BLANC, 'Texte blanc dessus')}
            ${lisible(anthracite, 'Texte anthracite dessus')}
          </ul>
        </div>
      </li>`;
}

function paletteHtml(valeurs) {
  const anthracite = valeurs['--text-primary'] || COULEURS.anthracite;
  const groupes = palette(valeurs);
  const transparents = Object.entries(valeurs).filter(([, v]) => /^(?:rgba|hsla)\(/i.test(v)).map(([n]) => n);
  const violet = groupes.flatMap((g) => g.couleurs).find((c) => c.hex === valeurs['--brand-primary'].toLowerCase());
  return `<section class="ds-bande cl-ch" id="palette" aria-labelledby="titre-palette">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre" id="titre-palette">Toutes les couleurs du code</h2>
      <p class="ds-chapeau">Chaque couleur que <code>css/tokens.css</code> déclare, rangée par famille. Une même valeur sert souvent à plusieurs rôles&nbsp;: le violet ${echapper(violet.hex)} porte ${enLettres(violet.jetons.length)} noms.</p>
      <p class="body">Les valeurs sont lues dans la feuille quand vous ouvrez la page&nbsp;: si un token change, cette page change avec lui. Sous chaque couleur, ce que donnerait du texte blanc ou anthracite posé dessus, au seuil de ${String(SEUIL).replace('.', ',')}:1. Les transparences (${transparents.map(code).join(', ')}) ne sont pas des couleurs pleines&nbsp;: elles sont dans <a class="ds-lien-texte" href="composants/fondations.html">Fondations</a>.</p>
    </div>
${groupes.map((g) => `    <div class="cl-famille" id="famille-${g.cle}">
      <h3 class="h5">${echapper(g.titre)}</h3>
      <ul class="cl-teintes">
      ${g.couleurs.map((c) => teinteHtml(c, anthracite)).join('\n      ')}
      </ul>
    </div>`).join('\n')}
  </div>
</section>`;
}

function nomsHtml() {
  return `<section class="ds-bande ds-bande--doux cl-ch" id="noms" aria-labelledby="titre-noms">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre" id="titre-noms">Les noms que l’on utilise vraiment</h2>
      <p class="ds-chapeau">Le code n’emploie pas une couleur brute&nbsp;: il emploie un nom qui dit un rôle. Voici ceux qui comptent. La liste complète, avec les espacements, les rayons et les ombres, est dans <a class="ds-lien-texte" href="composants/fondations.html">Fondations</a>.</p>
    </div>
${SEMANTIQUES.map((g) => `    <div class="cl-groupe">
      <h3 class="h6">${echapper(g.titre)}</h3>
      <ul class="cl-noms">
        ${g.jetons.map(({ jeton, usage }) => `<li class="cl-nom">
          <span class="ds-pastille cl-mini" style="background: var(${jeton})" aria-hidden="true"></span>
          <div>
            ${code(jeton)}
            <p class="body-sm">${echapper(usage).replace(/css\//g, '<code>css/</code>')}</p>
          </div>
        </li>`).join('\n        ')}
      </ul>
    </div>`).join('\n')}
  </div>
</section>`;
}

function marqueProduitHtml(valeurs) {
  const primaire = valeurs['--brand-primary'];
  return `<section class="ds-bande cl-ch" id="marque-produit" aria-labelledby="titre-marque-produit">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre" id="titre-marque-produit">Le logo est turquoise, les outils sont violets</h2>
      <p class="ds-chapeau">Ce n’est pas une erreur, et ce n’est pas à chacun de trancher au cas par cas&nbsp;: deux choses différentes ont chacune leur couleur.</p>
    </div>
    <aside class="ds-message cl-reserve">
      <p class="body-bold">Ce partage n’est pas une charte officielle.</p>
      <p class="body">Il a été construit pour ce site, à partir de ce que montrent le logo et le code aujourd’hui&nbsp;: le logo est le seul ancrage de couleur de la marque, et le violet n’y figure pas. Il n’a été validé par personne du côté de la marque.</p>
      <p class="body">Ce site est public&nbsp;: ne le citez pas comme une règle de la marque.</p>
    </aside>
    <div class="ds-grille ds-grille--2">
      <article class="cl-carte">
        <div class="cl-aplats" aria-hidden="true">
          <span class="cl-aplat" style="background: var(--brand-secondary)"></span>
          <span class="cl-aplat" style="background: var(--text-primary)"></span>
        </div>
        <h3 class="h6">L’identité&nbsp;: turquoise et anthracite</h3>
        <p class="body-sm">Ce sont les deux couleurs du logo, ${COULEURS.turquoise} et ${COULEURS.anthracite}. Pour une affiche, un post, une plaquette ou un diaporama, c’est de là que l’on part. Les fonds où le logo tient sont dans <a class="ds-lien-texte" href="logo.html">Logo</a>.</p>
        <p class="body-sm">Dans les tokens, le turquoise s’appelle ${code('--brand-secondary')} et l’anthracite ${code('--text-primary')}. L’anthracite est le texte courant des outils. Le turquoise, lui, n’y a aucun aplat&nbsp;: aucune feuille de ${code('css/')} ne l’emploie, seule sa version très claire ${code('--brand-secondary-subtle')} sert, en fond d’alerte.</p>
      </article>
      <article class="cl-carte">
        <div class="cl-aplats" aria-hidden="true">
          <span class="cl-aplat" style="background: var(--brand-primary)"></span>
        </div>
        <h3 class="h6">Les outils&nbsp;: violet</h3>
        <p class="body-sm">C’est la couleur primaire de l’interface, ${echapper(primaire.toUpperCase())}&nbsp;: les boutons pleins, les liens, les éléments actifs, l’anneau d’un champ en saisie. Elle n’apparaît pas dans le logo.</p>
        <p class="body-sm">Dans un outil, c’est elle qui dit «&nbsp;on peut agir ici&nbsp;». Le logo ne la reprend pas, et elle ne recolore jamais le logo.</p>
      </article>
    </div>
    <div class="ds-mesure lg-tete">
      <p class="body">Deux mesures rendent cette séparation raisonnable. Le turquoise du logo fait ${r(COULEURS.turquoise, BLANC)} sur blanc, ce qui ne suffit pas pour du texte ni pour un bouton qu’il faut lire. Le violet fait ${r(BLANC, primaire)} sous du texte blanc. Cela ne dit pas pourquoi l’école a fait ce choix, que ce guide ne connaît pas&nbsp;; cela dit pourquoi il tient.</p>
    </div>
    <figure class="cl-figure">
      <div class="cl-ensemble" role="group" aria-label="Le logo et une action du produit, côte à côte">
        <img class="lg-logo" src="assets/logo.svg" alt="Logo MyDigitalSchool" style="--l: 200px">
        <span class="cl-ensemble__filet" aria-hidden="true"></span>
        <a class="ds-bouton label-md" href="#dette">Voir la dette de contraste</a>
      </div>
      <figcaption class="body-sm ds-oeil ds-mesure">Le logo garde ses couleurs, l’action garde la sienne. Aucune ne reprend l’autre&nbsp;: le violet ne sert jamais à recolorer le logo, voir <a class="ds-lien-texte" href="logo.html#interdit-recolorer">«&nbsp;Ne le recolorez pas&nbsp;»</a>.</figcaption>
    </figure>
  </div>
</section>`;
}

function regleHtml(valeurs) {
  const p = palette(valeurs).flatMap((g) => g.couleurs).find((c) => c.hex === valeurs['--brand-primary'].toLowerCase());
  const loupe = valeurs['--text-secondary'];
  return `<section class="ds-bande ds-bande--frais cl-ch" id="regle-du-nom" aria-labelledby="titre-regle">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre" id="titre-regle">On écrit le nom, jamais la valeur</h2>
      <p class="ds-chapeau">Dans une feuille de style, écrivez <code>var(--brand-primary)</code>, jamais <code>${echapper(valeurs['--brand-primary'])}</code>.</p>
    </div>
    <pre class="ds-code body-sm ds-mesure" tabindex="0" role="region" aria-label="Deux écritures du même violet"><code>/* À écrire */
.mon-bouton {
  background: var(--brand-primary);
}

/* À ne pas écrire */
.mon-bouton {
  background: ${echapper(valeurs['--brand-primary'])};
}</code></pre>
    <div class="ds-mesure lg-tete">
      <p class="body">La première raison est simple&nbsp;: une couleur se change à un seul endroit, <code>css/tokens.css</code>, et tout le reste suit. La seconde est plus fine. Le même ${echapper(p.hex)} porte aujourd’hui ${enLettres(p.jetons.length)} rôles&nbsp;: ${p.jetons.map(code).join(', ').replace(/, ([^,]*)$/, ' et $1')}. Si l’un d’eux change un jour, par exemple un violet de lien plus foncé, les autres ne doivent pas suivre. Écrire la valeur, c’est ne pas dire lequel des ${enLettres(p.jetons.length)} vous voulez&nbsp;; le nom le dit.</p>
      <p class="body">Il y a une seule exception dans les feuilles du kit&nbsp;: la loupe du champ de recherche, <code>.input--search</code>. Son trait est écrit <code>${echapper(loupe)}</code>, la valeur de ${code('--text-secondary')}, dans une image intégrée au CSS où <code>var()</code> ne s’évalue pas. Si ${code('--text-secondary')} change, la loupe ne suivra pas.</p>
    </div>
  </div>
</section>`;
}

// ---- La dette ----

function detteHtml(valeurs) {
  const s = syntheseDette(PAIRES_KIT, valeurs);
  const famille = (nom) => PAIRES_KIT.filter((p) => p.famille === nom);
  const compte = (paires) => paires.filter((p) => jugerPaire(p, valeurs).echoue).length;
  const badges = famille('badge');
  const cartes = famille('kpi');
  const tableau = famille('tableau');
  const survol = tableau.find((p) => p.nom === 'table tr:hover');
  const entete = tableau.find((p) => p.nom === 'table th');
  const retours = PAIRES_KIT.filter((p) => ['alerte', 'bouton', 'notification'].includes(p.famille));
  const bConformes = badges.filter((p) => !jugerPaire(p, valeurs).echoue).map((p) => p.libelle);
  const petit = String(GRAND_TEXTE.pxGras).replace('.', ',');
  const seuil = String(SEUIL).replace('.', ',');

  const phraseBadges = `${majuscule(enLettres(compte(badges)))} des ${enLettres(badges.length)} badges ne passent pas.${bConformes.length === 1 ? ` Seul le badge «&nbsp;${echapper(bConformes[0])}&nbsp;» passe.` : ''}`;
  const phraseCartes = compte(cartes) === cartes.length
    ? `Les ${enLettres(cartes.length)} cartes ne passent pas, la carte neutre comprise.`
    : `${majuscule(enLettres(compte(cartes)))} des ${enLettres(cartes.length)} cartes ne passent pas.`;

  return `<section class="ds-bande cl-ch" id="dette" aria-labelledby="titre-dette">
  <div class="ds-section dt-dette">
    <div class="ds-mesure lg-tete">
      <h2 class="ds-titre" id="titre-dette">La dette de contraste, au <time datetime="${DATE_CONSTAT.iso}">${DATE_CONSTAT.texte}</time></h2>
      <p class="ds-chapeau">${s.echouent} des ${s.mesurees} paires mesurées sont sous le seuil de lisibilité. Les voici telles quelles, avec ce qu’il faudrait faire&nbsp;: ne les reprenez pas dans un nouvel écran.</p>
      <p class="body">Tous ces textes font moins de ${petit}&nbsp;px, la taille à partir de laquelle WCAG 2.1 tolère un contraste plus faible pour un texte gras. Le seuil est donc ${seuil}:1, niveau AA.</p>
    </div>
    <aside class="ds-message dt-decision">
      <h3 class="h6">Pourquoi elles sont publiées</h3>
      <p class="body-sm">Le ${DATE_CONSTAT.texte}, la décision a été prise de publier ces chiffres plutôt que de les taire, ou de changer la palette d’un prototype qui tourne. Corriger la palette revient à l’école&nbsp;: ce guide ne la modifie pas. Les correctifs sont notés dans <code>docs/correctifs-figma.md</code>, où Figma fait foi et le code suit.</p>
      <p class="body-sm">Ce tableau n’est pas l’inventaire complet du kit. Il couvre les badges de statut, les cartes KPI, les tableaux, les alertes, le bouton de danger et les notifications. Il reste des paires repérées dans le CSS, pas encore vérifiées dans les vues, donc non publiées&nbsp;: le texte d’erreur et le texte de succès (${code('.text-error')}, ${code('.text-success')}), le texte désactivé, et le texte discret posé directement sur le fond de l’application, hors des tableaux.</p>
    </aside>
    <nav class="ds-groupes" aria-label="Dans cette section">
      <ul class="ds-groupes__liste">
        <li><a class="ds-groupes__lien body-sm" href="#dette-badges">Les badges</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#dette-kpi">Les cartes KPI</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#dette-tableau">Les tableaux</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#dette-retours">Alertes, danger, notifications</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#dette-secondaire">Un seul changement pour ${enLettres(s.couvertes)} lignes</a></li>
      </ul>
    </nav>
    <div class="dt-index">
      <p class="body-sm">Retrouver une paire&nbsp;: chacune mène à sa ligne.</p>
      <nav aria-label="Retrouver une paire">
        <ul class="ds-groupes__liste">
          ${PAIRES_KIT.map((p) => {
    const j = jugerPaire(p, valeurs);
    return `<li><a class="ds-groupes__lien body-sm" href="#${ancrePaire(p.nom)}">${echapper(p.nom)}&nbsp;<span class="dt-index__verdict"><span aria-hidden="true">${j.echoue ? '✕' : '✓'}</span> ${j.affiche}:1, ${j.echoue ? 'échoue' : 'conforme'}</span></a></li>`;
  }).join('\n          ')}
        </ul>
      </nav>
    </div>

    <div class="dt-bloc" id="dette-badges">
      <div class="ds-mesure lg-tete">
        <h3 class="h5" id="titre-dette-badges">Les badges de statut</h3>
        <p class="body">Le texte d’un badge fait ${badges[0].px}&nbsp;px en gras et se pose sur le fond pâle de sa propre couleur. ${phraseBadges}</p>
      </div>
      ${tableauDetteHtml(badges, valeurs, { titreId: 'titre-dette-badges' })}
    </div>

    <div class="dt-bloc" id="dette-kpi">
      <div class="ds-mesure lg-tete">
        <h3 class="h5" id="titre-dette-kpi">Les cartes KPI</h3>
        <p class="body">Le libellé d’une carte (${cartes[0].elements[0].px}&nbsp;px) et sa variation (${cartes[0].elements[1].px}&nbsp;px) sont en ${code('--text-secondary')}, un gris moyen, posé sur le fond de la carte&nbsp;: un gris clair ou un pastel, jamais assez contrasté. ${phraseCartes}</p>
      </div>
      ${tableauDetteHtml(cartes, valeurs, { titreId: 'titre-dette-kpi' })}
    </div>

    <div class="dt-bloc" id="dette-tableau">
      <div class="ds-mesure lg-tete">
        <h3 class="h5" id="titre-dette-tableau">Les tableaux</h3>
        <p class="body">L’en-tête de colonne (${entete.px}&nbsp;px, en gras) passe de justesse, parce que le tableau est posé dans une carte blanche. Une ligne survolée prend ${code(survol.fond)}, et le texte discret de ${survol.px}&nbsp;px qu’elle contient, comme les jours de retard ou le code d’un matériel, tombe à ${jugerPaire(survol, valeurs).affiche}:1.</p>
      </div>
      ${tableauDetteHtml(tableau, valeurs, { titreId: 'titre-dette-tableau' })}
    </div>

    <div class="dt-bloc" id="dette-retours">
      <div class="ds-mesure lg-tete">
        <h3 class="h5" id="titre-dette-retours">Les alertes, le bouton de danger et les notifications</h3>
        <p class="body">Une alerte se pose en pâle, comme un badge&nbsp;: un texte de couleur sur le fond clair de sa teinte. Un bouton de danger et une notification ont un texte blanc, en gras, sur un aplat&nbsp;: le rouge de l’erreur ou le vert du succès. ${compte(retours) === retours.length ? `Les ${enLettres(retours.length)} lignes` : `${majuscule(enLettres(compte(retours)))} lignes sur ${enLettres(retours.length)}`} ne passent pas. Sur un aplat, ce n’est pas le texte qu’il faut changer, il est déjà blanc&nbsp;: c’est l’aplat.</p>
      </div>
      ${tableauDetteHtml(retours, valeurs, { titreId: 'titre-dette-retours' })}
    </div>

    <div class="dt-bloc ds-mesure lg-tete" id="dette-secondaire">
      <h3 class="h5">Un seul changement pour ${enLettres(s.couvertes)} lignes</h3>
      <p class="body">Les ${enLettres(s.couvertes)} lignes en ${code('--text-secondary')}, les cartes KPI et la ligne survolée, tiennent à un seul token. Le foncer jusqu’à ${code(s.tonSecondaire)} les fait passer toutes, y compris sur le plus exigeant des fonds, ${code(s.fondExigeant)}. C’est un repère calculé, pas une décision&nbsp;: le ton exact se choisit dans Figma, et il touche tous les textes discrets de l’outil.</p>
      <h3 class="h6">Pour un nouvel écran</h3>
      <p class="body">Ne copiez aucune des lignes qui ne passent pas. Sur les ${s.fondsPales} lignes à fond pâle, ${code('--text-primary')} fait au moins ${fmtRatio(Math.round(s.textePrincipalMin * 100) / 100)}:1&nbsp;: c’est le texte à employer en attendant, et la couleur d’un statut peut alors se porter par un filet ou une pastille plutôt que par le texte. Sur un aplat (${s.aplats} lignes), le texte principal ne tient pas&nbsp;: c’est le fond qu’il faut prendre plus sombre, comme ${code('--feedback-error-hover')} pour le rouge.</p>
    </div>
  </div>
</section>`;
}

function enteteHtml() {
  return `<section class="ds-bande cl-ch">
  <div class="ds-section">
    <div class="ds-mesure lg-tete">
      <h1 class="ds-titre-page">Les couleurs</h1>
      <p class="ds-chapeau">Deux couleurs sont dans le logo, une troisième habille les outils. Cette page dit laquelle sert à quoi, d’où viennent les couleurs du code, comment les nommer, et où le kit est sous le seuil de lisibilité.</p>
    </div>
    <nav class="ds-groupes" aria-label="Sur cette page">
      <ul class="ds-groupes__liste">
        <li><a class="ds-groupes__lien body-sm" href="#marque-produit">Marque et produit</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#palette">La palette</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#noms">Les noms à utiliser</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#regle-du-nom">La règle du nom</a></li>
        <li><a class="ds-groupes__lien body-sm" href="#dette">La dette de contraste</a></li>
      </ul>
    </nav>
  </div>
</section>`;
}

// Le contenu de `<main>`. `valeurs` : le dictionnaire nom → valeur de `css/tokens.css`.
export function pageHtml(valeurs) {
  for (const nom of ['--brand-primary', '--text-primary', '--text-secondary', '--bg-canvas']) {
    if (typeof valeurs[nom] !== 'string' || !valeurs[nom]) throw new Error(`Token manquant : ${nom}`);
  }
  return [enteteHtml(), marqueProduitHtml(valeurs), paletteHtml(valeurs), nomsHtml(), regleHtml(valeurs), detteHtml(valeurs)].join('\n');
}
