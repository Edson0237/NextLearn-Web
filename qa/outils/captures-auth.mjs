/**
 * Captures des écrans d'authentification et des écrans secondaires.
 *
 * Ils vivent hors de la session semée par `captures-design.mjs` : les uns
 * parce qu'ils précèdent toute session, les autres parce qu'ils s'atteignent
 * par navigation. C'est là que se voient les défauts d'alignement.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4400';
const sortie = 'qa/screenshots/refonte';
mkdirSync(sortie, { recursive: true });

const ECRANS = [
  ['onboarding', '/app/onboarding', false],
  ['inscription', '/app/register', false],
  ['connexion', '/app/login', false],
  ['profil', '/app/profil', true],
  ['progression', '/app/progression', true],
  ['sessions', '/app/profil/appareils', true],
];

const navigateur = await chromium.launch({ channel: 'chromium' });

for (const theme of ['light', 'dark']) {
  for (const [nom, chemin, avecSession] of ECRANS) {
    const contexte = await navigateur.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      locale: 'fr-FR',
      colorScheme: theme,
      serviceWorkers: 'block',
    });

    if (avecSession) {
      await contexte.addInitScript(() => {
        const dans = new Date(Date.now() + 86_400_000).toISOString();
        localStorage.setItem('nl_jwt_token', 'jeton-de-capture');
        localStorage.setItem('nl_jwt_expiry', dans);
        localStorage.setItem('nl_refresh_token', 'rafraichissement-de-capture');
        localStorage.setItem('nl_user_data', JSON.stringify({
          id: 'u-camille', email: 'camille@exemple.test',
          nom: 'Djomo', prenom: 'Camille',
          universite: 'Université de Yaoundé I', filiere: 'Informatique',
          niveau: 'n2', cycle: 'licence', langue: 'fr',
          verificationStatus: 'APPROVED',
        }));
        localStorage.setItem('nl_first_launch', '0');
        localStorage.setItem('nl_last_otp_verified_at', dans);
      });
    }

    await contexte.route('**/api/**', async (route) => {
      const url = route.request().url();
      let corps = { data: [] };
      if (/verification\/requests\/me/.test(url)) corps = { data: { statut: 'APPROVED' } };
      else if (/progression\/stats/.test(url)) {
        corps = { data: { streak: 7, docsLus: 24, heuresEtude: 31, quizReussis: 12, totalMinutes: 1860 } };
      } else if (/auth\/sessions/.test(url)) {
        corps = { data: [
          { _id: 's1', appareil: 'Chrome · Linux', derniereActivite: new Date().toISOString(), courante: true },
          { _id: 's2', appareil: 'Android · Samsung', derniereActivite: new Date(Date.now() - 864e5).toISOString() },
        ] };
      } else if (/references|ecoles|niveaux|filieres|cycles/.test(url)) {
        corps = { data: [
          { _id: 'u1', id: 'u1', nom: 'Université de Yaoundé I', code: 'UY1', label: 'Université de Yaoundé I' },
          { _id: 'u2', id: 'u2', nom: 'Université de Douala', code: 'UD', label: 'Université de Douala' },
        ] };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
    });

    const onglet = await contexte.newPage();
    await onglet.goto(base + chemin, { waitUntil: 'networkidle' });
    await onglet.waitForTimeout(3500);
    const fichier = join(sortie, `${nom}_390x844_${theme}.png`);
    await onglet.screenshot({ path: fichier, fullPage: true });
    console.log(`capture : ${fichier}  (url: ${onglet.url().replace(base, '')})`);
    await contexte.close();
  }
}

await navigateur.close();
