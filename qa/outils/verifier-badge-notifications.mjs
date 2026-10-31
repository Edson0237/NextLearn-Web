/**
 * Éprouve la pastille de notifications de la cloche.
 *
 * Le scénario est celui de l'étudiant : trois notifications non lues, il les
 * ouvre toutes, il revient - et la pastille doit avoir disparu **sans qu'il
 * recharge la page**. L'accueil est un onglet gardé monté : il ne se
 * recréait jamais, et gardait l'ancien chiffre.
 *
 * L'API simulée garde l'état : lire côté client doit réellement changer ce
 * que le serveur répond ensuite, sinon on ne teste que l'écran.
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4200';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 864e5).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u1', email: 'c@e.test', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});

const notifs = [1, 2, 3].map((i) => ({ _id: `n${i}`, titre: `Notification ${i}`, message: 'Un nouveau document est disponible.', type: 'document', lu: false, createdAt: new Date().toISOString() }));
const nonLues = () => notifs.filter((n) => !n.lu).length;

await ctx.route('**/api/**', async (route) => {
  const url = route.request().url();
  const rep = (corps) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  if (/notifications\/unread-count/.test(url)) return rep({ data: { count: nonLues() } });
  if (/notifications\/read-all/.test(url)) { notifs.forEach((n) => (n.lu = true)); return rep({ data: {} }); }
  const un = /notifications\/(\w+)\/read/.exec(url);
  if (un) { const n = notifs.find((x) => x._id === un[1]); if (n) n.lu = true; return rep({ data: {} }); }
  if (/\/api\/notifications/.test(url)) return rep({ data: notifs });
  if (/verification/.test(url)) return rep({ data: { statut: 'APPROVED' } });
  return rep({ data: [], meta: { page: 1, totalPages: 1, total: 0 } });
});

const page = await ctx.newPage();
const pastille = async () => (await page.locator('.nl-entete__pastille').first().innerText().catch(() => '')).trim() || 'aucune';
const resultats = [];
const noter = (quoi, ok, detail) => { resultats.push(ok); console.log(`  ${ok ? 'ok   ' : 'ÉCHEC'} ${quoi} - ${detail}`); };

console.log('- Pastille de notifications -');
await page.goto(base + '/app/home', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
noter('accueil : 3 non lues', (await pastille()) === '3', `pastille = ${await pastille()}`);

// Un autre onglet doit porter la même pastille - il n'en avait jamais.
await page.locator('a[href="/app/progression"]').click();
await page.waitForTimeout(2500);
noter('progression : même pastille', (await pastille()) === '3', `pastille = ${await pastille()}`);

// On lit tout, par l'interface, comme l'étudiant.
await page.locator('.nl-entete__cloche').first().click();
await page.waitForTimeout(2500);
// Le bouton réel : `Tout lire`. Un sélecteur approximatif ne cliquait rien et
// la sonde échouait pour une raison qui n'avait rien à voir avec la pastille.
await page.locator('.notifs__mark-all').click();
await page.waitForTimeout(1500);
console.log(`  (côté serveur simulé : ${nonLues()} non lue(s))`);

// Retour à l'accueil SANS rechargement : c'est tout le point.
await page.locator('a[href="/app/home"]').click().catch(async () => { await page.goBack(); });
await page.waitForTimeout(2500);
noter('accueil après lecture : pastille disparue', (await pastille()) === 'aucune', `pastille = ${await pastille()}`);

await page.locator('a[href="/app/progression"]').click();
await page.waitForTimeout(2000);
noter('progression après lecture : pastille disparue', (await pastille()) === 'aucune', `pastille = ${await pastille()}`);

await nav.close();
if (resultats.includes(false)) { console.error('\nÉCHEC : la pastille ne suit pas la lecture.'); process.exit(1); }
console.log('\nLa pastille suit la lecture, sans rechargement.');
