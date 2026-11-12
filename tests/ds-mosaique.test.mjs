// L'ouverture de l'accueil : sept blocs qui entrent par les bords et forment une mosaïque.
//
// Ce que ces tests gardent, et pourquoi :
//
//   1. Les sept destinations existent et sont des pages que le site annonce déjà. Un bloc
//      qui mène à une page morte est le genre de chose qu'on ne voit pas en relisant.
//   2. Les sept fonds sont mesurés. Le test ne contient PAS la liste des couleurs : il la
//      dérive de la feuille, puis exige que `PAIRES` contienne la paire texte/fond de
//      chaque bloc. Une tuile repeinte sans mesure fait donc échouer la suite.
//   3. Les variables que le module écrit sont celles que la feuille lit. Renommer l'une
//      sans l'autre laisserait une animation muette, qu'aucun test ne verrait autrement.
//   4. L'état sans JavaScript, le mouvement réduit, les écrans étroits et le passage au
//      clavier montrent tous la mosaïque MONTÉE. C'est le repli, et il est vérifié dans la
//      feuille, pas seulement affirmé dans un commentaire.
//   5. Les gestes au survol des sept signes répondent aussi au focus clavier, et vivent
//      TOUS sous `prefers-reduced-motion: no-preference`. Une souris n'est pas le seul
//      moyen d'arriver sur un bloc, et un geste coupé à moitié serait un saut.
//
// Ce qu'ils ne gardent pas : l'allure du mouvement. Node n'a pas de moteur de rendu ; que
// les blocs glissent joliment se regarde dans un navigateur, et s'est regardé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAIRES } from '../design-system/js/palette-site.js';
import { ACCUEIL, CHAPITRES, COMPOSANTS, RESERVE, enteteHtml } from '../design-system/js/chrome.js';
import { BLOCS, FRAPPE, OUVERTURE, brancherMosaique, etapes, mosaiqueHtml } from '../design-system/js/mosaique.js';

const lire = (chemin) => readFileSync(new URL(`../design-system/${chemin}`, import.meta.url), 'utf8');
const CSS = lire('css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
const LANDING = lire('index.html');
const MODULE = lire('js/mosaique.js');

// Les règles feuilles de la feuille, `@media` compris : le motif ne traverse pas une
// accolade, donc il attrape les règles internes et saute les en-têtes de blocs.
const REGLES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selecteurs: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
  corps: m[2],
}));

// La déclaration `propriete` de la règle dont les sélecteurs contiennent `selecteur`.
function declaration(selecteur, propriete) {
  for (const r of REGLES) {
    if (!r.selecteurs.includes(selecteur)) continue;
    const m = r.corps.match(new RegExp(`(?:^|;)\\s*${propriete}\\s*:\\s*([^;]+)`));
    if (m) return m[1].trim();
  }
  return undefined;
}

// ---- Les sept blocs et leurs destinations ----

test('la mosaïque a sept blocs, et chacun mène à une page que le site annonce', () => {
  assert.equal(BLOCS.length, 7, 'la mosaïque n’a plus sept blocs');

  // Les adresses que le site connaît : l'accueil, les cinq chapitres, les pages composants.
  const annoncees = new Set([ACCUEIL, ...CHAPITRES.map((c) => c.href), ...COMPOSANTS.map((c) => c.href)]);
  // Aucun bloc ne ramène à la landing elle-même : on n'y revient que par le logo d'une
  // autre page, et encore — il mène à l'accueil du guide.
  assert.ok(!BLOCS.some((b) => b.href === 'index.html'), 'un bloc de la mosaïque ramène à la mosaïque');
  for (const b of BLOCS) {
    assert.ok(annoncees.has(b.href), `le bloc « ${b.titre} » mène à ${b.href}, que le site n’annonce nulle part`);
    // Et la page existe vraiment : `annoncees` dit ce que le site promet, le disque dit ce qu'il tient.
    readFileSync(new URL(`../design-system/${b.href}`, import.meta.url));
    assert.ok(b.titre.trim(), `${b.href} n’a pas de titre`);
  }

  // Les deux destinations que l'utilisateur a nommées, mot pour mot.
  const vers = (titre) => BLOCS.find((b) => b.titre === titre)?.href;
  assert.equal(vers('Brand guidelines &amp; design system'), ACCUEIL);
  assert.equal(vers('Composants d’interface'), 'composants/demarrer.html');

  // Aucun doublon : sept blocs, sept destinations.
  assert.equal(new Set(BLOCS.map((b) => b.href)).size, 7);
});

