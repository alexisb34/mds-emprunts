// js/rules.js — règles temporelles et d’éligibilité. Fonctions pures : elles reçoivent
// les données et la date en paramètres. Seule now() lit les settings du store.
import { store } from './store.js';
import { CIRCUITS, ITEM_STATES, LOAN_STATES, BOOKING_STATES } from './models.js';

export const DEFAULT_SETTINGS = {
  horaires: [{ debut: 8, fin: 12 }, { debut: 13, fin: 17 }],
  dureeMaxReservationJours: 7, // une semaine complète, bornes comprises (spec §5.2)
  fenetreRetraitMinutes: 60,
  bloquerSiRetard: true,
  horlogeDemo: null, // ISO string ou null = temps réel
  // `heureRetourSelf` n’a pas de défaut : absente, l’heure de retour se déduit des horaires (voir `returnHour`).
  salle: { heureDebut: 8, heureFin: 17 }, // créneaux 8 … 16 (16 = 16h-17h)
};

export const REASONS = {
  BUREAU_FERME: 'bureau_ferme',
  DEJA_UN_EXEMPLAIRE: 'deja_un_exemplaire',
  INDISPONIBLE: 'indisponible',
  EMPRUNTE_PAR_AUTRE: 'emprunte_par_autre',
  EN_MAINTENANCE: 'en_maintenance',
  HORS_SERVICE: 'hors_service',
  RETARD_EN_COURS: 'retard_en_cours',
  MAUVAIS_CIRCUIT: 'mauvais_circuit',
  DUREE_TROP_LONGUE: 'duree_trop_longue',
  UTILISATEUR_INACTIF: 'utilisateur_inactif',
  CODE_INCONNU: 'code_inconnu',
  CODE_RETRAIT_INCONNU: 'code_retrait_inconnu',
  FENETRE_RETRAIT: 'fenetre_retrait',
  DATE_PASSEE: 'date_passee',
  DATES_INCOHERENTES: 'dates_incoherentes',
  HORS_OUVERTURE: 'hors_ouverture',
  RENDU_A_LA_PEDAGO: 'rendu_a_la_pedago',
  CRENEAU_VIDE: 'creneau_vide',
  CRENEAUX_NON_CONTIGUS: 'creneaux_non_contigus',
  COMPLET_SUR_LA_PERIODE: 'complet_sur_la_periode',
  RESERVE_SUR_LA_PERIODE: 'reserve_sur_la_periode',
  CRENEAU_OCCUPE: 'creneau_occupe',
  CRENEAU_PASSE: 'creneau_passe',
  SALLE_FERMEE: 'salle_fermee',
};

// Les messages qui citent des horaires : un seul gabarit, rempli avec les horaires RÉGLÉS par `reasonLabel`
// et avec les valeurs par défaut dans `REASON_LABELS` (le repli sans réglages ne peut donc pas diverger).
function horsOuvertureLabel(settings) {
  return `Le retrait doit tomber pendant les heures d’ouverture du bureau (jours ouvrés, ${formatOpenHours(settings)}).`;
}

function salleFermeeLabel(settings) {
  const { heureDebut, heureFin } = openRoomHours(settings);
  return `La salle photo est ouverte du lundi au vendredi, de ${formatHeure(heureDebut)} à ${formatHeure(heureFin)}.`;
}

