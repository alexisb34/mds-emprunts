import './helpers/storage.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';
import { buildSeed } from '../js/seed.js';
import { DEFAULT_SETTINGS } from '../js/rules.js';
import { officeStatus, updateSettings } from '../js/actions/settings.js';
import { usageHtml, settingsFormHtml, parametresHtml, readSettingsForm } from '../js/admin/views/parametres.js';

const NOW = new Date(2026, 8, 17, 10, 0);

beforeEach(() => {
  localStorage.clear();
  store.init(() => buildSeed(NOW));
  store.settings.update({ horlogeDemo: NOW.toISOString() });
});

test('usageHtml : jauge, pourcentage et taille lisible', () => {
  const html = usageHtml({ bytes: 1024 * 1024, budget: 5 * 1024 * 1024, percent: 20 });
  assert.match(html, /20 ?%/);
  assert.match(html, /1(,0)? Mo/);
  assert.match(html, /value="20"|style="[^"]*20%/, 'la jauge reflète le pourcentage');
});

test('usageHtml : alerte au-delà de 80 %', () => {
  assert.doesNotMatch(usageHtml({ bytes: 1, budget: 100, percent: 50 }), /alert--warning/);
  assert.match(usageHtml({ bytes: 90, budget: 100, percent: 90 }), /alert--warning/);
});

test('settingsFormHtml : les champs portent les valeurs courantes', () => {
  const html = settingsFormHtml({ ...DEFAULT_SETTINGS, dureeMaxReservationJours: 7, bloquerSiRetard: false });
  assert.match(html, /name="matinDebut"[^>]*value="8"/);
  assert.match(html, /name="matinFin"[^>]*value="12"/);
  assert.match(html, /name="apresMidiDebut"[^>]*value="13"/);
  assert.match(html, /name="apresMidiFin"[^>]*value="17"/);
  assert.match(html, /name="dureeMaxReservationJours"[^>]*value="7"/);
  assert.match(html, /name="fenetreRetraitMinutes"[^>]*value="60"/);
  assert.match(html, /name="bloquerSiRetard"(?![^>]*checked)/, 'la case suit le réglage');
  assert.match(html, /name="salleHeureDebut"[^>]*value="8"/);
  assert.match(html, /name="salleHeureFin"[^>]*value="17"/);
});

test('parametresHtml : les trois cartes et le bouton de réinitialisation', () => {
  const html = parametresHtml({
    settings: DEFAULT_SETTINGS, usage: { bytes: 10, budget: 100, percent: 10 },
    date: NOW, horlogeDemo: NOW.toISOString(), status: officeStatus(NOW, DEFAULT_SETTINGS),
  });
  assert.match(html, /Horloge de démonstration/);
  assert.match(html, /Règles d’emprunt/);
  assert.match(html, /Espace occupé/);
  assert.match(html, /data-action="save-settings"/);
  assert.match(html, /data-action="reset-demo"/);
});

test('settingsFormHtml : une liste d’horaires cassée n’empêche pas d’afficher le formulaire', () => {
  const html = settingsFormHtml({ ...DEFAULT_SETTINGS, horaires: null });
  assert.match(html, /name="matinDebut"[^>]*value="8"/);
  assert.match(html, /name="matinFin"[^>]*value="12"/);
  assert.match(html, /name="apresMidiDebut"[^>]*value="13"/);
  assert.match(html, /name="apresMidiFin"[^>]*value="17"/);
  assert.doesNotThrow(() => settingsFormHtml({ horaires: [{ debut: 9, fin: 12 }] }), 'une seule plage');
});

test('settingsFormHtml : des heures de salle absentes ou cassées n’empêchent pas d’ouvrir l’écran', () => {
  for (const salle of [null, undefined, {}, { heureDebut: 17, heureFin: 8 }, { heureDebut: 'tôt', heureFin: 'tard' }]) {
    const html = settingsFormHtml({ ...DEFAULT_SETTINGS, salle });
    assert.match(html, /name="salleHeureDebut"[^>]*value="8"/, 'repli sur les heures par défaut');
    assert.match(html, /name="salleHeureFin"[^>]*value="17"/);
  }
});

// Un stub de `querySelector` suffit : `readSettingsForm` ne lit que `value` et `checked`.
function stubForm(values, checked = true) {
  return {
    querySelector: (sel) => {
      const name = sel.match(/name="(\w+)"/)[1];
      if (!(name in values) && name !== 'bloquerSiRetard') throw new TypeError(`champ inconnu : ${name}`);
      return { value: values[name], checked };
    },
  };
}
const VALEURS = {
  matinDebut: '9', matinFin: '12', apresMidiDebut: '13.5', apresMidiFin: '18',
  dureeMaxReservationJours: '7', fenetreRetraitMinutes: '45', salleHeureDebut: '9', salleHeureFin: '16',
};

test('readSettingsForm : les neuf champs prennent la forme que valide updateSettings', () => {
  assert.deepEqual(readSettingsForm(stubForm(VALEURS, true)), {
    horaires: [{ debut: 9, fin: 12 }, { debut: 13.5, fin: 18 }],
    dureeMaxReservationJours: 7,
    fenetreRetraitMinutes: 45,
    salle: { heureDebut: 9, heureFin: 16 },
    bloquerSiRetard: true,
  });
  assert.equal(readSettingsForm(stubForm(VALEURS, false)).bloquerSiRetard, false, 'la case se lit comme un booléen');
});

test('readSettingsForm : un champ vidé vaut NaN et updateSettings le refuse', () => {
  for (const champ of ['matinDebut', 'apresMidiDebut', 'salleHeureDebut', 'dureeMaxReservationJours', 'fenetreRetraitMinutes']) {
    const patch = readSettingsForm(stubForm({ ...VALEURS, [champ]: '' }));
    assert.throws(() => updateSettings(patch, 'user_041'), Error, `${champ} vide doit être refusé`);
  }
  assert.ok(Number.isNaN(readSettingsForm(stubForm({ ...VALEURS, matinDebut: '  ' })).horaires[0].debut), 'des espaces comptent comme vide');
  // Rien n’a été enregistré par les refus.
  assert.deepEqual(store.settings.get().horaires, DEFAULT_SETTINGS.horaires);
});
