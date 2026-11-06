// Ce que le registre des correctifs (`docs/correctifs-figma.md`) affirme sur le code, comparé au code.
//
// Chaque phrase du registre qui dit « il n'y a pas de X » ou « la règle Y vise A et B » est ici
// relue contre les sources : la recherche qui la fonde est rejouée. Un test qui tombe dit que le
// code a changé (le manque est peut-être comblé, et la ligne du registre doit sortir de « À faire »),
// pas que le test est cassé.
//
// Ce que ces tests ne tiennent pas : ce qu'on voit et entend. Qu'un interrupteur focalisé ne montre
// rien, qu'une ligne ne se tabule pas, se constate dans un navigateur ; le rapport de la tâche dit
// ce qui y a été vu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ratio } from '../design-system/js/contraste.js';
import { valeursDepuis } from '../design-system/js/tokens.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const VALEURS = valeursDepuis(lire('css/tokens.css'));
// Le registre est écrit en lignes de 100 colonnes : une phrase peut y changer de ligne.
const BRUT = lire('docs/correctifs-figma.md');
const REGISTRE = BRUT.replace(/\s+/g, ' ');
// Les lignes de tableau du registre, une par ligne du fichier.
const LIGNES = BRUT.split('\n').filter((l) => l.trim().startsWith('|'));
const A_FAIRE = REGISTRE.slice(REGISTRE.indexOf('## À faire'), REGISTRE.indexOf('## Divergences'));

// L'outil : ses scripts, ses feuilles, ses pages de la racine. Pas le site de documentation, qui
// parle de ces manques sans les avoir.
const fichiersOutil = () => [
  ...readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
  ...readdirSync(new URL('../css/', import.meta.url)).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`),
  ...readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html')),
];
const OUTIL = fichiersOutil().map((chemin) => ({ chemin, source: lire(chemin) }));
const contenant = (motif) => OUTIL.filter((f) => motif.test(f.source)).map((f) => f.chemin);

// Le corps de la première règle dont la liste de sélecteurs contient exactement `selecteur`.
function regle(css, selecteur) {
  for (const m of sansCommentaires(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).includes(selecteur)) return m[2];
  }
  return null;
}
const COMPONENTS = lire('css/components.css');
const ADMIN = lire('css/admin.css');
const MOBILE = lire('css/mobile.css');
const virgule = (a, b) => `${ratio(VALEURS[a], VALEURS[b]).toFixed(2).replace('.', ',')}:1`;

// ---- Clavier et lecteur d'écran ----

test('registre : aucun tabindex ni aria-sort dans l’outil, et lignes et en-têtes sont bien des éléments non focalisables', () => {
  assert.deepEqual(contenant(/tabindex/i), [], 'l’outil pose un tabindex : le registre doit dire lesquels');
  assert.deepEqual(contenant(/aria-sort/), [], 'l’outil pose aria-sort : le registre doit changer');
  const table = lire('js/admin/table.js');
  assert.match(table, /<th\$\{attrs\}>/, 'l’en-tête n’est plus un <th>');
  assert.match(table, /data-sortable/);
  assert.match(table, /<tr\$\{href \? ` data-href=/);
  // Le clic est le seul geste branché : ni keydown ni keyup dans le fichier.
  assert.doesNotMatch(table, /keydown|keyup|keypress/);
  assert.match(table, /th\[data-sortable\]'\)\.forEach\(\(th\) => th\.addEventListener\('click'/);
  assert.match(table, /tr\[data-href\]'\)\.forEach\(\(tr\) => tr\.addEventListener\('click'/);
  // Les cartes-lignes du tableau de bord et de la maintenance sont des <div> : même défaut.
  assert.match(lire('js/admin/views/dashboard.js'), /<div class="list__item" data-href=/);
  assert.match(lire('js/admin/views/maintenance.js'), /<div class="list__item" data-href=/);
  for (const dit of ['tr[data-href]', 'th[data-sortable]', 'aria-sort', 'tabindex', 'js/admin/table.js', '.list__item']) {
    assert.ok(A_FAIRE.includes(dit), `le registre ne dit pas « ${dit} »`);
  }
});

