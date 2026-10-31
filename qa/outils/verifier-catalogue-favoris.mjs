/** Catalogue en dossiers (grille/liste), bouton favori des cartes, en-tête et rubrique du profil. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const mats = ['Algorithmique', 'Bases de données', 'Réseaux', 'Mathématiques', 'Génie logiciel', 'Programmation Java', 'Systèmes d’information'];
const docs = mats.flatMap((nom, i) => Array.from({ length: i % 4 + 1 }, (_, k) => ({ _id: `d${i}${k}`, id: `d${i}${k}`, titre: `${nom} — cours ${k + 1}`, type: ['COURS', 'TD', 'SYNTHESE'][k % 3], matiereId: { _id: `m${i}`, nom }, niveau: 'N2', pages: 10 + k, tailleMb: 1.5, vues: k, noteMoyenne: k ? 4 : 0 })));
const resultats = {};
for (const theme of ['light', 'dark']) {
  // Un navigateur par thème : le mode mono-processus plante au second contexte.
  const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block', colorScheme: theme });
  await ctx.addInitScript(() => {
    const dans = new Date(Date.now() + 86_400_000).toISOString();
    localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
    localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'Djomo', prenom: 'Camille', universite: 'Université de Yaoundé I', filiere: 'Informatique', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
    localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
  });
  const favoris = new Set(); const appels = [];
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url(); const m = r.request().method(); appels.push(`${m} ${u.replace(/^.*\/api/, '')}`);
    let data = [];
    if (/verification/.test(u)) data = { statut: 'APPROVED' };
    else if (/\/favorites\/[^/]+$/.test(u) && m === 'POST') favoris.add(u.split('/').pop());
    else if (/\/favorites\/[^/]+$/.test(u) && m === 'DELETE') favoris.delete(u.split('/').pop());
    else if (/\/favorites$/.test(u)) data = docs.filter((d) => favoris.has(d.id)).map((d) => ({ documentId: d }));
    else if (/progression\/stats/.test(u)) data = { streak: 3, docsLus: 12, heuresEtude: 5 };
    else if (/\/profile$/.test(u)) data = { user: {}, stats: { docsTelecharges: 4, docsLus: 12, heuresEtude: 5, streak: 3 } };
    else if (/documents/.test(u)) data = docs;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/app/bibliotheque/matieres`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
  await page.screenshot({ path: `qa/screenshots/refonte/catalogue-dossiers-${theme}.png` });
  if (theme === 'light') {
    resultats.dossiers = await page.locator('.catalogue__dossier').count();
    await page.locator('.catalogue__vue').first().click(); await page.waitForTimeout(600);
    await page.screenshot({ path: 'qa/screenshots/refonte/catalogue-liste-light.png' });
    resultats.modeMemorise = await page.evaluate(() => localStorage.getItem('nl_catalogue_mode'));
    await page.locator('.catalogue__dossier').first().click(); await page.waitForTimeout(2000);
    resultats.cartes = await page.locator('nl-document-card').count();
    await page.locator('.nl-doc-card__favori').first().click(); await page.waitForTimeout(800);
    resultats.favoriPost = appels.filter((a) => /^POST \/favorites\//.test(a)).length;
    resultats.favoriActif = await page.locator('.nl-doc-card__favori--actif').count();
    resultats.pasNavigue = /matiere\//.test(page.url());
    resultats.hote = await page.locator('nl-toast-host').evaluate((e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { pos: c.position, top: c.top, bottom: c.bottom, h: Math.round(r.height), parent: e.parentElement?.tagName, disp: c.display }; }).catch((e) => String(e));
    resultats.toast = await page.locator('.nl-toast').evaluateAll((l) => l.map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) }; }));
    await page.screenshot({ path: 'qa/screenshots/refonte/carte-favori.png' });
    await page.locator('.nl-doc-card__favori').first().click(); await page.waitForTimeout(800);
    resultats.favoriRetire = appels.filter((a) => /^DELETE \/favorites\//.test(a)).length;
    await page.goto(`${base}/app/profil`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
    resultats.raccourcis = await page.locator('.nl-sl__groupe').first().innerText();
    resultats.entete = await page.locator('nl-app-header .nl-entete__actions button').evaluateAll((l) => l.map((b) => b.getAttribute('aria-label')));
    await page.screenshot({ path: 'qa/screenshots/refonte/profil-ressources.png' });
    await page.locator('.nl-sl__groupe').first().locator('.nl-sl__ligne').nth(2).click(); await page.waitForTimeout(1200);
    resultats.versFavoris = new URL(page.url()).pathname;
    await page.goto(`${base}/app/profil`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    await page.locator('nl-app-header .nl-entete__actions button').first().click(); await page.waitForTimeout(1000);
    resultats.boutonFavorisEntete = new URL(page.url()).pathname;
  }
  await nav.close();
}
console.log(JSON.stringify(resultats, null, 1));
