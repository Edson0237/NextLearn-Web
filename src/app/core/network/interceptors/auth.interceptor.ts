import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { catchError, from, retry, switchMap, throwError, timeout, timer } from 'rxjs';
import { estCheminSansJeton, estCheminPreAuth, AUTH_PATH, DELAI_EXPIRATION_MS } from '../config/api-config';
import { SecureStorageService } from '../../storage/services/secure-storage.service';
import { SessionExpiredService } from '../services/session-expired.service';

/**
 * Délais de réessai exponentiel après erreur serveur 5xx (§9.5 — P14 :
 * backoff 1 s, 2 s, 4 s, 8 s, au plus 4 réessais sur requêtes idempotentes).
 */
export const DELAIS_BACKOFF_5XX = new InjectionToken<readonly number[]>('DELAIS_BACKOFF_5XX', {
  providedIn: 'root',
  factory: () => [1000, 2000, 4000, 8000],
});

/** Seules les lectures idempotentes sans FormData peuvent être rejouées automatiquement (§9.5). */
export function estRequeteRejouable(req: HttpRequest<unknown>): boolean {
  const m = req.method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') return false;
  if (req.body instanceof FormData) return false;
  if (req.url.includes('/auth/refresh')) return false;
  return true;
}

/**
 * Injection du jeton, rafraîchissement silencieux + nouvel essai sur 401 -
 * traduction du `InterceptorsWrapper` de `DioClient`
 * (`lib/core/network/dio_client.dart`).
 *
 * **Pas d'en-têtes décrivant l'appareil.** Flutter lui-même ne les envoie
 * pas depuis le web (`device_headers.dart`, `if (web) return {}`) : un
 * en-tête non standard déclenche une vérification CORS préalable, et le
 * navigateur refuse la requête entière si le serveur ne l'a pas
 * explicitement autorisée. Ce n'est donc pas une omission du portage -
 * c'est la même décision, pour la même raison, déjà prise côté source.
 */

interface ResultatRafraichissement {
  readonly reussi: boolean;
  readonly motif?: string;
}

/** Rafraîchissement en cours, partagé entre requêtes concurrentes - pour
 * qu'un lot de 401 simultanés ne consomme pas chacun le refresh token
 * (le backend le fait tourner à chaque appel). */
let rafraichissementEnCours: Promise<ResultatRafraichissement> | null = null;

function extraireMessageErreurHttp(erreur: HttpErrorResponse): string | undefined {
  const data = erreur.error as unknown;
  if (!data || typeof data !== 'object') return undefined;
  const err = (data as Record<string, unknown>)['error'];
  if (err && typeof err === 'object' && typeof (err as Record<string, unknown>)['message'] === 'string') {
    return (err as Record<string, unknown>)['message'] as string;
  }
  if (typeof (data as Record<string, unknown>)['message'] === 'string') {
    return (data as Record<string, unknown>)['message'] as string;
  }
  return undefined;
}

function estMotifSessionExplicite(msg?: string): boolean {
  if (!msg) return false;
  return (
    msg.includes('Session fermée') ||
    msg.includes('expiré par inactivité') ||
    msg.includes('durée maximale') ||
    msg.includes('ancien jeton a été réutilisé')
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(SecureStorageService);
  const sessionExpired = inject(SessionExpiredService);
  const delais5xx = inject(DELAIS_BACKOFF_5XX);

  const requete = ajouterJeton(req, storage);

  return next(requete).pipe(
    // Même délai que `connectTimeout`/`receiveTimeout` de Dio
    // (`dio_client.dart`). `HttpClient` n'en a aucun par défaut : sur un
    // réseau lent - le cas d'usage visé - la requête restait pendante
    // indéfiniment et l'écran tournait sans fin, sans message ni issue.
    //
    // L'expiration est présentée comme une réponse de statut 0, celle que
    // `Failure` traduit déjà par « Le serveur met du temps à répondre » :
    // inutile d'inventer un second chemin d'erreur pour le même événement.
    timeout({
      each: DELAI_EXPIRATION_MS,
      with: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              statusText: 'Délai dépassé',
              url: req.url,
            }),
        ),
    }),
    retry({
      count: delais5xx.length,
      delay: (erreur, tentative) => {
        // Hors ligne, ngsw ou le navigateur émet immédiatement 504/0 : réessayer 4 fois
        // ajouterait 15 s d'attente inutile avant d'afficher le contenu local.
        const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (
          horsLigne ||
          !(erreur instanceof HttpErrorResponse) ||
          erreur.status < 500 ||
          erreur.status >= 600 ||
          !estRequeteRejouable(requete)
        ) {
          return throwError(() => erreur);
        }
        const attente = delais5xx[tentative - 1] ?? delais5xx[delais5xx.length - 1] ?? 1000;
        return timer(attente);
      },
    }),
    catchError((erreur: unknown) => {
      if (!(erreur instanceof HttpErrorResponse)) return throwError(() => erreur);

      const reqIdEnvoye = requete.headers.get('X-Request-ID');
      const erreurAvecReqId =
        reqIdEnvoye && !erreur.headers?.has('X-Request-ID') && !erreur.headers?.has('x-request-id')
          ? new HttpErrorResponse({
              error: erreur.error,
              headers: erreur.headers.set('X-Request-ID', reqIdEnvoye),
              status: erreur.status,
              statusText: erreur.statusText,
              url: erreur.url ?? req.url,
            })
          : erreur;

      const preAuth = estCheminPreAuth(erreurAvecReqId.url ?? req.url);
      const dejaRetentee = requete.context.get(RETENTEE);
      const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false;

      if (horsLigne || erreurAvecReqId.status !== 401 || preAuth || dejaRetentee) {
        return throwError(() => erreurAvecReqId);
      }

      const motifInitial = extraireMessageErreurHttp(erreurAvecReqId);
      const avaitSession = Boolean(storage.getRefreshToken() || storage.getToken());

      return from(rafraichir(storage)).pipe(
        switchMap((resultat) => {
          if (!resultat.reussi) {
            // On ne déclare pas « session expirée » à quelqu'un qui n'en a
            // jamais ouvert : pendant la vérification en deux temps,
            // l'utilisateur n'est justement pas encore connecté, et une
            // requête authentifiée partie en arrière-plan répondrait 401
            // sans qu'il y ait de session à fermer.
            if (avaitSession) {
              const motifFinal = estMotifSessionExplicite(motifInitial)
                ? motifInitial
                : (resultat.motif ?? motifInitial);
              sessionExpired.notify(motifFinal);
            }
            return throwError(() => erreurAvecReqId);
          }

          const token = storage.getToken();
          const nouvelleRequete = req.clone({
            setHeaders: token ? { Authorization: `Bearer ${token}`, ...(reqIdEnvoye ? { 'X-Request-ID': reqIdEnvoye } : {}) } : {},
            context: req.context.set(RETENTEE, true),
          });
          return next(nouvelleRequete);
        }),
      );
    }),
  );
};

