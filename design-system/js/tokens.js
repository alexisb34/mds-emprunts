// La lecture des tokens : le site LIT `css/tokens.css`, il ne le recopie pas.
//
// Rien ici ne contient la valeur d'un token. Ce module apprend à ranger ce que la feuille
// déclare, à le montrer, et à dire pourquoi il n'a rien pu lire. Si quelqu'un change un
// token demain, la page Fondations change avec lui ; si quelqu'un en ajoute un, il
// apparaît — dans « Autres » s'il n'a pas encore de famille.
//
// Module pur, sans DOM : il reçoit du texte ou un `document`, et rend des données ou des
// chaînes HTML, à la manière de `chrome.js`.

// ---- Les groupes ----
//
// Ils suivent les sections de `css/tokens.css`. Un token va dans le premier groupe dont un
// préfixe le réclame ; les dérivés (`--brand-primary-hover`, `--status-maintenance-text`,
// `--alpha-white-80`) rejoignent donc leur famille d'après leur nom, pas la section du
// fichier où ils ont atterri. `autres` ne réclame rien : il ramasse le reste, pour qu'un
// token ne disparaisse jamais de la page faute de groupe.
//
// `usage` : une phrase qui dit à quoi sert la famille, affichée sous le titre.
export const GROUPES = [
  { cle: 'marque', titre: 'Marque', prefixes: ['--brand-'],
    usage: 'Le violet du produit, le turquoise et le rose d’accent, avec leurs variantes discrète et au survol.' },
  { cle: 'texte', titre: 'Texte', prefixes: ['--text-'],
    usage: 'Les couleurs de texte, y compris celles à poser sur un fond de marque.' },
  { cle: 'fonds', titre: 'Fonds', prefixes: ['--bg-', '--alpha-', '--overlay'],
    usage: 'Les fonds de page, de surface et de remplissage, et les transparences.' },
  { cle: 'bordures', titre: 'Bordures', prefixes: ['--border-', '--stroke-'],
    usage: 'Les couleurs de filet et l’épaisseur du trait.' },
  { cle: 'retours', titre: 'Retours', prefixes: ['--feedback-'],
    usage: 'Succès, avertissement, erreur.' },
  { cle: 'statuts', titre: 'Statuts', prefixes: ['--status-'],
    usage: 'Une paire par état d’un équipement : le texte (fg) et le fond (bg).' },
  { cle: 'espacements', titre: 'Espacements', prefixes: ['--space-'],
    usage: 'Marges, écarts et rembourrages. On n’écrit pas de pixels à la main.' },
  { cle: 'rayons', titre: 'Rayons', prefixes: ['--radius-'],
    usage: 'L’arrondi des angles.' },
  { cle: 'tailles', titre: 'Tailles', prefixes: ['--size-'],
    usage: 'Les dimensions fixes : barre latérale, barre du haut, contrôles, avatar.' },
  { cle: 'ombres', titre: 'Ombres', prefixes: ['--shadow-'],
    usage: 'Trois niveaux d’élévation : la carte, l’élément flottant, la modale.' },
  { cle: 'typographie', titre: 'Typographie', prefixes: ['--font-'],
    usage: 'Les deux familles de caractères. Les tailles et les graisses ne sont pas des tokens : elles vivent dans les classes de css/base.css (.h5, .body, .label-md…).' },
  { cle: 'autres', titre: 'Autres', prefixes: [],
    usage: 'Des tokens que cette page ne sait pas encore ranger. Ils s’affichent quand même.' },
];

// Les tokens sur lesquels le registre des correctifs a quelque chose à dire. Le site montre
// ce que le code EST ; `docs/correctifs-figma.md` dit ce qu'il DEVRAIT devenir. Les deux
// disent vrai, et la mention les fait tenir ensemble. `…` entoure du code, **…** du gras.
const MENTIONS = {
  '--border-muted': '**Non tranché** — hors du système tant que personne n’a décidé. Voir `docs/correctifs-figma.md`.',
};

// ---- Lire un texte CSS ----

