/**
 * Configuration de l'API — traduction de `lib/core/network/api_config.dart`.
 *
 * Même instance hébergée par défaut. Pour développer contre un backend
 * local, surcharger au build plutôt que modifier ce fichier :
 *
 *   NEXTLEARN_API_URL=http://localhost:5000 npm start
 *
 * (à câbler via les `environment.ts` d'Angular si un jour plusieurs
 * environnements de build coexistent — aucun autre que la production
 * n'existe encore dans ce projet).
 */
export const API_BASE_URL = 'https://api-nextlearn.duckdns.org';
export const AUTH_PATH = '/api/auth';

/**
 * Points d'entrée qui portent leur jeton dans le corps de la requête, et
 * n'attendent donc aucun en-tête `Authorization` — traduction de
 * `_cheminsSansJeton` (`dio_client.dart`).
 */
const CHEMINS_SANS_JETON: readonly string[] = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/verify-2fa',
  '/auth/setup-pin',
  '/auth/resend-otp',
  '/auth/reset-pin',
  '/auth/confirm-reset-pin',
  '/auth/refresh',
];

/**
 * Points d'entrée qui répondent 401 pour parler d'un identifiant *qu'on
 * vient de saisir* (code OTP faux, PIN erroné), pas d'une session à
 * rafraîchir. Déborde volontairement la liste au-dessus :
 * `change-pin` exige une session valide — donc l'en-tête — mais son 401
 * parle du PIN actuel qu'on vient de taper.
 */
const CHEMINS_401_IDENTIFIANT: readonly string[] = [...CHEMINS_SANS_JETON, '/auth/change-pin'];

export function estCheminSansJeton(chemin: string): boolean {
  return CHEMINS_SANS_JETON.some((c) => chemin.includes(c));
}

/**
 * Vrai si un 401 sur `chemin` parle d'un identifiant saisi, pas de la
 * session — voir `Failure.depuisErreurHttp`.
 */
export function estCheminPreAuth(chemin: string): boolean {
  return CHEMINS_401_IDENTIFIANT.some((c) => chemin.includes(c));
}
