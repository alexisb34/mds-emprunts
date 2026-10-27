// Le code montré : extrait du cadre, réindenté, copiable.
//
// La promesse du site est que la démonstration et son code ne peuvent pas diverger. Pour la
// tenir, le code n'est écrit nulle part : le cadre annonce le HTML qu'il a réellement rendu,
// la page le réindente et l'affiche. Ce fichier garde les trois morceaux de cette chaîne —
// `formaterHtml` (la présentation), `copier` (le geste) et le branchement dans `brancherCadres`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { formaterHtml, copier, raccourciCopie, messageCopie, codeHtml, poserCode, brancherCode } from '../design-system/js/code.js';
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
      const sans = (s) => s.replace(/\s+/g, '');
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
function fauxDocument() {
  const traces = { plages: [], vide: 0 };
  const selection = { removeAllRanges() { traces.vide += 1; }, addRange(p) { traces.plages.push(p); } };
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

// ---- Le message du bouton ----

test('le raccourci de copie suit le système de la personne', () => {
  // « Faites Cmd+C » à quelqu'un sous Windows, c'est lui demander une touche qu'il n'a pas.
  assert.equal(raccourciCopie({ platform: 'MacIntel' }), 'Cmd+C');
  assert.equal(raccourciCopie({ platform: 'iPhone' }), 'Cmd+C');
  assert.equal(raccourciCopie({ userAgentData: { platform: 'macOS' }, platform: '' }), 'Cmd+C');
  assert.equal(raccourciCopie({ platform: 'Win32' }), 'Ctrl+C');
  assert.equal(raccourciCopie({ userAgentData: { platform: 'Windows' } }), 'Ctrl+C');
  assert.equal(raccourciCopie({ platform: 'Linux x86_64' }), 'Ctrl+C');
  assert.equal(raccourciCopie({}), 'Ctrl+C');
  assert.equal(raccourciCopie(null), 'Ctrl+C');
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
});

// ---- Le bloc de code de la page ----

test('codeHtml rend un bloc repérable, lisible au clavier et nommé', () => {
  const html = codeHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Les quatre variantes' });
  assert.match(html, /^<div class="ds-code-bloc" data-fichier="bouton\.html" data-demo="variantes">/);
  // Un <pre> qui défile n'est atteignable au clavier que s'il est focalisable.
  assert.match(html, /<pre class="ds-code body-sm" tabindex="0" role="region" aria-label="Code HTML : Les quatre variantes">/);
  assert.match(html, /<code class="ds-code-bloc__texte">/);
  // Le bouton existe d'emblée, mais ne sert à rien tant qu'il n'y a pas de code à copier.
  assert.match(html, /<button type="button" class="ds-copier label-md" disabled>Copier<\/button>/);
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

function fauxCadre(fichier, demo) {
  const vue = {
    style: {}, attributs: {},
    contentWindow: { location: { href: `http://localhost:8123/design-system/exemples/${fichier}#${demo}` } },
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

test('la page Bouton montre le code de sa démonstration des variantes, extrait du cadre', () => {
  const html = readFileSync(new URL('bouton.html', DOSSIER_COMPOSANTS), 'utf8');
  assert.match(html, /codeHtml\(\s*\{\s*fichier:\s*'bouton\.html',\s*demo:\s*'variantes'/);
  // Le bloc est dans la section « Le code ».
  const code = html.slice(html.indexOf('id="code"'), html.indexOf('id="quand-ne-pas"'));
  assert.match(code, /id="code-variantes"/);
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
  }
  assert.ok(invitations >= 1, 'le détecteur ne voit plus aucune invitation à tabuler : la page Bouton en contient une');
});

test('les exemples ne contiennent que ce qu’on peut montrer : pas de prose dans une section', () => {
  // Le contenu d'une section est le code que la page affiche. Un paragraphe d'explication
  // s'afficherait dans le code que la personne copie.
  const dossier = new URL('../design-system/exemples/', import.meta.url);
  for (const f of readdirSync(dossier).filter((n) => n.endsWith('.html'))) {
    const source = readFileSync(new URL(f, dossier), 'utf8');
    for (const m of source.matchAll(/<section data-demo="([\w-]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      assert.doesNotMatch(m[2], /<script|<style|<h[1-6][\s>]/, `${f}#${m[1]} : du contenu qui n’est pas un composant sera copié avec lui`);
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
