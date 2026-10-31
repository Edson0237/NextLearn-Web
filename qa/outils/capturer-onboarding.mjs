import { chromium } from 'playwright';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block', colorScheme: process.argv[2] ?? 'light' });
const p = await ctx.newPage();
await p.goto('http://localhost:4200/app/onboarding', { waitUntil: 'networkidle' });
await p.waitForTimeout(3500);
await p.screenshot({ path: `qa/screenshots/refonte/onb-${process.argv[2] ?? 'light'}.png` });
await nav.close();
