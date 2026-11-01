import { inject, Injectable } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * La pile des écrans visités, pour que « retour » revienne là d'où l'on vient.
 *
 * ## Le défaut corrigé
 *
 * Le retour de la fiche d'une ressource appelait `Location.back()`, et celui
 * du lecteur **ajoutait** une entrée vers la fiche (`navigateByUrl`) au lieu
 * de reculer. Après « fiche → lecture → retour », l'historique contenait donc
 * `liste, fiche, lecteur, fiche` : un retour depuis la fiche menait au
 * lecteur, un retour depuis le lecteur ramenait à la fiche. L'étudiant
 * tournait en rond sans jamais atteindre la liste d'où il venait.
 *
 * Ici, on sait ce qu'il y a derrière : `retour` recule jusqu'au dernier écran
 * qui n'est ni celui-ci ni un écran à ignorer, et ne navigue vers la
 * destination de repli que s'il n'y en a pas (lien ouvert directement).
 */
@Injectable({ providedIn: 'root' })
export class HistoriqueNavigation {
  private readonly router = inject(Router);
  /** Les adresses visitées, la plus récente en dernier. */
  private pile: string[] = [];

  /** La navigation en cours vient de l'historique du navigateur (retour / avance). */
  private parHistorique = false;

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.parHistorique = e.navigationTrigger === 'popstate';
      if (!(e instanceof NavigationEnd)) return;
      const url = e.urlAfterRedirects;
      if (this.parHistorique) {
        // Retour par le navigateur (ou `history.go`) : on revient sur une
        // entrée connue, tout ce qui la suivait n'existe plus.
        const deja = this.pile.lastIndexOf(url);
        if (deja !== -1) {
          this.pile.length = deja + 1;
          return;
        }
      }
      if (this.pile[this.pile.length - 1] !== url) this.pile.push(url);
      if (this.pile.length > 50) this.pile.shift();
    });
  }

  /**
   * Revient à l'écran précédent.
   *
   * @param repli destination quand rien d'utilisable ne précède.
   * @param ignorer adresses qu'on traverse sans s'y arrêter (par défaut, aucune).
   */
  retour(repli: string, ignorer: (url: string) => boolean = () => false): void {
    const courante = this.pile[this.pile.length - 1];
    let recul = 0;
    for (let i = this.pile.length - 2; i >= 0; i--) {
      recul++;
      const candidate = this.pile[i];
      if (candidate !== courante && !ignorer(candidate)) {
        window.history.go(-recul);
        return;
      }
    }
    void this.router.navigateByUrl(repli, { replaceUrl: true });
  }
}
