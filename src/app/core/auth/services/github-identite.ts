import { Injectable, inject, signal } from '@angular/core';
import { AuthRepository, ConfigGithub } from '../repositories/auth-repository';
import { Failure } from '../../models/failure.model';

const CLE_STATE = 'nl_github_oauth_state';
const CLE_VERIFIER = 'nl_github_pkce_verifier';
const CLE_REDIRECT_URI = 'nl_github_redirect_uri';

/** Encode un tampon binaire en Base64URL sans remplissage (`=`). */
export function versBase64Url(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i++) {
    binaire += String.fromCharCode(octets[i]);
  }
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Génère un paramètre `state` aléatoire d'au moins 16 octets (24 octets -> 32 car. base64url). */
export function genererEtatOAuth(): string {
  const octets = new Uint8Array(24);
  crypto.getRandomValues(octets);
  return versBase64Url(octets);
}

/** Génère un `code_verifier` PKCE conforme RFC 7636 (43 à 128 caractères). */
export function genererPkceVerifier(): string {
  const octets = new Uint8Array(48);
  crypto.getRandomValues(octets);
  return versBase64Url(octets);
}

/** Calcule le `code_challenge` PKCE (`S256`) à partir du `code_verifier`. */
export async function calculerPkceChallengeS256(verifier: string): Promise<string> {
  const donnees = new TextEncoder().encode(verifier);
  const condensat = await crypto.subtle.digest('SHA-256', donnees);
  return versBase64Url(new Uint8Array(condensat));
}

export interface RetourOAuthGithub {
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier?: string;
}

/**
 * « Continuer avec GitHub » - Chantier P4.
 *
 * - Interroge `GET /api/auth/github/config` : n'active le bouton que si `enabled: true`.
 * - Flux par redirection pleine page avec `state` aléatoire (>= 16 octets) et PKCE `S256`
 *   conservés uniquement dans `sessionStorage` (jamais `localStorage`).
 * - Au retour sur `/auth/github/callback`, nettoie immédiatement l'URL (`history.replaceState`),
 *   efface `sessionStorage`, et refuse tout retour dont le `state` est absent ou falsifié.
 */
@Injectable({ providedIn: 'root' })
export class GithubIdentite {
  private readonly repo = inject(AuthRepository);

  /** `true` quand GitHub est configuré et actif côté serveur. */
  readonly disponible = signal(false);

  /** `true` quand le serveur a répondu `enabled: false` (ou 503 `GITHUB_NON_CONFIGURE`). */
  readonly desactive = signal(false);

  private config: ConfigGithub | null = null;
  private chargement: Promise<boolean> | null = null;

  async preparer(): Promise<boolean> {
    if (this.disponible()) return true;
    if (this.desactive()) return false;
    const enCours = (this.chargement ??= this.demarrer());
    try {
      return await enCours;
    } finally {
      if (this.chargement === enCours) this.chargement = null;
    }
  }

  /** Masque le bouton GitHub si le serveur répond 503 `GITHUB_NON_CONFIGURE`. */
  masquerSiNonConfigure(): void {
    this.disponible.set(false);
    this.desactive.set(true);
  }

  private async demarrer(): Promise<boolean> {
    const cfg = await this.repo.configGithub();
    if (cfg.injoignable) return false;
    if (!cfg.enabled || !cfg.clientId) {
      this.desactive.set(true);
      this.disponible.set(false);
      return false;
    }
    this.config = cfg;
    this.disponible.set(true);
    return true;
  }

  /** URL de retour OAuth GitHub sur l'origine courante. */
  redirectUriParDefaut(): string {
    const origine = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origine}/auth/github/callback`;
  }

  /**
   * Prépare la redirection OAuth GitHub (génère et stocke `state` + `code_verifier`
   * dans `sessionStorage`) et retourne l'URL complète d'autorisation.
   */
  async construireUrlRedirection(redirectUri = this.redirectUriParDefaut()): Promise<string> {
    if (!this.config && !(await this.preparer())) {
      throw new Failure(
        'La connexion GitHub n’est pas configurée sur ce serveur.',
        503,
        'GITHUB_NON_CONFIGURE',
      );
    }
    const cfg = this.config!;
    const state = genererEtatOAuth();
    const verifier = genererPkceVerifier();
    const challenge = await calculerPkceChallengeS256(verifier);

    this.ecrireSession(CLE_STATE, state);
    this.ecrireSession(CLE_VERIFIER, verifier);
    this.ecrireSession(CLE_REDIRECT_URI, redirectUri);

    const url = new URL(cfg.authorizeUrl || 'https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', cfg.clientId!);
    url.searchParams.set('scope', cfg.scope || 'read:user user:email');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  /** Lance la redirection pleine page vers GitHub. */
  async redirigerVersGithub(): Promise<void> {
    const url = await this.construireUrlRedirection();
    if (typeof window !== 'undefined') {
      window.location.assign(url);
    }
  }

  /**
   * Vérifie les paramètres de retour `/auth/github/callback`, nettoie immédiatement
   * l'URL du navigateur (`history.replaceState`) et purge `sessionStorage`.
   */
  verifierRetour(params: {
    code?: string | null;
    state?: string | null;
    error?: string | null;
  }): RetourOAuthGithub {
    this.nettoyerUrlNavigateur();

    const stateAttendu = this.lireSession(CLE_STATE);
    const codeVerifier = this.lireSession(CLE_VERIFIER) ?? undefined;
    const redirectUri = this.lireSession(CLE_REDIRECT_URI) ?? this.redirectUriParDefaut();

    this.effacerSession(CLE_STATE);
    this.effacerSession(CLE_VERIFIER);
    this.effacerSession(CLE_REDIRECT_URI);

    if (params.error) {
      throw new Failure('Connexion GitHub annulée ou refusée.', 401, 'UNAUTHORIZED');
    }

    const stateRecu = params.state?.trim() ?? '';
    if (!stateAttendu || !stateRecu || stateRecu !== stateAttendu) {
      throw new Failure(
        'La vérification de sécurité GitHub a échoué (state invalide). Recommence la connexion.',
        401,
        'UNAUTHORIZED',
      );
    }

    const code = params.code?.trim() ?? '';
    if (!code) {
      throw new Failure(
        'Code GitHub invalide ou expiré. Recommence la connexion.',
        401,
        'UNAUTHORIZED',
      );
    }

    return { code, redirectUri, codeVerifier };
  }

  /** Retire `code` et `state` de la barre d'adresse et de l'historique du navigateur. */
  nettoyerUrlNavigateur(): void {
    try {
      if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
        const propre = window.location.pathname || '/auth/github/callback';
        window.history.replaceState({}, document.title || 'NextLearn', propre);
      }
    } catch {
      // Environnement sans History API
    }
  }

  private lireSession(cle: string): string | null {
    try {
      return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(cle) : null;
    } catch {
      return null;
    }
  }

  private ecrireSession(cle: string, valeur: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(cle, valeur);
      }
    } catch {
      // Navigation privée stricte
    }
  }

  private effacerSession(cle: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(cle);
      }
    } catch {
      // Ignoré
    }
  }
}
