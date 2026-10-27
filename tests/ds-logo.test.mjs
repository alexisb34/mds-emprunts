// Le chapitre Logo : le fichier officiel, ses versions dérivées, ses exports, et les neuf
// interdits montrés pour de vrai.
//
// Ce que ce fichier tient, et ce qu'il ne tient pas :
//   - il LIT le SVG officiel et en recalcule les mesures (boîte du dessin, hauteur des lettres)
//     avec un calcul de courbes écrit ICI, indépendant du module : les nombres que le module
//     affiche (19 %, 80 px, 63 %…) sont comparés à ceux du dessin, pas à eux-mêmes ;
//   - il lit le HTML que `pageHtml` RENDERA, pas une copie des intentions : chaque interdit y est
//     cherché, avec le défaut dans sa démonstration fautive et son absence dans la bonne ;
//   - il NE regarde PAS la page. Qu'une démonstration soit lisible d'un coup d'œil, qu'un PNG
//     téléchargé s'ouvre, qu'une photo simulée ressemble à une photo : cela se vérifie dans un
//     navigateur, et le rapport de la tâche dit ce qui y a été vu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COULEURS, RATIO, TAILLES_PNG, DESSIN, ZONE, TAILLE_MINI, CAPITALE_INTER, SEUILS, VERSIONS, FONDS, INTERDITS,
  versionMono, remplacerCouleurs, tailleExport, zoneProtection, largeurMaxDansRond, melange, mesureFond,
  versionsAdmises, preparerSources, fabriquerPng, brancherExports, pageHtml, fmtRatio,
} from '../design-system/js/logo.js';
import { ratio, ratioExact } from '../design-system/js/contraste.js';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const logoSvg = () => lire('design-system/assets/logo.svg');

// ---- Les assertions du brief, telles quelles ----

