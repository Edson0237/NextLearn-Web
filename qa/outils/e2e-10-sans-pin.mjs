/**
 * Le PIN est facultatif : inscription sans PIN, connexion par code envoyé par
 * e-mail, création d'un PIN depuis les réglages, puis connexion avec ce PIN.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { ouvrir, verifier, bilan, echecs, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const { navigateur, page, journal } = await ouvrir({ neuf: true });
const chemin = () => new URL(page.url()).pathname;
const code = (email) => execSync(`node qa/outils/e2e-otp.cjs ${email}`).toString().trim();
// Un fichier temporaire plutôt que `node -e` : le shell avalerait les `$set` / `$unset`.
const bd = (script) => {
  const f = 'qa/outils/.bd-tmp.cjs';
  writeFileSync(f, `const{MongoClient}=require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27555');const db=c.db('nltest');${script};await c.close()})()`);
  try { return execSync(`node ${f}`).toString().trim(); } finally { rmSync(f, { force: true }); }
};
const continuer = async () => { await page.getByRole('button', { name: /continuer avec le code pin/i }).click(); await page.waitForTimeout(1800); };
const saisirCode = async (c) => { const cases = page.locator('.nl-otp__case'); for (let i = 0; i < 6; i++) await cases.nth(i).fill(c[i]); await page.waitForTimeout(3500); };
const EMAIL = 'etudiant@test.local';

// ── Inscription d'un compte SANS PIN, créé directement en base (le parcours
//    d'inscription par l'interface est éprouvé par e2e-8) ──────────────────
bd(`const u=await db.collection('users').findOne({email:'${EMAIL}'});
await db.collection('users').updateOne({_id:u._id},{$unset:{pinHash:1}});
await db.collection('trusteddevices').deleteMany({userId:u._id});`);

// ── Connexion d'un compte sans PIN : l'adresse, puis un code par e-mail ──
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill(EMAIL);
await continuer();
verifier('compte sans PIN : le pavé du PIN ne s’affiche pas, le code est demandé', /otp/.test(chemin()) && (await page.locator('nl-pin-input').count()) === 0, chemin());
await saisirCode(code(EMAIL));
verifier('le bon code ouvre la session', /\/app\/home/.test(chemin()), chemin());

// ── Un compte avec PIN voit, lui, le pavé ──────────────────────────────────
await page.evaluate(() => { for (const k of ['nl_jwt_token', 'nl_refresh_token', 'nl_user_data']) localStorage.removeItem(k); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('admin@nextlearn.local');
await continuer();
verifier('compte avec PIN : le pavé du PIN s’affiche', (await page.locator('nl-pin-input').count()) === 1, chemin());
await page.getByRole('button', { name: /changer d’adresse/i }).click(); await page.waitForTimeout(500);
verifier('« changer d’adresse » ramène à la saisie de l’e-mail', (await page.locator('nl-pin-input').count()) === 0);
await page.locator('input[type="email"]').fill('inconnu@test.local');
await continuer();
verifier('adresse inconnue : même écran que pour un compte avec PIN (rien n’est révélé)', (await page.locator('nl-pin-input').count()) === 1);

// ── Création d'un PIN depuis les réglages ──────────────────────────────────
await page.evaluate(() => { for (const k of ['nl_jwt_token', 'nl_refresh_token', 'nl_user_data']) localStorage.removeItem(k); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill(EMAIL);
await continuer();
await saisirCode(code(EMAIL));
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const reglages = await page.locator('body').innerText();
verifier('réglages : « Code PIN » propose de le créer (facultatif)', /Facultatif/i.test(reglages));
verifier('réglages : pas de « Verrouiller l’application » sans PIN', !/Verrouiller l’application/i.test(reglages));
await page.getByText('Code PIN').first().click(); await page.waitForTimeout(800);
verifier('la fenêtre ne demande pas de code actuel', (await page.locator('.nl-sl__pin-field').count()) === 2);
const champs = page.locator('.nl-sl__pin-field input');
await champs.nth(0).fill('4821'); await champs.nth(1).fill('4821');
await page.getByRole('button', { name: /enregistrer|valider|créer|confirmer/i }).last().click(); await page.waitForTimeout(2500);
const apres = bd(`const u=await db.collection('users').findOne({email:'${EMAIL}'});console.log(JSON.stringify({pin:!!u.pinHash}))`);
verifier('le PIN est enregistré côté serveur', /"pin":true/.test(apres), apres);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
verifier('réglages : « Verrouiller l’application » apparaît maintenant', /Verrouiller l’application/i.test(await page.locator('body').innerText()));

// ── Connexion avec le PIN créé ──────────────────────────────────────────────
await page.evaluate(() => { for (const k of ['nl_jwt_token', 'nl_refresh_token', 'nl_user_data']) localStorage.removeItem(k); });
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill(EMAIL);
await continuer();
verifier('avec un PIN, le pavé revient', (await page.locator('nl-pin-input').count()) === 1);
for (const c of '4821') await page.locator('nl-pin-input').getByRole('button', { name: c, exact: true }).click();
await page.waitForTimeout(3500);
verifier('le PIN créé ouvre la session (appareil déjà connu : sans code)', /\/app\/home/.test(chemin()), chemin());

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
bilan();
await navigateur.close();
