/**
 * Éprouve la fiche d'une ressource : retour, partage, signalement.
 *
 * Trois gestes qui s'affichaient sans rien faire. La sonde les déclenche pour
 * de vrai, depuis un parcours réel (liste puis fiche), et regarde ce qui se
 * passe : l'adresse après « retour », le texte copié, la feuille de motifs.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4200';
const doc = { _id: 'doc1', id: 'doc1', titre: 'Bases de données avancées', description: 'Cours', type: 'COURS',
  matiereId: { _id: 'm1', nom: 'Bases de données' }, niveau: 'N2', pages: 12, tailleMb: 2, urlPdf: 'x.pdf',
  noteMoyenne: 4, vues: 3, telechargements: 1, anneeAcademique: '2024-2025' };

const navigateur = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
await contexte.grantPermissions(['clipboard-read', 'clipboard-write']);
await contexte.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'jeton'); localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'refresh');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u1', email: 'c@e.t', nom: 'D', prenom: 'C',
    universite: 'UY1', filiere: 'Info', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const appels = [];
await contexte.route('**/api/**', async (route) => {
  const u = route.request().url(); appels.push(`${route.request().method()} ${u.replace(/^.*\/api/, '/api')}`);
  let corps = { data: [] };
  if (/reports\/motifs/.test(u)) corps = { data: { slaHeures: 24, motifs: [{ code: 'DOUBLON', label: 'Doublon', description: 'd', masquageImmediat: false }, { code: 'AUTRE', label: 'Autre', description: 'a', masquageImmediat: false }] } };
  else if (/\/api\/reports$/.test(u)) corps = { data: { message: 'Merci', slaHeures: 24 } };
  else if (/verification\/requests\/me/.test(u)) corps = { data: { statut: 'APPROVED' } };
  else if (/\/api\/documents\/[^/?]+$/.test(u)) corps = { data: doc };
  else if (/documents/.test(u)) corps = { data: [doc] };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});

const page = await contexte.newPage();
const erreurs = [];
page.on('console', (m) => { if (m.text().startsWith('PILE')) console.log(m.text()); });
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
const chemin = () => new URL(page.url()).pathname;

await page.goto(`${base}/app/bibliotheque/matiere/m1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'qa/screenshots/refonte/fiche-ressource-liste.png' });
const cartes = await page.locator('nl-document-card, .doc-card, [class*="carte"], a[href*="doc/"]').count();
console.log('cartes sur la liste:', cartes);
const resultat = {};
const titre = page.getByText('Bases de données avancées').first();
if (await titre.count()) { await titre.click(); await page.waitForTimeout(1500); }
resultat.fiche = chemin();
await page.screenshot({ path: 'qa/screenshots/refonte/fiche-ressource.png' });
await page.locator('nl-page-bar .nl-barre__rond').click();
await page.waitForTimeout(1500);
resultat.apresRetour = chemin();
// Le cas qui tournait en rond : liste → fiche → lecteur → retour → retour.
await page.goto(`${base}/app/bibliotheque/matiere/m1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByText('Bases de données avancées').first().click();
await page.waitForTimeout(1200);
await page.locator('.doc-detail__principal').click();
await page.waitForTimeout(1500);
resultat.lecteur = chemin();
await page.locator('.nl-icon-btn').first().click();
await page.waitForTimeout(1200);
resultat.retourDuLecteur = chemin();
await page.locator('nl-page-bar .nl-barre__rond').click();
await page.waitForTimeout(1200);
resultat.retourDeLaFiche = chemin();

await page.goto(`${base}/app/bibliotheque/doc/doc1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.locator('nl-page-bar button[aria-label*="artager"]').click();
await page.waitForTimeout(800);
resultat.presse = await page.evaluate(() => navigator.clipboard.readText().catch((e) => 'ERR ' + e.message));
resultat.toast = await page.locator('[class*="toast"]').allInnerTexts();
await page.locator('nl-page-bar button[aria-label*="ignaler"]').click();
await page.waitForTimeout(1500);
await page.screenshot({ path: 'qa/screenshots/refonte/fiche-signaler.png' });
resultat.feuille = await page.locator('.cdk-overlay-container').innerText().catch(() => '');
console.log(JSON.stringify(resultat, null, 1), 'erreurs:', erreurs);
await navigateur.close();
