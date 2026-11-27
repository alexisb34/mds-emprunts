// scripts/serve.mjs — le serveur de développement. `python3 -m http.server` n’envoie aucun
// en-tête de cache : le navigateur garde les modules JS d’une version à l’autre, et on relit
// l’ancien écran en croyant lire le nouveau. Celui-ci interdit le cache, un simple rechargement
// suffit donc à voir une modification.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const RACINE = resolve(process.argv[2] || '.');
const PORT = Number(process.env.PORT || 8000);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // `normalize` d’abord, `join` ensuite : « /../../etc/passwd » ne sort pas de la racine.
  const fichier = join(RACINE, normalize(chemin).replace(/^(\.\.[/\\])+/, ''));
  let cible = fichier;
  try {
    if (statSync(cible).isDirectory()) cible = join(cible, 'index.html');
    statSync(cible);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('404');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(cible).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(cible).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
