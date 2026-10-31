import { execSync } from 'node:child_process';
import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const { navigateur, page, journal } = await ouvrir();
await connecter(page);

// ── Support ───────────────────────────────────────────────────────────────
const tk = await api(page, 'POST', '/support/tickets', { categorie: 'CONNEXION', sujet: 'Problème de test', message: 'Description de test suffisante pour le support.' });
verifier('support : un ticket est créé', tk.status === 201 || tk.status === 200, `${tk.status}`);
await page.goto(`${base}/app/support/tickets`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('support : le ticket apparaît dans la liste', (await page.locator('body').innerText()).includes('Problème de test'));

// ── Navigation de la bibliothèque : matières → matière → document ─────────
await page.goto(`${base}/app/bibliotheque/matieres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const cartes = page.locator('a[href*="matiere/"], .cat__carte, [class*="catalogue"] button');
const nbm = await page.locator('main button, .catalogue button, .cat button').count();
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-matieres.png' });
verifier('matières : la page affiche du contenu', (await page.locator('body').innerText()).length > 200, `${nbm} boutons`);

// ── Langue ────────────────────────────────────────────────────────────────
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('Langue', { exact: true }).first().click();
await page.waitForTimeout(800);
await page.locator('.cdk-overlay-container').getByText(/English|Anglais/).first().click();
await page.waitForTimeout(2000);
const txtEn = await page.locator('body').innerText();
verifier('langue : l’interface passe en anglais', /Appearance|Notifications|Sign out|Log out|Account/.test(txtEn) && !/Apparence/.test(txtEn), txtEn.slice(0, 80).replace(/\n/g, ' '));
await page.getByText(/Language|Langue/).first().click();
await page.waitForTimeout(600);
await page.locator('.cdk-overlay-container').getByText(/Français|French/).first().click();
await page.waitForTimeout(1500);

// ── Déconnexion puis reconnexion (appareil connu : sans OTP) ──────────────
await page.getByText('Quitter ce compte sur cet appareil').click();
await page.waitForTimeout(800);
await page.locator('.cdk-overlay-container button', { hasText: /déconnecter/i }).last().click();
await page.waitForTimeout(2500);
verifier('déconnexion : la session locale est vidée', await page.evaluate(() => !localStorage.getItem('nl_jwt_token')));
await connecter(page);
verifier('reconnexion : appareil connu, sans OTP', /\/app\/home/.test(page.url()));

// ── Suppression de compte (compte de test, base jetable) ──────────────────
await page.goto(`${base}/app/profil/supprimer-compte`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-suppression.png' });

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs));
bilan();
await navigateur.close();
