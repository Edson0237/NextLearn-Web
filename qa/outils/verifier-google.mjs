/**
 * Éprouve le parcours « Se connecter avec Google » côté PWA.
 * Google lui-même est remplacé par un faux (`window.google`) : on vérifie ce
 * que NOTRE application fait du jeton, pas Google. Le serveur est simulé.
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1300 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  localStorage.setItem('nl_first_launch', '0');
  // Un faux Google : `renderButton` pose un bouton, `initialize` retient le rappel.
  window.__rappel = null; window.__rendus = 0;
  window.google = { accounts: { id: {
    initialize: (c) => { window.__rappel = c.callback; window.__clientId = c.client_id; },
    renderButton: (hote, o) => { window.__rendus++; const b = document.createElement('button'); b.id = 'faux-google'; b.textContent = 'Google (' + o.text + ')'; b.onclick = () => window.__rappel({ credential: 'jeton-de-test-' + 'x'.repeat(30) }); hote.appendChild(b); },
  } } };
});
// Le vrai script de Google écraserait le faux : on le bloque.
await ctx.route('**://accounts.google.com/**', (r) => r.abort());
let scenario = 'profil';
const appels = [];
await ctx.route('**/api/**', async (r) => {
  const u = r.request().url(); const m = r.request().method(); let data = [];
  appels.push(`${m} ${u.replace(/^.*\/api/, '')}`);
  let status = 200;
  if (/auth\/google\/config/.test(u)) data = { enabled: true, clientId: 'client-test.apps.googleusercontent.com', domaines: ['isj.cm'] };
  else if (/auth\/google\/inscription/.test(u)) { data = { etape: 'pin', tempToken: 'tt-pin', expiresIn: 900 }; }
  else if (/auth\/google$/.test(u)) {
    const sess = { status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1', email: 'c@isj.cm', nom: 'Djomo', prenom: 'Camille', universite: 'ISJ', filiere: 'Info', niveau: 'N2' } };
    if (scenario === 'refus') { status = 403; data = { error: { code: 'domain_not_allowed', message: 'Ce compte Google n’appartient pas à un établissement autorisé. Utilise ton adresse institutionnelle.' } }; }
    else if (scenario === 'banni') { status = 403; data = { error: { code: 'account_banned', message: 'Votre compte a été banni. Contactez un administrateur.' } }; }
    else if (scenario === 'pin') data = { status: 'pin_required', userId: 'u1', tempToken: 'tt-pin', expiresIn: 900 };
    else if (scenario === 'pending') data = { ...sess, verificationStatus: 'pending' };
    else if (scenario === 'session') data = sess;
    else data = { status: 'new_profile_incomplete', email: 'camille@isj.cm', googleSub: 'g-1', tempToken: 'tt', expiresIn: 900, profil: { prenom: 'Camille', nom: 'Djomo' } };
  }
  else if (/institution-domain/.test(u)) data = { allowed: true, institutionName: 'ISJ', google: true };
  else if (/auth\/login/.test(u)) data = { otpRequis: true, methode: 'google', tempToken: 'x', expiresIn: 600 };
  else if (/universites/.test(u)) data = [{ _id: 'uni1', nom: 'ISJ Yaoundé' }];
  else if (/verification/.test(u)) data = scenario === 'pending' ? { requis: true, statut: 'en_attente' } : { statut: 'APPROVED' };
  await r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 200 ? { data } : data) });
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
const r = {};
const chemin = () => new URL(page.url()).pathname;

// 1. Inscription : le bouton Google est là, avec l'identifiant venu du serveur
await page.goto(`${base}/app/register`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google', { timeout: 15000 });
r.clientIdVenuDuServeur = await page.evaluate(() => window.__clientId);
r.libelleBouton = await page.locator('#faux-google').innerText();
await page.screenshot({ path: 'qa/screenshots/refonte/google-inscription.png' });

// 2. Adresse gérée par Google : le code par e-mail n'est plus proposé
const champs = page.locator('.nl-reg__champ input[type="text"], .nl-reg__champ input[type="email"]');
await champs.nth(2).fill('camille@isj.cm');
await page.waitForTimeout(1500);
r.boutonCodeVisible = await page.locator('.nl-reg__cta').count();
r.messageGoogle = (await page.locator('.nl-reg__info-google').innerText().catch(() => '')).slice(0, 60);

// 3. Première visite : Google → profil → on saute « Qui es-tu ? » et on arrive au parcours, nom prérempli
await page.locator('#faux-google').click();
await page.waitForTimeout(1500);
r.apresProfil = { chemin: chemin(), titre: await page.locator('.nl-reg__titre').first().innerText() };
await page.screenshot({ path: 'qa/screenshots/refonte/google-parcours.png' });
const cascade = (n) => page.locator('.nl-reg__cascade', { hasText: new RegExp(`^\\s*${n}`) });
r.corpsParcours = (await page.locator('.nl-reg').innerText()).replace(/\n+/g, ' | ').slice(0, 300);

// 4. Refus du serveur : le message est montré tel quel
scenario = 'refus';
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google');
await page.locator('#faux-google').click();
await page.waitForTimeout(1200);
r.refus = (await page.locator('.nl-gbtn__erreur').innerText().catch(() => 'AUCUN MESSAGE')).slice(0, 80);
r.restéSurLogin = chemin();

// 4 bis. Compte banni : le même écran de refus plein écran que pour un PIN refusé
scenario = 'banni';
await page.locator('#faux-google').click();
await page.waitForTimeout(1200);
r.banni = (await page.locator('nl-resultat-pin').innerText().catch(() => 'AUCUN ÉCRAN')).replace(/\n/g, ' | ');
await page.getByRole('button', { name: 'Réessayer' }).click();

// 4 ter. Compte sans PIN : le choix du PIN, depuis la page de connexion
scenario = 'pin';
await page.locator('#faux-google').click();
await page.waitForTimeout(1500);
r.sansPin = chemin();
await page.evaluate(() => localStorage.clear()); // la démarche « PIN » en cours renverrait sinon vers le choix du PIN
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google');

// 4 quater. Justificatif en attente : la page d'attente, pas l'accueil
scenario = 'pending';
await page.locator('#faux-google').click();
await page.waitForTimeout(2000);
r.enAttente = chemin();
await page.evaluate(() => { for (const k of ['nl_jwt_token', 'nl_refresh_token', 'nl_user_data']) localStorage.removeItem(k); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#faux-google');

// 5. Compte connu : session → accueil
scenario = 'session';
await page.locator('#faux-google').click();
await page.waitForTimeout(2000);
r.apresSession = chemin();
r.sessionEnregistree = await page.evaluate(() => !!localStorage.getItem('nl_jwt_token'));

// 6. Appareil nouveau d'une adresse Google : pas de page de code, le bouton Google à la place
await page.evaluate(() => { for (const k of ['nl_jwt_token', 'nl_refresh_token', 'nl_user_data']) localStorage.removeItem(k); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('camille@isj.cm');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click();
await page.waitForTimeout(1500);
r.surAppareilNouveau = { chemin: chemin(), carteGoogle: await page.locator('.nl-loginpin__google--verif h2').innerText().catch(() => 'ABSENTE') };
await page.screenshot({ path: 'qa/screenshots/refonte/google-appareil-nouveau.png' });
r.appelsAuth = appels.filter((a) => /auth/.test(a)).join(' | ');
console.log(JSON.stringify(r, null, 1));
await nav.close();
