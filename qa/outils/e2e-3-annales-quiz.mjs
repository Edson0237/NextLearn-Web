import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
const { navigateur, page, journal } = await ouvrir();
await connecter(page);
const liste = (r) => (Array.isArray(r) ? r : r?.items ?? r?.epreuves ?? r?.documents ?? r?.quizzes ?? []);

// ── Recherche ─────────────────────────────────────────────────────────────
await page.goto(`${base}/app/recherche`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.locator('.recherche__field input').fill('algorithm');
await page.waitForTimeout(2500);
const nb = await page.locator('.recherche__liste > *').count();
verifier('recherche : des résultats s’affichent pour « algorithm »', nb > 0, `${nb} résultats`);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-recherche.png' });
await page.locator('.recherche__field input').fill('zzzzintrouvable');
await page.waitForTimeout(2500);
verifier('recherche : état « aucun résultat »', (await page.locator('.recherche__liste > *').count()) === 0);
await page.locator('.recherche__field input').fill('algorithm');
await page.waitForTimeout(2000);
await page.locator('.recherche__liste > *').first().click();
await page.waitForTimeout(1500);
verifier('recherche : un résultat ouvre la fiche', /\/bibliotheque\/doc\//.test(page.url()), page.url());

// ── Épreuves ──────────────────────────────────────────────────────────────
await page.goto(`${base}/app/epreuves`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const eps = liste((await api(page, 'GET', '/epreuves?limit=50')).data);
verifier('épreuves : l’API en rend', eps.length > 0, `${eps.length}`);
const cartes = await page.locator('.nl-epl a, .nl-epl [class*="carte"], .nl-epl article').count();
verifier('épreuves : la liste en affiche', cartes > 0, `${cartes}`);
const ep = eps[0]; const eid = ep._id ?? ep.id;
await page.goto(`${base}/app/epreuves/${eid}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.evaluate(() => { window.__ouvertures = []; window.open = (u) => { window.__ouvertures.push(u); return null; }; });
const avant = (await api(page, 'GET', `/epreuves/${eid}`)).data.telechargements;
await page.locator('.nl-epd__cta').first().click();
await page.waitForTimeout(1500);
const ouv = await page.evaluate(() => window.__ouvertures);
verifier('épreuve : « ouvrir » donne l’adresse du fichier', ouv.length === 1 && /^http/.test(ouv[0] ?? ''), JSON.stringify(ouv));
const apres = (await api(page, 'GET', `/epreuves/${eid}`)).data.telechargements;
verifier('épreuve : téléchargement compté', apres > avant, `${avant} → ${apres}`);
await page.locator('.nl-epd [aria-label^="Noter 4"]').click();
await page.locator('.nl-epd__envoyer').click();
await page.waitForTimeout(1800);
const noteEp = (await api(page, 'GET', `/epreuves/${eid}`)).data.noteMoyenne;
verifier('épreuve : la note est enregistrée', noteEp === 4, `moyenne=${noteEp}`);

// ── Quiz ──────────────────────────────────────────────────────────────────
const quizzes = liste((await api(page, 'GET', '/quiz')).data);
verifier('quiz : le catalogue en rend', quizzes.length > 0, `${quizzes.length}`);
const qid = quizzes[0]._id ?? quizzes[0].id;
await page.goto(`${base}/app/quiz/${qid}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const total = await page.locator('.quiz__counter').innerText();
const n = Number(total.split('/')[1]);
for (let i = 0; i < n; i++) {
  await page.locator('.quiz__option').first().click();
  if (i < n - 1) await page.getByRole('button', { name: /suivant/i }).click(); else await page.getByRole('button', { name: /terminer/i }).click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(2000);
verifier('quiz : un résultat est affiché', /\d+\s*\/\s*\d+|score|résultat/i.test(await page.locator('.quiz').innerText()));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-quiz.png' });
const sub = journal.api.filter((a) => /quiz\/.*submit/.test(a.u));
verifier('quiz : la soumission est acceptée', sub.length === 1 && sub[0].s < 300, JSON.stringify(sub));

// ── Progression ───────────────────────────────────────────────────────────
await page.goto(`${base}/app/progression`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-progression.png' });
verifier('progression : la page se charge sans erreur API', echecs(journal).filter((e) => /progress/.test(e.u)).length === 0, JSON.stringify(echecs(journal).filter((e) => /progress/.test(e.u))));

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs), JSON.stringify(journal.console.filter((c) => !/404/.test(c))));
bilan();
await navigateur.close();
