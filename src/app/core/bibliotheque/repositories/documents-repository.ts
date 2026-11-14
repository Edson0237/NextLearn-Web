import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../../models';
import {
  DocumentModel,
  documentDepuisApi,
  DocumentPage,
  pageDocumentsDepuisApi,
  DocumentSort,
  DocumentReadAccess,
} from '../models/document.model';
import { StockageHorsLigne } from '../services/stockage-hors-ligne';
import { enFailure } from '../../network';

/**
 * Accès réseau au catalogue de documents — NextLearn Smart Document Loading Architecture.
 * Récupère exclusivement les métadonnées et gère l'accès sécurisé à la demande.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsRepository {
  private readonly http = inject(HttpClient);
  private readonly stockage = inject(StockageHorsLigne);

  /**
   * Smart Document Loading : récupération de métadonnées avec pagination par curseur.
   * Aucune lecture ni téléchargement de fichier physique.
   */
  async getDocuments(
    filters: {
      type?: string;
      format?: string;
      matiereId?: string;
      matiere?: string;
      filiereId?: string;
      filiere?: string;
      niveau?: string;
      semestre?: string;
      section?: string;
      annee?: string;
      anneeAcademique?: string;
      search?: string;
      sort?: DocumentSort | string;
    } = {},
    cursor?: string,
    limit: number = 20,
  ): Promise<DocumentPage> {
    const params: Record<string, string> = {
      limit: String(limit),
    };
    if (cursor) params['cursor'] = cursor;
    if (filters.sort) params['sort'] = String(filters.sort);
    if (filters.type) params['type'] = filters.type;
    if (filters.format) params['format'] = filters.format;
    if (filters.matiereId) params['matiereId'] = filters.matiereId;
    if (filters.matiere) params['matiere'] = filters.matiere;
    if (filters.filiereId) params['filiereId'] = filters.filiereId;
    if (filters.niveau) params['niveau'] = filters.niveau;
    if (filters.semestre) params['semestre'] = filters.semestre;
    if (filters.section) params['section'] = filters.section;
    if (filters.annee) params['annee'] = filters.annee;
    if (filters.anneeAcademique) params['anneeAcademique'] = filters.anneeAcademique;
    if (filters.search) params['search'] = filters.search;

    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents', { params }));
      return pageDocumentsDepuisApi(reponse as Record<string, unknown>);
    } catch (e) {
      throw enFailure(e);
    }
  }

  /**
   * Récupère les métadonnées détaillées d'un document (sans fichier ni URL signée).
   */
  async getDocumentDetails(documentId: string): Promise<DocumentModel | null> {
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/documents/${documentId}`));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      return data ? documentDepuisApi(data) : null;
    } catch (e) {
      throw enFailure(e);
    }
  }

  /**
   * Alias rétrocompatible pour getDocumentDetails.
   */
  async getById(id: string): Promise<DocumentModel | null> {
    return this.getDocumentDetails(id);
  }

  /**
   * Récupération à la demande de l'accès de lecture (Smart Document Loading).
   * Appelé UNIQUEMENT lorsque l'utilisateur appuie sur « Lire ».
   */
  async requestDocumentReading(documentId: string): Promise<DocumentReadAccess> {
    try {
      const reponse = await firstValueFrom(this.http.post(`/api/documents/${documentId}/read`, {}));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? payload;
      return {
        readUrl: String(data['readUrl'] ?? data['url'] ?? ''),
        expiresIn: Number(data['expiresIn'] ?? 300),
        mimeType: String(data['mimeType'] ?? 'application/pdf'),
        format: data['format'] === 'docx' ? 'docx' : 'pdf',
        size:
          typeof data['fileSize'] === 'number'
            ? data['fileSize']
            : typeof data['size'] === 'number'
              ? data['size']
              : undefined,
      };
    } catch (e) {
      throw enFailure(e);
    }
  }

  /**
   * Obtient un accès de téléchargement sécurisé et comptabilise le téléchargement.
   */
  async downloadDocument(documentId: string): Promise<{ url: string; expiresIn: number }> {
    try {
      const reponse = await firstValueFrom(this.http.post(`/api/documents/${documentId}/download`, {}));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? payload;
      return {
        url: String(data['url'] ?? ''),
        expiresIn: Number(data['expiresIn'] ?? 3600),
      };
    } catch (e) {
      throw enFailure(e);
    }
  }

  /**
   * Récupère un document depuis le stockage local hors connexion (IndexedDB).
   */
  async getOfflineDocument(documentId: string): Promise<DocumentModel | null> {
    await this.stockage.rafraichir();
    return this.stockage.infoDocument(documentId)?.document ?? null;
  }

  /**
   * Rétrocompatibilité : pagination offset classique.
   */
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
      throw enFailure(e);
    }
  }

  async searchPage(
    query: string,
    {
      page = 1,
      limit = 20,
      sort,
      semestre,
    }: {
      page?: number;
      limit?: number;
      sort?: DocumentSort;
      semestre?: string;
    } = {},
  ): Promise<DocumentPage> {
    const params: Record<string, string> = { page: String(page), limit: String(limit), q: query };
    if (sort) params['sort'] = sort;
    if (semestre) params['semestre'] = semestre;

    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents/search', { params }));
      return pageDocumentsDepuisApi(reponse as Record<string, unknown>);
    } catch (e) {
      throw enFailure(e);
    }
  }

  async search(query: string): Promise<DocumentModel[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/documents/search', { params: { q: query } }));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(documentDepuisApi);
    } catch (e) {
      throw enFailure(e);
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
      throw enFailure(e);
    }
  }

  /**
   * URL de lecture à la demande (utilise POST /:id/read en priorité).
   */
  async urlLecture(id: string): Promise<string | null> {
    try {
      const access = await this.requestDocumentReading(id);
      return access.readUrl || null;
    } catch {
      try {
        const reponse = await firstValueFrom(this.http.get(`/api/documents/${id}/signed-url`));
        const payload = (reponse as Record<string, unknown>) ?? {};
        const data = (payload['data'] as Record<string, unknown>) ?? payload;
        const url = data['url'] ? String(data['url']) : null;
        return url || null;
      } catch (e) {
        if (e instanceof Failure && e.compteNonValide) throw e;
        if (e instanceof Failure && e.code === 'DOCUMENT_UNAVAILABLE') throw e;
        return null;
      }
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
      throw enFailure(e);
    }
  }
}
