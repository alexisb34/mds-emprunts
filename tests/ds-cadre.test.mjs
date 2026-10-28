// Les cadres d'exemple, et la page Bouton qui s'en sert la première.
//
// Le dépôt a cinq feuilles de style qui se contredisent : `.tabs` existe dans
// `css/components.css` ET dans `css/admin.css`, sous deux apparences différentes, et chacune
// de ces feuilles pose de la mise en page plein écran (`.admin-shell`, `.m-nav`, `#toast-root`)
// qui prendrait le contrôle d'une page de documentation. D'où le mécanisme que ce fichier
// garde : chaque exemple est une page autonome, rendue dans un `<iframe>`, qui charge
// exactement les feuilles dont ce composant a besoin et rien d'autre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { cadreHtml, brancherCadres, messageCadreAbsent, DELAI_CADRE, MARQUE_CADRE } from '../design-system/js/cadre.js';
import { MARQUE_CADRE as MARQUE_ENFANT, demoDe, montrerDemo, hauteurDe, installer } from '../design-system/js/cadre-enfant.js';

const DOSSIER_COMPOSANTS = new URL('../design-system/composants/', import.meta.url);
const DOSSIER_EXEMPLES = new URL('../design-system/exemples/', import.meta.url);

function pagesComposants() {
  return readdirSync(DOSSIER_COMPOSANTS)
    .filter((f) => f.endsWith('.html'))
    .map((nom) => ({ nom, html: readFileSync(new URL(nom, DOSSIER_COMPOSANTS), 'utf8') }));
}

function fichiersExemples() {
  return readdirSync(DOSSIER_EXEMPLES).filter((f) => f.endsWith('.html'));
}

// Lève si le fichier manque : c'est exactement ce qu'on veut qu'un test dise.
function lireExemple(fichier) {
  return readFileSync(new URL(fichier, DOSSIER_EXEMPLES), 'utf8');
}

// ---- Les assertions du brief ----

test('cadreHtml pointe vers le bon fichier et porte un titre accessible', () => {
  const html = cadreHtml({ fichier: 'bouton.html', demo: 'variantes', titre: 'Les variantes de bouton' });
  assert.match(html, /src="\.\.\/exemples\/bouton\.html#variantes"/);
  assert.match(html, /title="Les variantes de bouton"/);
});

test('chaque cadre vise une démo qui existe vraiment', () => {
  for (const page of pagesComposants()) {
    for (const [, fichier, demo] of page.html.matchAll(/src="\.\.\/exemples\/([\w-]+\.html)#([\w-]+)"/g)) {
      const exemple = lireExemple(fichier);                       // lève si le fichier manque
      assert.match(exemple, new RegExp(`data-demo="${demo}"`), `${page.nom} vise ${fichier}#${demo}, absent`);
    }
  }
});

test('un exemple ne charge aucune feuille de page, sauf les exemples mobiles', () => {
  // .admin-shell et .m-nav prennent tout l’écran : chargés dans un cadre, ils dévorent la démo.
  for (const f of fichiersExemples()) {
    const html = lireExemple(f);
    assert.doesNotMatch(html, /admin\.css/, `${f} charge admin.css`);
    if (!f.startsWith('mobile-')) assert.doesNotMatch(html, /mobile\.css/, `${f} charge mobile.css`);
    assert.match(html, /href="\.\.\/\.\.\/css\/tokens\.css"/, `${f} ne charge pas tokens.css`);
    assert.match(html, /fonts\.googleapis\.com\/css2\?family=Inter/, `${f} ne charge pas les polices`);
  }
});

test('un cadre muet se signale au lieu de rester blanc', () => {
  assert.match(messageCadreAbsent('bouton.html'), /exemples\/bouton\.html/);
  assert.match(messageCadreAbsent('bouton.html'), /introuvable/i);
});

// ---- Le test du brief ne voit que les cadres écrits à la main. Celui-ci voit les deux formes ----
//
// Une page peut écrire son `<iframe>` dans son balisage, ou le faire poser par `cadreHtml`
// depuis son script — c'est la seconde forme qui est employée, pour qu'il n'existe qu'une
// définition du cadre. Le motif `src="…"` du brief ne verrait alors AUCUN cadre et passerait
// sans rien vérifier. `referencesCadres` lit les deux formes, et un garde-fou plus bas
// interdit à ce test de devenir muet.

function referencesCadres(html) {
  const refs = [...html.matchAll(/src="\.\.\/exemples\/([\w-]+\.html)#([\w-]+)"/g)]
    .map((m) => ({ forme: 'balisage', fichier: m[1], demo: m[2] }));
  for (const appel of html.matchAll(/cadreHtml\(\s*\{([^}]*)\}/g)) {
    const fichier = appel[1].match(/\bfichier\s*:\s*'([^']*)'/);
    const demo = appel[1].match(/\bdemo\s*:\s*'([^']*)'/);
    assert.ok(fichier && demo, `cadreHtml({${appel[1].trim()}}) : fichier et demo doivent être écrits en clair, sinon aucun test ne peut vérifier qu’ils existent`);
    refs.push({ forme: 'script', fichier: fichier[1], demo: demo[1] });
  }
  return refs;
}

