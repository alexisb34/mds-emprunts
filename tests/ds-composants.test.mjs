// Les pages de composants des Tasks 10 à 13 : Badge et étiquette, Avatar, Formulaires, Cartes,
// Tableau, Carte KPI, Navigation, Icônes, Modale et retours, Mobile (et Démarrer).
//
// Ce que ce fichier tient, et ce qu'il ne tient pas :
//   - il LIT components.css, admin.css, mobile.css, tokens.css et le code de l'outil (js/, les pages
//     à la racine) : chaque chose que le texte d'une page affirme du CSS ou du code est comparée à
//     ce CSS et à ce code, pas à une copie ;
//   - il APPELLE les vraies fonctions (`badge`, `avatar`, `renderTable`, `sidebarHtml`, `ICONS`) et
//     compare leur sortie au HTML des exemples, au blanc près ;
//   - il LIT le texte des pages : il vérifie qu'une phrase y est, pas qu'elle est juste ni qu'elle
//     convainc. L'exactitude vient de la comparaison au CSS et au code placée à côté ;
//   - il NE regarde PAS la page. Qu'un cadre se dimensionne, qu'un anneau se voie, qu'un tableau
//     déborde à 800 px : cela se voit dans un navigateur, et le rapport de la tâche dit ce qui y a
//     été vu.
import './helpers/storage.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { badge, avatar, openModal, closeModal, toast, escapeHtml } from '../js/ui.js';
import { LABELS } from '../js/models.js';
import { renderTable, sortRows, toggleSort, bindTable } from '../js/admin/table.js';
import { sidebarHtml } from '../js/admin/layout.js';
import { ICONS, headerHtml, bottomNavHtml } from '../js/mobile/layout.js';
import { reservationCardHtml, empruntsHtml } from '../js/mobile/views/emprunts.js';
import { resultsHtml } from '../js/mobile/views/login.js';
import { catalogueHtml, catalogueResultsHtml } from '../js/mobile/views/catalogue.js';
import { valeursDepuis } from '../design-system/js/tokens.js';
import { COMPOSANTS } from '../design-system/js/chrome.js';
import { PAIRES_KIT } from '../design-system/js/dette.js';
import { ratioExact } from '../design-system/js/contraste.js';
import { mesurePaire, mesureTexte, mesureNonTexte, valeursDe, poserMesures } from '../design-system/js/mesures.js';

