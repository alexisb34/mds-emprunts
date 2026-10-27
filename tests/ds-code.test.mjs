// Le code montré : extrait du cadre, réindenté, copiable.
//
// La promesse du site est que la démonstration et son code ne peuvent pas diverger. Pour la
// tenir, le code n'est écrit nulle part : le cadre annonce le HTML qu'il a réellement rendu,
// la page le réindente et l'affiche. Ce fichier garde les trois morceaux de cette chaîne —
// `formaterHtml` (la présentation), `copier` (le geste) et le branchement dans `brancherCadres`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { formaterHtml, copier, raccourciCopie, consigneCopie, messageCopie, codeHtml, poserCode, brancherCode } from '../design-system/js/code.js';
import { brancherCadres, MARQUE_CADRE } from '../design-system/js/cadre.js';

// ---- Les assertions du brief ----

test('formaterHtml met une balise par ligne et indente', () => {
  assert.equal(formaterHtml('<div class="row"><button class="btn btn--primary">OK</button></div>'),
    '<div class="row">\n  <button class="btn btn--primary">OK</button>\n</div>');
});

test('formaterHtml laisse le texte intact et n’ajoute pas de ligne vide', () => {
  assert.equal(formaterHtml('<p>Deux mots</p>'), '<p>Deux mots</p>');
});

// Un navigateur factice. Le brief écrit `globalThis.navigator = {}`, qui lève sous Node 21+ :
// `navigator` y est une propriété sans accesseur d'écriture, et un module ES est en mode strict.
// On la redéfinit donc pour la durée du test, et on remet toujours la propriété d'origine.
async function avecNavigator(faux, f) {
  const origine = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: faux, configurable: true, writable: true, enumerable: true });
  try { return await f(); } finally {
    if (origine) Object.defineProperty(globalThis, 'navigator', origine); else delete globalThis.navigator;
  }
}

test('copier retombe sur la sélection quand le presse-papiers est absent', async () => {
  // origine non sécurisée : `navigator` existe, `navigator.clipboard` non
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  await avecNavigator({}, async () => {
    assert.equal(await copier('texte', champ), 'selection');
    assert.equal(champ.selectionne, true);
  });
});

test('copier signale aussi le repli quand l’écriture est refusée', async () => {
  const champ = { focus() {}, select() {} };
  await avecNavigator({ clipboard: { writeText: () => Promise.reject(new Error('refus')) } }, async () => {
    assert.equal(await copier('texte', champ), 'selection');
  });
});

test('le navigateur d’origine est bien remis en place après chaque test', async () => {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  await avecNavigator({}, async () => {});
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'navigator'), avant);
});

// ---- formaterHtml : la réindentation, de près ----

test('formaterHtml garde une balise qui ne porte que du texte sur sa ligne', () => {
  assert.equal(formaterHtml('<ul><li>A</li><li>B</li></ul>'), '<ul>\n  <li>A</li>\n  <li>B</li>\n</ul>');
});

test('formaterHtml descend d’un niveau par balise ouvrante, deux espaces chacun', () => {
  assert.equal(formaterHtml('<div><div><div><button>OK</button></div></div></div>'),
    '<div>\n  <div>\n    <div>\n      <button>OK</button>\n    </div>\n  </div>\n</div>');
});

test('formaterHtml ne casse pas une phrase qui porte du texte en gras ou un lien', () => {
  // Le texte courant n'est pas du balisage : le couper changerait ce que la phrase dit.
  const phrase = '<p>Un <strong>seul</strong> bouton violet, voir <a href="#x">la règle</a>.</p>';
  assert.equal(formaterHtml(phrase), phrase);
  assert.equal(formaterHtml(`<div>${phrase}</div>`), `<div>\n  ${phrase}\n</div>`);
});

test('formaterHtml ne referme pas une balise sans contenu, et garde les balises vides', () => {
  assert.equal(formaterHtml('<div><input type="text" class="input"><br><img src="a.png" alt=""></div>'),
    '<div>\n  <input type="text" class="input">\n  <br>\n  <img src="a.png" alt="">\n</div>');
  assert.equal(formaterHtml('<div class="vide"></div>'), '<div class="vide"></div>');
});

test('formaterHtml tient un « > » dans la valeur d’un attribut', () => {
  const html = '<div data-x="a > b"><button title=\'1 > 0\'>OK</button></div>';
  assert.equal(formaterHtml(html), '<div data-x="a > b">\n  <button title=\'1 > 0\'>OK</button>\n</div>');
});

test('formaterHtml efface l’indentation du source et le saut de ligne qui l’accompagne', () => {
  // `section.innerHTML` arrive tel que le fichier d'exemple l'écrit, retraits compris.
  const brut = '\n    <div class="row row--wrap">\n      <button type="button" class="btn">Un\n        libellé</button>\n\n      <button class="btn">Deux</button>\n    </div>\n  ';
  assert.equal(formaterHtml(brut),
    '<div class="row row--wrap">\n  <button type="button" class="btn">Un libellé</button>\n  <button class="btn">Deux</button>\n</div>');
});

test('formaterHtml est idempotent : le reformater ne change rien', () => {
  const une = formaterHtml('<div class="stack"><div class="row"><button class="btn">A</button><button class="btn" disabled>B</button></div><a class="btn" href="#/emprunts">Voir <em>tout</em></a></div>');
  assert.equal(formaterHtml(une), une);
});

test('formaterHtml laisse intact ce dont les espaces comptent', () => {
  const pre = '<pre>ligne 1\n    ligne 2</pre>';
  assert.equal(formaterHtml(`<div>${pre}</div>`), `<div>\n  ${pre}\n</div>`);
  const zone = '<textarea rows="2">  bonjour\n  vous</textarea>';
  assert.equal(formaterHtml(zone), zone);
});

