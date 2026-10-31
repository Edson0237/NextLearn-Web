/**
 * Éprouve les réglages du profil qui s'affichaient sans agir : changement de
 * niveau (liste servie par le serveur, réponse enveloppée dans `{ user }`).
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const navigateur = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
const utilisateur = { id: 'u1', email: 'c@e.t', nom: 'Djomo', prenom: 'Camille', universite: 'UY1', filiere: 'Info', niveau: 'N2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' };
await contexte.addInitScript((u) => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'jeton'); localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'refresh'); localStorage.setItem('nl_user_data', JSON.stringify(u));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
}, utilisateur);
let envoye = null;
await contexte.route('**/api/**', async (route) => {
  const u = route.request().url(); const m = route.request().method();
  let corps = { data: [] };
  if (/me\/levels/.test(u)) corps = { data: { cycle: 'licence', cycleLabel: 'Licence', actuel: 'N2', niveauLabel: 'Niveau 2', niveaux: [{ code: 'N1', label: 'Niveau 1' }, { code: 'N2', label: 'Niveau 2' }, { code: 'N3', label: 'Niveau 3' }] } };
  else if (m === 'PUT' && /\/api\/profile$/.test(u)) { envoye = route.request().postDataJSON(); corps = { data: { user: { ...utilisateur, niveau: envoye.niveau } } }; }
  else if (/verification\/requests\/me/.test(u)) corps = { data: { statut: 'APPROVED' } };
  else if (/\/api\/profile$/.test(u)) corps = { data: { user: utilisateur, stats: {} } };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});
const page = await contexte.newPage();
const erreurs = []; page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.getByText('Ta promotion actuelle').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'qa/screenshots/refonte/reglage-niveau.png' });
await page.locator('.cdk-overlay-container').getByText('Niveau 3').click();
await page.waitForTimeout(1500);
const stocke = await page.evaluate(() => JSON.parse(localStorage.getItem('nl_user_data') ?? '{}'));
console.log(JSON.stringify({ envoye, niveauStocke: stocke.niveau, nomStocke: stocke.nom, idStocke: stocke.id, valeurAffichee: await page.getByText('Niveau 3').count(), erreurs }));
await navigateur.close();