// Les déclarations de tous les blocs `:root`, dans l'ordre du texte, commentaires retirés.
// Un nom déclaré deux fois garde sa première place et sa dernière valeur, comme le fait la
// cascade. `Map` garde l'ordre d'insertion.
function declarations(cssTexte) {
  const sansCommentaires = String(cssTexte).replace(/\/\*[\s\S]*?\*\//g, '');
  const vues = new Map();
  for (const bloc of sansCommentaires.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of bloc[1].matchAll(/(--[\w-]+)\s*:\s*([^;]*)/g)) vues.set(d[1], d[2].trim());
  }
  return vues;
}

function groupeDe(nom) {
  return GROUPES.find((g) => g.prefixes.some((p) => nom.startsWith(p))) || GROUPES.at(-1);
}

// Tous les groupes, dans l'ordre de `GROUPES`, vides compris : la forme du résultat ne
// dépend pas de ce que la feuille contient. À l'intérieur d'un groupe, l'ordre du fichier.
export function lireTokens(cssTexte) {
  const groupes = GROUPES.map((g) => ({ cle: g.cle, titre: g.titre, tokens: [] }));
  for (const [nom, valeur] of declarations(cssTexte)) {
    groupes.find((g) => g.cle === groupeDe(nom).cle).tokens.push({ nom, valeur });
  }
  return groupes;
}

// Le dictionnaire nom → valeur, pour qui a besoin d'un token précis (les contrastes).
export function valeursDepuis(cssTexte) {
  return Object.fromEntries(declarations(cssTexte));
}

// ---- Lire depuis le document ----

const MESSAGE_SERVEUR = 'Cette page lit les tokens depuis la feuille de style, ce qu’un navigateur refuse sur un fichier local. Ouvrez le site depuis un serveur : `npm run serve`.';
const MESSAGE_ABSENTE = 'La page n’a trouvé aucun token : la feuille `css/tokens.css` n’est pas chargée, ou elle est vide.';