test('tout cadre, posé à la main ou par cadreHtml, vise une démo qui existe', () => {
  let vus = 0;
  for (const page of pagesComposants()) {
    const refs = referencesCadres(page.html);
    // Autant de cadres que d'appels : une adresse calculée échapperait au test.
    assert.equal(refs.filter((r) => r.forme === 'script').length, (page.html.match(/cadreHtml\(/g) || []).length,
      `${page.nom} : un appel à cadreHtml n’a pas pu être lu`);
    for (const r of refs) {
      const exemple = lireExemple(r.fichier);
      assert.match(exemple, new RegExp(`data-demo="${r.demo}"`), `${page.nom} vise ${r.fichier}#${r.demo}, absent`);
      vus += 1;
    }
  }
  assert.ok(vus >= 4, `${vus} cadre(s) vérifié(s) : le détecteur ne voit plus les cadres des pages`);
});

test('le détecteur de cadres lit les deux formes et rien d’autre', () => {
  // Garde le test précédent honnête.
  assert.deepEqual(referencesCadres('<iframe src="../exemples/badge.html#tag">'),
    [{ forme: 'balisage', fichier: 'badge.html', demo: 'tag' }]);
  assert.deepEqual(referencesCadres("cadreHtml({ fichier: 'kpi.html', demo: 'teintes', titre: 'x' })"),
    [{ forme: 'script', fichier: 'kpi.html', demo: 'teintes' }]);
  assert.deepEqual(referencesCadres('<a href="../exemples/badge.html">x</a>'), []);
  assert.throws(() => referencesCadres('cadreHtml({ fichier: FICHIER, demo: d.cle })'), /écrits en clair/);
});

// ---- cadreHtml ----

test('cadreHtml rend un cadre paresseux, repérable et mesurable', () => {
  const html = cadreHtml({ fichier: 'bouton.html', demo: 'tailles', titre: 'Les deux hauteurs de bouton' });
  assert.match(html, /^<div class="ds-cadre"/);
  // `loading="lazy"` : douze cadres sur une page ne doivent pas tous se charger d'un coup.
  assert.match(html, /loading="lazy"/);
  // Le nom du fichier est porté par le cadre : c'est lui que le message d'absence nomme.
  assert.match(html, /data-fichier="bouton\.html"/);
  assert.match(html, /data-demo="tailles"/);
  assert.match(html, /<iframe class="ds-cadre__vue"/);
});

test('cadreHtml sait rendre un cadre étroit pour les écrans de téléphone', () => {
  assert.match(cadreHtml({ fichier: 'mobile-shell.html', demo: 'shell', titre: 'Le shell mobile', etroit: true }),
    /class="ds-cadre ds-cadre--etroit"/);
  assert.doesNotMatch(cadreHtml({ fichier: 'bouton.html', demo: 'bloc', titre: 'Pleine largeur' }), /--etroit/);
});

test('cadreHtml échappe le titre au lieu de le recopier', () => {
  const html = cadreHtml({ fichier: 'bouton.html', demo: 'etats', titre: 'Un « bouton » & son état <désactivé>' });
  assert.match(html, /title="Un « bouton » &amp; son état &lt;désactivé&gt;"/);
  assert.doesNotMatch(html, /<désactivé>/);
});

test('cadreHtml refuse tout de suite une adresse qu’aucun test ne pourrait suivre', () => {
  // Dix pages vont copier ces appels : une faute doit s'arrêter à la première page, pas
  // devenir un cadre blanc qui pointe vers `#undefined`.
  assert.throws(() => cadreHtml({ fichier: 'bouton.html', demo: 'variantes' }), /titre/);
  assert.throws(() => cadreHtml({ fichier: 'bouton.html', titre: 'x' }), /demo/);
  assert.throws(() => cadreHtml({ demo: 'variantes', titre: 'x' }), /fichier/);
  assert.throws(() => cadreHtml({ fichier: '../autre/bouton.html', demo: 'a', titre: 'x' }), /fichier/);
  assert.throws(() => cadreHtml({ fichier: 'bouton.svg', demo: 'a', titre: 'x' }), /fichier/);
  assert.throws(() => cadreHtml({ fichier: 'bouton.html', demo: 'deux mots', titre: 'x' }), /demo/);
});

test('messageCadreAbsent dit où chercher, dans quel dossier, et se signale', () => {
  const html = messageCadreAbsent('mobile-shell.html');
  assert.match(html, /class="ds-message"/);
  assert.match(html, /exemples\/mobile-shell\.html/);
  assert.match(html, /design-system\/exemples/);
  // Le message remplace un cadre APRÈS le chargement de la page : une région de statut le
  // fait annoncer à qui ne regarde pas l'écran.
  assert.match(html, /role="status"/);
  assert.doesNotMatch(messageCadreAbsent('<script>x</script>'), /<script>/);
});

test('un cadre remplacé par son message n’a plus sa propre bordure', () => {
  // Sinon le message encadré se retrouve dans le cadre encadré : deux traits pour un seul objet.
  const cadre = fauxCadre('bouton.html', 'variantes');
  const classes = [];
  cadre.classList = { add: (c) => classes.push(c) };
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('load');
  fenetre.tic();
  assert.deepEqual(classes, ['ds-cadre--muet']);
  const css = readFileSync(new URL('../design-system/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.ds-cadre--muet\s*\{[^}]*border:\s*0/);
});

// ---- brancherCadres : la hauteur, et le cadre qui ne répond pas ----

function fauxCadre(fichier, demo, adresse = `http://localhost:8123/design-system/exemples/${fichier}#${demo}`) {
  const vue = {
    style: {},
    contentWindow: { location: { href: adresse } },
    ecouteurs: {},
    addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); },
    declencher(type) { for (const f of this.ecouteurs[type] || []) f(); },
  };
  return {
    vue,
    dataset: { fichier, demo },
    innerHTML: '',
    querySelector: (s) => (s === '.ds-cadre__vue' ? vue : null),
  };
}

function fausseRacine(cadres) {
  return { querySelectorAll: (s) => (s === '.ds-cadre' ? cadres : []) };
}

function fausseFenetre() {
  const ecouteurs = {};
  const minuteurs = new Map();
  let suivant = 0;
  return {
    minuteurs,
    addEventListener(type, f) { (ecouteurs[type] ||= []).push(f); },
    setTimeout(f, ms) { suivant += 1; minuteurs.set(suivant, { f, ms }); return suivant; },
    clearTimeout(id) { minuteurs.delete(id); },
    // Le temps passe : tous les délais en attente arrivent à échéance.
    tic() { for (const [id, m] of [...minuteurs]) { minuteurs.delete(id); m.f(); } },
    envoyer(source, data) { for (const f of ecouteurs.message || []) f({ source, data }); },
    delais() { return [...minuteurs.values()].map((m) => m.ms); },
  };
}

test('brancherCadres donne au cadre la hauteur que l’exemple annonce', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), DELAI_CADRE, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, demo: 'variantes', hauteur: 212.4 });
  // Arrondi au pixel supérieur : un demi-pixel manquant ferait apparaître une barre de défilement.
  assert.equal(cadre.vue.style.height, '213px');
});

