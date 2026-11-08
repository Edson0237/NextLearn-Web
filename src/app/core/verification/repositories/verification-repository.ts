import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { enFailure } from '../../network';
import { VerificationState, verificationDepuisJson } from '../../models/verification.model';

@Injectable({ providedIn: 'root' })
export class VerificationRepository {
  private readonly http = inject(HttpClient);

  async getMyStatus(): Promise<VerificationState> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/verification/requests/me'));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      return verificationDepuisJson(data ?? {});
    } catch (e) {
      throw enFailure(e);
    }
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
  }): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('nom', payload.nom);
    formData.append('prenom', payload.prenom);
    if (payload.matricule) formData.append('matricule', payload.matricule);
    formData.append('universite', payload.universite);
    formData.append('filiere', payload.filiere);
    formData.append('niveau', payload.niveau);
    formData.append('justificatifType', payload.justificatifType);
    let nomNettoye = payload.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const estPdf = payload.file.type === 'application/pdf' || nomNettoye.toLowerCase().endsWith('.pdf');
    if (estPdf && !nomNettoye.toLowerCase().endsWith('.pdf')) {
      nomNettoye += '.pdf';
    }
    formData.append('justificatif', payload.file, nomNettoye || 'justificatif.pdf');
    try {
      const reponse = await firstValueFrom(this.http.post('/api/verification/requests', formData));
      // Le dossier tel que le serveur vient de l'enregistrer.
      return ((reponse as Record<string, unknown> | null)?.['data'] ?? {}) as Record<string, unknown>;
    } catch (e) {
      throw enFailure(e);
    }
  }
}
