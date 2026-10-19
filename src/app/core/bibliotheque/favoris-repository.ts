import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { DocumentModel, documentDepuisApi } from './document.model';

/**
 * Gestion des favoris — traduction de `FavorisRemoteRepository`.
 */
@Injectable({ providedIn: 'root' })
export class FavorisRepository {
  private readonly http = inject(HttpClient);

  async getFavorites(): Promise<DocumentModel[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/favorites'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const documents: DocumentModel[] = [];
      for (const entry of liste) {
        const doc = entry?.['documentId'];
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) continue;
        try {
          documents.push(documentDepuisApi(doc as Record<string, unknown>));
        } catch {
          // Ignorer les documents invalides.
        }
      }
      return documents;
    } catch (e) {
      throw this.echec(e);
    }
  }

  async addFavorite(documentId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/favorites/${documentId}`, {}));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) return;
      throw this.echec(e);
    }
  }

  async removeFavorite(documentId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/api/favorites/${documentId}`));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return;
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
