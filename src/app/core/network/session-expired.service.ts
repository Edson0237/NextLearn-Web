import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Pont découplé entre la couche réseau (ne connaît pas l'auth) et la
 * couche auth (écoute ce flux pour se déconnecter) — traduction de
 * `SessionExpiredNotifier` (`session_expired_notifier.dart`). Évite une
 * dépendance circulaire entre l'intercepteur HTTP et `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class SessionExpiredService {
  private readonly subject = new Subject<void>();
  readonly expired$ = this.subject.asObservable();

  notify(): void {
    this.subject.next();
  }
}
