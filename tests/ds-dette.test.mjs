// Le chapitre Couleurs et la dette de contraste publiée.
//
// Ce que ces tests tiennent, et ce qu'ils ne tiennent pas :
//
// - Les paires publiées sont celles que `css/components.css` FORME. Chacune est retrouvée dans
//   la feuille (le sélecteur, la couleur du texte, celle du fond, la taille), et les
//   sélecteurs sont retrouvés dans les vues qui les émettent. Un test lit donc la même chose
//   que la page affirme : ni plus, ni une liste recopiée.
// - Les ratios sont recalculés depuis `css/tokens.css`. Le verdict se juge sur le rapport non
//   arrondi : le rapport arrondi n'est qu'un affichage.
// - Aucun test ne juge que la page « se lit comme une dette ». Cela se regarde dans un
//   navigateur, et le rapport de la tâche dit ce qui y a été vu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ratio, ratioExact, verdict } from '../design-system/js/contraste.js';
import { valeursDepuis } from '../design-system/js/tokens.js';
import { enteteHtml } from '../design-system/js/chrome.js';
import { COULEURS } from '../design-system/js/logo.js';
import { LABELS } from '../js/models.js';
import {
  PAIRES_KIT, enLettres, tableauDetteHtml, jugerPaire, tonConseille, fondConseille, tonCommun, repereCorrection, syntheseDette, ancrePaire, DATE_CONSTAT, CIBLE_CONSEIL, MARGE_CONSEIL,
} from '../design-system/js/dette.js';
import { pageHtml, palette, familleDe, FAMILLES, SEMANTIQUES, NON_EMPLOYES } from '../design-system/js/couleurs.js';

// ---- Ce que les tests lisent ----

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const sansCommentaires = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const VALEURS = valeursDepuis(lire('css/tokens.css'));

// Les règles « feuilles » d'une feuille de style. Un `@media` n'est pas matché, ses règles
// internes le sont : ce test ne juge que les règles de premier niveau et celles qu'un
// `@media` contient, ce qui suffit pour les sélecteurs cherchés ici.
function reglesDe(css) {
  return [...sansCommentaires(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selecteurs: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
    corps: m[2],
  }));
}

// Les déclarations d'un sélecteur, toutes règles confondues, la dernière gagnant. Comme la
// cascade quand la spécificité est égale.
function declarations(regles, selecteur) {
  const sortie = {};
  for (const r of regles.filter((x) => x.selecteurs.includes(selecteur))) {
    for (const d of r.corps.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) sortie[d[1]] = d[2].trim();
  }
  return sortie;
}