test('brancherCadres suit la hauteur quand l’exemple la réannonce', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), DELAI_CADRE, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 100 });
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 260 });
  assert.equal(cadre.vue.style.height, '260px');
});

test('le compte à rebours ne part qu’au chargement du cadre, jamais au branchement', () => {
  // `loading="lazy"` : un cadre en bas de page peut ne se charger que dans dix minutes.
  // Armer le délai au branchement l'aurait déclaré introuvable avant même qu'il soit demandé —
  // le faux diagnostic est pire que pas de diagnostic.
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), DELAI_CADRE, fenetre);
  assert.equal(fenetre.minuteurs.size, 0, 'un délai court avant que le cadre soit chargé');
  fenetre.tic();
  assert.equal(cadre.innerHTML, '');
  cadre.vue.declencher('load');
  assert.deepEqual(fenetre.delais(), [DELAI_CADRE]);
});

test('un cadre chargé mais muet est remplacé par un message qui le nomme', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('load');
  fenetre.tic();
  assert.match(cadre.innerHTML, /introuvable/i);
  assert.match(cadre.innerHTML, /exemples\/bouton\.html/);
});

test('un cadre qui a répondu n’est jamais remplacé', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('load');
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 120 });
  assert.equal(fenetre.minuteurs.size, 0, 'le délai devait être annulé par la réponse');
  fenetre.tic();
  assert.equal(cadre.innerHTML, '');
});

test('une réponse arrivée avant le chargement empêche quand même le message', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 120 });
  cadre.vue.declencher('load');
  fenetre.tic();
  assert.equal(cadre.innerHTML, '');
});

test('un « load » sur l’about:blank initial n’arme pas le compte à rebours', () => {
  // Firefox émet un `load` sur le document vide d'un cadre, avant même que l'adresse demandée
  // commence à charger. Armer dessus déclarerait introuvable un cadre qu'on n'a pas encore
  // cherché — le faux diagnostic, encore.
  const cadre = fauxCadre('bouton.html', 'variantes', 'about:blank');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('load');
  assert.equal(fenetre.minuteurs.size, 0, 'un délai court sur le document vide du cadre');
  fenetre.tic();
  assert.equal(cadre.innerHTML, '');
  // Le vrai chargement arrive ensuite, et là le délai part.
  cadre.vue.contentWindow.location.href = 'http://localhost:8123/design-system/exemples/bouton.html#variantes';
  cadre.vue.declencher('load');
  assert.deepEqual(fenetre.delais(), [1000]);
});

test('une erreur de chargement arme le compte à rebours même sans adresse lisible', () => {
  // `error` ne ment pas : le cadre a vraiment échoué. On n'y applique pas la garde d'about:blank.
  const cadre = fauxCadre('bouton.html', 'variantes', 'about:blank');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('error');
  fenetre.tic();
  assert.match(cadre.innerHTML, /introuvable/i);
});

