import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

const CLE_RECHARGEMENT = 'nl_maj_rechargee_a';
/** En deçà, un second rechargement automatique serait une boucle : on affiche le bandeau. */
const DELAI_ANTI_BOUCLE_MS = 60_000;
const VERIFICATION_PERIODIQUE_MS = 30 * 60_000;

/**
 * Mise à jour de l'application installée.
 *
 * Le service worker d'Angular garde la version qu'il a en cache et ne bascule
 * sur la suivante qu'au prochain chargement *après* que tous les onglets sont
 * fermés. Chrome, Edge, Samsung Internet et Safari qui avaient déjà visité le
 * site continuaient donc d'afficher l'ancienne version - alors qu'un
 * navigateur neuf, sans service worker, affichait la nouvelle. C'est ce que
 * ce service corrige, pour tous les navigateurs qui gèrent les service workers.
 *
 * ## Quand on recharge, quand on demande
 *
 * - **Tant que l'utilisateur n'a rien touché**, ou sur les pages publiques
 *   (hors `/app`), la nouvelle version est activée et la page rechargée tout de
 *   suite : il n'y a rien à perdre, et c'est ce qui rattrape le visiteur
 *   qui rouvre le site.
 * - **Une fois qu'il a commencé à interagir dans l'application**, on ne recharge
 *   pas d'autorité : une page qui se recharge fait perdre un formulaire en
 *   cours de saisie. Le bandeau propose la mise à jour, l'utilisateur décide.
 * - **Jamais deux rechargements automatiques à moins d'une minute** : si une
 *   version défectueuse relançait la mise à jour en boucle, mieux vaut un
 *   bandeau qu'une page qui clignote.
 *
 * Il vérifie aussi les nouvelles versions au démarrage, au retour sur
 * l'onglet, au retour de la connexion et toutes les 30 minutes : le navigateur
 * ne le fait pas de lui-même pour un onglet qui reste ouvert.
 *
 * Si le service worker déclare son cache irrécupérable (un morceau de code
 * supprimé par un déploiement), on recharge : c'est la page blanche sinon.
 */
@Injectable({ providedIn: 'root' })
export class MiseAJourService {
  private readonly updates = inject(SwUpdate, { optional: true });

  /** Vrai dès qu'une version plus récente est prête et n'a pas pu être appliquée d'office. */
  readonly disponible = signal(false);

  private interagi = false;

  constructor() {
    if (!this.updates?.isEnabled) return;
    const updates = this.updates;

    const abonnements = [
      updates.versionUpdates.subscribe((evenement) => {
        if (evenement.type === 'VERSION_READY') {
          if (this.peutRechargerSansRisque()) {
            void this.appliquer(true);
          } else {
            this.disponible.set(true);
          }
        }
        if (evenement.type === 'VERSION_INSTALLATION_FAILED') {
          // L'ancienne version continue de fonctionner : rien à annoncer.
          this.disponible.set(false);
        }
      }),
      updates.unrecoverable.subscribe(() => this.recharger()),
    ];

    const verifier = (): void => {
      void updates.checkForUpdate().catch(() => undefined);
    };
    const auRetour = (): void => {
      if (document.visibilityState === 'visible') verifier();
    };
    const marquerInteraction = (): void => {
      this.interagi = true;
    };

    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', verifier);
    window.addEventListener('pointerdown', marquerInteraction, { once: true, passive: true });
    window.addEventListener('keydown', marquerInteraction, { once: true });
    const minuteur = setInterval(verifier, VERIFICATION_PERIODIQUE_MS);
    verifier();

    inject(DestroyRef).onDestroy(() => {
      abonnements.forEach((a) => a.unsubscribe());
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', verifier);
      window.removeEventListener('pointerdown', marquerInteraction);
      window.removeEventListener('keydown', marquerInteraction);
      clearInterval(minuteur);
    });
  }

  /**
   * Active la nouvelle version et recharge. Sur geste explicite (le bandeau)
   * ou, pour `automatique`, quand rien n'est en jeu.
   */
  async appliquer(automatique = false): Promise<void> {
    if (automatique) this.memoriserRechargement();
    try {
      await this.updates?.activateUpdate();
    } finally {
      this.recharger();
    }
  }

  protected recharger(): void {
    document.location.reload();
  }

  private peutRechargerSansRisque(): boolean {
    if (this.rechargeRecemment()) return false;
    const horsApplication = !location.pathname.startsWith('/app');
    return horsApplication || !this.interagi;
  }

  private rechargeRecemment(): boolean {
    try {
      const t = Number(sessionStorage.getItem(CLE_RECHARGEMENT));
      return t > 0 && Date.now() - t < DELAI_ANTI_BOUCLE_MS;
    } catch {
      return false;
    }
  }

  private memoriserRechargement(): void {
    try {
      sessionStorage.setItem(CLE_RECHARGEMENT, String(Date.now()));
    } catch {
      // Stockage bloqué : le délai anti-boucle ne protège pas, la mise à jour reste utile.
    }
  }
}
