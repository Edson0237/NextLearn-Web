/**
 * Tout ce qui se passe avant d'être connecté : lancement, présentation,
 * inscription (formulaire, cascade académique, code par e-mail, PIN),
 * connexion (PIN faux, e-mail inconnu, appareil nouveau avec code),
 * PIN oublié. L'envoi d'e-mail est coupé : le code est retrouvé en base.
 */
import { execSync } from 'node:child_process';
import { ouvrir, verifier, bilan, echecs, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const code = (email) => execSync(`node qa/outils/e2e-otp.cjs ${email}`).toString().trim();
const chemin = (page) => new URL(page.url()).pathname;
const { navigateur, page, journal } = await ouvrir({ neuf: true });
const sheet = page.locator('.cdk-overlay-container');
const taper = async (c) => { for (const ch of c) await page.locator('nl-pin-input').getByRole('button', { name: ch, exact: true }).click(); };

// ── Lancement et présentation ─────────────────────────────────────────────
await page.goto(`${base}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
verifier('lancement : l’écran de marque affiche le nom', (await page.locator('#nl-splash').innerText().catch(() => '')).includes('NextLearn'));
await page.waitForTimeout(3000);
verifier('lancement : puis la présentation (pas le site vitrine)', chemin(page) === '/app/onboarding', chemin(page));
await page.locator('.nl-onb__cta').click(); await page.waitForTimeout(500);
await page.locator('.nl-onb__cta').click(); await page.waitForTimeout(500);
verifier('présentation : le dernier écran propose de commencer', /commencer/i.test(await page.locator('.nl-onb__cta').innerText()));
await page.locator('.nl-onb__cta').click(); await page.waitForTimeout(1200);
verifier('présentation : mène à l’inscription', chemin(page) === '/app/register', chemin(page));

// ── Inscription : validations ─────────────────────────────────────────────
await page.locator('.nl-reg__cta').click(); await page.waitForTimeout(500);
verifier('inscription : formulaire vide refusé (reste sur l’étape 1)', /1\/2/.test(await page.locator('body').innerText()) && chemin(page) === '/app/register');
const champs = page.locator('.nl-reg__champ input[type="text"], .nl-reg__champ input[type="email"]');
await champs.nth(0).fill('Nadia'); await champs.nth(1).fill('Fotso'); await champs.nth(2).fill('pas-un-email');
await page.locator('.nl-reg__cta').click(); await page.waitForTimeout(500);
verifier('inscription : e-mail invalide refusé', /1\/2/.test(await page.locator('body').innerText()));
await champs.nth(2).fill('nadia@test.local');
await page.waitForTimeout(1800);
verifier('inscription : un domaine non reconnu est signalé', /Domaine non reconnu/.test(await page.locator('body').innerText()));
await champs.nth(2).fill('nadia@univ-yde1.cm');
await page.waitForTimeout(1800);
verifier('inscription : le domaine institutionnel est reconnu', !/Domaine non reconnu/.test(await page.locator('body').innerText()));
await page.locator('.nl-reg__cta').click(); await page.waitForTimeout(500);
verifier('inscription : sans consentement, on ne passe pas', /1\/2/.test(await page.locator('body').innerText()));
await page.locator('input[type="checkbox"]').first().check();
await page.locator('.nl-reg__cta').click(); await page.waitForTimeout(1500);
verifier('inscription : étape 2 (parcours académique)', /2\/2/.test(await page.locator('body').innerText()));

// ── Cascade académique, listes servies par l'API ──────────────────────────
await page.locator('.nl-reg__cascade').nth(0).click(); await page.waitForTimeout(1500);
const unis = await sheet.innerText();
verifier('cascade : la liste des universités vient du serveur', /Yaound/.test(unis), unis.slice(0, 80).replace(/\n/g, ' '));
await sheet.getByText('Saint Jean Ingénieur (SJI)').first().click(); await page.waitForTimeout(1200);
await page.locator('.nl-reg__cascade').nth(1).click(); await page.waitForTimeout(1500);
const cycles = await sheet.innerText();
verifier('cascade : les cycles s’affichent', /Ingénieur/.test(cycles), cycles.slice(0, 80).replace(/\n/g, ' '));
await sheet.getByText(/Ingénieur/).first().click(); await page.waitForTimeout(1200);
const cascade = (nom) => page.locator('.nl-reg__cascade', { hasText: new RegExp(`^\\s*${nom}`) });
await cascade('Filière').click(); await page.waitForTimeout(1500);
const fil = await sheet.innerText();
verifier('cascade : les filières s’affichent', /Informatique/.test(fil), fil.slice(0, 80).replace(/\n/g, ' '));
await sheet.getByText(/Informatique/).first().click(); await page.waitForTimeout(1500);
await cascade('Niveau').click(); await page.waitForTimeout(1500);
const niv = await sheet.innerText();
verifier('cascade : les niveaux de la filière s’affichent', /iveau|Master|Ing|\d/.test(niv) && !/Aucun résultat/.test(niv), niv.slice(0, 80).replace(/\n/g, ' '));
await sheet.getByText(/iveau \d|Master \d|Ingénieur \d|\bN\d/).first().click(); await page.waitForTimeout(1200);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-inscription-etape2.png' });
page.on('response', async (r) => { if (r.url().includes('/auth/register')) console.log('   register →', r.status(), (await r.text().catch(() => '')).slice(0, 300)); });
await page.locator('.nl-reg__cta').click(); await page.waitForTimeout(3000);
if (!/otp/.test(chemin(page))) console.log('   page:', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 400));
verifier('inscription : le code est demandé (page de vérification)', /otp/.test(chemin(page)), chemin(page));
const cree = (await page.evaluate(async () => 1), execSync(`node -e "const{MongoClient}=require('../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27555');const u=await c.db('nltest').collection('users').findOne({email:'nadia@univ-yde1.cm'});console.log(JSON.stringify({ok:!!u,verifie:u&&u.isEmailVerified,niveau:u&&u.niveau,cycle:u&&u.cycle,filiere:u&&u.filiere,universiteId:!!(u&&u.universiteId)}));await c.close()})()"`).toString().trim());
verifier('inscription : compte créé en base avec son parcours', /"ok":true/.test(cree) && /"universiteId":true/.test(cree), cree);

// ── Code à usage unique ───────────────────────────────────────────────────
const cases = page.locator('.nl-otp__case');
const saisir = async (c) => { for (let i = 0; i < 6; i++) await cases.nth(i).fill(c[i]); };
await saisir('000000'); await page.waitForTimeout(2000);
verifier('code : un faux code est refusé avec un message', (await page.locator('.nl-otp__erreur').count()) > 0 && /otp/.test(chemin(page)));
const bon = code('nadia@univ-yde1.cm');
for (let i = 0; i < 6; i++) await cases.nth(i).fill('');
await saisir(bon); await page.waitForTimeout(3000);
verifier('code : le bon code ouvre directement l’application, sans choix de PIN', /\/app\/(home|verification)/.test(chemin(page)), chemin(page));
const apt = execSync(`node -e "const{MongoClient}=require('../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27555');const db=c.db('nltest');const u=await db.collection('users').findOne({email:'nadia@univ-yde1.cm'});const t=await db.collection('trusteddevices').countDocuments({userId:u._id});console.log(JSON.stringify({pin:!!u.pinHash,verifie:u.isEmailVerified,appareils:t}));await c.close()})()"`).toString().trim();
verifier('inscription : compte créé SANS PIN, e-mail validé, appareil mémorisé', /"pin":false/.test(apt) && /"verifie":true/.test(apt) && /"appareils":1/.test(apt), apt);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-apres-inscription.png' });

// ── Connexion : e-mail inconnu, PIN faux ──────────────────────────────────
await page.evaluate(() => { localStorage.removeItem('nl_jwt_token'); localStorage.removeItem('nl_refresh_token'); localStorage.removeItem('nl_user_data'); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('inconnu@test.local');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1500);
await taper('1234'); await page.waitForTimeout(2000);
verifier('connexion : e-mail inconnu → message, pas d’accès', /login/.test(chemin(page)) && (await page.locator('.nl-pin__erreur, [class*="erreur"]').count()) > 0);
await page.reload({ waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('etudiant@test.local');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1500);
await taper('0000'); await page.waitForTimeout(2000);
verifier('connexion : PIN faux → refusé', /login/.test(chemin(page)) && (await page.locator('.nl-pin__erreur, [class*="erreur"]').count()) > 0);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-pin-faux.png' });

// ── Connexion depuis un appareil nouveau : le code est exigé ──────────────
await page.evaluate(() => localStorage.setItem('nl_device_id', 'telephone-neuf-0123456789abcdefghij'));
await page.reload({ waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('etudiant@test.local');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1500);
await taper('1234'); await page.waitForTimeout(3000);
verifier('appareil nouveau : le code est demandé', /otp/.test(chemin(page)), chemin(page));
const c2 = page.locator('.nl-otp__case');
const bon2 = code('etudiant@test.local');
for (let i = 0; i < 6; i++) await c2.nth(i).fill(bon2[i]);
await page.waitForTimeout(4000);
verifier('appareil nouveau : le bon code ouvre la session', /\/app\/home/.test(chemin(page)), chemin(page));
await page.evaluate(() => { localStorage.removeItem('nl_jwt_token'); localStorage.removeItem('nl_refresh_token'); localStorage.removeItem('nl_user_data'); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('etudiant@test.local');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1500);
await taper('1234'); await page.waitForTimeout(3500);
verifier('appareil devenu connu : plus de code', /\/app\/home/.test(chemin(page)), chemin(page));

// ── PIN oublié ────────────────────────────────────────────────────────────
await page.evaluate(() => { localStorage.removeItem('nl_jwt_token'); localStorage.removeItem('nl_refresh_token'); localStorage.removeItem('nl_user_data'); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('etudiant@test.local');
await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1500);
await page.locator('.nl-loginpin__lien').first().click(); await page.waitForTimeout(1000);
verifier('PIN oublié : la page de récupération s’ouvre', /reset-pin/.test(chemin(page)), chemin(page));
await page.locator('.nl-resetpin__champ input[type="email"]').fill('etudiant@test.local');
await page.locator('.nl-resetpin__cta').click(); await page.waitForTimeout(2500);
if (!(await page.locator('.nl-resetpin__champ-code').count())) console.log('   reset page:', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 300));
await page.locator('.nl-resetpin__champ-code').fill('000000');
await page.locator('.nl-resetpin__cta').click(); await page.waitForTimeout(2000);
// Le code n'est vérifié par le serveur qu'avec le nouveau PIN : on va au bout avec un faux code.
await taper('8264'); await page.waitForTimeout(1500);
await taper('8264'); await page.waitForTimeout(3000);
const faux = await page.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'etudiant@test.local', pin: '8264', deviceId: 'appareil-de-test-0123456789abcdef' }) })).status);
verifier('PIN oublié : avec un faux code, le PIN n’est pas changé', faux === 401, `${faux}`);
verifier('PIN oublié : l’erreur est montrée', !/\/app\/home/.test(chemin(page)), chemin(page));
await page.goto(`${base}/app/login/reset-pin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// La démarche en cours est reprise là où elle en était (code déjà envoyé) : on recommence.
for (let essai = 0; essai < 3 && !(await page.locator('.nl-resetpin__champ input[type="email"]').count()); essai++) {
  await page.locator('.nl-resetpin__lien--discret').click().catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.cdk-overlay-container button', { hasText: /abandonner/i }).last().click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.goto(`${base}/app/login/reset-pin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
}
await page.locator('.nl-resetpin__champ input[type="email"]').fill('etudiant@test.local');
await page.locator('.nl-resetpin__cta').click(); await page.waitForTimeout(2500);
await page.locator('.nl-resetpin__champ-code').fill(code('etudiant@test.local'));
await page.locator('.nl-resetpin__cta').click(); await page.waitForTimeout(2000);
await taper('8264'); await page.waitForTimeout(1500);
await taper('8264'); await page.waitForTimeout(4000);
const ok55 = await page.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'etudiant@test.local', pin: '8264', deviceId: 'appareil-de-test-0123456789abcdef' }) })).status);
verifier('PIN oublié : le nouveau PIN fonctionne', ok55 === 200, `${ok55}`);

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs));
bilan();
await navigateur.close();
