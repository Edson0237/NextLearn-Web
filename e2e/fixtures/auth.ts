import { Page } from '@playwright/test';

/**
 * Empreinte SHA-256 de "1234_nextlearn_salt" en hexadécimal.
 * Utilisée pour simuler un PIN local correct dans les tests E2E.
 */
export const PIN_HASH_1234 =
  '20d2eacba9e3b038c579e4f42c764e93b0c408b6d0eaaca140f31e7d672b7f5c';

export interface SeededUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  universite: string;
  filiere: string;
  niveau: 'n1' | 'n2' | 'n3' | 'n4' | 'n5';
  langue: 'fr' | 'en';
}

export async function seedSession(
  page: Page,
  user: SeededUser,
  options: { locked?: boolean; pinHash?: string } = {}
): Promise<void> {
  // Le verrou local ne se referme plus de lui-même : posséder un PIN ne
  // suffit plus, il faut l'avoir demandé dans les réglages. Une session
  // « verrouillée » doit donc semer la préférence en plus de l'empreinte.
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const lastOtp = new Date().toISOString();

  await page.evaluate(
    ([u, exp, otp, locked, pinHash]) => {
      localStorage.setItem('nl_jwt_token', 'fake-access-token');
      localStorage.setItem('nl_jwt_expiry', exp);
      localStorage.setItem('nl_refresh_token', 'fake-refresh-token');
      localStorage.setItem('nl_user_data', JSON.stringify(u));
      localStorage.setItem('nl_first_launch', 'false');
      localStorage.setItem('nl_last_otp_verified_at', otp);
      localStorage.setItem('nl_pin_failed_attempts', '0');
      localStorage.removeItem('nl_pin_locked_until');
      if (pinHash) {
        localStorage.setItem('nl_pin_hash', pinHash);
      } else {
        localStorage.removeItem('nl_pin_hash');
      }
      if (locked) {
        localStorage.setItem('nl_verrouillage_app', '1');
      } else {
        localStorage.removeItem('nl_verrouillage_app');
      }
      localStorage.setItem('nl_otp_parcours', '');
      localStorage.setItem('nl_otp_parcours_echeance', '');
    },
    [user, expiry, lastOtp, options.locked ?? false, options.pinHash] as const
  );
}

export async function clearSession(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Fait répondre l'API au lieu de la laisser pendre.
 *
 * Le serveur de développement relaie `/api` vers le backend de recette
 * (`proxy.conf.json`). Quand celui-ci est injoignable - machine hors ligne,
 * tunnel fermé, backend arrêté - la requête ne tombe jamais en erreur :
 * elle reste en suspens. La restauration de session l'attend, la garde de
 * routage attend la restauration, et l'application ne peint rien du tout.
 *
 * Les tests échouaient alors sur un écran vide, en accusant l'écran testé.
 * Cinq d'entre eux - les trois de déverrouillage et les deux du lecteur -
 * sont les seuls à ouvrir une session, donc les seuls à appeler l'API au
 * démarrage, et les seuls à tomber.
 *
 * Une réponse vide suffit : aucun de ces tests ne porte sur le contenu
 * renvoyé par le serveur. Les routes que les tests simulent eux-mêmes sont
 * posées après et gardent la main.
 */
export async function stubApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const corps = url.includes('verification')
      ? { data: { statut: 'APPROVED' } }
      : { data: [], meta: { page: 1, totalPages: 1, total: 0 } };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(corps),
    });
  });
}
