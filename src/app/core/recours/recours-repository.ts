import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EtatRecours, Recours, etatRecoursDepuisApi, recoursDepuisApi, RecoursType } from './recours.model';

@Injectable({ providedIn: 'root' })
export class RecoursRepository {
  private readonly http = inject(HttpClient);

  async possibilites(): Promise<EtatRecours> {
    const reponse = await firstValueFrom(this.http.get('/api/recours/possibilites'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    return etatRecoursDepuisApi(data ?? {});
  }

  async mesRecours(): Promise<Recours[]> {
    const reponse = await firstValueFrom(this.http.get('/api/recours/me'));
    const data = (reponse as Record<string, unknown>)?.['data'];
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(recoursDepuisApi);
  }

  async deposer(type: RecoursType, motif: string, cibleId?: string): Promise<void> {
    const payload: Record<string, unknown> = { type, motif };
    if (cibleId) payload['cibleId'] = cibleId;
    await firstValueFrom(this.http.post('/api/recours', payload));
  }
}