// ---- Aides de lecture ----

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const DOSSIER_COMPOSANTS = new URL('../design-system/composants/', import.meta.url);
const sansCommentaires = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
const sansCss = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const page = (nom) => lire(`design-system/composants/${nom}.html`);
const exemple = (nom) => lire(`design-system/exemples/${nom}.html`);
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// Le texte d'une page, sans balises, sans commentaires, sans script : ce que le lecteur lit.
// Les balises en ligne (<code>, <strong>, <a>…) disparaissent sans laisser d'espace, les autres en laissent un :
// « <code>.chips</code>, qui » se lit « .chips, qui ».
const texte = (html) => decode(sansCommentaires(html).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<\/?(?:code|strong|em|a|span|b|i)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// Le contenu d'une section d'exemple.
const demo = (fichier, cle) => {
  const m = exemple(fichier).match(new RegExp(`<section data-demo="${cle}"[^>]*>([\\s\\S]*?)</section>`));
  assert.ok(m, `${fichier}#${cle} : section absente`);
  return m[1];
};
// Deux HTML sont « les mêmes » quand seuls les blancs entre balises diffèrent : un exemple est
// indenté pour se lire, `badge()` et `renderTable()` écrivent d'une traite.
const compact = (html) => html.replace(/>\s+</g, '><').replace(/\s+/g, ' ').replace(/disabled=""/g, 'disabled').trim();

const COMPONENTS = sansCss(lire('css/components.css'));
const ADMIN = sansCss(lire('css/admin.css'));
const MOBILE = sansCss(lire('css/mobile.css'));
const TOUT_LE_CSS = `${COMPONENTS}\n${ADMIN}\n${MOBILE}`;
const TOKENS = valeursDepuis(lire('css/tokens.css'));
// La règle d'un sélecteur exact, ou null.
const regle = (css, selecteur) => {
  const m = css.match(new RegExp(`(?:^|\\n)${selecteur.replace(/[.\\[\]()*+?^$|]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
};

const sourcesJs = () => readdirSync(new URL('../js/', import.meta.url), { recursive: true })
  .filter((f) => f.endsWith('.js')).map((f) => ({ fichier: `js/${f}`, source: lire(`js/${f}`) }));
const SOURCES = sourcesJs();
const RACINE_HTML = readdirSync(new URL('../', import.meta.url)).filter((f) => f.endsWith('.html'));
const utilise = (motif) => SOURCES.filter((s) => motif.test(s.source)).map((s) => s.fichier)
  .concat(RACINE_HTML.filter((f) => motif.test(lire(f))));

const PAGES_10 = ['badge', 'avatar', 'formulaires', 'cartes'];
const PAGES_11 = ['tableau', 'kpi', 'navigation', 'icones'];
const PAGES_12_13 = ['modale', 'mobile'];
const PAGES = [...PAGES_10, ...PAGES_11, ...PAGES_12_13];
// Les fichiers de design-system/exemples/ que ces pages montrent (Démarrer a le sien, sans page de composant à lui).
const EXEMPLES = [...PAGES_10, ...PAGES_11, 'onglets-admin', 'modale', 'mobile-shell', 'mobile-listes', 'demarrer'];

// ---- Les tests du brief, mot pour mot ----

test('chaque page de composant suit les six points de la trame', () => {
  for (const f of readdirSync(DOSSIER_COMPOSANTS).filter((f) => f.endsWith('.html') && f !== 'demarrer.html' && f !== 'fondations.html')) {
    const html = readFileSync(new URL(f, DOSSIER_COMPOSANTS), 'utf8');
    for (const ancre of ['a-quoi', 'exemple', 'variantes', 'code', 'quand-ne-pas', 'accessibilite']) {
      assert.match(html, new RegExp(`id="${ancre}"`), `${f} : section « ${ancre} » absente`);
    }
  }
});

test('toutes les variantes de badge du CSS sont montrées', () => {
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  const variantes = [...css.matchAll(/\.badge--([\w-]+)/g)].map((m) => m[1]);
  const exemple = readFileSync(new URL('../design-system/exemples/badge.html', import.meta.url), 'utf8');
  for (const v of new Set(variantes)) assert.match(exemple, new RegExp(`badge--${v}\\b`));
});

test('le tag — .chip — est documenté avec le badge, et distingué de lui', () => {
  // La page Figma s’appelle « Badge & Tag » : le .chip est le tag, et il est cliquable.
  const exemple = readFileSync(new URL('../design-system/exemples/badge.html', import.meta.url), 'utf8');
  assert.match(exemple, /class="chip"/);
  assert.match(exemple, /chip--active/);
  const page = readFileSync(new URL('../design-system/composants/badge.html', import.meta.url), 'utf8');
  assert.match(page, /\.chip/);
});

// ---- Ce que tiennent les huit pages ensemble ----

test('chaque page des tâches 10 à 13 existe avec son exemple, son h1 et son chrome', () => {
  for (const nom of PAGES) {
    assert.ok(existsSync(new URL(`${nom}.html`, DOSSIER_COMPOSANTS)), `composants/${nom}.html manque`);
    const html = page(nom);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${nom} : un seul h1`);
    assert.match(html, /id="contenu"/);
    assert.match(html, /brancherSommaire\(\)/);
    assert.match(html, /brancherCadres\(/);
    assert.match(html, new RegExp(`enteteHtml\\('composants/${nom}\\.html'\\)`));
    assert.match(html, new RegExp(`sommaireHtml\\('composants/${nom}\\.html'\\)`));
    assert.match(html, new RegExp(`piedHtml\\('composants/${nom}\\.html'\\)`));
    // Les cadres vivent dans leur exemple : la page ne charge que les feuilles de base et celle du site.
    assert.doesNotMatch(html, /<link[^>]*(?:components|admin|mobile)\.css/, `${nom} charge une feuille de composants`);
    assert.match(html, /href="\.\.\/css\/site\.css"/);
    const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
    assert.ok(famille >= 0 && famille < html.indexOf('href="../../css/tokens.css"'), `${nom} : les polices passent avant les feuilles`);
    assert.doesNotMatch(html, /(?:src|href)="\/[^/]/, `${nom} : chemin absolu`);
  }
});

test('chaque page a un fichier d’exemple, et les exemples des tâches 10 à 13 sont ceux qu’on attend', () => {
  for (const nom of EXEMPLES) assert.ok(existsSync(new URL(`../design-system/exemples/${nom}.html`, import.meta.url)), `exemples/${nom}.html manque`);
});

test('aucune page n’écrit de valeur de couleur en dur dans sa prose', () => {
  for (const nom of PAGES) {
    const corps = sansCommentaires(page(nom)).replace(/<script[\s\S]*?<\/script>/g, '');
    assert.deepEqual([...corps.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]), [], `${nom} : une valeur hexadécimale dans la prose`);
  }
});

test('aucune page ne pose d’étiquette en capitales au-dessus d’un titre', () => {
  for (const nom of PAGES) assert.doesNotMatch(page(nom), /label-(?:caps|mini-caps)[^>]*>[^<]*<\/[a-z]+>\s*<h[1-6]/, nom);
});

// Les noms que les pages disent ne pas exister : nommés pour être refusés, jamais pour être employés.
const INEXISTANTES = new Set(['kpi--brand', 'kpi--teal', 'avatar--lg', 'toast--info']);

test('toute classe à double tiret ou double souligné que la prose écrit existe dans une feuille du dépôt', () => {
  // Les pages parlent en noms de classes : `badge--late`, `nav-item__count`. Aucun ne doit être inventé.
  // Seules exceptions, listées ci-dessus : trois noms que les pages citent précisément parce qu'ils
  // n'existent pas — et un test plus bas vérifie qu'ils n'existent bel et bien nulle part.
  const motif = /(?<![\w-])\.?([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__[a-z0-9-]+)*(?:--[a-z0-9-]+)+|[a-z][a-z0-9-]*__[a-z0-9-]+)/g;
  let vus = 0;
  for (const nom of PAGES) {
    const corps = sansCommentaires(page(nom)).replace(/<script[\s\S]*?<\/script>/g, '');
    for (const [, dedans] of corps.matchAll(/<code>([^<]*)<\/code>/g)) {
      for (const [, classe] of decode(dedans).matchAll(motif)) {
        vus += 1;
        if (INEXISTANTES.has(classe)) continue;
        assert.match(TOUT_LE_CSS, new RegExp(`\\.${classe.replace(/[-_]/g, '\\$&')}(?![\\w-])`), `${nom} : « ${classe} » n'existe dans aucune feuille`);
      }
    }
  }
  assert.ok(vus >= PAGES.length * 7, `${vus} nom(s) de classe lus : le détecteur ne voit plus les pages`);
});

test('les quatre noms que les pages disent inexistants le sont, et le détecteur sait en refuser un', () => {
  for (const c of INEXISTANTES) assert.doesNotMatch(TOUT_LE_CSS, new RegExp(`\\.${c}(?![\\w-])`), `${c} existe maintenant : la page doit changer`);
  // Garde le test précédent honnête : un nom inventé n'est pas dans le CSS.
  assert.doesNotMatch(TOUT_LE_CSS, /\.badge--inventee(?![\w-])/);
});

test('chaque interdit de « Quand ne pas l’utiliser » est suivi d’une consigne', () => {
  // La sixième règle des relectures : un interdit dit vers quoi se tourner. Ce test cherche une
  // consigne dans chaque puce — un lien, un nom de classe, ou un verbe d'instruction. Il ne juge
  // pas que la consigne soit la bonne : cela se lit.
  const consigne = /<a href=|<code>|\b(?:mettez|employez|écrivez|gardez|regroupez|choisissez|décidez|passe|dessine|dessiner|définit|ajoutez)\b/i;
  let puces = 0;
  for (const nom of PAGES) {
    const html = page(nom);
    const section = html.slice(html.indexOf('id="quand-ne-pas"'), html.indexOf('id="accessibilite"'));
    for (const [, li] of section.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      puces += 1;
      assert.match(li, consigne, `${nom} : « ${texte(li).slice(0, 60)}… » interdit sans dire quoi faire à la place`);
    }
  }
  assert.ok(puces >= PAGES.length * 4, `${puces} puces lues : le détecteur ne voit plus les pages`);
});

test('chaque lien de page vise une page qui existe ou que le sommaire annonce', () => {
  // `modale.html` et `mobile.html` appartiennent aux tâches 12 et 13 : le sommaire les annonce déjà.
  const annoncees = new Set(COMPOSANTS.map((c) => c.href.replace(/^composants\//, '')));
  for (const nom of PAGES) {
    for (const [, cible] of sansCommentaires(page(nom)).matchAll(/href="([\w-]+\.html)(?:#[^"]*)?"/g)) {
      assert.ok(annoncees.has(cible) || existsSync(new URL(cible, DOSSIER_COMPOSANTS)), `${nom} : lien vers ${cible}, que rien n'annonce`);
    }
    for (const [, ancre] of sansCommentaires(page(nom)).matchAll(/href="bouton\.html#([\w-]+)"/g)) {
      assert.match(page('bouton'), new RegExp(`id="${ancre}"`), `${nom} : ancre #${ancre} absente de Bouton`);
    }
  }
});

test('chaque mesure que la prose annonce est alimentée par le script, et inversement', () => {
  // Une phrase « à mesurer depuis un serveur » dont aucun script ne remplit le champ resterait
  // affichée pour toujours ; un champ rempli que la page n'a pas serait une mesure perdue.
  let champs = 0;
  for (const nom of PAGES) {
    const html = page(nom);
    const ids = [...html.matchAll(/<strong id="(mesure-[\w-]+)">/g)].map((m) => m[1]);
    const script = html.slice(html.indexOf('poserMesures(document'));
    const cles = [...script.matchAll(/'(mesure-[\w-]+)':/g)].map((m) => m[1]);
    assert.deepEqual([...ids].sort(), [...cles].sort(), `${nom} : champs de mesure et script ne se correspondent pas`);
    champs += ids.length;
  }
  assert.ok(champs >= PAGES.length * 3, `${champs} champ(s) de mesure lus : le détecteur ne voit plus les pages`);
});

// ---- mesures.js ----

test('mesurePaire rend les chiffres que le registre publie, au centième', () => {
  assert.equal(mesurePaire(TOKENS, 'badge--late'), '3,54:1 — échoue');
  assert.equal(mesurePaire(TOKENS, 'badge--borrowed'), '8,23:1 — conforme');
  assert.equal(mesurePaire(TOKENS, 'table tr:hover'), '4,13:1 — échoue');
  assert.equal(mesurePaire(TOKENS, 'table th'), '4,55:1 — conforme');
  assert.equal(mesurePaire(TOKENS, 'kpi--retard'), '3,76:1 — échoue');
});

test('mesurePaire refuse une paire que le kit ne publie pas, et se tait quand un token manque', () => {
  assert.throws(() => mesurePaire(TOKENS, 'badge--inventee'), /Aucune paire nommée/);
  assert.equal(mesurePaire({}, 'badge--late'), null);
  assert.equal(mesurePaire(null, 'badge--late'), null);
});

test('mesureTexte juge à la taille donnée, et mesureNonTexte au seuil de 3:1', () => {
  assert.equal(mesureTexte(TOKENS, '--text-secondary', '--bg-surface', 11, true), '4,55:1 — conforme');
  assert.equal(mesureTexte(TOKENS, '--text-disabled', '--bg-surface', 14), '1,66:1 — échoue');
  assert.equal(mesureTexte(TOKENS, '--text-secondary', '--bg-canvas', 11), '4,13:1 — échoue');
  // 4,28:1 échoue pour du texte de 14 px non gras, et passe pour un élément sans texte.
  assert.match(mesureTexte(TOKENS, '--text-inverse', '--feedback-error', 14), /échoue/);
  assert.match(mesureNonTexte(TOKENS, '--text-inverse', '--feedback-error'), /^4,28:1 — conforme$/);
  assert.match(mesureNonTexte(TOKENS, '--text-disabled', '--bg-surface'), /échoue/);
  assert.equal(mesureTexte(TOKENS, '--inconnu', '--bg-surface', 11), null);
  assert.equal(mesureNonTexte(TOKENS, '--inconnu', '--bg-surface'), null);
});

test('valeursDe lit ce que lireTokensDepuisDocument rend, et refuse ce qui a échoué', () => {
  assert.equal(valeursDe(null), null);
  assert.equal(valeursDe({ ok: false, message: 'x' }), null);
  assert.deepEqual(valeursDe({ ok: true, groupes: [{ tokens: [{ nom: '--a', valeur: '#111111' }] }, { tokens: [{ nom: '--b', valeur: '#222222' }] }] }), { '--a': '#111111', '--b': '#222222' });
});

test('poserMesures remplit les champs qui existent et laisse la phrase de repli aux autres', () => {
  const champs = { 'mesure-a': { textContent: 'repli' }, 'mesure-b': { textContent: 'repli' } };
  poserMesures({ getElementById: (id) => champs[id] || null }, { 'mesure-a': '3,54:1 — échoue', 'mesure-b': null, 'mesure-absent': 'x' });
  assert.equal(champs['mesure-a'].textContent, '3,54:1 — échoue');
  assert.equal(champs['mesure-b'].textContent, 'repli', 'une mesure nulle ne doit pas effacer le repli');
});

// ======================= BADGE ET ÉTIQUETTE =======================

// Les familles de `badge()` et la clé de LABELS qui donne leurs libellés (ui.js : LABEL_FAMILY).
const FAMILLES = { item: 'itemState', loan: 'loanState', booking: 'bookingState', maint: 'maintState', circuit: 'circuit', role: 'role', derived: 'derived' };
// `en_retard` est une valeur de la famille `loan` que LABELS.loanState ignore : son libellé vient de `derived`.
const EN_PLUS = { loan: ['en_retard'] };

test('badge : l’exemple « familles » rend, ligne à ligne, ce que badge() rend', () => {
  const lignes = [...demo('badge', 'familles').matchAll(/<tr><td>(\w+)<\/td><td>(\w+)<\/td><td>(<span class="badge[\s\S]*?<\/span>)<\/td><\/tr>/g)]
    .map((m) => ({ kind: m[1], value: m[2], html: m[3] }));
  // Les lignes attendues : chaque valeur de chaque famille.
  const attendues = Object.entries(FAMILLES).flatMap(([kind, famille]) => [...Object.keys(LABELS[famille]), ...(EN_PLUS[kind] || [])].map((value) => `${kind}/${value}`));
  assert.ok(attendues.length >= 30, `${attendues.length} couples attendus : le détecteur a cessé de chercher`);
  assert.deepEqual(lignes.map((l) => `${l.kind}/${l.value}`), attendues, 'les lignes de l’exemple ne sont pas les couples que badge() connaît');
  for (const l of lignes) assert.equal(l.html, badge(l.kind, l.value), `${l.kind}/${l.value} : l’exemple ne rend pas ce que badge() rend`);
});

test('badge : la démonstration « produire » est exactement ce que rend badge(\'loan\', \'en_retard\')', () => {
  assert.equal(compact(demo('badge', 'produire')), badge('loan', 'en_retard'));
});

test('badge : une valeur inconnue devient grise et montre sa valeur brute, comme la page le dit', () => {
  assert.equal(badge('item', 'perdu'), '<span class="badge badge--hs">perdu</span>');
  const t = texte(page('badge'));
  assert.match(t, /badge\('item', 'perdu'\) rend un badge--hs qui affiche « perdu »/);
  assert.match(t, /Une valeur inconnue ne casse rien : elle devient grise/);
});

test('badge : la même valeur n’a pas la même teinte d’une famille à l’autre, comme la page le dit', () => {
  assert.match(badge('loan', 'en_cours'), /badge--borrowed/);
  assert.match(badge('maint', 'en_cours'), /badge--maintenance/);
  assert.match(texte(page('badge')), /« En cours » est violet pour un emprunt et jaune pour une intervention de maintenance/);
});

test('badge : les sept familles sont nommées sur la page', () => {
  const html = page('badge');
  for (const kind of Object.keys(FAMILLES)) assert.match(html, new RegExp(`<code>${kind}</code>`), `la famille « ${kind} » n’est pas nommée`);
});

test('badge : la page affiche les six paires du badge, celles que le kit publie', () => {
  const html = page('badge');
  const paires = PAIRES_KIT.filter((p) => p.famille === 'badge').map((p) => p.nom);
  assert.equal(paires.length, 6);
  for (const nom of paires) {
    const variante = nom.replace('badge--', '');
    assert.match(html, new RegExp(`id="mesure-${variante}"`), `${nom} n’est pas mesuré sur la page`);
    assert.match(html, new RegExp(`mesurePaire\\(valeurs, '${nom}'\\)`), `${nom} : le script ne le mesure pas`);
  }
});

test('badge : les hauteurs que la page écrit, 22 et 28 px, sont celles de la feuille', () => {
  assert.match(regle(COMPONENTS, '.badge'), /height:\s*22px/);
  assert.match(regle(COMPONENTS, '.chip'), /height:\s*28px/);
  const t = texte(page('badge'));
  assert.match(t, /Le badge fait 22 px de haut, l’étiquette 28 px/);
  assert.match(t, /Une étiquette fait 28 px de haut/);
});

test('badge : l’étiquette n’a que deux règles — repos et active —, et la page le dit', () => {
  const selecteurs = [...COMPONENTS.matchAll(/(?:^|\n)([^{}\n]*\.chip[^{}\n]*)\{/g)].map((m) => m[1].trim());
  assert.deepEqual(selecteurs, ['.chip', '.chip--active'], 'une règle d’état de .chip existe maintenant : la page doit le dire');
  assert.match(texte(page('badge')), /Aucun état pour l’étiquette autre que « active »/);
});

test('badge : l’étiquette est un bouton que l’outil pose sans aria-pressed, et la page le dit', () => {
  const catalogue = lire('js/mobile/views/catalogue.js');
  assert.match(catalogue, /<button type="button" class="chip/);
  assert.doesNotMatch(catalogue, /aria-pressed/);
  assert.deepEqual(utilise(/aria-pressed/), [], 'quelqu’un pose aria-pressed : la page doit changer');
  assert.match(texte(page('badge')), /ne pose pas aria-pressed/);
});

test('badge : .chips vient de mobile.css, pas de la feuille des composants', () => {
  assert.match(MOBILE, /\.chips\s*\{/);
  assert.doesNotMatch(COMPONENTS, /\.chips\s*\{/);
  assert.match(texte(page('badge')), /<code>\.chips<\/code>, qui vient de <code>css\/mobile\.css<\/code>|\.chips, qui vient de css\/mobile\.css/);
});

test('badge : l’exemple n’écrit pas .chips, que sa feuille ne définit pas', () => {
  assert.doesNotMatch(exemple('badge'), /class="chips"/);
});

// ======================= AVATAR =======================

const LEA = { prenom: 'Léa', nom: 'Pezzetti' };
const YANN = { prenom: 'Yann', nom: 'Guihard' };

test('avatar : « produire » est exactement ce que rend avatar() en taille md', () => {
  assert.equal(compact(demo('avatar', 'produire')), avatar(LEA, 'md'));
});

test('avatar : « tailles » range avatar() en sm et en md à côté du nom', () => {
  const t = compact(demo('avatar', 'tailles'));
  assert.ok(t.includes(`<span class="row">${avatar(LEA)}Léa Pezzetti</span>`), 'la taille sm n’est pas ce que rend avatar()');
  assert.ok(t.includes(`<span class="row">${avatar(YANN, 'md')}Yann Guihard</span>`), 'la taille md n’est pas ce que rend avatar()');
});

test('avatar : les deux tailles de la page sont celles de la feuille', () => {
  assert.match(regle(COMPONENTS, '.avatar--sm'), /width:\s*var\(--size-avatar-sm\)/);
  assert.match(regle(COMPONENTS, '.avatar--sm'), /font-size:\s*12px/);
  assert.match(regle(COMPONENTS, '.avatar--md'), /width:\s*44px/, '44 px est écrit en dur, comme la page le dit');
  assert.match(regle(COMPONENTS, '.avatar--md'), /font-size:\s*14px/);
  assert.equal(avatar(LEA), avatar(LEA, 'sm'), 'sm est la taille par défaut');
  const t = texte(page('avatar'));
  assert.match(t, /44 px de côté/);
  assert.match(t, /initiales à 12 px/);
  assert.match(t, /initiales à 14 px/);
});

test('avatar : une troisième taille ne casse rien et ne fait rien — la page le dit', () => {
  assert.match(avatar(LEA, 'lg'), /class="avatar avatar--lg"/);
  assert.doesNotMatch(TOUT_LE_CSS, /\.avatar--lg/);
  assert.match(texte(page('avatar')), /avatar\(user, 'lg'\)/);
});

test('avatar : l’inversion de couleur vit dans deux autres feuilles, que la page nomme', () => {
  assert.match(ADMIN, /\.sidebar__footer \.avatar\s*\{[^}]*brand-primary-subtle[^}]*text-brand/);
  assert.match(MOBILE, /\.m-header__avatar \.avatar\s*\{[^}]*brand-primary-subtle[^}]*text-brand/);
  const t = texte(page('avatar'));
  assert.match(t, /\.sidebar__footer \.avatar/);
  assert.match(t, /\.m-header__avatar \.avatar/);
});

test('avatar : les deux paires mesurées sont celles que la feuille et les écrans forment', () => {
  assert.match(regle(COMPONENTS, '.avatar'), /background:\s*var\(--brand-primary\)/);
  assert.match(regle(COMPONENTS, '.avatar'), /color:\s*var\(--text-on-brand\)/);
  const html = page('avatar');
  assert.match(html, /mesureTexte\(valeurs, '--text-on-brand', '--brand-primary', 12, true\)/);
  assert.match(html, /mesureTexte\(valeurs, '--text-brand', '--brand-primary-subtle', 12, true\)/);
});

test('avatar : le nom complet est dans title et rien ne masque les initiales, comme la page le dit', () => {
  const html = avatar(LEA);
  assert.match(html, /title="Léa Pezzetti"/);
  assert.doesNotMatch(html, /aria-hidden/);
  assert.match(texte(page('avatar')), /n’a pas d’option pour poser aria-hidden="true"/);
});

test('avatar : les initiales sont en capitales, et il n’y en a qu’une si un nom manque', () => {
  assert.match(avatar({ prenom: 'léa', nom: 'pezzetti' }), />LP</);
  assert.match(avatar({ prenom: 'Léa' }), />L</);
});

test('avatar : l’en-tête mobile pose l’avatar seul dans un lien qui porte un aria-label', () => {
  const layout = lire('js/mobile/layout.js');
  assert.match(layout, /<a class="m-header__avatar" href="#\/profil" aria-label="Mon profil">\$\{avatar\(user\)\}<\/a>/);
  assert.match(texte(page('avatar')), /seul l’en-tête mobile pose l’avatar seul/);
});

test('avatar : les tailles que la page attribue aux écrans sont celles des vues', () => {
  assert.match(lire('js/admin/views/login.js'), /avatar\(u, 'md'\)/);
  assert.match(lire('js/admin/views/utilisateurFiche.js'), /avatar\(user, 'md'\)/);
  assert.match(lire('js/admin/views/utilisateurs.js'), /avatar\(u\)/);
});

// ======================= FORMULAIRES =======================

test('formulaires : la règle de focus des champs est un :focus, que la page distingue de :focus-visible', () => {
  const r = regle(COMPONENTS, '.input:focus, .select:focus, .textarea:focus');
  assert.ok(r, 'la règle de focus des champs a changé');
  assert.match(r, /outline:\s*2px solid var\(--brand-primary\)/);
  assert.match(r, /outline-offset:\s*-1px/);
  assert.match(r, /border-color:\s*var\(--brand-primary\)/);
  const t = texte(page('formulaires'));
  assert.match(t, /l’une des deux seules règles de focus que le dépôt dessine/);
  assert.match(t, /\.kpi--link:focus-visible/);
  assert.match(t, /:focus, pas :focus-visible/);
});

test('formulaires : aria-invalid colore le champ et la liste, pas la zone de texte — et l’exemple montre les trois', () => {
  const r = regle(COMPONENTS, '.input[aria-invalid="true"], .select[aria-invalid="true"]');
  assert.ok(r, 'la règle de l’erreur a changé');
  assert.match(r, /border-color:\s*var\(--feedback-error\)/);
  assert.doesNotMatch(COMPONENTS, /\.textarea\[aria-invalid/);
  const section = demo('formulaires', 'invalide');
  for (const c of ['input', 'select', 'textarea']) assert.match(section, new RegExp(`class="${c}"[^>]*aria-invalid="true"`), `${c} sans aria-invalid dans l’exemple`);
  assert.match(texte(page('formulaires')), /Le filet rouge ne marque pas la zone de texte/);
});

test('formulaires : aucun écran n’emploie .field__error ni aria-invalid, et la page le dit', () => {
  assert.deepEqual(utilise(/field__error/), [], 'un écran emploie field__error : la page doit changer');
  assert.deepEqual(utilise(/aria-invalid/), [], 'un écran emploie aria-invalid : la page doit changer');
  assert.match(texte(page('formulaires')), /L’outil n’emploie aujourd’hui ni \.field__error ni aria-invalid/);
  // Ce que l'outil fait à la place : une notification d'erreur.
  assert.match(lire('js/admin/views/emprunts.js'), /toast\(e\.message, 'error'\)/);
});

test('formulaires : le kit ne dessine aucun champ désactivé, et l’exemple en montre un', () => {
  assert.doesNotMatch(TOUT_LE_CSS, /(?:\.input|\.select|\.textarea)[^{]*:disabled|(?:\.input|\.select|\.textarea)[^{]*\[disabled\]/, 'une règle de champ désactivé existe : la page doit changer');
  assert.match(demo('formulaires', 'desactive'), /<input class="input" type="text" value="MDS-0029" disabled>/);
  assert.match(texte(page('formulaires')), /Le kit ne dessine aucun champ désactivé/);
});

test('formulaires : aucun état de chargement, et le seul indicateur d’attente est dans mobile.css, pour le scan', () => {
  assert.doesNotMatch(COMPONENTS, /spinner|loading|skeleton/i);
  assert.match(MOBILE, /\.spinner\s*\{/);
  assert.deepEqual(utilise(/class="spinner"/), ['js/mobile/views/scan.js']);
  const t = texte(page('formulaires'));
  assert.match(t, /Aucun état de chargement/);
  assert.match(t, /\.spinner/);
});

test('formulaires : l’interrupteur cache sa case et la feuille ne dessine rien à la place', () => {
  const r = regle(COMPONENTS, '.toggle input');
  assert.match(r, /opacity:\s*0/);
  assert.match(r, /width:\s*0/);
  assert.match(r, /height:\s*0/);
  assert.doesNotMatch(COMPONENTS, /\.toggle[^{]*:focus|\.checkbox[^{]*:focus/, 'une règle de focus existe pour la case ou l’interrupteur : la page doit changer');
  const t = texte(page('formulaires'));
  assert.match(t, /opacity: 0, zéro pixel de côté/);
  assert.match(t, /Cases et interrupteurs n’ont pas ce contour/);
  // « dessiné » : aucune feuille ne supprime l'anneau du navigateur, qui reste pour la case.
  assert.doesNotMatch(TOUT_LE_CSS, /outline\s*:\s*(?:none|0)\b/);
  assert.match(t, /Aucun anneau de focus dessiné pour la case et l’interrupteur\. Celui du navigateur reste pour la case/);
});

test('formulaires : les tailles que la page écrit sont celles de la feuille', () => {
  assert.match(regle(COMPONENTS, '.checkbox input'), /width:\s*20px/);
  assert.match(regle(COMPONENTS, '.toggle__track'), /height:\s*22px/);
  assert.match(regle(COMPONENTS, '.textarea'), /min-height:\s*88px/);
  assert.match(regle(COMPONENTS, '.input, .select, .textarea'), /min-height:\s*var\(--size-control-md\)/);
  assert.match(regle(COMPONENTS, '.input--search'), /padding-left:\s*36px/);
  const t = texte(page('formulaires'));
  assert.match(t, /la case dessinée fait 20 px et le rail de l’interrupteur 22 px/);
  assert.match(t, /88 px au minimum/);
});

test('formulaires : le placeholder est gris désactivé, l’outil en écrit, et la paire est mesurée', () => {
  assert.match(regle(COMPONENTS, '.input::placeholder, .textarea::placeholder'), /color:\s*var\(--text-disabled\)/);
  assert.match(lire('js/admin/layout.js'), /placeholder="Rechercher un matériel…"/);
  const html = page('formulaires');
  assert.match(html, /mesureTexte\(valeurs, '--text-disabled', '--bg-surface', 14\)/);
  assert.match(html, /mesureTexte\(valeurs, '--feedback-error', '--bg-surface', 11\)/);
  assert.match(regle(COMPONENTS, '.field__error'), /color:\s*var\(--feedback-error\)/);
  assert.match(regle(COMPONENTS, '.field__error'), /font-size:\s*11px/);
  assert.match(regle(COMPONENTS, '.field__label'), /font-size:\s*12px/);
  assert.match(regle(COMPONENTS, '.field__hint'), /font-size:\s*11px/);
});

test('formulaires : le libellé enveloppe tout le champ, aide et erreur comprises', () => {
  // C'est ce qui fait de l'aide et de l'erreur une part du nom du champ : la page l'affirme.
  for (const cle of ['champs', 'aide-erreur', 'invalide', 'desactive']) {
    const sans = demo('formulaires', cle).replace(/<label class="field">[\s\S]*?<\/label>/g, '');
    assert.doesNotMatch(sans, /field__(?:label|hint|error)/, `${cle} : un morceau de champ sort de son <label>`);
  }
  assert.match(texte(page('formulaires')), /l’aide et l’erreur sont dans le même <label>/);
});

test('formulaires : .input--sm n’existe que dans admin.css', () => {
  assert.match(ADMIN, /\.input--sm\s*\{/);
  assert.doesNotMatch(COMPONENTS, /\.input--sm/);
  assert.doesNotMatch(exemple('formulaires'), /input--sm/);
});

test('formulaires : l’exemple « champs » montre les quatre contrôles et « choix » la case et l’interrupteur', () => {
  const champs = demo('formulaires', 'champs');
  for (const c of ['class="input"', 'class="input input--search"', 'class="select"', 'class="textarea"']) assert.ok(champs.includes(c), `${c} manque`);
  const choix = demo('formulaires', 'choix');
  assert.match(choix, /class="checkbox"/);
  assert.match(choix, /class="toggle"/);
  assert.match(choix, /toggle__track/);
});

test('formulaires : les cases de l’exemple sont celles que l’outil écrit', () => {
  assert.match(lire('js/admin/views/parametres.js'), /<label class="checkbox"><input type="checkbox" name="bloquerSiRetard"/);
  assert.match(lire('js/admin/views/utilisateurs.js'), /<label class="toggle"><input type="checkbox" name="actifs"[^>]*><span class="toggle__track"><\/span> Comptes actifs uniquement<\/label>/);
});

test('formulaires : toutes les variantes de champ du CSS sont montrées', () => {
  const classes = new Set([...COMPONENTS.matchAll(/\.(input--[\w-]+|checkbox|toggle|textarea|select|field__[\w-]+)/g)].map((m) => m[1]));
  const html = exemple('formulaires');
  for (const c of classes) assert.match(html, new RegExp(`\\b${c}\\b`), `${c} n’est pas montré`);
});

// ======================= CARTES =======================

test('cartes : seule .card est employée par un écran ; .card--flat et .card--item ne sont écrites que dans la feuille', () => {
  assert.ok(utilise(/class="card[ "]/).length >= 5 || utilise(/class="card\b/).length >= 5 || utilise(/"card"/).length >= 5, '.card n’est plus employée comme la page le dit');
  assert.deepEqual(utilise(/card--flat/), [], 'un écran emploie card--flat : la page doit changer');
  assert.deepEqual(utilise(/card--item/), [], 'un écran emploie card--item : la page doit changer');
  assert.doesNotMatch(`${ADMIN}\n${MOBILE}`, /card--(?:flat|item)/, 'une autre feuille écrit card--flat ou card--item : la page dit « ailleurs que dans components.css »');
  // Elles existent bien dans la feuille : la page décrit des règles réelles, pas des fantômes.
  assert.match(COMPONENTS, /\.card--flat\s*\{/);
  assert.match(COMPONENTS, /\.card--item\s*\{/);
  const t = texte(page('cartes'));
  assert.match(t, /Seule \.card est employée par un écran/);
  assert.match(t, /Ni \.card--flat ni \.card--item n’est écrite ailleurs que dans css\/components\.css/);
  assert.doesNotMatch(t, /kit\.html|planche/);
});

test('cartes : .card--flat ne diffère de .card que par l’ombre', () => {
  const carte = regle(COMPONENTS, '.card');
  const plate = regle(COMPONENTS, '.card--flat');
  assert.match(carte, /box-shadow:\s*var\(--shadow-card\)/);
  assert.match(plate, /box-shadow:\s*none/);
  const bordure = (r) => r.match(/border:\s*([^;]+);/)[1].trim();
  assert.equal(bordure(plate), bordure(carte), 'le filet de .card--flat n’est plus celui de .card : la page doit changer');
  assert.match(texte(page('cartes')), /l’ombre est la seule différence/);
});

test('cartes : le catalogue mobile dessine sa carte avec .m-card, qui recadre l’image que .card--item ne recadre pas', () => {
  assert.match(lire('js/mobile/views/catalogue.js'), /class="m-card/);
  assert.match(MOBILE, /\.m-card__media img\s*\{[^}]*object-fit:\s*cover/);
  assert.doesNotMatch(COMPONENTS, /card__media img/);
  assert.match(MOBILE, /\.m-card__media\s*\{[^}]*aspect-ratio:\s*4 \/ 3/);
  assert.match(COMPONENTS, /\.card--item \.card__media\s*\{[^}]*aspect-ratio:\s*4 \/ 3/);
  assert.match(texte(page('cartes')), /Le catalogue mobile dessine sa carte d’objet avec \.m-card/);
});

test('cartes : l’exemple « materiel » emploie les badges et l’icône que les fonctions rendent', () => {
  const t = compact(demo('cartes', 'materiel'));
  assert.ok(t.includes(badge('item', 'disponible')));
  assert.ok(t.includes(badge('item', 'emprunte')));
  assert.equal(t.split(ICONS.camera).length - 1, 2, 'l’icône des cartes n’est pas ICONS.camera');
});

test('cartes : « surfaces » montre .card et .card--flat, chacune avec son en-tête', () => {
  const t = demo('cartes', 'surfaces');
  assert.match(t, /class="card"/);
  assert.match(t, /class="card card--flat"/);
  assert.equal((t.match(/class="card__header"/g) || []).length, 2);
  assert.equal((t.match(/class="card__title"/g) || []).length, 2);
});

test('cartes : le niveau de titre varie selon l’écran, comme la page le dit', () => {
  assert.match(lire('js/admin/views/dashboard.js'), /<h2 class="card__title">/);
  assert.match(lire('js/mobile/views/accueil.js'), /<h3 class="card__title">/);
  assert.match(texte(page('cartes')), /L’outil emploie h2 sur le tableau de bord et h3 sur l’accueil mobile/);
});

test('cartes : « Tout voir → » est répété sur le tableau de bord, sans aria-label', () => {
  const dashboard = lire('js/admin/views/dashboard.js');
  assert.equal((dashboard.match(/>Tout voir →</g) || []).length, 2);
  assert.doesNotMatch(dashboard, /aria-label/);
  assert.match(texte(page('cartes')), /pose « Tout voir → » sur deux cartes/);
});

test('cartes : toutes les formes de carte du CSS sont montrées', () => {
  const variantes = new Set([...COMPONENTS.matchAll(/\.card--([\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...variantes].sort(), ['flat', 'item']);
  for (const v of variantes) assert.match(exemple('cartes'), new RegExp(`card--${v}\\b`));
});

// ---- Les tests du brief de la tâche 11, mot pour mot ----

test('les deux versions d’onglets sont documentées et distinguées', () => {
  const html = readFileSync(new URL('../design-system/composants/navigation.html', import.meta.url), 'utf8');
  assert.match(html, /tab--active/);
  assert.match(html, /is-active/);
  assert.match(html, /desktop/i);
});

test('les quatre teintes de carte KPI sont montrées', () => {
  const exemple = readFileSync(new URL('../design-system/exemples/kpi.html', import.meta.url), 'utf8');
  for (const v of ['disponible', 'emprunte', 'retard', 'salle']) assert.match(exemple, new RegExp(`kpi--${v}\\b`));
});

test('kpi--brand et kpi--teal n’existent nulle part : ni règle, ni écran, et la page le dit', () => {
  for (const nom of ['kpi--brand', 'kpi--teal']) {
    assert.doesNotMatch(TOUT_LE_CSS, new RegExp(nom), `une feuille définit ${nom} : la page doit changer`);
    assert.deepEqual(utilise(new RegExp(nom)), [], `un écran emploie ${nom} : la page doit changer`);
  }
  const t = texte(page('kpi'));
  assert.match(t, /kpi--brand et kpi--teal n’existent pas/);
  assert.doesNotMatch(t, /kit\.html/);
});

// ======================= TABLEAU =======================

// Les colonnes et les lignes que l'exemple montre : le test les rejoue avec les vraies fonctions.
const COLONNES = [
  { key: 'item', label: 'Matériel', sortable: true, sortValue: (r) => r.nom, render: (r) => `<strong>${r.nom}</strong><br><span class="body-tiny text-secondary">${r.code}</span>` },
  { key: 'user', label: 'Emprunteur', sortable: true, sortValue: (r) => `${r.user.nom} ${r.user.prenom}`, render: (r) => `<span class="row">${avatar(r.user)}${r.user.prenom} ${r.user.nom}</span>` },
  { key: 'fin', label: 'Retour prévu', sortable: true, sortValue: (r) => r.fin, render: (r) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(...r.fin.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))) },
  { key: 'statut', label: 'Statut', sortable: true, sortValue: (r) => r.statut, render: (r) => badge('loan', r.statut) },
  { key: 'actions', label: '', align: 'right', render: () => '<div class="table__actions"><button type="button" class="btn btn--primary btn--sm">Réceptionner</button><button type="button" class="btn btn--ghost btn--sm">Prolonger</button></div>' },
];
const LIGNES = [
  { nom: 'Canon R10 + 18-55', code: 'MDS-0029', user: LEA, fin: '2026-09-19', statut: 'en_cours' },
  { nom: 'DJI Ronin RSC2', code: 'MDS-0014', user: YANN, fin: '2026-09-14', statut: 'en_retard' },
  { nom: 'Micro-cravate Sennheiser', code: 'MDS-0041', user: { prenom: 'Camille', nom: 'Dubois' }, fin: '2026-09-21', statut: 'en_cours' },
];

test('tableau : l’exemple « trie » est exactement ce que renderTable() rend, tri compris', () => {
  const tri = { key: 'fin', dir: 'asc' };
  const rendu = renderTable({ columns: COLONNES, rows: sortRows(LIGNES, tri, COLONNES), sort: tri, rowHref: (r) => `/materiel/${r.code}` });
  const section = compact(demo('tableau', 'trie'));
  assert.equal(section, `<div class="card">${rendu}</div>`);
  assert.match(rendu, /Retour prévu ↑/, 'la flèche du tri n’est pas dans le libellé');
});

test('tableau : l’exemple « vide » est exactement ce que renderTable() rend sans ligne', () => {
  assert.equal(compact(demo('tableau', 'vide')), `<div class="card">${renderTable({ columns: COLONNES, rows: [] })}</div>`);
  assert.match(renderTable({ columns: COLONNES, rows: [] }), /<div class="empty-state">Aucun résultat\.<\/div>/);
  assert.match(texte(page('tableau')), /« Aucun résultat\. » par défaut/);
});

test('tableau : ni l’en-tête ni la ligne ne sont focalisables, et aria-sort n’est posé nulle part', () => {
  const source = lire('js/admin/table.js');
  assert.doesNotMatch(source, /tabindex|tabIndex|aria-sort|scope=|role=/i, 'table.js pose un attribut d’accessibilité : la page doit changer');
  assert.deepEqual(utilise(/aria-sort/), []);
  const rendu = renderTable({ columns: COLONNES, rows: LIGNES, rowHref: (r) => `/materiel/${r.code}` });
  assert.doesNotMatch(rendu, /<tr[^>]*tabindex|<th[^>]*tabindex|<th[^>]*scope/);
  const t = texte(page('tableau'));
  assert.match(t, /Aucun anneau de focus dessiné sur la ligne cliquable\. Et la ligne ne peut même pas recevoir le focus/);
  assert.match(t, /aria-sort/);
  assert.match(t, /tabindex/);
  assert.match(t, /leur tabIndex vaut −1, la valeur d’un élément que rien ne rend focalisable \(aucun attribut tabindex n’est posé\)/);
  assert.doesNotMatch(lire('js/admin/views/dashboard.js'), /tabindex/i, 'un attribut tabindex est posé : la phrase de la page doit changer');
});

test('tableau : la table des retards du tableau de bord ne contient ni lien ni bouton', () => {
  const dashboard = lire('js/admin/views/dashboard.js');
  const debut = dashboard.indexOf('function lateRows');
  const fonction = dashboard.slice(debut, dashboard.indexOf('\n}', debut));
  assert.ok(fonction.includes('data-href'), 'lateRows ne pose plus data-href');
  assert.doesNotMatch(fonction, /<a[\s>]|<button|<input|<select/);
  assert.match(texte(page('tableau')), /la ligne ne contient ni l’un ni l’autre/);
});

test('tableau : le survol colore toutes les lignes, cliquables ou non', () => {
  assert.ok(regle(COMPONENTS, '.table tbody tr:hover'), 'la règle de survol a changé');
  assert.doesNotMatch(COMPONENTS, /tr\[data-href\]:hover/);
  assert.match(regle(COMPONENTS, '.table tr[data-href]'), /cursor:\s*pointer/);
  assert.match(regle(COMPONENTS, '.table th[data-sortable]'), /cursor:\s*pointer/);
  assert.match(regle(COMPONENTS, '.table th[data-sortable]'), /user-select:\s*none/);
  assert.match(texte(page('tableau')), /Le survol colore toutes les lignes, cliquables ou non/);
});

test('tableau : un clic sur un bouton, un lien, un champ, un libellé ou une liste ne déclenche pas la ligne', () => {
  const gestionnaires = [];
  const ligne = { dataset: { href: '/materiel/MDS-0029' }, addEventListener: (_, f) => gestionnaires.push(f) };
  const racine = { querySelectorAll: (s) => (s === 'tr[data-href]' ? [ligne] : []) };
  const ouvertes = [];
  bindTable(racine, { onSort: () => {}, onRow: (h) => ouvertes.push(h) });
  gestionnaires[0]({ target: { closest: () => null } });
  assert.deepEqual(ouvertes, ['/materiel/MDS-0029']);
  const demandes = [];
  gestionnaires[0]({ target: { closest: (s) => { demandes.push(s); return {}; } } });
  assert.equal(ouvertes.length, 1, 'un clic sur un contrôle a ouvert la fiche');
  assert.equal(demandes[0], 'button, a, input, label, select');
  assert.match(texte(page('tableau')), /un bouton, un lien, un champ, un libellé ou une liste/);
});

test('tableau : le tri compare les nombres comme des nombres, le texte en français, et met le vide à la fin', () => {
  const colonnes = [{ key: 'n' }];
  const trier = (valeurs, dir = 'asc') => sortRows(valeurs.map((n) => ({ n })), { key: 'n', dir }, colonnes).map((r) => r.n);
  assert.deepEqual(trier([10, 9, 100]), [9, 10, 100]);
  assert.deepEqual(trier(['b', 'a', 'é', 'z']), ['a', 'b', 'é', 'z']);
  assert.deepEqual(trier(['MDS-10', 'MDS-9', 'MDS-100']), ['MDS-9', 'MDS-10', 'MDS-100'], 'les chiffres se comparent en nombres');
  assert.deepEqual(trier([3, null, 1]), [1, 3, null]);
  assert.deepEqual(trier([3, null, 1], 'desc'), [3, 1, null], 'une valeur absente passe à la fin dans les deux sens');
  const lignes = [{ n: 2 }, { n: 1 }];
  sortRows(lignes, { key: 'n', dir: 'asc' }, colonnes);
  assert.deepEqual(lignes.map((r) => r.n), [2, 1], 'sortRows trie une copie');
  assert.deepEqual(toggleSort({ key: 'n', dir: 'asc' }, 'n'), { key: 'n', dir: 'desc' });
  assert.deepEqual(toggleSort({ key: 'n', dir: 'desc' }, 'n'), { key: 'n', dir: 'asc' });
  assert.deepEqual(toggleSort({ key: 'n', dir: 'desc' }, 'x'), { key: 'x', dir: 'asc' });
});

test('tableau : une colonne au libellé vide donne un en-tête sans nom, et un libellé est échappé', () => {
  assert.match(renderTable({ columns: [{ key: 'a', label: '', align: 'right' }], rows: [{ a: 1 }] }), /<th style="text-align:right"><\/th>/);
  assert.match(renderTable({ columns: [{ key: 'a', label: '<b>' }], rows: [] }), /<th>&lt;b&gt;<\/th>/);
  assert.match(renderTable({ columns: [{ key: 'a', label: 'A' }], rows: [{ a: '<i>' }] }), /<td>&lt;i&gt;<\/td>/, 'sans render, la valeur est échappée');
  assert.match(renderTable({ columns: [{ key: 'a', label: 'A', render: (r) => r.a }], rows: [{ a: '<i>' }] }), /<td><i><\/td>/, 'avec render, le HTML n’est pas échappé');
  assert.match(texte(page('tableau')), /Il n’est pas échappé/);
});

test('tableau : renderTable() n’écrit data-sortable que pour une colonne triable, et data-href que pour une ligne qui a une route', () => {
  const rendu = renderTable({ columns: [{ key: 'a', label: 'A', sortable: true }, { key: 'b', label: 'B' }], rows: [{ a: 1, b: 2 }, { a: 3, b: 4 }], rowHref: (r) => (r.a === 1 ? '/x' : null) });
  assert.equal((rendu.match(/data-sortable/g) || []).length, 1);
  assert.equal((rendu.match(/data-href/g) || []).length, 1);
});

test('tableau : la page affiche les deux paires du tableau, et la hauteur des boutons de ligne', () => {
  const html = page('tableau');
  assert.match(html, /mesurePaire\(valeurs, 'table th'\)/);
  assert.match(html, /mesurePaire\(valeurs, 'table tr:hover'\)/);
  assert.ok(PAIRES_KIT.some((p) => p.nom === 'table th') && PAIRES_KIT.some((p) => p.nom === 'table tr:hover'));
  assert.match(html, /valeurs\['--size-control-sm'\]/);
});

test('tableau : .table n’a aucun repli pour un écran étroit', () => {
  assert.doesNotMatch(`${COMPONENTS}${ADMIN}`, /overflow-x|\.table-wrap|\.table-responsive/);
  assert.match(texte(page('tableau')), /Aucun repli pour un écran étroit/);
  assert.match(texte(page('tableau')), /l’exemple ci-dessus déborde de la sienne et son cadre défile à l’horizontale/);
});

// ======================= CARTE KPI =======================

test('kpi : toutes les variantes de carte du CSS sont montrées', () => {
  const variantes = new Set([...COMPONENTS.matchAll(/\.kpi--([\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...variantes].sort(), ['disponible', 'emprunte', 'link', 'retard', 'salle']);
  for (const v of variantes) assert.match(exemple('kpi'), new RegExp(`kpi--${v}\\b`), `kpi--${v} n’est pas montré`);
});

test('kpi : chaque teinte est le fond du badge de même état', () => {
  for (const [kpi, statut] of [['disponible', 'available'], ['emprunte', 'borrowed'], ['retard', 'late'], ['salle', 'reserved']]) {
    assert.match(regle(COMPONENTS, `.kpi--${kpi}`), new RegExp(`background:\\s*var\\(--status-${statut}-bg\\)`));
    assert.match(regle(COMPONENTS, `.badge--${statut}`), new RegExp(`background:\\s*var\\(--status-${statut}-bg\\)`));
  }
  assert.match(texte(page('kpi')), /Chaque teinte est le fond du badge de l’état correspondant/);
});

test('kpi : la carte-lien est le gabarit de kpiCard() du tableau de bord, adresse réelle comprise', () => {
  const dashboard = lire('js/admin/views/dashboard.js');
  assert.match(dashboard, /<a class="kpi kpi--link \$\{variant\}" href="#\$\{escapeHtml\(href\)\}">/);
  const lien = demo('kpi', 'lien');
  assert.match(lien, /<a class="kpi kpi--link kpi--retard" href="#\/emprunts\/retards">/);
  assert.ok(dashboard.includes("'/emprunts/retards'"), 'l’adresse de la démonstration n’est pas celle que le tableau de bord écrit');
  assert.match(lien, /<span class="kpi__label">[^<]+<\/span><span class="kpi__value">[^<]+<\/span><span class="kpi__delta">[^<]+<\/span>/);
});

test('kpi : kpiCard n’est pas exportée, et la page le dit', () => {
  const dashboard = lire('js/admin/views/dashboard.js');
  assert.match(dashboard, /^function kpiCard/m);
  assert.doesNotMatch(dashboard, /export (?:default )?function kpiCard|export \{[^}]*kpiCard/);
  assert.match(texte(page('kpi')), /Aucune fonction partagée/);
});

test('kpi : l’anneau est tel que la page le décrit', () => {
  const r = regle(COMPONENTS, '.kpi--link:focus-visible');
  assert.match(r, /outline:\s*2px solid var\(--brand-primary\)/);
  assert.match(r, /outline-offset:\s*2px/);
  const t = texte(page('kpi'));
  assert.match(t, /contour de 2 px de --brand-primary, décalé de 2 px à l’extérieur/);
  assert.match(t, /l’une des deux seules règles de focus que le dépôt dessine/);
  assert.match(t, /\.input:focus/);
  assert.match(t, /docs\/correctifs-figma\.md/);
  assert.match(page('kpi'), /mesureNonTexte\(valeurs, '--brand-primary', '--bg-canvas'\)/);
});

test('kpi : le soulèvement est de 2 px, ombre flottante, sans garde pour le mouvement réduit', () => {
  assert.match(regle(COMPONENTS, '.kpi--link:hover'), /translateY\(-2px\)/);
  assert.match(regle(COMPONENTS, '.kpi--link:hover'), /box-shadow:\s*var\(--shadow-floating\)/);
  assert.match(regle(COMPONENTS, '.kpi--link'), /transition:\s*transform \.12s ease, box-shadow \.12s ease/);
  assert.doesNotMatch(`${COMPONENTS}${ADMIN}`, /prefers-reduced-motion/);
  const t = texte(page('kpi'));
  assert.match(t, /soulève de 2 px/);
  assert.match(t, /0,12 s/);
  assert.match(t, /prefers-reduced-motion/);
});

test('kpi : .kpi__delta n’a qu’une règle, sans couleur de hausse ni de baisse', () => {
  assert.equal((COMPONENTS.match(/\.kpi__delta/g) || []).length, 1);
  assert.match(regle(COMPONENTS, '.kpi__delta'), /color:\s*var\(--text-secondary\)/);
  assert.match(texte(page('kpi')), /ne colore ni une hausse ni une baisse/);
});

test('kpi : la page affiche les cinq paires de carte, celles que le kit publie', () => {
  const html = page('kpi');
  const paires = PAIRES_KIT.filter((p) => p.famille === 'kpi').map((p) => p.nom);
  assert.deepEqual(paires.sort(), ['kpi', 'kpi--disponible', 'kpi--emprunte', 'kpi--retard', 'kpi--salle']);
  for (const nom of paires) assert.match(html, new RegExp(`mesurePaire\\(valeurs, '${nom}'\\)`), `${nom} : le script ne le mesure pas`);
});

test('kpi : le chiffre, en grand et en gras, passe sur chaque teinte, comme la page le dit', () => {
  assert.match(regle(COMPONENTS, '.kpi__value'), /color:\s*var\(--text-primary\)/);
  assert.match(regle(COMPONENTS, '.kpi__value'), /font-size:\s*40px/);
  assert.match(regle(COMPONENTS, '.kpi__value'), /font-weight:\s*800/);
  for (const fond of ['--bg-muted', '--status-available-bg', '--status-borrowed-bg', '--status-late-bg', '--status-reserved-bg']) {
    assert.ok(ratioExact(TOKENS['--text-primary'], TOKENS[fond]) >= 4.5, `${fond} : le chiffre ne passe plus`);
  }
  assert.match(texte(page('kpi')), /Le chiffre, lui, est en grand et en gras : il passe/);
});

test('kpi : le dessin des quatre teintes reprend les libellés du tableau de bord', () => {
  const dashboard = lire('js/admin/views/dashboard.js');
  const exemple4 = demo('kpi', 'teintes');
  for (const libelle of ['Matériel disponible', 'Emprunts en cours', 'Retards', 'Réservations salle à venir']) {
    assert.ok(dashboard.includes(libelle), `« ${libelle} » n’est pas un libellé du tableau de bord`);
    assert.ok(exemple4.includes(libelle), `« ${libelle} » manque à l’exemple`);
  }
  assert.doesNotMatch(exemple4, /kpi--link/, 'les quatre teintes ne sont pas des liens');
});

// ======================= NAVIGATION =======================

// Les cinq règles d'onglets que `admin.css` écrit : l'exemple de la version admin les recopie.
const reglesOnglets = (css) => css.split('\n').map((l) => l.trim()).filter((l) => /^\.tabs? |^\.tab[:.]|^\.tab__count /.test(l));

test('navigation : l’exemple de la version admin recopie les règles d’onglets d’admin.css, à l’identique', () => {
  const originales = reglesOnglets(lire('css/admin.css'));
  assert.equal(originales.length, 5, `${originales.length} règles d’onglets dans admin.css : l’exemple doit suivre`);
  const style = [...exemple('onglets-admin').matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const copiees = reglesOnglets(style);
  assert.deepEqual(copiees, originales, 'la copie a dérivé de l’original');
  // L'ordre compte : l'exemple charge components.css d'abord, comme l'interface.
  const html = exemple('onglets-admin');
  assert.ok(html.indexOf('components.css') < html.indexOf('<style>'), 'les règles recopiées doivent venir après la feuille des composants');
  assert.doesNotMatch(html, /admin\.css/, 'un exemple ne charge pas admin.css');
});

test('navigation : le détecteur de règles d’onglets voit une règle qui change', () => {
  // Garde le test précédent honnête : une copie modifiée ne passe pas.
  const modifiee = lire('css/admin.css').replace('font-weight: 600', 'font-weight: 700');
  assert.notDeepEqual(reglesOnglets(modifiee), reglesOnglets(lire('css/admin.css')));
});

test('navigation : .tab--active n’est employé que par l’écran mobile Emprunts, .is-active des onglets que par l’administration', () => {
  assert.deepEqual(utilise(/(?<![\w-])tab--active/), ['js/mobile/views/emprunts.js']);
  assert.deepEqual(utilise(/class="tab\$\{[^}]*is-active/).sort(), ['js/admin/views/emprunts.js', 'js/admin/views/maintenance.js']);
  const t = texte(page('navigation'));
  assert.match(t, /le seul écran qui l’emploie aujourd’hui est « Emprunts » sur mobile/);
  assert.match(t, /js\/mobile\/views\/emprunts\.js/);
  assert.match(t, /Les écrans Emprunts et Maintenance de l’administration l’emploient/);
});

test('navigation : les deux versions ne partagent pas leur classe d’état', () => {
  assert.match(COMPONENTS, /\.tab--active\s*\{/);
  assert.doesNotMatch(COMPONENTS, /is-active/);
  assert.match(ADMIN, /\.tab\.is-active\s*\{/);
  assert.doesNotMatch(ADMIN, /tab--active/);
  assert.match(texte(page('navigation')), /\.is-active n’a aucun effet sur un onglet desktop/);
  // Les deux versions sont nommées dans le TEXTE : le test du brief lit aussi le script, où « desktop » est un nom de démonstration.
  assert.match(texte(page('navigation')), /Desktop, dans css\/components\.css/);
  assert.match(texte(page('navigation')), /Admin, dans css\/admin\.css/);
});

test('navigation : la version admin ne retire pas le filet de .tabs, comme la page le dit', () => {
  assert.match(regle(COMPONENTS, '.tabs'), /border-bottom:/);
  assert.doesNotMatch(regle(ADMIN, '.tabs'), /border/);
  assert.match(regle(COMPONENTS, '.tab'), /margin-bottom:\s*-1px/);
  assert.doesNotMatch(regle(ADMIN, '.tab'), /margin-bottom/);
  assert.match(texte(page('navigation')), /les pastilles reposent sur le filet de bas de \.tabs/);
});

test('navigation : admin.css ne parle d’onglets que dans les cinq règles recopiées', () => {
  // Une règle de contexte ajoutée plus tard (`.card .tabs`, une règle sous @media…) changerait le rendu
  // sans que la copie le sache : toute occurrence de plus fait tomber le test.
  const css = lire('css/admin.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const occurrences = css.split('\n').filter((l) => /\.tabs?\b|\.tab__/.test(l)).map((l) => l.trim());
  assert.deepEqual(occurrences, reglesOnglets(css), 'admin.css parle d’onglets ailleurs que dans les cinq règles recopiées par l’exemple');
  assert.equal(occurrences.length, 5);
});

test('navigation : au survol, une entrée de menu change son fond et la couleur de son texte', () => {
  const r = regle(COMPONENTS, '.nav-item:hover');
  assert.match(r, /background:\s*var\(--bg-canvas\)/);
  assert.match(r, /color:\s*var\(--text-primary\)/);
  assert.match(texte(page('navigation')), /Au survol, un fond gris clair et le texte qui fonce/);
});

test('navigation : la version admin ne défile ni ne passe à la ligne, comme la page le dit', () => {
  assert.doesNotMatch(regle(COMPONENTS, '.tabs'), /overflow|flex-wrap/);
  assert.doesNotMatch(regle(ADMIN, '.tabs'), /overflow|flex-wrap/);
  assert.match(texte(page('navigation')), /Aucun défilement ni retour à la ligne pour la version admin/);
});

test('navigation : le défilement des onglets sur mobile est dans mobile.css', () => {
  assert.match(MOBILE, /\.m-shell \.tabs\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(texte(page('navigation')), /\.m-shell \.tabs/);
});

test('navigation : l’exemple « menu » est exactement ce que sidebarHtml() met dans son <nav>', () => {
  const html = sidebarHtml({ currentPath: '/emprunts', counts: { emprunts: 3, maintenance: 0 }, user: null });
  const liens = html.match(/<nav class="sidebar__nav">([\s\S]*?)<\/nav>/)[1];
  assert.equal(compact(demo('navigation', 'menu')), liens);
  assert.equal((liens.match(/nav-item--active/g) || []).length, 1);
});

test('navigation : le compteur n’est écrit que si le nombre dépasse zéro', () => {
  const avec = sidebarHtml({ currentPath: '/', counts: { emprunts: 3, maintenance: 0 }, user: null });
  assert.equal((avec.match(/nav-item__count/g) || []).length, 1);
  assert.match(texte(page('navigation')), /Il n’est écrit que si le nombre dépasse zéro/);
  // Les deux états de la pastille : grise au repos, blanche à texte violet sur l'entrée active.
  assert.match(regle(COMPONENTS, '.nav-item__count'), /background:\s*var\(--bg-canvas\)/);
  assert.match(regle(COMPONENTS, '.nav-item--active .nav-item__count'), /background:\s*var\(--bg-surface\)/);
  assert.match(regle(COMPONENTS, '.nav-item--active .nav-item__count'), /color:\s*var\(--text-brand\)/);
  assert.match(texte(page('navigation')), /grise au repos, blanche à texte violet sur l’entrée active/);
  assert.doesNotMatch(texte(page('navigation')), /jamais colorée\b/);
  assert.match(page('navigation'), /mesureTexte\(valeurs, '--text-brand', '--bg-surface', 11\)/);
  // Et l'exemple montre bien les deux : une entrée active avec son compteur.
  assert.match(compact(demo('navigation', 'menu')), /nav-item nav-item--active" href="#\/emprunts">Emprunts<span class="nav-item__count">3<\/span>/);
});

test('navigation : la page courante ne se dit que par une classe — aucun aria-current dans l’outil', () => {
  assert.doesNotMatch(sidebarHtml({ currentPath: '/emprunts', counts: {}, user: null }), /aria-current/);
  assert.deepEqual(utilise(/aria-current/), [], 'quelqu’un pose aria-current : la page doit changer');
  assert.deepEqual(utilise(/role="tab(?:list)?"|aria-selected/), [], 'quelqu’un pose un rôle d’onglet : la page doit changer');
  const t = texte(page('navigation'));
  assert.match(t, /aria-current n’est posé nulle part dans l’outil/);
  assert.match(t, /Ni role="tablist", ni aria-selected/);
});

test('navigation : les valeurs de la feuille que la page écrit sont celles de nav-item', () => {
  assert.match(regle(COMPONENTS, '.nav-item'), /height:\s*44px/);
  assert.match(regle(COMPONENTS, '.nav-item'), /color:\s*var\(--text-secondary\)/);
  assert.match(regle(COMPONENTS, '.nav-item--active'), /color:\s*var\(--text-brand\)/);
  assert.match(regle(COMPONENTS, '.nav-item--active'), /background:\s*var\(--brand-primary-subtle\)/);
  assert.match(regle(COMPONENTS, '.nav-item__count'), /background:\s*var\(--bg-canvas\)/);
  assert.match(regle(COMPONENTS, '.nav-item__count'), /color:\s*var\(--text-secondary\)/);
  assert.match(regle(COMPONENTS, '.nav-item__count'), /font-size:\s*11px/);
  const html = page('navigation');
  assert.match(html, /mesureTexte\(valeurs, '--text-secondary', '--bg-canvas', 11\)/);
  assert.match(html, /mesureTexte\(valeurs, '--text-brand', '--brand-primary-subtle', 14, true\)/);
  assert.match(texte(page('navigation')), /44 px de haut/);
});

test('navigation : l’exemple desktop montre un onglet actif et des compteurs, comme l’écran mobile', () => {
  const t = demo('navigation', 'onglets-desktop');
  assert.equal((t.match(/tab--active/g) || []).length, 1);
  assert.equal((t.match(/tab__count/g) || []).length, 3);
  assert.doesNotMatch(t, /is-active/);
  const mobile = lire('js/mobile/views/emprunts.js');
  assert.match(mobile, /<button type="button" class="tab\$\{[^}]*tab--active[^}]*\}" data-tab="\$\{t\.key\}">\$\{escapeHtml\(t\.label\)\} <span class="tab__count">/);
  const admin = demo('onglets-admin', 'onglets-admin');
  assert.equal((admin.match(/is-active/g) || []).length, 1);
  assert.doesNotMatch(admin, /tab--active/);
});

test('navigation : le retour passe par .back-link, d’admin.css', () => {
  assert.match(ADMIN, /\.back-link\s*\{/);
  assert.match(lire('js/admin/views/materielFiche.js'), /class="back-link" href="#\/materiel">← Matériel/);
});

test('navigation : les cadres de la page visent les deux fichiers d’exemple', () => {
  const html = page('navigation');
  assert.match(html, /fichier: 'navigation\.html', demo: 'menu'/);
  assert.match(html, /fichier: 'navigation\.html', demo: 'onglets-desktop'/);
  assert.match(html, /fichier: 'onglets-admin\.html', demo: 'onglets-admin'/);
});

// ======================= ICÔNES =======================

test('icônes : l’inventaire montre chaque icône de ICONS, à l’identique, avec son nom', () => {
  const inventaire = compact(demo('icones', 'inventaire'));
  const noms = Object.keys(ICONS);
  assert.equal(noms.length, 9, 'ICONS n’a plus neuf icônes : la page doit changer');
  for (const nom of noms) assert.ok(inventaire.includes(`<span class="row">${ICONS[nom]}<span class="body-sm">${nom}</span></span>`), `${nom} : l’exemple ne montre pas ICONS.${nom}`);
  assert.equal((inventaire.match(/<svg/g) || []).length, noms.length, 'l’exemple montre une icône qui n’est pas dans ICONS');
  assert.match(texte(page('icones')), /Neuf dessins en ligne/);
});

test('icônes : le gabarit « modele » est ICONS.check, et les neuf partagent le même gabarit', () => {
  assert.equal(compact(demo('icones', 'modele')), ICONS.check);
  for (const [nom, svg] of Object.entries(ICONS)) {
    assert.match(svg, /^<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/, `${nom} : gabarit différent`);
    assert.match(svg, /aria-hidden="true"/, `${nom} : visible d’un lecteur d’écran`);
  }
  const t = texte(page('icones'));
  assert.match(t, /de 24 px, au trait de 2, aux bouts arrondis/);
  assert.match(t, /aria-hidden="true"/);
});

test('icônes : chaque nom de ICONS est nommé sur la page, et chaque usage cité est dans le code', () => {
  const html = page('icones');
  for (const nom of Object.keys(ICONS)) assert.match(html, new RegExp(`<code>${nom}</code>`), `${nom} n’est pas nommé`);
  const layout = lire('js/mobile/layout.js');
  const scan = lire('js/mobile/views/scan.js');
  for (const icone of ['accueil', 'catalogue', 'salle', 'emprunts']) assert.match(layout, new RegExp(`icon: '${icone}'`), `${icone} n’est plus un onglet de la barre du bas`);
  assert.match(layout, /\$\{ICONS\.scan\}<\/a>/, 'scan : le bouton central');
  assert.match(layout, /\$\{ICONS\.back\}/, 'back : le retour de l’en-tête');
  assert.match(scan, /ICONS\.camera, 'Prendre la photo de l’objet'/);
  assert.match(scan, /ICONS\.check, 'Confirmer l’emprunt'/);
  assert.match(scan, /ICONS\.croix, 'Annuler l’emprunt'/);
  assert.match(scan, /ICONS\.scan, 'Scanner un autre objet'/);
  assert.match(scan, /etat === 'done' \? ICONS\.check/);
});

test('icônes : le dépôt n’a aucun système d’icônes, comme la page le dit', () => {
  assert.doesNotMatch(TOUT_LE_CSS, /@font-face|icon-font|font-family:[^;]*(?:icon|awesome|material)/i);
  const racine = RACINE_HTML.map((f) => lire(f)).join('\n');
  assert.doesNotMatch(racine, /<symbol|<use |fontawesome|font-awesome|material-icons|material symbols|lucide|feather|bootstrap-icons|heroicons|phosphor/i);
  assert.deepEqual(readdirSync(new URL('../assets/', import.meta.url)).sort(), ['icon-192.png', 'icon-512.png'], 'un fichier est apparu dans assets/ : la page doit changer');
  assert.doesNotMatch(SOURCES.map((s) => s.source).join('\n'), /<symbol|<use /);
  const t = texte(page('icones'));
  assert.match(t, /Il n’y a pas de système d’icônes/);
  assert.match(t, /Aucun système d’icônes\. Ni police d’icônes, ni sprite, ni bibliothèque, ni dossier d’icônes/);
});

test('icônes : les neuf dessins sont les seuls <svg> du code, tous dans le module mobile', () => {
  const avec = SOURCES.filter((s) => /<svg/.test(s.source)).map((s) => s.fichier);
  assert.deepEqual(avec, ['js/mobile/layout.js']);
  assert.doesNotMatch(RACINE_HTML.map((f) => lire(f)).join('\n'), /<svg/);
  assert.match(lire('js/mobile/layout.js'), /import \{ auth \} from '\.\.\/auth\.js'/);
  assert.match(texte(page('icones')), /charge js\/mobile\/layout\.js et, avec lui, js\/auth\.js/);
});

test('icônes : .btn > svg et la réduction du stepper sont dans mobile.css, pas dans la feuille des composants', () => {
  assert.match(MOBILE, /\.btn > svg\s*\{[^}]*width:\s*20px/);
  assert.match(MOBILE, /\.stepper__dot--done svg\s*\{[^}]*width:\s*15px/);
  assert.doesNotMatch(COMPONENTS, /(?:^|\n)[^{}\n]*\bsvg\b[^{}\n]*\{/, 'une règle de la feuille des composants vise un svg : la page doit changer');
  const t = texte(page('icones'));
  assert.match(t, /\.btn > svg à 20 px/);
  assert.match(t, /\.stepper__dot--done svg à 15 px/);
});

test('icônes : la loupe a la couleur de --text-secondary, recopiée dans l’image', () => {
  const r = regle(COMPONENTS, '.input--search');
  const stroke = decodeURIComponent(r.match(/stroke='([^']+)'/)[1]).toLowerCase();
  assert.equal(stroke, TOKENS['--text-secondary'].toLowerCase(), 'la loupe n’a plus la couleur du token : la page doit changer');
  assert.match(r, /data:image\/svg\+xml/);
  assert.match(texte(page('icones')), /recopiée dans l’image et non lue du token/);
});

test('icônes : les caractères et l’emoji cités sont ceux que l’outil écrit', () => {
  const tout = SOURCES.filter((s) => !s.fichier.endsWith('seed.js')).map((s) => s.source).join('\n');
  for (const g of ['← Matériel', 'Tout voir →', "' ↓' : ' ↑'", '&times;', "'✓'", '✕</div>', 'Aucun retard. 🎉', 'Bonjour ${escapeHtml(user.prenom)} 👋']) assert.ok(tout.includes(g), `« ${g} » n’est plus dans le code`);
  const glyphes = demo('icones', 'glyphes');
  for (const g of ['←', '→', '↑', '↓', '×', '✓', '✕', '🎉', '👋']) assert.ok(glyphes.includes(g), `${g} manque à l’exemple`);
  // L'autre sens : aucun caractère-icône du code (flèches, dingbats, croix) ne manque à la page.
  const duCode = [...new Set(tout.replace(/&times;/g, '×').match(/[\u2190-\u21FF\u2700-\u27BF\u00D7]/g))].sort();
  assert.deepEqual(duCode, ['←', '→', '↑', '↓', '×', '✓', '✕'].sort(), 'le code écrit un caractère-icône que ce test ne connaît pas : la page doit le dire');
  const prose = texte(page('icones'));
  for (const g of duCode) assert.ok(prose.includes(g), `l’inventaire de la page oublie ${g}, que le code écrit`);
  assert.deepEqual([...new Set(tout.match(/\p{Extended_Pictographic}/gu))].sort(), ['🎉', '👋'], 'les emoji de l’outil ont changé : la page doit changer');
});

test('icônes : l’exemple « recherche » est un .input--search', () => {
  assert.match(demo('icones', 'recherche'), /class="input input--search"/);
});

test('icônes : le bouton central et la flèche de retour portent un aria-label, comme la page le dit', () => {
  const layout = lire('js/mobile/layout.js');
  assert.match(layout, /class="m-nav__scan" href="#\/scan" aria-label="Scanner un QR code"/);
  assert.match(layout, /class="m-header__back" href="#\$\{back\}" aria-label="Retour"/);
  assert.match(lire('js/mobile/views/salle.js'), /aria-label="Semaine précédente">←<\/button>/);
});

// ======================= MODALE ET RETOURS (Task 12) =======================
//
// Ce que ces tests tiennent : chaque phrase de la page Modale qui parle du comportement de `openModal`,
// `closeModal` ou `toast` est confrontée à la VRAIE fonction, appelée sur un faux document (ci-dessous),
// pas à une copie ; chaque phrase sur ce que le dépôt ne fait pas (Échap, focus) est confrontée au code de
// `js/`. Ils NE disent PAS ce qu'un lecteur d'écran annonce, ni si le focus se comporte comme la page le
// décrit dans un vrai navigateur : cela se regarde, et le rapport de la tâche dit ce qui l'a été.

// Un faux document : ce que `openModal` et `toast` y écrivent, et les boutons qu'ils y câblent.
function fauxDocument({ modal = true, retours = true } = {}) {
  const boutons = [];
  const bouton = (dataset = {}) => {
    const b = { dataset, g: {}, addEventListener(type, f) { this.g[type] = f; }, clic(cible = this) { return this.g.click({ target: cible }); } };
    boutons.push(b);
    return b;
  };
  const classes = new Set();
  const element = { nom: '.modal' };
  const racine = {
    innerHTML: '',
    querySelector: (s) => (s === '.modal' ? element : null),
    querySelectorAll(s) {
      if (s === '[data-close]') return [...this.innerHTML.matchAll(/data-close/g)].map(() => bouton());
      if (s === '.modal__footer [data-action]') return [...this.innerHTML.matchAll(/data-action="(\d+)"/g)].map((m) => bouton({ action: m[1] }));
      return [];
    },
  };
  const toasts = { enfants: [], appendChild(e) { this.enfants.push(e); } };
  const document = {
    getElementById: (id) => (id === 'modal-root' && modal ? racine : id === 'toast-root' && retours ? toasts : null),
    createElement: () => {
      const e = { className: '', textContent: '', attributs: {}, ajoutees: [], retire: false, setAttribute(k, v) { e.attributs[k] = v; }, classList: { add: (c) => e.ajoutees.push(c) }, remove() { e.retire = true; } };
      return e;
    },
    body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
  };
  return { document, racine, toasts, boutons, classes, element };
}

// Exécute `fn` avec ce faux document et un `setTimeout` qui note les délais sans rien attendre.
function avecDocument(options, fn) {
  const f = fauxDocument(options);
  const avantDocument = globalThis.document;
  const avantMinuteur = globalThis.setTimeout;
  f.minuteurs = [];
  globalThis.document = f.document;
  globalThis.setTimeout = (fonction, ms) => { f.minuteurs.push(ms); return 0; };
  const fin = () => { globalThis.document = avantDocument; globalThis.setTimeout = avantMinuteur; };
  let r;
  try { closeModal(); r = fn(f); } catch (e) { fin(); throw e; }
  if (r && typeof r.then === 'function') return r.finally(fin);
  fin();
  return r;
}

const UI = lire('js/ui.js');
const ECRANS_ET_RACINES = ['index.html', 'admin.html', 'mobile.html'];

test('la page Modale documente l’API JS, ses racines et ses manques', () => {
  const html = page('modale');
  for (const attendu of ['openModal', 'closeModal', 'toast', 'modal-root', 'toast-root', 'has-modal']) {
    assert.match(html, new RegExp(attendu), `${attendu} n’est pas documenté`);
  }
  assert.match(html, /chappe/i);     // pas de fermeture au clavier : manque nommé
  assert.match(html, /focus/i);      // pas de piège de focus : manque nommé
});

test('les quatre variantes de toast et les trois d’alerte sont montrées', () => {
  const exemple = lire('design-system/exemples/modale.html');
  for (const v of ['toast--info', 'toast--success', 'toast--error', 'toast--warning', 'alert--warning', 'alert--error', 'alert--info']) {
    assert.match(exemple, new RegExp(v));
  }
});

test('modale : la page écrit les signatures que le code a, défauts compris', () => {
  const t = texte(page('modale'));
  // La signature d'openModal est celle de la déclaration : mêmes quatre noms, dans l'ordre.
  const declaration = UI.match(/export function openModal\(\{([^}]*)\}\)/)[1].split(',').map((s) => s.split('=')[0].trim());
  assert.deepEqual(declaration, ['title', 'body', 'actions', 'onClose']);
  assert.ok(t.includes(`openModal({ ${declaration.join(', ')} })`), 'la signature d’openModal diffère de celle du code');
  // Celle de toast(), et ses deux défauts, lus dans le code.
  const [, variante, delai] = UI.match(/export function toast\(message, variant = '(\w+)', ms = (\d+)\)/);
  assert.ok(t.includes('toast(message, variant, ms)'));
  assert.ok(t.includes(`« ${variante} »`) || t.includes(`'${variante}'`) || t.includes(`« ${variante}»`), `la page ne dit pas que la variante par défaut est ${variante}`);
  assert.ok(t.includes(`${delai} ms`), `la page ne dit pas que la durée par défaut est ${delai} ms`);
  // Les champs d'une action sont ceux que le code lit.
  for (const champ of ['label', 'variant', 'onClick', 'close']) {
    assert.match(UI, new RegExp(`\\ba\\.${champ}\\b`), `ui.js ne lit plus action.${champ}`);
    assert.ok(t.includes(champ), `la page ne nomme pas le champ ${champ}`);
  }
  assert.ok(t.includes('closeModal()'));
});

test('modale : ui.js exporte les trois fonctions et l’échappement que la page nomme', () => {
  assert.match(UI, /export function openModal\b/);
  assert.match(UI, /export function closeModal\b/);
  assert.match(UI, /export function toast\b/);
  assert.match(UI, /export function escapeHtml\b/);
});

test('modale : le titre et les libellés sont échappés, le corps ne l’est pas, la variante non plus', () => {
  avecDocument({}, (f) => {
    openModal({ title: '<b>T</b>', body: '<i>corps</i>', actions: [{ label: '<u>L</u>', variant: 'x" y' }] });
    assert.ok(f.racine.innerHTML.includes('&lt;b&gt;T&lt;/b&gt;'), 'le titre n’est pas échappé');
    assert.ok(f.racine.innerHTML.includes('&lt;u&gt;L&lt;/u&gt;'), 'le libellé n’est pas échappé');
    assert.ok(f.racine.innerHTML.includes('<i>corps</i>'), 'le corps est du HTML brut');
    assert.ok(f.racine.innerHTML.includes('btn--x" y'), 'la variante est écrite telle quelle dans la classe');
  });
  const t = texte(page('modale'));
  assert.match(t, /body est du HTML brut/);
  assert.match(t, /l’appelant échappe lui-même/);
  assert.match(t, /variant n’est pas échappé/);
});

test('modale : le message d’un toast est du texte, jamais du HTML', () => {
  avecDocument({}, (f) => {
    toast('<b>x</b>', 'success');
    const e = f.toasts.enfants[0];
    assert.equal(e.textContent, '<b>x</b>', 'le message doit passer par textContent');
  });
  assert.match(UI.slice(UI.indexOf('export function toast')), /el\.textContent = message/);
  assert.match(texte(page('modale')), /message est du texte/);
});

test('modale : sans actions le pied est vide, et la variante par défaut d’un bouton est secondary', () => {
  avecDocument({}, (f) => {
    openModal({ title: 'T', body: '' });
    assert.match(f.racine.innerHTML, /<footer class="modal__footer">\s*<\/footer>/);
    openModal({ title: 'T', body: '', actions: [{ label: 'A' }] });
    assert.match(f.racine.innerHTML, /class="btn btn--secondary" data-action="0"/);
  });
  const t = texte(page('modale'));
  assert.match(t, /sans actions/i);
  assert.match(t, /secondary/);
});

test('modale : la fonction rendue ne ferme que SA modale ; closeModal ferme celle qui est là', () => {
  avecDocument({}, (f) => {
    const fermerA = openModal({ title: 'A', body: '' });
    const fermerB = openModal({ title: 'B', body: '' });
    fermerA();
    assert.match(f.racine.innerHTML, />B</, 'A ne doit pas fermer B');
    fermerB();
    assert.equal(f.racine.innerHTML, '');
    openModal({ title: 'C', body: '' });
    closeModal();
    assert.equal(f.racine.innerHTML, '');
  });
  const t = texte(page('modale'));
  assert.match(t, /ne ferme que SA modale/);
  assert.match(t, /après un await/);
});

test('modale : un onClick qui rend false garde la modale, close:false aussi, le reste la ferme', async () => {
  await avecDocument({}, async (f) => {
    const essayer = async (action) => {
      closeModal();
      openModal({ title: 'T', body: '', actions: [action] });
      const b = f.boutons[f.boutons.length - 1];
      await b.clic();
      return f.racine.innerHTML !== '';
    };
    assert.equal(await essayer({ label: 'a', onClick: () => false }), true, 'false garde la modale ouverte');
    assert.equal(await essayer({ label: 'a', onClick: async () => false }), true, 'false rendu par une promesse la garde aussi');
    assert.equal(await essayer({ label: 'a', close: false }), true, 'close:false la garde');
    assert.equal(await essayer({ label: 'a', onClick: () => {} }), false, 'undefined la ferme');
    assert.equal(await essayer({ label: 'a', onClick: () => 0 }), false, 'seul false strict garde la modale : 0 la ferme');
    assert.equal(await essayer({ label: 'a' }), false, 'sans onClick, le bouton ferme');
    // Le callback reçoit l'élément .modal, pour lire ses champs.
    let recu = null;
    await essayer({ label: 'a', onClick: (m) => { recu = m; } });
    assert.equal(recu, f.element);
    // Une exception laisse la modale ouverte.
    closeModal();
    openModal({ title: 'T', body: '', actions: [{ label: 'a', onClick: () => { throw new Error('non'); } }] });
    await assert.rejects(f.boutons[f.boutons.length - 1].clic(), /non/);
    assert.notEqual(f.racine.innerHTML, '', 'une exception doit laisser la modale ouverte');
  });
  const t = texte(page('modale'));
  assert.match(t, /rend false/);
  assert.match(t, /close: false/);
  assert.match(t, /lève une exception/);
});

test('modale : onClose est appelé une fois, quelle que soit la façon de fermer', async () => {
  await avecDocument({}, async (f) => {
    const appels = [];
    const ouvrir = (nom) => openModal({ title: nom, body: '', actions: [{ label: 'ok' }], onClose: () => appels.push(nom) });
    // [fond, croix, bouton d'action] : l'ordre dans lequel openModal câble ses boutons.
    const boutons = () => f.boutons.slice(-3);
    ouvrir('bouton');
    await boutons()[2].clic();
    assert.deepEqual(appels, ['bouton']);
    ouvrir('croix');
    boutons()[1].clic();
    assert.deepEqual(appels, ['bouton', 'croix']);
    ouvrir('fond');
    boutons()[0].clic({ autre: true });
    assert.notEqual(f.racine.innerHTML, '', 'un clic qui ne vise pas le fond ne ferme rien');
    boutons()[0].clic();
    assert.equal(f.racine.innerHTML, '');
    assert.deepEqual(appels, ['bouton', 'croix', 'fond']);
    ouvrir('x'); ouvrir('remplacee');
    assert.deepEqual(appels, ['bouton', 'croix', 'fond', 'x'], 'ouvrir une seconde modale appelle l’onClose de la première');
    closeModal(); closeModal();
    assert.deepEqual(appels, ['bouton', 'croix', 'fond', 'x', 'remplacee'], 'chaque onClose une seule fois');
  });
  const t = texte(page('modale'));
  assert.match(t, /onClose/);
  assert.match(t, /une seule fois/);
  assert.match(t, /ouverture d’une autre modale/);
});

test('modale : has-modal est posée sur le body à l’ouverture, retirée à la fermeture, et bloque le défilement', () => {
  avecDocument({}, (f) => {
    openModal({ title: 'T', body: '' });
    assert.ok(f.classes.has('has-modal'));
    closeModal();
    assert.ok(!f.classes.has('has-modal'));
  });
  assert.match(regle(COMPONENTS, '.has-modal'), /overflow:\s*hidden/);
  assert.match(texte(page('modale')), /has-modal/);
});

test('modale : sans #modal-root ou #toast-root, openModal et toast lèvent une exception ; closeModal se tait', () => {
  avecDocument({ modal: false, retours: false }, () => {
    assert.throws(() => openModal({ title: 'T', body: '' }), TypeError);
    assert.throws(() => toast('x'), TypeError);
    assert.doesNotThrow(() => closeModal());
  });
  assert.match(texte(page('modale')), /lèvent une exception/);
});

test('modale : les écrans de l’outil posent les deux racines, vides, après leur contenu et avant leurs scripts', () => {
  for (const f of ECRANS_ET_RACINES) {
    const html = lire(f);
    assert.ok(html.includes('<div id="modal-root"></div>'), `${f} : #modal-root absent ou non vide`);
    assert.ok(html.includes('<div id="toast-root"></div>'), `${f} : #toast-root absent ou non vide`);
    assert.ok(html.indexOf('<main') < html.indexOf('id="modal-root"'), `${f} : la modale précède le contenu`);
    assert.ok(html.indexOf('id="toast-root"') < html.indexOf('<script'), `${f} : les racines doivent précéder les scripts`);
  }
  // #toast-root est habillé par components.css ; #modal-root ne l'est par rien (le fond est .modal-backdrop).
  assert.match(regle(COMPONENTS, '#toast-root'), /position:\s*fixed/);
  assert.doesNotMatch(TOUT_LE_CSS, /#modal-root/);
  const t = texte(page('modale'));
  assert.match(t, /#modal-root/);
  assert.match(t, /#toast-root/);
  // La page nomme exactement les écrans que la boucle ci-dessus vient de vérifier.
  assert.deepEqual(ECRANS_ET_RACINES, ['index.html', 'admin.html', 'mobile.html']);
  assert.match(t, /index\.html, admin\.html et mobile\.html posent chacun les deux/);
  assert.doesNotMatch(t, /kit\.html/);
});

test('modale : un toast porte role="status", sa variante en classe, et s’efface 300 ms avant son terme', () => {
  avecDocument({}, (f) => {
    toast('a');
    toast('b', 'success', 1000);
    toast('c', 'zzz', 100);
    const [a, b, c] = f.toasts.enfants;
    assert.equal(a.className, 'toast toast--info');
    assert.equal(b.className, 'toast toast--success');
    assert.equal(c.className, 'toast toast--zzz', 'une variante inconnue n’est pas refusée');
    assert.equal(a.attributs.role, 'status');
    assert.deepEqual(f.minuteurs, [2700, 3000, 700, 1000, 0, 100], 'fondu 300 ms avant la fin, jamais en dessous de 0');
  });
  // Ni `toast--info` ni une variante inconnue n'ont de règle : seul le fond sombre de base s'applique.
  assert.doesNotMatch(TOUT_LE_CSS, /\.toast--info\b/);
  assert.ok(regle(COMPONENTS, '.toast'));
  for (const v of ['success', 'error', 'warning']) assert.ok(regle(COMPONENTS, `.toast--${v}`), `toast--${v} sans règle`);
  assert.ok(regle(COMPONENTS, '.toast--leaving'));
  const t = texte(page('modale'));
  assert.match(t, /300 ms avant/);
  assert.match(t, /toast--info n’a aucune règle/);
  assert.match(t, /role="status"/);
});

test('modale : un toast ne se ferme pas, ne se clique pas, et #toast-root n’est pas une région de statut', () => {
  assert.match(regle(COMPONENTS, '#toast-root'), /pointer-events:\s*none/);
  assert.doesNotMatch(UI.slice(UI.indexOf('export function toast')), /addEventListener|button/);
  for (const f of ECRANS_ET_RACINES) assert.ok(lire(f).includes('<div id="toast-root"></div>'), f);
  const t = texte(page('modale'));
  assert.match(t, /aucun bouton pour le fermer/);
  assert.match(t, /pointer-events: none/);
  assert.match(t, /n’a pas été vérifié/, 'la page doit dire ce qu’elle n’a pas vérifié sur les lecteurs d’écran');
});

test('modale : l’exemple « toasts » est exactement ce que toast() écrit, variante par variante', () => {
  const ecrit = (variante, message) => avecDocument({}, (f) => {
    toast(message, variante);
    const e = f.toasts.enfants[0];
    return `<div class="${e.className}" role="${e.attributs.role}">${e.textContent}</div>`;
  });
  const section = compact(demo('modale', 'toasts'));
  const messages = {
    info: 'Copié dans le presse-papiers',
    success: 'Modifications enregistrées',
    error: 'Date invalide.',
    warning: 'Données mises à jour ailleurs — enregistrez ou rechargez la fiche',
  };
  for (const [variante, message] of Object.entries(messages)) assert.ok(section.includes(compact(ecrit(variante, message))), `le toast ${variante} diffère de ce que toast() écrit`);
  // Les trois messages qui ne sont pas des exemples inventés sont ceux de l'outil.
  const tout = SOURCES.map((s) => s.source).join('\n');
  assert.ok(tout.includes("toast('Modifications enregistrées', 'success')"));
  assert.ok(tout.includes("toast('Date invalide.', 'error')"));
  assert.ok(tout.includes("toast('Données mises à jour ailleurs — enregistrez ou rechargez la fiche', 'warning')"));
});

test('modale : l’exemple « modale » appelle les vraies fonctions, avec une racine pour chacune', () => {
  const html = exemple('modale');
  assert.match(html, /import \{[^}]*\bopenModal\b[^}]*\} from '\.\.\/\.\.\/js\/ui\.js'/);
  assert.match(html, /import \{[^}]*\btoast\b[^}]*\} from '\.\.\/\.\.\/js\/ui\.js'/);
  assert.match(html, /import \{[^}]*\bescapeHtml\b[^}]*\} from '\.\.\/\.\.\/js\/ui\.js'/);
  assert.ok(html.includes('<div id="modal-root"></div>') && html.includes('<div id="toast-root"></div>'));
  assert.ok(/<section data-demo="modale"[^>]*>[\s\S]*?<button/.test(html));
  // Le corps passe les données par escapeHtml, comme la page l'enseigne.
  assert.match(html, /\$\{escapeHtml\(/);
  // Une modale ouverte dans le cadre est fixe : le cadre doit lui laisser de la place.
  assert.match(html, /\[data-demo="modale"\][^}]*min-height:\s*\d+(?:\.\d+)?rem/);
  // Les feuilles : celles de l'application, pas plus.
  assert.match(html, /css\/components\.css/);
  assert.doesNotMatch(html, /css\/(?:admin|mobile)\.css/);
});

test('modale : l’alerte n’a pas de fonction : les vues l’écrivent en HTML, et aucune ne porte de rôle', () => {
  assert.doesNotMatch(UI, /export function alert/);
  const ecrites = utilise(/class="alert alert--(?:warning|error|info)/);
  for (const f of ['js/mobile/views/accueil.js', 'js/admin/views/parametres.js', 'js/admin/views/salle.js']) assert.ok(ecrites.includes(f), `${f} n’écrit plus d’alerte`);
  assert.deepEqual(utilise(/role="alert"/), [], 'un écran pose role="alert" : la page doit changer');
  assert.deepEqual(utilise(/class="alert[^"]*"[^>]*\b(?:role|aria-live)=/), [], 'une alerte porte un rôle : la page doit changer');
  assert.equal(regle(COMPONENTS, '.alert').includes('background'), false, '.alert seule n’a pas de fond : la page le dit');
  for (const v of ['warning', 'error', 'info']) assert.ok(regle(COMPONENTS, `.alert--${v}`), `alert--${v} sans règle`);
  const t = texte(page('modale'));
  assert.match(t, /sans variante, une alerte n’a pas de fond/);
  assert.match(t, /aucune alerte de l’outil ne porte de rôle/);
});

test('modale : l’exemple « alertes » montre les trois alertes avec des textes que les vues écrivent', () => {
  const a = demo('modale', 'alertes');
  for (const v of ['warning', 'error', 'info']) assert.equal((a.match(new RegExp(`alert--${v}\\b`, 'g')) || []).length, 1, v);
  const accueil = lire('js/mobile/views/accueil.js');
  assert.ok(accueil.includes('réservation expirée, le matériel est reparti dans le catalogue.'));
  assert.ok(accueil.includes('réservation refusée — '));
  assert.ok(accueil.includes('à retirer avant ${escapeHtml(formatTime(r.window.end))} — <a href="#/emprunts">voir mon code</a>.'));
  assert.match(a, /réservation expirée, le matériel est reparti dans le catalogue\./);
  assert.match(a, /réservation refusée — /);
  assert.match(a, /<a href="#\/emprunts">voir mon code<\/a>/);
});

test('modale : Échap ne ferme rien et rien ne piège le focus — le code de js/ et des écrans le confirme', () => {
  // Le seul écouteur de clavier du dépôt est la recherche globale de l'administration.
  assert.deepEqual(utilise(/keydown|keyup|keypress|\bEscape\b|\bkeyCode\b/), ['js/admin/layout.js']);
  assert.match(lire('js/admin/layout.js'), /\[data-role="global-search"\]'\)\.addEventListener\('keydown'/);
  assert.doesNotMatch(UI, /keydown|Escape|\.focus\b|\binert\b|tabindex|aria-hidden/);
  // Le seul endroit du dépôt qui déplace le focus : la modale de scan, dans son propre champ.
  assert.deepEqual(utilise(/\.focus\b/), ['js/scanModal.js']);
  assert.match(lire('js/scanModal.js'), /input\.focus\(\)/);
  // Dans l'ordre du balisage, la modale vient après la page.
  for (const f of ['admin.html', 'mobile.html']) assert.ok(lire(f).indexOf('</main>') < lire(f).indexOf('id="modal-root"'), f);
  const t = texte(page('modale'));
  assert.match(t, /Aucune fermeture par Échap/);
  assert.match(t, /Aucun piège de focus/);
  assert.match(t, /js\/scanModal\.js/);
  assert.match(t, /la recherche globale de l’administration/);
});

test('modale : ce que la modale porte déjà est dans son balisage', () => {
  avecDocument({}, (f) => {
    openModal({ title: 'T', body: '' });
    const h = f.racine.innerHTML;
    assert.match(h, /role="dialog" aria-modal="true" aria-labelledby="modal-title"/);
    assert.match(h, /<h2 id="modal-title" class="h6">T<\/h2>/);
    assert.match(h, /<button class="modal__close" type="button" aria-label="Fermer" data-close>/);
  });
  const t = texte(page('modale'));
  assert.match(t, /role="dialog"/);
  assert.match(t, /aria-modal="true"/);
  assert.match(t, /aria-labelledby/);
  assert.match(t, /aria-label="Fermer"/);
});

test('modale : les dimensions que la page écrit sont celles de la feuille', () => {
  assert.match(regle(COMPONENTS, '.modal'), /width:\s*min\(560px, 100%\)/);
  assert.match(regle(COMPONENTS, '.modal'), /max-height:\s*90vh/);
  assert.match(regle(COMPONENTS, '.modal__close'), /width:\s*32px;\s*height:\s*32px/);
  assert.match(regle(COMPONENTS, '.modal-backdrop'), /z-index:\s*100/);
  assert.match(regle(COMPONENTS, '#toast-root'), /z-index:\s*200/);
  // Sur mobile, mobile.css remonte les toasts au-dessus de la barre.
  assert.match(regle(MOBILE, '#toast-root'), /bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  const t = texte(page('modale'));
  assert.match(t, /560 px/);
  assert.match(t, /90 % de la hauteur/);
  assert.match(t, /32 px/);
  assert.match(t, /88 px/);
  // mobile.css POSE #toast-root à 88 px, il ne le remonte pas : components.css le pose déjà ailleurs.
  assert.match(t, /css\/mobile\.css pose #toast-root à 88 px du bas, plus la zone sûre/);
  assert.doesNotMatch(t, /remonte #toast-root de 88/);
});

test('modale : la page mesure les paires des retours, les quatre que le kit publie et trois autres', () => {
  const html = page('modale');
  for (const nom of ['toast--success', 'toast--error', 'alert--info', 'alert--error']) assert.match(html, new RegExp(`mesurePaire\\(valeurs, '${nom}'\\)`));
  assert.match(html, /mesureTexte\(valeurs, '--text-inverse', '--text-primary', 14, true\)/);
  assert.match(html, /mesureTexte\(valeurs, '--text-primary', '--feedback-warning', 14, true\)/);
  assert.match(html, /mesureTexte\(valeurs, '--status-maintenance-text', '--status-maintenance-bg', 14\)/);
  // Ces trois dernières correspondent aux règles de la feuille.
  assert.match(regle(COMPONENTS, '.toast'), /background:\s*var\(--text-primary\);\s*color:\s*var\(--text-inverse\)/);
  assert.match(regle(COMPONENTS, '.toast--warning'), /background:\s*var\(--feedback-warning\);\s*color:\s*var\(--text-primary\)/);
  assert.match(regle(COMPONENTS, '.alert--warning'), /background:\s*var\(--status-maintenance-bg\);\s*color:\s*var\(--status-maintenance-text\)/);
});

test('modale : les trois cadres visent leurs démonstrations', () => {
  const html = page('modale');
  for (const demoNom of ['modale', 'toasts', 'alertes']) assert.match(html, new RegExp(`fichier: 'modale\\.html', demo: '${demoNom}'`));
  // Seule l'alerte a un bloc de code : celui d'une modale ou d'un toast serait du HTML à recopier, ce que la page déconseille.
  assert.match(html, /codeHtml\(\{ fichier: 'modale\.html', demo: 'alertes'/);
  assert.doesNotMatch(html, /codeHtml\(\{ fichier: 'modale\.html', demo: '(?:modale|toasts)'/);
});

test('modale : le manque d’Échap et de piège de focus est dans le registre, à faire', () => {
  const registre = lire('docs/correctifs-figma.md');
  const aFaire = registre.slice(registre.indexOf('## À faire'), registre.indexOf('## Divergences')).replace(/\s+/g, ' ');
  assert.match(aFaire, /Échap/);
  assert.match(aFaire, /piège de focus/);
  assert.match(aFaire, /js\/ui\.js/);
  // « le focus reste sur le bouton » n'est vrai qu'au clavier, et dans un seul navigateur : le registre le dit.
  assert.match(aFaire, /Au clavier, le focus reste sur le bouton/);
  assert.match(aFaire, /dans un seul navigateur/);
  assert.match(texte(page('modale')), /Constaté au clavier, dans un seul navigateur/);
  assert.match(texte(page('modale')), /docs\/correctifs-figma\.md/);
});

test('modale : les trois gestes que la page montre en JavaScript sont ceux de l’outil', () => {
  assert.ok(utilise(/toast\(err\.message, 'error'\); return false;/).includes('js/admin/views/maintenance.js'));
  assert.match(lire('js/scanModal.js'), /const close = openModal\(\{/);
  assert.match(lire('js/scanModal.js'), /onCode\([^)]*\{ close \}\)/);
  const t = texte(page('modale'));
  assert.match(t, /toast\(err\.message, 'error'\); return false;/);
  assert.match(t, /sous le nom close/);
  assert.match(t, /openModal\(\{ title: 'Titre', body: '<p class="body-sm">Texte<\/p>' \}\)/);
});

// ======================= MOBILE ET DÉMARRER (Task 13) =======================
//
// Même contrat que plus haut : les phrases de la page Mobile sur `css/mobile.css` sont comparées à
// `css/mobile.css`, celles sur les écrans à `js/mobile/` et aux trois pages d'entrée ; les exemples sont
// comparés aux fonctions qui écrivent ce HTML (`headerHtml`, `bottomNavHtml`, `empruntsHtml`,
// `reservationCardHtml`, `resultsHtml`, `catalogueHtml`). Ces tests NE regardent PAS la page : que la barre
// du bas reste dans la coquille du cadre, que 360 px soit lisible, cela se voit dans un navigateur.

const BASE = sansCss(lire('css/base.css'));
const MOBILE_BRUT = lire('css/mobile.css');
const TOUTES_LES_FEUILLES = `${BASE}\n${TOUT_LE_CSS}`;
const DEMO_LEA = { prenom: 'Léa', nom: 'Pezzetti' };
const DATE_MOBILE = new Date(2026, 8, 17, 10, 0);
const RESERVATION = {
  loan: { id: 'L-0007', debutPrevu: '2026-09-18T09:00:00', finPrevue: '2026-09-19T17:00:00', statut: 'reservee' },
  item: { nom: 'Canon R10 + 18-55' },
  pickupOpen: false,
  expired: false,
  window: { end: new Date(2026, 8, 18, 17, 0) },
};
const ELEVES = [
  { id: 'u-lea', prenom: 'Léa', nom: 'Pezzetti', promo: 'Promo 2027' },
  { id: 'u-yann', prenom: 'Yann', nom: 'Guihard', promo: 'Promo 2026' },
];
const GROUPES = [
  { reference: 'canon-r10', nom: 'Canon R10 + 18-55', categorie: 'Photo', circuit: 'valeur', photoUrl: '', total: 1, disponibles: 0, exemplaires: [{ etat: 'emprunte' }] },
  { reference: 'multiprise', nom: 'Multiprise', categorie: 'Accessoire', circuit: 'self', photoUrl: '', total: 6, disponibles: 4, exemplaires: [] },
];
// Les trois pages d'entrée de l'outil, et ce qu'elles chargent, dans l'ordre.
const feuillesDe = (fichier) => [...lire(fichier).matchAll(/<link rel="stylesheet" href="(css\/[\w-]+\.css)">/g)].map((m) => m[1]);
// Les noms de classe qu'un fragment HTML emploie.
const classesDe = (html) => [...new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean))];
// Les classes qu'une page écrit en `<code>.nom</code>`.
const classesCodees = (nom) => [...new Set([...sansCommentaires(page(nom)).matchAll(/<code>\.([a-z][\w-]*)<\/code>/g)].map((m) => m[1]))];

// ---- Mobile ----

test('mobile : la page nomme ses classes, les écrans en emploient chacune, et chacune existe', () => {
  const noms = classesCodees('mobile');
  assert.ok(noms.length >= 25, `${noms.length} classes lues : le détecteur ne voit plus la page`);
  for (const c of noms) assert.match(TOUTES_LES_FEUILLES, new RegExp(`\\.${c}(?![\\w-])`), `mobile : « .${c} » n’existe dans aucune feuille`);
  for (const c of ['m-shell', 'm-header', 'm-main', 'm-nav', 'm-nav__tab', 'm-nav__scan', 'm-list', 'm-item', 'm-item--button', 'm-item--stacked', 'm-item--pickup', 'm-item__body', 'm-item__row', 'm-grid', 'm-card', 'm-card__media', 'm-card__body', 'm-card__meta', 'chips', 'is-login']) {
    assert.ok(noms.includes(c), `la page ne nomme pas .${c}`);
  }
});

test('mobile : le shell est tel que la page le dit', () => {
  const t = texte(page('mobile'));
  const shell = regle(MOBILE, '.m-shell');
  assert.match(shell, /max-width:\s*480px/);
  assert.match(shell, /margin:\s*0 auto/);
  assert.match(shell, /min-height:\s*100vh/);
  assert.match(shell, /flex-direction:\s*column/);
  const header = regle(MOBILE, '.m-header');
  assert.match(header, /position:\s*sticky/);
  assert.match(header, /top:\s*0/);
  assert.match(header, /height:\s*calc\(56px \+ env\(safe-area-inset-top\)\)/);
  assert.match(regle(MOBILE, '.m-main'), /padding:[^;]*calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  const nav = regle(MOBILE, '.m-nav');
  assert.match(nav, /position:\s*fixed/);
  assert.match(nav, /bottom:\s*0/);
  assert.match(nav, /width:\s*min\(480px, 100%\)/);
  assert.match(nav, /height:\s*calc\(72px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(nav, /grid-template-columns:\s*1fr 1fr 72px 1fr 1fr/);
  const scan = regle(MOBILE, '.m-nav__scan');
  assert.match(scan, /width:\s*60px;\s*height:\s*60px/);
  assert.match(scan, /margin-top:\s*-28px/);
  for (const phrase of ['480 px', '56 px', '72 px', '96 px', '60 px', '−28 px', 'position: fixed', 'position: sticky']) assert.ok(t.includes(phrase), `la page ne dit pas « ${phrase} »`);
  // Le bouton central est centré dans la barre, puis remonté par sa marge haute : le débord n'est PAS la marge.
  // Débord = −(haut de la boîte) = −((barre − (hauteur + marge)) / 2 + marge), tout en pixels lus dans la feuille.
  const px = (css, propriete) => Number(css.match(new RegExp(`(?:^|[\\s;])${propriete}:\\s*(-?\\d+)px`))[1]);
  const barre = Number(nav.match(/height:\s*calc\((\d+)px/)[1]);
  const debord = -((barre - (px(scan, 'height') + px(scan, 'margin-top'))) / 2 + px(scan, 'margin-top'));
  assert.equal(debord, 8, 'le bouton central ne déborde plus de 8 px : mesuré à 7,5 px dans le navigateur, la page doit changer');
  assert.ok(t.includes(`déborder d’environ ${debord} px au-dessus de la barre`), `le débord du bouton central est d’environ ${debord} px (7,5 mesuré dans le navigateur : la bordure d’un pixel n’est pas dans le calcul)`);
  assert.match(t, /1fr 1fr 72px 1fr 1fr/);
});

test('mobile : .is-login cache l’en-tête et la barre, et c’est app.js qui la pose sur le body', () => {
  assert.match(MOBILE, /\.is-login \.m-header, \.is-login \.m-nav\s*\{\s*display:\s*none/);
  assert.match(lire('js/mobile/app.js'), /document\.body\.classList\.add\('is-login'\)/);
  assert.match(lire('js/mobile/app.js'), /document\.body\.classList\.remove\('is-login'\)/);
  const t = texte(page('mobile'));
  assert.match(t, /is-login/);
  assert.match(t, /app\.js/);
});

test('mobile : la distance de 88 px des barres collantes est écrite dans trois règles, et 96 px dans une', () => {
  const regles = (valeur) => [...MOBILE.matchAll(/(?:^|\n)([^{}\n]+)\{([^}]*)\}/g)].filter((m) => m[2].includes(valeur)).map((m) => m[1].trim()).sort();
  assert.deepEqual(regles('88px'), ['#toast-root', '.m-cta', '.selection-bar']);
  assert.deepEqual(regles('96px'), ['.m-main']);
  const t = texte(page('mobile'));
  assert.match(t, /88 px, écrits à la main dans trois règles/);
  assert.match(t, /\.selection-bar/);
  assert.match(t, /\.m-cta/);
});

test('mobile : aucune règle ne s’adapte à la largeur — la colonne s’arrête à 480 px', () => {
  assert.deepEqual([...MOBILE_BRUT.matchAll(/@media[^{]*/g)].map((m) => m[0].trim()), ['@media (prefers-reduced-motion: reduce)']);
  assert.match(regle(MOBILE, '.m-grid'), /grid-template-columns:\s*repeat\(2, 1fr\)/);
  assert.match(texte(page('mobile')), /aucune requête de largeur \(@media \(max-width: …\)\) n’existe dans mobile\.css ; sa seule @media est celle du mouvement réduit, qui ne parle pas de largeur/i);
});

test('mobile : les listes et les cartes sont telles que la page le dit', () => {
  assert.match(regle(MOBILE, '.m-list'), /flex-direction:\s*column/);
  assert.match(regle(MOBILE, '.m-item'), /background:\s*var\(--bg-surface\)/);
  assert.match(regle(MOBILE, '.m-item--stacked'), /flex-direction:\s*column/);
  assert.match(regle(MOBILE, '.m-item--pickup'), /border:[^;]*var\(--border-brand\)/);
  assert.match(regle(MOBILE, '.m-item--button:hover'), /background:\s*var\(--brand-primary-subtle\)/);
  assert.match(regle(MOBILE, '.m-card__media'), /aspect-ratio:\s*4 \/ 3/);
  assert.match(regle(MOBILE, '.m-card__body strong'), /-webkit-line-clamp:\s*2/);
  assert.match(regle(MOBILE, '.m-item__body strong'), /text-overflow:\s*ellipsis/);
  assert.match(regle(MOBILE, '.chips'), /overflow-x:\s*auto/);
  // Les écrans emploient ces variantes comme la page le dit.
  assert.ok(utilise(/<a class="m-item" href=/).includes('js/mobile/views/accueil.js'));
  assert.ok(utilise(/class="m-item m-item--button"/).includes('js/mobile/views/login.js'));
  assert.ok(utilise(/class="m-item m-item--stacked"/).includes('js/mobile/views/emprunts.js'));
  assert.ok(utilise(/m-item--pickup/).includes('js/mobile/views/emprunts.js'));
  assert.ok(utilise(/class="m-card"/).includes('js/mobile/views/catalogue.js'));
  const t = texte(page('mobile'));
  for (const phrase of ['4 / 3', 'deux lignes', 'une seule ligne']) assert.ok(t.includes(phrase), `la page ne dit pas « ${phrase} »`);
});

test('mobile : mobile.css ne définit aucun composant de base, et suppose components.css avant elle', () => {
  for (const c of ['.btn', '.card', '.badge', '.chip', '.avatar', '.tab', '.modal']) {
    assert.ok(regle(COMPONENTS, c), `${c} n’est plus dans components.css`);
    assert.equal(regle(MOBILE, c), null, `mobile.css définit ${c} : la page doit changer`);
  }
  assert.doesNotMatch(MOBILE, /\.(?:input|select|textarea)\b/);
  assert.match(MOBILE, /\.btn > svg\s*\{/);
  assert.match(MOBILE, /\.m-shell \.tabs\s*\{/);
  // Les trois pages d'entrée chargent les sheets dans le même ordre ; seule mobile.html charge mobile.css.
  assert.deepEqual(feuillesDe('mobile.html'), ['css/tokens.css', 'css/base.css', 'css/components.css', 'css/mobile.css']);
  assert.deepEqual(RACINE_HTML.filter((f) => lire(f).includes('css/mobile.css')), ['mobile.html']);
  const t = texte(page('mobile'));
  assert.match(t, /seule page qui la charge est mobile\.html/);
  assert.match(t, /css\/components\.css chargée avant elle/);
  // Les exceptions que les deux phrases générales nomment existent bel et bien dans mobile.css.
  for (const c of ['.btn > svg', '.m-shell .tab', '.seg__btn', '.m-nav__scan', '.m-item--button']) {
    assert.ok(regle(MOBILE, c), `mobile.css n’a plus de règle ${c}`);
    assert.ok(t.includes(c), `la page mobile ne nomme pas ${c}`);
  }
  assert.doesNotMatch(t, /ne les redéfinit pas|aucun bouton, badge/, 'une phrase absolue est revenue');
});

test('mobile : les trois choses que mobile.css redéfinit sont celles que la page nomme, avec leurs écarts', () => {
  // L'intersection de mobile.css avec chaque autre feuille, calculée, pas écrite.
  const selecteurs = (css) => new Set([...css.matchAll(/(?:^|\})\s*([^{}@][^{}]*)\{/g)].flatMap((m) => m[1].split(',')).map((s) => s.trim().replace(/\s+/g, ' ')));
  const doublons = (autre) => [...selecteurs(MOBILE)].filter((s) => selecteurs(autre).has(s));
  assert.deepEqual(doublons(BASE), []);
  const communs = [...new Set([...doublons(COMPONENTS), ...doublons(ADMIN)].map((s) => s.match(/^[#.][\w-]+/)[0]))].sort();
  assert.deepEqual(communs, ['#toast-root', '.error-card', '.week-grid']);
  const noms = classesCodees('mobile');
  assert.ok(noms.includes('week-grid') && noms.includes('error-card'));
  assert.match(texte(page('mobile')), /#toast-root/);
  // .error-card est identique des deux côtés ; .week-grid ne l'est pas ; #toast-root ne change que `bottom`.
  assert.equal(regle(MOBILE, '.error-card'), regle(ADMIN, '.error-card'));
  assert.notEqual(regle(MOBILE, '.week-grid'), regle(ADMIN, '.week-grid'));
  assert.match(regle(MOBILE, '.week-grid'), /border-spacing:\s*2px/);
  assert.match(regle(ADMIN, '.week-grid'), /border-spacing:\s*3px/);
  assert.match(regle(MOBILE, '.week-grid .slot'), /height:\s*30px/);
  assert.match(regle(ADMIN, '.week-grid .slot'), /height:\s*34px/);
  assert.doesNotMatch(regle(MOBILE, '#toast-root'), /position|left|transform/);
  const t = texte(page('mobile'));
  // À qui appartient chaque chiffre : mobile d'abord, admin ensuite, comme la phrase les nomme.
  const nombre = (css, selecteur, propriete) => Number(regle(css, selecteur).match(new RegExp(`${propriete}:\\s*(\\d+)px`))[1]);
  const cellules = [nombre(MOBILE, '.week-grid .slot', 'height'), nombre(ADMIN, '.week-grid .slot', 'height')];
  const ecarts = [nombre(MOBILE, '.week-grid', 'border-spacing'), nombre(ADMIN, '.week-grid', 'border-spacing')];
  assert.deepEqual([cellules, ecarts], [[30, 34], [2, 3]]);
  assert.ok(t.includes(`mobile.css et admin.css la définissent chacune, avec des cellules de ${cellules[0]} px contre ${cellules[1]} px et un écart de ${ecarts[0]} px contre ${ecarts[1]} px`), 'les chiffres de .week-grid sont attribués à la mauvaise feuille');
  assert.match(t, /identique des deux côtés/);
});

test('mobile : l’exemple « shell » est ce que headerHtml(), empruntsHtml() et bottomNavHtml() écrivent', () => {
  const section = demo('mobile-shell', 'shell');
  const entete = headerHtml({ title: 'Mes emprunts', user: DEMO_LEA });
  const contenu = empruntsHtml({ tab: 'reservations', data: { enCours: [null, null], reservations: [RESERVATION], historique: new Array(14).fill(null) }, date: DATE_MOBILE });
  const barre = bottomNavHtml('/emprunts');
  const attendu = `<div class="m-shell"><header id="header" class="m-header">${entete}</header><main id="view" class="m-main">${contenu}</main><nav id="nav" class="m-nav" aria-label="Navigation">${barre}</nav></div>`;
  assert.equal(compact(section), compact(attendu));
  // Les trois balises d'ouverture sont celles de mobile.html.
  const mobile = lire('mobile.html');
  for (const ouverture of ['<div class="m-shell">', '<header id="header" class="m-header">', '<main id="view" class="m-main">', '<nav id="nav" class="m-nav" aria-label="Navigation">']) assert.ok(mobile.includes(ouverture), `mobile.html n’a plus ${ouverture}`);
});

test('mobile : l’exemple « shell » retient la barre fixe dans la coquille, et la page le dit', () => {
  const html = exemple('mobile-shell');
  const style = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(style, /\.m-shell\s*\{[^}]*min-height:\s*0/);
  assert.match(style, /\.m-shell\s*\{[^}]*transform:\s*translateZ\(0\)/);
  assert.match(style, /\.m-shell\s*\{[^}]*height:\s*\d+(?:\.\d+)?rem/);
  const t = texte(page('mobile'));
  assert.match(t, /L’exemple retient la barre dans la coquille/);
  assert.match(t, /transform/);
});

test('mobile : l’exemple « liste » est ce que resultsHtml() et reservationCardHtml() écrivent', () => {
  const groupes = [{ role: 'eleve', label: 'Élèves', users: ELEVES }];
  const boutons = resultsHtml(groupes).match(/<div class="m-list">[\s\S]*<\/div>(?=\s*<\/section>)/)[0];
  const attendu = `${boutons}<div class="m-list">${reservationCardHtml(RESERVATION, DATE_MOBILE)}</div>`;
  assert.equal(compact(demo('mobile-listes', 'liste')), compact(attendu));
});

test('mobile : l’exemple « cartes » est ce que catalogueHtml() et catalogueResultsHtml() écrivent', () => {
  const filtres = { q: '', categorie: '' };
  const puces = catalogueHtml({ groups: GROUPES, filters: filtres, categories: ['Photo', 'Audio', 'Vidéo'] }).match(/<div class="chips">[\s\S]*?<\/div>/)[0];
  assert.equal(compact(demo('mobile-listes', 'cartes')), compact(`${puces}${catalogueResultsHtml(GROUPES)}`));
});

test('mobile : seuls les exemples mobiles chargent mobile.css, après components.css, et leurs cadres sont étroits', () => {
  for (const f of ['mobile-shell', 'mobile-listes']) {
    assert.deepEqual([...exemple(f).matchAll(/href="\.\.\/\.\.\/(css\/[\w-]+\.css)"/g)].map((m) => m[1]), ['css/tokens.css', 'css/base.css', 'css/components.css', 'css/mobile.css'], f);
  }
  const autres = readdirSync(new URL('../design-system/exemples/', import.meta.url)).filter((f) => f.endsWith('.html') && !f.startsWith('mobile-'));
  for (const f of autres) assert.doesNotMatch(lire(`design-system/exemples/${f}`), /mobile\.css/, `${f} charge mobile.css`);
  // Chaque cadre qui montre un exemple mobile est un cadre étroit (390 px), et aucun autre ne l'est.
  const html = page('mobile');
  const appels = [...html.matchAll(/cadreHtml\(\{([^}]*)\}\)/g)].map((m) => m[1]);
  assert.equal(appels.length, 3);
  for (const a of appels) {
    assert.match(a, /fichier: 'mobile-(?:shell|listes)\.html'/);
    assert.match(a, /etroit: true/);
  }
  assert.match(sansCss(lire('design-system/css/site.css')), /\.ds-cadre--etroit\s*\{\s*max-width:\s*var\(--ds-cadre-telephone\)/);
  assert.match(lire('design-system/css/site.css'), /--ds-cadre-telephone:\s*390px/);
  assert.match(texte(page('mobile')), /390 px/);
});

test('mobile : les cadres de la page visent des démonstrations qui existent, code compris', () => {
  const html = page('mobile');
  for (const [f, d] of [['mobile-shell', 'shell'], ['mobile-listes', 'liste'], ['mobile-listes', 'cartes']]) {
    assert.match(html, new RegExp(`cadreHtml\\(\\{ fichier: '${f}\\.html', demo: '${d}'`));
    assert.match(html, new RegExp(`codeHtml\\(\\{ fichier: '${f}\\.html', demo: '${d}'`));
    demo(f, d);
  }
});

test('mobile : le viewport, les repères et la barre sont tels que la page le dit', () => {
  const mobile = lire('mobile.html');
  assert.match(mobile, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/);
  assert.doesNotMatch(mobile, /user-scalable|maximum-scale/);
  assert.match(mobile, /<header id="header"[^>]*>[\s\S]*<main id="view"[^>]*>[\s\S]*<nav id="nav"/);
  assert.match(headerHtml({ title: 'T', user: null }), /<h1 class="m-header__title">T<\/h1>/);
  assert.doesNotMatch(bottomNavHtml('/emprunts'), /aria-current/);
  assert.equal((bottomNavHtml('/emprunts').match(/m-nav__tab--active/g) || []).length, 1);
  assert.match(MOBILE, /\.m-header__back\s*\{[^}]*width:\s*36px;\s*height:\s*36px/);
  assert.match(MOBILE, /\.seg__btn\s*\{[^}]*height:\s*36px/);
  assert.match(MOBILE, /\.m-nav__tab\s*\{[^}]*font-size:\s*10px/);
  const t = texte(page('mobile'));
  for (const phrase of ['viewport-fit=cover', 'safe-area-inset', 'aria-current="page"', '36 px', '10 px', 'ne bloque pas le zoom', 'un h1']) assert.ok(t.includes(phrase), `la page ne dit pas « ${phrase} »`);
});

test('mobile : la page mesure les deux paires de la barre et le texte de 11 px des lignes', () => {
  const html = page('mobile');
  assert.match(html, /mesureTexte\(valeurs, '--text-secondary', '--bg-surface', 10, true\)/);
  assert.match(html, /mesureTexte\(valeurs, '--text-brand', '--bg-surface', 10, true\)/);
  assert.match(html, /mesureTexte\(valeurs, '--text-secondary', '--bg-surface', 11\)/);
  assert.match(regle(MOBILE, '.m-nav'), /background:\s*var\(--bg-surface\)/);
  assert.match(regle(MOBILE, '.m-nav__tab'), /color:\s*var\(--text-secondary\)/);
  assert.match(regle(MOBILE, '.m-nav__tab--active'), /color:\s*var\(--text-brand\)/);
  assert.match(lire('js/mobile/views/emprunts.js'), /body-tiny text-secondary/);
});

// ---- Démarrer ----

test('Démarrer donne l’ordre exact des feuilles et les racines à poser', () => {
  const html = page('demarrer');
  const ordre = ['tokens.css', 'base.css', 'components.css'];
  let position = -1;
  for (const f of ordre) { const i = html.indexOf(f); assert.ok(i > position, `${f} est annoncé hors ordre`); position = i; }
  assert.match(html, /modal-root/);
  assert.match(html, /toast-root/);
});

test('Démarrer : la liste des feuilles est l’ordre que les trois pages d’entrée suivent', () => {
  const html = page('demarrer');
  const liste = html.match(/<ol id="feuilles"[^>]*>([\s\S]*?)<\/ol>/);
  assert.ok(liste, 'la liste ordonnée #feuilles manque');
  const annoncees = [...liste[1].matchAll(/<code>(css\/[\w-]+\.css)<\/code>/g)].map((m) => m[1]);
  assert.deepEqual(annoncees, ['css/tokens.css', 'css/base.css', 'css/components.css']);
  for (const f of ['index.html', 'admin.html', 'mobile.html']) {
    assert.deepEqual(feuillesDe(f).slice(0, 3), annoncees, `${f} ne charge plus les trois feuilles dans cet ordre`);
    assert.ok(lire(f).indexOf('fonts.googleapis.com/css2') < lire(f).indexOf('css/tokens.css'), `${f} : les polices passent avant les feuilles`);
  }
  // Une feuille d'écran vient après, et jamais les deux.
  assert.deepEqual(feuillesDe('admin.html').slice(3), ['css/admin.css']);
  assert.deepEqual(feuillesDe('mobile.html').slice(3), ['css/mobile.css']);
  assert.deepEqual(feuillesDe('index.html').slice(3), []);
  // La liste annonce un ordre : le site lui garde ses numéros, que `.ds-liste` retirerait (list-style: disc).
  assert.match(sansCss(lire('design-system/css/site.css')), /ol\.ds-liste\s*\{\s*list-style:\s*decimal/);
  const t = texte(html);
  assert.match(t, /css\/admin\.css ou css\/mobile\.css, jamais les deux/);
  // tokens.css ne contient que des variables, dans un seul :root ; les trois pages posent des chemins relatifs.
  assert.match(sansCss(lire('css/tokens.css')), /^\s*:root\s*\{[^{}]*\}\s*$/);
  assert.match(t, /tokens\.css : toutes les valeurs de base, sous forme de variables, dans un seul :root\. Elle ne contient que des variables/);
  for (const f of ['index.html', 'admin.html', 'mobile.html']) assert.doesNotMatch(lire(f), /(?:src|href)="\/[^/]/, `${f} : chemin absolu`);
  assert.match(t, /Les chemins sont relatifs, sans barre oblique au début/);
  assert.match(t, /les polices d’abord/);
  // Les polices de l'outil, telles que les trois pages les demandent.
  assert.ok(lire('mobile.html').includes('family=Inter:wght@400;700&amp;family=Bricolage+Grotesque:wght@800&amp;display=swap'));
  assert.match(t, /Inter/);
  assert.match(t, /Bricolage Grotesque/);
});

test('Démarrer : les racines vont après le contenu et avant les scripts, vides, comme les trois pages', () => {
  const html = page('demarrer');
  assert.match(texte(html), /<div id="modal-root"><\/div>/);
  assert.match(texte(html), /<div id="toast-root"><\/div>/);
  assert.match(texte(html), /avant les scripts/);
  for (const f of ['index.html', 'admin.html', 'mobile.html']) {
    const h = lire(f);
    assert.ok(h.indexOf('id="modal-root"') < h.indexOf('<script'), f);
  }
  // Sans elles, openModal et toast lèvent : la page renvoie à Modale, qui le démontre.
  assert.match(html, /href="modale\.html"/);
});

test('Démarrer : les quatre utilitaires sont ceux de components.css, avec leurs valeurs', () => {
  const t = texte(page('demarrer'));
  assert.match(t, /Quatre classes de components\.css, et deux variantes de \.row/);
  assert.match(regle(COMPONENTS, '.stack'), /flex-direction:\s*column;\s*gap:\s*var\(--space-lg\)/);
  assert.match(regle(COMPONENTS, '.row'), /align-items:\s*center;\s*gap:\s*var\(--space-md\)/);
  assert.match(regle(COMPONENTS, '.row--between'), /justify-content:\s*space-between/);
  assert.match(regle(COMPONENTS, '.row--wrap'), /flex-wrap:\s*wrap/);
  assert.match(regle(COMPONENTS, '.grid-2'), /repeat\(2, 1fr\);\s*gap:\s*var\(--space-lg\)/);
  assert.match(regle(COMPONENTS, '.grid-4'), /repeat\(4, 1fr\);\s*gap:\s*var\(--space-lg\)/);
  assert.match(COMPONENTS, /@media \(max-width: 900px\) \{ \.grid-4 \{ grid-template-columns: repeat\(2, 1fr\); \} \}/);
  assert.match(COMPONENTS, /@media \(max-width: 600px\) \{ \.grid-2, \.grid-4 \{ grid-template-columns: 1fr; \} \}/);
  // Définis une seule fois dans components.css, à une exception près : aucune autre occurrence, dans
  // aucun sélecteur, d'une autre feuille (pas seulement une règle dont la liste vaudrait `.stack`).
  const occurrences = (css) => css.split('\n').map((l) => l.trim()).filter((l) => /\.(?:stack|row|grid-2|grid-4)(?![\w-])/.test(l));
  assert.deepEqual(occurrences(ADMIN), ['.detail-grid > .stack { min-width: 0; }'], 'admin.css parle des utilitaires ailleurs que dans l’exception que la page nomme');
  assert.deepEqual(occurrences(MOBILE), []);
  assert.deepEqual(occurrences(BASE), []);
  assert.ok(t.includes('min-width: 0') && t.includes('.detail-grid'), 'Démarrer ne nomme pas l’exception d’admin.css');
  for (const phrase of ['.stack', '.row', '.row--between', '.row--wrap', '.grid-2', '.grid-4', '900 px', '600 px', 'une colonne', 'deux colonnes']) assert.ok(t.includes(phrase), `Démarrer ne dit pas « ${phrase} »`);
});

test('Démarrer : l’exemple « ecran » n’emploie que des classes du dépôt, aucun style en ligne, aucune couleur', () => {
  const section = demo('demarrer', 'ecran');
  assert.doesNotMatch(section, /\bstyle=|#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'une valeur en dur dans la démonstration');
  const classes = classesDe(section);
  for (const c of classes) assert.match(TOUTES_LES_FEUILLES, new RegExp(`\\.${c}(?![\\w-])`), `« ${c} » n’existe dans aucune feuille`);
  for (const c of ['stack', 'row', 'row--between', 'grid-2', 'card']) assert.ok(classes.includes(c), `l’exemple n’emploie pas .${c}`);
  assert.ok(compact(section).includes(compact(badge('loan', 'en_cours'))), 'le badge n’est pas celui de badge()');
  // L'exemple charge les trois feuilles, et seulement elles.
  assert.deepEqual([...exemple('demarrer').matchAll(/href="\.\.\/\.\.\/(css\/[\w-]+\.css)"/g)].map((m) => m[1]), ['css/tokens.css', 'css/base.css', 'css/components.css']);
  assert.match(page('demarrer'), /fichier: 'demarrer\.html', demo: 'ecran'/);
  assert.match(page('demarrer'), /codeHtml\(\{ fichier: 'demarrer\.html', demo: 'ecran'/);
});

test('Démarrer : tout token écrit dans une page existe dans tokens.css, et les feuilles n’écrivent aucune couleur en dur', () => {
  let vus = 0;
  for (const nom of ['demarrer', 'mobile', 'modale']) {
    for (const [, dedans] of sansCommentaires(page(nom)).replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/<code>([^<]*)<\/code>/g)) {
      for (const [jeton] of decode(dedans).matchAll(/(?<![\w-])--[a-z][\w-]*/g)) {
        vus += 1;
        // `--token` est le mot que la page emploie pour dire « n'importe quel token ».
        assert.ok(jeton in TOKENS || jeton === '--token', `${nom} : « ${jeton} » n’est pas un token de tokens.css`);
      }
    }
  }
  assert.ok(vus >= 8, `${vus} token(s) lu(s) : le détecteur ne voit plus les pages`);
  // La règle de Démarrer : aucune couleur en dur hors de tokens.css, sauf la loupe recopiée dans une image.
  for (const [nom, css] of [['base', BASE], ['components', COMPONENTS], ['admin', ADMIN], ['mobile', MOBILE]]) {
    assert.doesNotMatch(css.replace(/url\("[^"]*"\)/g, ''), /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, `${nom}.css écrit une couleur en dur : Démarrer ne peut plus le dire`);
  }
  assert.match(COMPONENTS, /%23757678/);
  const t = texte(page('demarrer'));
  assert.match(t, /var\(--token\)/);
  assert.match(t, /aucune feuille de l’outil n’écrit une couleur en dur/);
  // Seule la couleur est tenue : les espacements en pixels que la page cite sont dans les feuilles, et la page ne dit pas « la règle est tenue ».
  assert.match(regle(MOBILE, '.m-nav__tab'), /gap:\s*2px/);
  assert.match(regle(COMPONENTS, '.nav-item__count'), /padding:\s*0 6px/);
  assert.match(t, /Seule la couleur est tenue à la lettre/);
  assert.match(t, /l’écart de 2 px de la barre du bas ou la marge de 6 px du compteur du menu/);
  assert.doesNotMatch(t, /La règle est tenue/);
  assert.match(t, /la loupe du champ de recherche/);
});

test('Démarrer mène à toutes les pages de composants, et les liens se résolvent depuis composants/', () => {
  const html = sansCommentaires(page('demarrer'));
  // Le test du brief cherchait `href="composants/…"` ; depuis composants/demarrer.html cette adresse
  // viserait composants/composants/… : le lien correct est le nom du fichier voisin.
  for (const c of COMPOSANTS) {
    const voisin = c.href.replace(/^composants\//, '');
    if (voisin === 'demarrer.html') continue;
    assert.match(html, new RegExp(`href="${voisin.replace('.', '\\.')}"`), `Démarrer ne mène pas à ${voisin}`);
    assert.ok(existsSync(new URL(voisin, DOSSIER_COMPOSANTS)), `${voisin} n’existe pas`);
  }
  assert.match(html, /href="\.\.\/couleurs\.html"/);
  assert.match(html, /href="\.\.\/typographie\.html"/);
  assert.match(html, /href="bouton\.html#accessibilite"/);
});

test('Démarrer : Démarrer et Fondations sont dispensées des six ancres, mais pas des repères communs', () => {
  const html = page('demarrer');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /id="contenu"/);
  assert.match(html, /enteteHtml\('composants\/demarrer\.html'\)/);
  assert.match(html, /sommaireHtml\('composants\/demarrer\.html'\)/);
  assert.match(html, /piedHtml\('composants\/demarrer\.html'\)/);
  assert.match(html, /brancherSommaire\(\)/);
  assert.match(html, /brancherCadres\(/);
  assert.doesNotMatch(html, /<link[^>]*(?:components|admin|mobile)\.css/);
  assert.match(html, /<!--[^>]*dispensée de la trame des six ancres/, 'la dispense doit être déclarée dans un commentaire, comme Fondations');
});

test('Démarrer : les classes écrites en code existent, et chaque point du contrôle final renvoie à une page', () => {
  const noms = classesCodees('demarrer');
  assert.deepEqual([...noms].sort(), ['detail-grid', 'grid-2', 'grid-4', 'row', 'row--between', 'row--wrap', 'stack'], 'Démarrer nomme les quatre utilitaires, les deux variantes de .row, et .detail-grid de l’exception d’admin.css, et eux seuls');
  for (const c of noms) assert.match(TOUTES_LES_FEUILLES, new RegExp(`\\.${c}(?![\\w-])`), `demarrer : « .${c} » n’existe dans aucune feuille`);
  const html = sansCommentaires(page('demarrer'));
  const section = html.slice(html.indexOf('id="avant-de-livrer"'));
  assert.ok(section.length > 100, 'la section « avant de livrer » manque');
  const puces = [...section.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  assert.ok(puces.length >= 4);
  for (const li of puces) assert.match(li, /<a href=/, `« ${texte(li).slice(0, 50)}… » ne renvoie à aucune page`);
});

test('Démarrer : le contrôle final dit les limites du kit pour le clavier et pour 360 px', () => {
  const t = texte(page('demarrer'));
  assert.match(t, /anneau de focus/);
  assert.match(t, /docs\/correctifs-figma\.md/);
  assert.match(t, /360 px/);
  // Une page qui invite à tabuler dit ce que fait Safari (tests/ds-code.test.mjs tient la règle sur toutes les pages).
  assert.match(t, /Option\+Tab/);
  // Les deux limites que la page nomme sont vraies : le tableau n'a aucun repli, et les grilles se replient à 600 px.
  assert.match(t, /le tableau ne se replie pas/);
  assert.doesNotMatch(`${COMPONENTS}${ADMIN}`, /overflow-x|\.table-wrap|\.table-responsive/, 'un repli du tableau existe : Démarrer doit changer');
  assert.match(COMPONENTS, /@media \(max-width: 600px\)/);
});

test('mobile : les textes sous 11 px et le survol des lignes sont ceux de la feuille, et Typographie les nomme', () => {
  assert.match(regle(MOBILE, '.m-nav__tab'), /font-size:\s*10px/);
  assert.match(regle(MOBILE, '.week-grid .slot'), /font-size:\s*9px/);
  assert.match(regle(BASE, '.body-tiny'), /font-size:\s*11px/);
  assert.doesNotMatch(regle(MOBILE, '.m-item--button:hover'), /\bcolor\s*:/);
  assert.match(MOBILE_BRUT, /@media \(prefers-reduced-motion: reduce\) \{ \.spinner \{ animation: none/);
  const typo = lire('design-system/typographie.html');
  assert.ok(typo.includes('9&nbsp;px dans les cases de la grille des créneaux, 10&nbsp;px dans ses en-têtes et dans la barre de navigation mobile'));
  assert.ok(typo.includes('ils ne sont pas à imiter'));
  const t = texte(page('mobile'));
  assert.match(t, /sous les 11 px de body-tiny/);
  assert.match(t, /dit de ne pas les imiter/);
  assert.match(t, /le survol d’une ligne-bouton change son fond et pas son texte/i);
  assert.match(t, /prefers-reduced-motion/);
});

test('mobile : les fonctions de layout.js que la page nomme existent, et le shell s’y accroche par trois identifiants', () => {
  const layout = lire('js/mobile/layout.js');
  for (const f of ['headerHtml', 'bottomNavHtml', 'mountNav', 'setHeader']) assert.match(layout, new RegExp(`export function ${f}\\(`));
  assert.match(layout, /export const TABS = \[/);
  assert.match(layout, /getElementById\('header'\)/);
  assert.match(lire('js/mobile/app.js'), /getElementById\('nav'\)[\s\S]*getElementById\('view'\)/);
  const t = texte(page('mobile'));
  for (const phrase of ['#header', '#view', '#nav', 'headerHtml({ title, user, back })', 'bottomNavHtml(currentPath)', 'setHeader', 'mountNav', 'TABS']) assert.ok(t.includes(phrase), `la page ne nomme pas « ${phrase} »`);
});

test('mobile : le téléphone a deux boutons propres, .seg__btn et .m-nav__scan, et la page les nomme', () => {
  // Les boutons que mobile.css définit : toute classe de bouton (`__btn`) ou de lancement (`__scan`), hors l'icône de `.btn > svg`.
  const propres = [...new Set([...MOBILE.matchAll(/(?:^|\n)\.([a-z][\w-]*?(?:__btn|__scan))\b/g)].map((m) => m[1]))].sort();
  assert.deepEqual(propres, ['m-nav__scan', 'seg__btn'], 'mobile.css définit d’autres boutons : la page doit changer');
  for (const c of propres) {
    assert.ok(regle(MOBILE, `.${c}`), `${c} n’a plus de règle de base dans mobile.css`);
    assert.equal(new RegExp(`\\.${c}\\b`).test(COMPONENTS), false, `${c} est aussi dans components.css`);
  }
  // Les écrans les emploient.
  assert.ok(utilise(/class="seg__btn/).includes('js/mobile/views/salle.js'));
  assert.ok(utilise(/class="m-nav__scan"/).includes('js/mobile/layout.js'));
  // Ni badge, ni champ, ni modale propres au téléphone.
  assert.doesNotMatch(MOBILE, /\.(?:badge|input|select|textarea|modal)\b/);
  const t = texte(page('mobile'));
  assert.match(t, /Le téléphone n’a que deux boutons propres, \.seg__btn .*? et \.m-nav__scan/);
  assert.match(t, /Pas de badge, de champ ni de modale propres/);
  assert.doesNotMatch(t, /Il n’y en a pas/);
});
