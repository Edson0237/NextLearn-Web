/**
 * Captures des écrans Matières et Profil, avec des données réalistes :
 * des matières de la filière et du tronc commun, des documents répartis
 * entre elles, un profil complet. Sans cela, ces écrans n'ont rien à montrer.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4200';
const suffixe = process.argv[3] ?? 'apres';
mkdirSync('qa/screenshots/refonte', { recursive: true });

const MATIERES = [
  { id: 'm1', name: 'Algorithmique', color: '#1a4a7e', isTroncCommun: false },
  { id: 'm2', name: 'Architecture Matérielle', color: '#0891b2', isTroncCommun: false },
  { id: 'm3', name: 'Bases de données avancées', color: '#7c3aed', isTroncCommun: false },
  { id: 'm4', name: 'Réseaux', color: '#d97706', isTroncCommun: false },
  { id: 'm5', name: 'Analyse numérique', color: '#059669', isTroncCommun: true },
  { id: 'm6', name: 'Anglais technique', color: '#e11d48', isTroncCommun: true },
];
const REPARTITION = { m1: 9, m2: 4, m3: 7, m4: 2, m5: 5, m6: 1 };

const DOCS = Object.entries(REPARTITION).flatMap(([mid, n]) => {
  const m = MATIERES.find((x) => x.id === mid);
  return Array.from({ length: n }, (_, i) => ({
    _id: `d-${mid}-${i}`, titre: `${m.name} - séance ${i + 1}`, description: '', type: ['COURS', 'TD', 'EPREUVE'][i % 3],
    matiereId: { _id: mid, nom: m.name }, enseignantId: { _id: 'e1', nom: 'Dr. A. Mbarga' },
    universiteId: { _id: 'u1', nom: 'UY1' }, niveau: 'L2', semestre: 'S1', anneeAcademique: '2023-2024',
    tailleMb: 2, pages: 20, urlPdf: 'https://exemple.test/x.pdf', dateAjout: new Date().toISOString(),
    vues: 100, telechargements: 10, noteMoyenne: 4.1,
  }));
});

const ECRANS = [
  ['matieres', '/app/bibliotheque/matieres'],
  ['profil', '/app/profil'],
  ['a-propos', '/app/legal/a-propos'],
];

for (const theme of ['light', 'dark']) {
  for (const [nom, chemin] of ECRANS) {
    const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', colorScheme: theme, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      const dans = new Date(Date.now() + 864e5).toISOString();
      localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans);
      localStorage.setItem('nl_refresh_token', 'r');
      localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u1', email: 'camille.djomo@isj.cm', nom: 'Djomo', prenom: 'Camille', universite: 'Université de Yaoundé I', filiere: 'Informatique', niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED' }));
      localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
    });
    await ctx.route('**/api/**', (r) => {
      const u = r.request().url();
      const rep = (c) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
      if (/verification/.test(u)) return rep({ data: { statut: 'APPROVED' } });
      if (/me\/context/.test(u)) return rep({ data: { resolved: true, subjects: MATIERES, contentTypes: { cours: true, td: true, epreuve: true }, features: {}, scope: 'class_only' } });
      if (/progression\/stats|profile/.test(u)) return rep({ data: { streak: 7, docsLus: 24, totalMinutes: 1860, docsTelecharges: 4 } });
      if (/notifications\/unread-count/.test(u)) return rep({ data: { count: 0 } });
      if (/api\/documents/.test(u)) return rep({ data: DOCS, meta: { page: 1, totalPages: 1, total: DOCS.length } });
      return rep({ data: [], meta: {} });
    });
    const page = await ctx.newPage();
    await page.goto(base + chemin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6500);
    await page.screenshot({ path: `qa/screenshots/refonte/${nom}-${suffixe}_390x844_${theme}.png`, fullPage: true });
    console.log(`capture : ${nom}-${suffixe} ${theme}`);
    await nav.close();
  }
}
