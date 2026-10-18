import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { ProfilStats, profilStatsDepuisApi, SuppressionRapport, suppressionRapportDepuisApi } from './profil.model';

/**
 * Accès réseau au profil — traduction de
 * `ProfilRemoteRepository` (`lib/domains/profil/infrastructure/repositories/profil_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class ProfilRepository {
  private readonly http = inject(HttpClient);

  async getStats(): Promise<ProfilStats> {
    try {
      const [reponseProfil, reponseStreak] = await Promise.all([
        firstValueFrom(this.http.get('/api/profile')),
        firstValueFrom(this.http.get('/api/progression/stats')),
      ]);
      const payload = (reponseProfil as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? {};
      const stats = (data['stats'] as Record<string, unknown>) ?? {};
      const base = profilStatsDepuisApi(stats);

      const progressionPayload = (reponseStreak as Record<string, unknown>) ?? {};
      const progressionData = (progressionPayload['data'] as Record<string, unknown>) ?? {};
      const streak = typeof progressionData['streak'] === 'number'
        ? Math.round(progressionData['streak'])
        : base.streak;

      return { ...base, streak };
    } catch (e) {
      throw this.echec(e);
    }
  }

  async deleteAccount(pin: string): Promise<SuppressionRapport> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/users/me', { body: { pin } }));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? {};
      const rapport = (data['rapport'] as Record<string, unknown>) ?? {};
      return suppressionRapportDepuisApi(rapport);
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