test('un cadre en erreur réseau part aussi au compte à rebours', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('error');
  fenetre.tic();
  assert.match(cadre.innerHTML, /introuvable/i);
});

test('brancherCadres n’écoute que ses propres cadres', () => {
  // `message` arrive de n'importe quelle fenêtre : une publicité, une extension, une page
  // ouverte dans un autre onglet. Seule l'identité de la fenêtre émettrice fait foi.
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  cadre.vue.declencher('load');
  fenetre.envoyer({ etranger: true }, { marque: MARQUE_CADRE, hauteur: 9000 });
  assert.equal(cadre.vue.style.height, undefined);
  fenetre.tic();
  assert.match(cadre.innerHTML, /introuvable/i, 'un message étranger a fait passer le cadre pour vivant');
});

test('brancherCadres ignore un message qui ne porte pas la marque du cadre', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  for (const data of [null, undefined, 'coucou', 42, { hauteur: 300 }, { marque: 'autre-chose', hauteur: 300 }]) {
    fenetre.envoyer(cadre.vue.contentWindow, data);
  }
  assert.equal(cadre.vue.style.height, undefined);
});

test('brancherCadres refuse une hauteur qui n’est pas une mesure', () => {
  const cadre = fauxCadre('bouton.html', 'variantes');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([cadre]), 1000, fenetre);
  for (const hauteur of [0, -10, NaN, Infinity, '200', null]) {
    fenetre.envoyer(cadre.vue.contentWindow, { marque: MARQUE_CADRE, hauteur });
  }
  assert.equal(cadre.vue.style.height, undefined);
});

test('chaque cadre d’une page reçoit sa propre hauteur', () => {
  const a = fauxCadre('bouton.html', 'variantes');
  const b = fauxCadre('bouton.html', 'bloc');
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([a, b]), 1000, fenetre);
  fenetre.envoyer(b.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 80 });
  fenetre.envoyer(a.vue.contentWindow, { marque: MARQUE_CADRE, hauteur: 300 });
  assert.equal(a.vue.style.height, '300px');
  assert.equal(b.vue.style.height, '80px');
});

test('brancherCadres ne casse rien sans cadre, sans racine, ni sans iframe', () => {
  const fenetre = fausseFenetre();
  brancherCadres(fausseRacine([]), 1000, fenetre);
  brancherCadres(null, 1000, fenetre);
  const creux = { dataset: { fichier: 'x.html' }, innerHTML: '', querySelector: () => null };
  brancherCadres(fausseRacine([creux]), 1000, fenetre);
  fenetre.tic();
  assert.equal(creux.innerHTML, '');
});

// ---- cadre-enfant.js : le côté dans le cadre ----

test('les deux côtés du cadre emploient la même marque de message', () => {
  // Deux fichiers, une convention. Si elles divergent, plus aucun cadre ne prend sa hauteur.
  assert.equal(MARQUE_ENFANT, MARQUE_CADRE);
});

test('demoDe lit le fragment de l’adresse', () => {
  assert.equal(demoDe('#variantes'), 'variantes');
  assert.equal(demoDe('variantes'), 'variantes');
  assert.equal(demoDe('#quand-ne-pas'), 'quand-ne-pas');
  assert.equal(demoDe('#%C3%A9tats'), 'états');
  assert.equal(demoDe(''), '');
  assert.equal(demoDe('#'), '');
  assert.equal(demoDe(undefined), '');
});

function fauxDocExemple(cles) {
  const sections = cles.map((cle) => ({ dataset: { demo: cle }, style: {}, innerHTML: `<p>${cle}</p>` }));
  const ajoutes = [];
  return {
    sections,
    ajoutes,
    querySelectorAll: (s) => (s === '[data-demo]' ? sections : []),
    getElementById: (id) => ajoutes.find((e) => e.id === id) || null,
    createElement: () => ({
      id: '', className: '', textContent: '',
      remove() { ajoutes.splice(ajoutes.indexOf(this), 1); },
    }),
    body: { prepend: (e) => ajoutes.push(e), getBoundingClientRect: () => ({ height: 123.2 }) },
    documentElement: { getBoundingClientRect: () => ({ height: 100 }) },
  };
}

test('montrerDemo ne laisse voir que la démonstration demandée', () => {
  const doc = fauxDocExemple(['variantes', 'tailles', 'etats']);
  const r = montrerDemo(doc, 'tailles');
  assert.equal(r.trouvee, true);
  assert.deepEqual(doc.sections.map((s) => s.style.display), ['none', '', 'none']);
  assert.equal(doc.ajoutes.length, 0);
});

test('montrerDemo masque par le style, jamais par une classe que l’exemple devrait connaître', () => {
  // Un exemple ne charge pas la feuille du site : il n'y a aucune classe utilitaire
  // sur laquelle compter, et une section en `display: grid` ignorerait l'attribut `hidden`.
  const doc = fauxDocExemple(['a', 'b']);
  montrerDemo(doc, 'a');
  assert.equal(doc.sections[1].style.display, 'none');
});

