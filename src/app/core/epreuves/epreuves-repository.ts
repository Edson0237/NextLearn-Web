import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { EpreuveModel, epreuveDepuisJson } from './epreuve.model';

/**
 * Accès réseau aux épreuves — traduction d'`EpreuveRemoteRepository`
 * (`lib/domains/epreuves/infrastructure/repositories/epreuve_remote_repository.dart`).
 *
 * **Non repris** : le repli sur le cache Hive hors ligne. La bibliothèque
 * hors-ligne (IndexedDB/Dexie, Phase 5 du portage) n'existe pas encore
 * côté Angular ; la reprendre pour ce seul domaine, avant l'infrastructure
 * qu'elle partagera avec les documents, serait construire deux fois.
 */
@Injectable({ providedIn: 'root' })
export class EpreuvesRepository {
  private readonly http = inject(HttpClient);

  async getEpreuves(): Promise<EpreuveModel[]> {
    try {
      const reponse = await firstValueFrom(
        this.http.get('/api/epreuves', { params: { limit: 50 } }),
      );
      const brut = this.liste(reponse);
      return brut.map(epreuveDepuisJson);
    } catch (e) {
      throw this.echec(e);
    }
  }

  async getById(id: string): Promise<EpreuveModel | undefined> {
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/epreuves/${id}`));
      const data = (reponse as Record<string, unknown>)?.['data'];
      return data && typeof data === 'object' ? epreuveDepuisJson(data as Record<string, unknown>) : undefined;
    } catch (e) {
      throw this.echec(e);
    }
  }

  async rate(id: string, note: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/epreuves/${id}/rate`, { note }));
    } catch (e) {
      throw this.echec(e);
    }
  }

  async getDownloadUrl(id: string, type: 'epreuve' | 'corrige'): Promise<string> {
    try {
      const reponse = await firstValueFrom(
        this.http.post(`/api/epreuves/${id}/download`, {}, { params: { type } }),
      );
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      const url = data?.['url'];
      if (typeof url !== 'string') throw new Failure('URL de téléchargement introuvable');
      return url;
    } catch (e) {
      throw e instanceof Failure ? e : this.echec(e);
    }
  }

  private liste(reponse: unknown): Record<string, unknown>[] {
    const data = (reponse as Record<string, unknown>)?.['data'];
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
