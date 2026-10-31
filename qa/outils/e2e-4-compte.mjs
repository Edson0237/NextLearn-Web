import { execSync } from 'node:child_process';
import { ouvrir, connecter, api, verifier, bilan, echecs, base, DEVICE } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs && node qa/outils/e2e-seed-notifs.cjs');
const { navigateur, page, journal } = await ouvrir();
await connecter(page);

// ── Notifications ─────────────────────────────────────────────────────────
let n = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : le serveur compte 2 non lues', (n.count ?? n) === 2, JSON.stringify(n));
await page.goto(`${base}/app/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const badge = async () => (await page.locator('.nl-entete__pastille').allInnerTexts()).join('|');
verifier('accueil : le badge affiche 2', (await badge()).includes('2'), await badge());
await page.goto(`${base}/app/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
verifier('notifications : la liste affiche 2 éléments', (await page.locator('.notifs__item').count()) === 2);
await page.locator('.notifs__item').first().click();
await page.waitForTimeout(2000);
verifier('notifications : un clic ouvre la destination (fiche du document)', /\/bibliotheque\/doc\//.test(page.url()), page.url());
n = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : lue côté serveur après ouverture', (n.count ?? n) === 1, JSON.stringify(n));
await page.goto(`${base}/app/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.notifs__mark-all').click();
await page.waitForTimeout(1500);
n = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : « tout lire » vide le compteur', (n.count ?? n) === 0, JSON.stringify(n));
await page.goto(`${base}/app/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('accueil : le badge disparaît', !/\d/.test(await badge()), await badge());

// ── Lecture reprise / séance d'étude ──────────────────────────────────────
const docs = (await api(page, 'GET', '/documents?limit=2')).data; const arr = Array.isArray(docs) ? docs : docs.items ?? docs.documents;
const id = arr[0]._id ?? arr[0].id;
await page.goto(`${base}/app/bibliotheque/doc/${id}/read`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const c = document.querySelector('pdf-viewer, .ng2-pdf-viewer-container'); const s = document.querySelector('.ng2-pdf-viewer-container') ?? c; if (s) s.scrollTop = 1800; });
await page.waitForTimeout(4500);
const prog = (await api(page, 'GET', `/progress/lecture/${id}`));
verifier('lecture : la page atteinte est enregistrée côté serveur', prog.status === 200 && (prog.data?.pageCourante ?? 0) > 1, JSON.stringify(prog.data)?.slice(0, 400));
await page.goto(`${base}/app/home`, { waitUntil: 'networkidle' });

// ── Réglages : niveau ─────────────────────────────────────────────────────
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByText('Ta promotion actuelle').click();
await page.waitForTimeout(1000);
await page.locator('.cdk-overlay-container').getByText('Niveau 2').click();
await page.waitForTimeout(1800);
const profil = (await api(page, 'GET', '/profile')).data.user;
verifier('niveau : changé côté serveur', profil.niveau === 'N2', profil.niveau);
verifier('niveau : le profil local reste intact', await page.evaluate(() => JSON.parse(localStorage.getItem('nl_user_data')).nom === 'Djomo'));
const refus = await api(page, 'PUT', '/profile', { niveau: 'N5' });
verifier('niveau : le serveur refuse un niveau étranger au cycle', refus.status === 400, `${refus.status}`);
await api(page, 'PUT', '/profile', { niveau: 'N3' });

// ── Appareils connectés ───────────────────────────────────────────────────
await page.evaluate(async () => {
  await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'etudiant@test.local', pin: '1234', deviceId: 'autre-appareil-0123456789abcdef', label: 'Firefox · Linux' }) });
});
// Le 2e appareil est inconnu : l'OTP serait exigé. On l'enregistre comme de confiance en base.
await page.goto(`${base}/app/profil/appareils`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const sess = (await api(page, 'GET', '/auth/sessions')).data;
verifier('appareils : la session courante est listée', Array.isArray(sess) && sess.length >= 1 && sess.some((s) => s.courante), JSON.stringify(sess).slice(0, 200));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-appareils.png' });

// ── Changement de PIN puis reconnexion ────────────────────────────────────
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('Changer le code de déverrouillage').click();
await page.waitForTimeout(500);
const champs = page.locator('.nl-sl__modal input[type="password"]');
await champs.nth(0).fill('1234'); await champs.nth(1).fill('4321'); await champs.nth(2).fill('4321');
await page.locator('.nl-sl__btn--primary').click();
await page.waitForTimeout(2000);
const log = await page.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'etudiant@test.local', pin: '4321', deviceId: 'appareil-de-test-0123456789abcdef' }) })).status);
verifier('PIN : le nouveau code ouvre la session', log === 200, `${log}`);
const ancien = await page.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'etudiant@test.local', pin: '1234', deviceId: 'appareil-de-test-0123456789abcdef' }) })).status);
verifier('PIN : l’ancien code est refusé', ancien === 401, `${ancien}`);

// ── Thème et langue ───────────────────────────────────────────────────────
await page.goto(`${base}/app/profil/parametres`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByText('Clair, sombre ou suivi du système').click();
await page.waitForTimeout(800);
await page.locator('.cdk-overlay-container').getByText('Sombre', { exact: true }).click();
await page.waitForTimeout(800);
verifier('thème : le mode sombre s’applique', (await page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? document.querySelector('[data-theme]')?.getAttribute('data-theme'))) === 'dark');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('thème : il survit au rechargement', (await page.evaluate(() => document.querySelector('[data-theme]')?.getAttribute('data-theme'))) === 'dark');

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs), JSON.stringify(journal.console.filter((c) => !/40[1-9]/.test(c))));
bilan();
await navigateur.close();
