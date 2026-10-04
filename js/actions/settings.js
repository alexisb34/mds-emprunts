// js/actions/settings.js — réglages de la démonstration. L’horloge de démo décale le « maintenant »
// de toute l’application (règles, journaux, affichages) sans toucher aux données.
import { store } from '../store.js';
import { buildSeed } from '../seed.js';
import { withDefaults, isOfficeOpen, isWeekday } from '../rules.js';
import { logAction, ACTIONS } from '../log.js';
import { formatDateTime } from '../ui.js';

// Convertit une date en valeur d’<input type="datetime-local"> (heure locale, pas UTC).
export function toDatetimeLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Interprète la valeur d’un <input type="datetime-local"> comme une date locale.
export function fromDatetimeLocal(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

// Décrit l’état du bureau à une date donnée, pour l’afficher à la pédago.
export function officeStatus(date, settings) {
  const S = withDefaults(settings);
  if (isOfficeOpen(date, S.horaires)) return { open: true, text: 'Bureau ouvert : les emprunts en self-service sont possibles.' };
  const raison = isWeekday(date) ? 'hors des heures d’ouverture (8h-12h, 13h-17h)' : 'week-end';
  return { open: false, text: `Bureau fermé (${raison}) : les emprunts en self-service sont refusés, les retours restent possibles.` };
}

export function setDemoClock(date, auteurId) {
  const horlogeDemo = date ? (date instanceof Date ? date.toISOString() : String(date)) : null;
  if (horlogeDemo && Number.isNaN(new Date(horlogeDemo).getTime())) throw new Error('Date invalide.');
  store.settings.update({ horlogeDemo });
  logAction({
    auteurId, action: ACTIONS.SETTINGS_MODIFIES,
    detail: horlogeDemo ? `Horloge de démo : ${formatDateTime(horlogeDemo)}` : 'Horloge de démo : temps réel',
    userId: auteurId,
  });
  return store.settings.get();
}

// Recharge les données de démonstration en les reconstruisant autour de la date simulée,
// puis réapplique l’horloge : jeu de données et « maintenant » restent cohérents.
export function resetDemoData(date, auteurId) {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error('Date invalide.');
  const horlogeDemo = date ? d.toISOString() : null;
  store.reset(() => buildSeed(d));
  if (horlogeDemo) store.settings.update({ horlogeDemo });
  logAction({ auteurId, action: ACTIONS.DEMO_RESET, detail: `Données régénérées autour du ${formatDateTime(d)}` });
  return store.settings.get();
}
