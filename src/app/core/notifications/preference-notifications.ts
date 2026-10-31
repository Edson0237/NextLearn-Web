import { Injectable, inject, signal } from '@angular/core';
import { EtatPush, PushService } from './push.service';

const CLE = 'nl_notifications_actives';

/**
 * L'utilisateur veut-il recevoir les notifications ? — traduction de
 * `PreferenceNotificationsNotifier` (`preference_notifications.dart`).
 *
 * Le réglage existait dans l'écran de la PWA et affichait « bientôt
 * disponible » : un interrupteur qui ne commande rien. Côté Flutter, la
 * remarque était la même avant correction — « un réglage qui mentait ».
 *
 * Désactiver retire le jeton **côté serveur** plutôt que d'ignorer les
 * messages à l'arrivée : le serveur cesse d'envoyer, ce qui épargne la
 * batterie et les données.
 */
@Injectable({ providedIn: 'root' })
export class PreferenceNotifications {
  private readonly push = inject(PushService);

  /** Activées par défaut : une bibliothèque qui ne prévient pas des nouveaux
   *  documents perd l'essentiel de son intérêt. Le choix contraire est à un
   *  geste. */
  readonly actives = signal(this.lire());

  /** Dernier état du canal push, pour dire la vérité à l'écran. */
  readonly etatPush = this.push.etat;

  async definir(actives: boolean): Promise<EtatPush> {
    this.actives.set(actives);
    try {
      localStorage.setItem(CLE, actives ? '1' : '0');
    } catch {
      // Le choix vaut pour la session en cours.
    }

    if (!actives) {
      await this.push.desactiver();
      return 'inactif';
    }
    return this.push.activer();
  }

  /**
   * Rebranche le canal au démarrage, si l'utilisateur l'avait laissé actif et
   * que la permission est déjà accordée. Jamais de demande ici : réclamer une
   * autorisation à l'ouverture, c'est se la faire refuser.
   */
  async rebrancher(): Promise<void> {
    if (!this.actives()) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    await this.push.activer();
  }

  private lire(): boolean {
    try {
      return localStorage.getItem(CLE) !== '0';
    } catch {
      return true;
    }
  }
}
