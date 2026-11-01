// API publique de core/network : seulement ce que le reste de l'application consomme.

export { API_BASE_URL, AUTH_PATH, estCheminPreAuth } from './config/api-config';
export { authInterceptor } from './interceptors/auth.interceptor';
export { ReseauService } from './services/reseau.service';
export { SessionExpiredService } from './services/session-expired.service';
export { donnees, donneesUtilisateur } from './utils/enveloppe-api';
export { enFailure } from './utils/erreur-api';