const KIT = reglesDe([lire('css/base.css'), lire('css/components.css')].join('\n'));
const FEUILLES = ['base.css', 'components.css', 'admin.css', 'mobile.css'].map((f) => lire(`css/${f}`)).join('\n');
const DASHBOARD = lire('js/admin/views/dashboard.js');
// Toutes les vues et tous les modules : pour savoir si une classe ou un texte est émis QUELQUE PART.
const VUES = readdirSync(new URL('../js/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => lire(`js/${f}`)).join('\n');
const UI = lire('js/ui.js');

const badges = PAIRES_KIT.filter((p) => p.nom.startsWith('badge'));
const virgule = (n) => n.toFixed(2).replace('.', ',');
const dec = (n) => String(n).replace('.', ',');
const r2 = (a, b) => virgule(ratio(a, b));
const texte = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ---- Les assertions du brief ----

test('les six badges du kit sont tous couverts', () => {
  const badges = PAIRES_KIT.filter((p) => p.nom.startsWith('badge'));
  assert.deepEqual(badges.map((p) => p.nom).sort(),
    ['badge--available', 'badge--borrowed', 'badge--hs', 'badge--late', 'badge--maintenance', 'badge--reserved']);
  for (const p of badges) { assert.equal(p.px, 11); assert.equal(p.gras, true); }
});

test('les ratios publiés sont ceux des vrais tokens', () => {
  const valeurs = valeursDepuis(readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8'));
  const r = (nom) => { const p = PAIRES_KIT.find((x) => x.nom === nom); return ratio(valeurs[p.texte], valeurs[p.fond]); };
  assert.equal(r('badge--maintenance'), 1.72);
  assert.equal(r('badge--available'), 2.49);
  assert.equal(r('badge--reserved'), 2.91);
  assert.equal(r('badge--hs'), 3.51);
  assert.equal(r('badge--late'), 3.54);
  assert.equal(r('badge--borrowed'), 8.23);
});

test('le tableau publié annonce cinq échecs et une seule conformité', () => {
  const valeurs = valeursDepuis(readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8'));
  const html = tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom.startsWith('badge')), valeurs);
  assert.equal((html.match(/échoue/g) || []).length, 5);
  assert.equal((html.match(/\bAA\b/g) || []).length, 1);
  assert.match(html, /1,72/);   // les ratios sont écrits à la française
});

// ---- Les mesures de la tâche, au-delà des badges ----

test('les cartes KPI et le tableau sont mesurés comme le chef de projet les a mesurés', () => {
  // Les chiffres du 26 octobre : texte discret sur chaque fond de carte, en-tête de tableau
  // sur blanc, texte discret sur une ligne survolée.
  const r = (nom) => { const p = PAIRES_KIT.find((x) => x.nom === nom); assert.ok(p, `${nom} n'est pas publiée`); return ratio(VALEURS[p.texte], VALEURS[p.fond]); };
  assert.equal(r('kpi'), 3.51);
  assert.equal(r('kpi--disponible'), 4.06);
  assert.equal(r('kpi--emprunte'), 3.82);
  assert.equal(r('kpi--retard'), 3.76);
  assert.equal(r('kpi--salle'), 4.02);
  assert.equal(r('table th'), 4.55);
  assert.equal(r('table tr:hover'), 4.13);
});

test('chaque paire est une paire, une seule fois', () => {
  const noms = PAIRES_KIT.map((p) => p.nom);
  assert.equal(new Set(noms).size, noms.length, 'un nom revient deux fois');
  for (const p of PAIRES_KIT) {
    assert.ok(VALEURS[p.texte], `${p.nom} : ${p.texte} n'est pas dans tokens.css`);
    assert.ok(VALEURS[p.fond], `${p.nom} : ${p.fond} n'est pas dans tokens.css`);
    assert.ok(p.elements.length >= 1, `${p.nom} ne dit pas quel élément forme la paire`);
    // La taille d'une paire est la plus exigeante de ses éléments : la plus petite.
    assert.equal(p.px, Math.min(...p.elements.map((e) => e.px)), `${p.nom} : px n'est pas la plus petite taille`);
    assert.equal(p.gras, p.elements.every((e) => e.gras), `${p.nom} : gras n'est vrai que si tous les éléments le sont`);
  }
});

// ---- Preuve que chaque paire se produit vraiment dans le CSS, et que les vues l'émettent ----

test('chaque badge est formé par sa règle de components.css, à 11 px en gras', () => {
  const base = declarations(KIT, '.badge');
  assert.equal(base['font-size'], '11px');
  assert.equal(base['font-weight'], '700');
  assert.equal(badges.length, 6);
  for (const p of badges) {
    const regle = declarations(KIT, `.${p.nom}`);
    assert.equal(regle.color, `var(${p.texte})`, `${p.nom} : couleur du texte`);
    assert.equal(regle.background, `var(${p.fond})`, `${p.nom} : fond`);
    assert.deepEqual(p.elements, [{ selecteur: '.badge', px: 11, gras: true }]);
    // `badge()` doit pouvoir émettre cette variante : sa table des variantes la contient.
    const variante = p.nom.replace('badge--', '');
    assert.ok(new RegExp(`:\\s*'${variante}'`).test(UI.match(/const VARIANTS = \{[\s\S]*?\n\};/)[0]), `js/ui.js n'émet jamais la variante ${variante}`);
  }
});

test('les libellés des échantillons de badge sont ceux que l’outil affiche', () => {
  const connus = Object.values(LABELS).flatMap((famille) => Object.values(famille));
  for (const p of badges) assert.ok(connus.includes(p.libelle), `« ${p.libelle} » n'est un libellé d'aucune famille de js/models.js`);
});

test('chaque carte KPI est formée par components.css, et le tableau de bord les émet', () => {
  const kpi = PAIRES_KIT.filter((p) => p.nom === 'kpi' || p.nom.startsWith('kpi--'));
  assert.deepEqual(kpi.map((p) => p.nom).sort(), ['kpi', 'kpi--disponible', 'kpi--emprunte', 'kpi--retard', 'kpi--salle']);
  for (const p of kpi) {
    assert.equal(declarations(KIT, `.${p.nom}`).background, `var(${p.fond})`, `${p.nom} : fond`);
    assert.deepEqual(p.elements, [
      { selecteur: '.kpi__label', px: 14, gras: false },
      { selecteur: '.kpi__delta', px: 12, gras: false },
    ]);
    for (const e of p.elements) {
      const regle = declarations(KIT, e.selecteur);
      assert.equal(regle.color, `var(${p.texte})`, `${e.selecteur} : couleur du texte`);
      assert.equal(regle['font-size'], `${e.px}px`, `${e.selecteur} : taille`);
      assert.ok(!('font-weight' in regle) || Number(regle['font-weight']) < 700, `${e.selecteur} est en gras : le registre dit le contraire`);
    }
  }
  // Les quatre teintes sont des variantes que le tableau de bord pose, et la carte pose bien
  // un libellé et une variation à l'intérieur.
  for (const p of kpi.filter((x) => x.nom !== 'kpi')) assert.ok(DASHBOARD.includes(`'${p.nom}'`), `dashboard.js n'émet jamais ${p.nom}`);
  assert.match(DASHBOARD, /class="kpi__label"[\s\S]*class="kpi__delta"/);
  for (const p of kpi) {
    assert.ok(p.echantillon && p.echantillon.libelle && p.echantillon.variation, `${p.nom} n'a pas d'échantillon`);
  }
  for (const p of kpi.filter((x) => x.nom !== 'kpi')) assert.ok(DASHBOARD.includes(`'${p.echantillon.libelle}'`), `« ${p.echantillon.libelle} » n'est pas le libellé de ${p.nom} dans dashboard.js`);
});

test('la carte KPI neutre existe dans le kit, mais le tableau de bord ne l’emploie pas', () => {
  // La page le dit en toutes lettres sur la ligne `kpi` : cette phrase doit rester vraie.
  const appels = [...DASHBOARD.matchAll(/\bkpiCard\(([^\n]*)/g)].map((m) => m[1]).filter((ligne) => !ligne.startsWith('label,'));
  assert.equal(appels.length, 4, 'le tableau de bord ne pose plus quatre cartes');
  for (const ligne of appels) assert.match(ligne, /'kpi--(?:disponible|emprunte|retard|salle)'/, `un appel de kpiCard ne passe pas de teinte : ${ligne}`);
  const neutre = PAIRES_KIT.find((p) => p.nom === 'kpi');
  assert.match(neutre.note, /n’emploie pas/);
});

test('l’en-tête de tableau et la ligne survolée sont formés par le kit et par les vues', () => {
  const th = PAIRES_KIT.find((p) => p.nom === 'table th');
  const regleTh = declarations(KIT, '.table th');
  assert.equal(regleTh.color, `var(${th.texte})`);
  assert.equal(regleTh['font-size'], '11px');
  assert.equal(regleTh['font-weight'], '700');
  assert.deepEqual(th.elements, [{ selecteur: '.table th', px: 11, gras: true }]);
  // Le tableau est posé dans une carte, donc sur son fond.
  assert.equal(declarations(KIT, '.card').background, `var(${th.fond})`);
  assert.match(DASHBOARD, /<div class="card">[^\n]*\$\{lateRows\(late, date\)\}/, 'le tableau des retards n’est plus posé dans une .card');
  assert.match(DASHBOARD, /<table class="table"><thead><tr><th>/);

  const survol = PAIRES_KIT.find((p) => p.nom === 'table tr:hover');
  assert.equal(declarations(KIT, '.table tbody tr:hover').background, `var(${survol.fond})`);
  assert.equal(declarations(KIT, '.text-secondary').color, `var(${survol.texte})`);
  assert.equal(declarations(KIT, '.body-tiny')['font-size'], '11px');
  assert.deepEqual(survol.elements, [{ selecteur: '.body-tiny.text-secondary', px: 11, gras: false }]);
  // Une cellule du tableau de bord porte bien ce texte discret de 11 px.
  assert.match(DASHBOARD, /<td>[^\n]*<span class="body-tiny text-secondary">/);
  assert.match(lire('js/admin/views/emprunts.js'), /<span class="body-tiny text-secondary">/);
});

test('les échantillons posent exactement les tokens de leur paire', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  const exemplaires = [...html.matchAll(/<(?:span|div)[^>]*data-echantillon="([^"]+)"[^>]*style="([^"]*)"[^>]*>/g)];
  assert.equal(exemplaires.length, PAIRES_KIT.length, 'un échantillon par paire');
  for (const [, nom, style] of exemplaires) {
    const p = PAIRES_KIT.find((x) => x.nom === nom);
    assert.ok(p, `échantillon de ${nom} : paire inconnue`);
    assert.equal((style.match(/(?:^|;)\s*color:\s*var\((--[\w-]+)\)/) || [])[1], p.texte, `${nom} : texte de l'échantillon`);
    assert.equal((style.match(/background:\s*var\((--[\w-]+)\)/) || [])[1], p.fond, `${nom} : fond de l'échantillon`);
  }
  assert.equal([...html.matchAll(/data-echantillon="[^"]+"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-echantillon="[^"]+"/g)].length, PAIRES_KIT.length,
    'chaque échantillon est caché aux lecteurs d’écran : la ligne dit déjà la paire');
});

// ---- Le verdict se juge sur le rapport exact ----

test('un rapport de 4,4998 est jugé en dessous de 4,5 même s’il s’arrondit à 4,50', () => {
  // #7c7480 sur blanc : 4,499798, que `ratio` arrondit à 4,5. Le piège de l'arrondi.
  const p = { nom: 'piege', texte: '--t', fond: '--f', px: 12, gras: false, elements: [{ selecteur: '.x', px: 12, gras: false }] };
  const valeurs = { '--t': '#7c7480', '--f': '#ffffff' };
  assert.equal(ratio('#7c7480', '#ffffff'), 4.5);
  assert.ok(ratioExact('#7c7480', '#ffffff') < 4.5);
  const jugement = jugerPaire(p, valeurs);
  assert.equal(jugement.echoue, true);
  assert.equal(jugement.verdict, 'echec');
  const html = tableauDetteHtml([p], valeurs);
  assert.equal((html.match(/échoue/g) || []).length, 1);
  assert.doesNotMatch(html, /\bAA\b/);
  // L'affichage ne ment pas non plus : « 4,50 » à côté d'un seuil de 4,5 et d'un échec se
  // contredirait. On montre la troisième décimale.
  assert.match(html, /4,499/);
  assert.doesNotMatch(html, /4,50\b/);
});

test('un rapport pile à 4,5 est conforme : la borne est inclusive', () => {
  // `verdict` le fait déjà ; la page doit le reprendre sans le recalculer autrement.
  assert.equal(verdict(4.5, 12, false), 'AA');
  const jugement = jugerPaire(PAIRES_KIT.find((p) => p.nom === 'table th'), VALEURS);
  assert.equal(jugement.echoue, false);
  assert.equal(jugement.verdict, 'AA');
});

test('un rapport légèrement au-dessus de 4,5 ne change pas de verdict en s’affichant', () => {
  const jugement = jugerPaire(PAIRES_KIT.find((p) => p.nom === 'table th'), VALEURS);
  assert.equal(jugement.affiche, '4,55');
  assert.ok(jugement.exact > 4.5 && jugement.exact < 4.6);
});

test('les paires dont le grand texte tolère 3:1 sont jugées sur leur taille réelle', () => {
  // Aucune paire du kit n'est grande, donc aucune ne profite de 3:1 : à 3,51:1, 11 px gras échoue.
  for (const p of PAIRES_KIT) assert.ok(p.px < 18.66, `${p.nom} serait un grand texte : le registre le dirait`);
  const hs = jugerPaire(PAIRES_KIT.find((p) => p.nom === 'badge--hs'), VALEURS);
  assert.equal(hs.verdict, 'echec');
});

// ---- Le tableau ----

test('chaque ligne écrit ses ratios à la française, sans point décimal', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  assert.doesNotMatch(texte(html), /\d\.\d/, 'un nombre est écrit avec un point');
  for (const p of PAIRES_KIT) assert.ok(html.includes(`${virgule(ratio(VALEURS[p.texte], VALEURS[p.fond]))}:1`), `${p.nom} n'affiche pas son ratio`);
});

test('chaque ligne dit le texte, le fond, la taille et le seuil de sa paire', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  const lignes = [...html.matchAll(/<tr[^>]*data-paire="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(lignes.length, PAIRES_KIT.length);
  for (const [, nom, corps] of lignes) {
    const p = PAIRES_KIT.find((x) => x.nom === nom);
    assert.ok(p, `ligne ${nom} : paire inconnue`);
    for (const t of [p.texte, p.fond, VALEURS[p.texte], VALEURS[p.fond]]) assert.ok(corps.includes(t), `${nom} ne mentionne pas ${t}`);
    assert.ok(corps.includes(`${p.px}&nbsp;px`), `${nom} ne dit pas sa taille`);
    assert.ok(corps.includes('4,5:1'), `${nom} ne dit pas son seuil`);
  }
});

test('l’échec est dit en mots, pas seulement en couleur, et la conformité de même', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  const lignes = [...html.matchAll(/<tr[^>]*data-paire="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)];
  for (const [, nom, corps] of lignes) {
    const echoue = jugerPaire(PAIRES_KIT.find((x) => x.nom === nom), VALEURS).echoue;
    assert.equal(/échoue/.test(corps), echoue, `${nom} : le mot ne suit pas le verdict`);
    assert.equal(/\bconforme\b/.test(corps), !echoue, `${nom} : « conforme » ne suit pas le verdict`);
    assert.equal(/à corriger/.test(corps), echoue, `${nom} : « à corriger » ne suit pas le verdict`);
  }
  assert.match(html, /dt-ligne--echec/);
  assert.match(html, /dt-ligne--ok/);
});

test('la ligne de la carte neutre dit que l’outil ne l’emploie pas', () => {
  const html = tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom === 'kpi'), VALEURS);
  assert.match(texte(html), /n’emploie pas cette carte/);
  assert.doesNotMatch(tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom === 'kpi--retard'), VALEURS), /n’emploie pas/);
});

