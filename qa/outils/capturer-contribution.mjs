/** Capture la page Contribution et le formulaire de dépôt avec des données simulées. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const theme = process.argv[3] ?? 'light';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block', colorScheme: theme });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'Djomo', prenom: 'Camille', universite: 'Université de Yaoundé I', filiere: 'Informatique', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const depots = [
  { _id: 'a', titre: 'Cours de réseaux', description: '', type: 'COURS', status: 'publie', licence: 'auteur', createdAt: new Date().toISOString() },
  { _id: 'b', titre: 'TD Algorithmique', description: '', type: 'TD', status: 'en_revue', licence: 'autorise', createdAt: new Date().toISOString() },
  { _id: 'c', titre: 'Synthèse SQL', description: '', type: 'SYNTHESE', status: 'refuse', licence: 'inconnue', motifRefus: 'Droits non justifiés', createdAt: new Date().toISOString() },
];
await ctx.route('**/api/**', (r) => {
  const u = r.request().url(); let data = [];
  if (/verification/.test(u)) data = { statut: 'APPROVED' };
  else if (/submissions\/me/.test(u)) data = depots;
  else if (/document-types/.test(u)) data = [{ value: 'TD', label: 'Travaux dirigés', collection: 'documents' }, { value: 'SYNTHESE', label: 'Synthèse', collection: 'documents' }];
  else if (/matieres/.test(u)) data = [{ _id: 'm1', nom: 'Bases de données' }];
  else if (/limites-fichier/.test(u)) data = { maxFileSizeMb: 50, formats: ['pdf'] };
  else if (/unread-count/.test(u)) data = { count: 0 };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const problemes = [];
page.on('console', (m) => { if (m.type() === 'error') problemes.push(m.text().slice(0, 140)); });
for (const [nom, chemin] of [['liste', '/app/depots'], ['formulaire', '/app/depots/nouveau']]) {
  await page.goto(`${base}${chemin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `qa/screenshots/refonte/contribution-${nom}-${theme}.png`, fullPage: true });
}
console.log('erreurs console :', problemes.join(' | ') || 'aucune');
await nav.close();
