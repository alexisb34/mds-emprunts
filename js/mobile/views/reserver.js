// js/mobile/views/reserver.js — réservation d’un exemplaire de matériel de valeur.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, addDays, ymd, fromYmd, isWeekday, withDefaults } from '../../rules.js';
import { escapeHtml, badge, formatTime, toast } from '../../ui.js';
import { reserveValeur } from '../../actions/loans.js';
import { setHeader } from '../layout.js';

// Heures entières de retrait proposées : celles de chaque plage d’ouverture des réglages
// ([{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }] → 8, 9, 10, 11, 13, 14, 15, 16).
export function openHours(settings) {
  const heures = [];
  for (const { debut, fin } of withDefaults(settings).horaires) {
    for (let h = debut; h < fin; h += 1) heures.push(h);
  }
  return heures;
}

// Horizon de réservation : 60 jours ; le jour même est permis par les règles.
export function defaultDates(date, dureeMax) {
  // Le retrait doit tomber un jour ouvré : on propose le prochain, pas simplement demain.
  let d = addDays(date, 1);
  while (!isWeekday(d)) d = addDays(d, 1);
  const debut = ymd(d);
  return { debut, fin: debut, min: ymd(date), max: ymd(addDays(date, 60)) };
}

export function reserverHtml({ item, dates, dureeMax, fenetreMinutes, heures = openHours({}) }) {
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">${escapeHtml(item.nom)}</h2>${badge('circuit', item.circuit)}</div>
      <p class="body-sm text-secondary">${escapeHtml(item.code)} · ${escapeHtml(item.localisation || '')}</p>
    </div>
    <div class="card">
      <div class="stack">
        <label class="field"><span class="field__label">Date de retrait</span><input class="input" type="date" name="debut" value="${escapeHtml(dates.debut)}" min="${escapeHtml(dates.min)}" max="${escapeHtml(dates.max)}"></label>
        <label class="field"><span class="field__label">Heure de retrait</span><select class="select" name="heure">${heures.map((h) => `<option value="${h}"${h === 9 ? ' selected' : ''}>${h}h00</option>`).join('')}</select></label>
        <label class="field"><span class="field__label">Date de retour</span><input class="input" type="date" name="fin" value="${escapeHtml(dates.fin)}" min="${escapeHtml(dates.min)}" max="${escapeHtml(dates.max)}"></label>
        <label class="field"><span class="field__label">Motif (visible par la pédago)</span><textarea class="textarea" name="motif" placeholder="Tournage du projet MBA 2"></textarea></label>
      </div>
    </div>
    <div class="alert alert--info">Le matériel se retire auprès de la pédago <strong>dans l’heure</strong> qui suit l’heure choisie (${fenetreMinutes} minutes) : passé ce délai, la réservation est annulée et le matériel redevient disponible. Durée maximale : ${dureeMax} jours.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-reserve">Confirmer la réservation</button>
    <a class="btn btn--ghost btn--block" href="#/catalogue/${escapeHtml(item.reference)}">Annuler</a>`;
}

export function readReserveForm(root) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  const heure = Number(value('heure'));
  return {
    debutPrevu: fromYmd(value('debut'), heure),
    finPrevue: fromYmd(value('fin'), 17),
    motif: value('motif'),
  };
}

export function reserverView(container, { id }) {
  const item = store.items.get(id);
  const settings = withDefaults(store.settings.get());
  if (!item) {
    setHeader({ title: 'Introuvable', back: '/catalogue' });
    container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(id)}</p></div>`;
    return undefined;
  }
  setHeader({ title: 'Réserver', back: `/catalogue/${item.reference}` });
  container.innerHTML = reserverHtml({
    item, dates: defaultDates(now(), settings.dureeMaxReservationJours),
    dureeMax: settings.dureeMaxReservationJours, fenetreMinutes: settings.fenetreRetraitMinutes,
    heures: openHours(settings),
  });
  container.querySelector('[data-action="confirm-reserve"]').addEventListener('click', () => {
    try {
      const loan = reserveValeur({ ...readReserveForm(container), itemId: item.id, userId: auth.currentUserId() });
      toast(`Réservé — à retirer le ${new Date(loan.debutPrevu).toLocaleDateString('fr-FR')} à ${formatTime(loan.debutPrevu)}`, 'success');
      navigate('/emprunts');
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  return undefined;
}
