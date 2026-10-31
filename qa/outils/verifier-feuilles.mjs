/**
 * Éprouve les feuilles glissantes (modales) de l'application.
 *
 * Elles s'affichaient sans fond, par-dessus la page, dans la police de la
 * vitrine et sans coins arrondis. Trois causes cumulées :
 *
 *  1. la feuille de style de l'overlay CDK n'était chargée nulle part, donc
 *     rien ne positionnait le panneau ni n'affichait le fond ;
 *  2. le panneau est attaché à `<body>`, hors du sous-arbre `.nl-app` qui
 *     porte les jetons de la charte - `var(--bg-primary)` ne résolvait pas ;
 *  3. le thème choisi ne le suivait pas davantage.
 *
 * La sonde vérifie ce qui se voit : un fond opaque, des coins arrondis, la
 * bonne police, et un panneau posé en bas de l'écran.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4200';
mkdirSync('qa/screenshots/refonte', { recursive: true });

const session = () => {
  const dans = new Date(Date.now() + 864e5).toISOString();
  localStorage.setItem('nl_jwt_token', 'j');
  localStorage.setItem('nl_jwt_expiry', dans);
  localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({
    id: 'u1', email: 'c@e.test', nom: 'Djomo', prenom: 'Camille',
    universite: 'UY1', filiere: 'Info', niveau: 'n2', cycle: 'licence',
    langue: 'fr', verificationStatus: 'APPROVED',
  }));
  localStorage.setItem('nl_first_launch', '0');
  localStorage.setItem('nl_last_otp_verified_at', dans);
};

/** Les feuilles atteignables, et le geste qui les ouvre. */
const CAS = [
  { nom: 'plus-de-formats', url: '/app/home', ouvrir: '.home__format--autres' },
  { nom: 'theme', url: '/app/profil', ouvrir: 'text=Thème' },
  { nom: 'niveau', url: '/app/profil', ouvrir: 'text=Niveau' },
  // Pas une feuille glissante mais une modale centrée, propre aux réglages.
  { nom: 'code-pin', url: '/app/profil', ouvrir: 'text=Code PIN', modale: '.nl-sl__modal' },
];

const lancer = () => chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const echecs = [];

for (const theme of ['light', 'dark']) {
  for (const cas of CAS) {
    const nav = await lancer();
    const ctx = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: 'fr-FR', colorScheme: theme, serviceWorkers: 'block',
    });
    await ctx.addInitScript(session);
    await ctx.route('**/api/**', (r) => {
      const u = r.request().url();
      const c = /verification/.test(u)
        ? { data: { statut: 'APPROVED' } }
        : { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
    });
    const page = await ctx.newPage();
    await page.goto(base + cas.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    try {
      await page.locator(cas.ouvrir).first().click({ timeout: 8000 });
    } catch {
      echecs.push(`${cas.nom} (${theme}) : impossible d’ouvrir`);
      await nav.close();
      continue;
    }
    await page.waitForTimeout(1500);

    if (cas.modale) {
      // Une modale centrée : on vérifie ce qui se voit - un fond opaque, des
      // coins arrondis, un panneau entièrement dans la fenêtre.
      const mm = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return {
          fond: cs.backgroundColor,
          rayon: parseFloat(cs.borderTopLeftRadius) || 0,
          dedans: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          hauteur: Math.round(r.height),
        };
      }, cas.modale);
      await page.screenshot({ path: `qa/screenshots/refonte/feuille-${cas.nom}-${theme}.png` });
      await nav.close();
      if (!mm) { echecs.push(`${cas.nom} (${theme}) : aucune modale`); continue; }
      const pb = [];
      if (/rgba\(0, 0, 0, 0\)|transparent/.test(mm.fond)) pb.push('fond transparent');
      if (mm.rayon < 8) pb.push(`rayon ${mm.rayon}px`);
      if (!mm.dedans) pb.push('déborde de la fenêtre');
      console.log(`  ${pb.length ? 'ÉCHEC' : 'ok   '} ${cas.nom.padEnd(16)} ${theme.padEnd(5)} fond=${mm.fond} rayon=${mm.rayon}px haut=${mm.hauteur}px`);
      if (pb.length) echecs.push(`${cas.nom} (${theme}) : ${pb.join(', ')}`);
      continue;
    }

    const m = await page.evaluate(() => {
      const panneau = document.querySelector('.nl-sheet-panel');
      if (!panneau) return null;
      const coque = panneau.querySelector('nl-bottom-sheet-shell') ?? panneau.firstElementChild;
      const cs = getComputedStyle(coque);
      // On mesure la FEUILLE, pas son panneau : le panneau pouvait occuper
      // tout l'écran pendant que la feuille, elle, restait étroite dans un
      // coin - ce que la première version de cette sonde laissait passer.
      const r = coque.getBoundingClientRect();
      const fond = document.querySelector('.nl-sheet-backdrop');
      return {
        fond: cs.backgroundColor,
        rayon: parseFloat(cs.borderTopLeftRadius) || 0,
        police: cs.fontFamily,
        basEcran: Math.abs(r.bottom - window.innerHeight) < 2,
        pleineLargeur: r.width >= Math.min(window.innerWidth, 560) - 2,
        hauteur: Math.round(r.height),
        voileOpaque: fond ? getComputedStyle(fond).backgroundColor !== 'rgba(0, 0, 0, 0)' : false,
      };
    });

    await page.screenshot({ path: `qa/screenshots/refonte/feuille-${cas.nom}-${theme}.png` });
    await nav.close();

    if (!m) { echecs.push(`${cas.nom} (${theme}) : aucun panneau`); continue; }
    const transparent = /rgba\(0, 0, 0, 0\)|transparent/.test(m.fond);
    const problemes = [];
    if (transparent) problemes.push('fond transparent');
    if (m.rayon < 8) problemes.push(`rayon ${m.rayon}px`);
    if (!/Jakarta/.test(m.police)) problemes.push(`police ${m.police.slice(0, 20)}`);
    if (!m.basEcran) problemes.push('pas calée en bas');
    if (!m.pleineLargeur) problemes.push('pas pleine largeur');
    if (!m.voileOpaque) problemes.push('voile absent');

    console.log(`  ${problemes.length ? 'ÉCHEC' : 'ok   '} ${cas.nom.padEnd(16)} ${theme.padEnd(5)} fond=${m.fond} rayon=${m.rayon}px haut=${m.hauteur}px`);
    if (problemes.length) echecs.push(`${cas.nom} (${theme}) : ${problemes.join(', ')}`);
  }
}

console.log('');
if (echecs.length) {
  console.error('ÉCHEC :\n  - ' + echecs.join('\n  - '));
  process.exit(1);
}
console.log('Toutes les feuilles s’affichent correctement.');
