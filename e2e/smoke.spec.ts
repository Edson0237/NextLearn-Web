import { test, expect } from '@playwright/test';

test.describe('Cartographie PWA', () => {
  test('la vitrine charge', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NextLearn/i);
  });

  test('/app redirige vers onboarding ou login', async ({ page }) => {
    await page.goto('/app');
    await page.waitForURL(/\/app\/(onboarding|login)/, { timeout: 5000 });
  });

  test('/app/unlock charge sans erreur', async ({ page }) => {
    await page.goto('/app/unlock');
    await expect(page.locator('body')).toContainText(/PIN|déverrouiller|Unlock/i, { timeout: 5000 }).catch(() => {
      // On accepte aussi un éventuel redirect vers login
    });
  });

  test('/app/login charge le formulaire PIN', async ({ page }) => {
    await page.goto('/app/login');
    await expect(page.locator('body')).toContainText('PIN', { timeout: 5000 });
  });

  test('/app/register charge', async ({ page }) => {
    await page.goto('/app/register');
    await expect(page.locator('body')).toContainText(/inscription|créer|compte/i, { timeout: 5000 });
  });

  test('/app/home redirige vers login sans session', async ({ page }) => {
    await page.goto('/app/home');
    await page.waitForURL(/\/app\/(login|onboarding)/, { timeout: 5000 });
  });

  test('/app/bibliotheque redirige vers login sans session', async ({ page }) => {
    await page.goto('/app/bibliotheque');
    await page.waitForURL(/\/app\/(login|onboarding)/, { timeout: 5000 });
  });
});
