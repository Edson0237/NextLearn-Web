/**
 * Sert le build de production avec repli SPA, pour les captures.
 *
 * Le serveur de développement recompile chaque route à la première visite :
 * les captures arrivaient alors sur des écrans à moitié peints. Le build
 * figé n'a pas ce défaut, et c'est lui que l'utilisateur recevra.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const racine = process.argv[2] ?? 'dist/nextLearn-web/browser';
const port = Number(process.argv[3] ?? 4400);
/** Cible facultative des appels `/api` (l'API de bout en bout), pour éprouver le build avec de vraies données. */
const cibleApi = process.argv[4];

const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  if (cibleApi && (req.url ?? '').startsWith('/api')) {
    const { request } = await import('node:http');
    const url = new URL(cibleApi);
    const amont = request({ host: url.hostname, port: url.port, path: req.url, method: req.method, headers: { ...req.headers, host: url.host } },
      (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
    amont.on('error', () => res.writeHead(502).end());
    req.pipe(amont);
    return;
  }
  const chemin = decodeURIComponent((req.url ?? '/').split('?')[0]);
  // `normalize` puis retrait des `..` : sans cela, une requête fabriquée
  // remonterait hors du dossier servi.
  const sur = normalize(chemin).replace(/^(\.\.[/\\])+/, '');
  for (const candidat of [join(racine, sur), join(racine, 'index.html')]) {
    try {
      const corps = await readFile(candidat);
      res.writeHead(200, { 'Content-Type': types[extname(candidat)] ?? 'application/octet-stream' });
      res.end(corps);
      return;
    } catch {
      // Fichier absent : on tombe sur le repli index.html.
    }
  }
  res.writeHead(404).end('introuvable');
}).listen(port, () => console.log(`prêt sur http://localhost:${port}`));
