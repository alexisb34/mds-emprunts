// js/admin/views/login.js — choix du compte pédago (démo, sans mot de passe).
import { store } from '../../store.js';
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { ROLES } from '../../models.js';
import { escapeHtml, avatar, fullName, toast } from '../../ui.js';

export function loginHtml(pedagos) {
  const list = pedagos.map((u) => `
    <button type="button" class="login__user" data-user="${escapeHtml(u.id)}">
      ${avatar(u, 'md')}
      <span><strong class="label-md">${escapeHtml(fullName(u))}</strong><br><span class="body-tiny text-secondary">${escapeHtml(u.email)}</span></span>
    </button>`).join('');
  return `
    <div class="login">
      <div class="card login__card">
        <p class="label-caps text-secondary">MDS Emprunts — Administration</p>
        <h1 class="h5">Qui êtes-vous ?</h1>
        <p class="body-sm text-secondary login__hint">Comptes de démonstration — aucun mot de passe.</p>
        <div class="login__list">${list}</div>
        <p class="body-tiny text-secondary login__back"><a href="index.html">← Retour à l’accueil</a></p>
      </div>
    </div>`;
}

export function loginView(container) {
  const pedagos = store.users.list((u) => u.role === ROLES.PEDAGO && u.actif);
  container.innerHTML = loginHtml(pedagos);
  container.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', () => {
    try {
      auth.login(b.dataset.user);
      navigate('/dashboard');
    } catch (e) {
      toast(e.message, 'error');
    }
  }));
}
