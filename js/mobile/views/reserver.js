// js/mobile/views/reserver.js — réservation d’une référence de matériel de valeur sur la
// grille de la semaine, comme la salle photo (spec §5.2). Le matériel est retenu du premier
// au dernier créneau touché, même à cheval sur plusieurs jours.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { now, addDays, withDefaults, closingHour, canReserveValeur, formatHeure, reasonLabel, REASONS } from '../../rules.js';
import { escapeHtml, badge, formatTime, toast } from '../../ui.js';
import {
  buildItemWeekGrid, weekGridHtml, bindDayChecks, startOfWeek, weekLabel,
  togglePeriode, togglePeriodeJour, periodeContient, periodeBornes, etatJourPeriode,
} from '../../weekGrid.js';
import { reserveValeur } from '../../actions/loans.js';
import { baseName } from '../catalog.js';
import { setHeader, ICONS } from '../layout.js';
import { openingWeek } from './salle.js';

// Sous la grille : l’invitation tant que rien n’est choisi, le motif quand c’est refusé.
// Le nombre d’exemplaires libres ne s’écrit plus : la grille le montre, case par case.
export function disponibiliteHtml({ periode = null, reason = null, motifVide = false, settings = null }) {
  if (!periode) return '<p class="body-tiny text-secondary">Touchez un ou plusieurs créneaux : le matériel est retenu du premier au dernier.</p>';
  if (reason) {
    const ton = reason === REASONS.COMPLET_SUR_LA_PERIODE ? 'warning' : 'error';
    return `<p class="alert alert--${ton}">${escapeHtml(reasonLabel(reason, settings))}</p>`;
  }
  if (motifVide) return '<p class="body-tiny text-secondary">Indiquez le motif pour confirmer la réservation.</p>';
  return '';
}

export function reserverHtml({ group, grid, periode, semaine, dispo, motif, pretA, dureeMax, fermeture }) {
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">${escapeHtml(group.nom)}</h2>${badge('circuit', group.circuit)}</div>
      <p class="body-sm text-secondary">${escapeHtml(group.reference)} · ${group.total} exemplaire${group.total > 1 ? 's' : ''}</p>
    </div>
    <section class="card">
      <div class="card__header">
        <button type="button" class="btn btn--ghost btn--sm" data-action="prev-week" aria-label="Semaine précédente">←</button>
        <h2 class="card__title">${escapeHtml(weekLabel(semaine))}</h2>
        <button type="button" class="btn btn--ghost btn--sm" data-action="next-week" aria-label="Semaine suivante">→</button>
      </div>
      ${weekGridHtml({
    grid,
    estSelectionne: (jour, heure) => periodeContient(periode, jour, heure),
    etatJour: (jour) => etatJourPeriode(periode, grid, jour),
    coche: ICONS.check,
  })}
    </section>
    <div data-role="dispo">${dispo}</div>
    <label class="field"><span class="field__label">Motif (visible par la pédago) <span class="field__required" aria-hidden="true">*</span></span><textarea class="textarea" name="motif" placeholder="Tournage du projet MBA 2" required>${escapeHtml(motif)}</textarea></label>
    <div class="alert alert--info">Le matériel se retire au bureau des pédago <strong>le jour de la réservation</strong>, de l’heure prévue jusqu’à la fermeture (${escapeHtml(fermeture)}) : passé ce délai, la réservation est annulée et le matériel redevient disponible. Durée maximale : ${dureeMax} jours.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-reserve"${pretA ? '' : ' disabled'}>${ICONS.check}<span>Confirmer la réservation</span></button>
    <a class="btn btn--ghost btn--block" href="#/catalogue/${escapeHtml(group.reference)}">${ICONS.croix}<span>Annuler</span></a>`;
}

export function reserverView(container, { reference }) {
  const settings = withDefaults(store.settings.get());
  const exemplaires = store.items.list((i) => i.reference === reference);
  if (!exemplaires.length) {
    setHeader({ title: 'Introuvable', back: '/catalogue' });
    container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(reference)}</p></div>`;
    return undefined;
  }
  const group = { nom: baseName(exemplaires[0].nom), reference, circuit: exemplaires[0].circuit, total: exemplaires.length };
  let semaine = openingWeek(now());
  let periode = null;
  let motif = '';

  const render = () => {
    const date = now();
    const items = store.items.list();
    const loans = store.loans.list();
    const grid = buildItemWeekGrid({ date: semaine, reference, items, loans, settings, now: date });
    const bornes = periodeBornes(periode);
    // Le verdict complet (circuit, retard, exemplaire déjà détenu, durée) reste celui des
    // règles : la grille ne décide de rien, elle ne fait que proposer une période.
    const verdict = bornes
      ? canReserveValeur({ reference, user: store.users.get(auth.currentUserId()), loans, items, settings, ...bornes, date })
      : { ok: false, reason: null };
    const motifVide = !motif.trim();
    setHeader({ title: 'Réserver', back: `/catalogue/${reference}` });
    container.innerHTML = reserverHtml({
      group,
      grid,
      periode,
      semaine,
      dispo: disponibiliteHtml({ periode, reason: verdict.reason, motifVide, settings }),
      motif,
      pretA: verdict.ok && !motifVide,
      dureeMax: settings.dureeMaxReservationJours,
      fermeture: formatHeure(closingHour(settings)),
    });

    container.querySelectorAll('[data-slot]').forEach((b) => b.addEventListener('click', () => {
      const [jour, heure] = b.dataset.slot.split(':');
      periode = togglePeriode(periode, jour, Number(heure));
      render();
    }));
    bindDayChecks(container);
    container.querySelectorAll('[data-day-check]').forEach((c) => c.addEventListener('change', () => {
      periode = togglePeriodeJour(periode, grid, c.dataset.dayCheck);
      render();
    }));
    container.querySelector('[data-action="prev-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), -7); periode = null; render(); });
    container.querySelector('[data-action="next-week"]').addEventListener('click', () => { semaine = addDays(startOfWeek(semaine), 7); periode = null; render(); });
    // Le motif ne re-rend pas l’écran à chaque frappe : le champ garderait le focus, mais le
    // bouton doit suivre, donc on le dégrise à la main.
    const champMotif = container.querySelector('[name="motif"]');
    champMotif.addEventListener('input', () => {
      motif = champMotif.value;
      const bouton = container.querySelector('[data-action="confirm-reserve"]');
      bouton.disabled = !(verdict.ok && motif.trim());
      container.querySelector('[data-role="dispo"]').innerHTML = disponibiliteHtml({ periode, reason: verdict.reason, motifVide: !motif.trim(), settings });
    });
    container.querySelector('[data-action="confirm-reserve"]').addEventListener('click', () => {
      try {
        const loan = reserveValeur({ ...periodeBornes(periode), motif, reference, userId: auth.currentUserId() });
        toast(`Réservé — à retirer le ${new Date(loan.debutPrevu).toLocaleDateString('fr-FR')} à ${formatTime(loan.debutPrevu)}`, 'success');
        navigate('/emprunts/reservations');
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  };

  render();
  return undefined;
}
