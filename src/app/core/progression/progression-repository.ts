import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProgressionStats, DayActivity, MatiereActivity, BadgeModel, StudySession,
  statsDepuisApi, badgeDepuisApi, sessionDepuisApi, jourDepuisApi, matiereDepuisApi,
} from './progression.model';
import { enFailure } from '../network/erreur-api';

@Injectable({ providedIn: 'root' })
export class ProgressionRepository {
  private readonly http = inject(HttpClient);

  async getStats(): Promise<ProgressionStats> {
    const reponse = await firstValueFrom(this.http.get('/api/progression/stats'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    return statsDepuisApi(data ?? {});
  }

  async getWeekActivity(): Promise<DayActivity[]> {
    const reponse = await firstValueFrom(this.http.get('/api/progression/week-activity'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    const raw = Array.isArray(data?.['activities']) ? (data['activities'] as Record<string, unknown>[]) : [];
    return raw.map(jourDepuisApi);
  }

  async getMatiereActivity(): Promise<MatiereActivity[]> {
    const reponse = await firstValueFrom(this.http.get('/api/progression/matiere-activity'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    const raw = Array.isArray(data?.['activities']) ? (data['activities'] as Record<string, unknown>[]) : [];
    return raw.map(matiereDepuisApi);
  }

  async getBadges(): Promise<BadgeModel[]> {
    try {
      const reponse = await firstValueFrom(this.http.post('/api/progression/badges/check', {}));
      return this.parseBadges(reponse as Record<string, unknown>);
    } catch (e) {
      try {
        const reponse = await firstValueFrom(this.http.get('/api/progression/badges'));
        return this.parseBadges(reponse as Record<string, unknown>);
      } catch (fallback) {
        throw enFailure(fallback);
      }
    }
  }

  async getRecentSessions(limit = 5): Promise<StudySession[]> {
    const reponse = await firstValueFrom(this.http.get('/api/progress/sessions', { params: { limit: String(limit) } }));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(sessionDepuisApi);
  }

  async createStudySession(payload: {
    documentId: string;
    dureeSecondes: number;
    pagesLues: number;
    date: Date;
  }): Promise<void> {
    await firstValueFrom(this.http.post('/api/progress/sessions', {
      documentId: payload.documentId,
      dureeSecondes: payload.dureeSecondes,
      pagesLues: payload.pagesLues,
      date: payload.date.toISOString(),
    }));
  }

  private parseBadges(reponse: Record<string, unknown>): BadgeModel[] {
    const data = reponse?.['data'];
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(badgeDepuisApi);
  }

}