test('formaterHtml écrit les attributs booléens comme on les tape, et seulement eux', () => {
  // `innerHTML` rend `disabled=""` ; la page dit « l'attribut disabled », et c'est ce qu'on copie.
  assert.equal(formaterHtml('<button type="button" class="btn" disabled="">OK</button>'),
    '<button type="button" class="btn" disabled>OK</button>');
  assert.equal(formaterHtml('<input type="checkbox" checked="" disabled="">'), '<input type="checkbox" checked disabled>');
  // Une valeur vide qui veut dire quelque chose reste : `alt=""` déclare une image décorative.
  assert.equal(formaterHtml('<img src="a.png" alt="">'), '<img src="a.png" alt="">');
  assert.equal(formaterHtml('<input value="" class="input">'), '<input value="" class="input">');
  // Et ce qui est DANS une valeur n'est pas un attribut.
  assert.equal(formaterHtml('<a title=\'un disabled="" dans un titre\' href="#x">Lien</a>'),
    '<a title=\'un disabled="" dans un titre\' href="#x">Lien</a>');
  // `disabled="disabled"` n'est pas vide : on n'y touche pas.
  assert.equal(formaterHtml('<button disabled="disabled">OK</button>'), '<button disabled="disabled">OK</button>');
});

test('formaterHtml ne touche pas aux espaces insécables de la typographie française', () => {
  // U+00A0 (insécable) et U+202F (fine insécable, devant « ; : ? ! ») ne sont pas des blancs
  // de mise en forme : ce sont des caractères du texte. `\s` les avale, et la page française
  // perdrait en silence ce que la typographie a posé. Écrits en échappements, pour qu'un
  // éditeur ne les normalise pas.
  const nbsp = '\u00A0';
  const fine = '\u202F';
  const phrase = `<p>Valider l’emprunt${fine}?${nbsp}Oui${nbsp}: «${nbsp}ok${nbsp}»</p>`;
  assert.equal(formaterHtml(phrase), phrase);
  // Et au bord d'un texte, là où un `trim()` les mangerait.
  assert.equal(formaterHtml(`<div><button>${nbsp}OK${fine}</button></div>`), `<div>\n  <button>${nbsp}OK${fine}</button>\n</div>`);
  assert.equal(formaterHtml(`<div>${nbsp}Seul${nbsp}<p>x</p></div>`), `<div>\n  ${nbsp}Seul${nbsp}\n  <p>x</p>\n</div>`);
  // Un blanc ASCII, lui, se normalise toujours.
  assert.equal(formaterHtml('<p>Un   \n  deux</p>'), '<p>Un deux</p>');
});

test('formaterHtml met un commentaire sur sa ligne', () => {
  assert.equal(formaterHtml('<div><!-- le principal --><button>OK</button></div>'),
    '<div>\n  <!-- le principal -->\n  <button>OK</button>\n</div>');
});

test('formaterHtml ne casse pas sur un balisage bancal et ne perd rien', () => {
  // `innerHTML` rend toujours un balisage bien formé, mais la fonction est publique.
  assert.equal(formaterHtml(''), '');
  assert.equal(formaterHtml('   \n  '), '');
  assert.equal(formaterHtml('du texte seul'), 'du texte seul');
  assert.doesNotThrow(() => formaterHtml('</div><div><span>'));
  assert.equal(formaterHtml('<div><button>OK').replace(/\s+/g, ''), '<div><button>OK'.replace(/\s+/g, ''));
});

