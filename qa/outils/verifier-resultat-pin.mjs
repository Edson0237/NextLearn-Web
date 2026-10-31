/** Capture l'écran de résultat après la saisie du PIN : échec (PIN faux) puis succès. */
import { ouvrir, base } from './e2e-lib.mjs';
const { navigateur, page } = await ouvrir();
const taper = async (c) => { for (const ch of c) await page.locator('nl-pin-input').getByRole('button', { name: ch, exact: true }).click(); };
await page.goto(`${base}/app/login`, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill('etudiant@test.local');
await taper('0000'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'qa/screenshots/refonte/resultat-pin-echec.png' });
console.log('échec :', (await page.locator('nl-resultat-pin').innerText()).replace(/\n+/g, ' | '));
await page.getByRole('button', { name: 'Réessayer' }).click(); await page.waitForTimeout(500);
console.log('après « Réessayer », overlay retiré :', (await page.locator('nl-resultat-pin').count()) === 0);
await taper('1234'); await page.waitForTimeout(700);
await page.screenshot({ path: 'qa/screenshots/refonte/resultat-pin-succes.png' });
console.log('succès :', (await page.locator('nl-resultat-pin').innerText()).replace(/\n+/g, ' | '));
await page.waitForTimeout(2500);
console.log('puis :', new URL(page.url()).pathname);
await navigateur.close();
