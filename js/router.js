// js/router.js — routing par #hash. Une vue = fonction (container, params) qui peut
// renvoyer une fonction de nettoyage (désabonnement du store, arrêt de caméra…).

export function matchRoute(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

export function currentPath() {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : `/${h}`;
}

export function navigate(path) {
  window.location.hash = `#${path}`;
}

export function createRouter({ routes, container, defaultPath = '/', notFound }) {
  let cleanup = null;

  function render() {
    const path = currentPath();
    if (path === '/' && defaultPath !== '/') { navigate(defaultPath); return; }
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    for (const route of routes) {
      const params = matchRoute(route.path, path);
      if (params) {
        container.innerHTML = '';
        try {
          cleanup = route.view(container, params) || null;
        } catch (err) {
          console.error(err);
          container.innerHTML = `<div class="card error-card"><h2 class="h6">Erreur d’affichage</h2><p class="body-sm text-secondary">${String(err && err.message ? err.message : err).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p></div>`;
        }
        window.scrollTo(0, 0);
        return;
      }
    }
    container.innerHTML = '';
    if (notFound) notFound(container, path);
  }

  return {
    start() { window.addEventListener('hashchange', render); render(); },
    stop() { window.removeEventListener('hashchange', render); if (typeof cleanup === 'function') cleanup(); },
    render,
  };
}