const REGEX_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

function genererRequestIdValide(existant: string | null): string {
  if (existant && REGEX_REQUEST_ID.test(existant)) {
    return existant;
  }
  const candidat =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return REGEX_REQUEST_ID.test(candidat) ? candidat : candidat.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64) || 'nl-req';
}

function ajouterJeton(
  req: HttpRequest<unknown>,
  storage: SecureStorageService,
): HttpRequest<unknown> {
  const reqId = genererRequestIdValide(req.headers.get('X-Request-ID'));

  const headers: Record<string, string> = {
    'X-Request-ID': reqId,
  };

  if (!estCheminSansJeton(req.url)) {
    const token = storage.getToken();
    const refreshToken = storage.getRefreshToken();
    // §19.1 : ne jamais envoyer un refresh token ou jeton temporaire dans Authorization
    if (token && token !== refreshToken) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return req.clone({ setHeaders: headers });
}

function rafraichir(storage: SecureStorageService): Promise<ResultatRafraichissement> {
  return (rafraichissementEnCours ??= doRafraichir(storage).finally(() => {
    rafraichissementEnCours = null;
  }));
}

// `fetch` et non `HttpClient` : cet appel vit *dans* l'intercepteur de
// `HttpClient`. L'utiliser ici le ferait traverser son propre intercepteur
// une seconde fois - sans en tirer rien, puisque `/auth/refresh` n'attend
// pas de jeton - pour un simple risque de cycle de dépendances en plus.
async function doRafraichir(storage: SecureStorageService): Promise<ResultatRafraichissement> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) return { reussi: false };

  try {
    // URL relative, comme tous les autres appels de l'application.
    //
    // Elle pointait sur `API_BASE_URL`, c'est-à-dire directement sur l'hôte de
    // l'API : seule requête de toute la PWA à sortir de son origine. En
    // production, tout le reste passe par la réécriture `/api/:path*` de
    // Vercel et reste donc same-origin. Le rafraîchissement, lui, dépendait de
    // la liste blanche CORS du serveur (`CORS_ORIGINS`) : un domaine oublié et
    // c'est la seule requête qui échoue - donc toutes les sessions qui
    // expirent au bout d'un quart d'heure, sans que rien d'autre ne casse.
    const reponse = await fetch(`${AUTH_PATH}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!reponse.ok) {
      let motif: string | undefined;
      try {
        const errBrut = (await reponse.json()) as unknown;
        if (errBrut && typeof errBrut === 'object') {
          const errObj = (errBrut as Record<string, unknown>)['error'];
          if (errObj && typeof errObj === 'object' && typeof (errObj as Record<string, unknown>)['message'] === 'string') {
            motif = (errObj as Record<string, unknown>)['message'] as string;
          } else if (typeof (errBrut as Record<string, unknown>)['message'] === 'string') {
            motif = (errBrut as Record<string, unknown>)['message'] as string;
          }
        }
      } catch {
        // Corps non JSON : on garde le motif par défaut.
      }
      return { reussi: false, motif };
    }

    const brut = (await reponse.json()) as unknown;
    const payload =
      brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
    const data =
      payload['data'] && typeof payload['data'] === 'object'
        ? (payload['data'] as Record<string, unknown>)
        : payload;

    const nouveauJeton = data['accessToken'];
    if (typeof nouveauJeton !== 'string' || nouveauJeton.length === 0) return { reussi: false };

    // Le backend révoque le refresh token consommé et en émet un nouveau :
    // ne pas le persister condamnerait le rafraîchissement suivant.
    const nouveauRefresh = data['refreshToken'];
    if (typeof nouveauRefresh === 'string' && nouveauRefresh.length > 0) {
      storage.saveRefreshToken(nouveauRefresh);
    }

    const expiresIn = typeof data['expiresIn'] === 'number' ? data['expiresIn'] : 900;
    storage.saveToken(nouveauJeton, new Date(Date.now() + expiresIn * 1000));
    return { reussi: true };
  } catch {
    return { reussi: false };
  }
}

// Marque une requête déjà rejouée une fois, pour ne pas boucler
// indéfiniment si le serveur continue de répondre 401 après rafraîchissement.
const RETENTEE = new HttpContextToken<boolean>(() => false);
