/**
 * Éprouve le lecteur PDF dans le build de production.
 *
 * Le lecteur a déjà échoué deux fois pour des raisons invisibles en
 * développement : un conteneur de hauteur nulle, et le moteur de rendu de
 * pdf.js chargé depuis un CDN absent en production. Les deux ne se voyaient
 * qu'à l'écran, d'où cette sonde : elle ouvre un vrai document, attend que
 * pdf.js ait peint, et compte les pages réellement rendues.
 */
import { chromium } from 'playwright';
import { mkdirSync, copyFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4400';
mkdirSync('qa/screenshots/refonte', { recursive: true });

// Le document est recopié dans `dist/` à chaque passage : `ng build` vide ce
// dossier, et un PDF absent fait échouer la sonde pour une raison qui n'a
// rien à voir avec le lecteur — ce qui m'a déjà fait accuser le code à tort.
const PDF = `${base}/cours-12-pages.pdf`;
copyFileSync('qa/fixtures/cours-12-pages.pdf', 'dist/nextLearn-web/browser/cours-12-pages.pdf');

const navigateur = await chromium.launch({ channel: 'chromium' });
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: 'fr-FR', serviceWorkers: 'block',
});

await contexte.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'jeton');
  localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'refresh');
  localStorage.setItem('nl_user_data', JSON.stringify({
    id: 'u1', email: 'camille@exemple.test', nom: 'Djomo', prenom: 'Camille',
    universite: 'Université de Yaoundé I', filiere: 'Informatique',
    niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED',
  }));
  localStorage.setItem('nl_first_launch', '0');
  localStorage.setItem('nl_last_otp_verified_at', dans);
});

await contexte.route('**/api/**', async (route) => {
  const url = route.request().url();
  let corps = { data: [] };
  if (/verification\/requests\/me/.test(url)) corps = { data: { statut: 'APPROVED' } };
  else if (/signed-url/.test(url)) corps = { data: { url: PDF } };
  else if (/\/api\/documents\/[^/?]+$/.test(url)) {
    corps = { data: { _id: 'doc1', titre: 'Bases de données avancées', type: 'COURS', urlPdf: PDF, pages: 12 } };
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});

const page = await contexte.newPage();
const problemes = [];
page.on('pageerror', (e) => problemes.push(`pageerror: ${e.message.slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error') problemes.push(`console: ${m.text().slice(0, 200)}`); });
page.on('requestfailed', (r) => problemes.push(`requête KO: ${r.url().slice(-70)} ${r.failure()?.errorText}`));

await page.goto(`${base}/app/bibliotheque/doc/doc1/read`, { waitUntil: 'domcontentloaded' });

// pdf.js peint en plusieurs temps : on attend la toile, pas un délai fixe.
let rendu = false;
try {
  await page.waitForSelector('.pdfViewer .page canvas', { timeout: 20_000 });
  rendu = true;
} catch { /* la sonde le dira */ }

await page.waitForTimeout(2500);

const mesures = await page.evaluate(() => {
  const conteneur = document.querySelector('pdf-viewer');
  const pages = document.querySelectorAll('.pdfViewer .page');
  const toiles = document.querySelectorAll('.pdfViewer .page canvas');
  const premiere = toiles[0];
  const rect = conteneur?.getBoundingClientRect();
  return {
    conteneurPresent: !!conteneur,
    hauteurConteneur: rect ? Math.round(rect.height) : 0,
    largeurConteneur: rect ? Math.round(rect.width) : 0,
    pages: pages.length,
    toiles: toiles.length,
    premiereToile: premiere ? `${premiere.width}×${premiere.height}` : 'aucune',
    texteCorps: document.body.innerText.slice(0, 120).replace(/\n+/g, ' | '),
  };
});

await page.screenshot({ path: 'qa/screenshots/refonte/lecteur-pdf_390x844_light.png' });

// Le compteur de page suit-il le défilement ? C'est lui qui alimente la
// reprise de lecture : s'il reste bloqué, « Reprendre » ramène toujours à la
// page 1. On défile le conteneur de pdf.js lui-même — la molette, en
// navigateur sans tête, n'atteint pas un défileur imbriqué.
const titreAvant = (await page.locator('.pdf-reader__titre').innerText()).trim();
await page.evaluate(() => {
  const vue = document.querySelector('.ng2-pdf-viewer-container');
  if (vue) vue.scrollTop = vue.scrollHeight * 0.5;
});
await page.waitForTimeout(2500);
const titreApres = (await page.locator('.pdf-reader__titre').innerText()).trim();
const apresDefilement = await page.evaluate(
  () => document.querySelectorAll('.pdfViewer .page canvas').length,
);
await page.screenshot({ path: 'qa/screenshots/refonte/lecteur-pdf-defile_390x844_light.png' });

// La page ne doit pas dépasser la fenêtre : le lecteur occupe `100dvh`, et
// le moindre débordement fait fuir sa barre de titre vers le haut au premier
// geste, avec l'effet élastique qui va avec.
const debordement = await page.evaluate(
  () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
);

console.log('— Lecteur PDF —');
console.log(`  toile peinte           : ${rendu ? 'oui' : 'NON'}`);
console.log(`  conteneur              : ${mesures.largeurConteneur}×${mesures.hauteurConteneur} px`);
console.log(`  pages dans le document : ${mesures.pages}`);
console.log(`  toiles rendues         : ${mesures.toiles} → ${apresDefilement} après défilement`);
console.log(`  suivi de page          : ${titreAvant} → ${titreApres} ${titreAvant === titreApres ? '(BLOQUÉ)' : '(suit)'}`);
console.log(`  débordement de page    : ${debordement} px ${debordement > 0 ? '(la barre s’échappe)' : ''}`);
console.log(`  première toile         : ${mesures.premiereToile}`);
console.log(`  texte de la page       : ${mesures.texteCorps}`);
if (problemes.length) {
  console.log('  problèmes :');
  for (const p of [...new Set(problemes)].slice(0, 8)) console.log(`    - ${p}`);
} else {
  console.log('  problèmes              : aucun');
}

await navigateur.close();

// Le code de sortie sert à enchaîner la sonde avec les autres vérifications.
const echecs = [];
if (!rendu) echecs.push('aucune toile peinte');
if (mesures.pages === 0) echecs.push('aucune page');
if (titreAvant === titreApres) echecs.push('le compteur de page ne suit pas le défilement');
if (debordement > 0) echecs.push(`la page déborde de ${debordement} px`);
if (problemes.length) echecs.push(`${problemes.length} erreur(s) console`);
if (echecs.length) {
  console.error('\nÉCHEC : ' + echecs.join(' ; '));
  process.exit(1);
}
console.log('\nLe lecteur PDF fonctionne.');