export const REASON_LABELS = {
  bureau_ferme: 'Le bureau des pédago est fermé : retrait possible uniquement aux heures d’ouverture.',
  deja_un_exemplaire: 'Vous avez déjà un exemplaire de ce matériel (emprunt ou réservation en cours).',
  indisponible: 'Ce matériel n’est pas disponible actuellement.',
  emprunte_par_autre: 'Ce matériel est déjà emprunté par quelqu’un d’autre.',
  en_maintenance: 'Ce matériel est en maintenance.',
  hors_service: 'Ce matériel est hors service.',
  retard_en_cours: 'Vous avez un emprunt en retard : rendez-le avant d’emprunter à nouveau.',
  mauvais_circuit: 'Ce matériel ne s’emprunte pas de cette façon.',
  duree_trop_longue: 'La durée demandée dépasse le maximum autorisé.',
  utilisateur_inactif: 'Ce compte est désactivé.',
  code_inconnu: 'Code non reconnu : scannez l’étiquette MDS-XXXX collée sur l’objet.',
  code_retrait_inconnu: 'Aucune réservation en attente ne correspond à ce code de retrait.',
  fenetre_retrait: 'Hors de la fenêtre de retrait : le matériel se retire dans l’heure qui suit le début de la réservation.',
  date_passee: 'La date de début est déjà passée.',
  dates_incoherentes: 'La date de retour doit être postérieure à la date de retrait.',
  hors_ouverture: horsOuvertureLabel(DEFAULT_SETTINGS),
  rendu_a_la_pedago: 'Ce matériel se rend directement à la pédago, qui vérifie son état.',
  creneau_vide: 'Choisissez au moins un créneau.',
  creneaux_non_contigus: 'Les créneaux doivent se suivre sans interruption.',
  complet_sur_la_periode: 'Aucun exemplaire n’est libre sur cette période.',
  reserve_sur_la_periode: 'Cet exemplaire est réservé par quelqu’un d’autre sur la période demandée.',
  creneau_occupe: 'Un de ces créneaux est déjà réservé.',
  creneau_passe: 'Ce créneau est déjà passé.',
  salle_fermee: salleFermeeLabel(DEFAULT_SETTINGS),
};

export const UNAVAILABLE_REASON = {
  emprunte: REASONS.EMPRUNTE_PAR_AUTRE,
  maintenance: REASONS.EN_MAINTENANCE,
  hs: REASONS.HORS_SERVICE,
};

// Fusionne des settings partiels avec les défauts : toute fonction qui reçoit des
// `settings` incomplets (formulaire en cours, tests) reste utilisable sans planter.
export function withDefaults(settings) {
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

// Les horaires viennent des réglages, que la pédago peut modifier : une liste absente,
// vide ou mal formée retombe sur la valeur par défaut plutôt que de fermer le bureau pour toujours.
export function openHours(settings) {
  const brut = (settings && settings.horaires) || null;
  const parDefaut = () => DEFAULT_SETTINGS.horaires.map((r) => ({ ...r }));
  if (!Array.isArray(brut) || !brut.length) return parDefaut();
  const plages = brut.filter((r) => r && Number.isFinite(Number(r.debut)) && Number.isFinite(Number(r.fin)) && Number(r.debut) < Number(r.fin))
    .map((r) => ({ debut: Number(r.debut), fin: Number(r.fin) }));
  return plages.length ? plages : parDefaut();
}

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
// Une date seule « AAAA-MM-JJ » est interprétée en heure locale, comme dans ui.js.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const toDate = (d) => {
  if (d instanceof Date) return d;
  const m = DATE_ONLY_RE.exec(String(d));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
};

export function now(settings) {
  const s = withDefaults(settings || store.settings.get());
  return s.horlogeDemo ? new Date(s.horlogeDemo) : new Date();
}

export function isWeekday(date) {
  const w = toDate(date).getDay();
  return w >= 1 && w <= 5;
}

export function isOfficeOpen(date, horaires) {
  const h0 = openHours({ horaires });
  const d = toDate(date);
  if (!isWeekday(d)) return false;
  const h = d.getHours() + d.getMinutes() / 60;
  return h0.some((r) => h >= r.debut && h < r.fin);
}

// Les heures réglées, écrites comme on les lit : « 8h-12h et 13h-17h », « 9h30-12h ».
export function formatHeure(h) {
  const entier = Math.floor(h);
  const minutes = Math.round((h - entier) * 60);
  return minutes ? `${entier}h${String(minutes).padStart(2, '0')}` : `${entier}h`;
}

// Les heures de la salle réglées ; une valeur absente ou mal formée retombe sur la valeur par défaut.
export function openRoomHours(settings) {
  const salle = (settings && settings.salle) || {};
  const heureDebut = Number(salle.heureDebut);
  const heureFin = Number(salle.heureFin);
  return Number.isFinite(heureDebut) && Number.isFinite(heureFin) && heureDebut < heureFin
    ? { heureDebut, heureFin }
    : { ...DEFAULT_SETTINGS.salle };
}

export function formatOpenHours(settings) {
  return openHours(settings).map((r) => `${formatHeure(r.debut)}-${formatHeure(r.fin)}`).join(' et ');
}

