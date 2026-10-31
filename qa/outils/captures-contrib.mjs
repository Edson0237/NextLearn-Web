/**
 * Captures des écrans repris dans cette passe : contribution, accueil et
 * bibliothèque. L'API est jouée avec des dépôts à plusieurs statuts et
 * étalés sur six mois - sans cela, la barre de répartition et
 * l'histogramme n'auraient rien à montrer.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4400';
const sortie = 'qa/screenshots/refonte';
mkdirSync(sortie, { recursive: true });

const ilYaMois = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
};

const DEPOTS = [
  { _id: 'd1', titre: 'Fiche de révision - Algorithmique L2', description: 'Résumé complet du semestre, avec les corrigés des TD 1 à 6.', type: 'synthese', status: 'publie', licence: 'auteur', createdAt: ilYaMois(0) },
  { _id: 'd2', titre: 'Examen Terminal INF201 (2024)', description: 'Sujet scanné, remis par le département.', type: 'epreuve', status: 'publie', licence: 'institutionnel', createdAt: ilYaMois(0) },
  { _id: 'd3', titre: 'TD3 Arbres binaires - corrigé manuscrit', description: 'Mes notes de TD, relues avec le chargé de TD.', type: 'td', status: 'en_revue', licence: 'auteur', createdAt: ilYaMois(1) },
  { _id: 'd4', titre: 'Polycopié Architecture Matérielle', description: 'Support distribué en amphi au premier semestre.', type: 'cours', status: 'en_attente', licence: 'institutionnel', createdAt: ilYaMois(1) },
  { _id: 'd5', titre: 'Annales Analyse 2022', description: '', type: 'annales', status: 'publie', licence: 'inconnue', createdAt: ilYaMois(2) },
  { _id: 'd6', titre: 'Résumé Séries de Fourier', description: 'Deux pages de formules, écrites à la main.', type: 'synthese', status: 'refuse', motifRefus: 'La qualité du scan ne permet pas de lire les formules de la page 2.', licence: 'auteur', createdAt: ilYaMois(3) },
  { _id: 'd7', titre: 'TP Réseaux - compte rendu', description: 'Compte rendu du TP de métrologie réseau.', type: 'tp', status: 'publie', licence: 'auteur', createdAt: ilYaMois(4) },
];

const DOCUMENTS = Array.from({ length: 8 }, (_, i) => ({
  _id: `doc${i + 1}`,
  titre: ['Examen Terminal INF201 (2024)', 'Polycopié Cours INF202', 'Fiche Mémo MAT201', 'TD3 & Corrigé'][i % 4],
  description: 'Support complet couvrant le programme du semestre.',
  type: ['EPREUVE', 'COURS', 'SYNTHESE', 'TD'][i % 4],
  matiereId: { _id: `m${i % 4}`, nom: ['Algorithmique', 'Architecture Matérielle', 'Séries de Fourier', 'Arbres Binaires'][i % 4] },
  enseignantId: { _id: 'e1', nom: 'Dr. A. Mbarga' },
  universiteId: { _id: 'u1', nom: 'Université de Yaoundé I' },
  niveau: 'L2', semestre: 'S1', anneeAcademique: '2023-2024',
  tailleMb: 1.2 + i, pages: 24 + i * 7, urlPdf: 'https://exemple.test/doc.pdf',
  dateAjout: ilYaMois(0), vues: 180 + i * 37, telechargements: 20 + i * 9, noteMoyenne: 3.6 + (i % 5) * 0.28,
}));

const jour = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const PROGRESSION = {
  stats: { totalMinutes: 1860, sessionCount: 34, streak: 7, docsLus: 24, matiereTop: 'Algorithmique', streakDoneToday: true },
  week: [
    { day: jour(6), minutes: 45 }, { day: jour(5), minutes: 80 }, { day: jour(4), minutes: 25 },
    { day: jour(3), minutes: 0 }, { day: jour(2), minutes: 110 }, { day: jour(1), minutes: 60 },
    { day: jour(0), minutes: 95 },
  ],
  matieres: [
    { matiere: 'Algorithmique', minutes: 620 },
    { matiere: 'Architecture Matérielle', minutes: 410 },
    { matiere: 'Séries de Fourier', minutes: 285 },
    { matiere: 'Arbres Binaires', minutes: 160 },
  ],
  badges: [
    { type: 'premiere_lecture', titre: 'Première lecture', description: 'Tu as lu ton premier document.', earnedAt: jour(30) },
    { type: 'serie_7', titre: 'Sept jours', description: 'Sept jours d’affilée.', earnedAt: jour(2) },
    { type: 'dix_docs', titre: 'Dix documents', description: 'Dix documents lus.', earnedAt: jour(10) },
  ],
  sessions: [
    { id: 's1', documentTitre: 'Examen Terminal INF201 (2024)', dureeSecondes: 2700, pagesLues: 18, date: jour(0) },
    { id: 's2', documentTitre: 'Polycopié Cours INF202', dureeSecondes: 1500, pagesLues: 11, date: jour(1) },
    { id: 's3', documentTitre: 'Fiche Mémo MAT201', dureeSecondes: 900, pagesLues: 6, date: jour(2) },
  ],
};

const ECRANS = [
  ['progression-donnees', '/app/progression'],
  ['contribution', '/app/depots'],
  ['accueil-formats', '/app/home'],
  ['bibliotheque-rails', '/app/bibliotheque'],
];

const navigateur = await chromium.launch({ channel: 'chromium' });

for (const theme of ['light', 'dark']) {
  for (const [nom, chemin] of ECRANS) {
    const contexte = await navigateur.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: 'fr-FR', colorScheme: theme, serviceWorkers: 'block',
    });
    await contexte.addInitScript(() => {
      const dans = new Date(Date.now() + 86_400_000).toISOString();
      localStorage.setItem('nl_jwt_token', 'jeton-de-capture');
      localStorage.setItem('nl_jwt_expiry', dans);
      localStorage.setItem('nl_refresh_token', 'rafraichissement');
      localStorage.setItem('nl_user_data', JSON.stringify({
        id: 'u-camille', email: 'camille@exemple.test', nom: 'Djomo', prenom: 'Camille',
        universite: 'Université de Yaoundé I', filiere: 'Informatique',
        niveau: 'n2', cycle: 'licence', langue: 'fr', verificationStatus: 'APPROVED',
      }));
      localStorage.setItem('nl_first_launch', '0');
      localStorage.setItem('nl_last_otp_verified_at', dans);
    });
    await contexte.route('**/api/**', async (route) => {
      const url = route.request().url();
      let corps = { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
      if (/verification\/requests\/me/.test(url)) corps = { data: { statut: 'APPROVED' } };
      else if (/\/api\/documents\/submissions|\/api\/contributions/.test(url)) corps = { data: DEPOTS, meta: { page: 1, totalPages: 1, total: DEPOTS.length } };
      else if (/\/api\/documents/.test(url)) corps = { data: DOCUMENTS, meta: { page: 1, totalPages: 1, total: DOCUMENTS.length } };
      else if (/progression\/stats/.test(url)) corps = { data: PROGRESSION.stats };
      else if (/progression\/week-activity/.test(url)) corps = { data: { activities: PROGRESSION.week } };
      else if (/progression\/matiere-activity/.test(url)) corps = { data: { activities: PROGRESSION.matieres } };
      else if (/progression\/badges/.test(url)) corps = { data: PROGRESSION.badges };
      else if (/progress\/sessions/.test(url)) corps = { data: PROGRESSION.sessions };
      else if (/\/api\/matieres/.test(url)) {
        corps = { data: [{ _id: 'm0', nom: 'Algorithmique', couleur: '#1a4a7e' }, { _id: 'm1', nom: 'Architecture Matérielle' }], meta: { page: 1, totalPages: 1, total: 2 } };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
    });

    const onglet = await contexte.newPage();
    const erreurs = [];
    onglet.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
    await onglet.goto(base + chemin, { waitUntil: 'networkidle' });
    await onglet.waitForTimeout(4000);
    const fichier = join(sortie, `${nom}_390x844_${theme}.png`);
    await onglet.screenshot({ path: fichier, fullPage: nom !== 'contribution' });
    const texte = (await onglet.locator('body').innerText()).trim();
    console.log(`capture : ${fichier}  (url: ${onglet.url().replace(base, '')}, ${texte.length} car.)`);
    for (const e of erreurs) console.log(`   ERREUR: ${e}`);
    await contexte.close();
  }
}

await navigateur.close();
