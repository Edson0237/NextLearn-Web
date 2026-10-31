/**
 * Capture l'écran d'accueil réel de la PWA, avec des données d'exemple, pour le
 * téléphone de la page d'accueil du site (`public/images/apercu-accueil.jpg`).
 * Le serveur est simulé : rien n'est lu en base, aucun compte réel n'apparaît.
 */
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:4200';
const sortie = process.argv[3] ?? 'public/images/apercu-accueil.jpg';
const nav = await chromium.launch({ channel: 'chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--disable-gpu'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'fr-FR', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  const dans = new Date(Date.now() + 86_400_000).toISOString();
  localStorage.setItem('nl_jwt_token', 'j'); localStorage.setItem('nl_jwt_expiry', dans); localStorage.setItem('nl_refresh_token', 'r');
  localStorage.setItem('nl_user_data', JSON.stringify({ id: 'u', email: 'a@e.t', nom: 'Mbarga', prenom: 'Aïcha', universite: 'Université de Yaoundé I', filiere: 'Informatique', niveau: 'n3', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED', hasPin: false }));
  localStorage.setItem('nl_first_launch', '0'); localStorage.setItem('nl_last_otp_verified_at', dans);
});
const doc = (i, titre, type, mat, extra = {}) => ({ _id: `d${i}`, id: `d${i}`, enseignantId: { _id: 'e1', nom: 'Dr Nkoulou' }, titre, type, matiereId: { _id: mat[0], nom: mat[1] }, niveau: 'N3', semestre: 'S1', pages: 24 + i * 6, tailleMb: 2.4, vues: 120 + i * 17, noteMoyenne: 4.5, anneeAcademique: '2025-2026', ...extra });
const docs = [
  doc(1, 'Algorithmique avancée : graphes et arbres', 'COURS', ['m1', 'Algorithmique']),
  doc(2, 'Bases de données relationnelles — TD 3', 'TD', ['m2', 'Bases de données']),
  doc(3, 'Réseaux : sujet de session normale 2025', 'EPREUVE', ['m3', 'Réseaux'], { avecCorrige: true }),
  doc(4, 'Systèmes d’exploitation — synthèse du chapitre 4', 'SYNTHESE', ['m4', 'Systèmes']),
];
await ctx.route('**/api/**', (r) => {
  const u = r.request().url(); let data = [];
  if (/verification/.test(u)) data = { statut: 'APPROVED' };
  else if (/api\/(profile|users\/me)$/.test(u)) data = { user: { id: 'u' }, stats: { docsTelecharges: 6, docsLus: 38, heuresEtude: 42, streak: 12 } };
  else if (/progression\/stats/.test(u)) data = { streak: 12, docsLus: 38, streakDoneToday: true };
  else if (/unread-count/.test(u)) data = { count: 2 };
  else if (/document-types/.test(u)) data = ['COURS', 'TD', 'EPREUVE', 'SYNTHESE', 'ANNALES', 'CORRIGE', 'TP', 'EXPOSE'].map((v) => ({ value: v, label: v[0] + v.slice(1).toLowerCase(), collection: 'documents' }));
  else if (/api\/documents/.test(u)) data = docs;
  const corps = /api\/documents(\?|$)/.test(u) ? { data: docs, meta: { page: 1, totalPages: 1, total: docs.length } } : { data };
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
});
const page = await ctx.newPage();
await page.goto(`${base}/app/home`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: sortie, type: 'jpeg', quality: 86 });
console.log('écrit :', sortie, '| url :', page.url());
await nav.close();
