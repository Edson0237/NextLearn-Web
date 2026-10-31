import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  // Le premier test ne doit pas payer la compilation de l'application : voir
  // `e2e/prechauffage.ts`.
  globalSetup: './e2e/prechauffage.ts',
  // Démarrage à froid : une compilation Vite complète dépasse largement les
  // 30 s par défaut.
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // L'application suit désormais la langue du navigateur. Sans cette
    // valeur, le navigateur de test (en-US) la fait basculer en anglais et
    // les assertions, écrites en français, échouent — sur une traduction qui
    // fonctionne, c'est-à-dire pour la mauvaise raison.
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx ng serve --host 0.0.0.0 --port 4200 --proxy-config proxy.conf.json',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