// `tokens.css` ou une feuille sans adresse (un `<style>` en ligne). Toute autre feuille est
// laissée fermée : celle de Google Fonts vient d'une autre origine, et en lire les règles
// lève une SecurityError même sur un serveur — elle ne doit pas faire croire que les tokens
// sont illisibles.
const EST_TOKENS = /(?:^|\/)tokens\.css(?:[?#]|$)/;

// Rend `{ok: true, groupes}`, ou `{ok: false, message}`. Jamais d'exception : la page doit
// toujours pouvoir dire quelque chose. Le refus classique est `file://`, où un navigateur
// interdit de lire `cssRules`.
export function lireTokensDepuisDocument(doc) {
  const morceaux = [];
  let candidate = false;
  try {
    for (const feuille of Array.from(doc.styleSheets)) {
      if (feuille.href && !EST_TOKENS.test(feuille.href)) continue;
      candidate = true;
      for (const regle of Array.from(feuille.cssRules)) {
        if (regle.selectorText === ':root') morceaux.push(regle.cssText);
      }
    }
  } catch {
    return { ok: false, message: MESSAGE_SERVEUR };
  }
  const groupes = lireTokens(morceaux.join('\n'));
  if (!candidate || groupes.every((g) => g.tokens.length === 0)) return { ok: false, message: MESSAGE_ABSENTE };
  return { ok: true, groupes };
}

// ---- Montrer ----

function echapper(texte) {
  return String(texte).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Un texte à deux gestes de mise en forme : `…` devient du code, **…** devient du gras.
// Sert aux messages, écrits en texte simple dans ce module et montrés tels quels.
export function messageHtml(message) {
  return echapper(message)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// Une couleur : hexadécimale, ou une fonction de couleur. Une valeur comme `8px` n'en est pas une.
const EST_COULEUR = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\()/i;

// Vrai quand le fond se voit à travers lui : sur une pastille blanche, `rgba(255,255,255,.1)`
// serait invisible, et la page montrerait un carré vide au lieu d'un token.
function estTranslucide(valeur) {
  const v = valeur.trim();
  const hex = v.match(/^#([0-9a-f]{4}|[0-9a-f]{8})$/i);
  if (hex) return !/^(?:f|ff)$/i.test(hex[1].slice(hex[1].length === 4 ? 3 : 6));
  const fonction = v.match(/^(?:rgba|hsla)\((.*)\)$/i) || v.match(/^(?:rgb|hsl)\(.*\/\s*(.*)\)$/i);
  if (!fonction) return false;
  const alpha = fonction[1].split(/[,/]/).pop().trim();
  const n = parseFloat(alpha);
  return Number.isFinite(n) && (alpha.endsWith('%') ? n / 100 : n) < 1;
}

// Le damier de l'aperçu translucide : moitié sombre, moitié claire, en tokens du produit.
const DAMIER = 'linear-gradient(90deg, var(--text-primary) 50%, var(--bg-surface) 50%)';

// L'aperçu d'un token. Il lit le token (`var(--nom)`) au lieu d'en recopier la valeur : un
// token changé change son aperçu. Les fonds sont posés en ligne et non dans `site.css` :
// l'aperçu d'une couleur n'a pas de couleur à lui, c'est celle du token, et aucun texte
// n'est posé dessus — chaque pastille est un frère du texte, jamais son contenant.
// Rend '' quand il n'y a rien d'honnête à montrer.
function apercuHtml(nom, valeur) {
  const v = `var(${nom})`;
  if (nom.startsWith('--space-') || nom.startsWith('--size-')) return `<span class="ds-barre" style="width: ${v}" aria-hidden="true"></span>`;
  if (nom.startsWith('--radius-')) return `<span class="ds-rayon" style="border-radius: ${v}" aria-hidden="true"></span>`;
  if (nom.startsWith('--stroke-')) return `<span class="ds-trait" style="border-top-width: ${v}" aria-hidden="true"></span>`;
  if (nom.startsWith('--shadow-')) return `<span class="ds-plaque" aria-hidden="true"><span class="ds-ombre" style="box-shadow: ${v}"></span></span>`;
  if (nom.startsWith('--font-')) {
    const graisse = nom.includes('heading') ? 800 : 400;
    return `<span class="ds-police h5" style="font-family: ${v}; font-weight: ${graisse}" aria-hidden="true">Les talents se connectent</span>`;
  }
  if (EST_COULEUR.test(valeur)) {
    const fond = estTranslucide(valeur) ? `linear-gradient(${v}, ${v}), ${DAMIER}` : v;
    return `<span class="ds-pastille" style="background: ${fond}" aria-hidden="true"></span>`;
  }
  return '';
}

function jetonHtml({ nom, valeur }) {
  const mention = MENTIONS[nom] ? `\n      <p class="ds-mention body-sm">${messageHtml(MENTIONS[nom])}</p>` : '';
  const copie = `var(${nom})`;
  return `    <li class="ds-jeton">
      <div class="ds-jeton__id">
        <code class="ds-jeton__nom body-sm">${echapper(nom)}</code>
        <code class="ds-jeton__valeur ds-oeil body-sm">${echapper(valeur)}</code>${mention}
      </div>
      <div class="ds-jeton__apercu">${apercuHtml(nom, valeur)}</div>
      <button type="button" class="ds-copier label-md" data-copie="${echapper(copie)}" aria-label="Copier ${echapper(copie)}">Copier</button>
    </li>`;
}

// Les groupes qui ont des tokens, un titre et une liste chacun. Un groupe vide ne s'affiche
// pas : « Autres » en particulier n'apparaît que le jour où il sert.
export function tableauTokensHtml(groupes) {
  return groupes.filter((g) => g.tokens.length).map((g) => {
    const def = GROUPES.find((x) => x.cle === g.cle);
    return `<section class="ds-groupe" id="groupe-${g.cle}" aria-labelledby="titre-${g.cle}">
  <h2 class="h5" id="titre-${g.cle}">${echapper(g.titre)}</h2>
  ${def ? `<p class="body-sm ds-oeil ds-mesure">${echapper(def.usage)}</p>` : ''}
  <ul class="ds-jetons">
${g.tokens.map(jetonHtml).join('\n')}
  </ul>
</section>`;
  }).join('\n');
}

// Les liens vers les groupes, pour ne pas faire défiler douze sections à la main.
export function sommaireGroupesHtml(groupes) {
  const liens = groupes.filter((g) => g.tokens.length)
    .map((g) => `<li><a class="ds-groupes__lien label-md" href="#groupe-${g.cle}">${echapper(g.titre)}</a></li>`).join('\n    ');
  return `<nav class="ds-groupes" aria-label="Groupes de tokens">
  <ul class="ds-groupes__liste">
    ${liens}
  </ul>
</nav>`;
}
