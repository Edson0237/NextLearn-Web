import { execSync } from 'node:child_process';
import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const { navigateur, page, journal } = await ouvrir();
await connecter(page);
const dep = async (sujet) => page.evaluate(async (t) => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@nextlearn.local', pin: '1234', deviceId: 'appareil-admin-0123456789abcdef' }) })).json().then((j) => j.data.accessToken), sujet);
const admin = await dep();
const adm = (m, c, b) => page.evaluate(async ([m, c, b, t]) => {
  const r = await fetch(`/api${c}`, { method: m, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, data: j?.data ?? j };
}, [m, c, b ?? null, admin]);

// ── Contribution : liste vide, puis dépôt (inséré en base : l'envoi réel va chez Cloudinary) ──
await page.goto(`${base}/app/depots`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
verifier('contribution : la page se charge (pas de « chargement impossible »)', !/impossible/i.test(await page.locator('body').innerText()));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-contribution-vide.png' });
const mat = (await api(page, 'GET', '/references/matieres')).data;
const matiereId = (Array.isArray(mat) ? mat : mat.items ?? mat.matieres)?.[0]?._id ?? '';
const refus = await api(page, 'POST', '/documents/submissions', { titre: 'x' });
verifier('contribution : un dépôt sans fichier est refusé proprement', refus.status === 400 || refus.status === 500 && false, `${refus.status}`);
execSync(`node -e "
const { MongoClient, ObjectId } = require('../api_nextlearn_v2_08082026/api_nextlearn_v2/node_modules/mongodb');
(async()=>{const c=await MongoClient.connect('mongodb://127.0.0.1:27555');const db=c.db('nltest');
const u=await db.collection('users').findOne({email:'etudiant@test.local'});
const base={uploadedBy:u._id,description:'',type:'COURS',matiereId:'${matiereId}',niveau:'N3',anneeAcademique:'2024-2025',licence:'auteur',pages:5,tailleMb:1,fichierPublicId:'x',createdAt:new Date(),updatedAt:new Date()};
await db.collection('documentsubmissions').insertMany([{...base,titre:'Cours A',fichierHash:'a',status:'en_attente'},{...base,titre:'Cours B',fichierHash:'b',status:'en_attente'}]);
await c.close();})()"`, { cwd: process.cwd() });
const mine = (await api(page, 'GET', '/documents/submissions/me')).data;
verifier('contribution : « mes dépôts » rend la liste', mine.length === 2, `${mine.length}`);
await page.goto(`${base}/app/depots`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const txt = await page.locator('body').innerText();
verifier('contribution : les dépôts s’affichent', txt.includes('Cours A') && txt.includes('Cours B'));
await page.screenshot({ path: 'qa/screenshots/refonte/e2e-contribution.png' });

// ── Administration des dépôts, puis recours ───────────────────────────────
const file = (await adm('GET', '/admin/documents/submissions')).data;
verifier('admin dépôts : la file contient les 2 dépôts', file.length === 2, `${file.length}`);
const a = file.find((d) => d.titre === 'Cours A');
const stats = (await adm('GET', '/admin/documents/submissions/stats')).data;
verifier('admin dépôts : statistiques', stats.enAttente === 2, JSON.stringify(stats));
verifier('admin dépôts : prise en revue', (await adm('POST', `/admin/documents/submissions/${a._id}/review`)).data.status === 'en_revue');
const sansMotif = await adm('POST', `/admin/documents/submissions/${a._id}/reject`, { motif: '' });
verifier('admin dépôts : un refus sans motif est rejeté', sansMotif.status === 400, `${sansMotif.status}`);
verifier('admin dépôts : refus avec motif', (await adm('POST', `/admin/documents/submissions/${a._id}/reject`, { motif: 'Document protégé, droits non justifiés' })).data.status === 'refuse');
await page.goto(`${base}/app/depots`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
verifier('contribution : le refus et son motif sont visibles', /refus/i.test(await page.locator('body').innerText()));
const notifs = (await api(page, 'GET', '/notifications')).data;
verifier('notification : le déposant est prévenu du refus', JSON.stringify(notifs).includes('refusé'));

await page.goto(`${base}/app/recours`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const poss = (await api(page, 'GET', '/recours/possibilites')).data;
verifier('recours : le refus du dépôt est contestable', poss.possibles.some((p) => p.type === 'depot'), JSON.stringify(poss).slice(0, 200));
await page.locator('.recours__type').first().click();
await page.locator('.recours__field textarea').fill('Ce cours est mon propre travail, rédigé pendant mon semestre : voici la source.');
await page.getByRole('button', { name: /déposer le recours/i }).click();
await page.waitForTimeout(2000);
const mesR = (await api(page, 'GET', '/recours/me')).data;
verifier('recours : déposé et listé', mesR.length === 1 && mesR[0].statut === 'en_attente', JSON.stringify(mesR).slice(0, 160));
const court = await api(page, 'POST', '/recours', { type: 'depot', cibleId: a._id, motif: 'trop court' });
verifier('recours : un motif trop court est refusé', court.status === 400, `${court.status}`);
const dbl = await api(page, 'POST', '/recours', { type: 'depot', cibleId: a._id, motif: 'Ce cours est mon propre travail, rédigé pendant mon semestre, merci.' });
verifier('recours : un doublon est refusé', dbl.status === 409, `${dbl.status}`);
const fileR = (await adm('GET', '/admin/recours')).data;
verifier('admin recours : visible dans la file', fileR.length === 1 && fileR[0].type === 'depot');
verifier('admin recours : acceptation', (await adm('POST', `/admin/recours/${fileR[0]._id}/decide`, { decision: 'accepte', reponse: 'Source vérifiée, le dépôt repart en revue.' })).data.statut === 'accepte');
const apres = (await api(page, 'GET', '/documents/submissions/me')).data.find((d) => d.titre === 'Cours A');
verifier('recours accepté : le dépôt repasse en attente', apres.status === 'en_attente', apres.status);

// ── Signalement → modération ──────────────────────────────────────────────
const docs = (await api(page, 'GET', '/documents?limit=2')).data; const arr = Array.isArray(docs) ? docs : docs.items ?? docs.documents;
const did = arr[1]._id ?? arr[1].id;
const sig = await api(page, 'POST', '/reports', { cibleType: 'document', cibleId: did, motif: 'DROIT_AUTEUR', commentaire: 'Extrait d’un manuel' });
verifier('signalement grave : accepté', sig.status === 201);
verifier('signalement grave : le document est masqué aussitôt', (await api(page, 'GET', `/documents/${did}`)).status === 404 || (await api(page, 'GET', `/documents/${did}`)).data?.actif === false);
verifier('signalement : un second signalement du même contenu est refusé', (await api(page, 'POST', '/reports', { cibleType: 'document', cibleId: did, motif: 'DOUBLON' })).status === 409);
const sigs = (await adm('GET', '/admin/signalements?status=ouvert')).data;
verifier('admin signalements : visible, avec titre et masquage auto', sigs.length === 1 && sigs[0].masquageAutomatique && !!sigs[0].cibleTitre, JSON.stringify(sigs).slice(0, 200));
const st = (await adm('GET', '/admin/signalements/stats')).data;
verifier('admin signalements : statistiques', st.ouverts === 1 && st.masquesEnAttente === 1, JSON.stringify(st));
await adm('POST', `/admin/signalements/${sigs[0]._id}/review`);
verifier('admin signalements : écarté → le document revient en ligne', (await adm('POST', `/admin/signalements/${sigs[0]._id}/decide`, { decision: 'rejete', motif: 'Extrait cité, usage légitime' })).data.status === 'rejete'
  && (await api(page, 'GET', `/documents/${did}`)).status === 200);

// ── Support ───────────────────────────────────────────────────────────────
await page.goto(`${base}/app/support/tickets`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const tk = await api(page, 'POST', '/support/tickets', { categorie: 'CONNEXION', sujet: 'Problème de test', message: 'Description de test suffisante pour le support.' });
verifier('support : un ticket peut être créé', tk.status === 201 || tk.status === 200, `${tk.status} ${JSON.stringify(tk.data).slice(0, 120)}`);

console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
console.log('ERREURS', JSON.stringify(journal.erreurs));
bilan();
await navigateur.close();
