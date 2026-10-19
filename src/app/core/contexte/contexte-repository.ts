import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ContexteEtudiant, contexteEtudiantDepuisApi, CONTEXTE_OUVERT } from './contexte.model';

/**
 * Récupère le contexte étudiant (matières, types visibles, fonctionnalités).
 * Traduction de `ContexteRepository`
 * (`lib/domains/contexte/infrastructure/contexte_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class ContexteRepository {
  private readonly http = inject(HttpClient);

  async charger(): Promise<ContexteEtudiant> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/me/context'));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = payload['data'];
      if (!data || typeof data !== 'object' || Array.isArray(data)) return CONTEXTE_OUVERT;
      return contexteEtudiantDepuisApi(data as Record<string, unknown>);
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        // En cas d'erreur, on ouvre tout plutôt que de bloquer.
        return CONTEXTE_OUVERT;
      }
      return CONTEXTE_OUVERT;
    }
  }
}
