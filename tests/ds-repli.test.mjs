// Le repli des trois pages qui se construisent elles-mêmes (logo, couleurs, ressources).
//
// Ces pages posent un message d'attente dans le HTML (`#repli`), puis le REMPLACENT quand leur
// contenu est prêt. Si une étape échoue après ce remplacement (brancher un export, copier un
// bloc), `#repli` n'existe plus : un `getElementById('repli').classList` levait alors une
// exception dans le `catch`, et la personne ne voyait ni message ni raison.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { montrerRepli } from '../design-system/js/repli.js';

const lire = (chemin) => readFileSync(new URL(`../design-system/${chemin}`, import.meta.url), 'utf8');

// Un document minimal : des éléments par id, une liste de classes, `prepend`, `append`, `createElement`.
const element = (id = '') => ({
  id, className: '', textContent: '', enfants: [],
  classList: { retirees: [], remove(c) { this.retirees.push(c); } },
  prepend(...e) { this.enfants.unshift(...e); },
  append(...e) { this.enfants.push(...e); },
});
function faussePage({ avecRepli }) {
  const elements = new Map([['contenu', element('contenu')]]);
  if (avecRepli) { elements.set('repli', element('repli')); elements.set('raison', element('raison')); }
  return { getElementById: (id) => elements.get(id) ?? null, createElement: () => element() };
}

test('montrerRepli : le message d’attente est encore là, il apparaît et dit la raison', () => {
  const doc = faussePage({ avecRepli: true });
  const sortie = montrerRepli(doc, new Error('le serveur répond 404'), 'Le logo n’a pas pu être lu');
  assert.equal(sortie, 'attente');
  assert.deepEqual(doc.getElementById('repli').classList.retirees, ['ds-message--attente']);
  assert.equal(doc.getElementById('raison').textContent,
    'Le logo n’a pas pu être lu (le serveur répond 404). Si vous avez ouvert ce fichier directement, ouvrez plutôt le site depuis un serveur : npm run serve.');
});

test('montrerRepli : le contenu a déjà remplacé le message, il en pose un nouveau au lieu de lever', () => {
  const doc = faussePage({ avecRepli: false });
  assert.equal(doc.getElementById('repli'), null);
  let sortie;
  assert.doesNotThrow(() => { sortie = montrerRepli(doc, new Error('brancherExports est indéfini'), 'Le logo n’a pas pu être lu'); });
  assert.equal(sortie, 'remplace');
  const [pose] = doc.getElementById('contenu').enfants;
  assert.ok(pose, 'aucun message n’a été posé dans le contenu');
  assert.equal(pose.id, 'repli');
  assert.equal(pose.className, 'ds-message');
  const raison = pose.enfants[0];
  assert.equal(raison.id, 'raison');
  // Le message ne prétend pas que le fichier n'a pas pu être lu : il a été lu, la suite a échoué.
  assert.doesNotMatch(raison.textContent, /pas pu être lu/);
  assert.match(raison.textContent, /brancherExports est indéfini/);
  assert.doesNotMatch(raison.textContent, /fichier directement/);
});

test('les trois pages passent par montrerRepli, et aucune ne suppose plus que #repli existe', () => {
  for (const f of ['logo.html', 'couleurs.html', 'ressources.html']) {
    const html = lire(f);
    const script = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
    assert.match(script, /import \{ montrerRepli \} from '\.\/js\/repli\.js';/, `${f} n’importe pas montrerRepli`);
    const apres = script.slice(script.indexOf('catch (erreur)'));
    assert.match(apres, /^catch \(erreur\) \{\s*montrerRepli\(document, erreur, '[^']+'\);\s*\}/, `${f} : le catch n’appelle pas montrerRepli`);
    assert.doesNotMatch(apres, /getElementById\('repli'\)/, `${f} : le catch lit encore #repli directement`);
    assert.doesNotMatch(apres, /\bthrow\b/, `${f} : une exception relancée laisserait la page sur son attente`);
    // Le message du HTML reste, pour le cas où le module ne se charge pas du tout (file://).
    assert.match(html, /id="repli"/);
    assert.match(html, /npm run serve/);
  }
});
