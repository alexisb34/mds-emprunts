// La lecture des tokens et la page Fondations : le site LIT `css/tokens.css`, il ne le
// recopie pas. Ces tests épinglent la lecture (rien ne se perd, rien n'est inventé), les
// aperçus, et les cas où la page ne peut pas lire — fichier local, feuille introuvable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROUPES, lireTokens, valeursDepuis, tableauTokensHtml, lireTokensDepuisDocument,
  messageHtml, sommaireGroupesHtml,
} from '../design-system/js/tokens.js';

const lireSite = (chemin) => readFileSync(new URL(`../design-system/${chemin}`, import.meta.url), 'utf8');

test('lireTokens range par groupe et garde l’ordre du fichier', () => {
  const g = lireTokens(':root { --brand-primary: #662483; --space-sm: 8px; --radius-md: 8px; }');
  assert.deepEqual(g.find((x) => x.cle === 'marque').tokens, [{ nom: '--brand-primary', valeur: '#662483' }]);
  assert.deepEqual(g.find((x) => x.cle === 'espacements').tokens.map((t) => t.nom), ['--space-sm']);
});

test('un token inconnu tombe dans « autres » au lieu de disparaître', () => {
  const g = lireTokens(':root { --chose-inedite: 3px; }');
  assert.deepEqual(g.find((x) => x.cle === 'autres').tokens, [{ nom: '--chose-inedite', valeur: '3px' }]);
});

