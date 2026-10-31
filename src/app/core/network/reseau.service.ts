import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * État de la connexion - traduction de `ConnectivityService`
 * (`lib/core/network/connectivity_service.dart`).
 *
 * Rien ne surveillait le réseau côté PWA : `OfflineBanner` et `OfflineScreen`
 * étaient bien portés, mais seuls la page de démonstration les affichait.
 * L'utilisateur perdait sa connexion et ne voyait que des écrans d'erreur
 * génériques, sans jamais apprendre que c'était son réseau et non le serveur.
 *
 * `navigator.onLine` est moins fiable qu'un plugin natif - il dit « une
 * interface est active », pas « Internet répond » - et le code Flutter le
 * notait déjà comme la limite assumée du portage. Il suffit pour ce qu'on en
 * fait : prévenir, pas décider.
 */
@Injectable({ providedIn: 'root' })
export class ReseauService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _enLigne = signal(this.lireEtatInitial());

  /** Vrai tant que le navigateur se croit connecté. */
  readonly enLigne = this._enLigne.asReadonly();

  constructor() {
    const passeEnLigne = (): void => this._enLigne.set(true);
    const passeHorsLigne = (): void => this._enLigne.set(false);

    window.addEventListener('online', passeEnLigne);
    window.addEventListener('offline', passeHorsLigne);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', passeEnLigne);
      window.removeEventListener('offline', passeHorsLigne);
    });
  }

  private lireEtatInitial(): boolean {
    // `navigator.onLine` n'existe pas partout (rendu serveur, vieux moteurs) :
    // en son absence, on suppose connecté plutôt que d'afficher un bandeau
    // d'alerte à quelqu'un dont la connexion va très bien.
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }
}
