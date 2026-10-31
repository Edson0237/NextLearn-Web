/** Éprouve les filtres de la bibliothèque et de la liste des épreuves, sur des données simulées aux réponses connues. */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const doc = (i, titre, type, mat, extra = {}) => ({ _id: `d${i}`, id: `d${i}`, titre, type, matiereId: { _id: mat[0], nom: mat[1] }, niveau: 'N2', pages: 10, tailleMb: 1, vues: 0, noteMoyenne: 0, ...extra });
const docs = [
  doc(1, 'Algo cours', 'COURS', ['m1', 'Algorithmique']), doc(2, 'Algo TD 1', 'TD', ['m1', 'Algorithmique']), doc(3, 'Algo TD 2', 'TD', ['m1', 'Algorithmique']),
  doc(4, 'Réseaux TD', 'TD', ['m2', 'Réseaux']), doc(5, 'Réseaux synthèse', 'SYNTHESE', ['m2', 'Réseaux']), doc(6, 'BD exposé', 'EXPOSE', ['m3', 'Bases de données']),
];
const ep = (i, mat, annee, type, corrige) => ({ _id: `e${i}`, id: `e${i}`, matiereId: { _id: mat[0], nom: mat[1] }, annee, typeEpreuve: type, avecCorrige: corrige, niveau: 'N2', dureeMinutes: 120, urlPdf: 'x', vues: 0, telechargements: 0, noteMoyenne: 0 });
const epreuves = [ep(1, ['m1', 'Algorithmique'], 2024, 'CC', true), ep(2, ['m1', 'Algorithmique'], 2023, 'SN', false), ep(3, ['m2', 'Réseaux'], 2024, 'SN', true), ep(4, ['m2', 'Réseaux'], 2022, 'CC', false), ep(5, ['m3', 'Bases de données'], 2024, null, false)];
const types = ['COURS', 'TD', 'SYNTHESE', 'EXPOSE', 'EPREUVE'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase(), collection: 'documents' }));
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 1400 }, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'c@e.t', nom: 'D', prenom: 'C', universite: 'U', filiere: 'I', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const requetes = [];
await ctx.route('**/api/**', (r) => {
  const u = r.request().url(); let data = []; requetes.push(u.replace(/^.*\/api/, ''));
  if (/verification/.test(u)) data = { statut: 'APPROVED' };
  else if (/document-types/.test(u)) data = types;
  else if (/\/api\/epreuves/.test(u)) data = epreuves;
  else if (/\/api\/documents/.test(u)) data = { items: docs, total: docs.length, page: 1, totalPages: 1 };
  const corps = /\/api\/documents/.test(u) && !/document-types/.test(u) && !Array.isArray(data) && data.items
    ? { data: data.items, meta: { page: 1, totalPages: 1, total: data.total } }
    : { data };
  if (/\/api\/epreuves/.test(u) && !/epreuves\/\w/.test(u)) {
    // Le serveur découpe en pages de 3 ici : si l'écran n'en lit qu'une, il en manquera.
    const n = Number(new URL(u).searchParams.get('page') ?? 1);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: epreuves.slice((n - 1) * 3, n * 3), meta: { page: n, limit: 3, total: epreuves.length, totalPages: Math.ceil(epreuves.length / 3) } }) });
    return;
  }
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});
const page = await ctx.newPage();
const cartes = () => page.locator('nl-document-card').count();
const titres = () => page.locator('nl-document-card .nl-doc-card__titre').allInnerTexts();
const resultats = [];
const verifier = (nom, ok, detail = '') => { resultats.push(ok); console.log(`${ok ? '  ✔' : '  ✘'} ${nom}${detail ? ' — ' + detail : ''}`); };