test('le tableau échappe ce qu’il reçoit', () => {
  const p = { nom: '<b>x</b>', texte: '--t', fond: '--f', px: 12, gras: false, elements: [{ selecteur: '.x', px: 12, gras: false }], libelle: '<i>y</i>' };
  const html = tableauDetteHtml([p], { '--t': '#000000', '--f': '#ffffff' });
  assert.doesNotMatch(html, /<b>x<\/b>|<i>y<\/i>/);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('le tableau a des en-têtes de colonne, un nom, et garde sa sémantique quand il se replie', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS, { titreId: 'titre-x' });
  assert.match(html, /<table[^>]*aria-labelledby="titre-x"/);
  assert.equal((html.match(/<th[^>]*scope="col"/g) || []).length, 7);
  assert.equal((html.match(/<th[^>]*scope="row"/g) || []).length, PAIRES_KIT.length);
  // Replié en cartes sur téléphone, un tableau perd ses rôles dans certains navigateurs.
  assert.match(html, /<table[^>]*role="table"/);
  assert.match(html, /<tr[^>]*role="row"/);
  // Chaque cellule se nomme, pour la version repliée.
  assert.ok((html.match(/data-etiquette="/g) || []).length >= PAIRES_KIT.length * 5);
});

// ---- Ce qu'il faudrait faire ----

test('tonConseille rend une couleur de la même teinte, plus sombre, qui passe 4,5:1', () => {
  const fond = VALEURS['--status-late-bg'];
  const ton = tonConseille(VALEURS['--status-late-fg'], fond);
  assert.ok(ratioExact(ton, fond) >= 4.5, `${ton} ne passe pas`);
  assert.notEqual(ton, VALEURS['--status-late-fg']);
  const hsl = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
    const l = (max + min) / 2;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, l };
  };
  const avant = hsl(VALEURS['--status-late-fg']); const apres = hsl(ton);
  assert.ok(apres.l < avant.l, 'le ton n’est pas plus sombre');
  assert.ok(Math.abs(apres.h - avant.h) < 4, `la teinte a bougé de ${Math.abs(apres.h - avant.h).toFixed(1)}°`);
});

test('tonConseille laisse tel quel ce qui passe déjà, et refuse de dire n’importe quoi', () => {
  assert.equal(tonConseille('#3c3c3b', '#ffffff'), '#3c3c3b');
  // Un texte clair sur un fond sombre qui échoue : le foncer l'empirerait, la fonction le refuse.
  assert.ok(ratioExact('#6a6a6a', '#3c3c3b') < 4.5);
  assert.throws(() => tonConseille('#6a6a6a', '#3c3c3b'), /foncer/);
});

test('le badge de maintenance renvoie à ce que le kit a déjà : --status-maintenance-text', () => {
  const p = PAIRES_KIT.find((x) => x.nom === 'badge--maintenance');
  assert.equal(p.existant, '--status-maintenance-text');
  assert.ok(ratioExact(VALEURS[p.existant], VALEURS[p.fond]) >= 4.5, 'le token existant ne passe pas sur ce fond');
  assert.equal(declarations(KIT, '.alert--warning').color, `var(${p.existant})`, 'l’alerte n’emploie plus ce token');
  const html = tableauDetteHtml([p], VALEURS);
  assert.match(html, /--status-maintenance-text/);
  assert.match(html, /6,21:1/);
});

test('la synthèse compte les paires et propose un seul correctif pour --text-secondary', () => {
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  assert.equal(s.mesurees, 18);
  assert.equal(s.echouent, 16);
  assert.equal(s.conformes, 2);
  assert.equal(s.mesurees, s.echouent + s.conformes);
  // Six lignes tiennent à un seul token. Le ton proposé passe sur chacune d'elles.
  const secondaires = PAIRES_KIT.filter((p) => p.texte === '--text-secondary' && jugerPaire(p, VALEURS).echoue);
  assert.equal(secondaires.length, 6);
  assert.equal(s.couvertes, 6);
  assert.deepEqual(secondaires.map((p) => p.famille).sort(), ['kpi', 'kpi', 'kpi', 'kpi', 'kpi', 'tableau']);
  for (const p of secondaires) assert.ok(ratioExact(s.tonSecondaire, VALEURS[p.fond]) >= 4.5, `${s.tonSecondaire} ne passe pas sur ${p.fond}`);
  assert.ok(ratioExact(s.tonSecondaire, '#ffffff') > ratioExact(VALEURS['--text-secondary'], '#ffffff'));
});

test('le texte principal est un repli sur les fonds pâles seulement : sur les aplats, c’est le fond qu’on fonce', () => {
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  const echecs = PAIRES_KIT.filter((x) => jugerPaire(x, VALEURS).echoue);
  const pales = echecs.filter((p) => ratioExact(VALEURS[p.texte], '#ffffff') > ratioExact(VALEURS[p.fond], '#ffffff'));
  const aplats = echecs.filter((p) => !pales.includes(p));
  assert.equal(s.fondsPales, pales.length);
  assert.equal(s.aplats, aplats.length);
  assert.deepEqual(aplats.map((p) => p.nom).sort(), ['btn--danger', 'toast--error', 'toast--success']);
  for (const p of pales) assert.ok(ratioExact(VALEURS['--text-primary'], VALEURS[p.fond]) >= s.textePrincipalMin - 1e-9, p.nom);
  assert.ok(s.textePrincipalMin >= 4.5);
  // Sur un aplat, le texte principal ne tient PAS : le dire serait faux.
  for (const p of aplats) assert.ok(ratioExact(VALEURS['--text-primary'], VALEURS[p.fond]) < 4.5, `${p.nom} : le texte principal tient sur cet aplat, la page doit le dire autrement`);
});

test('le repère de correction fonce le texte sur un fond pâle, et le fond sous un texte blanc', () => {
  const de = (nom) => PAIRES_KIT.find((p) => p.nom === nom);
  const succes = repereCorrection(de('toast--success'), VALEURS);
  assert.equal(succes.role, 'fond');
  assert.ok(ratioExact(VALEURS['--text-inverse'], succes.hex) >= 4.5, `${succes.hex} ne passe pas sous du blanc`);
  assert.ok(ratioExact(succes.hex, '#ffffff') > ratioExact(VALEURS['--feedback-success'], '#ffffff'), 'le fond n’est pas plus sombre');
  const retard = repereCorrection(de('alert--error'), VALEURS);
  assert.equal(retard.role, 'texte');
  assert.ok(ratioExact(retard.hex, VALEURS['--status-late-bg']) >= 4.5);
  // Ce qui passe n'a pas de repère ; ce que le kit sait déjà corriger non plus (il renvoie à son token).
  assert.equal(repereCorrection(de('badge--borrowed'), VALEURS), null);
  assert.equal(repereCorrection(de('toast--error'), VALEURS), null);
  assert.equal(repereCorrection(de('badge--maintenance'), VALEURS), null);
});

test('fondConseille ne sait foncer qu’un fond plus sombre que son texte, et laisse tel quel ce qui passe', () => {
  assert.equal(fondConseille('#ffffff', '#3c3c3b'), '#3c3c3b');
  // Un texte gris clair sur blanc échoue, et le fond est déjà plus clair que le texte : on ne sait pas le foncer.
  assert.ok(ratioExact('#cccccc', '#ffffff') < 4.5);
  assert.throws(() => fondConseille('#cccccc', '#ffffff'), /foncer/);
});

test('le rouge d’erreur plus sombre que le kit a déjà passe 4,5:1 sous du blanc, et le bouton de danger l’emploie au survol', () => {
  // Les deux lignes `btn--danger` et `toast--error` renvoient à ce token : la phrase doit être vraie.
  for (const nom of ['btn--danger', 'toast--error']) {
    const p = PAIRES_KIT.find((x) => x.nom === nom);
    assert.equal(p.existant, '--feedback-error-hover');
    assert.equal(p.existantRole, 'fond');
    assert.ok(ratioExact(VALEURS[p.texte], VALEURS[p.existant]) >= 4.5, `${p.existant} ne passe pas sous ${p.texte}`);
  }
  assert.equal(declarations(KIT, '.btn--danger:hover:not(:disabled)').background, 'var(--feedback-error-hover)');
  const html = tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom === 'btn--danger'), VALEURS);
  assert.match(html, /--feedback-error-hover/);
  assert.match(html, /5,55:1/);
});

test('la date du constat est celle de la décision', () => {
  assert.equal(DATE_CONSTAT.iso, '2026-10-26');
  assert.equal(DATE_CONSTAT.texte, '26 octobre 2026');
});

// ---- Ce que la page annonce comme périmètre ----

