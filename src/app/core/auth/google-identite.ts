import { Injectable, inject, signal } from '@angular/core';
import { AuthRepository } from './auth-repository';

/** Ce que nous utilisons de Google Identity Services (le script `accounts.google.com/gsi/client`). */
interface GoogleId {
  initialize(config: Record<string, unknown>): void;
  renderButton(hote: HTMLElement, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

/**
 * « Se connecter avec Google » — côté navigateur.
 *
 * Le script de Google n'est chargé qu'à la demande — quand un écran qui propose
 * Google (connexion, inscription) l'utilise — et non par `index.html` : la page
 * publique et les pages légales n'ont pas à envoyer l'adresse IP du visiteur à
 * Google. Ce service l'injecte, attend qu'il soit là, puis initialise le client **une seule fois** : l'appel
 * à `initialize` remplace le précédent, et plusieurs boutons sur des écrans
 * différents partageraient sinon le rappel du dernier monté. Le rappel est donc
 * un aiguilleur, et chaque bouton y inscrit sa propre réaction.
 *
 * L'identifiant client n'est écrit nulle part dans l'application : il est
 * demandé au serveur (`GET /api/auth/google/config`, qui le lit dans
 * `GOOGLE_CLIENT_ID`). Une seule variable, un seul endroit à changer.
 *
 * Rien n'est affiché tant que ce n'est pas utilisable — serveur non configuré,
 * hors ligne, script bloqué : l'étudiant garde le parcours par code.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentite {
  private readonly repo = inject(AuthRepository);

  /** `true` quand Google est configuré côté serveur ET que son script est chargé. */
  readonly disponible = signal(false);

  private chargement: Promise<boolean> | null = null;
  private reaction: ((jeton: string) => void) | null = null;

  /** Prépare Google ; rend `true` s'il est utilisable. Plusieurs appels, un seul chargement. */
  preparer(): Promise<boolean> {
    return (this.chargement ??= this.demarrer());
  }

  /** Dessine le bouton Google dans `hote`, et dirige le jeton obtenu vers `surJeton`. */
  afficherBouton(hote: HTMLElement, surJeton: (jeton: string) => void, options: { texte: string; largeur?: number }): void {
    const gid = window.google?.accounts?.id;
    if (!gid) return;
    this.reaction = surJeton;
    hote.replaceChildren();
    gid.renderButton(hote, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: options.texte,
      logo_alignment: 'left',
      width: options.largeur ?? 320,
      locale: document.documentElement.lang || 'fr',
    });
  }

  private async demarrer(): Promise<boolean> {
    const config = await this.repo.configGoogle();
    if (!config.enabled || !config.clientId) return false;
    if (!(await this.attendreScript())) return false;
    window.google!.accounts!.id!.initialize({
      client_id: config.clientId,
      callback: (reponse: { credential?: string }) => {
        if (reponse.credential) this.reaction?.(reponse.credential);
      },
      // Jamais de connexion silencieuse : on ne choisit pas un compte à la place de la personne.
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    this.disponible.set(true);
    return true;
  }

  /** Ajoute le script de Google à la page, une seule fois — et pas du tout s'il est déjà là. */
  private injecterScript(): void {
    if (window.google?.accounts?.id) return;
    const src = 'https://accounts.google.com/gsi/client';
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  /** Le script est `async` : il peut arriver après nous. On attend, mais pas indéfiniment. */
  private attendreScript(): Promise<boolean> {
    this.injecterScript();
    return new Promise((ok) => {
      const debut = Date.now();
      const sonder = (): void => {
        if (window.google?.accounts?.id) return ok(true);
        if (Date.now() - debut > 10_000) return ok(false);
        setTimeout(sonder, 150);
      };
      sonder();
    });
  }
}
