/**
 * Éprouve le passage de la vitrine vers l'application.
 *
 * Le carrousel des fondateurs faisait tomber l'application entière : son
 * minuteur modifiait `currentSlide` entre la passe de détection et la passe
 * de vérification du même cycle, Angular levait `NG0100`, et le gestionnaire
 * d'erreurs — qui traite toute erreur comme fatale — affichait « Quelque
 * chose s'est mal passé » à la place de l'onboarding.
 *
 * Il fallait laisser le carrousel boucler au moins un tour complet pour le
 * voir : d'où l'attente, qui n'est pas du confort.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4200';
mkdirSync('qa/screenshots/refonte', { recursive: true });

const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'] });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-FR' });
const page = await ctx.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 200)); });

await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
// Un tour complet du carrousel, et un peu plus : 3 diapositives × 4 s.
await page.waitForTimeout(14000);

// Navigation côté client, comme un vrai clic — un rechargement ne reproduit
// rien, puisqu'il détruit tout avant de naviguer.
await page.locator('.hero-mockup').first().click();
await page.waitForTimeout(8000);

const url = page.url().replace(base, '');
const texte = (await page.locator('body').innerText()).trim();
await page.screenshot({ path: 'qa/screenshots/refonte/vitrine-vers-app.png' });
await nav.close();

const planté = /mal pass|something went wrong/i.test(texte);
const ng0100 = erreurs.some((e) => e.includes('NG0100'));
console.log('— Vitrine → application —');
console.log(`  URL      : ${url}`);
console.log(`  écran    : ${texte.slice(0, 60).replace(/\n+/g, ' | ')}`);
console.log(`  NG0100   : ${ng0100 ? 'OUI' : 'non'}`);
console.log(`  erreurs  : ${erreurs.length ? [...new Set(erreurs)].slice(0, 2).join(' ; ') : 'aucune'}`);

if (planté || ng0100 || !url.startsWith('/app')) {
  console.error('\nÉCHEC : le passage vers l’application ne mène pas à l’onboarding.');
  process.exit(1);
}
console.log('\nLa vitrine mène à l’application sans incident.');