test('les cinq retours (alertes, bouton de danger, notifications) sont formés par le CSS et émis par les vues', () => {
  const de = (nom) => PAIRES_KIT.find((p) => p.nom === nom);
  const retours = ['toast--success', 'alert--info', 'alert--error', 'btn--danger', 'toast--error'];
  assert.deepEqual(retours.map((n) => de(n)?.famille), ['notification', 'alerte', 'alerte', 'bouton', 'notification']);
  // Une alerte : 14 px, graisse normale.
  const alerte = declarations(KIT, '.alert');
  assert.equal(alerte['font-size'], '14px');
  assert.ok(!('font-weight' in alerte));
  for (const nom of ['alert--error', 'alert--info']) {
    const p = de(nom);
    const d = declarations(KIT, `.${nom}`);
    assert.equal(d.color, `var(${p.texte})`, `${nom} : texte`);
    assert.equal(d.background, `var(${p.fond})`, `${nom} : fond`);
    assert.deepEqual(p.elements, [{ selecteur: '.alert', px: 14, gras: false }]);
    assert.ok(VUES.includes(`alert ${nom}`), `aucune vue n'émet « alert ${nom} »`);
  }
  // Le bouton de danger : `.btn` 14 px gras, `.btn--sm` 12 px ; les deux tailles sont émises.
  const danger = de('btn--danger');
  assert.equal(declarations(KIT, '.btn--danger').color, `var(${danger.texte})`);
  assert.equal(declarations(KIT, '.btn--danger').background, `var(${danger.fond})`);
  assert.equal(declarations(KIT, '.btn')['font-size'], '14px');
  assert.equal(declarations(KIT, '.btn')['font-weight'], '700');
  assert.equal(declarations(KIT, '.btn--sm')['font-size'], '12px');
  assert.deepEqual(danger.elements, [{ selecteur: '.btn', px: 14, gras: true }, { selecteur: '.btn--sm', px: 12, gras: true }]);
  assert.ok(VUES.includes('btn--danger btn--sm'), 'aucune vue n’émet le petit bouton de danger');
  assert.match(UI, /btn btn--\$\{a\.variant/, 'les modales ne fabriquent plus btn--<variante>');
  assert.match(VUES, /variant: 'danger'/, 'aucune modale ne demande le bouton de danger');
  // Les notifications : `.toast` pose le texte et la taille, la variante pose le fond.
  const toast = declarations(KIT, '.toast');
  assert.equal(toast.color, 'var(--text-inverse)');
  assert.equal(toast['font-size'], '14px');
  assert.equal(toast['font-weight'], '700');
  for (const nom of ['toast--success', 'toast--error']) {
    const p = de(nom);
    assert.equal(p.texte, '--text-inverse');
    assert.equal(declarations(KIT, `.${nom}`).background, `var(${p.fond})`, `${nom} : fond`);
    assert.deepEqual(p.elements, [{ selecteur: '.toast', px: 14, gras: true }]);
  }
  assert.match(UI, /toast toast--\$\{variant\}/);
  assert.match(VUES, /toast\([^)]*'success'\)/, 'aucune vue ne lance de notification de succès');
  assert.match(VUES, /toast\([^)]*'error'\)/, 'aucune vue ne lance de notification d’erreur');
  // Les échantillons écrivent un texte que l'application écrit (à la casse près : elle l'écrit en milieu de phrase).
  for (const nom of retours) {
    const texteEchantillon = de(nom).echantillon.texte.toLowerCase();
    assert.ok(VUES.toLowerCase().includes(texteEchantillon), `« ${de(nom).echantillon.texte} » n'est écrit par aucune vue`);
  }
});

test('le périmètre restant est honnête : les paires repérées mais non vérifiées dans les vues sont bien sous le seuil', () => {
  // La page dit que le tableau n'est pas l'inventaire du kit et nomme ce qui reste. Cette phrase se lit dans le CSS.
  const nomDe = (v) => (v.match(/var\((--[\w-]+)\)/) || [])[1];
  const sous = (nomTexte, nomFond, px, gras) => verdict(ratioExact(VALEURS[nomTexte], VALEURS[nomFond]), px, gras) === 'echec';
  assert.equal(nomDe(declarations(KIT, '.text-error').color), '--feedback-error');
  assert.equal(nomDe(declarations(KIT, '.text-success').color), '--feedback-success');
  assert.ok(KIT.some((r) => r.selecteurs.includes('.input::placeholder') && /var\(--text-disabled\)/.test(r.corps)), 'le texte désactivé n’est plus celui des champs vides');
  assert.equal(declarations(reglesDe(lire('css/admin.css')), '.page-header__meta').color, 'var(--text-secondary)');
  // Sur une carte blanche pour les trois premiers, sur le fond de l'application pour le dernier : toutes sous le seuil.
  assert.ok(sous('--feedback-error', '--bg-surface', 14, false), '.text-error passe sur blanc');
  assert.ok(sous('--feedback-success', '--bg-surface', 14, false), '.text-success passe sur blanc');
  assert.ok(sous('--text-disabled', '--bg-surface', 14, false), 'le texte désactivé passe sur blanc');
  assert.ok(sous('--text-secondary', '--bg-canvas', 14, false), 'le texte discret passe sur le fond de l’application');
  // Et aucune n'est déjà au tableau.
  for (const sel of ['.text-error', '.text-success', '.page-header__meta']) {
    assert.ok(!PAIRES_KIT.some((p) => p.elements.some((e) => e.selecteur === sel)), `${sel} est déjà au tableau : la phrase est périmée`);
  }
});

// ---- Les conseils de réparation : un conseil faux est pire que pas de conseil ----

// Le ton écrit dans la cellule « Ce qu'il faudrait faire » d'une ligne.
const tonAffiche = (html, nom) => {
  const ligne = html.match(new RegExp(`<tr[^>]*data-paire="${nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<\\/tr>`))[0];
  const cellule = ligne.match(/data-etiquette="Ce qu’il faudrait faire">([\s\S]*?)<\/td>/)[1];
  return (cellule.match(/jusqu’à <code>(#[0-9a-f]{6})<\/code>/) || [])[1];
};

test('la valeur affichée sur une ligne en --text-secondary règle TOUTES les lignes de ce token', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  const lignes = PAIRES_KIT.filter((p) => p.texte === '--text-secondary' && jugerPaire(p, VALEURS).echoue);
  assert.equal(lignes.length, 6);
  assert.equal((texte(html).match(/même valeur pour toutes les lignes en --text-secondary/g) || []).length, 6, 'chaque ligne doit dire que la valeur est la même pour les six');
  const affichees = lignes.map((p) => tonAffiche(html, p.nom));
  // Une seule valeur pour les six lignes, et c'est celle de la page et de la synthèse.
  assert.deepEqual([...new Set(affichees)], [s.tonSecondaire], `les lignes affichent ${affichees.join(', ')}`);
  // Et copier cette valeur règle chaque ligne : elle passe sur CHAQUE fond, y compris le plus exigeant.
  for (const p of lignes) assert.ok(ratioExact(affichees[0], VALEURS[p.fond]) >= 4.5, `${affichees[0]} ne règle pas ${p.nom}`);
});

test('un token partagé par plusieurs lignes en échec reçoit un seul ton, quelle que soit la ligne lue', () => {
  const html = tableauDetteHtml(PAIRES_KIT, VALEURS);
  const parToken = new Map();
  for (const p of PAIRES_KIT.filter((x) => jugerPaire(x, VALEURS).echoue && !x.existant && ratioExact(VALEURS[x.texte], '#ffffff') > ratioExact(VALEURS[x.fond], '#ffffff'))) {
    parToken.set(p.texte, [...(parToken.get(p.texte) || []), p]);
  }
  const partages = [...parToken.entries()].filter(([, lignes]) => lignes.length > 1);
  assert.ok(partages.length >= 2, 'le détecteur ne voit plus de token partagé');
  for (const [jeton, lignes] of partages) {
    const tons = new Set(lignes.map((p) => tonAffiche(html, p.nom)));
    assert.equal(tons.size, 1, `${jeton} : ${lignes.map((p) => `${p.nom} ${tonAffiche(html, p.nom)}`).join(', ')}`);
    for (const p of lignes) assert.ok(ratioExact([...tons][0], VALEURS[p.fond]) >= 4.5, `${[...tons][0]} ne règle pas ${p.nom}`);
  }
  // Les deux alertes reprennent les couleurs de deux badges : le même ton y mène.
  assert.equal(tonAffiche(html, 'badge--late'), tonAffiche(html, 'alert--error'));
  assert.equal(tonAffiche(html, 'badge--reserved'), tonAffiche(html, 'alert--info'));
});

test('un ton proposé a une vraie marge : il vise 4,8:1, pas le premier ton qui passe', () => {
  assert.equal(MARGE_CONSEIL, 0.3);
  assert.equal(CIBLE_CONSEIL, 4.5 + MARGE_CONSEIL);
  let vus = 0;
  for (const p of PAIRES_KIT) {
    const repere = repereCorrection(p, VALEURS);
    if (!repere) continue;
    vus += 1;
    const [a, b] = repere.role === 'texte' ? [repere.hex, VALEURS[p.fond]] : [VALEURS[p.texte], repere.hex];
    assert.ok(ratioExact(a, b) >= CIBLE_CONSEIL, `${p.nom} : ${repere.hex} ne donne que ${ratioExact(a, b).toFixed(3)}`);
  }
  assert.ok(vus >= 12, `${vus} repères seulement`);
  // Sur la ligne la plus exigeante, le ton reste le plus clair qui atteint la cible (il ne fonce pas pour rien).
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  const marge = ratioExact(s.tonSecondaire, VALEURS[s.fondExigeant]);
  assert.ok(marge >= CIBLE_CONSEIL && marge < CIBLE_CONSEIL + 0.1, `${marge.toFixed(3)} sur ${s.fondExigeant}`);
  // Et la fonction, seule : un échec reçoit la marge, un succès reste tel quel.
  const ton = tonConseille(VALEURS['--status-late-fg'], VALEURS['--status-late-bg']);
  assert.ok(ratioExact(ton, VALEURS['--status-late-bg']) >= CIBLE_CONSEIL);
  assert.equal(tonConseille('#3c3c3b', '#ffffff'), '#3c3c3b');
});

test('la page dit que les tons sont des repères avec une marge, et dans quel sens on peut les ajuster', () => {
  const dette = PAGE.match(/<section[^>]*id="dette"[\s\S]*?<\/section>\s*$/)[0];
  const marge = texte(dette.match(/<p class="body" id="dette-marge">[\s\S]*?<\/p>/)[0]);
  assert.ok(marge.includes(`vise ${dec(CIBLE_CONSEIL)}:1`), 'la cible n’est pas écrite');
  assert.ok(marge.includes(`${dec(MARGE_CONSEIL)} de marge`), 'la marge n’est pas écrite');
  assert.match(marge, /repère, pas une limite/);
  assert.match(marge, /éclaircir/);
  assert.match(marge, /au moins à 4,5:1 sur chaque fond où le token sert/);
  assert.match(marge, /pas seulement sur la ligne qu’on lit/);
  // Le fond le plus exigeant est nommé, avec le ratio du ton proposé ET la marge réelle ; la ligne la plus
  // facile, que le lecteur risque de surveiller, est nommée aussi, avec le ratio qu'elle affiche.
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  const secondaires = PAIRES_KIT.filter((p) => p.texte === '--text-secondary' && jugerPaire(p, VALEURS).echoue);
  const exigeant = ratioExact(s.tonSecondaire, VALEURS[s.fondExigeant]);
  const facile = secondaires.map((p) => ({ fond: p.fond, r: ratioExact(s.tonSecondaire, VALEURS[p.fond]) })).reduce((a, b) => (b.r > a.r ? b : a));
  assert.equal(s.fondExigeant, '--bg-muted');
  assert.ok(marge.includes(`le fond le plus exigeant est ${s.fondExigeant}`), 'le fond exigeant n’est pas nommé');
  assert.ok(marge.includes(`donne ${virgule(exigeant)}:1`), 'le ratio sur le fond exigeant manque');
  assert.ok(marge.includes(`${virgule(exigeant - 4.5)} de marge réelle`), 'la marge réelle manque');
  assert.ok(marge.includes(`la ligne en ${facile.fond} en affiche ${virgule(facile.r)}:1`), 'la ligne la plus facile n’est pas nommée avec son ratio');
  assert.ok(facile.r - 4.5 > 3 * (exigeant - 4.5), 'la ligne facile ne trompe plus : la phrase n’a plus d’objet');
  assert.match(marge, /foncer davantage ne fait jamais perdre de contraste/);
});

test('conseiller « employer --feedback-error-hover comme fond » dit aussi qu’il faut assombrir le survol', () => {
  const html = tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom === 'btn--danger'), VALEURS);
  assert.match(texte(html), /identique à son état survolé/);
  assert.match(texte(html), /assombrir l’état survolé/);
  assert.match(registre().replace(/\s+/g, ' '), /assombrir l’état survolé/);
  // La raison est vraie : le survol du bouton de danger EST ce token.
  assert.equal(declarations(KIT, '.btn--danger:hover:not(:disabled)').background, 'var(--feedback-error-hover)');
  // La notification n'a pas de survol : elle n'a pas cet avertissement.
  assert.doesNotMatch(texte(tableauDetteHtml(PAIRES_KIT.filter((p) => p.nom === 'toast--error'), VALEURS)), /survolé/);
});

