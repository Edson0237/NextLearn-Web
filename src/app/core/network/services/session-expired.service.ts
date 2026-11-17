import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

const MOTIFS_BANALS = new Set([
  'Refresh token invalide ou révoqué',
  'Refresh token invalide',
  'Token invalide',
  'Token expiré',
  'Token manquant',
]);

/**
 * Normalise le motif de fin de session renvoyé par l'API (Chantier P2).
 *
 * - Les motifs précis (inactivité, durée maximale, jeton réutilisé, session
 *   fermée à distance) sont conservés tels quels.
 * - Le message banal « Refresh token invalide ou révoqué » est remplacé par
 *   « Ta session s’est terminée. Reconnecte-toi. ».
 */
export function normaliserMotifFinSession(motif?: string | null): string | null {
  const propre = motif?.trim();
  if (!propre) return null;
  if (MOTIFS_BANALS.has(propre)) {
    return 'Ta session s’est terminée. Reconnecte-toi.';
  }
  return propre.length <= 240 ? propre : 'Ta session s’est terminée. Reconnecte-toi.';
}

/**
 * Pont découplé entre la couche réseau (ne connaît pas l'auth) et la
 * couche auth (écoute ce flux pour se déconnecter) - traduction de
 * `SessionExpiredNotifier` (`session_expired_notifier.dart`). Évite une
 * dépendance circulaire entre l'intercepteur HTTP et `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class SessionExpiredService {
  private readonly subject = new Subject<string | undefined>();
  readonly expired$ = this.subject.asObservable();

  private readonly _motif = signal<string | null>(null);
  /** Motif précis de la dernière fin de session, affiché une seule fois sur l'écran de connexion. */
  readonly motif = this._motif.asReadonly();

  notify(motif?: string): void {
    const normalise = normaliserMotifFinSession(motif);
    if (normalise) {
      this._motif.set(normalise);
    }
    this.subject.next(normalise ?? undefined);
  }

  /** Lit et efface le motif pour qu'il ne soit affiché qu'une seule fois. */
  consommerMotif(): string | null {
    const courant = this._motif();
    this._motif.set(null);
    return courant;
  }

  effacerMotif(): void {
    this._motif.set(null);
  }
}