test('aucun token du vrai fichier ne se perd', () => {
  const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  const attendus = [...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
  const obtenus = lireTokens(css).flatMap((g) => g.tokens.map((t) => t.nom));
  assert.deepEqual([...obtenus].sort(), [...attendus].sort());
});

test('les commentaires ne deviennent pas des tokens', () => {
  assert.deepEqual(lireTokens(':root { /* --faux: 1px; */ --space-sm: 8px; }').flatMap((g) => g.tokens.map((t) => t.nom)), ['--space-sm']);
});

test('valeursDepuis rend un dictionnaire nom → valeur', () => {
  assert.deepEqual(valeursDepuis(':root { --brand-primary: #662483; --space-sm: 8px; }'),
    { '--brand-primary': '#662483', '--space-sm': '8px' });
});

test('sans serveur, la page explique au lieu de rester vide', () => {
  const docRefuse = { styleSheets: [{ get cssRules() { throw new Error('SecurityError'); } }] };
  const r = lireTokensDepuisDocument(docRefuse);
  assert.equal(r.ok, false);
  assert.match(r.message, /serveur/i);
  assert.match(r.message, /npm run serve/);
});

// ---- Ce que les assertions du plan ne couvrent pas ----

test('tous les tokens du vrai fichier sont réclamés : « autres » est vide aujourd’hui', () => {
  // Ce test échoue quand un token a été ajouté à tokens.css sans famille. Le site n'est pas
  // cassé : le token s'affiche quand même, sous « Autres ». C'est un signal pour lui donner sa place.
  const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
  const sansFamille = lireTokens(css).find((g) => g.cle === 'autres').tokens.map((t) => t.nom);
  assert.deepEqual(sansFamille, [], [
    `Ces tokens de css/tokens.css ne sont réclamés par aucun groupe : ${sansFamille.join(', ')}.`,
    'Que faire : ajoutez leur préfixe (ex. « --nouveau- ») au champ `prefixes` du groupe qui convient dans GROUPES',
    '(design-system/js/tokens.js) — ou créez un groupe si c’est une nouvelle famille.',
    'Si « Autres » est vraiment le bon classement, retirez ce test : rien d’autre ne casse.',
  ].join('\n'));
});

test('les groupes se suivent dans l’ordre annoncé, « autres » en dernier', () => {
  assert.deepEqual(GROUPES.map((g) => g.cle), [
    'marque', 'texte', 'fonds', 'bordures', 'retours', 'statuts',
    'espacements', 'rayons', 'tailles', 'ombres', 'typographie', 'autres',
  ]);
  assert.deepEqual(GROUPES.at(-1).prefixes, [], '« autres » ne réclame rien : il ramasse le reste');
  for (const g of GROUPES) assert.ok(g.titre && g.titre.trim(), `${g.cle} n’a pas de titre`);
});

test('les dérivés vont avec leur famille, pas dans « autres »', () => {
  const g = lireTokens(':root { --brand-primary-hover: #521d69; --feedback-error-hover: #c8253a; --status-maintenance-text: #7a5300; --overlay: rgba(60, 60, 59, 0.5); --alpha-white-80: rgba(255, 255, 255, 0.8); }');
  const dans = (cle) => g.find((x) => x.cle === cle).tokens.map((t) => t.nom);
  assert.deepEqual(dans('marque'), ['--brand-primary-hover']);
  assert.deepEqual(dans('retours'), ['--feedback-error-hover']);
  assert.deepEqual(dans('statuts'), ['--status-maintenance-text']);
  assert.deepEqual(dans('fonds'), ['--overlay', '--alpha-white-80']);
  assert.deepEqual(dans('autres'), []);
});

test('une valeur qui cite un autre token garde sa forme, virgules comprises', () => {
  const v = valeursDepuis(":root { --font-heading: 'Bricolage Grotesque', var(--font-body); --shadow-card: 0 1px 2px rgba(27, 27, 28, 0.04), 0 4px 12px -2px rgba(27, 27, 28, 0.05); }");
  assert.equal(v['--font-heading'], "'Bricolage Grotesque', var(--font-body)");
  assert.equal(v['--shadow-card'], '0 1px 2px rgba(27, 27, 28, 0.04), 0 4px 12px -2px rgba(27, 27, 28, 0.05)');
});

test('seul le :root fournit des tokens, et une déclaration finale sans point-virgule compte', () => {
  const v = valeursDepuis('.carte { --local: 1px; } :root { --space-sm: 8px; --space-md: 12px }');
  assert.deepEqual(v, { '--space-sm': '8px', '--space-md': '12px' });
});

test('un token déclaré deux fois ne s’affiche qu’une fois, avec la valeur qui gagne', () => {
  const g = lireTokens(':root { --space-sm: 8px; } :root { --space-sm: 10px; }');
  assert.deepEqual(g.find((x) => x.cle === 'espacements').tokens, [{ nom: '--space-sm', valeur: '10px' }]);
});

// ---- Le tableau ----

test('le tableau donne à chaque token son nom, sa valeur et de quoi copier var(--nom)', () => {
  const html = tableauTokensHtml(lireTokens(':root { --brand-primary: #662483; }'));
  assert.match(html, /<code[^>]*>--brand-primary<\/code>/);
  assert.match(html, /<code[^>]*>#662483<\/code>/);
  assert.match(html, /data-copie="var\(--brand-primary\)"/);
  assert.match(html, /<button type="button"[^>]*aria-label="Copier var\(--brand-primary\)"/);
});

test('la pastille lit le token : elle porte var(--nom), jamais la couleur écrite en dur', () => {
  const html = tableauTokensHtml(lireTokens(':root { --brand-primary: #662483; --text-inverse: #ffffff; }'));
  assert.match(html, /style="background: var\(--brand-primary\)"/);
  assert.match(html, /style="background: var\(--text-inverse\)"/);
  assert.doesNotMatch(html.replace(/<code[^>]*>[^<]*<\/code>/g, ''), /#662483/, 'la couleur ne doit apparaître que comme texte de valeur');
});

test('une couleur translucide se pose sur un fond clair ET un fond sombre', () => {
  const html = tableauTokensHtml(lireTokens(':root { --alpha-white-10: rgba(255, 255, 255, 0.1); --overlay: rgba(60, 60, 59, 0.5); --bg-surface: #ffffff; }'));
  const pastilles = html.match(/class="ds-pastille"[^>]*>/g);
  assert.equal(pastilles.length, 3);
  // La pastille d'un token est celle dont le fond COMMENCE par lui : le damier des autres cite `--bg-surface`.
  const de = (nom) => pastilles.find((p) => p.includes(`background: var(${nom})`) || p.includes(`background: linear-gradient(var(${nom})`));
  const [blanc10, overlay, opaque] = [de('--alpha-white-10'), de('--overlay'), de('--bg-surface')];
  assert.match(blanc10, /var\(--alpha-white-10\)[^"]*var\(--text-primary\)[^"]*var\(--bg-surface\)/);
  assert.match(overlay, /var\(--overlay\)[^"]*var\(--text-primary\)/);
  assert.doesNotMatch(opaque, /var\(--text-primary\)/, 'une couleur pleine n’a pas besoin de damier');
});

test('la translucidité se reconnaît sous toutes les écritures de la couleur', () => {
  const damier = (valeur) => /background: linear-gradient/.test(tableauTokensHtml(lireTokens(`:root { --bg-essai: ${valeur}; }`)));
  for (const v of ['rgba(0, 0, 0, 0.5)', 'rgb(0 0 0 / 50%)', 'hsla(0, 0%, 0%, .5)', '#ffffff80', '#fff8']) assert.equal(damier(v), true, v);
  for (const v of ['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 100%)', 'rgb(0 0 0 / 1)', 'rgb(0 0 0)', '#fff', '#ffffffff', '#ffff']) assert.equal(damier(v), false, v);
});

test('chaque famille a l’aperçu qui montre sa valeur', () => {
  const html = tableauTokensHtml(lireTokens(`:root {
    --space-lg: 16px; --radius-md: 8px; --stroke-thin: 1px; --size-sidebar: 260px;
    --shadow-card: 0 1px 2px rgba(27, 27, 28, 0.04); --font-heading: 'Bricolage Grotesque', var(--font-body);
  }`));
  assert.match(html, /class="ds-barre"[^>]*style="width: var\(--space-lg\)"/);
  assert.match(html, /class="ds-rayon"[^>]*style="border-radius: var\(--radius-md\)"/);
  assert.match(html, /class="ds-trait"[^>]*style="border-top-width: var\(--stroke-thin\)"/);
  assert.match(html, /class="ds-barre"[^>]*style="width: var\(--size-sidebar\)"/);
  assert.match(html, /class="ds-ombre"[^>]*style="box-shadow: var\(--shadow-card\)"/);
  assert.match(html, /class="ds-police[^"]*"[^>]*style="font-family: var\(--font-heading\)/);
});

test('un token inconnu s’affiche sans aperçu, sous « Autres »', () => {
  const html = tableauTokensHtml(lireTokens(':root { --chose-inedite: 3px; }'));
  assert.match(html, /<h2[^>]*>Autres<\/h2>/);
  assert.match(html, /--chose-inedite/);
  assert.doesNotMatch(html, /ds-barre|ds-pastille|ds-rayon/);
});

test('un groupe vide n’affiche ni titre ni liste', () => {
  const html = tableauTokensHtml(lireTokens(':root { --space-sm: 8px; }'));
  assert.match(html, /<h2[^>]*>Espacements<\/h2>/);
  assert.doesNotMatch(html, /Marque|Ombres|Autres/);
});

test('--border-muted est affiché avec sa mention « non tranché », et lui seul', () => {
  const html = tableauTokensHtml(lireTokens(':root { --border-default: #e1e2e6; --border-muted: #d1d5db; }'));
  const lignes = html.split('<li class="ds-jeton"').slice(1);
  const muted = lignes.find((l) => l.includes('>--border-muted<'));
  const defaut = lignes.find((l) => l.includes('>--border-default<'));
  assert.match(muted, /non tranché/i);
  assert.match(muted, /docs\/correctifs-figma\.md/);
  assert.doesNotMatch(defaut, /non tranché/i);
});

test('une valeur qui contient du HTML est échappée', () => {
  const html = tableauTokensHtml(lireTokens(':root { --chose-inedite: "<b>x</b>"; }'));
  assert.doesNotMatch(html, /<b>x/);
  assert.match(html, /&lt;b&gt;/);
});

test('chaque groupe porte une ancre, pour le sommaire de la page', () => {
  const html = tableauTokensHtml(lireTokens(':root { --space-sm: 8px; --radius-md: 8px; }'));
  assert.match(html, /<section class="ds-groupe" id="groupe-espacements"/);
  assert.match(html, /<section class="ds-groupe" id="groupe-rayons"/);
});

test('le sommaire des groupes ne mène qu’aux groupes qui s’affichent', () => {
  const html = sommaireGroupesHtml(lireTokens(':root { --space-sm: 8px; --radius-md: 8px; }'));
  assert.match(html, /<nav class="ds-groupes" aria-label="[^"]+"/);
  assert.match(html, /href="#groupe-espacements"/);
  assert.match(html, /href="#groupe-rayons"/);
  assert.doesNotMatch(html, /groupe-marque|groupe-autres/);
});

test('messageHtml échappe le texte, met le code en <code> et le gras en <strong>', () => {
  assert.equal(messageHtml('Lancez `npm run serve` <maintenant> : **vite**.'),
    'Lancez <code>npm run serve</code> &lt;maintenant&gt; : <strong>vite</strong>.');
});

// ---- Lire depuis le document ----

// Une feuille qui ressemble à ce que le navigateur rend : des règles avec leur `cssText`.
const feuille = (href, regles) => ({ href, cssRules: regles.map(([selectorText, cssText]) => ({ selectorText, cssText })) });

test('lireTokensDepuisDocument lit les règles :root de tokens.css et d’elle seule', () => {
  const doc = { styleSheets: [
    feuille('http://localhost:8123/css/tokens.css', [[':root', ':root { --brand-primary: #662483; --space-sm: 8px; }'], ['body', 'body { margin: 0; }']]),
    feuille('http://localhost:8123/design-system/css/site.css', [[':root', ':root { --ds-fond: #ffffff; }']]),
  ] };
  const r = lireTokensDepuisDocument(doc);
  assert.equal(r.ok, true);
  assert.deepEqual(r.groupes.flatMap((g) => g.tokens.map((t) => t.nom)), ['--brand-primary', '--space-sm']);
});

test('la feuille des polices, venue d’une autre origine, n’est même pas ouverte', () => {
  // Sur un serveur, `cssRules` d'une feuille de Google Fonts lève une SecurityError. Elle
  // ne doit pas faire croire que tokens.css est illisible.
  const polices = { href: 'https://fonts.googleapis.com/css2?family=Inter', get cssRules() { throw new Error('SecurityError'); } };
  const doc = { styleSheets: [polices, feuille('http://localhost:8123/css/tokens.css', [[':root', ':root { --space-sm: 8px; }']])] };
  assert.equal(lireTokensDepuisDocument(doc).ok, true);
});

test('un tokens.css refusé en lecture donne le message du serveur, même si d’autres feuilles passent', () => {
  const doc = { styleSheets: [
    feuille('file:///repo/design-system/css/site.css', []),
    { href: 'file:///repo/css/tokens.css', get cssRules() { throw new Error('SecurityError'); } },
  ] };
  const r = lireTokensDepuisDocument(doc);
  assert.equal(r.ok, false);
  assert.match(r.message, /npm run serve/);
});

test('sans feuille tokens.css chargée, la page le dit plutôt que d’afficher un tableau vide', () => {
  const r = lireTokensDepuisDocument({ styleSheets: [feuille('http://localhost:8123/css/base.css', [])] });
  assert.equal(r.ok, false);
  assert.match(r.message, /tokens\.css/);
});

test('une feuille tokens.css lue mais vide est une erreur, pas un tableau vide', () => {
  const r = lireTokensDepuisDocument({ styleSheets: [feuille('http://localhost:8123/css/tokens.css', [])] });
  assert.equal(r.ok, false);
  assert.match(r.message, /tokens\.css/);
});

// ---- La page ----

test('la page Fondations pose le chrome depuis le module, avec l’adresse relative à design-system/', () => {
  const html = lireSite('composants/fondations.html');
  assert.match(html, /enteteHtml\('composants\/fondations\.html'\)/);
  assert.match(html, /sommaireHtml\('composants\/fondations\.html'\)/);
  assert.match(html, /piedHtml\('composants\/fondations\.html'\)/);
  assert.match(html, /from '\.\.\/js\/chrome\.js'/);
  assert.match(html, /from '\.\.\/js\/tokens\.js'/);
});

test('la page Fondations a un seul h1, la cible du lien d’évitement, et pas de trame de composant', () => {
  const html = lireSite('composants/fondations.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<h1[^>]*>\s*Fondations\s*<\/h1>/);
  assert.match(html, /<main id="contenu"/);
  assert.doesNotMatch(html, /id="a-quoi"/, 'Fondations est dispensée de la trame des six ancres');
});

test('la page Fondations charge les polices avant ses feuilles et reste relative', () => {
  const html = lireSite('composants/fondations.html');
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'la page ne charge pas les polices par <link>');
  const pre1 = html.indexOf('<link rel="preconnect" href="https://fonts.googleapis.com">');
  const pre2 = html.indexOf('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
  assert.ok(pre1 >= 0 && pre2 > pre1 && famille > pre2, 'preconnect googleapis, preconnect gstatic crossorigin, puis la famille');
  assert.ok(famille < html.indexOf('href="../../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
  assert.match(html, /href="\.\.\/\.\.\/css\/tokens\.css"/);
  assert.match(html, /href="\.\.\/\.\.\/css\/base\.css"/);
  assert.match(html, /href="\.\.\/css\/site\.css"/);
});

test('la page Fondations porte déjà l’explication du serveur : un module bloqué sur file:// ne la laisse pas vide', () => {
  // Sur `file://`, le navigateur refuse aussi les modules : la page ne peut pas se
  // construire elle-même. Le message doit donc être dans le HTML, pas seulement dans le JS.
  const html = lireSite('composants/fondations.html');
  assert.match(html, /id="tokens"[^>]*>[\s\S]*serveur[\s\S]*npm run serve/);

  // La cause du fichier local existe deux fois — ici et dans `lireTokensDepuisDocument` — : mot pour mot.
  const { message } = lireTokensDepuisDocument({ styleSheets: [{ get cssRules() { throw new Error('SecurityError'); } }] });
  const raison = html.match(/<p class="body" id="raison">([\s\S]*?)<\/p>/)[1].replace(/<\/?code>/g, '`').replace(/&nbsp;/g, ' ');
  assert.equal(raison.trim(), message);
});

test('le message de repli ne prétend pas connaître la cause, et n’apparaît pas à chaque chargement', () => {
  // Il s'affiche aussi pour un module en 404 ou une exception : le premier paragraphe est neutre.
  // Et il est retardé, pour ne pas clignoter sur un site qui marche.
  const html = lireSite('composants/fondations.html');
  assert.match(html, /class="ds-message ds-message--attente"[^>]*>\s*<p class="body">Le tableau n’a pas pu s’afficher\./);
  assert.match(lireSite('css/site.css'), /\.ds-message--attente\s*\{[^}]*animation:\s*ds-apparait\s+[\d.]+m?s\s+(?!0m?s)[\d.]+m?s\b/);
});

test('la page n’attend pas la feuille : une feuille en échec ne doit pas suspendre le module', () => {
  // Un module est différé, il passe après les feuilles bloquantes : `load` est déjà parti, et
  // `error` aussi. Attendre l'un des deux ne se résoudrait jamais sur un tokens.css en 404.
  const html = lireSite('composants/fondations.html');
  assert.doesNotMatch(html, /\bawait\b[^\n]*(?:new Promise|addEventListener)/);
  assert.doesNotMatch(html, /addEventListener\(\s*['"](?:load|error)['"]/);
});