test('la page dit que le registre est un fichier du dépôt, pas une page de ce site', () => {
  const brut = texte(PAGE.match(/<section[^>]*id="dette"[\s\S]*?<\/section>\s*$/)[0]);
  assert.match(brut, /docs\/correctifs-figma\.md ?, un fichier du dépôt du projet, qui n’est pas une page de ce site/);
  // Et c'est vrai : le fichier est du Markdown à la racine de docs/, pas une page de design-system/.
  readFileSync(new URL('../docs/correctifs-figma.md', import.meta.url));
  assert.throws(() => readFileSync(new URL('../design-system/correctifs-figma.md', import.meta.url)));
});

test('la page dit où se range ce site lui-même, et c’est vrai de sa feuille', () => {
  const section = PAGE.match(/<section[^>]*id="marque-produit"[\s\S]*?<\/section>/)[0];
  const phrase = texte(section.match(/<p class="body ds-mesure" id="ce-site">[\s\S]*?<\/p>/)[0]);
  assert.match(phrase, /Ce site suit le même partage/);
  assert.match(phrase, /ses boutons sont violets, comme ses liens dans le texte, le lien de la page courante et les listes d’étage/);
  assert.match(phrase, /liens de la barre de navigation et du sommaire restent gris/);
  assert.doesNotMatch(phrase, /ses liens sont violets/);
  assert.match(phrase, /deux pastels de l’accueil, violet clair sous l’étage Marque et turquoise clair sous l’étage Composants, sont décoratifs/);
  assert.match(phrase, /ne portent pas le partage/);
  assert.match(phrase, /turquoise du logo n’y sert qu’en décor/);
  assert.match(phrase, /jamais sous du texte/);
  assert.match(phrase, /seule sa version très claire sert de fond/);
  assert.match(phrase, /logo, lui, y garde ses couleurs/);
  // Ce que la phrase affirme, lu dans site.css : le violet du site est celui du produit, le turquoise
  // n'apparaît que dans des bordures, aucun fond ne le porte.
  const racine = sansCommentaires(lire('design-system/css/site.css')).match(/:root\s*\{([^}]*)\}/)[1];
  const valeur = (nom) => racine.match(new RegExp(`${nom}\\s*:\\s*(#[0-9a-fA-F]{6})`))[1].toLowerCase();
  assert.equal(valeur('--ds-violet'), VALEURS['--brand-primary'].toLowerCase());
  assert.equal(valeur('--ds-turquoise'), COULEURS.turquoise.toLowerCase());
  // « Seule sa version très claire sert de fond » : le fond frais du site est le turquoise très clair du kit.
  assert.equal(valeur('--ds-fond-frais'), VALEURS['--brand-secondary-subtle'].toLowerCase());
  const css = sansCommentaires(lire('design-system/css/site.css')).replace(/:root\s*\{[^}]*\}/, '');
  const emplois = [...css.matchAll(/([\w-]+)\s*:[^;{}]*var\(--ds-turquoise\)/g)].map((m) => m[1]);
  assert.ok(emplois.length >= 2, 'le turquoise n’est plus employé du tout : la phrase est périmée');
  for (const propriete of emplois) assert.match(propriete, /^border/, `--ds-turquoise est employé en « ${propriete} » : ce n’est plus un décor`);
  // Les liens : lus un par un, parce qu'une phrase sur une couleur doit être exacte jusqu'au bout.
  const couleurDe = (selecteur) => (css.match(new RegExp(`${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`)) || [''])[0].match(/(?:^|[;{\s])color:\s*(var\(--[\w-]+\))/)?.[1];
  assert.equal(couleurDe('.ds-nav__lien'), 'var(--ds-texte-secondaire)', 'les liens de navigation ne sont plus gris');
  assert.equal(couleurDe('.ds-sommaire__lien'), 'var(--ds-texte-secondaire)', 'les liens du sommaire ne sont plus gris');
  assert.equal(couleurDe('.ds-nav__lien[aria-current]'), 'var(--ds-lien)');
  assert.equal(couleurDe('.ds-lien-texte'), 'var(--ds-lien)');
  assert.equal(couleurDe('.ds-etage__liste a'), 'var(--ds-lien)');
  assert.equal(valeur('--ds-texte-secondaire'), '#757678', 'le gris des liens de navigation n’est plus celui du texte discret');
  // Les pastels de l'accueil : ce que la phrase dit, lu dans la feuille et dans la page d'accueil.
  const accueil = lire('design-system/index.html');
  assert.match(accueil, /class="ds-etage ds-etage--marque"/);
  assert.match(accueil, /class="ds-etage ds-etage--composants"/);
  assert.equal(css.match(/\.ds-etage--marque\s*\{\s*background:\s*(var\(--[\w-]+\))/)[1], 'var(--ds-fond-doux)');
  assert.equal(css.match(/\.ds-etage--composants\s*\{\s*background:\s*(var\(--[\w-]+\))/)[1], 'var(--ds-fond-frais)');
  // « violet clair » et « turquoise clair » : le fond doux est du violet, pas du turquoise.
  assert.ok(valeur('--ds-fond-doux') !== valeur('--ds-fond-frais'));
  const teinte = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return r > g && b > g ? 'violet' : g > r && b > r ? 'turquoise' : '?'; };
  assert.equal(teinte(valeur('--ds-fond-doux')), 'violet');
  assert.equal(teinte(valeur('--ds-fond-frais')), 'turquoise');
  const boutons = css.match(/\.ds-bouton\s*\{[^}]*\}/)[0];
  assert.match(boutons, /background:\s*var\(--ds-violet\)/);
  assert.match(css.match(/\.ds-nav__lien\[aria-current\]\s*\{[^}]*\}/)[0], /color:\s*var\(--ds-lien\)/);
  assert.equal(valeur('--ds-lien'), VALEURS['--brand-primary'].toLowerCase());
});

