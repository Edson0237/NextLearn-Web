// API publique de core/network : seulement ce que le reste de l'application consomme.

export { API_BASE_URL, AUTH_PATH, estCheminPreAuth } from './config/api-config';
export { authInterceptor, DELAIS_BACKOFF_5XX, estRequeteRejouable } from './interceptors/auth.interceptor';
export { ReseauService } from './services/reseau.service';
export { SessionExpiredService, normaliserMotifFinSession } from './services/session-expired.service';
export { donnees, donneesUtilisateur } from './utils/enveloppe-api';
export { enFailure } from './utils/erreur-api';
