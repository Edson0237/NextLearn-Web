/** La page de vérification : parcours repris du profil, types de justificatif visibles, retour qui fonctionne. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'marvin@gmail.com', nom: 'Tientcheu', prenom: 'Marvin', universite: 'Saint Jean Ingénieur (SJI)', filiere: 'Master — Data Science', niveau: 'n4', cycle: 'master', langue: 'fr', verificationStatus: 'requis' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const soumis = [];
let depose = false;
await ctx.route('**/api/**', async (r) => {
  const u = r.request().url(); let data = [];
  if (/verification\/requests\/me/.test(u)) data = depose ? { id: 'v1', statut: 'en_attente', requis: true, tentatives: 1, resoumissionsRestantes: 2, submittedAt: new Date().toISOString() } : { statut: null, requis: true, resoumissionsRestantes: 3 };
  else if (/verification\/requests$/.test(u) && r.request().method() === 'POST') { soumis.push(r.request().postData() ?? ''); depose = true; data = { id: 'v1' }; }
  else if (/references\/justificatif-types/.test(u)) data = [
    { value: 'PV_REUSSITE', label: 'PV de réussite', description: 'Procès-verbal de réussite de la dernière année validée' },
    { value: 'ATTESTATION_SCOLARITE', label: 'Attestation de scolarité', description: 'Attestation délivrée par la scolarité' },
    { value: 'CARTE_ETUDIANT', label: 'Carte d’étudiant', description: 'Carte en cours de validité' }];
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const res = []; const v = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? '  ✔' : '  ✘'} ${n}${d ? ' — ' + d : ''}`); };
await page.goto(`${base}/app/verification`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
const t = await page.locator('body').innerText();
v('la page s’ouvre sur le formulaire', /\/app\/verification$/.test(page.url()), page.url());
v('le parcours est repris du profil (école, filière, niveau), sans être redemandé', /Saint Jean Ingénieur/.test(t) && /Data Science/.test(t) && /Master/i.test(t));
v('aucun champ « université / filière / niveau » à remplir', (await page.locator('input[type="text"]').count()) === 3, `${await page.locator('input[type="text"]').count()} champs texte (prénom, nom, matricule)`);
v('le nom et le prénom sont préremplis', (await page.locator('input[type="text"]').first().inputValue()) === 'Marvin');
await page.locator('.verif__cascade').click(); await page.waitForTimeout(800);
const options = await page.locator('.nl-select__ligne').allInnerTexts();
v('les types de justificatif sont visibles dans la feuille', options.length === 3 && options.every((o) => o.trim().length > 3), options.map((o) => o.split('\n')[0]).join(' | '));
await page.locator('.nl-select__ligne').nth(1).click(); await page.waitForTimeout(500);
v('le type choisi s’affiche', /Attestation de scolarité/.test(await page.locator('.verif__cascade').innerText()));
await page.screenshot({ path: '/tmp/claude-1001/verification.png', fullPage: true });
await page.locator('.verif__fichier input').setInputFiles({ name: 'attestation.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
v('le fichier choisi est nommé', /attestation\.pdf/.test(await page.locator('.verif__fichier').innerText()));
await page.locator('.verif__cta').click(); await page.waitForTimeout(1500);
v('l’envoi part avec l’école, la filière et le niveau du profil', soumis.length === 1 && /Saint Jean Ingénieur/.test(soumis[0]) && /Master — Data Science/.test(soumis[0]) && /N4/.test(soumis[0]));
v('juste après l’envoi, on arrive directement sur la page d’attente', /verification\/attente/.test(page.url()), page.url());
await page.screenshot({ path: '/tmp/claude-1001/attente.png', fullPage: true });
depose = false;
await page.goto(`${base}/app/verification`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
await page.getByRole('button', { name: /retour/i }).first().click(); await page.waitForTimeout(800);
v('« Retour » propose de quitter le compte (la garde ne laisse aller nulle part ailleurs)', /Quitter ce compte/.test(await page.locator('body').innerText()));
await page.getByRole('button', { name: /^déconnecter$/i }).click(); await page.waitForTimeout(2000);
v('… et déconnecte : on quitte la page de vérification', !/verification/.test(page.url()), page.url());
console.log(`${res.filter(Boolean).length}/${res.length}`);
await nav.close();
