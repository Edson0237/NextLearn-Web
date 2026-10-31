/**
 * Éprouve la reprise de lecture : sortir du lecteur puis rouvrir le document
 * doit ramener à la page où l'on s'était arrêté, pas à la page 1.
 *
 * Deux conditions sont testées séparément, parce qu'elles tombent pour des
 * raisons différentes :
 *
 *  1. **serveur disponible** — la progression part à l'API et en revient ;
 *  2. **serveur muet** — c'est le cas qui compte vraiment, puisqu'on lit
 *     justement hors ligne les documents qu'on a téléchargés.
 */
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4400';
mkdirSync('qa/screenshots/refonte', { recursive: true });
copyFileSync('qa/fixtures/cours-12-pages.pdf', 'dist/nextLearn-web/browser/cours-12-pages.pdf');
const PDF = `${base}/cours-12-pages.pdf`;

const navigateur = await chromium.launch({ channel: 'chromium' });

/** Ouvre le lecteur, va à la moitié du document, puis en sort. */
async function lirePuisSortir(page, lecture) {
  await page.goto(`${base}/app/bibliotheque/doc/doc1/read`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const vue = document.querySelector('.ng2-pdf-viewer-container');
    if (vue) vue.scrollTop = vue.scrollHeight * 0.5;
  });
  // La sauvegarde est différée d'une seconde pour ne pas tirer à chaque page.
  await page.waitForTimeout(2500);
  const atteinte = (await page.locator('.pdf-reader__titre').innerText()).trim();
  // On sort comme un étudiant sortirait : par la fiche du document.
  await page.goto(`${base}/app/bibliotheque/doc/doc1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  lecture.atteinte = atteinte;
}

async function essai({ nom, serveurRepond }) {
  const contexte = await navigateur.newContext({
    viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block',
  });
  await contexte.addInitScript(() => {
    const dans = new Date(Date.now() + 864e5).toISOString();
    localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans);
    localStorage.setItem('nl_refresh_token', 'r');
    localStorage.setItem('nl_user_data', JSON.stringify({
      id: 'u1', email: 'c@e.test', nom: 'Djomo', prenom: 'Camille',
      universite: 'UY1', filiere: 'Info', niveau: 'n2', cycle: 'licence',
      langue: 'fr', verificationStatus: 'APPROVED',
    }));
    localStorage.setItem('nl_first_launch', '0');
    localStorage.setItem('nl_last_otp_verified_at', dans);
  });

  // La progression que « le serveur » a retenue, s'il en retient une.
  const retenue = { pageCourante: 0, totalPages: 0 };

  await contexte.route('**/api/**', async (route) => {
    const url = route.request().url();
    const methode = route.request().method();

    if (/progress\/lecture/.test(url)) {
      if (!serveurRepond) return route.fulfill({ status: 503, body: '{}' });
      if (methode === 'POST' || methode === 'PUT') {
        try {
          const corps = route.request().postDataJSON();
          retenue.pageCourante = corps?.pageCourante ?? 0;
          retenue.totalPages = corps?.totalPages ?? 0;
        } catch { /* corps illisible : on n'en retient rien */ }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: retenue }) });
      }
      // Deux ressources distinctes : la liste rend un tableau, la fiche d'un
      // document rend un objet. Les confondre faisait lire n'importe quoi au
      // client — et m'a fait croire un instant que le défaut venait de lui.
      const parDocument = /progress\/lecture\/[^/?]+/.test(url);
      if (parDocument) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: retenue.pageCourante ? { documentId: 'doc1', ...retenue } : null }),
        });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: retenue.pageCourante ? [{ documentId: 'doc1', ...retenue }] : [] }),
      });
    }

    let corps = { data: [] };
    if (/verification/.test(url)) corps = { data: { statut: 'APPROVED' } };
    else if (/signed-url/.test(url)) corps = { data: { url: PDF } };
    else if (/\/api\/documents\/[^/?]+$/.test(url)) {
      corps = { data: { _id: 'doc1', titre: 'Bases de données avancées', type: 'COURS', urlPdf: PDF, pages: 12 } };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });

  const page = await contexte.newPage();
  const lecture = { atteinte: '' };
  await lirePuisSortir(page, lecture);

  // Puis on rouvre, exactement comme en recliquant sur le document.
  await page.goto(`${base}/app/bibliotheque/doc/doc1/read`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20_000 });
  await page.waitForTimeout(3000);
  const reprise = (await page.locator('.pdf-reader__titre').innerText()).trim();

  await page.screenshot({ path: `qa/screenshots/refonte/reprise-${nom}.png` });
  await contexte.close();

  const pageAtteinte = parseInt(lecture.atteinte.replace(/\D+/g, '') || '0', 10);
  const pageReprise = parseInt(reprise.replace(/\D+/g, '') || '0', 10);
  const ok = pageReprise > 1 && Math.abs(pageReprise - pageAtteinte) <= 1;
  console.log(`  ${nom.padEnd(16)} lue: ${lecture.atteinte.padEnd(14)} rouverte: ${reprise.padEnd(14)} ${ok ? 'reprend' : 'NE REPREND PAS'}`);
  return ok;
}

console.log('— Reprise de lecture —');
const avecServeur = await essai({ nom: 'serveur-ok', serveurRepond: true });
const sansServeur = await essai({ nom: 'serveur-muet', serveurRepond: false });
await navigateur.close();

if (!avecServeur || !sansServeur) {
  console.error('\nÉCHEC : la lecture ne reprend pas où elle s’est arrêtée.');
  process.exit(1);
}
console.log('\nLa lecture reprend où elle s’est arrêtée, serveur disponible ou non.');