test('formaterHtml ne change que les espaces : balises, attributs et texte sortent à l’identique', () => {
  // La propriété qui compte pour « le code est exactement ce qui est rendu » : mises à part
  // les blancs entre éléments, la sortie est l'entrée. Vérifiée sur chaque démonstration
  // de chaque fichier d'exemple, donc sur le vrai HTML du site.
  const dossier = new URL('../design-system/exemples/', import.meta.url);
  let vues = 0;
  for (const f of readdirSync(dossier).filter((n) => n.endsWith('.html'))) {
    const source = readFileSync(new URL(f, dossier), 'utf8');
    for (const m of source.matchAll(/<section data-demo="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      // Seuls les blancs ASCII sont retirés : une espace insécable ou fine insécable (U+00A0,
      // U+202F) fait partie du texte, et `\s` les aurait effacées des deux côtés à la fois.
      const sans = (s) => s.replace(/[ \t\n\r\f]+/g, '');
      const sortie = formaterHtml(m[2]);
      assert.equal(sans(sortie), sans(m[2]), `${f}#${m[1]} : la mise en forme a modifié le contenu`);
      assert.doesNotMatch(sortie, /[ \t]+$/m, `${f}#${m[1]} : espace en fin de ligne`);
      assert.doesNotMatch(sortie, /\n\s*\n/, `${f}#${m[1]} : ligne vide`);
      assert.equal(formaterHtml(sortie), sortie, `${f}#${m[1]} : pas idempotent`);
      vues += 1;
    }
  }
  assert.ok(vues >= 4, `${vues} démonstration(s) vérifiée(s) : le détecteur ne voit plus les exemples`);
});

// ---- copier ----

test('copier écrit dans le presse-papiers quand il accepte, et ne sélectionne rien', async () => {
  const ecrits = [];
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  const r = await avecNavigator({ clipboard: { writeText: async (t) => { ecrits.push(t); } } }, () => copier('<p>x</p>', champ));
  assert.equal(r, 'presse-papiers');
  assert.deepEqual(ecrits, ['<p>x</p>']);
  assert.equal(champ.selectionne, undefined, 'une copie réussie ne doit pas laisser de sélection');
});

test('copier se rabat aussi quand writeText lève tout de suite, sans promesse', async () => {
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  const r = await avecNavigator({ clipboard: { writeText() { throw new Error('refus synchrone'); } } }, () => copier('x', champ));
  assert.equal(r, 'selection');
  assert.equal(champ.selectionne, true);
});

test('copier se rabat quand le presse-papiers existe mais sans writeText', async () => {
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  assert.equal(await avecNavigator({ clipboard: {} }, () => copier('x', champ)), 'selection');
  assert.equal(champ.selectionne, true);
});

test('copier se rabat quand il n’y a pas de navigator du tout', async () => {
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  assert.equal(await avecNavigator(undefined, () => copier('x', champ)), 'selection');
  assert.equal(champ.selectionne, true);
});

// Un élément qui n'est pas un champ de formulaire (un <pre>, un <code>) n'a pas de `select()` :
// la sélection passe alors par une plage du document.
function fauxDocument({ selectionVide = false } = {}) {
  const traces = { plages: [], vide: 0 };
  const selection = {
    removeAllRanges() { traces.vide += 1; },
    addRange(p) { traces.plages.push(p); },
    // Ce que le navigateur dirait de la sélection : le texte sélectionné, ou rien si elle n'a pas pris.
    toString() { return selectionVide ? '' : 'texte sélectionné'; },
  };
  return {
    traces,
    createRange: () => ({ selectNodeContents(n) { this.noeud = n; } }),
    defaultView: { getSelection: () => selection },
  };
}

test('copier sélectionne le contenu d’un élément qui n’est pas un champ', async () => {
  const doc = fauxDocument();
  const bloc = { ownerDocument: doc, focus() { bloc.pris = true; } };
  const r = await avecNavigator({}, () => copier('texte', bloc));
  assert.equal(r, 'selection');
  assert.equal(doc.traces.plages.length, 1, 'aucune plage n’a été sélectionnée');
  assert.equal(doc.traces.plages[0].noeud, bloc);
  assert.equal(doc.traces.vide, 1, 'l’ancienne sélection doit être effacée avant la nouvelle');
});

test('copier ne vole pas le focus pour sélectionner un élément qui n’est pas un champ', async () => {
  // Le bouton « Copier » garde le focus : la personne au clavier ne perd pas sa place, et le
  // message de statut se lit où elle est. Un champ de formulaire, lui, doit être focalisé
  // pour que `select()` tienne dans Safari.
  const doc = fauxDocument();
  const bloc = { ownerDocument: doc, focus() { bloc.pris = true; } };
  await avecNavigator({}, () => copier('texte', bloc));
  assert.equal(bloc.pris, undefined);

  const champ = { focus() { champ.pris = true; }, select() {} };
  await avecNavigator({}, () => copier('texte', champ));
  assert.equal(champ.pris, true);
});

test('copier ne prétend pas avoir sélectionné ce qu’il ne peut pas sélectionner', async () => {
  // Ni presse-papiers ni sélection possible : répondre « selection » ferait annoncer
  // « Sélectionné, faites Cmd+C » devant un texte qui ne l'est pas. L'erreur d'appel est
  // bruyante, et le bouton (testé plus bas) la transforme en message.
  await assert.rejects(avecNavigator({}, () => copier('texte', {})), /sélectionner/);
  await assert.rejects(avecNavigator({}, () => copier('texte', null)), /sélectionner/);
});

test('copier relit la sélection : une plage qui n’a pas pris n’est pas annoncée « sélectionné »', async () => {
  // `addRange` ne lève pas quand le navigateur ignore la plage (élément masqué, document sans
  // focus). Supposer le succès, c'est annoncer « Sélectionné » devant un texte qui ne l'est pas.
  const doc = fauxDocument({ selectionVide: true });
  await assert.rejects(avecNavigator({}, () => copier('texte', { ownerDocument: doc })), /sélection/);
});

test('copier relit aussi la sélection d’un champ de formulaire', async () => {
  const vide = { focus() {}, select() {}, selectionStart: 3, selectionEnd: 3 };
  await assert.rejects(avecNavigator({}, () => copier('texte', vide)), /sélection/);
  const pleine = { focus() {}, select() {}, selectionStart: 0, selectionEnd: 5 };
  assert.equal(await avecNavigator({}, () => copier('texte', pleine)), 'selection');
  // Un champ qui ne rend pas ces mesures (le faux du brief) n'est pas contredit.
  assert.equal(await avecNavigator({}, () => copier('texte', { focus() {}, select() {} })), 'selection');
});

test('copier ne reste pas suspendu à une écriture que le navigateur ne résout jamais', async () => {
  // Une invite de permission restée sans réponse laisse la promesse en suspens : sans délai de
  // garde, le bouton resterait muet. Au bout du délai, on se rabat sur la sélection.
  const champ = { focus() {}, select() { champ.selectionne = true; } };
  const suspendue = { clipboard: { writeText: () => new Promise(() => {}) } };
  assert.equal(await avecNavigator(suspendue, () => copier('texte', champ, 20)), 'selection');
  assert.equal(champ.selectionne, true);
});

test('le délai de garde ne retarde pas une écriture qui réussit', async () => {
  // Ce test ne vérifie QUE la durée : le nettoyage du minuteur est dans le test suivant.
  const champ = { focus() {}, select() {} };
  const t0 = Date.now();
  const r = await avecNavigator({ clipboard: { writeText: async () => {} } }, () => copier('texte', champ, 5000));
  assert.equal(r, 'presse-papiers');
  assert.ok(Date.now() - t0 < 1000, 'la copie a attendu le délai de garde');
});

test('copier ne laisse aucun minuteur en route : copie réussie, refus, ou délai dépassé', async () => {
  // Un minuteur oublié garderait un processus en vie (ici) ou déclencherait un refus tardif
  // sur une promesse que personne n'écoute. On compte les minuteurs posés et non nettoyés.
  const vrai = { poser: globalThis.setTimeout, retirer: globalThis.clearTimeout };
  const actifs = new Set();
  globalThis.setTimeout = (f, ms, ...a) => { const id = vrai.poser(f, ms, ...a); actifs.add(id); return id; };
  globalThis.clearTimeout = (id) => { actifs.delete(id); vrai.retirer(id); };
  try {
    const champ = { focus() {}, select() {} };
    const cas = {
      'copie réussie': { clipboard: { writeText: async () => {} } },
      'refus': { clipboard: { writeText: () => Promise.reject(new Error('refus')) } },
      'refus synchrone': { clipboard: { writeText() { throw new Error('refus'); } } },
      'délai dépassé': { clipboard: { writeText: () => new Promise(() => {}) } },
    };
    for (const [nom, faux] of Object.entries(cas)) {
      await avecNavigator(faux, () => copier('texte', champ, nom === 'délai dépassé' ? 10 : 5000));
      assert.equal(actifs.size, 0, `${nom} : un minuteur est resté en route`);
    }
    // Sans presse-papiers, aucun minuteur n'est même posé.
    await avecNavigator({}, () => copier('texte', champ, 5000));
    assert.equal(actifs.size, 0);
  } finally {
    globalThis.setTimeout = vrai.poser;
    globalThis.clearTimeout = vrai.retirer;
    for (const id of actifs) vrai.retirer(id);
  }
});

// ---- Le message du bouton ----

test('le raccourci de copie suit le système de la personne', () => {
  // « Faites Cmd+C » à quelqu'un sous Windows, c'est lui demander une touche qu'il n'a pas.
  assert.equal(raccourciCopie({ platform: 'MacIntel' }), 'Cmd+C');
  assert.equal(raccourciCopie({ userAgentData: { platform: 'macOS' }, platform: '' }), 'Cmd+C');
  assert.equal(raccourciCopie({ platform: 'Win32' }), 'Ctrl+C');
  assert.equal(raccourciCopie({ userAgentData: { platform: 'Windows' } }), 'Ctrl+C');
  assert.equal(raccourciCopie({ platform: 'Linux x86_64' }), 'Ctrl+C');
  assert.equal(raccourciCopie({}), 'Ctrl+C');
  assert.equal(raccourciCopie(null), 'Ctrl+C');
});

test('sur un appareil tactile, il n’y a pas de raccourci à annoncer', () => {
  // « Faites Cmd+C » n'a aucun sens sur un téléphone : pas de clavier. À 360 px, c'est le
  // lectorat qu'on a. `null` dit « pas de raccourci » ; la consigne parle alors de la commande
  // Copier de l'appareil.
  assert.equal(raccourciCopie({ platform: 'iPhone' }), null);
  assert.equal(raccourciCopie({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone' }), null);
  assert.equal(raccourciCopie({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', platform: 'Linux armv81' }), null);
  assert.equal(raccourciCopie({ userAgentData: { mobile: true, platform: 'Android' } }), null);
  // Un iPad récent se fait passer pour un Mac, mais il a un écran tactile.
  assert.equal(raccourciCopie({ platform: 'MacIntel', maxTouchPoints: 5 }), null);
  // Un Mac, lui, n'en a pas ; un portable Windows tactile reste un portable.
  assert.equal(raccourciCopie({ platform: 'MacIntel', maxTouchPoints: 0 }), 'Cmd+C');
  assert.equal(raccourciCopie({ platform: 'Win32', maxTouchPoints: 10, userAgentData: { mobile: false, platform: 'Windows' } }), 'Ctrl+C');
});

test('sans argument, le raccourci lit le navigateur courant', async () => {
  assert.equal(await avecNavigator({ platform: 'Win32' }, async () => raccourciCopie()), 'Ctrl+C');
  assert.equal(await avecNavigator({ platform: 'MacIntel' }, async () => raccourciCopie()), 'Cmd+C');
  assert.equal(await avecNavigator(undefined, async () => raccourciCopie()), 'Ctrl+C');
});

test('le message du bouton dit ce qui s’est passé', () => {
  assert.equal(messageCopie('presse-papiers', 'Cmd+C'), 'Copié');
  assert.equal(messageCopie('selection', 'Cmd+C'), 'Sélectionné, faites Cmd+C');
  assert.equal(messageCopie('selection', 'Ctrl+C'), 'Sélectionné, faites Ctrl+C');
  // Sans raccourci (appareil tactile), la consigne ne nomme aucune touche.
  assert.equal(messageCopie('selection', null), 'Sélectionné, copiez-le avec la commande Copier de votre appareil');
  assert.doesNotMatch(messageCopie('selection', null), /Cmd|Ctrl/);
});

test('la consigne de copie se lit dans une phrase', () => {
  assert.equal(consigneCopie('Ctrl+C'), 'faites Ctrl+C');
  assert.equal(consigneCopie(null), 'copiez-le avec la commande Copier de votre appareil');
});

// ---- Le bloc de code de la page ----

test('codeHtml rend un bloc repérable, lisible au clavier et nommé', () => {
  const html = codeHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Les quatre variantes' });
  assert.match(html, /^<div class="ds-code-bloc" data-fichier="bouton\.html" data-demo="variantes">/);
  // Un <pre> qui défile n'est atteignable au clavier que s'il est focalisable.
  assert.match(html, /<pre class="ds-code body-sm" tabindex="0" role="region" aria-label="Code HTML : Les quatre variantes">/);
  assert.match(html, /<code class="ds-code-bloc__texte">/);
  // Le bouton existe d'emblée, mais ne sert à rien tant qu'il n'y a pas de code à copier.
  // Le bouton porte un nom FIXE qui dit quoi il copie : quatre boutons « Copier » sur une page,
  // un lecteur d'écran qui les liste n'a sinon aucun moyen de les distinguer. Le retour (« Copié »…)
  // passe par la zone de statut, donc le texte visible qui change n'a pas à être lu.
  assert.match(html, /<button type="button" class="ds-copier label-md" aria-label="Copier le code : Les quatre variantes" disabled>Copier<\/button>/);
  assert.match(html, /role="status"/);
});

test('codeHtml refuse tout de suite une adresse qu’aucun test ne pourrait suivre', () => {
  assert.throws(() => codeHtml({ fichier: 'bouton.html', demo: 'variantes' }), /titre/);
  assert.throws(() => codeHtml({ fichier: 'bouton.html', titre: 'x' }), /demo/);
  assert.throws(() => codeHtml({ demo: 'variantes', titre: 'x' }), /fichier/);
  assert.throws(() => codeHtml({ fichier: '../bouton.html', demo: 'variantes', titre: 'x' }), /fichier/);
  assert.throws(() => codeHtml(), /fichier/);
});

test('codeHtml échappe le titre', () => {
  const html = codeHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Un "titre" <b>' });
  assert.match(html, /aria-label="Code HTML : Un &quot;titre&quot; &lt;b&gt;"/);
  assert.match(html, /aria-label="Copier le code : Un &quot;titre&quot; &lt;b&gt;"/);
});

test('deux blocs de titres différents ont des boutons de noms différents, et le nom contient le mot visible', () => {
  const nom = (titre) => codeHtml({ fichier: 'bouton.html', demo: 'variantes', titre }).match(/<button[^>]*aria-label="([^"]*)"/)[1];
  assert.notEqual(nom('Les variantes'), nom('Les tailles'));
  // WCAG 2.5.3 : le nom accessible contient le texte visible du bouton, que la commande vocale vise.
  assert.match(nom('Les variantes'), /^Copier\b/);
});

test('les blocs d’une même page ont des titres distincts : sinon leurs boutons ne se distinguent pas', () => {
  let vus = 0;
  for (const { nom, html } of pages()) {
    const titres = [...html.matchAll(/codeHtml\(\s*\{[^}]*titre:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
    assert.equal(new Set(titres).size, titres.length, `${nom} : deux blocs de code portent le même titre, donc le même nom de bouton`);
    vus += titres.length;
  }
  assert.ok(vus >= 4, `${vus} titre(s) lu(s) : le détecteur ne voit plus les blocs`);
});

// Un bloc factice : seuls les éléments que le code touche, avec leurs propriétés.
function fauxBloc(fichier = 'bouton.html', demo = 'variantes') {
  const doc = fauxDocument();
  const texte = { textContent: 'Le code apparaît quand la démonstration est chargée.', ownerDocument: doc };
  const bouton = {
    textContent: 'Copier', disabled: true, ecouteurs: {},
    addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); },
    async cliquer() { for (const f of this.ecouteurs.click || []) await f(); },
  };
  const etat = { textContent: '' };
  const champs = { '.ds-code-bloc__texte': texte, '.ds-copier': bouton, '.ds-code-bloc__etat': etat };
  return { dataset: { fichier, demo }, texte, bouton, etat, ownerDocument: doc, querySelector: (s) => champs[s] || null };
}

test('poserCode réindente le HTML du cadre, le pose dans le bloc et libère le bouton', () => {
  const bloc = fauxBloc();
  poserCode(bloc, '\n  <div class="row"><button class="btn">OK</button></div>\n');
  assert.equal(bloc.texte.textContent, '<div class="row">\n  <button class="btn">OK</button>\n</div>');
  assert.equal(bloc.bouton.disabled, false);
  assert.equal(bloc.dataset.etat, 'pret');
});

test('poserCode dit qu’il n’y a pas de code quand la démonstration est vide ou inconnue', () => {
  // `html` vaut '' quand le cadre n'a pas trouvé sa démonstration. Un bloc vide qui reste
  // muet serait une page qui ne dit pas qu'elle est cassée.
  const bloc = fauxBloc();
  poserCode(bloc, '   ');
  assert.match(bloc.texte.textContent, /variantes/);
  assert.match(bloc.texte.textContent, /introuvable|pas pu/i);
  assert.equal(bloc.bouton.disabled, true);
  assert.equal(bloc.dataset.etat, 'absent');
});

test('le bouton Copier copie le code affiché et annonce « Copié »', async () => {
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  const ecrits = [];
  brancherCode(bloc, fenetre);
  poserCode(bloc, '<p>Un</p>');
  await avecNavigator({ platform: 'MacIntel', clipboard: { writeText: async (t) => { ecrits.push(t); } } }, () => bloc.bouton.cliquer());
  assert.deepEqual(ecrits, ['<p>Un</p>']);
  assert.equal(bloc.bouton.textContent, 'Copié');
  assert.equal(bloc.etat.textContent, 'Copié', 'le lecteur d’écran doit entendre le résultat');
  // Puis le bouton se remet comme il était.
  fenetre.tic();
  assert.equal(bloc.bouton.textContent, 'Copier');
  assert.equal(bloc.etat.textContent, '');
});

test('quand le presse-papiers refuse, le bouton le dit et le texte est vraiment sélectionné', async () => {
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCode(bloc, fenetre);
  poserCode(bloc, '<p>Un</p>');
  await avecNavigator({ platform: 'Win32', clipboard: { writeText: () => Promise.reject(new Error('refus')) } }, () => bloc.bouton.cliquer());
  assert.equal(bloc.bouton.textContent, 'Sélectionné, faites Ctrl+C');
  assert.equal(bloc.etat.textContent, 'Sélectionné, faites Ctrl+C');
  const { plages } = bloc.ownerDocument.traces;
  assert.equal(plages.length, 1, 'le code n’a pas été sélectionné');
  assert.equal(plages[0].noeud, bloc.texte);
});

test('sur une origine sans presse-papiers, le bouton ne reste pas muet', async () => {
  const bloc = fauxBloc();
  brancherCode(bloc, fausseFenetre());
  poserCode(bloc, '<p>Un</p>');
  await avecNavigator({ platform: 'MacIntel' }, () => bloc.bouton.cliquer());
  assert.equal(bloc.bouton.textContent, 'Sélectionné, faites Cmd+C');
});

test('si ni la copie ni la sélection ne marchent, le bouton le dit au lieu de se taire', async () => {
  const bloc = fauxBloc();
  brancherCode(bloc, fausseFenetre());
  poserCode(bloc, '<p>Un</p>');
  bloc.texte.ownerDocument = undefined;     // aucune sélection possible
  await avecNavigator({}, () => bloc.bouton.cliquer());
  assert.match(bloc.bouton.textContent, /impossible/i);
  assert.match(bloc.etat.textContent, /impossible/i);
});

test('un clic avant l’arrivée du code ne copie pas le texte d’attente', async () => {
  const bloc = fauxBloc();
  brancherCode(bloc, fausseFenetre());
  const ecrits = [];
  await avecNavigator({ clipboard: { writeText: async (t) => { ecrits.push(t); } } }, () => bloc.bouton.cliquer());
  assert.deepEqual(ecrits, []);
  assert.equal(bloc.bouton.textContent, 'Copier');
});

test('deux clics de suite ne se marchent pas dessus', async () => {
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCode(bloc, fenetre);
  poserCode(bloc, '<p>Un</p>');
  await avecNavigator({ clipboard: { writeText: async () => {} } }, async () => { await bloc.bouton.cliquer(); await bloc.bouton.cliquer(); });
  assert.equal(fenetre.minuteurs.size, 1, 'le premier compte à rebours devait être annulé');
});

// ---- Le branchement dans brancherCadres ----

function fausseFenetre() {
  const ecouteurs = {};
  const minuteurs = new Map();
  let suivant = 0;
  return {
    minuteurs,
    addEventListener(type, f) { (ecouteurs[type] ||= []).push(f); },
    setTimeout(f, ms) { suivant += 1; minuteurs.set(suivant, { f, ms }); return suivant; },
    clearTimeout(id) { minuteurs.delete(id); },
    tic() { for (const [id, m] of [...minuteurs]) { minuteurs.delete(id); m.f(); } },
    envoyer(source, data) { for (const f of ecouteurs.message || []) f({ source, data }); },
  };
}

function fauxCadre(fichier, demo, adresse = `http://localhost:8123/design-system/exemples/${fichier}#${demo}`) {
  const vue = {
    style: {}, attributs: {},
    contentWindow: { location: { href: adresse } },
    ecouteurs: {},
    addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); },
    declencher(type) { for (const f of this.ecouteurs[type] || []) f(); },
    setAttribute(nom, valeur) { this.attributs[nom] = valeur; },
  };
  return { vue, dataset: { fichier, demo }, innerHTML: '', querySelector: (s) => (s === '.ds-cadre__vue' ? vue : null) };
}

const fausseRacine = (cadres, blocs = []) => ({
  querySelectorAll: (s) => (s === '.ds-cadre' ? cadres : s === '.ds-code-bloc' ? blocs : []),
});

test('brancherCadres pose dans le bloc le HTML que le cadre annonce, réindenté', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<div class="row"><button class="btn">OK</button></div>' });
  assert.equal(bloc.texte.textContent, '<div class="row">\n  <button class="btn">OK</button>\n</div>');
  assert.equal(bloc.bouton.disabled, false);
});

test('brancherCadres ne pose le code que dans le bloc de SA démonstration', () => {
  const a = fauxCadre('bouton.html', 'variantes');
  const b = fauxCadre('bouton.html', 'tailles');
  const blocA = fauxBloc('bouton.html', 'variantes');
  const blocB = fauxBloc('bouton.html', 'tailles');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([a, b], [blocA, blocB]), 1000, fenetre);
  fenetre.envoyer(b.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'tailles', hauteur: 80, html: '<p>tailles</p>' });
  assert.equal(blocB.texte.textContent, '<p>tailles</p>');
  assert.match(blocA.texte.textContent, /apparaît/, 'le bloc d’une autre démonstration a été touché');
});

test('un cadre qui annonce une autre démonstration que la sienne ne touche pas à son bloc', () => {
  // Un lien dans la démo peut faire passer le cadre à une autre démonstration du même
  // fichier (`cadre-enfant.js`). Son HTML n'est pas celui que ce bloc doit montrer.
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<p>variantes</p>' });
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'bloc', hauteur: 100, html: '<p>bloc</p>' });
  assert.equal(bloc.texte.textContent, '<p>variantes</p>');
});

