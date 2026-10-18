import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { estCheminSansJeton, estCheminPreAuth, API_BASE_URL, AUTH_PATH } from './api-config';
import { SecureStorageService } from '../storage/secure-storage.service';
import { SessionExpiredService } from './session-expired.service';

/**
 * Injection du jeton, rafraîchissement silencieux + nouvel essai sur 401 —
 * traduction du `InterceptorsWrapper` de `DioClient`
 * (`lib/core/network/dio_client.dart`).
 *
 * **Pas d'en-têtes décrivant l'appareil.** Flutter lui-même ne les envoie
 * pas depuis le web (`device_headers.dart`, `if (web) return {}`) : un
 * en-tête non standard déclenche une vérification CORS préalable, et le
 * navigateur refuse la requête entière si le serveur ne l'a pas
 * explicitement autorisée. Ce n'est donc pas une omission du portage —
 * c'est la même décision, pour la même raison, déjà prise côté source.
 */

/** Rafraîchissement en cours, partagé entre requêtes concurrentes — pour
 * qu'un lot de 401 simultanés ne consomme pas chacun le refresh token
 * (le backend le fait tourner à chaque appel). */
let rafraichissementEnCours: Promise<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(SecureStorageService);
  const sessionExpired = inject(SessionExpiredService);

  const requete = ajouterJeton(req, storage);

  return next(requete).pipe(
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse)) return throwError(() => erreur);

      const preAuth = estCheminPreAuth(erreur.url ?? req.url);
      const dejaRetentee = requete.context.get(RETENTEE);

      if (erreur.status !== 401 || preAuth || dejaRetentee) {
        return throwError(() => erreur);
      }

      return from(rafraichir(storage)).pipe(
        switchMap((reussi) => {
          if (!reussi) {
            // On ne déclare pas « session expirée » à quelqu'un qui n'en a
            // jamais ouvert : pendant la vérification en deux temps,
            // l'utilisateur n'est justement pas encore connecté, et une
            // requête authentifiée partie en arrière-plan répondrait 401
            // sans qu'il y ait de session à fermer.
            if (storage.getRefreshToken()) sessionExpired.notify();
            return throwError(() => erreur);
          }

          const token = storage.getToken();
          const nouvelleRequete = req.clone({
            setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            context: req.context.set(RETENTEE, true),
          });
          return next(nouvelleRequete);
        }),
      );
    }),
  );
};

function ajouterJeton(
  req: HttpRequest<unknown>,
  storage: SecureStorageService,
): HttpRequest<unknown> {
  if (estCheminSansJeton(req.url)) return req;
  const token = storage.getToken();
  if (!token) return req;
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function rafraichir(storage: SecureStorageService): Promise<boolean> {
  return (rafraichissementEnCours ??= doRafraichir(storage).finally(() => {
    rafraichissementEnCours = null;
  }));
}

// `fetch` et non `HttpClient` : cet appel vit *dans* l'intercepteur de
// `HttpClient`. L'utiliser ici le ferait traverser son propre intercepteur
// une seconde fois — sans en tirer rien, puisque `/auth/refresh` n'attend
// pas de jeton — pour un simple risque de cycle de dépendances en plus.
async function doRafraichir(storage: SecureStorageService): Promise<boolean> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const reponse = await fetch(`${API_BASE_URL}${AUTH_PATH}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!reponse.ok) return false;

    const brut = (await reponse.json()) as unknown;
    const payload =
      brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
    const data =
      payload['data'] && typeof payload['data'] === 'object'
        ? (payload['data'] as Record<string, unknown>)
        : payload;

    const nouveauJeton = data['accessToken'];
    if (typeof nouveauJeton !== 'string' || nouveauJeton.length === 0) return false;

    // Le backend révoque le refresh token consommé et en émet un nouveau :
    // ne pas le persister condamnerait le rafraîchissement suivant.
    const nouveauRefresh = data['refreshToken'];
    if (typeof nouveauRefresh === 'string' && nouveauRefresh.length > 0) {
      storage.saveRefreshToken(nouveauRefresh);
    }

    const expiresIn = typeof data['expiresIn'] === 'number' ? data['expiresIn'] : 900;
    storage.saveToken(nouveauJeton, new Date(Date.now() + expiresIn * 1000));
    return true;
  } catch {
    return false;
  }
}

// Marque une requête déjà rejouée une fois, pour ne pas boucler
// indéfiniment si le serveur continue de répondre 401 après rafraîchissement.
const RETENTEE = new HttpContextToken<boolean>(() => false);
