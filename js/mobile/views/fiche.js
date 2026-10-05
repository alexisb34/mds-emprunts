// js/mobile/views/fiche.js — fiche d’une référence : exemplaires et action selon le circuit.
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { now, formatOpenHours, formatHeure, returnHour } from '../../rules.js';
import { CIRCUITS, ITEM_STATES } from '../../models.js';
import { escapeHtml, badge, formatDate, formatTime } from '../../ui.js';
import { userLoans } from '../../actions/loans.js';
import { groupByReference, availability } from '../catalog.js';
import { setHeader } from '../layout.js';

const CIRCUIT_HELP = {
  self: (settings) => `Self-service : scannez l’étiquette de l’exemplaire au bureau des pédago (${formatOpenHours(settings)}). Retour le jour même avant ${formatHeure(returnHour(settings))}.`,
  salle: 'Ce matériel reste dans la salle photo : réservez un créneau pour l’utiliser.',
  valeur: 'Matériel sur réservation : la pédago vous le remet à l’heure prévue.',
};

function ctaHtml(group, reserved) {
  if (reserved) return `<div class="alert alert--info">Vous avez déjà réservé ce matériel (retrait le ${escapeHtml(formatDate(reserved.loan.debutPrevu))} à ${escapeHtml(formatTime(reserved.loan.debutPrevu))}).</div><a class="btn btn--secondary btn--block" href="#/emprunts">Voir ma réservation</a>`;
  const free = group.exemplaires.find((i) => i.etat === ITEM_STATES.DISPONIBLE);
  if (group.circuit === CIRCUITS.SALLE) return '<p class="body-sm">Disponible dans la salle photo.</p><a class="btn btn--primary btn--block" href="#/salle">Réserver la salle</a>';
  if (!free) return '<p class="body-sm text-secondary">Aucun exemplaire disponible pour le moment.</p>';
  if (group.circuit === CIRCUITS.SELF) return '<a class="btn btn--primary btn--block" href="#/scan">Scanner pour emprunter</a>';
  return `<a class="btn btn--primary btn--block" href="#/reserver/${escapeHtml(free.id)}">Réserver</a>`;
}

// Le texte d’aide d’un circuit ; celui du self-service cite les horaires réglés (`settings`).
function circuitHelp(circuit, settings) {
  const aide = CIRCUIT_HELP[circuit];
  return typeof aide === 'function' ? aide(settings) : (aide || '');
}

export function ficheHtml({ group, date, reserved = null, settings = null }) {
  const av = availability(group);
  const media = group.photoUrl ? `<img src="${escapeHtml(group.photoUrl)}" alt="">` : escapeHtml(group.nom[0] || '?');
  return `
    <div class="m-card">
      <div class="m-card__media">${media}</div>
      <div class="m-card__body">
        <span class="label-mini-caps text-secondary">${escapeHtml(group.categorie)}</span>
        <strong class="h6">${escapeHtml(group.nom)}</strong>
        <span class="m-card__meta">${badge(av.kind, av.value)}${av.text ? `<span class="body-tiny text-secondary">${escapeHtml(av.text)}</span>` : ''}${badge('circuit', group.circuit)}</span>
        <p class="body-sm text-secondary">${escapeHtml(circuitHelp(group.circuit, settings))}</p>
      </div>
    </div>
    <div class="card">
      <div class="card__header"><h3 class="card__title">Exemplaires</h3><span class="body-sm text-secondary">${group.total}</span></div>
      ${group.exemplaires.map((i) => `<div class="m-exemplaire"><span><strong>${escapeHtml(i.nom)}</strong><br><span class="body-tiny text-secondary">${escapeHtml(i.code)} · ${escapeHtml(i.localisation || '')}</span></span>${badge('item', i.etat)}</div>`).join('')}
    </div>
    <div class="m-cta">${ctaHtml(group, reserved)}</div>`;
}

export function ficheView(container, { reference }) {
  const render = () => {
    const group = groupByReference(store.items.list()).find((g) => g.reference === reference);
    if (!group) {
      setHeader({ title: 'Introuvable', back: '/catalogue' });
      container.innerHTML = `<div class="card error-card"><h2 class="h6">Matériel introuvable</h2><p class="body-sm text-secondary">${escapeHtml(reference)}</p></div>`;
      return;
    }
    setHeader({ title: group.nom, back: '/catalogue' });
    const mine = userLoans(auth.currentUserId(), now()).reservations.find((r) => r.item && r.item.reference === reference) || null;
    container.innerHTML = ficheHtml({ group, date: now(), reserved: mine, settings: store.settings.get() });
  };
  render();
  return store.subscribe(render);
}
