import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';

/**
 * Gestion des documents hors-ligne — traduction de `OfflineRemoteRepository`.
 * Côté PWA, on suit les IDs marqués hors-ligne sans stockage local de fichiers.
 */
@Injectable({ providedIn: 'root' })
export class OfflineRepository {
  private readonly http = inject(HttpClient);

  async getOfflineIds(): Promise<Set<string>> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/offline/documents'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      const ids = new Set<string>();
      for (const entry of liste) {
        const id = this.extractDocumentId(entry);
        if (id) ids.add(id);
      }
      return ids;
    } catch (e) {
      throw this.echec(e);
    }
  }

  async markOffline(documentId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/offline/${documentId}`, {}));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 409) return;
      throw this.echec(e);
    }
  }

  async removeOffline(documentId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/api/offline/${documentId}`));
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) return;
      throw this.echec(e);
    }
  }

  private extractDocumentId(entry: Record<string, unknown>): string | null {
    const documentId = entry['documentId'];
    if (!documentId) return null;
    if (typeof documentId === 'object' && !Array.isArray(documentId)) {
      const map = documentId as Record<string, unknown>;
      return map['_id'] ? String(map['_id']) : (map['id'] ? String(map['id']) : null);
    }
    return String(documentId);
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
