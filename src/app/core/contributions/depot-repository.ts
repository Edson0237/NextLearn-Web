import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';
import { TypeContenuOption, typeContenuDepuisJson } from '../references/references.model';
import { Depot, DepotLicence, depotDepuisJson } from './depot.model';

/**
 * Accès réseau aux dépôts — traduction de `DepotRemoteRepository`
 * (`lib/domains/contributions/infrastructure/repositories/depot_remote_repository.dart`).
 *
 * Le fichier part en `multipart` (`FormData`), pas en base64 dans du JSON
 * — ce dernier gonflerait son poids d'un tiers, sur un PDF qui pèse
 * parfois plusieurs mégaoctets.
 *
 * École, filière et niveau ne sont **jamais** envoyés à `deposer()` : le
 * serveur les relit dans le compte au moment du dépôt. Les transmettre
 * d'ici serait redondant au mieux, faux au pire.
 */
@Injectable({ providedIn: 'root' })
export class DepotRepository {
  private readonly http = inject(HttpClient);

  async getTypes(): Promise<TypeContenuOption[]> {
    const types = await this.liste<TypeContenuOption>('/api/references/document-types', typeContenuDepuisJson);
    // Les épreuves ont leur propre collection et leur propre circuit : les
    // proposer ici enverrait le dépôt vers la mauvaise ressource.
    return types.filter((t) => t.collection === 'documents');
  }

  async mesDepots(): Promise<Depot[]> {
    return this.liste('/api/documents/submissions/me', depotDepuisJson);
  }

  async deposer(infos: {
    titre: string; description: string; type: string; matiereId: string; anneeAcademique: string;
    licence: DepotLicence; sourceDeclaree?: string; auteur?: string; fichier: File;
  }): Promise<void> {
    const formData = new FormData();
    formData.set('titre', infos.titre);
    formData.set('description', infos.description);
    formData.set('type', infos.type);
    formData.set('matiereId', infos.matiereId);
    formData.set('anneeAcademique', infos.anneeAcademique);
    formData.set('licence', infos.licence);
    if (infos.sourceDeclaree) formData.set('sourceDeclaree', infos.sourceDeclaree);
    // L'auteur du document, qui n'est pas forcément celui qui le dépose :
    // on apporte le plus souvent le cours de quelqu'un d'autre.
    if (infos.auteur) formData.set('auteur', infos.auteur);
    // Nom de champ exact attendu par multer côté serveur
    // (`upload.single('file')`) : un autre nom produit un 400 sans fichier
    // reçu, sans dire que c'est le nom qui est en cause.
    formData.set('file', infos.fichier, infos.fichier.name);

    try {
      await firstValueFrom(this.http.post('/api/documents/submissions', formData));
    } catch (e) {
      throw this.echec(e);
    }
  }

  private async liste<T>(chemin: string, depuisJson: (j: Record<string, unknown>) => T): Promise<T[]> {
    try {
      const reponse = await firstValueFrom(this.http.get(chemin));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const brut = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return brut.map(depuisJson);
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
