// js/models.js — constantes métier, transitions autorisées, libellés français.

export const ROLES = { ELEVE: 'eleve', INTERVENANT: 'intervenant', PEDAGO: 'pedago' };

export const PROMOS = [
  'MBA 2 UX/UI', 'MBA 2 DEV', 'MBA 2 DAD',
  'Bachelor 1', 'Bachelor 2', 'Bachelor 3',
  'MBA 1 UX/UI', 'MBA 1 DEV', 'MBA 1 DAD',
];

export const CIRCUITS = { SELF: 'self', SALLE: 'salle', VALEUR: 'valeur' };

export const CATEGORIES = ['Bureautique', 'Audio', 'Photo', 'Vidéo', 'Lumière', 'Stockage', 'Accessoire'];

export const ITEM_CODE_RE = /^MDS-(\d{4})$/;

export const ITEM_STATES = {
  DISPONIBLE: 'disponible', EMPRUNTE: 'emprunte', RESERVE: 'reserve', MAINTENANCE: 'maintenance', HS: 'hs',
};

export const LOAN_STATES = {
  RESERVEE: 'reservee', EN_COURS: 'en_cours', RETOURNEE: 'retournee',
  REFUSEE: 'refusee', EXPIREE: 'expiree', ANNULEE: 'annulee',
};

export const BOOKING_STATES = { A_VENIR: 'a_venir', EN_COURS: 'en_cours', TERMINEE: 'terminee', ANNULEE: 'annulee' };

export const MAINT_TYPES = {
  SIGNALEMENT: 'signalement', INTERNE: 'intervention_interne',
  EXTERNE: 'intervention_externe', REMISE_EN_SERVICE: 'remise_en_service',
};

export const MAINT_STATES = { OUVERT: 'ouvert', EN_COURS: 'en_cours', CLOS: 'clos' };

export const ITEM_TRANSITIONS = {
  disponible: ['reserve', 'emprunte', 'maintenance', 'hs'],
  reserve: ['disponible', 'emprunte', 'maintenance', 'hs'],
  emprunte: ['disponible', 'maintenance'],
  maintenance: ['disponible', 'hs'],
  hs: ['maintenance', 'disponible'],
};

export const LOAN_TRANSITIONS = {
  reservee: ['en_cours', 'refusee', 'expiree', 'annulee'],
  en_cours: ['retournee'],
  retournee: [], refusee: [], expiree: [], annulee: [],
};

export const BOOKING_TRANSITIONS = {
  a_venir: ['en_cours', 'annulee'],
  en_cours: ['terminee', 'annulee'],
  terminee: [], annulee: [],
};

export const MAINT_TRANSITIONS = {
  ouvert: ['en_cours', 'clos'],
  en_cours: ['clos'],
  clos: [],
};

export function canTransition(table, from, to) {
  return (table[from] || []).includes(to);
}

export function assertTransition(table, from, to, label) {
  if (!canTransition(table, from, to)) {
    throw new Error(`Transition ${label} interdite : ${from} → ${to}`);
  }
}

export const LABELS = {
  role: { eleve: 'Élève', intervenant: 'Intervenant', pedago: 'Pédagogie' },
  circuit: { self: 'Self-service', salle: 'Salle photo', valeur: 'Sur réservation' },
  itemState: { disponible: 'Disponible', emprunte: 'Emprunté', reserve: 'Réservé', maintenance: 'Maintenance', hs: 'Hors service' },
  loanState: { reservee: 'Réservé', en_cours: 'En cours', retournee: 'Retourné', refusee: 'Refusé', expiree: 'Expiré', annulee: 'Annulé' },
  bookingState: { a_venir: 'À venir', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' },
  maintType: { signalement: 'Signalement', intervention_interne: 'Intervention interne', intervention_externe: 'Intervention externe', remise_en_service: 'Remise en service' },
  maintState: { ouvert: 'Ouvert', en_cours: 'En cours', clos: 'Clos' },
  // Valeurs calculées (pas un statut stocké) affichées via `ui.badge`.
  derived: { en_retard: 'En retard', sortie_non_faite: 'Sortie non faite', actif: 'Actif', desactive: 'Désactivé', horloge_demo: 'Horloge simulée', temps_reel: 'Temps réel' },
};
