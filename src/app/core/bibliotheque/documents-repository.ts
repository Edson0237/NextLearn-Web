import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { DocumentModel, documentDepuisApi, DocumentPage, pageDocumentsDepuisApi, DocumentSort } from './document.model';

/**
 * Accès réseau au catalogue de documents — traduction de
 * `DocumentRemoteRepository` (`lib/domains/bibliotheque/infrastructure/repositories/document_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class DocumentsRepository {
  private readonly http = inject(HttpClient);

  private readonly maxLimit = 50;
  private readonly maxPagesWhenFetchingAll = 40;

  async getDocuments(): Promise<DocumentModel[]> {
    try {
      const allDocs: DocumentModel[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const reponse = await firstValueFrom(this.http.get('/api/documents', {
          params: { page: String(page), limit: String(this.maxLimit) },
        }));
        const pageData = pageDocumentsDepuisApi(reponse as Record<string, unknown>);
        allDocs.push(...pageData.items);
        totalPages = pageData.totalPages;
        page++;
      } while (page <= totalPages && page <= this.maxPagesWhenFetchingAll);

      return allDocs;
    } catch (e) {
      throw this.echec(e);
    }
  }

  async getDocumentsPage({
    page = 1,
    limit = 20,
    sort = DocumentSort.recent,
    type,
    matiereId,
    semestre,
  }: {
    page?: number;
    limit?: number;
    sort?: DocumentSort;
    type?: string;
    matiereId?: string;
    semestre?: string;
  } = {}): Promise<DocumentPage> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
      sort,
    };
    if (type) params['type'] = type;
    if (matiereId) params['matiereId'] = matiereId;
    if (semestre) params['semestre'] = semestre;

    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents', { params }));
      return pageDocumentsDepuisApi(reponse as Record<string, unknown>);
    } catch (e) {
      throw this.echec(e);
    }
  }

  async searchPage(query: string, { page = 1, limit = 20, sort, semestre }: {
    page?: number; limit?: number; sort?: DocumentSort; semestre?: string;
  } = {}): Promise<DocumentPage> {
    const params: Record<string, string> = { page: String(page), limit: String(limit), q: query };
    if (sort) params['sort'] = sort;
    if (semestre) params['semestre'] = semestre;

    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents/search', { params }));
      return pageDocumentsDepuisApi(reponse as Record<string, unknown>);
    } catch (e) {
      throw this.echec(e);
    }
  }

  async search(query: string): Promise<DocumentModel[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents/search', { params: { q: query } }));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(documentDepuisApi);
    } catch (e) {
      throw this.echec(e);
    }
  }

  async getById(id: string): Promise<DocumentModel | null> {
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/documents/${id}`));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      return data ? documentDepuisApi(data) : null;
    } catch (e) {
      throw this.echec(e);
    }
  }

  async getRecommended(): Promise<DocumentModel[]> {
    return this.fetchList('/api/documents/recommended');
  }

  async getPopular(): Promise<DocumentModel[]> {
    return this.fetchList('/api/documents/popular');
  }

  async getRecent(): Promise<DocumentModel[]> {
    return this.fetchList('/api/documents/recent');
  }

  async recordView(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/documents/${id}/view`, {}));
    } catch {
      // Non-critique : ne pas bloquer l'affichage du détail.
    }
  }

  async rate(id: string, note: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/documents/${id}/rate`, { note }));
    } catch (e) {
      throw this.echec(e);
    }
  }

  async urlLecture(id: string): Promise<string | null> {
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/documents/${id}/signed-url`));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? payload;
      const url = data['url'] ? String(data['url']) : null;
      return url || null;
    } catch (e) {
      if (e instanceof Failure && e.compteNonValide) throw e;
      return null;
    }
  }

  async recordDownload(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/documents/${id}/download`, {}));
    } catch {
      // Non-critique : compteur uniquement.
    }
  }

  private async fetchList(path: string): Promise<DocumentModel[]> {
    try {
      const reponse = await firstValueFrom(this.http.get(path));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(documentDepuisApi);
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
