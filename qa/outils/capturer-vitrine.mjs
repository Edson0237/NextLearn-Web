/** Capture la page d'accueil publique (ordinateur et téléphone) et liste les requêtes qui sortent du domaine. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
for (const [nom, w, h, dpr] of [['ordinateur', 1440, 900, 1], ['telephone', 390, 844, 2]]) {
  const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'fr-FR', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const externes = new Set();
  page.on('request', (r) => { const u = new URL(r.url()); if (!/localhost|127\.0\.0\.1/.test(u.hostname) && u.protocol.startsWith('http')) externes.add(u.hostname); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/tmp/claude-1001/vitrine-${nom}.png`, fullPage: true });
  console.log(nom, '| hôtes externes :', [...externes].join(', ') || 'aucun', '| débordement horizontal :', await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await nav.close();
}
