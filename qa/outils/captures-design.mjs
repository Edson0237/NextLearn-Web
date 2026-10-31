/**
 * Captures de la refonte « Academic Clarity ».
 *
 * Les écrans visés sont derrière la garde d'authentification et vivent de
 * données serveur. Plutôt que de dépendre d'un compte réel - dont le contenu
 * change et qui ferait des captures une cible mouvante - la session est semée
 * dans `localStorage` et l'API est jouée localement, avec un jeu de données
 * fixe. Deux captures identiques signifient alors que rien n'a bougé dans le
 * rendu, et rien d'autre.
 *
 *   node qa/outils/captures-design.mjs [URL_DE_BASE]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4400';
const sortie = 'qa/screenshots/refonte';

const MATIERES = [
  { _id: 'm1', nom: 'Algorithmique' },
  { _id: 'm2', nom: 'Architecture Matérielle' },
  { _id: 'm3', nom: 'Séries de Fourier' },
  { _id: 'm4', nom: 'Arbres Binaires' },
];

const documents = Array.from({ length: 12 }, (_, i) => {
  const types = ['EPREUVE', 'COURS', 'SYNTHESE', 'TD', 'CORRIGE', 'TP'];
  const titres = [
    'Examen Terminal INF201', 'Polycopié Cours INF202', 'Fiche Mémo MAT201',
    'TD3 & Corrigé', 'Travaux Pratiques Réseaux', 'Annales 2023 - Analyse',
  ];
  const m = MATIERES[i % MATIERES.length];
  return {
    _id: `doc${i + 1}`,
    titre: `${titres[i % titres.length]} (${2024 - (i % 3)})`,
    description:
      'Support complet couvrant l’intégralité du programme du semestre, ' +
      'avec exercices corrigés et annales des trois dernières sessions.',
    type: types[i % types.length],
    matiereId: m,
    enseignantId: { _id: 'e1', nom: 'Dr. A. Mbarga' },
    universiteId: { _id: 'u1', nom: 'Université de Yaoundé I' },
    niveau: 'L2',
    semestre: 'S1',
    avecCorrige: i % 3 === 0,
    urlCorrigePdf: i % 3 === 0 ? 'https://exemple.test/corrige.pdf' : undefined,
    anneeAcademique: `${2023 + (i % 2)}-${2024 + (i % 2)}`,
    tailleMb: 1.2 + (i % 7) * 1.8,
    pages: 24 + i * 7,
    urlPdf: 'https://exemple.test/doc.pdf',
    dateAjout: new Date(Date.now() - i * 86_400_000).toISOString(),
    vues: 180 + i * 37,
    telechargements: 20 + i * 9,
    noteMoyenne: 3.6 + (i % 5) * 0.28,
  };
});

/** `{data, meta}` : l'enveloppe que tous les dépôts attendent. */
const page = (items) => ({
  data: items,
  meta: { page: 1, totalPages: 1, total: items.length },
});

const REPONSES = [
  [/\/api\/documents\/[^/]+\/(view|rate|download)$/, { data: { ok: true } }],
  [/\/api\/documents\/[^/]+\/signed-url$/, { data: { url: 'https://exemple.test/doc.pdf' } }],
  [/\/api\/documents\/(recommended|popular|recent)/, page(documents.slice(0, 6))],
  [/\/api\/documents\/search/, page(documents)],
  [/\/api\/documents\/[^/?]+$/, { data: documents[0] }],
  [/\/api\/documents/, page(documents)],
  [/\/api\/matieres/, page(MATIERES.map((m) => ({ ...m, couleur: '#2563eb', documentsCount: 12 })))],
  [/\/api\/favorites|\/api\/favoris/, page(documents.slice(2, 6))],
  // `/api/offline/documents` rend des entrées `{documentId}`, pas des
  // identifiants nus : des chaînes laissaient l'écran vide.
  [/\/api\/offline/, page(documents.slice(0, 4).map((d) => ({ documentId: d._id })))],
  [/\/api\/verification\/requests\/me/, { data: { statut: 'APPROVED' } }],
  [/\/api\/progression\/stats/, { data: { documentsLus: 24, tempsTotal: 1840, serie: 7, quizReussis: 12 } }],
  [/\/api\/progression/, { data: [] }],
  [/\/api\/notifications\/unread-count/, { data: { count: 3 } }],
  [/\/api\/notifications/, page([])],
  [/\/api\/profile/, { data: { nom: 'Camille Djomo', email: 'camille@exemple.test', niveau: 'L2', filiere: 'Informatique', universite: 'Université de Yaoundé I' } }],
  [/\/api\//, { data: [] }],
];

const ECRANS = [
  ['accueil', '/app/home'],
  ['bibliotheque', '/app/bibliotheque'],
  ['fiche-ressource', '/app/bibliotheque/doc/doc1'],
  ['ma-bibliotheque', '/app/offline'],
];

const APPAREILS = [
  ['390x844', 390, 844],
  ['430x932', 430, 932],
];

mkdirSync(sortie, { recursive: true });
// `channel` vise le Chromium complet : la coque sans tête, elle, n'est pas
// installée, et c'est elle que Playwright prend par défaut.
const navigateur = await chromium.launch({ channel: 'chromium' });

for (const [nomAppareil, largeur, hauteur] of APPAREILS) {
  for (const theme of ['light', 'dark']) {
    const contexte = await navigateur.newContext({
      viewport: { width: largeur, height: hauteur },
      deviceScaleFactor: 2,
      locale: 'fr-FR',
      colorScheme: theme,
      // Le service worker servirait une version mise en cache : ce qu'on
      // veut capturer est le build qu'on vient de produire, pas le précédent.
      serviceWorkers: 'block',
    });

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
      // Surtout pas de `nl_pin_hash` : il suffit à marquer la session
      // verrouillée (`hasLocalPin()`), et la garde renverrait toutes les
      // captures sur le pavé numérique.
      localStorage.setItem('nl_last_otp_verified_at', dans);
    });

    await contexte.route('**/api/**', async (route) => {
      const url = route.request().url();
      const corps = REPONSES.find(([motif]) => motif.test(url))?.[1] ?? { data: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
    });

    const onglet = await contexte.newPage();
    for (const [nom, chemin] of ECRANS) {
      await onglet.goto(base + chemin, { waitUntil: 'networkidle' });
      // Les cartes entrent en cascade : capturer avant la fin donnerait des
      // vignettes à demi transparentes, et une capture non reproductible.
      await onglet.waitForTimeout(4500);
      const fichier = join(sortie, `${nom}_${nomAppareil}_${theme}.png`);
      await onglet.screenshot({ path: fichier, fullPage: true });
      console.log(`capture : ${fichier}`);
    }
    await contexte.close();
  }
}

await navigateur.close();