test('une annonce sans HTML, ou avec autre chose qu’un texte, ne vide pas le bloc', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<p>un</p>' });
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 140 });
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 140, html: 42 });
  assert.equal(bloc.texte.textContent, '<p>un</p>');
});

test('le HTML ne se pose que s’il vient de la fenêtre du cadre', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer({ etranger: true }, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<script>mal()</script>' });
  assert.match(bloc.texte.textContent, /apparaît/);
});

test('le HTML est posé comme du texte, jamais interprété', () => {
  // `textContent`, pas `innerHTML` : le code montré est une chaîne, pas un morceau de page.
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<img src=x onerror=alert(1)>' });
  assert.equal(bloc.texte.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(bloc.texte.innerHTML, undefined);
});

test('un cadre muet dit au bloc de code que son code ne viendra pas', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  cadre.vue.declencher('load');
  fenetre.tic();
  assert.equal(bloc.dataset.etat, 'absent');
  assert.match(bloc.texte.textContent, /variantes/);
  assert.equal(bloc.bouton.disabled, true);
});

test('un cadre déjà chargé et déjà annoncé quand la page branche : le bloc le dit, il ne reste pas muet', () => {
  // Le chemin le plus vraisemblable pour une page qui recopie le montage : un `await` entre la
  // pose des cadres et `brancherCadres`. Les cadres, désormais chargés d'emblée, ont le temps
  // d'annoncer avant qu'on les écoute ; le HTML (envoyé UNE fois) est perdu, `load` est passé
  // donc le compte à rebours du cadre ne s'arme jamais. Sans garde, le bloc resterait sur
  // « Le code apparaît quand la démonstration est chargée » pour toujours.
  const cadre = fauxCadre('bouton.html', 'variantes');           // adresse réelle : déjà chargé
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  assert.equal(bloc.dataset.etat, undefined, 'il faut laisser au code le temps d’arriver');
  fenetre.tic();
  assert.equal(bloc.dataset.etat, 'absent');
  assert.match(bloc.texte.textContent, /variantes/);
  assert.match(bloc.texte.textContent, /avant que la page/i);
  // Recharger ne répare rien : c'est un `await` mal placé dans la page. Le message dit ce qui est
  // vrai, et que c'est à la page de le corriger.
  assert.doesNotMatch(bloc.texte.textContent, /recharg/i);
  assert.match(bloc.texte.textContent, /à corriger dans la page/i);
  assert.equal(bloc.bouton.disabled, true);
  assert.match(bloc.etat.textContent, /pas pu être lu/);
});

