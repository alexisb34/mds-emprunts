// js/log.js — journal de traçabilité. Chaque mutation métier passe par logAction().
import { store } from './store.js';
import { now } from './rules.js';

export const ACTIONS = {
  ITEM_CREE: 'item.cree', ITEM_MODIFIE: 'item.modifie', ITEM_ETAT: 'item.etat',
  USER_CREE: 'user.cree', USER_MODIFIE: 'user.modifie', USER_DESACTIVE: 'user.desactive',
  LOAN_EMPRUNT: 'loan.emprunt', LOAN_RETOUR: 'loan.retour', LOAN_RESERVEE: 'loan.reservee',
  LOAN_REMISE: 'loan.remise', LOAN_REFUSEE: 'loan.refusee', LOAN_EXPIREE: 'loan.expiree',
  LOAN_ANNULEE: 'loan.annulee', LOAN_PROLONGEE: 'loan.prolongee',
  BOOKING_CREEE: 'booking.creee', BOOKING_ANNULEE: 'booking.annulee',
  BOOKING_ENTREE: 'booking.entree', BOOKING_SORTIE: 'booking.sortie',
  MAINT_SIGNALEMENT: 'maintenance.signalement', MAINT_INTERVENTION: 'maintenance.intervention', MAINT_CLOS: 'maintenance.clos',
  SETTINGS_MODIFIES: 'settings.modifies', DEMO_RESET: 'demo.reset',
};

export const ACTION_LABELS = {
  'item.cree': 'Matériel ajouté', 'item.modifie': 'Matériel modifié', 'item.etat': 'Changement d’état',
  'user.cree': 'Utilisateur ajouté', 'user.modifie': 'Utilisateur modifié', 'user.desactive': 'Utilisateur désactivé',
  'loan.emprunt': 'Emprunt', 'loan.retour': 'Retour', 'loan.reservee': 'Réservation',
  'loan.remise': 'Remise', 'loan.refusee': 'Réservation refusée', 'loan.expiree': 'Réservation expirée',
  'loan.annulee': 'Réservation annulée', 'loan.prolongee': 'Emprunt prolongé',
  'booking.creee': 'Salle réservée', 'booking.annulee': 'Réservation de salle annulée',
  'booking.entree': 'État des lieux d’entrée', 'booking.sortie': 'État des lieux de sortie',
  'maintenance.signalement': 'Signalement', 'maintenance.intervention': 'Intervention', 'maintenance.clos': 'Maintenance close',
  'settings.modifies': 'Paramètres modifiés', 'demo.reset': 'Données de démo réinitialisées',
};

const KNOWN = new Set(Object.values(ACTIONS));

export function logAction({ auteurId, action, itemId = null, loanId = null, bookingId = null, userId = null, detail = '' }) {
  if (!auteurId) throw new Error('logAction : auteurId obligatoire');
  if (!KNOWN.has(action)) throw new Error(`logAction : action inconnue (${action})`);
  return store.log.create({ date: now().toISOString(), auteurId, action, itemId, loanId, bookingId, userId, detail });
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date);

export function recentLog(limit = 20) {
  return store.log.list().sort(byDateDesc).slice(0, limit);
}

export function logForItem(itemId) {
  return store.log.list((e) => e.itemId === itemId).sort(byDateDesc);
}

export function logForUser(userId) {
  return store.log.list((e) => e.userId === userId || e.auteurId === userId).sort(byDateDesc);
}
