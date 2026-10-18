import { HttpErrorResponse } from '@angular/common/http';
import { estCheminPreAuth } from '../network/api-config';

/**
 * Erreur unifiée exposée par les services au reste de l'application —
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
   * dossier sera validé » — deux écrans différents.
   */
  get compteNonValide(): boolean {
    return this.code === 'ACCOUNT_NOT_VALIDATED';
  }

  static depuisErreurHttp(e: HttpErrorResponse, estProd: boolean): Failure {
    logDebug(e, estProd);

    if (e.status === 0) {
      // Pas de réponse du tout : coupure réseau, CORS, timeout — HttpClient
      // ne distingue pas ces cas, à la différence de Dio côté Flutter.
      return new Failure('Le serveur met du temps à répondre. Réessayez.');
    }
    return depuisReponse(e);
  }
}

function logDebug(e: HttpErrorResponse, estProd: boolean): void {
  if (estProd) return;
  const data = e.error as unknown;
  let backendMessage: string | undefined;
  let backendCode: string | undefined;
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>)['error'];
    if (err && typeof err === 'object') {
      backendMessage = (err as Record<string, unknown>)['message'] as string | undefined;
      backendCode = (err as Record<string, unknown>)['code'] as string | undefined;
    } else if (typeof (data as Record<string, unknown>)['message'] === 'string') {
      backendMessage = (data as Record<string, unknown>)['message'] as string;
    }
  }
  // eslint-disable-next-line no-console
  console.error(
    `════════ [Failure] Erreur API ════════\n` +
      `  Endpoint   : ${e.url}\n` +
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
  if (data && typeof data === 'object') {
    const err = (data as Record<string, unknown>)['error'];
    if (err && typeof err === 'object') {
      backendCode = (err as Record<string, unknown>)['code'] as string | undefined;
      backendMessage = (err as Record<string, unknown>)['message'] as string | undefined;
    }
  }
  return new Failure(
    messagePour(e.url ?? '', e.status, backendMessage, backendCode),
    e.status,
    backendCode,
  );
}

function messagePour(
  chemin: string,
  statusCode: number,
  duServeur: string | undefined,
  code: string | undefined,
): string {
  // Le refus « compte non validé » parle de lui-même, et c'est l'un des
  // rares messages serveur qu'on laisse passer : il précise ce qu'il faut
  // faire (déposer, compléter, attendre) et ne révèle rien d'une ressource
  // protégée.
  if (code === 'ACCOUNT_NOT_VALIDATED') {
    const message = duServeur?.trim();
    if (message && message.length > 0 && message.length <= 240) return message;
    return "Votre compte n'est pas encore validé.";
  }

  if (!estCheminPreAuth(chemin)) return messageParDefaut(statusCode);
  if (statusCode !== 401 && statusCode !== 422) return messageParDefaut(statusCode);

  // Sur les routes d'authentification préalables (code OTP, PIN, mot de
  // passe oublié), un 401 dit « ce code est faux », pas « ta session a
  // expiré ». Le message du serveur est ici la seule information utile :
  // il précise combien de tentatives restent.
  const message = duServeur?.trim();
  if (!message || message.length === 0 || message.length > 200) {
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
      return 'Le serveur a rencontré une erreur. Réessayez plus tard.';
    default: return 'Une erreur est survenue.';
  }
}