test('le registre écrit la marge et les tons que la page affiche', () => {
  const REGISTRE = registre().replace(/\s+/g, ' ');
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  assert.ok(REGISTRE.includes(`vise ${dec(CIBLE_CONSEIL)}:1`), 'le registre ne dit pas la cible');
  assert.ok(REGISTRE.includes(`${dec(MARGE_CONSEIL)} de marge`));
  assert.ok(REGISTRE.includes(`\`${s.tonSecondaire}\``));
  assert.ok(REGISTRE.includes(`${virgule(ratio(s.tonSecondaire, VALEURS[s.fondExigeant]))}:1 sur \`${s.fondExigeant}\``), 'le ratio du ton unique sur le fond le plus exigeant');
  assert.ok(REGISTRE.includes('au moins à 4,5:1 sur chaque fond où le token sert'), 'le registre ne dit pas « sur chaque fond »');
  assert.ok(REGISTRE.includes(`la ligne de \`--bg-canvas\` affiche ${virgule(ratio(s.tonSecondaire, VALEURS['--bg-canvas']))}:1`), 'le registre ne nomme pas la ligne qui trompe');
  const succes = repereCorrection(PAIRES_KIT.find((p) => p.nom === 'toast--success'), VALEURS);
  assert.ok(REGISTRE.includes(`\`${succes.hex}\` (${virgule(ratio(VALEURS['--text-inverse'], succes.hex))}:1 sous du blanc`), 'le vert plus sombre et son ratio');
  assert.doesNotMatch(REGISTRE, /suffit \(4,5:1 sous du blanc/);
});

// ---- La règle du nom ----

test('les feuilles du kit n’écrivent aucune couleur en dur, hormis la loupe de .input--search', () => {
  const litteraux = [...sansCommentaires(FEUILLES).matchAll(/(?:#|%23)[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)].map((m) => m[0]);
  assert.deepEqual(litteraux, ['%23757678'], 'le kit écrit une couleur en dur de plus (ou de moins) : la page Couleurs le dit à tort');
  assert.equal('#757678', VALEURS['--text-secondary'], 'la loupe n’a plus la couleur de --text-secondary');
  assert.match(declarations(KIT, '.input--search').background, /url\("data:image\/svg\+xml[^"]*stroke='%23757678'/);
});

test('les tokens que la page dit non employés ne sont employés par aucune feuille du kit, et eux seuls', () => {
  const couleurs = Object.entries(VALEURS).filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v)).map(([n]) => n);
  const employes = (nom) => new RegExp(`var\\(\\s*${nom}\\s*[,)]`).test(sansCommentaires(FEUILLES));
  for (const nom of NON_EMPLOYES) assert.ok(VALEURS[nom], `${nom} n'existe pas`);
  for (const nom of NON_EMPLOYES) assert.equal(employes(nom), false, `${nom} est employé : la page le dit à tort`);
  const oublies = couleurs.filter((n) => !employes(n) && !NON_EMPLOYES.includes(n));
  assert.deepEqual(oublies, [], 'ces couleurs ne sont employées par aucune feuille et la page ne le dit pas');
  // La conséquence que la page tire : le turquoise du logo est dans les tokens, mais le kit
  // n'en pose aucun aplat.
  assert.equal(VALEURS['--brand-secondary'].toLowerCase(), COULEURS.turquoise.toLowerCase());
  assert.equal(VALEURS['--text-primary'].toLowerCase(), COULEURS.anthracite.toLowerCase());
});

// ---- La palette ----

test('toute couleur opaque de tokens.css est rangée dans une famille, et une seule', () => {
  const groupes = palette(VALEURS);
  const vues = new Map();
  for (const f of groupes) for (const c of f.couleurs) {
    for (const j of c.jetons) {
      assert.equal(vues.has(j), false, `${j} apparaît deux fois`);
      vues.set(j, f.cle);
      assert.equal(familleDe(j).cle, f.cle, `${j} : la famille de la couleur n'est pas celle de son token`);
    }
  }
  const attendus = Object.entries(VALEURS).filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v)).map(([n]) => n);
  assert.deepEqual([...vues.keys()].sort(), attendus.sort(), 'un token de couleur disparaît de la page');
  assert.equal(groupes.some((f) => f.cle === 'autres'), false, 'un token ne trouve pas sa famille');
  assert.deepEqual(FAMILLES.map((f) => f.cle).slice(0, 5), ['violets', 'turquoises', 'roses', 'etats', 'neutres']);
});

test('une couleur à 4,4998:1 du blanc ne « passe » pas sur la palette, et ne s’écrit pas 4,50', () => {
  // La palette juge, elle aussi, sur le rapport exact : #7c7480 face au blanc fait 4,499798.
  const html = pageHtml({ ...VALEURS, '--zz-essai': '#7c7480' });
  const carte = html.match(/<li class="cl-teinte">(?:(?!<\/li>\s*<li class="cl-teinte">)[\s\S])*?#7c7480[\s\S]*?<\/li>\s*<\/ul>\s*<\/div>\s*<\/li>/)[0];
  assert.match(carte, /Texte blanc dessus&nbsp;: 4,499:1, sous le seuil/);
  assert.doesNotMatch(carte, /4,50:1/);
});

test('une même valeur n’est affichée qu’une fois, avec tous les tokens qui la portent', () => {
  const tous = palette(VALEURS).flatMap((f) => f.couleurs);
  const hexs = tous.map((c) => c.hex);
  assert.equal(new Set(hexs).size, hexs.length);
  const violet = tous.find((c) => c.hex === '#662483');
  assert.deepEqual(violet.jetons.sort(), ['--border-brand', '--brand-primary', '--status-borrowed-fg', '--text-brand']);
});

// ---- La page ----

const PAGE = pageHtml(VALEURS);

test('la page a un seul h1, une section par question, et ne saute aucun niveau de titre', () => {
  assert.equal((PAGE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE, /<h1[^>]*>\s*Les couleurs\s*<\/h1>/);
  const niveaux = [...PAGE.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaux.length; i++) assert.ok(niveaux[i] - niveaux[i - 1] <= 1, `un titre saute de h${niveaux[i - 1]} à h${niveaux[i]}`);
  for (const id of ['marque-produit', 'palette', 'noms', 'regle-du-nom', 'dette']) {
    assert.match(PAGE, new RegExp(`<section[^>]*id="${id}"`), `section ${id} absente`);
  }
});

test('aucune étiquette en capitales ne précède un titre', () => {
  assert.doesNotMatch(PAGE, /label-caps|label-mini-caps|text-transform:\s*uppercase/);
});

test('tout lien interne de la page mène à un id de la page, du chapitre Logo, ou à un fichier du site', () => {
  const ids = new Set([...PAGE.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, cible] of PAGE.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(cible), `#${cible} ne mène nulle part`);
  const logo = lire('design-system/js/logo.js');
  for (const [, id] of PAGE.matchAll(/href="logo\.html#([^"]+)"/g)) {
    assert.ok(logo.includes(`id: '${id.replace('interdit-', '')}'`), `logo.html#${id} n'existe pas`);
  }
  for (const [, f] of PAGE.matchAll(/href="((?:composants\/)?[\w-]+\.html)(?:#[^"]*)?"/g)) {
    assert.ok(['logo.html', 'composants/fondations.html'].includes(f), `${f} : la page n'a le droit de lier que des pages qui existent`);
    readFileSync(new URL(`../design-system/${f}`, import.meta.url));
  }
});

