import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CatalogueMotifs,
  CibleSignalement,
  ResultatSignalement,
  MonSignalement,
  monSignalementDepuisApi,
  motifDepuisApi,
} from './report.model';
import { enFailure } from '../network/erreur-api';

/**
 * Signalement de contenu - traduction de `ReportRemoteRepository`
 * (`lib/domains/moderation/infrastructure/repositories/`).
 *
 * Le domaine entier manquait côté PWA : un étudiant qui tombait sur un
 * document protégé par le droit d'auteur, ou sur un sujet d'examen non encore
 * passé, n'avait aucun moyen de le dire. C'est aussi une obligation pratique
 * des magasins : un catalogue alimenté par les utilisateurs doit offrir un
 * chemin de signalement.
 */
@Injectable({ providedIn: 'root' })
export class ReportRepository {
  private readonly http = inject(HttpClient);

  async getMotifs(): Promise<CatalogueMotifs> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/reports/motifs'));
      const data = ((reponse as Record<string, unknown>)?.['data'] ?? {}) as Record<string, unknown>;
      const brut = Array.isArray(data['motifs']) ? (data['motifs'] as Record<string, unknown>[]) : [];
      return {
        motifs: brut.map(motifDepuisApi),
        slaHeures: typeof data['slaHeures'] === 'number' ? data['slaHeures'] : 72,
      };
    } catch (e) {
      throw enFailure(e);
    }
  }

  /** Les signalements de contenu envoyés par l'étudiant, du plus récent au plus ancien. */
  async mesSignalements(): Promise<MonSignalement[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/reports/me'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      return Array.isArray(data) ? (data as Record<string, unknown>[]).map(monSignalementDepuisApi) : [];
    } catch (e) {
      throw enFailure(e);
    }
  }

  async signaler(params: {
    cibleType: CibleSignalement;
    cibleId: string;
    motif: string;
    commentaire?: string;
  }): Promise<ResultatSignalement> {
    try {
      const corps: Record<string, unknown> = {
        cibleType: params.cibleType,
        cibleId: params.cibleId,
        motif: params.motif,
      };
      const commentaire = params.commentaire?.trim();
      if (commentaire) corps['commentaire'] = commentaire;

      const reponse = await firstValueFrom(this.http.post('/api/reports', corps));
      const data = ((reponse as Record<string, unknown>)?.['data'] ?? {}) as Record<string, unknown>;
      return {
        message: String(data['message'] ?? 'Signalement transmis.'),
        slaHeures: typeof data['slaHeures'] === 'number' ? data['slaHeures'] : 72,
      };
    } catch (e) {
      throw enFailure(e);
    }
  }

}
