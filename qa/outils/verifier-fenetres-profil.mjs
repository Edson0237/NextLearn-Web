/** Les fenêtres des réglages (PIN, support) : elles s'ouvrent, valident leur saisie, envoient, et se ferment. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 900 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED', hasPin: true }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const envoyes = [];
await ctx.route('**/api/**', (r) => {
  const q = r.request(); const u = q.url();
  if (q.method() !== 'GET') envoyes.push(`${q.method()} ${u.replace(/^.*\/api/, '')} ${q.postData() ?? ''}`);
  const data = /verification/.test(u) ? { statut: 'APPROVED' } : /change-pin/.test(u) ? { sessionsFermees: 2 } : /support\/tickets/.test(q.url()) && q.method() === 'POST' ? { id: 't1' } : [];
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
});
const page = await ctx.newPage();
const res = []; const v = (n, ok, d = '') => { res.push(ok); console.log(`${ok ? '  ✔' : '  ✘'} ${n}${d ? ' - ' + d : ''}`); };
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);

// ── PIN ──
await page.getByText('Code PIN').first().click(); await page.waitForTimeout(600);
v('fenêtre PIN : s’ouvre avec trois champs (code actuel, nouveau, confirmation)', (await page.locator('nl-pin-dialog .nl-sl__pin-field').count()) === 3);
const champs = page.locator('nl-pin-dialog .nl-sl__pin-field input');
await champs.nth(0).fill('123456'); await page.waitForTimeout(300);
v('quatre chiffres au plus', (await champs.nth(0).inputValue()) === '1234');
await page.locator('nl-pin-dialog .nl-sl__btn--primary').click(); await page.waitForTimeout(300);
v('saisie incomplète : un motif est affiché, rien n’est envoyé', (await page.locator('nl-pin-dialog .nl-sl__pin-erreur').count()) === 1 && !envoyes.some((e) => /change-pin/.test(e)));
await champs.nth(1).fill('4821'); await page.waitForTimeout(200); await champs.nth(2).fill('4821'); await page.waitForTimeout(300);
await page.locator('nl-pin-dialog .nl-sl__btn--primary').click(); await page.waitForTimeout(900);
v('PIN : envoi avec l’ancien et le nouveau code', envoyes.some((e) => /change-pin/.test(e) && /"ancienPin":"1234"/.test(e) && /"nouveauPin":"4821"/.test(e)), envoyes.find((e) => /change-pin/.test(e)));
v('PIN : la fenêtre se ferme et confirme', (await page.locator('nl-pin-dialog').count()) === 0 && /Code modifié/.test(await page.locator('body').innerText()));

// ── Support ──
await page.getByText(/Signaler un problème/).first().click(); await page.waitForTimeout(600);
v('fenêtre support : s’ouvre', (await page.locator('nl-support-dialog .nl-sl__modal').count()) === 1);
v('« Envoyer » reste grisé tant que sujet et message manquent', await page.locator('nl-support-dialog .nl-sl__btn--primary').isDisabled());
await page.locator('nl-support-dialog input[type="text"]').fill('Page vide');
await page.locator('nl-support-dialog textarea').fill('La bibliothèque reste blanche.');
v('… puis s’active', !(await page.locator('nl-support-dialog .nl-sl__btn--primary').isDisabled()));
await page.locator('nl-support-dialog .nl-sl__btn--primary').click(); await page.waitForTimeout(900);
v('support : le ticket part', envoyes.some((e) => /support\/tickets/.test(e) && /Page vide/.test(e)));
v('support : la fenêtre se ferme', (await page.locator('nl-support-dialog').count()) === 0);
await page.getByText('Code PIN').first().click(); await page.waitForTimeout(500);
await page.locator('nl-pin-dialog .nl-sl__overlay').click({ position: { x: 5, y: 5 } }); await page.waitForTimeout(400);
v('un clic sur le voile ferme la fenêtre', (await page.locator('nl-pin-dialog').count()) === 0);
console.log(`${res.filter(Boolean).length}/${res.length}`);
await nav.close();
