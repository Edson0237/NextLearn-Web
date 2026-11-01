import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../../models';
import { EpreuveModel, epreuveDepuisJson } from '../models/epreuve.model';
import { enFailure } from '../../network/erreur-api';

/**
 * Accès réseau aux épreuves - traduction d'`EpreuveRemoteRepository`
 * (`lib/domains/epreuves/infrastructure/repositories/epreuve_remote_repository.dart`).
 *
 * **Non repris** : le repli sur le cache Hive hors ligne. La bibliothèque
 * hors-ligne (IndexedDB/Dexie, Phase 5 du portage) n'existe pas encore
 * côté Angular ; la reprendre pour ce seul domaine, avant l'infrastructure
 * qu'elle partagera avec les documents, serait construire deux fois.
 */
/** Le plafond d'une page côté serveur. */
const TAILLE_PAGE = 50;
/** Garde-fou : 40 pages × 50 = 2 000 épreuves. */
const MAX_PAGES = 40;

@Injectable({ providedIn: 'root' })
export class EpreuvesRepository {
  private readonly http = inject(HttpClient);

  /**
   * Toutes les épreuves du périmètre de l'étudiant.
   *
   * Le serveur plafonne une page à 50 : l'écran ne chargeait que la première, et
   * ses filtres - qui travaillent sur la liste chargée - ne voyaient donc jamais
   * la 51ᵉ épreuve. On parcourt maintenant toutes les pages, avec un garde-fou
   * (`MAX_PAGES`) pour ne pas boucler si le serveur annonçait un total absurde.
   */
  async getEpreuves(): Promise<EpreuveModel[]> {
    try {
      const toutes: EpreuveModel[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const reponse = await firstValueFrom(
          this.http.get('/api/epreuves', { params: { page, limit: TAILLE_PAGE } }),
        );
        toutes.push(...this.liste(reponse).map(epreuveDepuisJson));
        const meta = ((reponse as Record<string, unknown>)?.['meta'] ?? {}) as Record<string, unknown>;
        totalPages = typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 1;
        page++;
      } while (page <= totalPages && page <= MAX_PAGES);
      return toutes;
    } catch (e) {
      throw enFailure(e);
    }
  }

  async getById(id: string): Promise<EpreuveModel | undefined> {
    try {
      const reponse = await firstValueFrom(this.http.get(`/api/epreuves/${id}`));
      const data = (reponse as Record<string, unknown>)?.['data'];
      return data && typeof data === 'object' ? epreuveDepuisJson(data as Record<string, unknown>) : undefined;
    } catch (e) {
      throw enFailure(e);
    }
  }

  async rate(id: string, note: number): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`/api/epreuves/${id}/rate`, { note }));
    } catch (e) {
      throw enFailure(e);
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
      throw e instanceof Failure ? e : enFailure(e);
    }
  }

  private liste(reponse: unknown): Record<string, unknown>[] {
    const data = (reponse as Record<string, unknown>)?.['data'];
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  }

}
