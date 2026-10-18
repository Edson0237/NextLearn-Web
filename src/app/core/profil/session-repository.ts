import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';

/** Un appareil connecté au compte. */
export interface SessionAppareil {
  readonly sessionId: string;
  readonly appareil: string;
  /** La session utilisée en ce moment même. */
  readonly courante: boolean;
  readonly plateforme?: string;
  readonly versionApp?: string;
  readonly ip?: string;
  readonly derniereActivite?: Date;
  readonly creeeLe?: Date;
}

export function sessionDepuisApi(json: Record<string, unknown>): SessionAppareil {
  return {
    sessionId: String(json['sessionId'] ?? ''),
    appareil: String(json['appareil'] ?? 'Appareil inconnu'),
    courante: json['courante'] === true,
    plateforme: json['plateforme'] == null ? undefined : String(json['plateforme']),
    versionApp: json['versionApp'] == null ? undefined : String(json['versionApp']),
    ip: json['ip'] == null ? undefined : String(json['ip']),
    derniereActivite: json['derniereActiviteLe']
      ? new Date(String(json['derniereActiviteLe']))
      : undefined,
    creeeLe: json['creeeLe'] ? new Date(String(json['creeeLe'])) : undefined,
  };
}

/**
 * Accès réseau aux sessions actives — traduction de
 * `SessionRemoteRepository` (`lib/domains/profil/infrastructure/repositories/session_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class SessionRepository {
  private readonly http = inject(HttpClient);

  async lister(): Promise<SessionAppareil[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/auth/sessions'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(sessionDepuisApi);
    } catch (e) {
      throw this.echec(e);
    }
  }

  async revoquer(sessionId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/api/auth/sessions/${sessionId}`));
    } catch (e) {
      throw this.echec(e);
    }
  }

  /** Déconnecte tous les autres appareils, en gardant celui-ci. */
  async revoquerLesAutres(): Promise<number> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/auth/sessions'));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      const fermees = data?.['fermees'];
      return typeof fermees === 'number' ? fermees : 0;
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
