import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Détection des nouvelles versions.
 *
 * Rien n'écoutait `SwUpdate` : une fois le service worker installé, un
 * visiteur gardait la version qu'il avait tant qu'il n'avait pas fermé tous
 * ses onglets. Deux conséquences, et la seconde est la plus désagréable : un
 * correctif mis en ligne n'atteignait pas ceux qui ouvrent l'application tous
 * les jours, et un `index.html` resté en cache pouvait réclamer un morceau de
 * code que le déploiement suivant avait renommé — une page blanche, sans rien
 * à l'écran pour l'expliquer.
 *
 * Le rechargement n'est jamais imposé : on signale, l'utilisateur décide. Une
 * page qui se recharge toute seule fait perdre un formulaire en cours de
 * saisie.
 */
@Injectable({ providedIn: 'root' })
export class MiseAJourService {
  private readonly updates = inject(SwUpdate, { optional: true });

  /** Vrai dès qu'une version plus récente est prête à être activée. */
  readonly disponible = signal(false);

  constructor() {
    if (!this.updates?.isEnabled) return;

    this.updates.versionUpdates.subscribe((evenement) => {
      if (evenement.type === 'VERSION_READY') {
        this.disponible.set(true);
      }
      if (evenement.type === 'VERSION_INSTALLATION_FAILED') {
        // Rien à annoncer : l'ancienne version continue de fonctionner, et
        // c'est exactement ce qu'on veut qu'il se passe.
        this.disponible.set(false);
      }
    });

    // Le navigateur ne redemande pas de lui-même après le premier chargement.
    // Une vérification à chaque retour sur l'onglet suffit à rattraper une
    // mise en ligne du jour sans interroger le serveur en boucle.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.updates?.checkForUpdate().catch(() => undefined);
      }
    });
  }

  /** Active la nouvelle version et recharge — sur geste explicite seulement. */
  async appliquer(): Promise<void> {
    try {
      await this.updates?.activateUpdate();
    } finally {
      document.location.reload();
    }
  }
}
