/**
 * Éprouve la bibliothèque hors ligne d'une session à l'autre.
 *
 * Le scénario est celui d'un étudiant : il télécharge un document, ferme
 * l'application, se reconnecte plus tard, et doit retrouver son document -
 * y compris sans réseau, puisque c'est pour cela qu'il l'a téléchargé.
 *
 * Ce que la sonde vérifie, dans l'ordre où cela peut tomber :
 *
 *  1. le document se marque hors ligne et le fichier est réellement copié ;
 *  2. il est encore là après une déconnexion suivie d'une reconnexion ;
 *  3. il est listé **sans serveur**, puisque la liste distante est alors vide ;
 *  4. il s'ouvre et se lit sans serveur.
 */
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4400';
mkdirSync('qa/screenshots/refonte', { recursive: true });
copyFileSync('qa/fixtures/cours-12-pages.pdf', 'dist/nextLearn-web/browser/cours-12-pages.pdf');
const PDF = `${base}/cours-12-pages.pdf`;

const DOC = {
  _id: 'doc1', titre: 'Examen Terminal INF201 (2024)',
  description: 'Sujet et corrigé.', type: 'EPREUVE',
  matiereId: { _id: 'm1', nom: 'Algorithmique' },
  enseignantId: { _id: 'e1', nom: 'Dr. A. Mbarga' },
  universiteId: { _id: 'u1', nom: 'Université de Yaoundé I' },
  niveau: 'L2', semestre: 'S1', anneeAcademique: '2023-2024',
  tailleMb: 1.2, pages: 12, urlPdf: PDF,
  dateAjout: new Date().toISOString(), vues: 180, telechargements: 20, noteMoyenne: 4.2,
};

const session = () => {
  const dans = new Date(Date.now() + 864e5).toISOString();
  localStorage.setItem('nl_jwt_token', 'jeton');
  localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'refresh');
  localStorage.setItem('nl_user_data', JSON.stringify({
    id: 'u1', email: 'c@e.test', nom: 'Djomo', prenom: 'Camille',
    universite: 'UY1', filiere: 'Info', niveau: 'n2', cycle: 'licence',
    langue: 'fr', verificationStatus: 'APPROVED',
  }));
  localStorage.setItem('nl_first_launch', '0');
  localStorage.setItem('nl_last_otp_verified_at', dans);
};

const navigateur = await chromium.launch({ channel: 'chromium' });
// Un seul contexte du début à la fin : c'est lui qui porte le stockage, et
// c'est justement sa survie qu'on teste.
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block',
});
await contexte.addInitScript(session);

/** `false` coupe l'API : tout `/api/**` répond 503. */
let serveurRepond = true;

await contexte.route('**/api/**', async (route) => {
  const url = route.request().url();
  if (!serveurRepond) return route.fulfill({ status: 503, body: '{}' });
  let corps = { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
  if (/verification/.test(url)) corps = { data: { statut: 'APPROVED' } };
  else if (/signed-url/.test(url)) corps = { data: { url: PDF } };
  else if (/offline/.test(url)) corps = { data: [] };
  else if (/\/api\/documents\/[^/?]+$/.test(url)) corps = { data: DOC };
  else if (/\/api\/documents/.test(url)) corps = { data: [DOC], meta: { page: 1, totalPages: 1, total: 1 } };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});

const page = await contexte.newPage();
const resultats = [];
const noter = (quoi, ok, detail = '') =>
  resultats.push({ quoi, ok, detail }) && console.log(`  ${ok ? 'ok  ' : 'ÉCHEC'} ${quoi}${detail ? ' - ' + detail : ''}`);

console.log('- Bibliothèque hors ligne, d’une session à l’autre -');

// 1. Télécharger pour la lecture hors ligne.
await page.goto(`${base}/app/bibliotheque/doc/doc1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const boutonHorsLigne = page.locator('.doc-detail__secondaire', { hasText: /hors ligne/i }).first();
await boutonHorsLigne.click();
await page.waitForTimeout(3000);
const enCache = await page.evaluate(async () => {
  const noms = await caches.keys();
  for (const n of noms) {
    const c = await caches.open(n);
    const clefs = await c.keys();
    if (clefs.some((r) => r.url.includes('cours-12-pages') || r.url.includes('doc1'))) return true;
  }
  return false;
});
noter('le fichier est copié dans le cache', enCache);

// 2. Déconnexion puis reconnexion - nouvelle session, même appareil.
await page.evaluate(() => {
  for (const c of ['nl_jwt_token', 'nl_jwt_expiry', 'nl_refresh_token', 'nl_user_data']) {
    localStorage.removeItem(c);
  }
});
await page.evaluate(session);

// 3. Sans serveur : la liste distante est muette, seul le local peut répondre.
serveurRepond = false;
await page.goto(`${base}/app/offline`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
const texte = await page.locator('body').innerText();
noter('le document est listé après reconnexion, sans serveur',
  texte.includes('Examen Terminal INF201'),
  texte.slice(0, 70).replace(/\n+/g, ' | '));
await page.screenshot({ path: 'qa/screenshots/refonte/hors-ligne-apres-session.png', fullPage: true });

// 4. Et il s'ouvre vraiment.
await page.goto(`${base}/app/bibliotheque/doc/doc1/read`, { waitUntil: 'domcontentloaded' });
let lisible = false;
try {
  await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20_000 });
  lisible = true;
} catch { /* la sonde le dira */ }
await page.waitForTimeout(1500);
noter('il se lit sans serveur', lisible,
  (await page.locator('.pdf-reader__titre').innerText()).trim());
await page.screenshot({ path: 'qa/screenshots/refonte/hors-ligne-lecture.png' });

await navigateur.close();
const echecs = resultats.filter((r) => !r.ok);
if (echecs.length) {
  console.error(`\nÉCHEC : ${echecs.map((e) => e.quoi).join(' ; ')}`);
  process.exit(1);
}
console.log('\nLa bibliothèque hors ligne survit au changement de session.');