test('le menu porte les deux noms que portent les blocs', () => {
  // Les deux seuls renommages demandés. Le lien de marque de l'en-tête et l'entrée de
  // l'étage composants mènent aux mêmes pages que les blocs 1 et 7 : ils en portent donc
  // le nom, coupé en deux par `ds-entete__titre-suite` pour les fenêtres étroites.
  const entete = lire('js/chrome.js');

  // Le libellé de marque est le nom du bloc 1, mot pour mot — c'est lui qu'on lit ici, pas
  // une copie écrite à la main. Le `<span>` qui le coupe en deux disparaît à la lecture :
  // il ne sert qu'aux fenêtres étroites, où la seconde moitié est masquée.
  const rendu = enteteHtml(ACCUEIL);
  const marque = rendu.match(/<span class="ds-entete__titre [\w-]+">([\s\S]*?)<\/span><\/span>/)[1]
    .replace(/<\/?span[^>]*>/g, '');
  assert.equal(marque, BLOCS.find((b) => b.href === ACCUEIL).titre, 'le lien de marque ne porte plus le nom du bloc 1');

  // Et il est à la taille des autres liens du menu, pas en dessous : c'est un lien de la
  // même barre, vers une page comme les autres. Les deux tailles sont LUES, pas écrites ici.
  assert.equal(rendu.match(/class="ds-entete__titre (label-\w+)"/)[1],
    rendu.match(/class="ds-nav__lien (label-\w+)"/)[1],
    'le lien de marque n’est pas à la taille des autres liens du menu');
  // L'espace est insécable : `.ds-entete__etage` est un `inline-flex`, et un espace
  // ordinaire entre ses deux éléments flex serait avalé — « Composantsd’interface ».
  assert.match(entete, /Composants<span class="ds-entete__titre-suite">&nbsp;d’interface<\/span>/);
});

// ---- Les couleurs : dérivées de la feuille, mesurées par la palette ----

