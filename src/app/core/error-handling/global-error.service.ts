import { Injectable, signal } from '@angular/core';

export interface ErreurFatale {
  readonly details: string;
}

/**
 * Détient l'erreur fatale courante, s'il y en a une — lue par `App` pour
 * remplacer tout le contenu par `FatalError`. Voir `AppErrorHandler`.
 */
@Injectable({ providedIn: 'root' })
export class GlobalErrorService {
  readonly fatal = signal<ErreurFatale | null>(null);

  reset(): void {
    this.fatal.set(null);
  }

  signaler(erreur: unknown): void {
    const details = erreur instanceof Error
      ? `${erreur.name}: ${erreur.message}\n\n${erreur.stack ?? ''}`
      : String(erreur);
    this.fatal.set({ details });
  }
}
