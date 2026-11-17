import { HttpErrorResponse } from '@angular/common/http';
import { estCheminPreAuth } from '../network/config/api-config';

/**
 * Erreur unifiée exposée par les services au reste de l'application -
 * traduction de `lib/core/network/failure.dart`.
 *
 * **Sécurité** : `message` ne contient jamais le texte brut renvoyé par le
 * backend, sauf sur les deux exceptions documentées plus bas. Les détails
 * complets (message serveur, code HTTP, endpoint) ne sortent que via
 * `console.error`, et seulement hors production.
 */
export class Failure extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
    readonly fields?: Readonly<Record<string, string>>,
  ) {
    super(message);
  }

  get estErreurReseau(): boolean {
    return this.statusCode === undefined;
  }

  get estNonAutorise(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Le compte existe mais son dossier n'est pas approuvé. Reconnu par le
   * code du serveur, pas par le statut : un 403 ordinaire veut dire « cette
   * ressource n'est pas pour toi », celui-ci veut dire « reviens quand ton
   * dossier sera validé » - deux écrans différents.
   */
  get compteNonValide(): boolean {
    return this.code === 'ACCOUNT_NOT_VALIDATED';
  }

  static depuisErreurHttp(e: HttpErrorResponse, estProd: boolean): Failure {
    logDebug(e, estProd);

    if (e.status === 0) {
      // Pas de réponse du tout : coupure réseau, CORS, timeout - HttpClient
      // ne distingue pas ces cas, à la différence de Dio côté Flutter.
      return new Failure('Le serveur met du temps à répondre. Réessayez.');
    }
    return depuisReponse(e);
  }
}

function logDebug(e: HttpErrorResponse, estProd: boolean): void {
  const data = e.error as unknown;
  let backendMessage: string | undefined;
  let backendCode: string | undefined;
  let requestId: string | undefined =
    e.headers?.get('X-Request-ID') ?? e.headers?.get('x-request-id') ?? undefined;
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>)['error'];
    if (err && typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      backendMessage = errObj['message'] as string | undefined;
      backendCode = errObj['code'] as string | undefined;
      if (typeof errObj['requestId'] === 'string') {
        requestId = errObj['requestId'];
      }
    } else if (typeof (data as Record<string, unknown>)['message'] === 'string') {
      backendMessage = (data as Record<string, unknown>)['message'] as string;
    }
  }
  // Ne jamais journaliser de paramètres d'URL (recherche `q`, e-mail, OAuth state/code — §19.5)
  const endpointSansRequete = (e.url ?? '').split('?')[0];

  if (backendCode === 'INVALID_JSON') {
    // §18.3 : traiter comme un bug frontend, journaliser sans donnée sensible
    // eslint-disable-next-line no-console
    console.warn('[Failure] INVALID_JSON', {
      endpoint: endpointSansRequete,
      status: e.status,
      requestId,
    });
  }

  if (estProd) return;
  // eslint-disable-next-line no-console
  console.error(
    `════════ [Failure] Erreur API ════════\n` +
      `  Endpoint   : ${endpointSansRequete}\n` +
      `  Statut     : ${e.status}\n` +
      `  Code       : ${backendCode}\n` +
      `  Msg serveur: ${backendMessage}\n` +
      `══════════════════════════════════════`,
  );
}

function depuisReponse(e: HttpErrorResponse): Failure {
  const data = e.error as unknown;
  let backendCode: string | undefined;
  let backendMessage: string | undefined;
  let retryAfterSeconds: number | undefined;

  // Extraction de Retry-After depuis les en-têtes HTTP ou le corps JSON
  const rawHeader = e.headers?.get('Retry-After');
  if (rawHeader) {
    const parsed = Number(rawHeader);
    if (!Number.isNaN(parsed) && parsed > 0) retryAfterSeconds = parsed;
  }

  let backendDetails: Record<string, unknown> | undefined;
  let requestId: string | undefined;
  let fields: Record<string, string> | undefined;

  const headerReqId = e.headers?.get('X-Request-ID') ?? e.headers?.get('x-request-id');
  if (headerReqId && headerReqId.trim().length > 0) {
    requestId = headerReqId.trim();
  }

  if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj['requestId'] === 'string' && dataObj['requestId'].trim().length > 0) {
      requestId = dataObj['requestId'].trim();
    }
    const err = dataObj['error'];
    if (err && typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      backendCode = errObj['code'] as string | undefined;
      backendMessage = errObj['message'] as string | undefined;
      if (typeof errObj['requestId'] === 'string' && errObj['requestId'].trim().length > 0) {
        requestId = errObj['requestId'].trim();
      }
      const details = errObj['details'] as Record<string, unknown> | undefined;
      if (details && typeof details === 'object') {
        // Ne jamais lire details.issues (absent en production — §18.2).
        const { issues: _issues, ...detailsSansIssues } = details;
        backendDetails = detailsSansIssues;
        if (typeof details['retryAfter'] === 'number') {
          retryAfterSeconds = details['retryAfter'];
        }
        const rawFields = details['fields'];
        if (rawFields && typeof rawFields === 'object' && !Array.isArray(rawFields)) {
          const table: Record<string, string> = {};
          for (const [cle, val] of Object.entries(rawFields as Record<string, unknown>)) {
            if (typeof val === 'string' && val.trim().length > 0) {
              table[cle] = val.trim();
            }
          }
          if (Object.keys(table).length > 0) {
            fields = table;
          }
        }
      }
    }
  }
  return new Failure(
    messagePour(e.url ?? '', e.status, backendMessage, backendCode, fields),
    e.status,
    backendCode,
    retryAfterSeconds,
    backendDetails,
    requestId,
    fields,
  );
}

