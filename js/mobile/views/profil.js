// js/mobile/views/profil.js — profil de l’emprunteur, changement d’utilisateur (démo), déconnexion.
import { auth } from '../../auth.js';
import { navigate } from '../../router.js';
import { escapeHtml, avatar, fullName, badge } from '../../ui.js';
import { setHeader } from '../layout.js';

export function profilHtml(user) {
  return `
    <div class="card m-profile">
      <div class="m-profile__head">${avatar(user, 'md')}<div><strong class="label-lg">${escapeHtml(fullName(user))}</strong><div>${badge('role', user.role)}</div></div></div>
      <dl class="m-dl">
        <dt>Email</dt><dd>${escapeHtml(user.email)}</dd>
        ${user.promo ? `<dt>Promo</dt><dd>${escapeHtml(user.promo)}</dd>` : ''}
      </dl>
    </div>
    <div class="card">
      <p class="body-sm text-secondary">Mode démonstration : vous pouvez changer de compte pour tester un autre rôle.</p>
      <div class="m-actions">
        <button type="button" class="btn btn--secondary btn--block" data-action="switch-user">Changer d’utilisateur</button>
        <button type="button" class="btn btn--ghost btn--block" data-action="logout">Se déconnecter</button>
      </div>
    </div>`;
}

export function profilView(container) {
  const user = auth.currentUser();
  setHeader({ title: 'Mon profil', back: '/accueil' });
  container.innerHTML = profilHtml(user);
  const leave = () => { auth.logout(); navigate('/login'); };
  container.querySelector('[data-action="switch-user"]').addEventListener('click', leave);
  container.querySelector('[data-action="logout"]').addEventListener('click', leave);
}
