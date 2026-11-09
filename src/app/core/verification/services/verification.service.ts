import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VERIFICATION_AUCUNE, VerificationState, verificationDepuisJson, statutVerificationDepuisApi } from '../../models/verification.model';
import { UserModel } from '../../models/user.model';

/**
 * État du dossier de vérification académique - traduction minimale de
 * `VerificationNotifier`
 * (`lib/domains/verification/presentation/providers/verification_provider.dart`),
 * pour ce que le garde de routage (Phase 3) a besoin de lire de façon
 * synchrone - exactement `_ref.read(verificationStateProvider)` côté
 * Flutter.
 */
@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly http = inject(HttpClient);

  readonly state = signal<VerificationState>(VERIFICATION_AUCUNE);

  /** Synchronise immédiatement l'état à partir du statut connu sur le compte utilisateur. */
  syncFromUser(user?: UserModel | null): void {
    if (!user) {
      this.state.set(VERIFICATION_AUCUNE);
      return;
    }
    if (!user.verificationStatus || user.verificationStatus === 'approuve') {
      this.state.set(VERIFICATION_AUCUNE);
      return;
    }
    const statut = statutVerificationDepuisApi(user.verificationStatus);
    this.state.set({
      requis: true,
      statut,
      tentatives: 0,
      resoumissionsRestantes: 3,
    });
  }

  async refresh(): Promise<VerificationState> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/verification/requests/me'));
      const brut = reponse && typeof reponse === 'object'
        ? ((reponse as Record<string, unknown>)['data'] as Record<string, unknown>) ?? (reponse as Record<string, unknown>)
        : {};
      const s = verificationDepuisJson(brut);
      this.state.set(s);
      return s;
    } catch {
      return this.state();
    }
  }

  reset(): void {
    this.state.set(VERIFICATION_AUCUNE);
  }
}
