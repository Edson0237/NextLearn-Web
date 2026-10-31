/** Signalement vécu comme l'étudiant : par l'interface, puis vérifié côté serveur et côté administration. */
import { execSync } from 'node:child_process';
import { ouvrir, connecter, api, verifier, bilan, echecs, base } from './e2e-lib.mjs';
execSync('node qa/outils/e2e-reset.cjs');
const { navigateur, page, journal } = await ouvrir();
await connecter(page);

const docs = (await api(page, 'GET', '/documents?limit=5')).data;
const arr = Array.isArray(docs) ? docs : docs.items ?? docs.documents;
verifier('l’étudiant voit des documents', arr.length > 0, `${arr.length}`);
const id = arr[0]._id ?? arr[0].id;

await page.goto(`${base}/app/${'bibliotheque/doc/' + id}`, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(2000);
console.log('url', page.url());
await page.getByRole('button', { name: /signaler/i }).first().click();
await page.waitForTimeout(1200);
const motifs = await page.locator('.nl-select__ligne').allInnerTexts();
verifier('la feuille de motifs s’ouvre', motifs.length > 0, motifs.join(' | ').slice(0, 150));
await page.locator('.nl-select__ligne').nth(motifs.length > 1 ? 1 : 0).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^signaler$/i }).last().click();
await page.waitForTimeout(2000);
const toast = await page.locator('body').innerText();
console.log('toast:', (toast.match(/(Merci[^\n]*|n’a pas pu[^\n]*|déjà[^\n]*)/) ?? [''])[0]);

const post = journal.api.filter((a) => a.m === 'POST' && /reports/.test(a.u));
verifier('la requête POST /api/reports part', post.length === 1, JSON.stringify(post));
verifier('… et réussit (201)', post[0]?.s === 201, `${post[0]?.s}`);

const admin = await page.evaluate(async () => {
  const l = await (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@nextlearn.local', pin: '1234', deviceId: 'appareil-admin-0123456789abcdef' }) })).json();
  return l.data.accessToken;
});
const liste = await page.evaluate(async (t) => (await (await fetch('/api/admin/signalements', { headers: { Authorization: `Bearer ${t}` } })).json()), admin);
const items = liste.data ?? [];
verifier('le signalement apparaît côté administration', items.length === 1, JSON.stringify(liste).slice(0, 300));
// ── Une épreuve se signale aussi, par son propre écran ──
const eps = (await api(page, 'GET', '/epreuves?limit=5')).data;
const ep = (Array.isArray(eps) ? eps : eps.items ?? [])[0];
await page.goto(`${base}/app/epreuves/${ep._id ?? ep.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /signaler/i }).first().click();
await page.waitForTimeout(1200);
await page.locator('.nl-select__ligne').nth(1).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^signaler$/i }).last().click();
await page.waitForTimeout(2000);
const apresEp = await page.evaluate(async (t) => (await (await fetch('/api/admin/signalements', { headers: { Authorization: `Bearer ${t}` } })).json()).data, admin);
verifier('épreuve : le signalement arrive côté administration', apresEp.some((x) => x.cibleType === 'epreuve'), JSON.stringify(apresEp.map((x) => x.cibleType)));

// ── Un second signalement du même contenu : le message du serveur est montré ──
await page.getByRole('button', { name: /signaler/i }).first().click();
await page.waitForTimeout(1200);
await page.locator('.nl-select__ligne').nth(1).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /^signaler$/i }).last().click();
await page.waitForTimeout(1500);
verifier('doublon : le toast explique (déjà signalé), pas un message générique', /déjà signalé/i.test(await page.locator('body').innerText()));
console.log('ÉCHECS API', JSON.stringify(echecs(journal)));
bilan();
await navigateur.close();