test('le délai de garde du bloc est celui des cadres, et part du branchement d’un cadre déjà chargé', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [fauxBloc()]), 750, fenetre);
  assert.deepEqual([...fenetre.minuteurs.values()].map((m) => m.ms), [750]);
});

test('le code qui arrive avant la fin du délai de garde l’emporte', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const bloc = fauxBloc();
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [bloc]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<p>x</p>' });
  fenetre.tic();
  assert.equal(bloc.dataset.etat, 'pret');
  assert.equal(bloc.texte.textContent, '<p>x</p>');
});

test('un cadre pas encore chargé n’arme aucun délai de garde : son chargement s’en charge', () => {
  // Un faux diagnostic est pire que pas de diagnostic : un cadre lent à charger ne doit pas
  // être déclaré muet avant d'avoir été demandé.
  const cadre = fauxCadre('bouton.html', 'variantes', 'about:blank');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [fauxBloc()]), 1000, fenetre);
  assert.equal(fenetre.minuteurs.size, 0);
});

test('un document encore en cours de chargement n’arme pas non plus de délai de garde', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  cadre.vue.contentDocument = { readyState: 'loading' };
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre], [fauxBloc()]), 1000, fenetre);
  assert.equal(fenetre.minuteurs.size, 0, 'son annonce arrive encore : l’événement load armera le délai du cadre');
  cadre.vue.contentDocument.readyState = 'complete';
  brancherCadres(fausseRacine([cadre], [fauxBloc()]), 1000, fenetre);
  assert.equal(fenetre.minuteurs.size, 1);
});

