// js/mobile/views/reserver.js — réservation d’une référence de matériel de valeur, à la
// demi-journée, avec une réponse immédiate sur la période choisie (spec §5.2).
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import {
  now, addDays, ymd, fromYmd, isWeekday, withDefaults, MOMENTS, halfDays, halfDayBounds, calendarDays,
  freeExemplaires, canReserveValeur, isOfficeOpen, formatHeure, reasonLabel, REASONS,
} from '../../rules.js';
import { escapeHtml, badge, formatDate, formatTime, toast } from '../../ui.js';
import { reserveValeur } from '../../actions/loans.js';
import { baseName } from '../catalog.js';
import { setHeader } from '../layout.js';

// Horizon de réservation : deux mois. Il borne à la fois les dates proposées au formulaire
// et le balayage de `prochaineDisponibilite` — un seul chiffre pour une seule promesse.
const HORIZON_JOURS = 60;

const MOMENT_MOTS = { [MOMENTS.MATIN]: 'matin', [MOMENTS.APRES_MIDI]: 'après-midi' };

// Les deux demi-journées proposées, étiquetées avec les heures RÉGLÉES : `halfDays` les tire
// de `settings.horaires`, donc modifier les horaires change les libellés.
export function momentOptions(settings) {
  const plages = halfDays(settings);
  return [
    { value: MOMENTS.MATIN, label: `Matin (${formatHeure(plages.matin.debut)}-${formatHeure(plages.matin.fin)})` },
    { value: MOMENTS.APRES_MIDI, label: `Après-midi (${formatHeure(plages.apres_midi.debut)}-${formatHeure(plages.apres_midi.fin)})` },
  ];
}

// La demi-journée où **commence** une période, lue sur son heure de début.
function momentDeDebut(d, settings) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= halfDays(settings).apres_midi.debut ? MOMENTS.APRES_MIDI : MOMENTS.MATIN;
}

// La demi-journée où **finit** une période, lue sur son heure de fin : une période qui
// s’arrête à la fermeture du matin clôt le matin, pas l’après-midi.
function momentDeFin(d, settings) {
  const h = d.getHours() + d.getMinutes() / 60;
  return h > halfDays(settings).matin.fin ? MOMENTS.APRES_MIDI : MOMENTS.MATIN;
}

// « le 12 nov. 2026 matin », « le 12 nov. 2026, matin et après-midi », ou
// « du 12 nov. 2026 matin au 13 nov. 2026 après-midi » — jamais la même date deux fois.
function periodeLabel({ debut, fin }, settings) {
  const mDebut = MOMENT_MOTS[momentDeDebut(debut, settings)];
  const mFin = MOMENT_MOTS[momentDeFin(fin, settings)];
  if (ymd(debut) === ymd(fin)) {
    return mDebut === mFin ? `le ${formatDate(debut)} ${mDebut}` : `le ${formatDate(debut)}, ${mDebut} et ${mFin}`;
  }
  return `du ${formatDate(debut)} ${mDebut} au ${formatDate(fin)} ${mFin}`;
}

// La demi-journée qui suit, en jours calendaires : le matin mène à l’après-midi du même jour,
// l’après-midi au matin du lendemain. Les jours fermés sont écartés plus loin par `isOfficeOpen`.
function demiJourneeSuivante({ jour, moment }) {
  if (moment === MOMENTS.MATIN) return { jour, moment: MOMENTS.APRES_MIDI };
  return { jour: ymd(addDays(fromYmd(jour), 1)), moment: MOMENTS.MATIN };
}

// Horizon de réservation : le jour même est permis par les règles.
export function defaultDates(date) {
  // Le retrait doit tomber un jour ouvré : on propose le prochain, pas simplement demain.
  let d = addDays(date, 1);
  while (!isWeekday(d)) d = addDays(d, 1);
  const debut = ymd(d);
  return { debut, fin: debut, min: ymd(date), max: ymd(addDays(date, HORIZON_JOURS)) };
}

