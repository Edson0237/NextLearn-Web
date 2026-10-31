import { test, expect } from '@playwright/test';
import { clearSession, seedSession, stubApi } from './fixtures/auth';

const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  nom: 'Test',
  prenom: 'User',
  universite: 'Test University',
  filiere: 'Informatique',
  niveau: 'n3' as const,
  langue: 'fr' as const,
};

test.describe('Lecteur PDF', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await page.goto('/');
    await clearSession(page);
    await seedSession(page, TEST_USER, { locked: false });
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('affiche réellement le document quand le backend renvoie une URL signée', async ({ page }) => {
    const signedUrl = 'https://example.com/fake-document.pdf';

    await page.route('**/api/documents/test-doc/signed-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { url: signedUrl } }),
      });
    });
    await page.route(signedUrl, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        path: 'e2e/fixtures/echantillon.pdf',
      });
    });

    await page.goto('/app/bibliotheque/doc/test-doc/read');

    // `toBeAttached()` suffisait jusqu'ici : il ne regarde que la présence
    // dans le DOM. Or le lecteur était bien là, et mesurait 390x0 — le PDF
    // était chargé et jamais peint. Ce test passait donc sur une
    // fonctionnalité invisible. On vérifie désormais la seule chose qui
    // compte pour un lecteur : qu'il occupe de la place et qu'il a dessiné.
    const viewport = page.locator('.pdf-reader__viewport');
    await expect(viewport).toBeVisible({ timeout: 10_000 });
    const boite = await viewport.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThan(200);

    await expect(page.locator('pdf-viewer canvas')).toBeVisible({ timeout: 15_000 });
  });

  test('affiche une erreur si aucune URL n\'est disponible', async ({ page }) => {
    await page.route('**/api/documents/test-doc/signed-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      });
    });

    await page.goto('/app/bibliotheque/doc/test-doc/read');

    // Le lecteur distingue deux échecs : l'URL signée absente — ce que ce
    // test provoque — et l'exception. Le test attendait le second message
    // parce qu'avec un backend injoignable `getById` levait, et que la
    // branche `catch` répondait à sa place. L'assertion portait donc sur
    // une panne de réseau, pas sur le cas qu'elle nomme.
    await expect(page.locator('body')).toContainText('Impossible d\'obtenir l\'URL du document.', { timeout: 5000 });
  });
});