test('un bloc de code sans cadre dans la page se signale tout de suite', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const orphelin = fauxBloc('bouton.html', 'tailles');
  brancherCadres(fausseRacine([cadre], [orphelin]), 1000, fausseFenetre());
  assert.equal(orphelin.dataset.etat, 'absent');
  assert.match(orphelin.texte.textContent, /tailles/);
});

test('un bloc de code sans aucun cadre dans la page se signale aussi', () => {
  const orphelin = fauxBloc();
  brancherCadres(fausseRacine([], [orphelin]), 1000, fausseFenetre());
  assert.equal(orphelin.dataset.etat, 'absent');
});

test('un cadre dont le code est montré se charge sans attendre qu’on le fasse défiler', () => {
  // `loading="lazy"` ne charge un cadre que s'il approche de l'écran. Le code, lui, peut se
  // trouver sur une autre page de l'écran — on y saute depuis le sommaire — et resterait vide.
  const avecCode = fauxCadre('bouton.html', 'variantes');
  const sansCode = fauxCadre('bouton.html', 'tailles');
  brancherCadres(fausseRacine([avecCode, sansCode], [fauxBloc('bouton.html', 'variantes')]), 1000, fausseFenetre());
  assert.equal(avecCode.vue.attributs.loading, 'eager');
  assert.equal(sansCode.vue.attributs.loading, undefined, 'un cadre sans code reste paresseux');
});

