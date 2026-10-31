import { chromium } from 'playwright';

/**
 * Cherche les bords gauches presque alignés.
 *
 * Deux blocs empilés dont les bords tombent à 4 px l'un de l'autre : assez
 * pour que l'œil le voie, trop peu pour passer pour un choix. C'est ce que
 * produisait un `margin-left: 4px` oublié sur un titre de section. Un écart
 * franc, lui, est une mise en page voulue et ne compte pas.
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
      /**
       * Les marges extérieures employées sur l'écran.
       *
       * Un écran bien réglé n'en a qu'une : tout ce qui est de premier
       * niveau commence sur la même verticale. Plusieurs valeurs proches
       * - 16, 20, 24 - trahissent des rembourrages posés à la main, écran
       * par écran, et c'est ce qui donne l'impression de flottement.
       */
      const compte = new Map();
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.height < 16 || s.position === 'fixed' || s.position === 'absolute') continue;
        // Seuls les blocs qui occupent presque toute la largeur disent
        // quelque chose de la marge ; une puce ou une icône, non.
        if (r.width < largeur * 0.55 || r.width > largeur - 1) continue;
        // Seuls les blocs de premier niveau disent la marge de la page :
        // un enfant de carte commence à 32 px parce que sa carte commence
        // à 16 et se rembourre de 16, ce qui est voulu et non un écart.
        const pere = el.parentElement;
        if (!pere) continue;
        const rp = pere.getBoundingClientRect();
        if (rp.left > 1 || rp.width < largeur - 1) continue;
        const marge = Math.round(r.left);
        if (marge <= 0 || marge > 40) continue;
        compte.set(marge, (compte.get(marge) ?? 0) + 1);
      }
      const marges = [...compte.entries()].filter(([, n]) => n >= 2).sort((a, b) => a[0] - b[0]);
      if (marges.length < 2) return [];
      return [{ parent: marges.map(([m, n]) => `${m}px ×${n}`).join('  '), ecart: marges.at(-1)[0] - marges[0][0], bords: '' }];
    }, LARGEUR);
    if (coupables.length) {
      total += coupables.length;
      console.log(`\n${chemin}  (${page.url().replace(base, '')})`);
      for (const c of coupables) console.log(`   marges : ${c.parent}   (amplitude ${c.ecart} px)`);
    }
  } catch (e) {
    console.log(`\n${chemin} : ${e.message.split('\n')[0]}`);
  }
  await contexte.close();
}

console.log(total === 0 ? '\nUne seule marge extérieure par écran.' : `\n${total} écran(s) à marges multiples.`);
await navigateur.close();
