import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Absence minimale avant qu'un retour dans l'application relance les listes. */
const ABSENCE_MIN_MS = 20_000;
/** Une application laissée ouverte se remet à jour d'elle-même, sans geste. */
const PERIODE_MS = 5 * 60_000;

/**
 * Ce qui dit aux listes qu'il est temps de se relire.
 *
 * Une PWA reste ouverte des heures : un document publié entre-temps
 * n'apparaissait qu'après un rechargement de la page, puisque chaque liste ne se
 * charge qu'à son ouverture. Ce service lève un signal quand :
 *  - l'application redevient visible après une absence (retour d'un autre
 *    onglet, d'une autre application, écran rallumé) ;
 *  - la connexion revient ;
 *  - cinq minutes se sont écoulées pendant qu'elle est affichée.
 *
 * Les écrans y réagissent par une relecture **silencieuse** : pas de squelette
 * qui clignote, et une erreur passagère ne remplace pas ce qui est déjà affiché.
 */
@Injectable({ providedIn: 'root' })
export class Fraicheur {
  private readonly _tick = signal(0);
  /** Change à chaque fois que les listes devraient se relire. */
  readonly tick = this._tick.asReadonly();

  private cacheDepuis: number | null = null;

  constructor() {
    const surVisibilite = (): void => {
      if (document.visibilityState === 'hidden') {
        this.cacheDepuis = Date.now();
        return;
      }
      const absence = this.cacheDepuis === null ? 0 : Date.now() - this.cacheDepuis;
      this.cacheDepuis = null;
      if (absence >= ABSENCE_MIN_MS) this.relancer();
    };
    const surReseau = (): void => this.relancer();
    const minuterie = setInterval(() => {
      if (document.visibilityState === 'visible') this.relancer();
    }, PERIODE_MS);

    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('online', surReseau);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('online', surReseau);
      clearInterval(minuterie);
    });
  }

  relancer(): void {
    this._tick.update((n) => n + 1);
  }
}
