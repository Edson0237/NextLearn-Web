/**
 * Éprouve le scanner : deux photos → un PDF de deux pages → joint au formulaire → envoyé.
 * Les images de test sont dessinées dans la page (un faux « cahier » penché).
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
let corpsEnvoye = null;
await ctx.route('**/api/**', async (r) => {
  const u = r.request().url(); let data = [];
  if (/verification/.test(u)) data = { statut: 'APPROVED' };
  else if (/document-types/.test(u)) data = [{ value: 'TD', label: 'TD', collection: 'documents' }];
  else if (/matieres/.test(u)) data = [{ _id: 'm1', nom: 'Bases de données' }];
  else if (/limites-fichier/.test(u)) data = { maxFileSizeMb: 50, formats: ['pdf'] };
  else if (/unread-count/.test(u)) data = { count: 0 };
  if (r.request().method() === 'POST' && /submissions$/.test(u)) { corpsEnvoye = r.request().postDataBuffer(); data = { _id: 'x', status: 'en_attente' }; }
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const erreurs = []; page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
const png = async (couleur, texte) => Buffer.from((await page.evaluate(([c, t]) => {
  const k = document.createElement('canvas'); k.width = 1200; k.height = 1600; const g = k.getContext('2d');
  g.fillStyle = c; g.fillRect(0, 0, 1200, 1600); g.fillStyle = '#222'; g.font = '90px sans-serif'; g.fillText(t, 100, 300);
  for (let i = 0; i < 12; i++) g.fillRect(100, 400 + i * 90, 900 - (i % 3) * 200, 14);
  return k.toDataURL('image/jpeg', 0.9).split(',')[1];
}, [couleur, texte])), 'base64');

await page.goto(`${base}/app/depots/nouveau`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.nl-depf__scanner').click();
await page.waitForTimeout(1200);
const r = {};
r.surScanner = new URL(page.url()).pathname;
mkdirSync('qa/fixtures', { recursive: true });
const p1 = await png('#f3e9c6', 'Page 1 — Réseaux'); const p2 = await png('#dfe8f5', 'Page 2 — Modèle OSI');
writeFileSync('qa/fixtures/scan-page-1.jpg', p1); writeFileSync('qa/fixtures/scan-page-2.jpg', p2);
await page.locator('input[type="file"][capture]').setInputFiles('qa/fixtures/scan-page-1.jpg');
await page.waitForSelector('.nl-scan__page');
await page.locator('input[type="file"]:not([capture])').setInputFiles('qa/fixtures/scan-page-2.jpg');
await page.waitForFunction(() => document.querySelectorAll('.nl-scan__page').length === 2, null, { timeout: 15000 });
r.pages = await page.locator('.nl-scan__page').count();
await page.screenshot({ path: 'qa/screenshots/refonte/scanner-pages.png', fullPage: true });
await page.locator('.nl-scan__page').first().getByLabel(/Tourner/i).click();
await page.waitForTimeout(1800);
const dims = await page.locator('.nl-scan__page img').first().evaluate((i) => [i.naturalWidth, i.naturalHeight]);
r.premierePageApresRotation = dims; // 1200×1600 → couchée : 1600 × 1200 (réduit à 2000 max)
await page.getByRole('button', { name: /Terminer/ }).click();
await page.waitForURL(/depots\/nouveau/, { timeout: 15000 });
await page.waitForTimeout(800);
r.retourFormulaire = new URL(page.url()).pathname;
r.fichierAffiche = (await page.locator('.nl-depf__fichier-infos').innerText().catch(() => '')).replace(/\n/g, ' ');
await page.screenshot({ path: 'qa/screenshots/refonte/scanner-formulaire.png', fullPage: true });
// Envoi réel du formulaire, pour récupérer le PDF tel que le serveur le recevrait.
await page.locator('input[type="text"]').first().fill('Mon scan de réseaux');
await page.locator('textarea').fill('Mes notes de cours sur les réseaux, deux pages.');
await page.locator('select').nth(0).selectOption('TD');
await page.locator('select').nth(1).selectOption('m1');
await page.locator('.nl-depf__licence').first().click();
await page.getByRole('button', { name: /Envoyer/ }).click();
await page.waitForTimeout(2500);
r.messageForm = (await page.locator('.nl-depf__erreur, [role=alert], .nl-toast').allInnerTexts()).join(' | ');
r.urlApresEnvoi = new URL(page.url()).pathname;
if (corpsEnvoye) {
  const t = corpsEnvoye.toString('latin1');
  const debut = t.indexOf('%PDF-1.4');
  r.pdfDansLEnvoi = debut >= 0;
  r.pagesDuPdf = Number(/\/Count (\d+)/.exec(t)?.[1]);
  r.formats = [...t.matchAll(/MediaBox \[0 0 (\d+) (\d+)\]/g)].map((m) => `${m[1]}×${m[2]}`);
  r.champs = [...t.matchAll(/name="(\w+)"/g)].map((m) => m[1]).join(',');
  r.tailleKo = Math.round((t.length - debut) / 1024);
  writeFileSync('qa/fixtures/scan-sortie.pdf', corpsEnvoye.subarray(Buffer.from(t.slice(0, debut), 'latin1').length));
}
r.erreurs = erreurs;
console.log(JSON.stringify(r, null, 1));
await nav.close();
