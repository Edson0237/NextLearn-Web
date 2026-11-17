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
import {
  RequeteCatalogue,
  ReponseCatalogue,
  reponseCatalogueDepuisApi,
} from '../models/catalogue.model';
import { StockageHorsLigne } from '../services/stockage-hors-ligne';
import { enFailure } from '../../network';

/**
 * Accès réseau au catalogue de documents - NextLearn Smart Document Loading Architecture.
 * Récupère exclusivement les métadonnées et gère l'accès sécurisé à la demande.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsRepository {
  private readonly http = inject(HttpClient);
  private readonly stockage = inject(StockageHorsLigne);

  /**
   * Catalogue v2 (Chantiers P5 & P11) : `GET /api/v2/catalogue`.
   *
   * - Par défaut (mode `profil`), aucun paramètre de classe n'est envoyé :
   *   le Backend déduit la classe depuis le compte de l'étudiant.
   * - En mode `alternative`, les trois paramètres (`universiteId`, `filiereId`, `niveau`)
   *   sont envoyés ensemble (§10.1).
   * - Filtres combinables dans n'importe quel ordre (`type`, `typeEpreuve`,
   *   `semestre`, `matiere`, `enseignant`, `annee`, `section`, `avecCorrige`, `q`).
   * - Facettes avec compteurs calculés côté serveur.
   * - Pagination par curseur (`tri=recent`) ou par page (`annee`, `populaire`, `alpha`).
   * - Accepte un `AbortSignal` pour annuler proprement une requête supplantée (§9.2).
   */
  async catalogue(requete: RequeteCatalogue = {}, signal?: AbortSignal): Promise<ReponseCatalogue> {
    if (signal?.aborted) {
      throw new DOMException('Requête annulée', 'AbortError');
    }

    const params: Record<string, string> = {};
    const joindre = (v?: string | readonly string[]) => {
      if (!v) return undefined;
      if (typeof v === 'string') return v.trim() || undefined;
      const propre = v.map((s) => s.trim()).filter(Boolean).slice(0, 20);
      return propre.length > 0 ? propre.join(',') : undefined;
    };

    // Règle §10.1 (P11) : envoi groupé des 3 paramètres uniquement lorsqu'une classe
    // alternative complète est sélectionnée ; sinon aucun paramètre de classe n'est envoyé.
    const universiteId = requete.universiteId?.trim();
    const filiereId = joindre(requete.filiereId);
    const niveau = requete.niveau?.trim().toUpperCase();
    if (universiteId && filiereId && niveau && /^N[1-5]$/.test(niveau)) {
      params['universiteId'] = universiteId;
      params['filiereId'] = filiereId;
      params['niveau'] = niveau;
    }

    const type = joindre(requete.type);
    const typeEpreuve = joindre(requete.typeEpreuve);
    const semestre = joindre(requete.semestre);
    const matiere = joindre(requete.matiere);
    const enseignant = joindre(requete.enseignant);
    const annee = joindre(requete.annee);
    const section = joindre(requete.section);

    if (type) params['type'] = type.toUpperCase();
    if (typeEpreuve) params['typeEpreuve'] = typeEpreuve.toUpperCase();
    if (semestre) params['semestre'] = semestre.toUpperCase();
    if (matiere) params['matiere'] = matiere;
    if (enseignant) params['enseignant'] = enseignant;
    if (annee) params['annee'] = annee;
    if (section) params['section'] = section.toUpperCase();
    if (typeof requete.avecCorrige === 'boolean') {
      params['avecCorrige'] = String(requete.avecCorrige);
    }
    if (requete.q) {
      const q = requete.q.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (q.length >= 2) params['q'] = q;
    }
    const tri = requete.tri ?? 'recent';
    params['tri'] = tri;
    if (tri === 'recent' && requete.cursor) {
      params['cursor'] = requete.cursor;
    } else if (tri !== 'recent' && requete.page && requete.page > 1) {
      params['page'] = String(Math.min(1000, Math.max(1, Math.round(requete.page))));
    }
    if (requete.limit) {
      params['limit'] = String(Math.min(50, Math.max(1, Math.round(requete.limit))));
    }

    try {
      const observable = this.http.get('/api/v2/catalogue', { params });
      const reponse = signal
        ? await new Promise<unknown>((resolve, reject) => {
            const onAbort = () => {
              sub.unsubscribe();
              reject(new DOMException('Requête annulée', 'AbortError'));
            };
            signal.addEventListener('abort', onAbort, { once: true });
            const sub = observable.subscribe({
              next: (val) => {
                signal.removeEventListener('abort', onAbort);
                resolve(val);
              },
              error: (err) => {
                signal.removeEventListener('abort', onAbort);
                reject(err);
              },
            });
          })
        : await firstValueFrom(observable);
      return reponseCatalogueDepuisApi(reponse as Record<string, unknown>);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw e;
      }
      throw enFailure(e);
    }
  }

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
    section,
  }: {
    page?: number;
    limit?: number;
    sort?: DocumentSort;
    type?: string;
    matiereId?: string;
    semestre?: string;
    section?: string;
  } = {}): Promise<DocumentPage> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
      sort,
    };
    if (type) params['type'] = type;
    if (matiereId) params['matiereId'] = matiereId;
    if (semestre) params['semestre'] = semestre;
    if (section) params['section'] = section;

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