test('registre : l’interrupteur cache sa case et aucune règle de focus ne le vise', () => {
  const cache = regle(COMPONENTS, '.toggle input');
  assert.match(cache, /opacity:\s*0/);
  assert.match(cache, /width:\s*0/);
  assert.match(cache, /height:\s*0/);
  // Les règles de focus de toutes les feuilles de l'outil : aucune ne mentionne .toggle.
  const focus = [];
  for (const [nom, css] of [['components.css', COMPONENTS], ['admin.css', ADMIN], ['mobile.css', MOBILE], ['base.css', lire('css/base.css')]]) {
    for (const m of sansCommentaires(css).matchAll(/([^{}]+)\{[^{}]*\}/g)) if (/:focus/.test(m[1])) focus.push(`${nom} : ${m[1].trim().replace(/\s+/g, ' ')}`);
  }
  assert.ok(focus.length >= 2, 'le détecteur ne voit plus les règles de focus');
  assert.deepEqual(focus.filter((s) => /toggle/.test(s)), [], 'une règle de focus vise l’interrupteur : le registre doit changer');
  assert.deepEqual(contenant(/class="toggle"/), ['js/admin/views/utilisateurs.js'], 'l’interrupteur a changé d’emploi : le registre doit le dire');
  for (const dit of ['.toggle', 'opacity: 0', 'js/admin/views/utilisateurs.js']) assert.ok(A_FAIRE.includes(dit), `le registre ne dit pas « ${dit} »`);
});