test('sans fragment, l’exemple ouvert directement montre tout', () => {
  const doc = fauxDocExemple(['variantes', 'tailles']);
  const r = montrerDemo(doc, '');
  assert.equal(r.trouvee, true);
  assert.deepEqual(doc.sections.map((s) => s.style.display), ['', '']);
});

test('une démonstration demandée mais absente se dit, au lieu de rendre un cadre vide', () => {
  const doc = fauxDocExemple(['variantes']);
  const r = montrerDemo(doc, 'tailles');
  assert.equal(r.trouvee, false);
  assert.equal(doc.ajoutes.length, 1);
  assert.match(doc.ajoutes[0].textContent, /tailles/);
  assert.match(doc.ajoutes[0].textContent, /introuvable/i);
  // Et le message s'en va quand on demande une démonstration qui existe.
  montrerDemo(doc, 'variantes');
  assert.equal(doc.ajoutes.length, 0);
});

test('hauteurDe prend la plus grande mesure et arrondit au pixel supérieur', () => {
  assert.equal(hauteurDe(fauxDocExemple(['a'])), 124);
  assert.equal(hauteurDe({}), 0);
});

function fausseFenetreExemple(cles, hash = '#variantes') {
  const doc = fauxDocExemple(cles);
  const envoyes = [];
  const ecouteurs = {};
  const fenetre = {
    doc, envoyes, ecouteurs,
    document: doc,
    location: { hash, origin: 'http://localhost:8123' },
    addEventListener(type, f) { (ecouteurs[type] ||= []).push(f); },
    declencher(type) { for (const f of ecouteurs[type] || []) f(); },
    postMessage(message, cible) { envoyes.push({ message, cible }); },
  };
  fenetre.parent = { postMessage: (message, cible) => envoyes.push({ message, cible }) };
  return fenetre;
}

test('installer choisit la démonstration et annonce sa hauteur au parent', () => {
  const fenetre = fausseFenetreExemple(['variantes', 'tailles']);
  installer(fenetre);
  assert.deepEqual(fenetre.doc.sections.map((s) => s.style.display), ['', 'none']);
  assert.equal(fenetre.envoyes.length, 1);
  const { message, cible } = fenetre.envoyes[0];
  assert.equal(message.marque, MARQUE_CADRE);
  assert.equal(message.demo, 'variantes');
  assert.equal(message.hauteur, 124);
  // Le HTML de la section part avec la première annonce : c'est le code que la page montre,
  // extrait de ce qui est rendu, et non recopié à la main à côté.
  assert.equal(message.html, '<p>variantes</p>');
  assert.equal(cible, 'http://localhost:8123');
});

test('installer ne rogne que les blancs d’HTML aux bords du code envoyé, jamais une insécable', () => {
  // `trim()` retire aussi U+00A0 et U+202F, l'espace fine insécable de la typographie française.
  // Une section qui commencerait ou finirait par l'une d'elles la perdrait AVANT d'arriver au
  // formateur de la page. Latent aujourd'hui (les sections commencent par une balise), mais c'est
  // la même classe de bug que `formaterHtml`, fermée des deux côtés.
  const fenetre = fausseFenetreExemple(['variantes']);
  fenetre.doc.sections[0].innerHTML = '\n  \u202F<p>x</p>\u00A0\n  ';
  installer(fenetre);
  assert.equal(fenetre.envoyes[0].message.html, '\u202F<p>x</p>\u00A0');
  const autre = fausseFenetreExemple(['variantes']);
  autre.doc.sections[0].innerHTML = '\n   <p>x</p>\n  ';
  installer(autre);
  assert.equal(autre.envoyes[0].message.html, '<p>x</p>', 'les blancs ordinaires doivent toujours être rognés');
});

test('installer n’annonce rien de plus tant que la hauteur ne change pas', () => {
  const fenetre = fausseFenetreExemple(['variantes']);
  installer(fenetre);
  fenetre.declencher('resize');
  assert.equal(fenetre.envoyes.length, 1, 'une hauteur inchangée ne vaut pas un message');
});

test('installer réannonce quand la hauteur change', () => {
  const fenetre = fausseFenetreExemple(['variantes']);
  installer(fenetre);
  fenetre.doc.body.getBoundingClientRect = () => ({ height: 400 });
  fenetre.declencher('resize');
  assert.equal(fenetre.envoyes.length, 2);
  assert.equal(fenetre.envoyes[1].message.hauteur, 400);
  // Le HTML ne repart pas à chaque mesure : il n'a pas changé.
  assert.equal(fenetre.envoyes[1].message.html, undefined);
});

test('installer change de démonstration quand le fragment change', () => {
  const fenetre = fausseFenetreExemple(['variantes', 'tailles']);
  installer(fenetre);
  fenetre.location.hash = '#tailles';
  fenetre.declencher('hashchange');
  assert.deepEqual(fenetre.doc.sections.map((s) => s.style.display), ['none', '']);
  const dernier = fenetre.envoyes.at(-1).message;
  assert.equal(dernier.demo, 'tailles');
  assert.equal(dernier.html, '<p>tailles</p>');
});

