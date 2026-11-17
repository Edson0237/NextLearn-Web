import { Injectable, inject, signal } from '@angular/core';
import { AuthRepository } from '../repositories/auth-repository';

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
 * « Se connecter avec Google » - côté navigateur.
 *
 * Ce service est directement appelé par les pages concernées (`LoginPin` et
 * `Register`) dès leur ouverture pour précharger en parallèle la configuration
 * serveur (`/api/auth/google/config`) et le script Google Identity Services
 * (`accounts.google.com/gsi/client`), sans pénaliser les pages publiques.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentite {
  private readonly repo = inject(AuthRepository);

  /** `true` quand Google est configuré côté serveur ET que son script est chargé. */
  readonly disponible = signal(false);

  /** Le serveur a répondu que Google n'est pas configuré : inutile de réessayer. */
  readonly desactive = signal(false);

  private chargement: Promise<boolean> | null = null;
  private reaction: ((jeton: string) => void) | null = null;

  /**
   * Prépare Google ; rend `true` s'il est utilisable. Plusieurs appels simultanés, un seul chargement.
   */
  async preparer(): Promise<boolean> {
    if (this.disponible()) return true;
    if (this.desactive()) return false;
    const en_cours = (this.chargement ??= this.demarrer());
    try {
      return await en_cours;
    } finally {
      if (this.chargement === en_cours) this.chargement = null;
    }
  }

  /** Dessine le bouton Google dans `hote`, et dirige le jeton obtenu vers `surJeton`. */
  afficherBouton(
    hote: HTMLElement,
    surJeton: (jeton: string) => void,
    options: { texte: string; largeur?: number },
  ): void {
    const gid = window.google?.accounts?.id;
    if (!gid) return;
    this.reaction = surJeton;
    const largeur = Math.min(Math.max(hote.clientWidth || options.largeur || 320, 220), 400);
    hote.replaceChildren();
    gid.renderButton(hote, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: options.texte,
      logo_alignment: 'left',
      width: largeur,
      locale: document.documentElement.lang || 'fr',
    });
  }

  private async demarrer(): Promise<boolean> {
    // Injection parallèle immédiate du script GIS pendant l'appel /config pour
    // éviter l'attente séquentielle réseau -> script -> initialisation.
    const scriptEnCours = this.injecterScript();
    const config = await this.repo.configGoogle();
    if (config.injoignable) return false;
    if (!config.enabled || !config.clientId) {
      this.desactive.set(true);
      return false;
    }
    if (!(await this.attendreScript(scriptEnCours))) return false;
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

  /** Ajoute le script de Google à la page, une seule fois - et pas du tout s'il est déjà là. */
  private injecterScript(): HTMLScriptElement | null {
    if (typeof document === 'undefined') return null;
    if (window.google?.accounts?.id) return null;
    const src = 'https://accounts.google.com/gsi/client';
    const existant = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existant) return existant;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return script;
  }

  /** Le script est `async` : écoute directe de `load` + vérification rapide. */
  private attendreScript(script: HTMLScriptElement | null): Promise<boolean> {
    if (window.google?.accounts?.id) return Promise.resolve(true);
    const cible = script ?? this.injecterScript();
    return new Promise((ok) => {
      let resolu = false;
      const finir = (etat: boolean): void => {
        if (resolu) return;
        resolu = true;
        clearTimeout(timerMax);
        clearInterval(intervalle);
        ok(etat);
      };

      cible?.addEventListener('load', () => {
        if (window.google?.accounts?.id) finir(true);
      }, { once: true });
      cible?.addEventListener('error', () => finir(false), { once: true });

      const intervalle = setInterval(() => {
        if (window.google?.accounts?.id) finir(true);
      }, 40);
      const timerMax = setTimeout(() => finir(false), 20_000);
    });
  }
}