// La première période où un exemplaire se libère : on fait glisser la période demandée
// demi-journée par demi-journée vers l’avant, sans changer sa longueur, jusqu’à en trouver une
// qui tienne. Balaie au plus deux mois ; au-delà, `null` — mieux vaut l’avouer que balayer sans fin.
// À n’appeler que sur un « complet sur la période » : en glissant, aucun autre refus ne se lèverait.
export function prochaineDisponibilite({ items, loans, reference, debut, fin, date, settings }) {
  const S = withDefaults(settings);
  let d = { jour: ymd(debut), moment: momentDeDebut(debut, S) };
  let f = { jour: ymd(fin), moment: momentDeFin(fin, S) };
  const limite = ymd(addDays(date, HORIZON_JOURS));
  // `AAAA-MM-JJ` se compare comme du texte dans l’ordre chronologique.
  while (d.jour <= limite) {
    d = demiJourneeSuivante(d);
    f = demiJourneeSuivante(f);
    // Le curseur de FIN se borne aussi : sans lui, l’écran nommait un retour que son propre
    // champ de date refuse (jusqu’à `dureeMaxReservationJours - 1` jours au-delà du `max`).
    // `f` ne précède jamais `d` et avance avec lui, donc s’arrêter là est juste.
    if (d.jour > limite || f.jour > limite) return null;
    const periode = {
      debut: halfDayBounds(d.jour, d.moment, S).debut,
      fin: halfDayBounds(f.jour, f.moment, S).fin,
    };
    // Un retrait hors ouverture (week-end, jour fermé) ne vaut rien, et un glissement qui fait
    // franchir un jour de plus à la période la rendrait trop longue : on passe à la suivante.
    if (!isOfficeOpen(periode.debut, S.horaires)) continue;
    // Le retour se rend en main propre : un jour fermé ne vaut pas mieux pour la fin que pour le début.
    if (!isWeekday(periode.fin)) continue;
    if (calendarDays(periode.debut, periode.fin) > S.dureeMaxReservationJours) continue;
    if (freeExemplaires({ items, loans, reference, debut: periode.debut, fin: periode.fin, date }).length) return periode;
  }
  return null;
}

// La ligne de réponse immédiate, sous les champs. `libres` et `reason` viennent tels quels du
// verdict de `canReserveValeur` : rien n’est recalculé ici.
export function disponibiliteHtml({ libres = [], reason = null, prochaine = null, settings = null }) {
  if (!reason) {
    const n = libres.length;
    const s = n > 1 ? 's' : '';
    return `<p class="alert alert--info">${n} exemplaire${s} libre${s} sur cette période.</p>`;
  }
  if (reason === REASONS.COMPLET_SUR_LA_PERIODE) {
    const suite = prochaine
      ? `Premier créneau libre : <strong>${escapeHtml(periodeLabel(prochaine, settings))}</strong>.`
      : `Aucun créneau de cette longueur dans les ${HORIZON_JOURS} prochains jours.`;
    return `<p class="alert alert--warning">${escapeHtml(reasonLabel(reason, settings))} ${suite}</p>`;
  }
  return `<p class="alert alert--error">${escapeHtml(reasonLabel(reason, settings))}</p>`;
}

const momentSelect = (name, moments, selected) => `<select class="select" name="${escapeHtml(name)}">${moments
  .map((m) => `<option value="${escapeHtml(m.value)}"${m.value === selected ? ' selected' : ''}>${escapeHtml(m.label)}</option>`)
  .join('')}</select>`;

