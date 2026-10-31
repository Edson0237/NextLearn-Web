import { ouvrir, connecter, echecs } from './e2e-lib.mjs';
const { navigateur, page, journal } = await ouvrir();
await connecter(page);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-home.png' });
console.log('URL', page.url());
console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs), JSON.stringify(journal.console));
console.log('APPELS', [...new Set(journal.api.map((a) => `${a.m} ${a.s} ${a.u}`))].join('\n'));
await navigateur.close();
