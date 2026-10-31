import { createRequire } from 'node:module';
import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
const require = createRequire(import.meta.url);
const { MongoClient } = require('../../../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');
const { navigateur, page, journal } = await ouvrir();
await connecter(page);
const texte = async () => (await page.locator('body').innerText());
const utilisateur = await api(page, 'GET', '/auth/me');
const uid = utilisateur.data?.user?.id ?? utilisateur.data?.id ?? utilisateur.data?._id;

// ── Recherche ─────────────────────────────────────────────────────────────
await page.goto(`${base}/app/recherche`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.recherche__field input').fill('algorithmes');
await page.waitForTimeout(2500);
const t1 = await texte();
verifier('recherche : « algorithmes » trouve un document', /tri/i.test(t1) && !/Aucun résultat/i.test(t1), t1.slice(0, 160).replace(/\n/g, ' | '));
await page.locator('.recherche__field input').fill('zzzzintrouvable');
await page.waitForTimeout(2500);
verifier('recherche : terme absent → état vide', /Aucun résultat/i.test(await texte()));
await page.locator('.recherche__field input').fill('SQL');
await page.waitForTimeout(2500);
verifier('recherche : « SQL » trouve des documents', /SQL/.test(await texte()));
await page.locator('.recherche__liste a, .recherche__liste button, .recherche__liste nl-document-card').first().click().catch(() => {});
await page.waitForTimeout(1500);
verifier('recherche : un résultat ouvre la fiche', /\/bibliotheque\/doc\//.test(page.url()), page.url());
const historique = await page.evaluate(() => Object.keys(localStorage).filter((k) => /recherch/i.test(k)));
verifier('recherche : l’historique est mémorisé', historique.length > 0, historique.join(','));

// ── Épreuves ──────────────────────────────────────────────────────────────
await page.goto(`${base}/app/epreuves`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const ep = (await api(page, 'GET', '/epreuves?limit=50')).data;
const eps = ep?.items ?? ep?.epreuves ?? ep;
verifier('épreuves : l’API rend des épreuves', Array.isArray(eps) && eps.length > 0, `${eps?.length}`);
const eid = eps[0]._id ?? eps[0].id;
const corps = await texte();
verifier('épreuves : la liste affiche du contenu', corps.length > 200, corps.slice(0, 120).replace(/\n/g, ' | '));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-epreuves.png' });
await page.goto(`${base}/app/epreuves/${eid}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('épreuve : la fiche s’affiche', (await page.locator('.nl-epd__cta').count()) > 0);
await page.evaluate(() => { window.__ouverts = []; window.open = (u) => { window.__ouverts.push(u); return null; }; });
await page.locator('.nl-epd__cta').first().click();
await page.waitForTimeout(1500);
const ouverts = await page.evaluate(() => window.__ouverts);
verifier('épreuve : le sujet s’ouvre (adresse de lecture)', ouverts.length === 1 && /^https?:/.test(ouverts[0] ?? ''), JSON.stringify(ouverts));
await page.locator('[aria-label="Noter 4 sur 5"]').click();
await page.locator('.nl-epd__envoyer').click();
await page.waitForTimeout(1800);
const epApres = (await api(page, 'GET', `/epreuves/${eid}`)).data;
verifier('épreuve : la note est enregistrée', epApres.noteMoyenne === 4, `noteMoyenne=${epApres.noteMoyenne}`);

// ── Quiz ──────────────────────────────────────────────────────────────────
const quizzes = (await api(page, 'GET', '/quiz')).data;
const liste = quizzes?.items ?? quizzes?.quizzes ?? quizzes;
verifier('quiz : l’API rend des quiz', Array.isArray(liste) && liste.length > 0, `${liste?.length}`);
const qid = liste[0]._id ?? liste[0].id;
await page.goto(`${base}/app/quiz/${qid}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const nbQuestions = (await api(page, 'GET', `/quiz/${qid}`)).data?.questions?.length ?? 0;
for (let i = 0; i < nbQuestions; i++) {
  await page.locator('.nl-qz__option, [class*="option"]').first().click();
  await page.waitForTimeout(250);
  const suivant = page.getByRole('button', { name: /suivant/i });
  if (await suivant.count()) await suivant.click(); else await page.getByRole('button', { name: /terminer|valider|envoyer|soumettre/i }).click();
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2000);
const resultats = journal.api.filter((a) => /\/quiz\/.*\/submit/.test(a.u));
verifier('quiz : les réponses sont soumises', resultats.length === 1 && resultats[0].s < 300, JSON.stringify(resultats));
verifier('quiz : un score s’affiche', /\d+\s*\/\s*\d+|%/.test(await texte()), (await texte()).slice(0, 140).replace(/\n/g, ' | '));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-quiz.png' });

// ── Reprise de lecture ────────────────────────────────────────────────────
const docs = (await api(page, 'GET', '/documents?limit=5')).data;
const did = (Array.isArray(docs) ? docs : docs.items)[0]._id;
const put = await api(page, 'PUT', `/progress/lecture/${did}`, { pageActuelle: 5, totalPages: 12, pourcentage: 41 });
verifier('lecture : la page atteinte est enregistrée', put.status < 300, JSON.stringify(put).slice(0, 120));
const get = await api(page, 'GET', `/progress/lecture/${did}`);
verifier('lecture : on la retrouve', JSON.stringify(get.data).includes('5'), JSON.stringify(get.data).slice(0, 120));

// ── Notifications ─────────────────────────────────────────────────────────
const mongo = await MongoClient.connect('mongodb://127.0.0.1:27555'); const db = mongo.db('nltest');
await db.collection('notifications').insertMany([
  { userId: uid, type: 'INFO', titre: 'Bienvenue', corps: 'Premier message', lu: false, createdAt: new Date() },
  { userId: uid, type: 'NOUVEAU_COURS', titre: 'Nouveau cours', corps: 'Un cours est publié', lu: false, metadata: { documentId: did }, createdAt: new Date() },
]);
await page.goto(`${base}/app/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
verifier('notifications : les messages s’affichent', /Bienvenue/.test(await texte()) && /Nouveau cours/.test(await texte()));
let nb = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : compteur = 2', (nb?.count ?? nb?.unreadCount ?? nb) === 2, JSON.stringify(nb));
await page.getByText('Nouveau cours').first().click();
await page.waitForTimeout(1500);
verifier('notifications : un message mène à son document', /\/bibliotheque\/doc\//.test(page.url()), page.url());
nb = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : ouvrir un message le marque lu', (nb?.count ?? nb?.unreadCount ?? nb) === 1, JSON.stringify(nb));
await page.goto(`${base}/app/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('.notifs__mark-all').click();
await page.waitForTimeout(1500);
nb = (await api(page, 'GET', '/notifications/unread-count')).data;
verifier('notifications : « Tout lire » remet à zéro', (nb?.count ?? nb?.unreadCount ?? nb) === 0, JSON.stringify(nb));
await mongo.close();

// ── Progression ───────────────────────────────────────────────────────────
await page.goto(`${base}/app/progression`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const prog = await texte();
verifier('progression : la page affiche des statistiques', prog.length > 200, prog.slice(0, 160).replace(/\n/g, ' | '));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-progression.png' });

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs));
bilan();
await navigateur.close();