test('brancherCadres reste compatible avec une racine qui ne connaît pas les blocs de code', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres({ querySelectorAll: (s) => (s === '.ds-cadre' ? [cadre] : []) }, 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 100, html: '<p>x</p>' });
  assert.equal(cadre.vue.style.height, '100px');
});

// ---- Les pages ----

const DOSSIER_COMPOSANTS = new URL('../design-system/composants/', import.meta.url);
const pages = () => readdirSync(DOSSIER_COMPOSANTS).filter((f) => f.endsWith('.html'))
  .map((nom) => ({ nom, html: readFileSync(new URL(nom, DOSSIER_COMPOSANTS), 'utf8') }));

// Le contenu de la page sans ses commentaires : un commentaire qui explique pourquoi il n'y a
// pas de `<pre>` ne doit pas faire échouer le test qui en cherche un.
const sansCommentaires = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

test('aucune page de composant n’écrit un bloc de code à la main', () => {
  // La règle qui ferme la promesse du site. Un <pre> dans le balisage est du code que
  // personne ne vérifie contre la démonstration : c'est la doc qui ment. Le code passe par
  // `codeHtml`, qui le tire du cadre.
  const lues = pages();
  assert.ok(lues.length >= 1);
  for (const { nom, html } of lues) {
    const corps = sansCommentaires(html);
    assert.doesNotMatch(corps, /<pre[\s>]/i, `${nom} contient un <pre> écrit à la main : employez codeHtml({ fichier, demo, titre })`);
    assert.doesNotMatch(corps, /class="[^"]*\bds-code\b/, `${nom} pose ds-code à la main : employez codeHtml`);
  }
});

test('tout bloc de code d’une page est adossé à un cadre de la même page, sur la même démo', () => {
  let vus = 0;
  for (const { nom, html } of pages()) {
    const cadres = [...html.matchAll(/cadreHtml\(\s*\{([^}]*)\}/g)].map((m) => ({
      fichier: (m[1].match(/\bfichier\s*:\s*'([^']*)'/) || [])[1],
      demo: (m[1].match(/\bdemo\s*:\s*'([^']*)'/) || [])[1],
    }));
    const appels = [...html.matchAll(/codeHtml\(\s*\{([^}]*)\}/g)];
    for (const a of appels) {
      const fichier = (a[1].match(/\bfichier\s*:\s*'([^']*)'/) || [])[1];
      const demo = (a[1].match(/\bdemo\s*:\s*'([^']*)'/) || [])[1];
      assert.ok(fichier && demo, `codeHtml({${a[1].trim()}}) : fichier et demo doivent être écrits en clair`);
      assert.ok(cadres.some((c) => c.fichier === fichier && c.demo === demo),
        `${nom} : codeHtml vise ${fichier}#${demo}, mais aucun cadre de la page ne montre cette démonstration — le code ne viendrait jamais`);
      vus += 1;
    }
    if (appels.length) assert.match(html, /import \{[^}]*\bcodeHtml\b[^}]*\} from '\.\.\/js\/code\.js'/, `${nom} n’importe pas codeHtml`);
  }
  assert.ok(vus >= 1, 'le détecteur ne voit plus aucun bloc de code dans les pages');
});

