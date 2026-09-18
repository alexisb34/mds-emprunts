// js/actions/users.js — mutations métier sur les utilisateurs (gestion par la pédago).
import { store } from '../store.js';
import { ROLES, PROMOS, LABELS, LOAN_STATES } from '../models.js';
import { isLate } from '../rules.js';
import { logAction, ACTIONS, logForUser } from '../log.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROTECTED_FIELDS = ['id', 'actif', 'createdAt', 'updatedAt'];

function normalize(data) {
  return {
    prenom: String(data.prenom || '').trim(),
    nom: String(data.nom || '').trim(),
    email: String(data.email || '').trim().toLowerCase(),
    role: data.role,
    promo: data.role === ROLES.ELEVE ? data.promo || null : null,
  };
}

export function validateUser(data, existingId = null) {
  const errors = [];
  const d = normalize(data);
  if (!d.prenom) errors.push('Le prénom est obligatoire.');
  if (!d.nom) errors.push('Le nom est obligatoire.');
  if (!EMAIL_RE.test(d.email)) errors.push('L’email est invalide.');
  if (!Object.values(ROLES).includes(d.role)) errors.push('Le rôle est invalide.');
  if (d.role === ROLES.ELEVE && !PROMOS.includes(d.promo)) errors.push('La promo est obligatoire pour un élève.');
  if (d.email && store.users.list((u) => u.id !== existingId && u.email.toLowerCase() === d.email).length) {
    errors.push('Cet email est déjà utilisé.');
  }
  return errors;
}

function assertValid(data, existingId) {
  const errors = validateUser(data, existingId);
  if (errors.length) throw new Error(errors.join(' '));
}

function requireUser(id) {
  const user = store.users.get(id);
  if (!user) throw new Error(`Utilisateur introuvable (${id})`);
  return user;
}

export function createUser(data, auteurId) {
  const clean = normalize(data);
  assertValid(clean);
  const user = store.users.create({ ...clean, actif: true });
  logAction({ auteurId, action: ACTIONS.USER_CREE, userId: user.id, detail: `${user.prenom} ${user.nom} (${LABELS.role[user.role]})` });
  return user;
}

export function updateUser(id, patch, auteurId) {
  const current = requireUser(id);
  const safe = Object.fromEntries(Object.entries(patch).filter(([k]) => !PROTECTED_FIELDS.includes(k)));
  const merged = normalize({ ...current, ...safe });
  assertValid(merged, id);
  const user = store.users.update(id, merged);
  logAction({ auteurId, action: ACTIONS.USER_MODIFIE, userId: id, detail: `${user.prenom} ${user.nom} : ${Object.keys(safe).join(', ')}` });
  return user;
}

export function setUserActive(id, actif, auteurId) {
  const current = requireUser(id);
  if (current.actif === actif) return current;
  const user = store.users.update(id, { actif });
  const name = `${user.prenom} ${user.nom}`;
  if (actif) logAction({ auteurId, action: ACTIONS.USER_MODIFIE, userId: id, detail: `${name} : compte réactivé` });
  else logAction({ auteurId, action: ACTIONS.USER_DESACTIVE, userId: id, detail: `${name} : compte désactivé` });
  return user;
}

export function userStats(userId, date) {
  const loans = store.loans.list((l) => l.userId === userId);
  return {
    enCours: loans.filter((l) => l.statut === LOAN_STATES.EN_COURS).length,
    retards: loans.filter((l) => isLate(l, date)).length,
    reservations: loans.filter((l) => l.statut === LOAN_STATES.RESERVEE).length,
    total: loans.length,
  };
}

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

export function userHistory(userId) {
  return {
    loans: store.loans.list((l) => l.userId === userId).sort(byCreatedDesc),
    bookings: store.bookings.list((b) => b.userId === userId).sort((a, b) => b.date.localeCompare(a.date)),
    log: logForUser(userId),
  };
}