export function reserverHtml({ group, dates, moments, dureeMax, fenetreMinutes, dispo = '' }) {
  return `
    <div class="card">
      <div class="card__header"><h2 class="card__title">${escapeHtml(group.nom)}</h2>${badge('circuit', group.circuit)}</div>
      <p class="body-sm text-secondary">${escapeHtml(group.reference)} · ${group.total} exemplaire${group.total > 1 ? 's' : ''}</p>
    </div>
    <div class="card">
      <div class="stack">
        <label class="field"><span class="field__label">Date de retrait</span><input class="input" type="date" name="debut" value="${escapeHtml(dates.debut)}" min="${escapeHtml(dates.min)}" max="${escapeHtml(dates.max)}"></label>
        <label class="field"><span class="field__label">Demi-journée de retrait</span>${momentSelect('momentDebut', moments, MOMENTS.MATIN)}</label>
        <label class="field"><span class="field__label">Date de retour</span><input class="input" type="date" name="fin" value="${escapeHtml(dates.fin)}" min="${escapeHtml(dates.min)}" max="${escapeHtml(dates.max)}"></label>
        <label class="field"><span class="field__label">Demi-journée de retour</span>${momentSelect('momentFin', moments, MOMENTS.APRES_MIDI)}</label>
        <label class="field"><span class="field__label">Motif (visible par la pédago)</span><textarea class="textarea" name="motif" placeholder="Tournage du projet MBA 2"></textarea></label>
      </div>
      <div data-role="dispo">${dispo}</div>
    </div>
    <div class="alert alert--info">Le matériel se retire auprès de la pédago dans les <strong>${fenetreMinutes} minutes</strong> qui suivent le début de la demi-journée de retrait : passé ce délai, la réservation est annulée et le matériel redevient disponible. Durée maximale : ${dureeMax} jours.</div>
    <button type="button" class="btn btn--primary btn--block" data-action="confirm-reserve">Confirmer la réservation</button>
    <a class="btn btn--ghost btn--block" href="#/catalogue/${escapeHtml(group.reference)}">Annuler</a>`;
}

// Le début est le début de la demi-journée de retrait, la fin est la FIN de celle de retour :
// une réservation couvre ses deux demi-journées, bornes comprises.
export function readReserveForm(root, settings) {
  const value = (name) => root.querySelector(`[name="${name}"]`).value;
  return {
    debutPrevu: halfDayBounds(value('debut'), value('momentDebut'), settings).debut,
    finPrevue: halfDayBounds(value('fin'), value('momentFin'), settings).fin,
    motif: value('motif'),
  };
}

export function reserverView(container, { reference }) {
  const settings = withDefaults(store.settings.get());
  const exemplaires = store.items.list((i) => i.reference === reference);
  if (!exemplaires.length) {
    setHeader({ title: 'Introuvable', back: '/catalogue' });
    container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(reference)}</p></div>`;
    return undefined;
  }
  setHeader({ title: 'Réserver', back: `/catalogue/${reference}` });
  container.innerHTML = reserverHtml({
    group: { nom: baseName(exemplaires[0].nom), reference, circuit: exemplaires[0].circuit, total: exemplaires.length },
    dates: defaultDates(now()),
    moments: momentOptions(settings),
    dureeMax: settings.dureeMaxReservationJours,
    fenetreMinutes: settings.fenetreRetraitMinutes,
  });
  const ligne = container.querySelector('[data-role="dispo"]');
  const bouton = container.querySelector('[data-action="confirm-reserve"]');
  // La réponse se recalcule à chaque changement de champ, sans validation ni appel réseau.
  const repondre = () => {
    const { debutPrevu, finPrevue } = readReserveForm(container, settings);
    const date = now();
    const items = store.items.list();
    const loans = store.loans.list();
    const verdict = canReserveValeur({
      reference, user: store.users.get(auth.currentUserId()), loans, items, settings, debutPrevu, finPrevue, date,
    });
    // On ne cherche une autre date que pour un « complet » : les autres refus (déjà un
    // exemplaire, retard, maintenance, hors service) ne se lèveraient pas en glissant, et
    // balayer deux mois pour conclure « aucune disponibilité » serait un mensonge.
    const prochaine = verdict.reason === REASONS.COMPLET_SUR_LA_PERIODE
      ? prochaineDisponibilite({ items, loans, reference, debut: debutPrevu, fin: finPrevue, date, settings })
      : null;
    ligne.innerHTML = disponibiliteHtml({ libres: verdict.libres, reason: verdict.reason, prochaine, settings });
    bouton.disabled = !verdict.ok;
  };
  for (const name of ['debut', 'momentDebut', 'fin', 'momentFin']) {
    container.querySelector(`[name="${name}"]`).addEventListener('change', repondre);
  }
  repondre();
  bouton.addEventListener('click', () => {
    try {
      const loan = reserveValeur({ ...readReserveForm(container, settings), reference, userId: auth.currentUserId() });
      toast(`Réservé — à retirer le ${new Date(loan.debutPrevu).toLocaleDateString('fr-FR')} à ${formatTime(loan.debutPrevu)}`, 'success');
      navigate('/emprunts');
    } catch (e) {
      toast(e.message, 'error');
    }
  });
  return undefined;
}