test('registre : aria-invalid marque .input et .select, pas .textarea, et aucun écran ne le pose', () => {
  const m = sansCommentaires(COMPONENTS).match(/([^{}]*aria-invalid[^{}]*)\{/);
  const selecteurs = m[1].split(',').map((s) => s.trim());
  assert.deepEqual(selecteurs, ['.input[aria-invalid="true"]', '.select[aria-invalid="true"]']);
  assert.deepEqual(contenant(/aria-invalid/).filter((f) => f.startsWith('js/') || f.endsWith('.html')), [], 'un écran pose aria-invalid : le registre doit dire où');
  assert.ok(A_FAIRE.includes('.textarea'));
  assert.ok(A_FAIRE.includes('aria-invalid'));
});

test('registre : la barre mobile n’écrit pas aria-current, et ses tailles sont celles que le registre dit', () => {
  const layout = lire('js/mobile/layout.js');
  assert.doesNotMatch(layout, /aria-current/);
  assert.match(layout, /m-nav__tab\$\{isActive\(t\.path, currentPath\) \? ' m-nav__tab--active' : ''\}/, 'la barre marque l’onglet courant autrement : le registre doit changer');
  const taille = (css, sel) => Number((regle(css, sel).match(/(?:^|;)\s*font-size:\s*(\d+)px/) || [])[1]);
  assert.equal(taille(MOBILE, '.m-nav__tab'), 10);
  assert.equal(taille(MOBILE, '.week-grid th'), 10);
  assert.equal(taille(MOBILE, '.week-grid .slot'), 9);
  assert.match(regle(MOBILE, '.m-header__back'), /width:\s*36px;\s*height:\s*36px/);
  assert.match(regle(MOBILE, '.seg__btn'), /height:\s*36px/);
  // Aucune des cibles de 36 px n'est dans la barre : sa règle ne fixe aucune hauteur de cible.
  assert.doesNotMatch(regle(MOBILE, '.m-nav__tab'), /\b(?:width|height):\s*3\d/);
  for (const dit of ['js/mobile/layout.js', 'aria-current', '.m-nav__tab', '.week-grid .slot', '.week-grid th', '.m-header__back', '.seg__btn', '68 × 67']) {
    assert.ok(A_FAIRE.includes(dit), `le registre ne dit pas « ${dit} »`);
  }
});

// ---- Cinq paires de contraste que la page Couleurs ne publie pas ----

test('registre : les cinq paires vérifiées dans les vues, avec leur ratio recalculé et leur émetteur', () => {
  // [sélecteur de la feuille, fichier de la feuille, texte, fond, taille, où la vue l'émet]
  const paires = [
    ['.nav-item__count', COMPONENTS, '--text-secondary', '--bg-canvas', 11, ['js/admin/layout.js']],
    ['.sidebar__section', ADMIN, '--text-disabled', '--bg-surface', 10, ['js/admin/layout.js']],
    ['.page-header__meta', ADMIN, '--text-secondary', '--bg-canvas', 14, ['js/admin/views/emprunts.js', 'js/admin/views/materiel.js', 'js/admin/views/materielFiche.js', 'js/admin/views/utilisateurFiche.js', 'js/admin/views/utilisateurs.js']],
    ['.input::placeholder', COMPONENTS, '--text-disabled', '--bg-surface', 14, ['js/admin/views/utilisateurs.js']],
    ['.field__error', COMPONENTS, '--feedback-error', '--bg-surface', 11, []],
  ];
  for (const [selecteur, css, texte, fond, px, vues] of paires) {
    const corps = regle(css, selecteur);
    assert.ok(corps, `${selecteur} n’a plus de règle`);
    assert.ok(corps.includes(`color: var(${texte})`), `${selecteur} : le texte n’est plus ${texte}`);
    if (!/placeholder|field__error/.test(selecteur)) assert.match(corps, new RegExp(`font-size:\\s*${px}px`), `${selecteur} n’est plus à ${px} px`);
    // Où elle est émise : chaque vue citée porte bien la classe, et aucune autre vue ne la porte.
    const classe = selecteur.replace(/^\./, '').replace(/::placeholder$/, '');
    if (selecteur.includes('placeholder')) {
      for (const v of vues) assert.match(lire(v), /\bplaceholder=/);
    } else {
      assert.deepEqual(contenant(new RegExp(`\\b${classe}\\b`)).filter((f) => f.startsWith('js/')).sort(), [...vues].sort(), `${selecteur} n’est pas émis par les vues que le registre cite`);
    }
    // Le ratio, recalculé depuis tokens.css, figure au registre sur la ligne du sélecteur.
    const attendu = virgule(texte, fond);
    const ligne = LIGNES.find((l) => l.includes(`\`${selecteur}\``));
    assert.ok(ligne, `le registre ne nomme pas ${selecteur}`);
    assert.ok(ligne.includes(attendu), `le registre ne donne pas ${attendu} pour ${selecteur}`);
    assert.ok(ligne.includes(`\`${texte}\``) && ligne.includes(`\`${fond}\``), `le registre ne nomme pas les tokens de ${selecteur}`);
    assert.ok(ligne.includes(`${px} px`), `le registre ne dit pas la taille de ${selecteur}`);
  }
  // Le fond du placeholder et celui du champ sont bien --bg-surface ; le compteur est bien posé sur --bg-canvas.
  assert.match(regle(COMPONENTS, '.input'), /background:\s*var\(--bg-surface\)/);
  assert.match(regle(COMPONENTS, '.nav-item__count'), /background:\s*var\(--bg-canvas\)/);
  // Le rouge d'erreur : le registre dit aussi ce qu'il devient sur le gris de l'application.
  assert.ok(A_FAIRE.includes(`${virgule('--feedback-error', '--bg-canvas')}`), 'le registre ne donne pas le rouge d’erreur sur --bg-canvas');
  // `.field__error` : aucun écran ne le pose. C'est le kit qui le définit, et le registre le dit.
  assert.deepEqual(contenant(/field__error/).filter((f) => !f.startsWith('css/')), []);
  assert.match(LIGNES.find((l) => l.includes('`.field__error`')), /aucun écran/);
  // Les paires sont bien sous le seuil : c'est le sens du registre.
  for (const [t, f] of [['--text-secondary', '--bg-canvas'], ['--text-disabled', '--bg-surface'], ['--feedback-error', '--bg-surface']]) {
    assert.ok(ratio(VALEURS[t], VALEURS[f]) < 4.5, `${t} sur ${f} passe maintenant 4,5:1 : le registre doit changer`);
  }
});

test('registre : .text-error et .text-success sont définies et posées par aucune vue', () => {
  assert.match(lire('css/base.css'), /\.text-error\s*\{\s*color:\s*var\(--feedback-error\)/);
  assert.match(lire('css/base.css'), /\.text-success\s*\{\s*color:\s*var\(--feedback-success\)/);
  assert.deepEqual(contenant(/text-error|text-success/).filter((f) => f !== 'css/base.css'), [], 'une vue emploie .text-error ou .text-success : la vérifier, puis la publier');
  assert.ok(A_FAIRE.includes('posées par aucune vue'));
  assert.ok(A_FAIRE.includes(`\`.text-error\` (${virgule('--feedback-error', '--bg-surface')} sur blanc)`));
  assert.ok(A_FAIRE.includes(`\`.text-success\` (${virgule('--feedback-success', '--bg-surface')})`));
});
