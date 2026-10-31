import { execSync } from 'node:child_process';
import { ouvrir, connecter, api, verifier, bilan, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const { navigateur, contexte, page, journal } = await ouvrir({ sw: true });
await connecter(page);
// Le service worker prend la main au rechargement suivant.
await page.waitForTimeout(4000);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const docs = (await api(page, 'GET', '/documents?limit=2')).data; const arr = Array.isArray(docs) ? docs : docs.items ?? docs.documents;
const id = arr[0]._id ?? arr[0].id; const titre = arr[0].titre;

await page.goto(`${base}/app/bibliotheque/doc/${id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /hors ligne/i }).first().click();
await page.waitForTimeout(3500);
verifier('hors ligne : fichier enregistré', await page.evaluate(async () => { let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; return n > 0; }));

// Coupure réseau, application déjà chargée : on navigue dans l'application (le
// routeur n'a pas besoin du réseau), puis on ouvre le document enregistré.
// Le serveur de développement charge chaque écran à la demande : on les visite
// avant la coupure (en production, le service worker les a déjà en cache).
await page.goto(`${base}/app/offline`, { waitUntil: 'networkidle' });
await page.goto(`${base}/app/bibliotheque/doc/${id}/read`, { waitUntil: 'networkidle' });
await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20000 });
await page.goto(`${base}/app/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await contexte.setOffline(true);
const aller = (chemin) => page.evaluate((c) => { history.pushState({}, '', c); dispatchEvent(new PopStateEvent('popstate')); }, chemin);
await aller('/app/offline');
await page.waitForTimeout(2500);
const texte = await page.locator('body').innerText();
verifier('sans réseau : la bibliothèque hors ligne affiche le document', texte.includes(titre), texte.slice(0, 100).replace(/\n/g, ' '));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-sans-reseau.png' });
await aller(`/app/bibliotheque/doc/${id}/read`);
let rendu = true; try { await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20000 }); } catch { rendu = false; }
verifier('sans réseau : le PDF enregistré se lit', rendu);
await contexte.setOffline(false);

console.log('ERREURS', JSON.stringify(journal.erreurs), JSON.stringify(journal.console.slice(-6)));
bilan();
await navigateur.close();
