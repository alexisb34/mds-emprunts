// js/admin/demoClock.js — la carte « horloge de démonstration », partagée par le tableau
// de bord (où on la cherche en pleine démo) et l’écran Paramètres (spec §6).
import { auth } from '../auth.js';
import { isWeekday } from '../rules.js';
import { escapeHtml, badge, formatDateTime, openModal, toast } from '../ui.js';
import { setDemoClock, resetDemoData, toDatetimeLocal, fromDatetimeLocal } from '../actions/settings.js';

// Prochain jour ouvré à 9h (aujourd’hui si c’est un jour ouvré avant 9h).
export function nextOpenDay(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  if (d <= date) d.setDate(d.getDate() + 1);
  while (!isWeekday(d)) d.setDate(d.getDate() + 1);
  return d;
}

export function demoClockHtml({ date, horlogeDemo, status }) {
  return `
    <div class="card demo-clock">
      <div class="card__header">
        <h2 class="card__title">Horloge de démonstration</h2>
        ${horlogeDemo ? badge('derived', 'horloge_demo') : badge('derived', 'temps_reel')}
      </div>
      <p class="body-sm text-secondary">Maintenant : <strong>${escapeHtml(formatDateTime(date))}</strong></p>
      <div class="alert alert--${status.open ? 'info' : 'warning'}">${escapeHtml(status.text)}</div>
      <div class="demo-clock__row">
        <label class="field"><span class="field__label">Date et heure simulées</span><input class="input" type="datetime-local" name="horloge" value="${escapeHtml(toDatetimeLocal(date))}"></label>
        <button type="button" class="btn btn--primary" data-action="set-clock">Appliquer</button>
        <button type="button" class="btn btn--ghost" data-action="next-open" title="Prochain jour ouvré à 9h">Jour ouvré 9h</button>
        <button type="button" class="btn btn--ghost" data-action="real-clock"${horlogeDemo ? '' : ' disabled'}>Temps réel</button>
        <button type="button" class="btn btn--secondary" data-action="reset-demo" title="Recharge l’inventaire et les emprunts autour de la date ci-dessus">Régénérer les données</button>
      </div>
      <p class="body-tiny text-secondary">Les emprunts du jeu de démonstration sont calés sur la date de génération : après un grand saut dans le temps, régénérez les données pour retrouver un état cohérent.</p>
    </div>`;
}

// `root` : l’élément qui contient la carte. À rappeler après chaque rendu.
export function bindDemoClock(root, { date }) {
  const champ = () => root.querySelector('[name="horloge"]');
  const apply = (value) => {
    try {
      setDemoClock(value, auth.currentUserId());
      toast(value ? 'Horloge de démo appliquée' : 'Retour au temps réel', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  root.querySelector('[data-action="set-clock"]').addEventListener('click', () => {
    const value = fromDatetimeLocal(champ().value);
    if (!value) { toast('Date invalide.', 'error'); return; }
    apply(value);
  });
  root.querySelector('[data-action="next-open"]').addEventListener('click', () => apply(nextOpenDay(date)));
  root.querySelector('[data-action="real-clock"]').addEventListener('click', () => apply(null));
  root.querySelector('[data-action="reset-demo"]').addEventListener('click', () => {
    // La modale annonce `value || date` : c’est cette même date qu’on régénère, jamais l’horloge réelle.
    const value = fromDatetimeLocal(champ().value) || date;
    openModal({
      title: 'Régénérer les données de démonstration',
      body: `<p class="body-sm">L’inventaire, les emprunts, les réservations et le journal seront remplacés par un jeu neuf calé sur le ${escapeHtml(formatDateTime(value))}. Les photos prises pendant la démonstration seront perdues.</p>`,
      actions: [
        { label: 'Annuler', variant: 'ghost' },
        { label: 'Régénérer', variant: 'danger', onClick: () => {
          try {
            resetDemoData(value, auth.currentUserId());
            toast('Données de démonstration régénérées', 'success');
          } catch (e) {
            toast(e.message, 'error');
            return false;
          }
        } },
      ],
    });
  });
}