test('la page Bouton montre le code de chacune de ses quatre démonstrations, extrait du cadre', () => {
  // Un bloc écrit à la main pour une démonstration, c'est la divergence que cette tâche élimine.
  const html = readFileSync(new URL('bouton.html', DOSSIER_COMPOSANTS), 'utf8');
  const code = html.slice(html.indexOf('id="code"'), html.indexOf('id="quand-ne-pas"'));
  for (const demo of ['variantes', 'tailles', 'etats', 'bloc']) {
    assert.match(html, new RegExp(`codeHtml\\(\\s*\\{\\s*fichier:\\s*'bouton\\.html',\\s*demo:\\s*'${demo}'`), `pas de bloc de code pour « ${demo} »`);
    assert.match(code, new RegExp(`id="code-${demo}"`), `le bloc de « ${demo} » n’est pas dans la section « Le code »`);
  }
});

test('la section « Le code » ne recopie plus à la main le code d’une démonstration', () => {
  // Les puces qui écrivaient `class="btn btn--primary btn--block"` ou `disabled` doublonnaient
  // le code extrait : deux endroits qui peuvent dire deux choses.
  const html = readFileSync(new URL('bouton.html', DOSSIER_COMPOSANTS), 'utf8');
  const code = sansCommentaires(html.slice(html.indexOf('id="code"'), html.indexOf('id="quand-ne-pas"')));
  assert.doesNotMatch(code, /btn--(?:block|sm|primary|secondary|ghost|danger|icon)/, 'une classe de variante est écrite à la main dans la section « Le code »');
  assert.doesNotMatch(code, /&lt;[a-z][^<]*\bdisabled\b/, 'une balise avec disabled est écrite à la main dans la section « Le code »');
});

test('un script de page pose ses blocs de code avant de brancher, sans rien attendre entre les deux', () => {
  // `brancherCadres` doit voir les cadres ET les blocs, et arriver avant que les cadres
  // aient annoncé. Un `await` entre la pose et le branchement laisse aux cadres (chargés
  // d'emblée) le temps d'annoncer dans le vide : le HTML, envoyé une seule fois, est perdu.
  let vues = 0;
  for (const { nom, html } of pages()) {
    const script = sansCommentaires(html).split('<script type="module">')[1];
    if (!script || !/brancherCadres\(/.test(script)) continue;
    const code = script.replace(/\/\/.*$/gm, '');                       // les commentaires de ligne
    const branche = code.indexOf('brancherCadres(document');
    assert.ok(branche > 0, `${nom} : appel de brancherCadres introuvable`);
    const derniereCode = code.lastIndexOf('codeHtml(');
    const premierCadre = code.indexOf('cadreHtml(');
    assert.ok(derniereCode < branche, `${nom} : un bloc de code est posé APRÈS brancherCadres, il ne serait jamais alimenté`);
    assert.doesNotMatch(code.slice(premierCadre, branche), /\bawait\b/, `${nom} : un await entre cadreHtml et brancherCadres laisse les cadres annoncer avant qu'on les écoute`);
    vues += 1;
  }
  assert.ok(vues >= 1, 'le détecteur ne voit plus le script d’aucune page');
});

test('une page qui invite à tabuler dit aussi ce que fait Safari', () => {
  // Safari ne tabule pas jusqu'aux <button> par défaut : il faut Option+Tab, ou une préférence.
  // Une page qui dit « tabulez » sans le dire promet un anneau que le lecteur sur Safari ne
  // verra pas — la documentation qui promet ce qu'on ne voit pas. La règle générale : ne jamais
  // inviter à constater quelque chose sans l'avoir vérifié chez le lecteur, pas chez soi.
  const invitation = /\btabul(?:ez|er)\b|\bappuyez sur Tab\b/i;
  let invitations = 0;
  for (const { nom, html } of pages()) {
    const texte = sansCommentaires(html);
    if (!invitation.test(texte)) continue;
    invitations += 1;
    assert.match(texte, /Safari/, `${nom} invite à tabuler sans parler de Safari`);
    assert.match(texte, /Option\+Tab/, `${nom} ne donne pas le geste qui marche sous Safari`);
    // L'intitulé exact du réglage de Safari n'a été vu par personne ici : on renvoie aux
    // réglages avancés sans le citer.
    assert.doesNotMatch(texte, /met en surbrillance/i, `${nom} cite un intitulé de réglage de Safari que personne n’a vérifié`);
  }
  assert.ok(invitations >= 1, 'le détecteur ne voit plus aucune invitation à tabuler : la page Bouton en contient une');
});

test('une section d’exemple ne contient ni script ni feuille de style', () => {
  // Le contenu d'une section est le code que la page affiche : un script ou un style s'y
  // retrouverait dans ce que la personne copie. (Ce test ne juge pas la prose : un composant a
  // droit à ses `<p>` et à ses titres. Que la section ne soit que le composant reste une règle
  // de relecture.)
  const dossier = new URL('../design-system/exemples/', import.meta.url);
  for (const f of readdirSync(dossier).filter((n) => n.endsWith('.html'))) {
    const source = readFileSync(new URL(f, dossier), 'utf8');
    for (const m of source.matchAll(/<section data-demo="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      assert.doesNotMatch(m[2], /<script|<style/, `${f}#${m[1]} : un script ou un style serait copié avec le composant`);
    }
  }
});

test('une section d’exemple ne contient aucun commentaire : il serait copié avec le code', () => {
  // Les commentaires d'un fichier d'exemple s'adressent aux auteurs du site. Ceux qui sont
  // DANS une section se retrouveraient dans le code que le lecteur copie.
  const dossier = new URL('../design-system/exemples/', import.meta.url);
  for (const f of readdirSync(dossier).filter((n) => n.endsWith('.html'))) {
    const source = readFileSync(new URL(f, dossier), 'utf8');
    for (const m of source.matchAll(/<section data-demo="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      assert.doesNotMatch(m[2], /<!--/, `${f}#${m[1]} : un commentaire dans la section serait copié avec le code`);
    }
  }
});