// Le message d’un refus. `hors_ouverture`, `bureau_ferme` et `salle_fermee` citent les horaires RÉGLÉS ;
// les autres gardent le texte figé de REASON_LABELS.
export function reasonLabel(reason, settings = null) {
  if (!settings) return REASON_LABELS[reason] || '';
  if (reason === REASONS.HORS_OUVERTURE) return horsOuvertureLabel(settings);
  if (reason === REASONS.BUREAU_FERME) {
    return `Le bureau de la pédagogie est fermé (jours ouvrés, ${formatOpenHours(settings)}) : le self-service reprendra à l’ouverture.`;
  }
  if (reason === REASONS.SALLE_FERMEE) return salleFermeeLabel(settings);
  return REASON_LABELS[reason] || '';
}

export function atHour(date, hour, minute = 0) {
  const d = new Date(toDate(date));
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(toDate(date));
  d.setDate(d.getDate() + n);
  return d;
}

export function ymd(date) {
  const d = toDate(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromYmd(s, hour = 0) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

// L’heure limite de retour d’un emprunt self : une valeur enregistrée dans les réglages l’emporte ;
// sinon, la dernière fermeture des horaires réglés (un retour dû après la fermeture n’aurait aucun sens).
export function returnHour(settings) {
  const brut = settings ? settings.heureRetourSelf : null;
  if (brut !== null && brut !== undefined && brut !== '' && Number.isFinite(Number(brut))) return Number(brut);
  return Math.max(...openHours(settings).map((r) => r.fin));
}

export function selfReturnDeadline(date, heureRetourSelf = returnHour(null)) {
  const entier = Math.floor(heureRetourSelf);
  return atHour(date, entier, Math.round((heureRetourSelf - entier) * 60));
}

// Jours calendaires d’une période, bornes comprises — la mesure de `dureeMaxReservationJours`.
// `Math.round` absorbe la journée de 25 heures du passage à l’heure d’hiver ; `ceil` compterait
// un jour de trop et refuserait une période légale. La différence de deux minuits LOCAUX ne
// porte qu’un écart de décalages, jamais leur somme : l’erreur ne croît donc pas avec la durée.
// **Suppose `fin >= debut`** : sur une période inversée le compte est négatif, donc plus petit
// que tout maximum — vérifiez la cohérence des dates AVANT d’appeler cette fonction, comme le
// font `canReserveValeur` et l’écran de réservation.
export function calendarDays(debut, fin) {
  return Math.round((fromYmd(ymd(fin)) - fromYmd(ymd(debut))) / DAY) + 1;
}

export const MOMENTS = { MATIN: 'matin', APRES_MIDI: 'apres_midi' };

// Les deux demi-journées se déduisent des horaires réglés : matin = première plage,
// après-midi = seconde. Avec une seule plage, l’après-midi en est la seconde moitié —
// « demi-journée » doit garder un sens même si la pédago range tout en une plage.
export function halfDays(settings) {
  const plages = openHours(settings);
  const matin = plages[0];
  if (plages.length > 1) return { matin: { ...matin }, apres_midi: { ...plages[plages.length - 1] } };
  const milieu = (matin.debut + matin.fin) / 2;
  return { matin: { debut: matin.debut, fin: milieu }, apres_midi: { debut: milieu, fin: matin.fin } };
}

// Les bornes d’une demi-journée, en heure LOCALE : `fromYmd` lit une date seule sans
// glisser d’un jour selon le fuseau.
export function halfDayBounds(jour, moment, settings) {
  const plage = halfDays(settings)[moment === MOMENTS.APRES_MIDI ? 'apres_midi' : 'matin'];
  // Une plage de largeur impaire coupe la journée à la demi-heure (8h → 15h donne 11h30) :
  // `fromYmd(jour, 11.5)` tronquerait à 11h et mentirait sur l’étiquette affichée.
  const aHeure = (h) => { const entier = Math.floor(h); return atHour(fromYmd(jour), entier, Math.round((h - entier) * 60)); };
  return { debut: aHeure(plage.debut), fin: aHeure(plage.fin) };
}

const OCCUPANTS = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

// Un emprunt occupe-t-il son exemplaire sur [debut, fin[ ? Les bornes sont jointives :
// une réservation qui finit à 17h n’empêche pas celle qui commence à 17h.
// Un emprunt en retard occupe tout l’avenir : l’objet est dehors, et nul ne sait quand il rentre.
export function occupiesWindow(loan, debut, fin, date) {
  if (!OCCUPANTS.includes(loan.statut)) return false;
  const lDebut = toDate(loan.debutPrevu);
  const lFin = toDate(loan.finPrevue);
  const chevauche = lDebut < toDate(fin) && toDate(debut) < lFin;
  if (loan.statut === LOAN_STATES.EN_COURS && toDate(date) > lFin) return chevauche || toDate(fin) > toDate(date);
  return chevauche;
}

// Les exemplaires d’une référence réellement disponibles sur une période. C’est ici que se
// joue la correction : un objet réservé en novembre reste libre pour octobre.
export function freeExemplaires({ items, loans, reference, debut, fin, date, ignoreLoanId = null }) {
  const presents = items.filter((i) => i.reference === reference
    && i.etat !== ITEM_STATES.MAINTENANCE && i.etat !== ITEM_STATES.HS);
  return presents.filter((item) => !loans.some((l) => l.itemId === item.id
    && l.id !== ignoreLoanId
    && occupiesWindow(l, debut, fin, date)));
}

// ---- Emprunts ----

export function isLate(loan, date) {
  return loan.statut === LOAN_STATES.EN_COURS && toDate(date) > new Date(loan.finPrevue);
}

export function pickupWindow(loan, fenetreRetraitMinutes = DEFAULT_SETTINGS.fenetreRetraitMinutes) {
  const start = new Date(loan.debutPrevu);
  return { start, end: new Date(start.getTime() + fenetreRetraitMinutes * MIN) };
}

export function isInPickupWindow(loan, date, minutes) {
  const { start, end } = pickupWindow(loan, minutes);
  const d = toDate(date);
  return d >= start && d <= end;
}

export function isExpired(loan, date, minutes) {
  return loan.statut === LOAN_STATES.RESERVEE && toDate(date) > pickupWindow(loan, minutes).end;
}

// ---- Salle photo ----

export function bookingStart(b) {
  return fromYmd(b.date, Math.min(...b.creneaux));
}

export function bookingEnd(b) {
  return fromYmd(b.date, Math.max(...b.creneaux) + 1);
}

export function isBookingActive(b, date) {
  if (b.statut === BOOKING_STATES.ANNULEE || b.statut === BOOKING_STATES.TERMINEE) return false;
  const d = toDate(date);
  return d >= bookingStart(b) && d < bookingEnd(b);
}

// Une sortie ne « manque » que pendant un créneau en cours : un créneau clos d’office par
// la pédago, ou jamais commencé (balayé par `closeDueBookings`), n’a plus de sortie à faire.
export function isExitMissing(b, date) {
  if (b.statut !== BOOKING_STATES.EN_COURS || b.etatSortie) return false;
  return toDate(date) > new Date(bookingEnd(b).getTime() + 60 * MIN);
}

export function slotsAreContiguous(creneaux) {
  if (!creneaux || creneaux.length === 0) return false;
  const s = [...creneaux].sort((a, b) => a - b);
  return s.every((v, i) => i === 0 || v === s[i - 1] + 1);
}

export function slotsInRoomHours(creneaux, salle = DEFAULT_SETTINGS.salle) {
  return creneaux.every((h) => Number.isInteger(h) && h >= salle.heureDebut && h < salle.heureFin);
}

export function slotsConflict(bookings, date, creneaux, ignoreId = null) {
  return bookings.some(
    (b) => b.id !== ignoreId
      && b.date === date
      && b.statut !== BOOKING_STATES.ANNULEE
      && b.creneaux.some((h) => creneaux.includes(h)),
  );
}

// ---- Tri ----

// Tri décroissant par une date métier (ISO), avec createdAt en départage ; jamais createdAt seul
// (horloge réelle) pour ordonner ce que l’utilisateur voit (horloge de démo).
export function sortByDateDesc(rows, pick) {
  return [...rows].sort((a, b) => (String(pick(b) || '').localeCompare(String(pick(a) || ''))) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

// ---- Éligibilité ----

const ACTIVE_LOAN_STATES = [LOAN_STATES.RESERVEE, LOAN_STATES.EN_COURS];

export function activeLoans(loans, userId) {
  return loans.filter((l) => l.userId === userId && ACTIVE_LOAN_STATES.includes(l.statut));
}

export function hasActiveLoanOfReference(loans, items, userId, reference) {
  const refOf = new Map(items.map((i) => [i.id, i.reference]));
  return activeLoans(loans, userId).some((l) => refOf.get(l.itemId) === reference);
}

export function userHasLateLoan(loans, userId, date) {
  return loans.some((l) => l.userId === userId && isLate(l, date));
}

function commonChecks({ item, user, loans, items, settings, date, circuit }) {
  const S = withDefaults(settings);
  if (!user || user.actif === false) return REASONS.UTILISATEUR_INACTIF;
  if (item.circuit !== circuit) return REASONS.MAUVAIS_CIRCUIT;
  if (hasActiveLoanOfReference(loans, items, user.id, item.reference)) return REASONS.DEJA_UN_EXEMPLAIRE;
  if (item.etat !== ITEM_STATES.DISPONIBLE) return UNAVAILABLE_REASON[item.etat] || REASONS.INDISPONIBLE;
  if (circuit === CIRCUITS.SELF && !isOfficeOpen(date, S.horaires)) return REASONS.BUREAU_FERME;
  if (S.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return REASONS.RETARD_EN_COURS;
  return null;
}

export function canBorrowSelf(ctx) {
  const reason = commonChecks({ ...ctx, circuit: CIRCUITS.SELF });
  return { ok: reason === null, reason };
}

export function canReserveValeur(ctx) {
  const { reference, user, loans, items, settings, debutPrevu, finPrevue, date, ignoreLoanId = null } = ctx;
  const S = withDefaults(settings);
  if (!user || user.actif === false) return { ok: false, reason: REASONS.UTILISATEUR_INACTIF };
  // En raisonnant sur la référence plutôt que sur un exemplaire, on perdrait la vérification
  // du circuit : sans elle, `#/reserver/multiprise` réserverait du self-service.
  const exemplaires = items.filter((i) => i.reference === reference);
  if (!exemplaires.length) return { ok: false, reason: REASONS.CODE_INCONNU };
  if (exemplaires.some((i) => i.circuit !== CIRCUITS.VALEUR)) return { ok: false, reason: REASONS.MAUVAIS_CIRCUIT };
  // Une référence dont tous les exemplaires sont immobilisés n’est pas « complète sur la période » :
  // aucune autre date n’y changerait rien, et le dire invite à chercher un créneau pour rien.
  if (!exemplaires.some((i) => i.etat !== ITEM_STATES.MAINTENANCE && i.etat !== ITEM_STATES.HS)) {
    const etat = exemplaires.some((i) => i.etat === ITEM_STATES.MAINTENANCE) ? ITEM_STATES.MAINTENANCE : ITEM_STATES.HS;
    return { ok: false, reason: UNAVAILABLE_REASON[etat] };
  }
  if (toDate(finPrevue) <= toDate(debutPrevu)) return { ok: false, reason: REASONS.DATES_INCOHERENTES };
  // Une période passée se refuse DANS le verdict, et non à l’écriture seulement : l’écran de
  // réservation doit pouvoir répondre sur la période choisie avant toute validation (spec §5.2).
  // Une fenêtre de retrait déjà close vaut une date passée : `expireDueLoans` la balaierait
  // au prochain rendu.
  const debutJour = toDate(debutPrevu);
  const aujourdhui = toDate(date);
  if (debutJour < new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate())) return { ok: false, reason: REASONS.DATE_PASSEE };
  if (new Date(debutJour.getTime() + S.fenetreRetraitMinutes * 60000) < aujourdhui) return { ok: false, reason: REASONS.DATE_PASSEE };
  if (!isOfficeOpen(debutPrevu, S.horaires)) return { ok: false, reason: REASONS.HORS_OUVERTURE };
  if (calendarDays(debutPrevu, finPrevue) > S.dureeMaxReservationJours) return { ok: false, reason: REASONS.DUREE_TROP_LONGUE };
  if (hasActiveLoanOfReference(loans, items, user.id, reference)) return { ok: false, reason: REASONS.DEJA_UN_EXEMPLAIRE };
  if (S.bloquerSiRetard && userHasLateLoan(loans, user.id, date)) return { ok: false, reason: REASONS.RETARD_EN_COURS };
  const libres = freeExemplaires({ items, loans, reference, debut: debutPrevu, fin: finPrevue, date, ignoreLoanId });
  if (!libres.length) return { ok: false, reason: REASONS.COMPLET_SUR_LA_PERIODE };
  // Le verdict rend l’exemplaire qu’il a trouvé : `reserveValeur` n’a pas à refaire le calcul,
  // et ne peut donc pas tomber sur un résultat différent du nôtre.
  return { ok: true, reason: null, libres };
}