function messagePour(
  chemin: string,
  statusCode: number,
  duServeur: string | undefined,
  code: string | undefined,
  fields?: Readonly<Record<string, string>>,
): string {
  // Codes d'erreur Lot 4 (P12 & P13 — §18.3)
  if (code === 'FILE_TOO_LARGE') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return 'Le fichier dépasse la taille maximale autorisée.';
  }
  if (code === 'UPLOAD_INVALID') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return 'L’envoi du fichier est invalide.';
  }
  if (code === 'PAYLOAD_TOO_LARGE') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return 'Le corps de la requête est trop volumineux.';
  }
  if (code === 'INVALID_JSON') {
    return 'Cette requête est invalide.';
  }
  if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return 'Votre session a expiré. Reconnectez-vous.';
  }
  if (code === 'VALIDATION_ERROR' || code === 'DUPLICATE_ENTRY') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    if (fields) {
      const premier = Object.values(fields).find(Boolean);
      if (premier) return premier;
    }
    return 'Certaines données ne sont pas valides.';
  }
  if (statusCode >= 500 && code !== 'GITHUB_INDISPONIBLE' && code !== 'GITHUB_NON_CONFIGURE') {
    return 'Une erreur est survenue de notre côté. Réessaie dans un instant.';
  }
  // Le refus « compte non validé » parle de lui-même, et c'est l'un des
  // rares messages serveur qu'on laisse passer : il précise ce qu'il faut
  // faire (déposer, compléter, attendre) et ne révèle rien d'une ressource
  // protégée.
  // Les refus de la connexion Google / GitHub disent eux aussi ce qu'il faut faire
  // (utiliser son adresse d'établissement, contacter un administrateur) et ne
  // révèlent rien de protégé.
  if (
    code === 'domain_not_allowed' ||
    code === 'account_banned' ||
    code === 'use_google_auth' ||
    code === 'consent_required' ||
    code === 'PIN_TEMPORARILY_LOCKED' ||
    code === 'RATE_LIMIT_EXCEEDED' ||
    code === 'GITHUB_INDISPONIBLE' ||
    code === 'GITHUB_NON_CONFIGURE' ||
    code === 'FORBIDDEN' ||
    code?.startsWith('EMAIL_CHANGE_')
  ) {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
  }

  if (code === 'ACCOUNT_NOT_VALIDATED') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return "Votre compte n'est pas encore validé.";
  }

  if (code === 'DOCUMENT_UNAVAILABLE') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return 'Document non disponible / à réuploader';
  }

  // Les messages explicites du serveur sur la vérification, les dépôts, le catalogue v2,
  // le profil d'étude ou en cas de conflit/validation doivent être visibles par l'utilisateur.
  if (duServeur && duServeur.trim().length > 0 && duServeur.trim().length <= 240) {
    if (
      chemin.includes('/verification') ||
      chemin.includes('/submissions') ||
      chemin.includes('/v2/catalogue') ||
      chemin.includes('/v2/me/profil-etude') ||
      chemin.includes('/auth/github') ||
      code === 'CONFLICT' ||
      code === 'VALIDATION_ERROR' ||
      code === 'TOO_MANY_REQUESTS' ||
      statusCode === 400 ||
      statusCode === 409 ||
      statusCode === 429
    ) {
      return duServeur.trim();
    }
  }

  if (!estCheminPreAuth(chemin)) return messageParDefaut(statusCode);
  if (statusCode !== 401 && statusCode !== 422) return messageParDefaut(statusCode);

  // Sur les routes d'authentification préalables (code OTP, PIN, mot de
  // passe oublié, GitHub), un 401 dit « ce code est faux », pas « ta session a
  // expiré ». Le message du serveur est ici la seule information utile :
  // il précise combien de tentatives restent.
  const message = duServeur?.trim();
  if (!message || message.length === 0 || message.length > 240) {
    return 'Ce code a expiré ou est invalide. Demandez-en un nouveau.';
  }
  return message;
}

function messageParDefaut(statusCode: number): string {
  switch (statusCode) {
    case 400: return 'Cette requête est invalide.';
    case 401: return 'Votre session a expiré. Reconnectez-vous.';
    case 403: return "Vous n'avez pas accès à cette ressource.";
    case 404: return "Cette ressource n'existe pas.";
    case 409: return 'Cette donnée existe déjà.';
    case 422: return 'Cette donnée est invalide.';
    case 429: return 'Trop de requêtes. Réessayez dans un instant.';
    case 500:
    case 502:
    case 503:
      return 'Un problème est survenu de notre côté. Réessaie.';
    default: return 'Une erreur est survenue.';
  }
}