// ── Bibliothèque ──
await page.goto(`${base}/app/bibliotheque`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
verifier('bibliothèque : tout s’affiche sans filtre', (await cartes()) === 6, `${await cartes()}`);
const chips = await page.locator('.nl-biblio__segment').allInnerTexts();
verifier('puces de format : celles du serveur, avec leur compte', /Tous\s*6/.test(chips[0].replace(/\n/g, ' ')) && chips.some((c) => /Td\s*3/.test(c.replace(/\n/g, ' '))), chips.map((c) => c.replace(/\n/g, ' ')).join(' | '));
await page.locator('.nl-biblio__segment', { hasText: 'Td' }).click(); await page.waitForTimeout(500);
verifier('filtre format TD : 3 documents, tous TD', (await cartes()) === 3 && (await titres()).every((t) => /TD/.test(t)), (await titres()).join(', '));
await page.locator('.nl-biblio__puce', { hasText: 'Réseaux' }).click(); await page.waitForTimeout(500);
verifier('format TD + matière Réseaux : l’intersection (1)', (await cartes()) === 1 && (await titres())[0] === 'Réseaux TD', (await titres()).join(', '));
await page.locator('.nl-biblio__segment', { hasText: 'Tous' }).click(); await page.waitForTimeout(500);
verifier('format « Tous » garde la matière : 2 documents Réseaux', (await cartes()) === 2, `${await cartes()}`);
await page.locator('.nl-biblio__puce', { hasText: 'Tous' }).first().click(); await page.waitForTimeout(500);
// ── Panneau « Filtres », pastille et comptes à facettes ──
const pastille = async () => (await page.locator('.nl-biblio__recherche nl-search-bar').innerText()).replace(/\s+/g, ' ');
await page.locator('.nl-biblio__segment', { hasText: 'Td' }).click(); await page.waitForTimeout(300);
await page.locator('.nl-biblio__puce', { hasText: 'Algorithmique' }).click(); await page.waitForTimeout(300);
const facettes = (await page.locator('.nl-biblio__segment').allInnerTexts()).map((c) => c.replace(/\s+/g, ' '));
verifier('compte des formats tenant compte de la matière (Algo : Tous 3, Td 2)', facettes.some((c) => /Tous\s*3/.test(c)) && facettes.some((c) => /Td\s*2/.test(c)), facettes.join(' | '));
await page.locator('.nl-biblio__recherche input').fill('algo'); await page.waitForTimeout(400);
verifier('la pastille compte format + matière + texte', /\b3\b/.test(await pastille()), await pastille());
await page.locator('.nl-biblio__recherche input').fill('');
await page.locator('.nl-biblio__recherche button[aria-label], .nl-biblio__recherche button').last().click(); await page.waitForTimeout(600);
verifier('« Filtres » ouvre un panneau (pas le catalogue)', (await page.locator('nl-filtres-sheet').count()) === 1 && !/matieres/.test(page.url()), page.url());
await page.locator('nl-filtres-sheet .nl-filtres__reset').click(); await page.waitForTimeout(200);
await page.locator('nl-filtres-sheet .nl-filtres__puce', { hasText: 'Réseaux' }).click(); await page.waitForTimeout(200);
const voir = (await page.locator('.nl-filtres__valider').innerText()).trim();
verifier('le bouton annonce le nombre de résultats (2)', /2/.test(voir), voir);
await page.locator('.nl-filtres__valider').click(); await page.waitForTimeout(500);
verifier('valider applique le brouillon : 2 documents Réseaux', (await cartes()) === 2, `${await cartes()}`);
await page.locator('.nl-biblio__recherche button').last().click(); await page.waitForTimeout(500);
await page.locator('nl-filtres-sheet .nl-filtres__reset').click(); await page.locator('nl-filtres-sheet [aria-label]').first().click(); await page.waitForTimeout(500);
verifier('fermer sans valider ne change rien', (await cartes()) === 2, `${await cartes()}`);
await page.locator('.nl-biblio__recherche button').last().click(); await page.waitForTimeout(500);
await page.locator('.nl-filtres__catalogue').click(); await page.waitForTimeout(800);
verifier('« Parcourir par matière » mène au catalogue', /matieres/.test(page.url()), page.url());
await page.goto(`${base}/app/bibliotheque`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
await page.locator('.nl-biblio__recherche input').fill('algo'); await page.waitForTimeout(600);
verifier('recherche « algo » : 3 documents', (await cartes()) === 3, (await titres()).join(', '));
await page.locator('.nl-biblio__recherche input').fill('a'); await page.waitForTimeout(500);
verifier('un seul caractère ne filtre pas encore', (await cartes()) === 6, `${await cartes()}`);
await page.locator('.nl-biblio__recherche input').fill('zzzzz'); await page.waitForTimeout(500);
verifier('aucun résultat : l’état vide s’affiche', (await cartes()) === 0 && (await page.locator('.nl-biblio__corps').innerText()).length > 10);
await page.locator('.nl-biblio__recherche input').fill('');
await page.goto(`${base}/app/bibliotheque?type=td`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
verifier('lien /bibliotheque?type=td : le filtre est déjà posé', (await cartes()) === 3, `${await cartes()}`);

// ── Épreuves ──
await page.goto(`${base}/app/epreuves`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
verifier('épreuves : toutes, de la plus récente à la plus ancienne', (await page.locator('.nl-epl__carte').count()) === 5, `${await page.locator('.nl-epl__carte').count()}`);
const avantFiltres = requetes.length;
await page.locator('.nl-epl__segment', { hasText: /^\s*CC|Contrôle/ }).first().click(); await page.waitForTimeout(500);
verifier('nature CC : 2 épreuves', (await page.locator('.nl-epl__carte').count()) === 2, `${await page.locator('.nl-epl__carte').count()}`);
await page.locator('.nl-epl__segment', { hasText: /SN|Session/ }).first().click(); await page.waitForTimeout(500);
verifier('nature SN : 2 épreuves (la nature inconnue n’est ni CC ni SN)', (await page.locator('.nl-epl__carte').count()) === 2, `${await page.locator('.nl-epl__carte').count()}`);
await page.locator('.nl-epl__toggle').click(); await page.waitForTimeout(500);
verifier('SN + avec corrigé : 1', (await page.locator('.nl-epl__carte').count()) === 1, `${await page.locator('.nl-epl__carte').count()}`);
await page.locator('.nl-epl__reset').click(); await page.waitForTimeout(500);
verifier('réinitialiser : retour aux 5', (await page.locator('.nl-epl__carte').count()) === 5, `${await page.locator('.nl-epl__carte').count()}`);
await page.locator('.nl-epl__select').selectOption('2024'); await page.waitForTimeout(500);
verifier('année 2024 : 3 épreuves', (await page.locator('.nl-epl__carte').count()) === 3, `${await page.locator('.nl-epl__carte').count()}`);
await page.locator('.nl-epl__puce', { hasText: 'Réseaux' }).click(); await page.waitForTimeout(500);
verifier('2024 + Réseaux : 1', (await page.locator('.nl-epl__carte').count()) === 1, `${await page.locator('.nl-epl__carte').count()}`);
verifier('aucun appel serveur à chaque filtre (tout se fait sur la liste chargée)', requetes.length === avantFiltres, `${requetes.length - avantFiltres} appels pendant les filtres`);
