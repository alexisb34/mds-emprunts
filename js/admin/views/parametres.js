// js/admin/views/parametres.js — réglages de la pédagogie : horaires et durées, horloge
// de démonstration, espace occupé et réinitialisation.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, withDefaults, openHours, openRoomHours } from '../../rules.js';
import { escapeHtml, toast } from '../../ui.js';
import { officeStatus, updateSettings } from '../../actions/settings.js';
import { demoClockHtml, bindDemoClock } from '../demoClock.js';
import { setTopbar } from '../layout.js';

const MO = 1024 * 1024;
const taille = (bytes) => (bytes >= MO ? `${(bytes / MO).toFixed(1).replace('.', ',')} Mo` : `${Math.round(bytes / 1024)} Ko`);

export function usageHtml(usage) {
  const alerte = usage.percent >= 80
    ? '<div class="alert alert--warning">L’espace du navigateur est presque plein : régénérez les données pour repartir d’un jeu léger (les photos de démonstration seront perdues).</div>'
    : '';
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Espace occupé</h2><span class="body-sm text-secondary">${usage.percent} %</span></div>
      <progress class="gauge" max="100" value="${usage.percent}"></progress>
      <p class="body-sm text-secondary">${escapeHtml(taille(usage.bytes))} sur ${escapeHtml(taille(usage.budget))} — les photos d’emprunt et de retour pèsent l’essentiel.</p>
      ${alerte}
    </div>`;
}

const nombre = (label, name, value, attrs = '') =>
  `<label class="field"><span class="field__label">${escapeHtml(label)}</span><input class="input" type="number" name="${name}" value="${escapeHtml(String(value))}"${attrs}></label>`;

export function settingsFormHtml(settings) {
  const S = withDefaults(settings);
  // `openHours` répare une liste absente ou mal formée : l’écran qui sert à corriger le réglage doit rester ouvrable.
  const plages = openHours(S);
  const [matin, apresMidi] = [plages[0] || { debut: 8, fin: 12 }, plages[1] || { debut: 13, fin: 17 }];
  // Même réparation pour les heures de la salle : un réglage `salle: null` ne doit pas fermer l’écran.
  const salle = openRoomHours(S);
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">Règles d’emprunt</h2></div>
      <div class="form-grid">
        ${nombre('Ouverture du matin', 'matinDebut', matin.debut, ' min="0" max="24" step="0.5"')}
        ${nombre('Fermeture du matin', 'matinFin', matin.fin, ' min="0" max="24" step="0.5"')}
        ${nombre('Ouverture de l’après-midi', 'apresMidiDebut', apresMidi.debut, ' min="0" max="24" step="0.5"')}
        ${nombre('Fermeture de l’après-midi', 'apresMidiFin', apresMidi.fin, ' min="0" max="24" step="0.5"')}
        ${nombre('Durée maximale d’une réservation (jours)', 'dureeMaxReservationJours', S.dureeMaxReservationJours, ' min="1" max="60" step="1"')}
        ${nombre('Fenêtre de retrait (minutes)', 'fenetreRetraitMinutes', S.fenetreRetraitMinutes, ' min="5" max="480" step="5"')}
        ${nombre('Premier créneau de la salle', 'salleHeureDebut', salle.heureDebut, ' min="0" max="23" step="1"')}
        ${nombre('Dernier créneau de la salle (fin)', 'salleHeureFin', salle.heureFin, ' min="1" max="24" step="1"')}
      </div>
      <label class="checkbox"><input type="checkbox" name="bloquerSiRetard"${S.bloquerSiRetard ? ' checked' : ''}> Empêcher d’emprunter quand une personne est en retard</label>
      <div class="form-actions"><button type="button" class="btn btn--primary" data-action="save-settings">Enregistrer</button></div>
    </div>`;
}

export function readSettingsForm(root) {
  // Un champ vidé vaut NaN, pas 0 : `Number('')` ferait passer 0 pour une heure valide.
  const num = (name) => {
    const v = root.querySelector(`[name="${name}"]`).value.trim();
    return v === '' ? NaN : Number(v);
  };
  return {
    horaires: [
      { debut: num('matinDebut'), fin: num('matinFin') },
      { debut: num('apresMidiDebut'), fin: num('apresMidiFin') },
    ],
    dureeMaxReservationJours: num('dureeMaxReservationJours'),
    fenetreRetraitMinutes: num('fenetreRetraitMinutes'),
    salle: { heureDebut: num('salleHeureDebut'), heureFin: num('salleHeureFin') },
    bloquerSiRetard: root.querySelector('[name="bloquerSiRetard"]').checked,
  };
}

export function parametresHtml({ settings, usage, date, horlogeDemo, status }) {
  return `
    ${demoClockHtml({ date, horlogeDemo, status })}
    <div class="grid-2">
      ${settingsFormHtml(settings)}
      ${usageHtml(usage)}
    </div>`;
}

export function parametresView(container) {
  // Un ré-rendu pendant la saisie écraserait les champs : on ne redessine pas
  // tant que le formulaire est modifié et non enregistré.
  let dirty = false;
  // Pendant la saisie, seule la carte horloge est redessinée : l’heure, l’état du bureau et le
  // « Jour ouvré 9h » (calculé depuis `date`) ne doivent pas rester figés sur le dernier rendu.
  const refreshClock = () => {
    const card = container.querySelector('.demo-clock');
    if (!card) return;
    const date = now();
    const settings = store.settings.get();
    const gabarit = document.createElement('div');
    gabarit.innerHTML = demoClockHtml({ date, horlogeDemo: settings.horlogeDemo || null, status: officeStatus(date, settings) });
    const fraiche = gabarit.firstElementChild;
    card.replaceWith(fraiche);
    bindDemoClock(fraiche, { date });
  };
  const render = () => {
    if (dirty) { refreshClock(); return; }
    const date = now();
    const settings = store.settings.get();
    setTopbar({ title: 'Paramètres', subtitle: 'Règles, horloge de démonstration et espace' });
    container.innerHTML = parametresHtml({
      settings, usage: store.usage(), date,
      horlogeDemo: settings.horlogeDemo || null, status: officeStatus(date, settings),
    });
    bindDemoClock(container, { date });
    container.querySelectorAll('input').forEach((el) => el.addEventListener('input', () => {
      if (el.name !== 'horloge') dirty = true;
    }));
    container.querySelector('[data-action="save-settings"]').addEventListener('click', () => {
      try {
        updateSettings(readSettingsForm(container), auth.currentUserId());
        dirty = false;
        toast('Réglages enregistrés', 'success');
        render();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  };
  render();
  return store.subscribe(render);
}
