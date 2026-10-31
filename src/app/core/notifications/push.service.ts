import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Configuration Firebase du client web, servie depuis `public/`.
 *
 * Elle n'est pas compilée dans le code : la même build doit pouvoir servir un
 * projet Firebase différent sans être reconstruite, et un fichier absent doit
 * rester un cas normal (voir ci-dessous).
 */
interface ConfigFirebase {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly messagingSenderId: string;
  readonly appId: string;
  /** Clé publique VAPID de la paire « Certificats push Web » du projet. */
  readonly vapidKey: string;
}

export type EtatPush =
  | 'indisponible'
  | 'non-configure'
  | 'refuse'
  | 'inactif'
  | 'actif';

/**
 * Notifications poussées.
 *
 * ## Le même principe que côté serveur
 *
 * L'API le dit dans son propre service d'envoi : « l'absence de configuration
 * n'est pas une panne ». C'est repris tel quel ici. Sans
 * `public/firebase-config.json` — ou avec un `appId`/`vapidKey` vide, ce qui
 * est l'état tant qu'une application **web** n'a pas été déclarée dans la
 * console Firebase — le service se dit `non-configure` et ne tente rien. Les
 * notifications restent consultables dans l'application : le push est un canal
 * de plus, jamais le seul.
 *
 * ## Ce qui n'était pas là
 *
 * Rien. Aucun `SwPush`, aucune demande de permission, aucun appel à
 * `/api/notifications/device-token` : l'interrupteur des réglages affichait
 * « bientôt disponible » et le serveur n'avait jamais d'appareil web à qui
 * parler.
 *
 * ## Le moment de la demande
 *
 * La permission n'est jamais réclamée au premier lancement : une autorisation
 * demandée avant qu'on ait vu à quoi elle sert est refusée la plupart du
 * temps, et le navigateur ne la redemande plus. Elle part donc d'un geste
 * explicite — l'interrupteur des réglages — exactement comme
 * `activerPourSessionOuverte` côté Flutter.
 *
 * ## iOS
 *
 * Safari n'accepte le push que depuis une PWA **installée**, à partir
 * d'iOS 16.4. En navigateur ordinaire, `Notification` existe mais
 * l'abonnement échoue : l'état rendu est alors `indisponible`, et l'interface
 * le dit plutôt que de laisser croire à une panne.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly http = inject(HttpClient);

  readonly etat = signal<EtatPush>('inactif');

  private config: ConfigFirebase | null = null;
  private configLue = false;
  private dernierJetonEnvoye: string | null = null;

  /** Le navigateur sait-il recevoir des notifications poussées ? */
  get supporte(): boolean {
    return (
      typeof Notification !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  /**
   * Demande la permission, obtient le jeton et l'enregistre.
   * Rend l'état atteint — c'est lui que l'interface montre.
   */
  async activer(): Promise<EtatPush> {
    if (!this.supporte) return this.poser('indisponible');

    const config = await this.lireConfig();
    if (!config) return this.poser('non-configure');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return this.poser('refuse');

      const { initializeApp, getApps } = await import('@firebase/app');
      const { getMessaging, getToken, onMessage } = await import('@firebase/messaging');

      const app = getApps()[0] ?? initializeApp(config);
      const messagerie = getMessaging(app);

      // Le service worker d'Angular ne sait pas traiter les messages Firebase :
      // le SDK en enregistre un second, dédié, qui ne sert qu'à ça.
      const enregistrement = await navigator.serviceWorker.register(
        '/firebase-messaging-sw.js',
        { scope: '/firebase-cloud-messaging-push-scope' },
      );

      const jeton = await getToken(messagerie, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration: enregistrement,
      });
      if (!jeton) return this.poser('indisponible');

      await this.transmettre(jeton);

      // Message reçu alors que l'application est au premier plan : le
      // navigateur n'affiche rien de lui-même dans ce cas.
      onMessage(messagerie, (charge) => {
        const titre = charge.notification?.title;
        if (!titre) return;
        try {
          new Notification(titre, {
            body: charge.notification?.body,
            icon: '/icons/icon-192x192.png',
          });
        } catch {
          // Certaines plateformes refusent la construction directe ; le
          // message reste consultable dans l'écran Notifications.
        }
      });

      return this.poser('actif');
    } catch {
      return this.poser('indisponible');
    }
  }

  /**
   * Coupe la réception sur cet appareil.
   *
   * Le jeton est retiré **côté serveur** : plus fort qu'ignorer les messages à
   * l'arrivée, puisque le serveur cesse d'en envoyer — ce qui épargne aussi la
   * batterie et les données. La permission système n'est pas révoquée : on ne
   * veut pas enfermer quelqu'un qui réactiverait plus tard.
   */
  async desactiver(): Promise<void> {
    const jeton = this.dernierJetonEnvoye;
    this.dernierJetonEnvoye = null;
    this.poser('inactif');
    if (!jeton) return;
    try {
      await firstValueFrom(
        this.http.delete('/api/notifications/device-token', { body: { token: jeton } }),
      );
    } catch {
      // Le serveur nettoiera de lui-même un jeton devenu muet.
    }
  }

  private async transmettre(jeton: string): Promise<void> {
    // Le jeton ne change pas à chaque ouverture : le renvoyer à l'identique
    // serait un appel réseau pour rien.
    if (jeton === this.dernierJetonEnvoye) return;
    await firstValueFrom(
      this.http.post('/api/notifications/device-token', { token: jeton, platform: 'web' }),
    );
    this.dernierJetonEnvoye = jeton;
  }

  private poser(etat: EtatPush): EtatPush {
    this.etat.set(etat);
    return etat;
  }

  private async lireConfig(): Promise<ConfigFirebase | null> {
    if (this.configLue) return this.config;
    this.configLue = true;
    try {
      const config = await firstValueFrom(
        this.http.get<ConfigFirebase>('/firebase-config.json'),
      );
      // `appId` et `vapidKey` sont les deux valeurs qu'on ne peut obtenir
      // qu'en déclarant une application **web** dans la console Firebase :
      // tant qu'elles manquent, la configuration est un gabarit, pas une
      // configuration.
      this.config = config?.appId && config?.vapidKey ? config : null;
    } catch {
      this.config = null;
    }
    return this.config;
  }
}
