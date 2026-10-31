import { chromium } from 'playwright';

/**
 * Cherche les éléments qui dépassent la largeur de l'écran.
 *
 * C'est le défaut d'alignement le plus visible et le plus fréquent : un
 * élément flex qui refuse de se réduire sous sa largeur intrinsèque, et qui
 * sort du cadre. Le navigateur est seul à pouvoir le dire.
 */
const base = process.argv[2] ?? 'http://localhost:4400';
const LARGEUR = 390;

const ECRANS = [
  ['/app/onboarding', false], ['/app/register', false], ['/app/login', false],
  ['/app/home', true], ['/app/bibliotheque', true], ['/app/bibliotheque/doc/doc1', true],
  ['/app/offline', true], ['/app/profil', true], ['/app/progression', true],
  ['/app/profil/appareils', true], ['/app/profil/parametres', true],
  ['/app/epreuves', true], ['/app/recherche', true], ['/app/favoris', true],
  ['/app/notifications', true], ['/app/depots', true],
];

const navigateur = await chromium.launch({ channel: 'chromium' });
let total = 0;

for (const [chemin, avecSession] of ECRANS) {
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block',
  });
  if (avecSession) {
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
  }
  await contexte.route('**/api/**', (route) => {
    const u = route.request().url();
    const corps = /verification\/requests\/me/.test(u)
      ? { data: { statut: 'APPROVED' } }
      : { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });

  const page = await contexte.newPage();
  try {
    await page.goto(base + chemin, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const coupables = await page.evaluate((largeur) => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Un dépassement de plus de 2 px, et qui n'est pas un rail qu'on
        // fait défiler exprès (`overflow-x: auto`).
        const deborde = r.right > largeur + 2 || r.left < -2;
        if (!deborde) continue;
        // Un rail qu'on fait défiler exprès — le carrousel d'accueil, les
        // segments de type — déborde par construction. Il faut remonter
        // toute la lignée : le coupable apparent est souvent un petit-fils.
        let rail = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) { rail = true; break; }
        }
        if (rail) continue;
        out.push({
          balise: el.tagName.toLowerCase(),
          classe: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 50),
          gauche: Math.round(r.left), droite: Math.round(r.right),
        });
      }
      return out.slice(0, 6);
    }, LARGEUR);
    if (coupables.length) {
      total += coupables.length;
      console.log(`\n${chemin}  (${page.url().replace(base, '')})`);
      for (const c of coupables) console.log(`   ${c.balise}.${c.classe}  [${c.gauche} → ${c.droite}]`);
    }
  } catch (e) {
    console.log(`\n${chemin} : ${e.message.split('\n')[0]}`);
  }
  await contexte.close();
}

console.log(total === 0 ? '\nAucun débordement horizontal.' : `\n${total} débordement(s).`);
await navigateur.close();