test('le logo déposé est bien le logo officiel', () => {
  const svg = readFileSync(new URL('../design-system/assets/logo.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 150 88"/);
  assert.equal((svg.match(/fill="#2DB8C5"/g) || []).length, 10);
  assert.equal((svg.match(/fill="#3C3C3B"/g) || []).length, 9);
});

test('versionMono remplace les deux couleurs et ne touche pas fill="none"', () => {
  const svg = '<svg><path fill="#2DB8C5"/><path fill="#3C3C3B"/><g fill="none"/></svg>';
  const blanc = versionMono(svg, '#ffffff');
  assert.equal((blanc.match(/fill="#ffffff"/g) || []).length, 2);
  assert.match(blanc, /fill="none"/);
});

test('versionMono ignore la casse des couleurs source', () => {
  assert.match(versionMono('<path fill="#2db8c5"/>', '#fff'), /fill="#fff"/);
});

test('tailleExport garde les proportions du logo', () => {
  assert.deepEqual(tailleExport(600), { largeur: 600, hauteur: 352 });
  assert.deepEqual(tailleExport(1200), { largeur: 1200, hauteur: 704 });
});

// ---- Les interfaces du brief ----

test('COULEURS, RATIO et TAILLES_PNG sont ceux du brief, et les couleurs sont celles du fichier', () => {
  assert.deepEqual(COULEURS, { turquoise: '#2DB8C5', anthracite: '#3C3C3B' });
  assert.equal(RATIO, 150 / 88);
  assert.deepEqual(TAILLES_PNG, [600, 1200]);
  // Les deux couleurs du module sont les deux seules du fichier : si l'une changeait d'un côté,
  // `versionMono` cesserait de rien remplacer sans qu'aucune erreur n'apparaisse.
  const fills = new Set([...logoSvg().matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()));
  assert.deepEqual([...fills].sort(), Object.values(COULEURS).sort());
});

test('tailleExport garde le rapport du fichier pour chaque largeur proposée', () => {
  for (const l of TAILLES_PNG) {
    const t = tailleExport(l);
    assert.equal(t.largeur, l);
    assert.ok(Math.abs(t.largeur / t.hauteur - RATIO) < 0.005, `${l} : ${t.largeur}×${t.hauteur} déforme le logo`);
  }
});

// ---- versionMono, sur le vrai fichier ----

test('versionMono sur le logo officiel : dix-neuf tracés changent de couleur, aucun ne garde l’ancienne', () => {
  const svg = logoSvg();
  for (const couleur of ['#ffffff', '#3C3C3B']) {
    const mono = versionMono(svg, couleur);
    assert.equal((mono.match(new RegExp(`fill="${couleur}"`, 'g')) || []).length, 19);
    assert.doesNotMatch(mono, /fill="#2DB8C5"/i);
    // Seules les couleurs changent : le dessin, lui, est octet pour octet le même.
    assert.equal(mono.replace(new RegExp(`fill="${couleur}"`, 'g'), ''), svg.replace(/fill="#(?:2DB8C5|3C3C3B)"/g, ''));
  }
});

test('versionMono refuse une valeur qui n’est pas une couleur hexadécimale', () => {
  // La couleur est écrite dans un attribut : un guillemet y ouvrirait une injection.
  for (const mauvais of ['red', '#12', '#gggggg', '"><script>', '', undefined]) {
    assert.throws(() => versionMono('<path fill="#2DB8C5"/>', mauvais), /couleur/i, `${mauvais} aurait dû être refusée`);
  }
});

test('remplacerCouleurs échange deux couleurs sans que la première écrase la seconde', () => {
  // Un échange fait en deux passes rendrait tout turquoise : c'est le piège de ce genre de fonction.
  const echange = remplacerCouleurs('<path fill="#2DB8C5"/><path fill="#3C3C3B"/>', { '#2DB8C5': '#3C3C3B', '#3C3C3B': '#2DB8C5' });
  assert.equal(echange, '<path fill="#3C3C3B"/><path fill="#2DB8C5"/>');
});

// ---- Les mesures du dessin : recalculées ici, depuis le fichier ----

// Boîte d'un tracé : le fichier n'emploie que M, L, H, V, C et Z en coordonnées absolues. Pour
// les courbes on cherche les extrema de la dérivée, parce que les points de contrôle débordent du
// dessin et donneraient une boîte trop grande.
function boite(d) {
  const jetons = [...d.matchAll(/([MLHVCZ])|(-?\d*\.?\d+)/g)].map((m) => m[1] || parseFloat(m[2]));
  const xs = []; const ys = [];
  let x = 0; let y = 0; let departX = 0; let departY = 0; let cmd; let i = 0;
  const extrema = (p0, p1, p2, p3) => {
    const a = -p0 + 3 * p1 - 3 * p2 + p3; const b = 2 * (p0 - 2 * p1 + p2); const c = p1 - p0;
    const racines = [];
    if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) racines.push(-c / b); } else {
      const delta = b * b - 4 * a * c;
      if (delta >= 0) racines.push((-b + Math.sqrt(delta)) / (2 * a), (-b - Math.sqrt(delta)) / (2 * a));
    }
    return racines.filter((t) => t > 0 && t < 1).map((t) => { const u = 1 - t; return u ** 3 * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t ** 3 * p3; });
  };
  while (i < jetons.length) {
    if (typeof jetons[i] === 'string') { cmd = jetons[i++]; if (cmd === 'Z') { x = departX; y = departY; } continue; }
    if (cmd === 'M') { x = jetons[i++]; y = jetons[i++]; departX = x; departY = y; xs.push(x); ys.push(y); cmd = 'L'; }
    else if (cmd === 'L') { x = jetons[i++]; y = jetons[i++]; xs.push(x); ys.push(y); }
    else if (cmd === 'H') { x = jetons[i++]; xs.push(x); }
    else if (cmd === 'V') { y = jetons[i++]; ys.push(y); }
    else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = jetons.slice(i, i + 6); i += 6;
      xs.push(x3, ...extrema(x, x1, x2, x3)); ys.push(y3, ...extrema(y, y1, y2, y3));
      x = x3; y = y3;
    } else throw new Error(`commande ${cmd} non gérée par le test`);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function traces() {
  return [...logoSvg().matchAll(/<path d="([^"]*)" fill="([^"]*)"/g)].map((m) => ({ ...boite(m[1]), fill: m[2] }));
}

test('le calcul de boîte du test sait trouver le débord d’une courbe', () => {
  // Garde le calcul honnête : une courbe de (0,0) à (10,0) qui monte à y = 7,5 en son milieu.
  const b = boite('M0 0C0 10 10 10 10 0Z');
  assert.ok(Math.abs(b.y1 - 7.5) < 1e-9, `le sommet de la courbe est à ${b.y1}`);
  assert.equal(b.y0, 0);
});

test('DESSIN est la boîte réelle des dix-neuf tracés', () => {
  const t = traces();
  assert.equal(t.length, 19);
  const reel = { x: Math.min(...t.map((p) => p.x0)), y: Math.min(...t.map((p) => p.y0)), x1: Math.max(...t.map((p) => p.x1)), y1: Math.max(...t.map((p) => p.y1)) };
  assert.ok(Math.abs(DESSIN.x - reel.x) < 0.01, `x : ${DESSIN.x} contre ${reel.x}`);
  assert.ok(Math.abs(DESSIN.y - reel.y) < 0.01, `y : ${DESSIN.y} contre ${reel.y}`);
  assert.ok(Math.abs(DESSIN.largeur - (reel.x1 - reel.x)) < 0.01, `largeur : ${DESSIN.largeur} contre ${reel.x1 - reel.x}`);
  assert.ok(Math.abs(DESSIN.hauteur - (reel.y1 - reel.y)) < 0.01, `hauteur : ${DESSIN.hauteur} contre ${reel.y1 - reel.y}`);
  // Le fichier a donc du vide en haut et en bas, et aucun sur les côtés : la page le dit.
  assert.ok(DESSIN.y > 10, 'le dessin ne commence plus bas que le bord du fichier');
});

test('ZONE est la hauteur d’une lettre de SCHOOL rapportée à la largeur du logo', () => {
  // Les six lettres de SCHOOL : les tracés anthracite qui commencent sous la première ligne.
  const lettres = traces().filter((p) => p.fill.toUpperCase() === '#3C3C3B' && p.y0 > 40);
  assert.equal(lettres.length, 6, 'SCHOOL a six lettres');
  const haut = lettres.map((p) => p.y1 - p.y0);
  assert.ok(Math.max(...haut) - Math.min(...haut) < 0.01, 'les six lettres ont la même hauteur');
  const attendu = haut[0] / DESSIN.largeur;
  assert.ok(Math.abs(ZONE - attendu) < 0.002, `ZONE vaut ${ZONE}, une lettre de SCHOOL vaut ${attendu}`);
});

test('TAILLE_MINI laisse aux capitales de MY et de DIGITAL plus de hauteur que le plus petit texte de lecture', () => {
  // Les petites lettres : tout ce qui est entre les deux hémisphères et dans la première ligne.
  const petites = traces().filter((p) => p.y0 < 40 && p.x0 > 30 && p.x1 < 120);
  assert.equal(petites.length, 11, 'MY, DIGITAL et les points des i');
  const hauteur = Math.max(...petites.map((p) => p.y1 - p.y0));
  const enPx = (hauteur / DESSIN.largeur) * TAILLE_MINI.ecranPx;
  // `.body-tiny` est un CORPS de 11 px, pas une hauteur de lettre : sa capitale est plus basse.
  // On compare donc une capitale à une capitale.
  const corps = Number(lire('css/base.css').match(/\.body-tiny\s*\{\s*font-size:\s*(\d+)px/)[1]);
  assert.equal(corps, 11);
  const capitaleTiny = corps * CAPITALE_INTER;
  assert.ok(enPx > capitaleTiny, `à ${TAILLE_MINI.ecranPx} px, les capitales du logo font ${enPx.toFixed(1)} px, une capitale de .body-tiny ${capitaleTiny.toFixed(1)} px`);
  // Le seuil choisi : une capitale de 11 px au moins, soit près d'une fois et demie celle de .body-tiny.
  assert.ok(enPx >= 11, `${TAILLE_MINI.ecranPx} px ne donne que ${enPx.toFixed(1)} px de haut aux capitales`);
  // Et 80 px reste le nombre rond qui le donne : pas plus large que nécessaire.
  assert.ok(enPx < 12, `${TAILLE_MINI.ecranPx} px est plus large que nécessaire : ${enPx.toFixed(1)} px de haut`);
  // 3,6 mm de capitale, c'est un corps d'environ 14 pt (1 pt = 0,3528 mm), pas 10.
  const enMm = (hauteur / DESSIN.largeur) * TAILLE_MINI.impressionMm;
  const corpsPt = enMm / 0.3528 / CAPITALE_INTER;
  assert.ok(corpsPt > 13 && corpsPt < 15, `${enMm.toFixed(2)} mm de capitale font un corps de ${corpsPt.toFixed(1)} pt`);
  assert.doesNotMatch(readFileSync(new URL('../design-system/js/logo.js', import.meta.url), 'utf8'), /corps d'environ 10 pt/);
});

test('zoneProtection est proportionnelle à la largeur du logo', () => {
  for (const l of [80, 120, 240, 480, 1200]) assert.ok(Math.abs(zoneProtection(l) - l * ZONE) < 1e-9);
  assert.equal(zoneProtection(0), 0);
});

test('largeurMaxDansRond : le logo et sa zone de protection tiennent dans le rond', () => {
  // Géométrie refaite ici : le rectangle (dessin + zone sur chaque côté) doit être inscrit dans
  // le cercle, donc sa diagonale est au plus le diamètre.
  const diametre = 300;
  const l = largeurMaxDansRond(diametre);
  const z = zoneProtection(l);
  const h = (DESSIN.hauteur / DESSIN.largeur) * l;
  const diagonale = Math.hypot(l + 2 * z, h + 2 * z);
  assert.ok(Math.abs(diagonale - diametre) < 1e-6, `la diagonale vaut ${diagonale}, le diamètre ${diametre}`);
});

// ---- Les couleurs et les mesures de contraste ----

test('mélange : un voile opaque à 80 % sur du blanc', () => {
  assert.equal(melange('#000000', '#ffffff', 0.5).toLowerCase(), '#808080');
  assert.equal(melange('#3C3C3B', '#ffffff', 1).toLowerCase(), '#3c3c3b');
  assert.equal(melange('#3C3C3B', '#ffffff', 0).toLowerCase(), '#ffffff');
});

test('mesureFond prend le plus faible repère du logo, et le compare au seuil de sa version', () => {
  const couleurSurBlanc = mesureFond('couleur', '#ffffff');
  assert.equal(couleurSurBlanc.plusFaible, ratio(COULEURS.turquoise, '#ffffff'));
  assert.equal(couleurSurBlanc.seuil, SEUILS.couleur);
  assert.equal(couleurSurBlanc.ok, true);
  // Le logo couleur sur le violet : c'est l'anthracite qui disparaît, pas le turquoise.
  const surViolet = mesureFond('couleur', '#662483');
  assert.equal(surViolet.plusFaible, ratio(COULEURS.anthracite, '#662483'));
  assert.equal(surViolet.ok, false);
  // Une version d'une seule couleur n'a que ce repère-là, et un seuil plus haut.
  assert.equal(mesureFond('blanc', '#662483').ok, true);
  assert.equal(mesureFond('blanc', '#662483').seuil, SEUILS.mono);
  assert.equal(mesureFond('blanc', '#ffffff').ok, false, 'du blanc sur du blanc');
  assert.equal(mesureFond('anthracite', '#ffffff').ok, true);
});

test('les seuils sont ceux que la page annonce, et le premier est sous la référence du logo sur blanc', () => {
  assert.deepEqual(SEUILS, { couleur: 2, mono: 4.5 });
  // Le logo officiel est publié sur blanc : son turquoise y fait 2,39:1. Un seuil au-dessus de
  // ce chiffre refuserait le fond d'origine du logo.
  assert.ok(ratioExact(COULEURS.turquoise, '#ffffff') > SEUILS.couleur);
});

test('chaque fond tiré des tokens porte la valeur que le module mesure', () => {
  const tokens = lire('css/tokens.css');
  const plats = FONDS.filter((f) => f.jeton);
  assert.ok(plats.length >= 4);
  for (const f of plats) {
    const m = tokens.match(new RegExp(`${f.jeton}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `${f.jeton} absent de tokens.css`);
    assert.equal(m[1].toLowerCase(), f.hex.toLowerCase(), `${f.id} : le module mesure ${f.hex}, le token vaut ${m[1]}`);
  }
});

test('versionsAdmises ne contient que des versions dont le fond passe la mesure', () => {
  for (const f of FONDS.filter((x) => !x.photo)) {
    for (const v of VERSIONS) {
      assert.equal(versionsAdmises(f).includes(v.id), mesureFond(v.id, f.hex).ok, `${v.id} sur ${f.id}`);
    }
  }
  assert.deepEqual(versionsAdmises(FONDS.find((f) => f.id === 'photo-chargee')), []);
  assert.ok(versionsAdmises(FONDS.find((f) => f.id === 'photo-claire')).includes('couleur'));
});

// ---- Les sources, les exports ----

test('preparerSources fabrique les versions dérivées et garde le fichier officiel pour la couleur', () => {
  const svg = logoSvg();
  const urls = [];
  const sources = preparerSources(svg, (texte) => { urls.push(texte); return `blob:${urls.length}`; });
  assert.equal(sources.couleur, 'assets/logo.svg', 'la version couleur est le fichier lui-même, pas une copie');
  assert.ok(sources.blanc && sources.anthracite && sources.violet);
  assert.equal(new Set(Object.values(sources)).size, 4);
  const blanc = urls.find((u) => u.includes('fill="#ffffff"'));
  assert.ok(blanc && !/#2DB8C5/i.test(blanc), 'la version blanche ne garde aucune couleur d’origine');
  assert.ok(urls.some((u) => u.includes('fill="#662483"')), 'la version violette sert la démonstration de recoloration');
});

test('preparerSources refuse un fichier qui n’est pas le logo', () => {
  assert.throws(() => preparerSources('<html>404</html>', () => 'x'), /logo/i);
  assert.throws(() => preparerSources('<svg viewBox="0 0 10 10"></svg>', () => 'x'), /logo/i);
});

// Un navigateur factice pour `fabriquerPng` : une image qui se charge ou échoue, un canevas qui
// note ce qu'on lui demande.
function decorPng({ image = 'ok', contexte = true, blob = 'octets' } = {}) {
  const notes = { dessins: [], canevas: null, types: [] };
  class FausseImage {
    set src(valeur) { notes.src = valeur; queueMicrotask(() => (image === 'ok' ? this.onload() : this.onerror())); }
  }
  const env = {
    Image: FausseImage,
    document: {
      createElement: (nom) => {
        assert.equal(nom, 'canvas');
        notes.canevas = {
          width: 0,
          height: 0,
          getContext: () => (contexte ? { drawImage: (...a) => notes.dessins.push(a) } : null),
          toBlob: (rappel, type) => { notes.types.push(type); rappel(blob === null ? null : blob); },
        };
        return notes.canevas;
      },
    },
  };
  return { env, notes };
}

test('fabriquerPng dessine le SVG sur un canevas à la taille de tailleExport', async () => {
  for (const largeur of TAILLES_PNG) {
    const { env, notes } = decorPng();
    const blob = await fabriquerPng('blob:x', largeur, env);
    const attendu = tailleExport(largeur);
    assert.equal(blob, 'octets');
    assert.equal(notes.src, 'blob:x');
    assert.equal(notes.canevas.width, attendu.largeur);
    assert.equal(notes.canevas.height, attendu.hauteur);
    assert.equal(notes.dessins.length, 1);
    assert.deepEqual(notes.dessins[0].slice(1), [0, 0, attendu.largeur, attendu.hauteur], 'le dessin remplit tout le canevas : pas de bord blanc, le vide est celui du fichier');
    assert.deepEqual(notes.types, ['image/png']);
  }
});

test('fabriquerPng échoue franchement quand l’image, le contexte ou le fichier manquent', async () => {
  await assert.rejects(fabriquerPng('blob:x', 600, decorPng({ image: 'erreur' }).env), /image/i);
  await assert.rejects(fabriquerPng('blob:x', 600, decorPng({ contexte: false }).env), /canevas|contexte/i);
  await assert.rejects(fabriquerPng('blob:x', 600, decorPng({ blob: null }).env), /PNG/);
});

test('brancherExports fabrique le PNG du bouton cliqué, le nomme, et le dit', async () => {
  const sources = { couleur: 'assets/logo.svg', blanc: 'blob:blanc', anthracite: 'blob:anthracite' };
  const statut = { textContent: '' };
  let ecoute;
  const racine = { addEventListener: (type, f) => { assert.equal(type, 'click'); ecoute = f; }, querySelector: (s) => (s === '[data-export-statut]' ? statut : null) };
  const appels = [];
  const env = {
    fabriquer: async (url, largeur) => { appels.push(['fabriquer', url, largeur]); return 'octets'; },
    telecharger: (blob, nom) => appels.push(['telecharger', blob, nom]),
  };
  brancherExports(racine, sources, env);
  const bouton = { dataset: { version: 'blanc', largeur: '1200' } };
  await ecoute({ target: { closest: (s) => (s === '[data-export-png]' ? bouton : null) } });
  assert.deepEqual(appels, [['fabriquer', 'blob:blanc', 1200], ['telecharger', 'octets', 'mds-logo-blanc-1200.png']]);
  assert.match(statut.textContent, /mds-logo-blanc-1200\.png/);

  // Un clic ailleurs ne fait rien.
  appels.length = 0;
  await ecoute({ target: { closest: () => null } });
  assert.deepEqual(appels, []);
});

test('brancherExports dit quoi faire quand le PNG ne se fabrique pas', async () => {
  const statut = { textContent: '' };
  let ecoute;
  const racine = { addEventListener: (t, f) => { ecoute = f; }, querySelector: () => statut };
  brancherExports(racine, { couleur: 'assets/logo.svg' }, {
    fabriquer: async () => { throw new Error('refusé'); },
    telecharger: () => assert.fail('rien à télécharger'),
  });
  await ecoute({ target: { closest: () => ({ dataset: { version: 'couleur', largeur: '600' } }) } });
  assert.match(statut.textContent, /SVG/, 'le message renvoie vers le SVG, qui marche toujours');
  assert.doesNotMatch(statut.textContent, /refusé/, 'le message n’affiche pas l’exception brute');
});

test('brancherExports refuse une version ou une largeur qui ne sont pas proposées', async () => {
  const statut = { textContent: '' };
  let ecoute;
  const racine = { addEventListener: (t, f) => { ecoute = f; }, querySelector: () => statut };
  const appels = [];
  brancherExports(racine, { couleur: 'assets/logo.svg' }, { fabriquer: async (...a) => { appels.push(a); return 'x'; }, telecharger: () => {} });
  for (const dataset of [{ version: 'rose', largeur: '600' }, { version: 'couleur', largeur: '99999' }, { version: 'couleur', largeur: 'abc' }]) {
    await ecoute({ target: { closest: () => ({ dataset }) } });
  }
  assert.deepEqual(appels, [], 'seules les trois versions et les largeurs de TAILLES_PNG sont fabriquées');
});

// ---- La page rendue ----

const SOURCES = { couleur: 'assets/logo.svg', blanc: 'blob:blanc', anthracite: 'blob:anthracite', violet: 'blob:violet' };
const PAGE = pageHtml(SOURCES);

// Le texte visible d'un morceau de HTML : sans balises, avec les insécables en espaces.
const texte = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Le bloc d'une balise ouverte à `debut`, jusqu'à sa fermeture : un compteur de profondeur,
// parce qu'une expression régulière ne sait pas fermer des <div> imbriqués.
function bloc(html, debut) {
  const nom = html.slice(debut).match(/^<([a-z0-9]+)/)[1];
  let profondeur = 0;
  for (const m of html.slice(debut).matchAll(new RegExp(`<(/?)${nom}\\b[^>]*>`, 'g'))) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) return html.slice(debut, debut + m.index + m[0].length);
  }
  throw new Error(`<${nom}> jamais refermée`);
}
const blocs = (html, motif) => [...html.matchAll(motif)].map((m) => bloc(html, m.index));

const IDS = ['etirer', 'recolorer', 'ombre', 'contraste', 'photo', 'pivoter', 'reorganiser', 'forme', 'contour'];
const interdit = (id) => blocs(PAGE, new RegExp(`<article class="lg-interdit" id="interdit-${id}"`, 'g'))[0];
const cas = (html, sorte) => blocs(html, new RegExp(`<figure class="lg-cas lg-cas--${sorte}"`, 'g'))[0];

test('la page a un seul h1, des h2 par question, et des h3 seulement sous un h2', () => {
  assert.equal((PAGE.match(/<h1\b/g) || []).length, 1);
  assert.match(PAGE, /<h1[^>]*>\s*Le logo\s*<\/h1>/);
  const niveaux = [...PAGE.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  for (let i = 1; i < niveaux.length; i++) assert.ok(niveaux[i] - niveaux[i - 1] <= 1, `un titre saute de h${niveaux[i - 1]} à h${niveaux[i]}`);
  const h2 = [...PAGE.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => texte(m[1]));
  assert.ok(h2.length >= 5, `${h2.length} sections seulement : ${h2.join(' | ')}`);
});

test('la page dit franchement que ces règles ne sont validées par personne, avant la première section', () => {
  const t = texte(PAGE);
  assert.match(t, /ne sont pas une charte officielle/i);
  assert.match(t, /Personne du côté de la marque ne les a validées/);
  assert.match(t, /servis publiquement|site est public/i);
  // Dit en haut, pas seulement en bas : avant le premier h2.
  assert.ok(PAGE.search(/Personne du côté de la marque/) < PAGE.search(/<h2\b/), 'la réserve vient avant les sections');
  // Et dit aussi que les versions blanche et anthracite sont fabriquées ici.
  assert.match(t, /fabriquées (?:ici|pour ce site)/i);
});

test('aucune étiquette en capitales, et aucune classe que la feuille ne connaît pas', () => {
  assert.doesNotMatch(PAGE, /label-caps|label-mini-caps|text-transform/);
  const css = lire('design-system/css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const connues = new Set([...css.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
  const emploi = new Set([...PAGE.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^(?:lg|ds)-/.test(c)));
  assert.ok(emploi.size > 15, 'la page emploie des classes lg- et ds-');
  const inconnues = [...emploi].filter((c) => !connues.has(c));
  assert.deepEqual(inconnues, [], 'ces classes n’ont aucune règle dans site.css');
});

test('chaque image a un alt, chaque démonstration un nom accessible', () => {
  for (const img of PAGE.match(/<img\b[^>]*>/g)) assert.match(img, /\balt="[^"]*"/, img);
  const scenes = blocs(PAGE, /<div class="lg-scene\b/g);
  assert.ok(scenes.length >= 25, `${scenes.length} démonstrations seulement`);
  for (const s of scenes) {
    const ouverture = s.match(/^<div[^>]*>/)[0];
    assert.match(ouverture, /role="img"/, ouverture);
    assert.match(ouverture, /aria-label="[^"]{8,}"/, ouverture);
  }
});

test('aucun texte n’est posé sur un fond écrit en attribut style', () => {
  // `tests/ds-socle.test.mjs` dérive les surfaces colorées de la feuille ; un fond posé en ligne
  // lui échappe, donc le texte qu'on y poserait ne serait mesuré par personne.
  const scenes = blocs(PAGE, /<div class="lg-scene\b[^>]*style="[^"]*background/g);
  assert.ok(scenes.length >= 10);
  for (const s of scenes) assert.equal(texte(s.replace(/aria-label="[^"]*"/g, '')), '', `du texte sur un fond en ligne : ${texte(s).slice(0, 60)}`);
});

test('aucun chemin absolu : le site est servi depuis un sous-répertoire', () => {
  assert.doesNotMatch(PAGE, /(?:src|href)="\/[^/]/);
  assert.doesNotMatch(PAGE, /https?:\/\//);
});

// ---- Les trois versions et leurs exports ----

test('les trois versions sont montrées, chacune avec son SVG et ses deux PNG', () => {
  assert.deepEqual(VERSIONS.map((v) => v.id), ['couleur', 'blanc', 'anthracite']);
  for (const v of VERSIONS) {
    const carte = blocs(PAGE, new RegExp(`<article class="lg-version" id="version-${v.id}"`, 'g'))[0];
    assert.ok(carte, `la carte de la version ${v.id}`);
    assert.match(carte, new RegExp(`<a [^>]*href="${SOURCES[v.id]}"[^>]*download="mds-logo-${v.id}\\.svg"|<a [^>]*download="mds-logo-${v.id}\\.svg"[^>]*href="${SOURCES[v.id]}"`));
    const png = [...carte.matchAll(/<button\b[^>]*data-export-png[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(png.map((b) => Number(b.match(/data-largeur="(\d+)"/)[1])), TAILLES_PNG);
    for (const b of png) assert.match(b, new RegExp(`data-version="${v.id}"`));
    // Le logo de la carte est posé sur un fond où il passe la mesure.
    const scene = blocs(carte, /<div class="lg-scene\b/g)[0];
    const fond = FONDS.find((f) => f.id === scene.match(/data-fond="([^"]+)"/)[1]);
    assert.ok(versionsAdmises(fond).includes(v.id), `${v.id} est montré sur ${fond.id}, où il ne passe pas la mesure`);
    assert.match(scene, new RegExp(`<img[^>]*src="${SOURCES[v.id]}"`));
  }
  assert.equal((PAGE.match(/data-export-statut/g) || []).length, 1, 'une seule zone de statut pour les exports');
  assert.match(PAGE, /<p[^>]*role="status"[^>]*data-export-statut|<p[^>]*data-export-statut[^>]*role="status"/);
});

test('la page dit que les PNG sont fabriqués par le navigateur, à quelles largeurs, et que le SVG est la source', () => {
  const t = texte(PAGE);
  for (const l of TAILLES_PNG) assert.match(t, new RegExp(`${l} px`));
  assert.match(t, /fabriqués par (?:votre|le) navigateur/);
  assert.match(t, /transparent/);
});

// ---- La zone de protection, les tailles minimales ----

test('la zone de protection est annoncée en pourcentage du logo, et ce pourcentage est celui de ZONE', () => {
  const section = blocs(PAGE, /<section\b[^>]*id="zone"/g)[0];
  assert.ok(section, 'la section « zone »');
  const pct = Math.round(ZONE * 100);
  assert.match(texte(section), new RegExp(`${pct} % de (?:sa|la) largeur`));
  // Les exemples chiffrés sont ceux de la fonction, arrondis comme elle les arrondit.
  for (const l of [120, 240, 480]) assert.match(texte(section), new RegExp(`${l} px[^.]*${Math.round(zoneProtection(l))} px`));
  // La page signale le vide que le fichier porte déjà en haut et en bas.
  assert.match(texte(section), /vide en haut et en bas/);
});

test('les tailles minimales sont celles de TAILLE_MINI, avec ce qu’elles laissent aux petites lettres', () => {
  const section = blocs(PAGE, /<section\b[^>]*id="tailles"/g)[0];
  assert.ok(section, 'la section « tailles »');
  const t = texte(section);
  assert.match(t, new RegExp(`${TAILLE_MINI.ecranPx} px de large`));
  assert.match(t, new RegExp(`${TAILLE_MINI.impressionMm} mm`));
  const petites = (21.4 / DESSIN.largeur);
  assert.match(t, new RegExp(`capitales de MY et de DIGITAL font ${Math.round(petites * TAILLE_MINI.ecranPx)} px de haut`));
  // La comparaison de la page est une capitale contre une capitale : environ 8 px, pas 11.
  assert.match(t, new RegExp(`corps de 11 px et ne fait qu’environ ${Math.round(11 * CAPITALE_INTER)} px de haut`));
  assert.doesNotMatch(t, /C’est la taille de \.body-tiny/);
  // La démonstration est posée à la largeur annoncée : une image à 80 px, pas à 79.
  assert.match(section, new RegExp(`width:\\s*${TAILLE_MINI.ecranPx}px`));
  assert.match(section, new RegExp(`width:\\s*${TAILLE_MINI.impressionMm}mm`));
});

// ---- Les fonds ----

test('les fonds autorisés : six fonds, chaque version montrée passe la mesure, les photos le disent', () => {
  const section = blocs(PAGE, /<section\b[^>]*id="fonds"/g)[0];
  assert.ok(section, 'la section « fonds »');
  const cartes = blocs(section, /<figure class="lg-cas\b/g);
  assert.equal(cartes.length, FONDS.length);
  assert.deepEqual(FONDS.map((f) => f.id), ['blanc', 'canvas', 'violet', 'anthracite', 'photo-claire', 'photo-chargee']);
  for (const c of cartes) {
    const scene = c.match(/<div class="lg-scene\b[^>]*>/)[0];
    const fond = FONDS.find((f) => f.id === scene.match(/data-fond="([^"]+)"/)[1]);
    const version = scene.match(/data-version="([^"]+)"/)[1];
    if (fond.photo) {
      assert.equal(/lg-cas--faux/.test(c), versionsAdmises(fond).length === 0, `${fond.id} : le verdict montré n’est pas celui du module`);
      continue;
    }
    assert.ok(versionsAdmises(fond).includes(version), `${fond.id} : ${version} ne passe pas la mesure`);
    assert.match(c, /lg-cas--juste/);
    // Le chiffre affiché est le plus faible repère de la version montrée, au centième.
    const m = mesureFond(version, fond.hex);
    assert.ok(texte(c).includes(fmtRatio(m.plusFaible)), `${fond.id} : ${fmtRatio(m.plusFaible)} manque à la légende`);
  }
  const t = texte(section);
  assert.match(t, /2:1/);
  assert.match(t, /4,5:1/);
  assert.match(t, /dessinées en CSS|dessinées en CSS/);
});

// ---- Les neuf interdits ----

test('il y a neuf interdits, dans l’ordre du brief, chacun avec sa raison', () => {
  assert.equal(INTERDITS.length, 9);
  assert.deepEqual(INTERDITS.map((i) => i.id), IDS);
  assert.equal((PAGE.match(/<article class="lg-interdit"/g) || []).length, 9);
  for (const i of INTERDITS) {
    const a = interdit(i.id);
    assert.ok(a, `l’interdit ${i.id} n’est pas rendu`);
    assert.match(a, new RegExp(`<h3[^>]*>[\\s\\S]*${i.titre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `le titre de ${i.id}`);
    // La raison, mot pour mot, est dans l'article : c'est elle qui fait appliquer la règle.
    assert.ok(texte(a).includes(texte(i.raison)), `la raison de ${i.id} n’est pas dans la page`);
    assert.ok(texte(i.raison).split(' ').length >= 25, `la raison de ${i.id} tient en ${texte(i.raison).split(' ').length} mots : c’est une consigne, pas une raison`);
    assert.doesNotMatch(texte(i.raison), /^(?:Il ne faut pas|Ne )/, `${i.id} : une raison ne commence pas par l’interdit`);
  }
});

test('chaque interdit montre une démonstration fautive et une bonne, côte à côte, légendées', () => {
  for (const id of IDS) {
    const a = interdit(id);
    const faux = blocs(a, /<figure class="lg-cas lg-cas--faux"/g);
    const juste = blocs(a, /<figure class="lg-cas lg-cas--juste"/g);
    assert.equal(faux.length, 1, `${id} : une démonstration fautive`);
    assert.equal(juste.length, 1, `${id} : une bonne démonstration`);
    assert.ok(a.indexOf(faux[0]) < a.indexOf(juste[0]), `${id} : le défaut avant la correction`);
    assert.match(faux[0], /<figcaption[^>]*>[^<]*(?:<[^>]+>[^<]*)*À ne pas faire/, `${id} : légende fautive`);
    assert.match(juste[0], /<figcaption[^>]*>[^<]*(?:<[^>]+>[^<]*)*À faire/, `${id} : légende juste`);
    assert.notEqual(faux[0], juste[0]);
  }
});

// Le défaut de chaque interdit, cherché dans la démonstration fautive et absent de la bonne :
// c'est ce qui distingue une démonstration d'une illustration.
const DEFAUTS = {
  etirer: (h) => /object-fit:\s*fill/.test(h),
  recolorer: (h) => h.includes(`src="${SOURCES.violet}"`),
  ombre: (h) => (h.match(/drop-shadow\(/g) || []).length === 1,
  contraste: (h) => /data-version="couleur"/.test(h) && /data-fond="violet"/.test(h),
  photo: (h) => /data-fond="photo-chargee"/.test(h) && /data-version="couleur"/.test(h) && !/lg-voile/.test(h),
  pivoter: (h) => /rotate\(-?\d+(?:\.\d+)?deg\)/.test(h),
  reorganiser: (h) => (h.match(/class="lg-piece"/g) || []).length >= 3,
  forme: (h) => /lg-forme/.test(h) && /border-radius:\s*50%/.test(h),
  contour: (h) => (h.match(/drop-shadow\(/g) || []).length === 4,
};

test('la démonstration fautive de chaque interdit porte son défaut, la bonne ne le porte pas', () => {
  for (const id of IDS) {
    const a = interdit(id);
    assert.ok(DEFAUTS[id](cas(a, 'faux')), `${id} : la démonstration fautive ne montre pas le défaut`);
    assert.ok(!DEFAUTS[id](cas(a, 'juste')), `${id} : la bonne démonstration porte le défaut`);
  }
});

test('les deux démonstrations d’un interdit montrent le même logo, à la même largeur', () => {
  // Une comparaison où la bonne version est plus grande que la fautive ne démontre rien.
  for (const id of IDS.filter((i) => !['reorganiser', 'forme', 'etirer'].includes(i))) {
    const largeur = (h) => (h.match(/--l:\s*([\d.]+cqw)/) || [])[1];
    const a = interdit(id);
    assert.ok(largeur(cas(a, 'faux')), `${id} : pas de largeur dans la démonstration fautive`);
    assert.equal(largeur(cas(a, 'faux')), largeur(cas(a, 'juste')), `${id} : les deux logos n’ont pas la même largeur`);
  }
});

test('« recolorer » et « contraste » montrent des versions que la mesure sépare', () => {
  const a = interdit('contraste');
  for (const [sorte, attendu] of [['faux', false], ['juste', true]]) {
    const scene = blocs(cas(a, sorte), /<div class="lg-scene\b/g)[0];
    const fond = FONDS.find((f) => f.id === scene.match(/data-fond="([^"]+)"/)[1]);
    const version = scene.match(/data-version="([^"]+)"/)[1];
    assert.equal(mesureFond(version, fond.hex).ok, attendu, `${sorte} : ${version} sur ${fond.id}`);
    assert.match(scene, new RegExp(`<img[^>]*src="${SOURCES[version]}"`), `${sorte} : l’image n’est pas la version annoncée`);
  }
});

test('l’interdit « contraste » affiche des chiffres qui sont ceux de contraste.js', () => {
  const t = texte(interdit('contraste'));
  const violet = '#662483';
  // Chaque chiffre est recalculé ici, avec contraste.js seul, sans passer par mesureFond.
  assert.ok(t.includes(fmtRatio(ratio(COULEURS.anthracite, violet))), 'l’anthracite sur le violet');
  assert.ok(t.includes(fmtRatio(ratio('#ffffff', violet))), 'le blanc sur le violet');
  assert.ok(t.includes(fmtRatio(ratio(COULEURS.turquoise, COULEURS.turquoise))), 'le turquoise sur le turquoise');
  // Le chiffre de la RAISON, pas seulement celui de la liste de mesures : la raison est le texte
  // qu'on retient, et un chiffre faux y serait caché par le bon, plus bas dans la carte.
  const raison = texte(INTERDITS.find((i) => i.id === 'contraste').raison);
  assert.ok(raison.includes(`${fmtRatio(ratio(COULEURS.anthracite, violet))}:1`), 'la raison cite le rapport de l’anthracite sur le violet');
  assert.equal(fmtRatio(1.13), '1,13');
  assert.equal(fmtRatio(1), '1,00');
  assert.equal(fmtRatio(9.79), '9,79');
});

test('l’interdit « photo chargée » chiffre le pire cas du voile, et ce chiffre est le bon', () => {
  const t = texte(interdit('photo'));
  // Le fond le plus clair possible sous le voile, c'est du blanc : si le blanc du logo y tient, il tient partout.
  const pire = ratio('#ffffff', melange(COULEURS.anthracite, '#ffffff', 0.8));
  assert.ok(pire > 4.5, `le voile ne tient plus que ${pire}:1 dans le pire cas`);
  assert.ok(t.includes(fmtRatio(pire)), `${fmtRatio(pire)} manque`);
  // Et le voile de la démonstration est bien celui de ce calcul : 80 %, anthracite.
  assert.match(cas(interdit('photo'), 'juste'), /lg-voile[^>]*rgba\(60,\s*60,\s*59,\s*0?\.8\)/);
});

test('l’interdit « forme » donne la part du diamètre que le logo peut prendre, et elle tient', () => {
  const t = texte(interdit('forme'));
  // Rectangle (dessin + zone de chaque côté) inscrit dans un cercle, refait ici.
  const z = ZONE * 150; const w = 150 + 2 * z; const h = DESSIN.hauteur + 2 * z;
  const part = Math.floor((150 / Math.hypot(w, h)) * 100);
  assert.match(t, new RegExp(`${part} % du diamètre`));
});

test('les interdits sont référencés par leur numéro quand un fond les cite', () => {
  // La photo chargée est refusée dans les fonds et renvoie à l'interdit qui l'explique.
  assert.match(PAGE, /href="#interdit-photo"/);
  assert.ok(interdit('photo'), 'la cible du renvoi existe');
});

test('l’index des interdits : neuf liens, dans l’ordre, en tête de la section, chacun vers un interdit qui existe', () => {
  const section = blocs(PAGE, /<section\b[^>]*id="interdits"/g)[0];
  const nav = blocs(section, /<nav\b/g)[0];
  assert.ok(nav, 'un <nav> dans la section des interdits');
  assert.match(nav, /aria-label="Les neuf interdits"/);
  const liens = [...nav.matchAll(/<a [^>]*href="#([^"]+)"[^>]*>([^<]*)<\/a>/g)];
  assert.equal(liens.length, 9);
  assert.deepEqual(liens.map((m) => m[1]), IDS.map((id) => `interdit-${id}`));
  INTERDITS.forEach((i, n) => {
    assert.equal(texte(liens[n][2]), `${n + 1}. ${i.titre}`, `le libellé du lien ${n + 1}`);
    assert.ok(PAGE.includes(`id="interdit-${i.id}"`), `la cible de ${i.id}`);
  });
  // En tête : avant le premier interdit, rien d'autre que des liens dans l'index.
  assert.ok(section.indexOf('<nav') < section.indexOf('<article'), 'l’index précède les interdits');
  assert.equal(texte(nav.replace(/<a [^>]*>[^<]*<\/a>/g, '')), '', 'l’index ne contient que ses neuf liens');
  // Les liens ne se cachent pas sous l'en-tête collant.
  const css = lire('design-system/css/site.css');
  assert.match(css, /\.lg-interdit\s*\{[^}]*scroll-margin-top/);
});

test('la raison de « recolorer » lève la tension avec les versions d’une seule couleur', () => {
  const raison = texte(INTERDITS.find((i) => i.id === 'recolorer').raison);
  assert.match(raison, /replis neutres/);
  assert.match(raison, /aucune autre couleur à la place du turquoise/);
});

test('la démonstration d’étirement déforme franchement : au moins 1,5 fois', () => {
  // Rapport de la boîte `aspect-ratio: n / d` rapporté à celui du fichier (150 / 88) : 1 si le
  // logo est intact. L'œil doit voir le défaut sans lire la légende.
  const style = cas(interdit('etirer'), 'faux').match(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
  assert.ok(style, 'la démonstration fautive fixe une aspect-ratio');
  const deformation = (Number(style[1]) / Number(style[2])) / RATIO;
  assert.ok(deformation >= 1.5, `déformation de ×${deformation.toFixed(2)}`);
  assert.ok(!/aspect-ratio/.test(cas(interdit('etirer'), 'juste').replace(/class="lg-logo"/, '')), 'la bonne garde ses proportions');
});

// ---- La page logo.html ----

test('logo.html charge les polices avant ses feuilles, reste relative, et appelle le chrome avec sa propre adresse', () => {
  const html = lire('design-system/logo.html');
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'logo.html ne charge pas les polices par <link>');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(famille < html.indexOf('href="../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.ok(html.indexOf('href="../css/base.css"') < html.indexOf('href="css/site.css"'), 'la feuille du site passe en dernier');
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<main id="contenu"/);
  assert.doesNotMatch(html, /sommaireHtml|brancherSommaire|ds-colonnes/, 'le sommaire est réservé à l’étage composants');
  for (const [, fonction, adresse] of html.matchAll(/\b(enteteHtml|piedHtml)\('([^']*)'\)/g)) {
    if (fonction === 'enteteHtml') assert.equal(adresse, 'logo.html');
  }
  assert.match(html, /enteteHtml\('logo\.html'\)/);
  assert.match(html, /piedHtml\(\)/);
  assert.match(html, /import \{[^}]*pageHtml[^}]*\} from '\.\/js\/logo\.js'/);
});

test('logo.html dit quand la page n’a pas pu se construire', () => {
  const html = lire('design-system/logo.html');
  assert.match(html, /ds-message/, 'un message de repli est écrit dans le HTML');
  assert.match(html, /npm run serve/);
  assert.match(html, /catch/, 'un échec de lecture du logo est attrapé et dit');
});

test('la feuille du site cadre le dessin comme DESSIN le mesure', () => {
  const css = lire('design-system/css/site.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = css.match(/\.lg-logo\s*\{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*([\d.]+)/);
  assert.ok(m, '.lg-logo n’a pas de aspect-ratio');
  assert.equal(Number(m[1]), DESSIN.largeur);
  assert.equal(Number(m[2]), DESSIN.hauteur);
  // La position verticale du recadrage : la part du vide au-dessus du dessin dans le vide total.
  const p = css.match(/\.lg-logo\s*\{[^}]*object-position:\s*50%\s*([\d.]+)%/);
  assert.ok(p, '.lg-logo n’a pas d’object-position');
  const attendu = (DESSIN.y / (88 - DESSIN.hauteur)) * 100;
  assert.ok(Math.abs(Number(p[1]) - attendu) < 0.1, `object-position ${p[1]} % contre ${attendu.toFixed(2)} %`);
});
