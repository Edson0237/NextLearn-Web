import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
const { navigateur, page, journal } = await ouvrir();
await connecter(page);

// ── Accueil : du vrai contenu ─────────────────────────────────────────────
const liste = await api(page, 'GET', '/documents?limit=50');
const docs = liste.data?.items ?? liste.data?.documents ?? liste.data;
verifier('catalogue : l’API rend des documents', Array.isArray(docs) && docs.length > 0, `${docs?.length ?? '?'}`);
const doc = docs[0]; const id = doc._id ?? doc.id;
// Repartir d'un état propre : la sonde doit pouvoir être rejouée.
await api(page, 'DELETE', `/offline/${id}`); await api(page, 'DELETE', `/favorites/${id}`);
await page.evaluate(async () => { for (const n of await caches.keys()) await caches.delete(n); });

// ── Fiche ─────────────────────────────────────────────────────────────────
await page.goto(`${base}/app/bibliotheque/doc/${id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('fiche : le titre s’affiche', (await page.locator('.doc-detail__corps').innerText()).includes(doc.titre));
const vues = (await api(page, 'GET', `/documents/${id}`)).data?.vues;
verifier('fiche : la vue est comptée', vues >= 1, `vues=${vues}`);

// ── Favori ────────────────────────────────────────────────────────────────
await page.getByRole('button', { name: /favoris/i }).first().click();
await page.waitForTimeout(1200);
let favs = (await api(page, 'GET', '/favorites')).data;
verifier('favori : enregistré côté serveur', favs.some((f) => String(f.documentId?._id ?? f.documentId) === id));
await page.goto(`${base}/app/favoris`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('favori : visible dans la page Favoris', (await page.locator('body').innerText()).includes(doc.titre));
await page.goto(`${base}/app/bibliotheque/doc/${id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /favoris/i }).first().click();
await page.waitForTimeout(1200);
favs = (await api(page, 'GET', '/favorites')).data;
verifier('favori : retiré côté serveur', !favs.some((f) => String(f.documentId?._id ?? f.documentId) === id));

// ── Notation ──────────────────────────────────────────────────────────────
await page.locator('.doc-detail__etoile').nth(4).click();
await page.waitForTimeout(1800);
const note = (await api(page, 'GET', `/documents/${id}`)).data;
verifier('notation : la note moyenne devient celle donnée', note.noteMoyenne === 5, `avant ${doc.noteMoyenne} après ${note.noteMoyenne}`);

// ── Hors ligne ────────────────────────────────────────────────────────────
await page.getByRole('button', { name: /hors ligne/i }).first().click();
await page.waitForTimeout(3500);
const hors = (await api(page, 'GET', '/offline/documents')).data;
verifier('hors ligne : marqué côté serveur', hors.some((o) => String(o.documentId?._id ?? o.documentId) === id));
const cache = await page.evaluate(async () => {
  const noms = await caches.keys(); let n = 0;
  for (const nom of noms) n += (await (await caches.open(nom)).keys()).length;
  return { noms, n };
});
verifier('hors ligne : le fichier est dans le cache du navigateur', cache.n > 0, JSON.stringify(cache));
await page.goto(`${base}/app/offline`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('hors ligne : visible dans la bibliothèque hors ligne', (await page.locator('body').innerText()).includes(doc.titre));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-hors-ligne.png' });

// ── Téléchargement ────────────────────────────────────────────────────────
await page.goto(`${base}/app/bibliotheque/doc/${id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const avantDl = (await api(page, 'GET', `/documents/${id}`)).data.telechargements;
// Le navigateur de test plante sur un onglet ouvert : on intercepte le clic du lien.
await page.evaluate(() => {
  window.__liens = [];
  HTMLAnchorElement.prototype.click = function () { window.__liens.push({ href: this.href, download: this.download }); };
});
await page.getByRole('button', { name: /télécharger/i }).first().click();
await page.waitForTimeout(1500);
const apresDl = (await api(page, 'GET', `/documents/${id}`)).data.telechargements;
verifier('téléchargement : compté côté serveur', apresDl > avantDl, `${avantDl} → ${apresDl}`);
const liens = await page.evaluate(() => window.__liens);
verifier('téléchargement : le lien pointe vers le fichier', liens.length === 1 && /4402|cloudinary/.test(liens[0].href) && liens[0].download.endsWith('.pdf'), JSON.stringify(liens));

// ── Lecteur ───────────────────────────────────────────────────────────────
await page.goto(`${base}/app/bibliotheque/doc/${id}/read`, { waitUntil: 'domcontentloaded' });
let rendu = true; try { await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20000 }); } catch { rendu = false; }
verifier('lecteur : le PDF est dessiné', rendu);

// ── Signalement ───────────────────────────────────────────────────────────
await page.goto(`${base}/app/bibliotheque/doc/${id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('nl-page-bar button[aria-label*="ignaler"]').click();
await page.waitForTimeout(1200);
await page.locator('.cdk-overlay-container').getByText('Doublon').click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-signaler.png' });
const confirmer = page.locator('.cdk-overlay-container button', { hasText: /envoyer|signaler|confirmer/i }).last();
if (await confirmer.count()) await confirmer.click();
await page.waitForTimeout(1500);
const rapports = journal.api.filter((a) => a.m === 'POST' && /\/api\/reports$/.test(a.u));
verifier('signalement : envoyé et accepté', rapports.length === 1 && rapports[0].s === 201, JSON.stringify(rapports));

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs), JSON.stringify(journal.console));
bilan();
await navigateur.close();