test('un lien dans une démonstration ne fait pas apparaître les autres', () => {
  // Le défaut trouvé en relecture : un clic sur un `<a href="#…">` d'une démonstration vide
  // ou change le fragment, `hashchange` part, et le cadre se remettait à tout montrer — il
  // passait de 196 à 1004 px sous les yeux du lecteur. Les liens de démonstration sont le cas
  // courant de ce qui reste à documenter : onglets, fil d'Ariane, lignes cliquables.
  const fenetre = fausseFenetreExemple(['variantes', 'bloc'], '#bloc');
  installer(fenetre);
  assert.deepEqual(fenetre.doc.sections.map((s) => s.style.display), ['none', '']);

  for (const hash of ['', '#', '#/emprunts', '#haut', '#inexistante']) {
    fenetre.location.hash = hash;
    fenetre.declencher('hashchange');
    assert.deepEqual(fenetre.doc.sections.map((s) => s.style.display), ['none', ''],
      `le fragment « ${hash} » ne désigne aucune démonstration : le cadre doit garder la sienne`);
  }
});

test('un fragment étranger ne corrompt pas la démonstration annoncée', () => {
  // L'annonce suit ce qui est AFFICHÉ, pas l'adresse : sinon un fragment étranger ferait
  // repartir un message avec `demo: ''` et un `html` vide, que la Task 5 poserait dans le
  // bloc de code de la page.
  const fenetre = fausseFenetreExemple(['variantes', 'bloc'], '#bloc');
  installer(fenetre);
  fenetre.location.hash = '#/emprunts';
  fenetre.declencher('hashchange');
  fenetre.doc.body.getBoundingClientRect = () => ({ height: 300 });
  fenetre.declencher('resize');
  const dernier = fenetre.envoyes.at(-1).message;
  assert.equal(dernier.demo, 'bloc');
  assert.equal(dernier.hauteur, 300);
  assert.equal(dernier.html, undefined, 'le HTML ne doit repartir que lorsque la démonstration change');
});

test('installer ne parle pas au parent quand l’exemple est ouvert tout seul', () => {
  const fenetre = fausseFenetreExemple(['variantes']);
  fenetre.parent = fenetre;
  installer(fenetre);
  assert.equal(fenetre.envoyes.length, 0);
  // Et il fait quand même son travail de tri.
  assert.deepEqual(fenetre.doc.sections.map((s) => s.style.display), ['']);
});

test('installer vise une origine précise, et « * » seulement quand il n’y en a pas', () => {
  // Sur un fichier local, `location.origin` vaut la chaîne « null » et aucune origine
  // précise n'est acceptée ; le contenu est de la documentation publique, et c'est le
  // parent qui authentifie l'émetteur par l'identité de sa fenêtre.
  const fenetre = fausseFenetreExemple(['variantes']);
  fenetre.location.origin = 'null';
  installer(fenetre);
  assert.equal(fenetre.envoyes[0].cible, '*');
});

// ---- Le fichier d'exemple du bouton ----

test('l’exemple du bouton montre les quatre démonstrations annoncées', () => {
  const html = lireExemple('bouton.html');
  for (const demo of ['variantes', 'tailles', 'etats', 'bloc']) {
    assert.match(html, new RegExp(`<section data-demo="${demo}"`), `la démonstration « ${demo} » manque`);
  }
});

test('toutes les variantes de bouton du CSS sont montrées', () => {
  // La trame l'exige : tous les états et toutes les variantes qui existent dans le CSS.
  // Une variante ajoutée à `components.css` sans sa démonstration fait échouer ce test.
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  const variantes = new Set([...css.matchAll(/\.btn--([\w-]+)/g)].map((m) => m[1]));
  assert.ok(variantes.size >= 7, `${variantes.size} variantes repérées : le détecteur a cessé de chercher`);
  const html = lireExemple('bouton.html');
  for (const v of variantes) assert.match(html, new RegExp(`btn--${v}\\b`), `btn--${v} n’est pas montré`);
});

test('l’exemple du bouton charge la feuille des composants et le côté enfant du cadre', () => {
  const html = lireExemple('bouton.html');
  assert.match(html, /href="\.\.\/\.\.\/css\/components\.css"/);
  assert.match(html, /src="\.\.\/js\/cadre-enfant\.js"/);
  assert.match(html, /type="module"/);
});

test('un exemple ne charge pas la feuille du site : il montre l’application, pas le guide', () => {
  for (const f of fichiersExemples()) {
    assert.doesNotMatch(lireExemple(f), /site\.css/,
      `${f} charge site.css — un exemple montre le composant tel que l’application le rend, sans l’habillage du guide`);
  }
});

