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
      const out = [];
      /**
       * Le bord gauche que l'œil suit.
       *
       * Sur un bloc peint - carte, pilule, segment - c'est l'arête de la
       * forme, et son rembourrage intérieur ne se voit pas. Sur une boîte
       * transparente, il n'y a que le texte à suivre, et c'est alors le
       * bord du contenu qui compte.
       */
      const bordVu = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const peint = (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)')
          || (s.backgroundImage && s.backgroundImage !== 'none')
          || parseFloat(s.borderLeftWidth || 0) > 0;
        if (peint) return r.left;
        return r.left + parseFloat(s.paddingLeft || 0);
      };
      for (const parent of document.querySelectorAll('body *')) {
        const enfants = [...parent.children].filter((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          // Seuls les blocs empilés verticalement se comparent : une rangée
          // horizontale n'a aucune raison de partager un bord gauche.
          return r.width > 40 && r.height > 4 && s.position !== 'absolute' && s.position !== 'fixed';
        });
        if (enfants.length < 2) continue;
        // Un conteneur qui centre ses enfants n'a pas de bord gauche
        // partagé : leurs bords dépendent de la largeur de leur contenu, et
        // un écart d'un pixel y vient du centrage du texte, pas d'un oubli.
        const sp = getComputedStyle(parent);
        if (sp.display.includes('flex') && ['center', 'end', 'flex-end'].includes(sp.alignItems)) continue;
        if (sp.textAlign === 'center') continue;
        const empile = enfants.every((e, i) =>
          i === 0 || e.getBoundingClientRect().top >= enfants[i - 1].getBoundingClientRect().bottom - 1);
        if (!empile) continue;
        const bords = enfants.map(bordVu);
        const min = Math.min(...bords), max = Math.max(...bords);
        // Un écart franc est une mise en page voulue ; un écart de 1 à 6 px
        // est un oubli, et c'est exactement ce qui se voit.
        if (max - min < 0.5 || max - min > 6) continue;
        out.push({
          parent: (parent.className?.baseVal ?? parent.className ?? parent.tagName).toString().slice(0, 44),
          ecart: Math.round((max - min) * 10) / 10,
          bords: bords.map((b) => Math.round(b * 10) / 10).join(', '),
        });
      }
      return out.slice(0, 6);
    }, LARGEUR);
    if (coupables.length) {
      total += coupables.length;
      console.log(`\n${chemin}  (${page.url().replace(base, '')})`);
      for (const c of coupables) console.log(`   dans .${c.parent} : écart de ${c.ecart} px  (bords : ${c.bords})`);
    }
  } catch (e) {
    console.log(`\n${chemin} : ${e.message.split('\n')[0]}`);
  }
  await contexte.close();
}

console.log(total === 0 ? '\nAucun bord presque aligné.' : `\n${total} quasi-alignement(s).`);
await navigateur.close();
