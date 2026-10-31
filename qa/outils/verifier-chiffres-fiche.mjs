import { chromium } from 'playwright';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const cas = { neuf: { vues: 0, noteMoyenne: 0 }, vivant: { vues: 31, noteMoyenne: 4.5 } };
for (const [nom, v] of Object.entries(cas)) {
  const c = await ctx.newPage();
  await c.route('**/api/**', (r) => { const u = r.request().url(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: /documents\/d1$/.test(u) ? { _id: 'd1', titre: 'Doc', type: 'COURS', matiereId: { _id: 'm', nom: 'M' }, niveau: 'N2', pages: 12, tailleMb: 2, telechargements: 3, urlPdf: 'x', ...v } : /verification/.test(u) ? { statut: 'APPROVED' } : [] }) }); });
  await c.goto('http://localhost:4200/app/bibliotheque/doc/d1', { waitUntil: 'networkidle' });
  await c.waitForTimeout(2500);
  console.log(nom.padEnd(7), (await c.locator('.doc-detail__chiffres').innerText()).replace(/\s+/g, ' '));
  await c.screenshot({ path: `qa/screenshots/refonte/fiche-chiffres-${nom}.png` });
  await c.close();
}
await nav.close();
