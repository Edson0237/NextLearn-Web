import { test, expect, Page } from '@playwright/test';
import { clearSession, seedSession, stubApi, PIN_HASH_1234 } from './fixtures/auth';

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

async function prepare(page: Page, locked = false, withSession = true) {
  await stubApi(page);
  await page.goto('/');
  await clearSession(page);
  if (withSession) {
    await seedSession(page, TEST_USER, { locked, pinHash: locked ? PIN_HASH_1234 : undefined });
  }
  await page.goto('/', { waitUntil: 'networkidle' });
}

test.describe('Auth / Unlock', () => {
  test('unlock redirige vers login quand il n\'y a pas de session', async ({ page }) => {
    await prepare(page, false, false);
    await page.goto('/app/unlock');
    await page.waitForURL(/\/app\/(login|onboarding)/, { timeout: 5000 });
  });

  test('unlock affiche l\'écran de déverrouillage avec une session verrouillée', async ({ page }) => {
    await prepare(page, true);
    await page.goto('/app/unlock');
    await expect(page.locator('body')).toContainText('Bon retour', { timeout: 5000 });
    await expect(page.locator('body')).toContainText('PIN', { timeout: 5000 });
  });

  test('un PIN enregistré ne verrouille plus de lui-même', async ({ page }) => {
    // Le changement demandé : le code n'est plus réclamé à chaque ouverture.
    // On sème un PIN *sans* la préférence de verrouillage — l'état d'un
    // compte existant après mise à jour — et l'application doit s'ouvrir.
    await stubApi(page);
    await page.goto('/');
    await clearSession(page);
    await seedSession(page, TEST_USER, { locked: false, pinHash: PIN_HASH_1234 });
    await page.goto('/app/home', { waitUntil: 'domcontentloaded' });

    await expect(page).not.toHaveURL(/\/app\/unlock/);
  });

  test('unlock accepte le PIN correct et déverrouille', async ({ page }) => {
    await prepare(page, true);
    await page.goto('/app/unlock');
    await page.waitForSelector('nl-pin-input button', { timeout: 5000 });

    await page.locator('nl-pin-input button:has-text("1")').click();
    await page.locator('nl-pin-input button:has-text("2")').click();
    await page.locator('nl-pin-input button:has-text("3")').click();
    await page.locator('nl-pin-input button:has-text("4")').click();

    await page.waitForURL((url) => !url.pathname.includes('/unlock'), { timeout: 5000 });
  });

  test('unlock refuse un PIN incorrect', async ({ page }) => {
    await prepare(page, true);
    await page.goto('/app/unlock');
    await page.waitForSelector('nl-pin-input button', { timeout: 5000 });

    await page.locator('nl-pin-input button:has-text("9")').click();
    await page.locator('nl-pin-input button:has-text("8")').click();
    await page.locator('nl-pin-input button:has-text("7")').click();
    await page.locator('nl-pin-input button:has-text("6")').click();

    await expect(page.locator('body')).toContainText('PIN incorrect', { timeout: 5000 });
  });
});
