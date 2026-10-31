import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import {
  FiliereOption, JustificatifType, MatiereOption, OptionReference, TypeContenuOption, Universite,
  filiereDepuisJson, justificatifTypeDepuisJson, matiereDepuisJson, optionDepuisJson,
  typeContenuDepuisJson, universiteDepuisJson,
} from './references.model';

/**
 * Accès réseau aux référentiels — traduction de `ReferencesRemoteRepository`
 * (`lib/domains/references/infrastructure/repositories/`), pour la part qui
 * sert les formulaires (Phase 4) : inscription, dépôt, vérification.
 *
 * **Non repris** : le repli sur le cache Hive quand le réseau manque. Ces
 * listes servent des formulaires qu'on ne peut de toute façon pas valider
 * hors ligne (inscription, dépôt, vérification exigent tous une requête
 * serveur pour aboutir) — un repli hors ligne n'y change rien, seul
 * l'affichage du bouton « Réessayer » compte, et il existe déjà.
 */
@Injectable({ providedIn: 'root' })
export class ReferencesRepository {
  private readonly http = inject(HttpClient);

  getUniversites(): Promise<Universite[]> {
    return this.liste('/api/references/universites', universiteDepuisJson);
  }

  getFilieres(filtres: { universiteId?: string; cycle?: string; levelId?: string } = {}): Promise<FiliereOption[]> {
    return this.liste('/api/references/filieres', filiereDepuisJson, {
      ...(filtres.universiteId ? { universiteId: filtres.universiteId } : {}),
      ...(filtres.cycle ? { cycle: filtres.cycle } : {}),
      ...(filtres.levelId ? { levelId: filtres.levelId } : {}),
    });
  }

  getCycles(universiteId?: string): Promise<OptionReference[]> {
    return this.liste('/api/references/cycles', optionDepuisJson, universiteId ? { universiteId } : {});
  }

  getNiveaux(filtres: { cycleId?: string; filiereId?: string } = {}): Promise<OptionReference[]> {
    return this.liste('/api/references/niveaux', optionDepuisJson, {
      ...(filtres.cycleId ? { cycleId: filtres.cycleId } : {}),
      ...(filtres.filiereId ? { filiereId: filtres.filiereId } : {}),
    });
  }

  getMatieres(filtres: { filiereId?: string; niveau?: string } = {}): Promise<MatiereOption[]> {
    return this.liste('/api/references/matieres', matiereDepuisJson, {
      ...(filtres.filiereId ? { filiereId: filtres.filiereId } : {}),
      ...(filtres.niveau ? { niveau: filtres.niveau } : {}),
    });
  }

  getSemestres(universiteId?: string): Promise<OptionReference[]> {
    return this.liste('/api/references/semestres', optionDepuisJson, universiteId ? { universiteId } : {});
  }

  getTypesContenu(): Promise<TypeContenuOption[]> {
    return this.liste('/api/references/document-types', typeContenuDepuisJson);
  }

  /** Taille maximale et formats acceptés pour un fichier envoyé, tels que le serveur les règle. */
  async getLimitesFichier(): Promise<{ maxFileSizeMb: number; formats: readonly string[] }> {
    const reponse = await firstValueFrom(this.http.get('/api/references/limites-fichier'));
    const data = ((reponse as Record<string, unknown>)?.['data'] ?? {}) as Record<string, unknown>;
    const taille = Number(data['maxFileSizeMb']);
    return {
      maxFileSizeMb: Number.isFinite(taille) && taille > 0 ? taille : 50,
      formats: Array.isArray(data['formats']) ? (data['formats'] as unknown[]).map(String) : ['pdf'],
    };
  }

  getJustificatifTypes(): Promise<JustificatifType[]> {
    return this.liste('/api/references/justificatif-types', justificatifTypeDepuisJson);
  }

  private async liste<T>(
    chemin: string,
    depuisJson: (j: Record<string, unknown>) => T,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    try {
      const reponse = await firstValueFrom(this.http.get(chemin, { params }));
      const enveloppe = reponse as Record<string, unknown>;
      const brut = Array.isArray(enveloppe?.['data']) ? (enveloppe['data'] as unknown[]) : [];
      return brut.map((e) => depuisJson(e as Record<string, unknown>));
    } catch (e) {
      if (e instanceof HttpErrorResponse) throw Failure.depuisErreurHttp(e, !isDevMode());
      throw new Failure('Une erreur est survenue.');
    }
  }
}
