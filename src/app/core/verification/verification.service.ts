import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERIFICATION_AUCUNE, VerificationState, verificationDepuisJson } from '../models/verification.model';

/**
 * État du dossier de vérification académique — traduction minimale de
 * `VerificationNotifier`
 * (`lib/domains/verification/presentation/providers/verification_provider.dart`),
 * pour ce que le garde de routage (Phase 3) a besoin de lire de façon
 * synchrone — exactement `_ref.read(verificationStateProvider)` côté
 * Flutter.
 *
 * Le formulaire de dépôt, la liste des types de justificatifs et le
 * détail de la revue restent Phase 4 (module Vérification) ; seul l'état
 * global, qui conditionne l'accès au reste de l'application, est câblé
 * ici.
 */
@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly http = inject(HttpClient);

  /** Compte standard par défaut : aucun blocage tant que `refresh()` n'a
   * pas été appelé, ce qu'`AuthService` fait après chaque ouverture de
   * session. */
  readonly state = signal<VerificationState>(VERIFICATION_AUCUNE);

  async refresh(): Promise<void> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/verification/requests/me'));
      const brut = reponse && typeof reponse === 'object'
        ? ((reponse as Record<string, unknown>)['data'] as Record<string, unknown>) ?? (reponse as Record<string, unknown>)
        : {};
      this.state.set(verificationDepuisJson(brut));
    } catch {
      // Hors ligne ou serveur indisponible : on garde le dernier état
      // connu plutôt que de basculer sur un blocage qui n'en est peut-être
      // pas un.
    }
  }

  reset(): void {
    this.state.set(VERIFICATION_AUCUNE);
  }
}