test('les sept fonds de la mosaïque sont des paires mesurées de la palette', () => {
  // Rien ici n'est écrit à la main : les couleurs sont lues dans la feuille, bloc par bloc.
  const mesurees = new Set(PAIRES.map((p) => `${p.texte} sur ${p.fond}`));

  let vues = 0;
  for (const b of BLOCS) {
    const selecteur = `.ds-tuile--${b.aire}`;
    const fond = declaration(selecteur, 'background');
    const texte = declaration(selecteur, 'color');
    assert.ok(fond, `${selecteur} ne peint aucun fond`);
    assert.ok(texte, `${selecteur} ne pose aucune couleur de texte`);

    const nomFond = fond.match(/var\(\s*(--ds-[\w-]+)/)?.[1];
    const nomTexte = texte.match(/var\(\s*(--ds-[\w-]+)/)?.[1];
    assert.ok(nomFond && nomTexte, `${selecteur} : couleurs posées hors des variables du site`);
    assert.ok(mesurees.has(`${nomTexte} sur ${nomFond}`),
      `${selecteur} pose ${nomTexte} sur ${nomFond}, une paire que palette-site.js ne mesure pas`);
    vues += 1;
  }
  assert.equal(vues, 7);
});

test('la mosaïque ne met ni le turquoise ni le rose sous du texte', () => {
  // Les deux couleurs que la charte interdit sous du texte — le chapitre Couleurs le dit,
  // `tests/ds-dette.test.mjs` le vérifie pour le turquoise. Elles n'apparaissent ici que
  // dans les signes décoratifs, qui sont tous `aria-hidden` et ne portent aucun mot.
  const interdites = ['--ds-turquoise', '--ds-rose'];
  for (const r of REGLES) {
    const fond = r.corps.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/)?.[1] || '';
    for (const nom of interdites) {
      if (!fond.includes(nom)) continue;
      assert.fail(`${r.selecteurs.join(', ')} peint un fond en ${nom}`);
    }
  }
  // Et dans le balisage, aucun signe ne contient de texte lisible par un lecteur d'écran.
  const html = mosaiqueHtml();
  for (const signe of html.matchAll(/<(?:span|svg|img)[^>]*class="[^"]*ds-tuile__signe[^"]*"[^>]*>/g)) {
    assert.match(signe[0], /aria-hidden="true"/, `un signe de bloc n’est pas aria-hidden : ${signe[0]}`);
  }
});

// ---- L'avancement ----

test('les trois gestes vont de 0 à 1 et sont finis quand le défilement l’est', () => {
  const debut = etapes(0);
  const fin = etapes(1);
  for (const [nom, v] of Object.entries(debut)) assert.equal(v, 0, `« ${nom} » n’est pas à 0 au début`);
  for (const [nom, v] of Object.entries(fin)) assert.equal(v, 1, `« ${nom} » n’est pas fini à la fin`);

  // Bornés au-delà des deux bouts : la scène ne se défait pas quand on dépasse la piste.
  assert.deepEqual(etapes(-3), debut);
  assert.deepEqual(etapes(4), fin);

  // Chaque geste croît sans jamais reculer, et les trois se suivent dans l'ordre annoncé.
  let precedent = { carte: 0, tuiles: 0, reduit: 0 };
  for (let p = 0; p <= 1.0001; p += 0.02) {
    const e = etapes(p);
    for (const nom of Object.keys(e)) {
      assert.ok(e[nom] >= precedent[nom] - 1e-9, `« ${nom} » recule à p=${p.toFixed(2)}`);
      assert.ok(e[nom] >= 0 && e[nom] <= 1, `« ${nom} » sort de [0, 1] à p=${p.toFixed(2)}`);
    }
    assert.ok(e.carte >= e.tuiles && e.tuiles >= e.reduit, `l’ordre des gestes s’inverse à p=${p.toFixed(2)}`);
    precedent = e;
  }
});

test('le bloc le plus tardif finit d’entrer exactement quand les autres ont fini', () => {
  // La feuille calcule l'avancement propre d'un bloc :
  //   --t: clamp(0, calc((var(--tuiles, 1) - var(--retard)) / X), 1)
  // Pour que le dernier bloc arrive AVEC les autres et pas après, X doit valoir
  // exactement 1 moins le plus grand retard. Le test lit les deux côtés plutôt que de
  // faire confiance au nombre écrit dans la feuille.
  const tardif = Math.max(...BLOCS.map((b) => b.retard));
  const diviseur = Number(CSS.match(/--t:\s*clamp\(0,\s*calc\(\(var\(--tuiles[^)]*\)\s*-\s*var\(--retard\)\)\s*\/\s*([\d.]+)\)/)[1]);
  assert.equal(Number((tardif + diviseur).toFixed(4)), 1,
    `le retard le plus grand (${tardif}) et le diviseur de la feuille (${diviseur}) ne tombent pas ensemble sur 1`);

  // Et les sept retards sont distincts et dans [0, 1[ : sinon deux blocs entrent collés.
  assert.equal(new Set(BLOCS.map((b) => b.retard)).size, 7);
  for (const b of BLOCS) assert.ok(b.retard >= 0 && b.retard < 1, `${b.aire} : retard hors de [0, 1[`);
});

test('le module écrit exactement les variables que la feuille lit', () => {
  const ecrites = new Set(['p', ...Object.keys(etapes(0))]);

  // Ce que la feuille lit, dans les règles de la mosaïque seulement.
  const lues = new Set();
  for (const r of REGLES) {
    if (!r.selecteurs.some((s) => s.includes('ds-mosaique') || s.includes('ds-tuile'))) continue;
    for (const m of r.corps.matchAll(/var\(\s*--(p|carte|tuiles|reduit)\b/g)) lues.add(m[1]);
  }
  assert.deepEqual([...lues].sort(), [...ecrites].filter((n) => n !== 'p').sort(),
    'la feuille et le module ne parlent pas des mêmes variables');

  // `--p` est écrit pour qu'on puisse le lire dans un inspecteur ; la feuille ne s'en sert pas.
  assert.ok(MODULE.includes('p,'), 'le module n’écrit plus --p');

  // `--entete` ne vient pas de l'avancement : c'est la hauteur mesurée de l'en-tête collant.
  // Les deux côtés doivent exister, sinon l'en-tête recouvre la première rangée de blocs.
  assert.match(MODULE, /setProperty\('--entete'/, 'le module ne mesure plus l’en-tête');
  assert.equal(declaration('.ds-mosaique__scene', 'top'), 'var(--entete, 0px)');
  assert.equal(declaration('.ds-mosaique__scene', 'height'), 'calc(100vh - var(--entete, 0px))');
});

// ---- Le repli : sans JS, sans mouvement, en étroit, au clavier ----

test('chaque lecture d’avancement a 1 pour valeur de repli', () => {
  // Sans le module, aucune de ces variables n'existe. Chaque `var()` doit donc porter son
  // repli, sinon la mosaïque reste invisible et ses sept liens avec elle.
  const sansRepli = [];
  for (const r of REGLES) {
    for (const m of r.corps.matchAll(/var\(\s*--(carte|tuiles|reduit)\s*(,\s*([^)]*))?\)/g)) {
      if (!m[2] || m[3].trim() !== '1') sansRepli.push(`${r.selecteurs.join(', ')} → --${m[1]}`);
    }
  }
  assert.deepEqual(sansRepli, [], 'ces lectures n’ont pas 1 pour repli : sans JavaScript, la mosaïque ne se monte pas');

  // Et la section les pose à 1 d'entrée, pour le cas où le module se charge mais échoue.
  assert.equal(declaration('.ds-mosaique', '--tuiles'), '1');
  assert.equal(declaration('.ds-mosaique', '--carte'), '1');
  assert.equal(declaration('.ds-mosaique', '--reduit'), '1');
});

test('mouvement réduit, écran étroit et clavier montrent la mosaïque montée', () => {
  // Les trois cas où le déroulé n'a pas lieu : le clavier, l'écran étroit, le mouvement
  // réduit. Dans les trois, `--tuiles` vaut 1 — les sept blocs sont à leur place, donc
  // cliquables et tabulables — et il le vaut en `!important`, parce que le module écrit
  // l'avancement en style EN LIGNE, qui bat sinon n'importe quelle règle de feuille.
  const montages = REGLES.filter((r) => r.selecteurs.some((s) => s === '.ds-mosaique' || s === '.ds-mosaique:focus-within')
    && /--tuiles\s*:/.test(r.corps));
  // La déclaration par défaut de la section, plus les trois états.
  assert.equal(montages.length, 4, `${montages.length} règles posent --tuiles : il en faut quatre`);
  const surcharges = montages.filter((r) => /!important/.test(r.corps));
  assert.equal(surcharges.length, 3, 'les états qui court-circuitent le déroulé ne passent pas devant le style en ligne');
  for (const r of montages) assert.match(r.corps, /--tuiles:\s*1\b/, `${r.selecteurs.join(', ')} ne monte pas la mosaïque`);

  // Et les deux blocs qui rendent sa hauteur à la piste quand il n'y a rien à dérouler.
  const sansPiste = REGLES.filter((r) => r.selecteurs.includes('.ds-mosaique__piste') && /height:\s*auto/.test(r.corps));
  assert.equal(sansPiste.length, 2, 'la piste ne rend pas ses trois écrans en mouvement réduit ET en étroit');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ds-mosaique__piste \{ height: auto; \}/);
});

// ---- Le balisage et la pose sur l'accueil ----

test('la mosaïque s’annonce par sa première phrase, dans l’ordre où on la lit', () => {
  const html = mosaiqueHtml();

  // La section est nommée par la phrase d'ouverture, et cette phrase porte bien cet id.
  const nomme = html.match(/<section class="ds-mosaique" aria-labelledby="([\w-]+)"/)[1];
  assert.ok(html.includes(`id="${nomme}"`), `aria-labelledby pointe vers « ${nomme} », qui n’existe pas dans la mosaïque`);
  assert.ok(html.includes(`id="${nomme}"`) && html.includes(OUVERTURE[0]), 'la phrase d’ouverture a changé sans son id');

  // L'ordre du balisage est l'ordre de lecture : la phrase qui nomme la section, les blocs,
  // puis l'invitation à faire défiler.
  assert.ok(html.indexOf('ds-mosaique__carte') < html.indexOf('ds-mosaique__grille'),
    'les blocs viennent avant la phrase qui nomme la section');
  assert.ok(html.indexOf('ds-mosaique__grille') < html.indexOf('ds-mosaique__repere'),
    'l’invitation à faire défiler se lit avant les blocs');

  // Les sept liens, dans l'ordre des blocs.
  const liens = [...html.matchAll(/<a class="ds-tuile[^"]*" style="[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(liens, BLOCS.map((b) => b.href));

  // Les deux phrases sont là, et la seconde est cachée aux lecteurs d'écran : elle redit
  // la première autrement, elle ne s'ajoute pas à elle.
  assert.ok(html.includes(OUVERTURE[1]));
  assert.match(html.match(/<p class="ds-mosaique__phrase ds-mosaique__phrase--deux"[^>]*>/)[0], /aria-hidden="true"/);

  // Le logo de l'ouverture porte un texte de remplacement ; les trois autres images, non.
  assert.match(html, /<img class="ds-mosaique__logo"[^>]*alt="MyDigitalSchool"/);
});

test('les adresses de la mosaïque suivent la règle du site', () => {
  // Même convention que `chrome.js` : les adresses sont relatives à `design-system/`, et
  // le préfixe se met devant. Rien ne commence par une barre oblique.
  const html = mosaiqueHtml('../');
  assert.ok(html.includes('href="../composants/demarrer.html"'));
  assert.ok(html.includes('src="../assets/logo.svg"'));
  assert.equal([...mosaiqueHtml().matchAll(/(?:href|src)="\//g)].length, 0, 'une adresse absolue s’est glissée dans la mosaïque');
});

test('la landing ne porte que la mosaïque : ni en-tête, ni pied, ni rien en dessous', () => {
  // C'est la demande : on ne voit pas le menu en haut, pas le reste de la page en dessous,
  // et on en sort en cliquant un bloc. Chaque morceau du chrome est donc ABSENT du fichier.
  assert.ok(LANDING.includes('<div id="mosaique"></div>'), 'la landing n’a plus de point de pose');
  assert.ok(!LANDING.includes('id="entete"'), 'la landing pose un en-tête');
  assert.ok(!LANDING.includes('id="pied"'), 'la landing pose un pied');
  assert.ok(!LANDING.includes('chrome.js'), 'la landing charge le chrome du site');
  assert.match(LANDING, /import \{ mosaiqueHtml, brancherMosaique \} from '\.\/js\/mosaique\.js';/);
  assert.match(LANDING, /document\.getElementById\('mosaique'\)\.outerHTML = mosaiqueHtml\(\);/);
  assert.match(LANDING, /brancherMosaique\(\);/);

  // Et rien d'autre dans son <main> : le seul élément du corps est le point de pose.
  const corps = LANDING.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  assert.equal(corps.replace(/<div id="mosaique"><\/div>/, '').trim(), '',
    'la landing porte autre chose que la mosaïque');

  // La landing a son propre <h1>, et c'est la phrase d'ouverture : sans en-tête ni hero,
  // c'est la seule chose qui nomme la page.
  const html = mosaiqueHtml();
  assert.equal((html.match(/<h1\b/g) || []).length, 1, 'la mosaïque n’a pas exactement un h1');
  assert.match(html, new RegExp(`<h1[^>]*>${OUVERTURE[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`));

  // La réserve du site reste au pied des autres pages, et nulle part ici : la landing est
  // une porte, pas une page de texte. C'est une demande, pas un oubli.
  assert.ok(!html.includes(RESERVE), 'la réserve du site est revenue sur la landing');
  assert.ok(!CSS.includes('ds-mosaique__reserve'), 'la feuille habille encore une bande qui n’existe plus');
});

// Le contenu d'un bloc `@media`, par comptage d'accolades : `REGLES` ne dit pas dans quel
// bloc une règle se trouve, et c'est justement la question ici.
function bloc(entete) {
  const debut = CSS.indexOf(entete);
  if (debut < 0) return '';
  const ouvrante = CSS.indexOf('{', debut);
  let profondeur = 0;
  for (let j = ouvrante; j < CSS.length; j++) {
    if (CSS[j] === '{') profondeur++;
    else if (CSS[j] === '}' && --profondeur === 0) return CSS.slice(ouvrante + 1, j);
  }
  return '';
}

test('les gestes au survol répondent au clavier, et n’existent pas en mouvement réduit', () => {
  const survols = REGLES.flatMap((r) => r.selecteurs).filter((s) => s.includes('.ds-tuile') && s.includes(':hover'));
  // Sept blocs, dont deux dont le geste tient en deux règles : les formes de « Brand
  // guidelines » qui échangent leur rayon, et les disques de « Couleurs » qui s'écartent
  // chacun de son côté.
  assert.equal(survols.length, 9, `${survols.length} sélecteurs de survol : il en faut neuf`);

  // Un bloc est un LIEN : on y arrive à la souris ou au clavier, et le geste doit être le
  // même. Chaque règle de survol a donc sa jumelle en `:focus-visible`.
  for (const s of survols) {
    const clavier = s.replace(':hover', ':focus-visible');
    assert.ok(REGLES.some((r) => r.selecteurs.includes(clavier)), `${s} n’a pas de jumeau au clavier`);
  }

  // Et tout vit sous `no-preference` : quand le système demande moins de mouvement, ces
  // règles n'existent pas du tout. Couper la seule transition laisserait le signe changer
  // d'un coup, ce qui est encore du mouvement.
  const gestes = bloc('@media (prefers-reduced-motion: no-preference)');
  for (const s of survols) {
    assert.ok(gestes.includes(s), `${s} s’applique même quand on demande moins de mouvement`);
  }

  // Les deux signes dont les formes se déplacent sortent de leur `viewBox`, qui les serre
  // de près. Un SVG rogne net ce qui dépasse : sans ça, le disque de gauche et la barre la
  // plus longue arrivaient coupés à mi-chemin.
  assert.equal(declaration('.ds-tuile--couleurs .ds-tuile__signe', 'overflow'), 'visible');
  assert.equal(declaration('.ds-tuile--composants .ds-tuile__signe', 'overflow'), 'visible');
});

test('la frappe écrit le texte lettre par lettre, et ne pousse rien au repos', () => {
  const frappe = mosaiqueHtml().match(/<span class="ds-tuile__frappe">([\s\S]*?)<\/span>»/)[1];
  const lettres = [...frappe.matchAll(/<span style="--i: (\d+)">(.*?)<\/span>/g)];

  // Une lettre par caractère, rangées dans l'ordre : c'est le rang qui fait la frappe, la
  // feuille ne fait qu'attendre `--i` fois le pas.
  assert.equal(lettres.length, [...FRAPPE].length, 'il n’y a pas un élément par caractère');
  assert.deepEqual(lettres.map((m) => Number(m[1])), lettres.map((_, i) => i), 'les rangs ne se suivent pas');
  assert.equal(lettres.map((m) => m[2]).join('').replace(/&#160;/g, ' '), FRAPPE, 'le texte frappé n’est pas celui du module');

  // Au repos chaque lettre a une largeur nulle : les deux guillemets restent collés, comme
  // avant qu'il y ait quelque chose à écrire entre eux.
  assert.equal(declaration('.ds-tuile__frappe > span', 'max-width'), '0');
});

test('la phrase rétrécit avec la carte, et le logo se centre dans ce qu’il en reste', () => {
  // La phrase suit la carte qui se referme et finit à rien : à la fin, le petit carré ne
  // porte plus que le logo. Elle part donc par sa taille, pas seulement par son opacité.
  assert.match(declaration('.ds-mosaique__phrase', 'transform') || '', /scale\(\s*calc\(\s*1 - var\(--reduit, 1\)\s*\)\s*\)/,
    'la phrase ne rétrécit plus avec la carte');
  assert.equal(declaration('.ds-mosaique__phrase', 'transform-origin'), 'top left',
    'la phrase ne rétrécit pas depuis le coin de la carte qui ne bouge pas');

  // Le logo, seul dans le carré final, s'y centre : la marge gauche vaut la moitié de la
  // place qui reste, et elle est nulle tant que la carte n'a pas commencé à se replier.
  const marge = declaration('.ds-mosaique__logo', 'margin-left') || '';
  assert.match(marge, /var\(--logo-largeur\)/, 'la marge du logo ne se déduit plus de sa largeur');
  assert.match(marge, /var\(--reduit, 1\)/, 'le logo est décalé même quand la carte est grande');
});

test('l’invitation à faire défiler porte son mot, et son va-et-vient s’arrête quand on le demande', () => {
  const repere = mosaiqueHtml().match(/<span class="ds-mosaique__repere"[^>]*>[\s\S]*?<\/svg>\s*<\/span>/)[0];
  // Le mot et la flèche disent la même chose, et la flèche n'est que du décor : les deux
  // restent donc hors de la lecture d'écran, qui ne fait pas défiler de toute façon.
  assert.ok(repere.includes('>SCROLL<'), 'l’invitation à faire défiler a perdu son mot');
  assert.match(repere, /aria-hidden="true"/);

  // Le va-et-vient est dans la feuille, pas dans le module, et il s'arrête sous
  // `prefers-reduced-motion` : il ne porte rien que la flèche immobile ne dise déjà.
  const anim = declaration('.ds-mosaique__repere svg', 'animation');
  assert.ok(anim && anim.startsWith('ds-repere '), `la flèche ne bouge plus (animation: ${anim})`);
  assert.match(CSS, /@keyframes ds-repere\b/, 'l’animation de la flèche n’est définie nulle part');
  const reduit = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduit, /\.ds-mosaique__repere svg \{ animation: none; \}/,
    'le va-et-vient continue quand le système demande moins de mouvement');
});

test('l’accueil du guide a gardé son contenu, et ne porte plus la mosaïque', () => {
  const guide = lire(ACCUEIL);
  assert.match(guide, /Les talents se connectent/);
  assert.match(guide, /class="ds-etage ds-etage--marque"/);
  assert.ok(!guide.includes('mosaique'), 'l’accueil du guide pose encore la mosaïque');
  assert.match(guide, new RegExp(`enteteHtml\\('${ACCUEIL}'\\)`), 'l’accueil du guide ne se marque pas comme page courante');
});

// ---- Le branchement ----

test('brancherMosaique écrit l’avancement, et le recalcule au défilement', () => {
  // Un faux document : juste ce que le module touche.
  const poses = {};
  const section = {
    style: { setProperty: (nom, v) => { poses[nom] = v; } },
    querySelector: () => piste,
  };
  let haut = 0;
  const piste = { getBoundingClientRect: () => ({ top: haut, height: 4000 }) };
  const entete = { getBoundingClientRect: () => ({ height: 61 }) };
  const doc = { querySelector: (s) => (s === '.ds-entete' ? entete : section) };
  const ecoutes = {};
  const defilements = [];
  const fenetre = {
    innerHeight: 1000,
    history: {},
    scrollTo: (x, y) => defilements.push([x, y]),
    addEventListener: (nom, fn) => { ecoutes[nom] = fn; },
  };

  brancherMosaique(doc, fenetre);

  // La page s'ouvre toujours sur son premier écran. Sans ça, le navigateur rend sa position
  // d'avant au rechargement et la mosaïque reprend à moitié déroulée.
  assert.equal(fenetre.history.scrollRestoration, 'manual');
  assert.deepEqual(defilements, [[0, 0]], 'la landing ne remonte pas en haut au chargement');
  ecoutes.pageshow();
  assert.deepEqual(defilements, [[0, 0], [0, 0]], 'le retour depuis le cache de navigation laisse la page où elle était');

  // Au départ, en haut de la piste : rien n'a commencé.
  assert.equal(poses['--p'], '0.0000');
  assert.equal(poses['--tuiles'], '0.0000');
  // La hauteur de l'en-tête collant, en pixels : la scène s'y cale dessous.
  assert.equal(poses['--entete'], '61px');

  // La course utile vaut 4000 - 1000 = 3000. À -1500, on est à la moitié.
  haut = -1500;
  ecoutes.scroll();
  assert.equal(poses['--p'], '0.5000');
  assert.equal(poses['--carte'], etapes(0.5).carte.toFixed(4));

  // Au-delà du bout de la piste, tout reste fini : la mosaïque ne se défait pas.
  haut = -9000;
  ecoutes.scroll();
  assert.equal(poses['--p'], '1.0000');
  assert.equal(poses['--reduit'], '1.0000');

  // Le redimensionnement recalcule aussi : une fenêtre plus haute change la course.
  assert.ok(typeof ecoutes.resize === 'function', 'le redimensionnement n’est pas suivi');

  // Un écran plus haut que la piste : plus de course du tout, donc l'état final.
  haut = 0;
  fenetre.innerHeight = 5000;
  ecoutes.resize();
  assert.equal(poses['--p'], '1.0000');
});

test('sans mosaïque dans la page, brancherMosaique ne touche à rien', () => {
  // Les autres pages du site ne la posent pas : le module ne doit pas lever chez elles.
  assert.doesNotThrow(() => brancherMosaique({ querySelector: () => null }, {}));
  assert.doesNotThrow(() => brancherMosaique({ querySelector: () => ({ querySelector: () => null }) }, {}));
});
