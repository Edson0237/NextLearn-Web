/** Une carte de ressource montre toujours pages, poids, vues et note - même quand le serveur n'a rien à dire. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const docs = [
  { _id: 'a', titre: 'Complet', type: 'COURS', matiereId: { _id: 'm1', nom: 'Bases de données' }, niveau: 'N2', pages: 12, tailleMb: 2.4, vues: 31, noteMoyenne: 4.5 },
  { _id: 'b', titre: 'Tout à zéro', type: 'TD', matiereId: { _id: 'm1', nom: 'Bases de données' }, niveau: 'N2', pages: 0, tailleMb: 0, vues: 0, noteMoyenne: 0 },
  { _id: 'c', titre: 'Champs absents', type: 'SYNTHESE', matiereId: { _id: 'm1', nom: 'Bases de données' }, niveau: 'N2' },
];
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: /verification/.test(r.request().url()) ? { statut: 'APPROVED' } : docs }) }));
const page = await ctx.newPage();
await page.goto(`${base}/app/bibliotheque/matiere/m1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const cartes = await page.locator('nl-document-card').evaluateAll((l) => l.map((c) => ({ titre: c.querySelector('.nl-doc-card__titre')?.textContent?.trim(), bas: c.querySelector('.nl-doc-card__bas')?.textContent?.replace(/\s+/g, ' ').trim() })));
for (const c of cartes) console.log(c.titre.padEnd(16), '→', c.bas);
const ok = cartes.length === 3 && cartes.every((c) => /p\./.test(c.bas) && /Mo/.test(c.bas)) && !/ 0 /.test(cartes[1].bas + ' ') && !cartes[1].bas.includes('-', cartes[1].bas.indexOf('Mo'));
console.log(ok ? 'OK : les trois cartes ont la même forme' : 'ÉCHEC');
await page.screenshot({ path: 'qa/screenshots/refonte/cartes-ressource.png' });
await nav.close();
