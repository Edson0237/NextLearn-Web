import { test, expect, Page } from '@playwright/test';
import { clearSession, seedSession, stubApi } from './fixtures/auth';

const STUDENT_PROFIL = {
  id: 'etu-p11',
  email: 'p11@saintjeaningenieur.org',
  nom: 'Nguemo',
  prenom: 'Aline',
  universite: 'Saint Jean Ingénieur',
  cycle: 'INGENIEUR',
  filiere: 'ISI',
  niveau: 'N3' as const,
  langue: 'fr' as const,
};

function reponseCatalogueExemple(section: string | null, extra?: { alt?: boolean; filtreType?: string | null }) {
  const titre = extra?.alt
    ? 'Cours Licence — Algèbre linéaire'
    : section === 'ANGLOPHONE'
      ? 'Operating Systems Lecture'
      : 'Systèmes d’exploitation';
  return {
    data: {
      ressources: [
        {
          id: extra?.alt ? 'doc-alt-1' : `doc-${section ?? 'all'}`,
          titre,
          type: extra?.filtreType || 'COURS',
          typeEpreuve: extra?.filtreType === 'EPREUVE' ? 'SN' : null,
          matiere: { id: 'mat-1', nom: 'Systèmes' },
          enseignant: { id: 'ens-1', nom: 'Dr Tchuente' },
          anneeAcademique: '2025-2026',
          semestre: 'S1',
          niveau: extra?.alt ? 'N1' : 'N3',
          section: section ?? 'FRANCOPHONE',
          avecCorrige: false,
          dureeMinutes: null,
          fichier: { pages: 12, tailleMb: 1.4 },
          dateAjout: '2026-10-01T10:00:00.000Z',
        },
      ],
      total: 1,
      pagination: { limit: 20, page: 1, hasMore: false, nextCursor: null },
      filtresActifs: {
        type: extra?.filtreType ? [extra.filtreType] : [],
        typeEpreuve: [],
        semestre: [],
        matiere: [],
        enseignant: [],
        annee: [],
        section: section ? [section] : [],
        avecCorrige: null,
        q: null,
        tri: 'recent',
      },
      facettes: {
        type: [
          { valeur: 'COURS', label: 'Cours', labelEn: 'Lectures', n: 1, selectionne: extra?.filtreType === 'COURS' },
          { valeur: 'EPREUVE', label: 'Épreuve', labelEn: 'Past paper', n: 1, selectionne: extra?.filtreType === 'EPREUVE' },
        ],
        typeEpreuve: [
          { valeur: 'SN', label: 'Session normale', labelEn: 'Main session', n: 1, selectionne: false },
          { valeur: null, valeurFiltre: 'NON_PRECISE', label: 'Non précisé', labelEn: 'Not specified', n: 1, selectionne: false },
        ],
        semestre: [
          { valeur: 'S1', label: 'Semestre 1', labelEn: 'Semester 1', n: 1, selectionne: false },
        ],
        matiere: [{ valeur: 'mat-1', label: 'Systèmes', labelEn: 'Systems', n: 1, selectionne: false }],
        enseignant: [{ valeur: 'ens-1', label: 'Dr Tchuente', labelEn: 'Dr Tchuente', n: 1, selectionne: false }],
        annee: [{ valeur: '2025-2026', label: '2025-2026', labelEn: '2025-2026', n: 1, selectionne: false }],
        section: [],
        avecCorrige: [],
      },
    },
  };
}

async function mockerApiP11(page: Page, initialUser: Record<string, unknown>) {
  const requetesCatalogue: URL[] = [];
  let userCourant = { ...initialUser };

  await stubApi(page);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: userCourant }),
    });
  });

  await page.route('**/api/profile**', async (route) => {
    const req = route.request();
    if (req.method() === 'PUT' || req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      userCourant = { ...userCourant, ...body };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: userCourant, stats: {} } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user: userCourant, stats: {} } }),
    });
  });

  await page.route('**/api/v2/catalogue**', async (route) => {
    const url = new URL(route.request().url());
    requetesCatalogue.push(url);
    const sec = url.searchParams.get('section');
    const alt = url.searchParams.has('universiteId');
    const filtreType = url.searchParams.get('type');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(reponseCatalogueExemple(sec, { alt, filtreType })),
    });
  });

  await page.route('**/api/references/universites', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { _id: 'univ-sji', nom: 'Saint Jean Ingénieur' },
          { _id: 'univ-uy1', nom: 'Université de Yaoundé I' },
        ],
      }),
    });
  });

  await page.route('**/api/references/cycles**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ value: 'LICENCE', label: 'Licence' }],
      }),
    });
  });

  await page.route('**/api/references/filieres**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ _id: 'fil-info', nom: 'Informatique L1' }],
      }),
    });
  });

  await page.route('**/api/references/niveaux**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ value: 'N1', label: 'Niveau 1 (L1)' }],
      }),
    });
  });

  return { requetesCatalogue };
}

test.describe('Bibliothèque P11 & SectionModal', () => {
  test('modal première connexion bloque le catalogue sans section puis persiste le choix', async ({ page }) => {
    const { requetesCatalogue } = await mockerApiP11(page, STUDENT_PROFIL);
    await page.goto('/');
    await clearSession(page);
    await seedSession(page, STUDENT_PROFIL, { locked: false });

    await page.goto('/app/bibliotheque');

    const modalTitre = page.locator('#nl-sec-titre');
    await expect(modalTitre).toBeVisible({ timeout: 5000 });
    expect(requetesCatalogue.length).toBe(0);

    await page.getByRole('radio', { name: /Section Francophone/i }).click();
    await page.getByRole('button', { name: /Continuer/i }).click();

    await expect(modalTitre).toBeHidden({ timeout: 5000 });
    await expect(page.locator('body')).toContainText('Systèmes d’exploitation', { timeout: 5000 });
    expect(requetesCatalogue.some((u) => u.searchParams.get('section') === 'FRANCOPHONE')).toBe(true);
  });

  test('résolution automatique de classe (sans bandeau Changer de classe), filtres combinables et 320px responsive', async ({ page }) => {
    const userAvecSection = { ...STUDENT_PROFIL, sectionPreference: 'FRANCOPHONE' };
    const { requetesCatalogue } = await mockerApiP11(page, userAvecSection);
    await page.goto('/');
    await clearSession(page);
    await seedSession(page, userAvecSection, { locked: false });

    await page.setViewportSize({ width: 320, height: 680 });
    await page.goto('/app/bibliotheque');

    await expect(page.locator('body')).toContainText('Systèmes d’exploitation', { timeout: 5000 });

    // Aucun bandeau « Ma classe » / « Changer de classe » affiché
    await expect(page.locator('.nl-biblio__classe')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Changer de classe/i })).toHaveCount(0);

    // Résolution automatique côté serveur : aucun universiteId/filiereId/niveau envoyé
    expect(
      requetesCatalogue.every(
        (u) => !u.searchParams.has('universiteId') && !u.searchParams.has('filiereId') && !u.searchParams.has('niveau'),
      ),
    ).toBe(true);

    // Responsive 320px : pas de débordement horizontal
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(debordement).toBe(false);

    // Combinaison filtre Cours + nature NON_PRECISE puis retrait individuel d'une pastille
    await page.getByRole('tab', { name: /Cours/i }).click();
    await page.getByRole('button', { name: /Non précisé/i }).click();
    await expect(page.locator('.nl-biblio__pastille')).toHaveCount(2);
    await page.locator('.nl-biblio__pastille').first().click();
    await expect(page.locator('.nl-biblio__pastille')).toHaveCount(1);
  });
});
