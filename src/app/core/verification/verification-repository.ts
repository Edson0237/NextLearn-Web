import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { JustificatifType, VerificationState, justificatifTypeDepuisApi, verificationStateDepuisApi } from './verification.model';

@Injectable({ providedIn: 'root' })
export class VerificationRepository {
  private readonly http = inject(HttpClient);

  async getJustificatifTypes(): Promise<JustificatifType[]> {
    const reponse = await firstValueFrom(this.http.get('/api/references/justificatif-types'));
    const data = (reponse as Record<string, unknown>)?.['data'];
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(justificatifTypeDepuisApi);
  }

  async getMyStatus(): Promise<VerificationState> {
    const reponse = await firstValueFrom(this.http.get('/api/verification/requests/me'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    return verificationStateDepuisApi(data ?? {});
  }

  async submit(payload: {
    nom: string;
    prenom: string;
    matricule?: string;
    universite: string;
    filiere: string;
    niveau: string;
    justificatifType: string;
    file: File;
  }): Promise<void> {
    const formData = new FormData();
    formData.append('nom', payload.nom);
    formData.append('prenom', payload.prenom);
    if (payload.matricule) formData.append('matricule', payload.matricule);
    formData.append('universite', payload.universite);
    formData.append('filiere', payload.filiere);
    formData.append('niveau', payload.niveau);
    formData.append('justificatifType', payload.justificatifType);
    formData.append('justificatif', payload.file, payload.file.name);
    await firstValueFrom(this.http.post('/api/verification/requests', formData));
  }
}