test('un exemple tire sa hauteur de son contenu, jamais de la fenêtre', () => {
  // Le cadre donne à l'exemple la hauteur que l'exemple annonce. Si l'exemple mesurait sa
  // hauteur sur la fenêtre (`100vh`, `height: 100%`), les deux se poursuivraient sans fin.
  // Un écran de téléphone se simule par une largeur, pas par une hauteur.
  for (const f of fichiersExemples()) {
    const style = [...lireExemple(f).matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(style, /\b(?:min-|max-)?height\s*:[^;]*(?:\d|\.)(?:vh|%)/,
      `${f} fixe une hauteur sur la fenêtre : le cadre et l’exemple se poursuivraient sans fin`);
  }
});

test('un exemple charge les polices avant ses feuilles et reste relatif', () => {
  for (const f of fichiersExemples()) {
    const html = lireExemple(f);
    const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
    assert.ok(famille >= 0, `${f} ne charge pas les polices dans la forme attendue`);
    assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'), `${f} : preconnect googleapis`);
    assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'), `${f} : preconnect gstatic`);
    assert.ok(famille < html.indexOf('href="../../css/tokens.css"'), `${f} : les polices passent avant nos feuilles`);
    // `data-href` n'est pas une adresse de ressource : c'est la route que l'outil écrit sur une ligne
    // de tableau (`/materiel/MDS-0029`), lue par son routeur. Seuls `src` et `href` nus comptent.
    assert.doesNotMatch(html, /(?<![\w-])(?:src|href)="\/[^/]/, `${f} : chemin absolu`);
  }
});

// ---- La page Bouton ----

const pageBouton = () => readFileSync(new URL('bouton.html', DOSSIER_COMPOSANTS), 'utf8');

test('la page Bouton porte les six ancres de la trame', () => {
  // Le test de la Task 10 balaiera tout le dossier ; celui-ci tient la page dès maintenant.
  const html = pageBouton();
  for (const ancre of ['a-quoi', 'exemple', 'variantes', 'code', 'quand-ne-pas', 'accessibilite']) {
    assert.match(html, new RegExp(`id="${ancre}"`), `section « ${ancre} » absente`);
  }
});

test('la page Bouton pose le chrome, un seul h1, et branche ses cadres', () => {
  const html = pageBouton();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /id="contenu"/);
  assert.match(html, /enteteHtml\('composants\/bouton\.html'\)/);
  assert.match(html, /sommaireHtml\('composants\/bouton\.html'\)/);
  assert.match(html, /piedHtml\('composants\/bouton\.html'\)/);
  assert.match(html, /brancherSommaire\(\)/);
  assert.match(html, /brancherCadres\(/);
});

test('la page Bouton nomme le manque de focus, et ne promet rien d’invérifiable', () => {
  // Le kit ne DESSINE aucun anneau pour `.btn` ; il ne le supprime pas non plus, donc celui du
  // navigateur s'affiche. Un trou nommé est une information ; un trou mal nommé est pire qu'un
  // trou masqué, parce que le lecteur le vérifie en trois secondes et n'y revient pas.
  const html = pageBouton();
  const debut = html.indexOf('id="accessibilite"');
  assert.ok(debut > 0);
  const section = html.slice(debut);
  assert.match(section, /focus/i);
  assert.match(section, /navigateur/i, 'la page doit dire que l’anneau affiché est celui du navigateur');
  assert.match(section, /correctifs-figma\.md/, 'le manque doit renvoyer au registre des correctifs');
  // Aucune invitation à constater une absence qui ne se produit pas.
  assert.doesNotMatch(section, /rien ne bouge|rien ne s’affiche|vous ne verrez rien|aucun focus visible/i,
    'la page affirme que rien ne s’affiche au clavier : c’est faux, l’anneau du navigateur est là');
});

test('le manque de focus est reporté dans le registre des correctifs, et bien décrit', () => {
  const registre = readFileSync(new URL('../docs/correctifs-figma.md', import.meta.url), 'utf8');
  const aFaire = registre.slice(registre.indexOf('## À faire'), registre.indexOf('## Divergences'));
  assert.match(aFaire, /focus/i, 'le manque de focus n’est pas en attente dans le registre');
  assert.match(aFaire, /\.btn/, 'le registre ne dit pas quelle classe est concernée');
  assert.match(aFaire, /navigateur/i, 'le registre doit dire que l’anneau du navigateur reste affiché');
  assert.doesNotMatch(aFaire, /aucun style de focus visible/i,
    'le registre répète l’affirmation fausse : le kit ne dessine pas d’anneau, il n’en supprime pas');
});

test('une démonstration n’emploie pas de lien bouche-trou', () => {
  // `href="#"` vide le fragment du cadre, et c'est aussi ce que la Task 5 recopierait dans le
  // code montré. Les liens d'une démonstration portent une adresse de la vraie application.
  for (const f of fichiersExemples()) {
    assert.doesNotMatch(lireExemple(f), /href="#"/,
      `${f} contient un href="#" : employez l’adresse que l’application écrit vraiment`);
  }
});

test('la largeur de téléphone est nommée une fois, et sert au cadre', () => {
  // Deux mécanismes « étroit » et la même valeur calculée dans deux fichiers, c'était deux
  // occasions de dériver. Un seul : le cadre, qui porte la largeur.
  const css = readFileSync(new URL('../design-system/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /--ds-cadre-telephone:\s*\d+px/, 'la largeur de téléphone n’est pas nommée dans le :root');
  assert.match(css, /\.ds-cadre--etroit\s*\{[^}]*var\(--ds-cadre-telephone\)/);
  for (const f of fichiersExemples()) {
    const style = [...lireExemple(f).matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    assert.doesNotMatch(style, /max-width/,
      `${f} se donne sa propre largeur : c’est le cadre qui la porte, par cadreHtml({ etroit: true })`);
  }
  // Et la page s'en sert pour la démonstration qui en a besoin.
  assert.match(pageBouton(), /demo: 'bloc'[^}]*etroit: true|etroit: true[^}]*demo: 'bloc'/);
});

test('le manque de focus est décrit tel qu’il est : non dessiné, et non supprimé', () => {
  // La page parle du kit entier, donc le test lit TOUTES les feuilles du dépôt, pas la seule
  // `components.css`. Deux affirmations à tenir, et elles sont différentes :
  //
  //   1. le dépôt ne dessine d'anneau que pour le champ de formulaire et la carte cliquable ;
  //   2. il n'en SUPPRIME aucun — pas un `outline: none`. L'anneau du navigateur est donc là.
  //
  // La première version de cette page confondait les deux et invitait le lecteur à tabuler
  // pour constater une absence qui ne se produit pas. Ce test empêche de l'écrire à nouveau.
  const feuilles = readdirSync(new URL('../css/', import.meta.url))
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ nom: f, css: readFileSync(new URL(f, new URL('../css/', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
  assert.ok(feuilles.length >= 4, `${feuilles.length} feuilles lues : le détecteur ne voit plus le dépôt`);

  const dessinees = [];
  for (const { nom, css } of feuilles) {
    for (const regle of css.matchAll(/([^{}]*:focus[^{}]*)\{([^}]*)\}/g)) {
      dessinees.push(regle[1].trim());
      assert.doesNotMatch(regle[2], /outline\s*:\s*(?:none|0)\b/,
        `${nom} supprime l’anneau de focus sur « ${regle[1].trim()} » : la page Bouton doit être réécrite, le manque n’est plus le même`);
    }
    assert.doesNotMatch(css, /outline\s*:\s*(?:none|0)\b/,
      `${nom} pose un outline: none : l’anneau du navigateur disparaît, et la page Bouton ne dit plus vrai`);
  }
  assert.deepEqual(dessinees.sort(), ['.input:focus, .select:focus, .textarea:focus', '.kpi--link:focus-visible'],
    'les règles de focus du dépôt ont changé : la page Bouton et docs/correctifs-figma.md doivent suivre');
});

test('la page Bouton charge les polices avant ses feuilles et reste relative', () => {
  const html = pageBouton();
  const famille = html.search(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*display=swap">/);
  assert.ok(famille >= 0, 'les polices ne sont pas chargées dans la forme attendue');
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.googleapis.com">'));
  assert.ok(html.includes('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'));
  assert.ok(famille < html.indexOf('href="../../css/tokens.css"'), 'les polices passent avant nos feuilles');
  assert.doesNotMatch(html, /(?:src|href)="\/[^/]/);
});

test('la page Bouton n’écrit aucune valeur de couleur en dur dans sa prose', () => {
  // Une page qui cite `#662483` ment le jour où le token change. Les valeurs viennent des
  // tokens ou sont mesurées à l'exécution.
  const html = pageBouton().replace(/<!--[\s\S]*?-->/g, '');
  assert.deepEqual([...html.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]), []);
});

test('toute classe de variante que la page nomme existe vraiment dans le CSS', () => {
  // Le code montré vient des cadres (`tests/ds-code.test.mjs`) ; ce que la prose de la page écrit
  // elle-même, ce sont des noms de classes dans des phrases. Aucune ne doit être inventée.
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  const html = pageBouton().replace(/<!--[\s\S]*?-->/g, '');
  const classes = new Set([...html.matchAll(/btn--[\w-]+/g)].map((m) => m[0]));
  assert.ok(classes.size > 0, 'la page ne nomme aucune variante de bouton');
  for (const c of classes) assert.match(css, new RegExp(`\\.${c}\\b`), `${c} n’existe pas dans components.css`);
});

test('la page Bouton ne pose pas d’étiquette en capitales au-dessus d’un titre', () => {
  // Le contrôle design l'interdit : une étiquette en capitales annonce un titre qui se suffit.
  const html = pageBouton();
  assert.doesNotMatch(html, /label-(?:caps|mini-caps)[^>]*>[^<]*<\/[a-z]+>\s*<h[1-6]/);
});

// ---- La feuille du site ----

test('la feuille du site habille le cadre sans y poser de fond coloré', () => {
  // Un fond coloré déclaré sur `.ds-cadre` exigerait son `--ds-discret` (garde-fou de
  // `ds-socle.test.mjs`) ; le cadre n'en a pas besoin, c'est l'exemple qui peint son fond.
  const css = readFileSync(new URL('../design-system/css/site.css', import.meta.url), 'utf8');
  assert.match(css, /\.ds-cadre\s*\{/);
  assert.match(css, /\.ds-cadre__vue\s*\{/);
  assert.match(css, /\.ds-cadre--etroit/);
});
