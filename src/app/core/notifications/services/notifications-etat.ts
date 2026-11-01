import { inject, Injectable, signal } from '@angular/core';
import { NotificationsRepository } from '../repositories/notifications-repository';

/**
 * Le nombre de notifications non lues - **une seule source**, lue par toutes
 * les cloches de l'application.
 *
 * ## Le défaut corrigé
 *
 * Le compteur vivait dans l'accueil, récupéré une fois dans `ngOnInit`. Or
 * l'accueil est un onglet que le routeur garde monté (`TabReuseStrategy`) :
 * son `ngOnInit` ne se rejoue jamais. On lisait ses notifications, on
 * revenait, et la cloche affichait toujours l'ancien chiffre - la pastille ne
 * disparaissait qu'en rechargeant la page.
 *
 * Et seul l'accueil la portait : les cloches des quatre autres onglets
 * n'avaient jamais de pastille, alors qu'elles mènent au même endroit.
 *
 * ## Ce que fait ce service
 *
 * - c'est un signal : tout ce qui le lit se met à jour quand il change, sans
 *   attendre qu'un écran se recrée ;
 * - la page des notifications le met à jour **dès** qu'une lecture réussit
 *   (`retirer`, `toutLu`), au lieu d'attendre une nouvelle requête ;
 * - il se resynchronise avec le serveur quand l'application revient au
 *   premier plan - de nouvelles notifications ont pu arriver pendant qu'on
 *   regardait ailleurs.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsEtat {
  private readonly repo = inject(NotificationsRepository);

  private readonly _nonLues = signal(0);
  readonly nonLues = this._nonLues.asReadonly();

  private enCours: Promise<void> | null = null;
  private ecoute = false;

  /** Demande le compte au serveur. Ne lève jamais : une cloche sans pastille vaut mieux qu'une erreur. */
  rafraichir(): Promise<void> {
    this.ecouterRetourAuPremierPlan();
    // Un seul appel à la fois : cinq en-têtes qui s'initialisent ensemble ne
    // doivent pas faire cinq requêtes identiques.
    if (this.enCours) return this.enCours;
    this.enCours = (async () => {
      try {
        this._nonLues.set(await this.repo.getUnreadCount());
      } catch {
        // Hors ligne ou serveur muet : on garde le dernier chiffre connu.
      } finally {
        this.enCours = null;
      }
    })();
    return this.enCours;
  }

  /** Une notification vient d'être lue. */
  retirer(nombre = 1): void {
    this._nonLues.update((n) => Math.max(0, n - nombre));
  }

  /** Tout vient d'être lu. */
  toutLu(): void {
    this._nonLues.set(0);
  }

  private ecouterRetourAuPremierPlan(): void {
    if (this.ecoute || typeof document === 'undefined') return;
    this.ecoute = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.rafraichir();
    });
  }
}