test('tout token nommé par la page existe dans tokens.css', () => {
  const nommes = new Set([...texte(PAGE.replace(/style="[^"]*"/g, '')).matchAll(/(?<![\w-])(--[a-z][\w-]*)/g)].map((m) => m[1]));
  const inconnus = [...nommes].filter((n) => !n.startsWith('--ds-') && !VALEURS[n]);
  assert.deepEqual(inconnus, [], 'la page nomme des tokens qui n’existent pas');
  assert.ok(nommes.size >= 25, `la page ne nomme que ${nommes.size} tokens : le détecteur a cessé de chercher`);
});

test('chaque token cité dans « Les noms à utiliser » existe, et son usage est réel dans le CSS', () => {
  assert.ok(SEMANTIQUES.length >= 4);
  let lignes = 0;
  for (const groupe of SEMANTIQUES) {
    for (const { jeton, usage } of groupe.jetons) {
      lignes += 1;
      assert.ok(VALEURS[jeton], `${jeton} n'existe pas`);
      assert.ok(usage.length > 10);
      assert.ok(PAGE.includes(jeton), `${jeton} n'est pas sur la page`);
      const employe = new RegExp(`var\\(\\s*${jeton}\\s*[,)]`).test(sansCommentaires(FEUILLES));
      assert.equal(employe, !NON_EMPLOYES.includes(jeton), `${jeton} : l’usage décrit ne correspond pas au CSS`);
      // Et la phrase le dit, dans les deux sens : un token non employé l'avoue, un token employé ne le prétend pas.
      assert.equal(/aucune feuille de css\//.test(usage), NON_EMPLOYES.includes(jeton), `${jeton} : la phrase d’usage contredit la liste des non employés`);
    }
  }
  assert.ok(lignes >= 18, `${lignes} tokens décrits seulement`);
});

test('chaque valeur citée dans la page vient de tokens.css ou des couleurs du logo', () => {
  const hexs = new Set([...texte(PAGE.replace(/style="[^"]*"/g, '')).matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()));
  const connus = new Set([...Object.values(VALEURS).filter((v) => /^#/.test(v)).map((v) => v.toLowerCase()), COULEURS.turquoise.toLowerCase(), COULEURS.anthracite.toLowerCase()]);
  // Les tons proposés par « ce qu'il faudrait faire » sont calculés, donc pas dans tokens.css.
  const proposes = new Set([...PAIRES_KIT.map((p) => repereCorrection(p, VALEURS)).filter(Boolean).map((r) => r.hex), syntheseDette(PAIRES_KIT, VALEURS).tonSecondaire].map((h) => h.toLowerCase()));
  for (const h of hexs) assert.ok(connus.has(h) || proposes.has(h), `${h} n'est ni un token ni un ton calculé`);
  assert.ok(hexs.size >= 15);
});

test('le logo est turquoise et anthracite, le violet est celui du produit, et la page le dit avec ces valeurs', () => {
  const brut = texte(PAGE);
  assert.ok(PAGE.includes('marque-produit'));
  assert.match(brut, new RegExp(COULEURS.turquoise.slice(1), 'i'));
  assert.match(brut, new RegExp(COULEURS.anthracite.slice(1), 'i'));
  assert.match(brut, /662483/i);
  assert.match(brut, /n’apparaît pas dans le logo/);
  // Les deux chiffres qui fondent la séparation sont calculés, pas écrits. On les cherche dans
  // LA phrase qui les porte : la palette en cite d'autres, qui ne doivent pas les couvrir.
  const mesures = texte(PAGE.match(/<p class="body">Deux mesures[\s\S]*?<\/p>/)[0]);
  assert.ok(mesures.includes(`${virgule(ratio(COULEURS.turquoise, '#ffffff'))}:1`), 'le turquoise sur blanc, dans la phrase des deux mesures');
  assert.ok(mesures.includes(`${virgule(ratio('#ffffff', VALEURS['--brand-primary']))}:1`), 'le blanc sur le violet, dans la phrase des deux mesures');
  // Les deux côtés sont montrés ensemble : le logo et une action violette dans le même cadre.
  assert.match(PAGE, /class="cl-ensemble"[\s\S]*assets\/logo\.svg[\s\S]*ds-bouton/);
  // Le renvoi vers l'interdit de recoloration du logo existe.
  assert.match(PAGE, /href="logo\.html#interdit-recolorer"/);
});

test('les usages du violet et du turquoise que la page cite sont dans le CSS du kit', () => {
  // « boutons pleins, liens, éléments actifs, anneau d'un champ en saisie » ; « fond d'alerte » pour le turquoise très clair.
  assert.equal(declarations(KIT, '.btn--primary').background, 'var(--brand-primary)');
  assert.equal(declarations(KIT, 'a').color, 'var(--text-brand)');
  assert.equal(VALEURS['--text-brand'].toLowerCase(), VALEURS['--brand-primary'].toLowerCase(), 'les liens ne sont plus du violet de marque');
  assert.equal(declarations(KIT, '.tab--active')['border-bottom-color'], 'var(--brand-primary)');
  assert.match(declarations(KIT, '.input:focus').outline, /var\(--brand-primary\)/);
  assert.equal(declarations(KIT, '.alert--info').background, 'var(--brand-secondary-subtle)');
  // « L'anthracite est le texte courant des outils ».
  assert.equal(declarations(KIT, 'body').color, 'var(--text-primary)');
  // Les mots de la page : ces usages sont bien ceux qu'elle écrit.
  assert.match(PAGE, /boutons pleins, les liens, les éléments actifs, l’anneau d’un champ en saisie/);
  assert.match(PAGE, /en fond d’alerte/);
});

test('la réserve sur le partage marque / produit est dite AVANT les cartes, comme celle du chapitre Logo', () => {
  const section = PAGE.match(/<section[^>]*id="marque-produit"[\s\S]*?<\/section>/)[0];
  const reserve = section.match(/<aside class="ds-message[^>]*>[\s\S]*?<\/aside>/);
  assert.ok(reserve, 'la section n’a pas d’encart de réserve');
  assert.ok(section.indexOf(reserve[0]) < section.indexOf('class="cl-carte"'), 'la réserve vient après les cartes : on la lit après s’en être servi');
  const brut = texte(reserve[0]);
  assert.match(brut, /Ce partage n’est pas une charte officielle/);
  assert.match(brut, /construit pour ce site/);
  assert.match(brut, /n’a été validé par personne du côté de la marque/);
  assert.match(brut, /ne le citez pas comme une règle de la marque/);
  // Et elle dit d'où il vient : ce que montrent le logo et le code.
  assert.match(brut, /seul ancrage de couleur de la marque/);
  // Elle n'est pas répétée en note de bas de section : une seule voix, en haut.
  assert.equal((texte(section).match(/n’a été validé par personne/g) || []).length, 1);
});

test('la règle du nom donne sa raison, avec les quatre rôles du violet', () => {
  const section = PAGE.match(/<section[^>]*id="regle-du-nom"[\s\S]*?<\/section>/)[0];
  assert.match(section, /var\(--brand-primary\)/);
  assert.match(section, /#662483/);
  // Les quatre rôles sont nommés dans la phrase qui les compte : `var(--brand-primary)` figure aussi dans
  // l'exemple de code, qui ne doit pas suffire.
  const roles = texte(section.match(/<p class="body">La première raison[\s\S]*?<\/p>/)[0]);
  for (const j of ['--brand-primary', '--text-brand', '--border-brand', '--status-borrowed-fg']) assert.ok(roles.includes(j), `${j} manque à la phrase des quatre rôles`);
  assert.match(roles, /quatre rôles/);
  assert.match(texte(section), /une seule exception/i);
  assert.match(section, /<pre[^>]*class="ds-code/);
});

test('la section de dette porte sa date, son périmètre, la décision, et le registre', () => {
  const dette = PAGE.match(/<section[^>]*id="dette"[\s\S]*?<\/section>\s*$/)[0];
  const brut = texte(dette);
  assert.match(dette, /<time datetime="2026-10-26">26 octobre 2026<\/time>/);
  assert.match(brut, /ne les reprenez pas/);
  assert.match(brut, /docs\/correctifs-figma\.md/);
  assert.match(brut, /Figma fait foi/);
  // Le périmètre : ce que le tableau couvre, et ce qu'il ne couvre pas.
  assert.match(brut, /n’est pas l’inventaire complet du kit/);
  const perimetre = texte(dette.match(/<p class="body-sm">Ce tableau n’est pas[\s\S]*?<\/p>/)[0]);
  for (const nom of ['badges de statut', 'cartes KPI', 'tableaux', 'alertes', 'bouton de danger', 'notifications']) assert.ok(perimetre.includes(nom), `le périmètre ne nomme pas « ${nom} » parmi ce qu’il couvre`);
  // Ce qui reste hors du tableau se lit dans le registre, pas dans cette phrase : chaque sélecteur
  // qu'elle cite y figure, chaque paire du registre y est citée, et le compte est celui du registre.
  const registre = readFileSync(new URL('../docs/correctifs-figma.md', import.meta.url), 'utf8');
  const duRegistre = [...registre.matchAll(/^\s*\| `(\.[^`]+)` \|/gm)].map((m) => m[1]).concat(['.text-error', '.text-success']);
  const citees = [...dette.match(/<p class="body-sm">Ce tableau n’est pas[\s\S]*?<\/p>/)[0].matchAll(/<code>(\.[^<]+)<\/code>/g)].map((m) => m[1]);
  assert.deepEqual([...citees].sort(), [...duRegistre].sort(), 'le périmètre ne cite pas exactement les paires que le registre dit vérifiées');
  for (const sel of citees) assert.ok(registre.includes(`\`${sel}\``), `${sel} ne figure pas au registre`);
  assert.ok(perimetre.toLowerCase().includes(`${enLettres(duRegistre.length)} autres paires`), 'le compte du périmètre n’est pas celui du registre');
  assert.doesNotMatch(perimetre, /pas encore vérifiées/, 'le registre a vérifié ces paires : la page ne peut plus dire le contraire');
  // Le total de la phrase d'ouverture est celui de la synthèse.
  const s = syntheseDette(PAIRES_KIT, VALEURS);
  assert.ok(brut.includes(`${s.echouent} des ${s.mesurees} paires`), 'la phrase d’ouverture ne reprend pas la synthèse');
  assert.ok(brut.includes(`${virgule(s.textePrincipalMin)}:1`));
  assert.ok(brut.includes(`${s.fondsPales} lignes`) || brut.includes(`${s.fondsPales} paires`), 'le nombre de fonds pâles manque');
  assert.ok(brut.includes(s.tonSecondaire));
});

test('la section de dette contient les quatre tableaux, avec un index des blocs et un index des paires', () => {
  const dette = PAGE.match(/<section[^>]*id="dette"[\s\S]*?<\/section>\s*$/)[0];
  assert.equal((dette.match(/<table\b/g) || []).length, 4);
  for (const id of ['dette-badges', 'dette-kpi', 'dette-tableau', 'dette-retours', 'dette-secondaire']) {
    assert.ok(dette.includes(`id="${id}"`), `${id} manque`);
    assert.ok(dette.includes(`href="#${id}"`), `l'index ne mène pas à ${id}`);
  }
  // Toutes les paires y sont, une fois chacune, et l'index des paires mène à chacune.
  const ancres = new Set();
  for (const p of PAIRES_KIT) {
    assert.equal((dette.match(new RegExp(`data-paire="${p.nom}"`, 'g')) || []).length, 1, `${p.nom}`);
    const ancre = ancrePaire(p.nom);
    assert.equal(ancres.has(ancre), false, `l'ancre ${ancre} sert deux fois`);
    ancres.add(ancre);
    assert.equal((dette.match(new RegExp(`id="${ancre}"`, 'g')) || []).length, 1, `${p.nom} : la ligne n'a pas son id`);
    assert.equal((dette.match(new RegExp(`<a[^>]*href="#${ancre}"`, 'g')) || []).length, 1, `${p.nom} : l'index des paires ne la cite pas une fois`);
  }
  const index = dette.match(/<nav[^>]*aria-label="Retrouver une paire"[\s\S]*?<\/nav>/)[0];
  const jugees = PAIRES_KIT.map((p) => jugerPaire(p, VALEURS));
  assert.equal((index.match(/<li>/g) || []).length, PAIRES_KIT.length);
  // L'index dit le verdict en mots, pas seulement par sa position : « échoue » seize fois, « conforme » deux.
  assert.equal((texte(index).match(/échoue/g) || []).length, jugees.filter((j) => j.echoue).length);
  assert.equal((texte(index).match(/conforme/g) || []).length, jugees.filter((j) => !j.echoue).length);
});

test('l’ancre d’une paire est un id valide, même pour un sélecteur', () => {
  assert.equal(ancrePaire('badge--late'), 'paire-badge-late');
  assert.equal(ancrePaire('table tr:hover'), 'paire-table-tr-hover');
  assert.match(ancrePaire('<b>x</b>'), /^paire-[a-z0-9-]+$/);
});

test('chaque aplat posé en ligne est une pastille sans texte ou un échantillon déclaré', () => {
  // Un fond en attribut `style` échappe au garde-fou de site.css : c'est ici qu'on le tient.
  const balises = [...PAGE.matchAll(/<(\w+)([^>]*style="[^"]*background[^"]*"[^>]*)>/g)];
  assert.ok(balises.length >= 20, `${balises.length} aplats seulement`);
  for (const [entier, nom, attributs] of balises) {
    const echantillon = /data-echantillon="/.test(attributs);
    const pastille = /class="[^"]*\b(?:ds-pastille|cl-aplat)\b/.test(attributs);
    assert.ok(echantillon || pastille, `aplat inconnu : ${entier}`);
    if (pastille) {
      const apres = PAGE.slice(PAGE.indexOf(entier) + entier.length);
      assert.match(apres, new RegExp(`^</${nom}>`), `une pastille porte du texte : ${entier}`);
    }
  }
});

test('le site n’emploie lui-même aucune des paires qui échouent', () => {
  // Les paires du site sont mesurées par `ds-socle`. Ici : aucun échantillon n'est hors du
  // tableau de dette, et aucun texte de la page n'est posé sur un fond de statut en dehors.
  const horsEchantillons = PAGE.replace(/<(\w+)[^>]*data-echantillon[^>]*>[\s\S]*?<\/\1>/g, '');
  assert.doesNotMatch(horsEchantillons, /style="[^"]*(?:status-|--bg-muted|--feedback-)[^"]*"[^>]*>[^<]/, 'du texte est posé sur un fond du kit hors tableau');
  assert.equal((PAGE.match(/data-echantillon="/g) || []).length, PAIRES_KIT.length);
});

// ---- La page couleurs.html ----

// Lu dans chaque test, pas à l'import : un fichier absent doit faire échouer UN test, pas tout le fichier.
const fichier = () => lire('design-system/couleurs.html');

test('couleurs.html charge les polices avant ses feuilles, reste relative, et appelle le chrome avec sa propre adresse', () => {
  const FICHIER = fichier();
  const famille = FICHIER.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'couleurs.html ne charge pas les polices par <link>');
  assert.ok(FICHIER.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(FICHIER.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(famille < FICHIER.indexOf('href="../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.ok(FICHIER.indexOf('href="../css/base.css"') < FICHIER.indexOf('href="css/site.css"'), 'la feuille du site passe en dernier');
  assert.doesNotMatch(FICHIER, /(?:src|href)="\/[^/]/);
  assert.match(FICHIER, /<html lang="fr">/);
  assert.match(FICHIER, /<main id="contenu"/);
  assert.doesNotMatch(FICHIER, /sommaireHtml|brancherSommaire|ds-colonnes/, 'le sommaire est réservé à l’étage composants');
  assert.match(FICHIER, /enteteHtml\('couleurs\.html'\)/);
  assert.match(FICHIER, /piedHtml\(\)/);
  assert.match(FICHIER, /import \{[^}]*pageHtml[^}]*\} from '\.\/js\/couleurs\.js'/);
  assert.match(FICHIER, /<title>Couleurs — /);
  // L'en-tête marque ce chapitre comme page courante.
  assert.match(enteteHtml('couleurs.html'), /href="couleurs\.html"[^>]*aria-current="page"/);
});

test('couleurs.html lit tokens.css depuis le même dossier que le dépôt, et dit quand la page n’a pas pu se construire', () => {
  const FICHIER = fichier();
  assert.match(FICHIER, /fetch\('\.\.\/css\/tokens\.css'\)/);
  assert.match(FICHIER, /valeursDepuis/);
  assert.match(FICHIER, /ds-message/, 'un message de repli est écrit dans le HTML');
  assert.match(FICHIER, /npm run serve/);
  assert.match(FICHIER, /catch/, 'un échec de lecture est attrapé et dit');
  // Le texte du script, pas son comportement : le comportement se regarde dans un navigateur.
  const script = FICHIER.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  assert.match(script, /if \(location\.hash\) \{[\s\S]*getElementById\(decodeURIComponent\(location\.hash\.slice\(1\)\)\)[\s\S]*scrollIntoView\(\)/, 'un lien profond (#dette) doit atteindre sa section une fois la page posée');
  assert.match(script, /catch \(erreur\) \{\s*montrerRepli\(document, erreur, '[^']+'\);/, 'le repli doit apparaître tout de suite en cas d’échec attrapé');
  assert.doesNotMatch(script.slice(script.indexOf('catch (erreur)')), /\bthrow\b/, 'une exception relancée dans le repli laisserait la page sur son attente');
});

// ---- Le registre des correctifs ----

const registre = () => lire('docs/correctifs-figma.md');

test('le registre des correctifs nomme chaque paire publiée qui échoue, avec son ratio', () => {
  const REGISTRE = registre();
  assert.match(REGISTRE, /26 octobre 2026/);
  const echouent = PAIRES_KIT.filter((p) => jugerPaire(p, VALEURS).echoue);
  assert.equal(echouent.length, 16);
  for (const p of echouent) {
    const ligne = REGISTRE.split('\n').find((l) => l.includes(`\`${p.nom}\``));
    assert.ok(ligne, `le registre ne nomme pas ${p.nom}`);
    assert.ok(ligne.includes(`${jugerPaire(p, VALEURS).affiche}:1`), `le registre ne donne pas le ratio de ${p.nom} (${jugerPaire(p, VALEURS).affiche})`);
  }
  assert.match(REGISTRE, /couleurs\.html/);
  // Le correctif unique proposé est celui que la page calcule.
  assert.ok(REGISTRE.includes(`\`${syntheseDette(PAIRES_KIT, VALEURS).tonSecondaire}\``), 'le registre ne cite pas le ton calculé pour --text-secondary');
  // Les paires conformes citées au registre, et le ratio du texte d'en-tête sur le fond de l'application.
  assert.ok(REGISTRE.includes(`(${jugerPaire(PAIRES_KIT.find((p) => p.nom === 'badge--borrowed'), VALEURS).affiche}:1)`));
  assert.ok(REGISTRE.includes(`(${jugerPaire(PAIRES_KIT.find((p) => p.nom === 'table th'), VALEURS).affiche}:1)`));
  assert.ok(REGISTRE.includes(`tomberait à ${ratio(VALEURS['--text-secondary'], VALEURS['--bg-canvas']).toFixed(2).replace('.', ',')}:1`));
});

// Les paires que la page ne publie pas (`.text-error`, `.text-success`, le compteur du menu, le texte
// indicatif des champs, le message d'erreur de champ) sont tenues par tests/ds-registre.test.mjs :
// celui-ci ne lit que ce que la page publie.

test('le registre propose, pour chaque ligne à aplat, de foncer le fond ou d’employer ce que le kit a déjà', () => {
  const REGISTRE = registre();
  const succes = repereCorrection(PAIRES_KIT.find((p) => p.nom === 'toast--success'), VALEURS);
  assert.ok(REGISTRE.includes(`\`${succes.hex}\``), 'le registre ne cite pas le vert plus sombre calculé');
  assert.ok(REGISTRE.includes('`--feedback-error-hover`'));
  assert.ok(REGISTRE.includes(`(${r2(VALEURS['--text-inverse'], VALEURS['--feedback-error-hover'])}:1`), 'ratio du rouge plus sombre');
});

test('le registre dit que les alertes reprennent les couleurs des badges : c’est vrai, et le même ton les règle', () => {
  const REGISTRE = registre().replace(/\s+/g, ' ');
  const de = (nom) => PAIRES_KIT.find((p) => p.nom === nom);
  for (const [alerte, badge] of [['alert--error', 'badge--late'], ['alert--info', 'badge--reserved']]) {
    const a = de(alerte); const b = de(badge);
    // Les noms de tokens peuvent différer ; ce qui compte, c'est que les VALEURS soient les mêmes.
    assert.equal(VALEURS[a.texte].toLowerCase(), VALEURS[b.texte].toLowerCase(), `${alerte} et ${badge} n’ont plus le même texte`);
    assert.equal(VALEURS[a.fond].toLowerCase(), VALEURS[b.fond].toLowerCase(), `${alerte} et ${badge} n’ont plus le même fond`);
    assert.equal(repereCorrection(a, VALEURS).hex, repereCorrection(b, VALEURS).hex);
    assert.ok(REGISTRE.includes(`\`${repereCorrection(a, VALEURS).hex}\` pour \`${badge}\` et \`${alerte}\``), `le registre ne dit pas « ${repereCorrection(a, VALEURS).hex} pour ${badge} et ${alerte} »`);
  }
});

test('le registre ne présente pas la paire conforme comme une dette', () => {
  const REGISTRE = registre();
  const borrowed = REGISTRE.split('\n').filter((l) => l.includes('`badge--borrowed`'));
  for (const l of borrowed) assert.match(l, /conforme/, 'badge--borrowed est cité sans dire qu’il est conforme');
});

// ---- La feuille du site ----

test('la feuille du site habille la dette sans poser de couleur en dur, et se replie à 360 px', () => {
  const css = sansCommentaires(lire('design-system/css/site.css'));
  assert.match(css, /\.dt-/);
  const horsRacine = css.replace(/:root\s*\{[^}]*\}/, '');
  assert.deepEqual([...horsRacine.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map((m) => m[0]), []);
  // Le tableau se replie en cartes dans un @media, plus tôt que les 900 px du reste du site :
  // sept colonnes ne tiennent pas sous 1100 px.
  const media = [...css.matchAll(/@media \(max-width: (\d+)px\)\s*\{([\s\S]*?)\n\}/g)].filter((m) => /\.dt-table/.test(m[2]));
  assert.equal(media.length, 1, 'le repli de la dette doit tenir dans un seul @media');
  assert.ok(Number(media[0][1]) >= 1100, `le tableau se replie sous ${media[0][1]} px seulement`);
  assert.match(media[0][2], /display:\s*grid/);
  assert.match(media[0][2], /attr\(data-etiquette\)/);
});
