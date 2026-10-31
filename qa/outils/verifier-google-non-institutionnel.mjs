/**
 * Une adresse Google non institutionnelle (gmail) : Google remplace le code reçu par e-mail,
 * puis le compte suit la procédure des personnes sans adresse d'établissement (justificatif).
 * Google est un faux (`window.google`), le serveur est simulé.
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1300 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  localStorage.setItem('nl_first_launch', '0');
  window.__rappel = null;
  window.google = { accounts: { id: {
    initialize: (c) => { window.__rappel = c.callback; },
    renderButton: (hote) => { const b = document.createElement('button'); b.id = 'faux-google'; b.textContent = 'Google'; b.onclick = () => window.__rappel({ credential: 'jeton-de-test-' + 'x'.repeat(30) }); hote.appendChild(b); },
  } } };
});
await ctx.route('**://accounts.google.com/**', (r) => r.abort());
const appels = [];
let inscrit = false;
let connecte = false;
await ctx.route('**/api/**', async (r) => {
  const u = r.request().url(); const m = r.request().method(); let data = [];
  appels.push(`${m} ${u.replace(/^.*\/api/, '')}`);
  const user = { id: 'u1', email: 'marvin@gmail.com', nom: 'Tientcheu', prenom: 'Marvin', universite: 'ISJ Yaoundé', filiere: 'Informatique', niveau: 'N2', hasPin: false, verificationStatus: 'requis' };
  if (/auth\/google\/config/.test(u)) data = { enabled: true, clientId: 'client-test.apps.googleusercontent.com', domaines: ['isj.cm'] };
  else if (/auth\/google\/inscription/.test(u)) { inscrit = true; data = { status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900, user }; }
  else if (/auth\/google$/.test(u)) data = connecte
    ? { status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900, user }
    : { status: 'new_profile_incomplete', email: 'marvin@gmail.com', googleSub: 'g-9', tempToken: 'tt', expiresIn: 900, profil: { prenom: 'Marvin', nom: 'Tientcheu', hd: '', institutionnel: false } };
  else if (/universites/.test(u)) data = [{ _id: 'uni1', nom: 'ISJ Yaoundé' }];
  else if (/verification\/requests\/me/.test(u)) data = (inscrit || connecte) ? { statut: null, requis: true, resoumissionsRestantes: 3 } : { statut: 'approuve', requis: false };
  else if (/references\/justificatif-types/.test(u)) data = [{ value: 'CARTE_ETUDIANT', label: 'Carte d’étudiant' }];
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const res = [];
const v = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? '  ✔' : '  ✘'} ${n}${d ? ' - ' + d : ''}`); };
const chemin = () => new URL(page.url()).pathname;

await page.goto(`${base}/app/register`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google', { timeout: 15000 });
v('la case « je n’ai pas d’adresse institutionnelle » a disparu', (await page.locator('.nl-reg__option').count()) === 0);
v('« ou » sépare le bouton Google du formulaire', (await page.locator('.nl-reg__ou').count()) === 1);
v('le champ s’appelle « E-mail institutionnel ou personnel »', /E-mail institutionnel ou personnel/.test(await page.locator('.nl-reg').innerText()));

await page.locator('#faux-google').click(); await page.waitForTimeout(1500);
const corps = await page.locator('.nl-reg').innerText();
v('une adresse gmail est acceptée par Google : le parcours scolaire s’ouvre (plus de refus de domaine)', /parcours|Plus qu/i.test(corps) && !/établissement autorisé/i.test(corps));
v('l’écran prévient qu’un justificatif sera demandé', /justificatif/i.test(corps));

// ── Un compte gmail déjà créé (« requis ») qui se connecte avec Google :
//    il arrive sur le dépôt du justificatif, pas sur l'accueil ──
connecte = true;
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google', { timeout: 15000 });
await page.locator('#faux-google').click(); await page.waitForTimeout(2500);
v('connexion Google d’un compte « requis » : le dépôt du justificatif s’ouvre (pas l’accueil)', /verification/.test(chemin()) && !/pending/.test(chemin()), chemin());
console.log(`${res.filter(Boolean).length}/${res.length}`);
await nav.close();
