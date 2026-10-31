/** Vérifie la configuration push servie à la PWA, et ce que fait l'écran quand la clé VAPID manque. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const r = {};
const conf = await (await fetch(`${base}/firebase-config.json`)).json();
r.config = { appId: !!conf.appId, apiKey: !!conf.apiKey, projectId: conf.projectId, vapidKey: conf.vapidKey ? 'présente' : 'ABSENTE' };
r.serviceWorkerServi = (await fetch(`${base}/firebase-messaging-sw.js`)).status;
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.grantPermissions(['notifications']);
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
await ctx.route('**/api/**', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: /verification/.test(rt.request().url()) ? { statut: 'APPROVED' } : [] }) }));
const page = await ctx.newPage();
await page.goto(`${base}/app/profil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
r.pageTexte = (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 900);
console.log(JSON.stringify(r, null, 1));
await nav.close();
