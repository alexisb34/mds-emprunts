// js/auth.js — utilisateur courant, stocké par onglet (sessionStorage) pour permettre
// une fenêtre admin et une fenêtre mobile côte à côte avec des comptes différents.
import { store } from './store.js';
import { ROLES } from './models.js';

export const SESSION_KEY = 'mds-emprunts:currentUser';

function currentUserId() {
  return sessionStorage.getItem(SESSION_KEY);
}

function currentUser() {
  const id = currentUserId();
  return id ? store.users.get(id) : null;
}

function login(userId) {
  const u = store.users.get(userId);
  if (!u) throw new Error(`Utilisateur introuvable (${userId})`);
  if (u.actif === false) throw new Error('Ce compte est désactivé.');
  sessionStorage.setItem(SESSION_KEY, userId);
  return u;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}

function isPedago() {
  return currentUser()?.role === ROLES.PEDAGO;
}

export const auth = { currentUserId, currentUser, login, logout, isPedago };
