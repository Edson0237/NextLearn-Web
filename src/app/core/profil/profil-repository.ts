import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ProfilStats, profilStatsDepuisApi, SuppressionRapport, suppressionRapportDepuisApi } from './profil.model';
import { enFailure } from '../network/erreur-api';
import { donnees, donneesUtilisateur } from '../network/enveloppe-api';
import { SecureStorageService } from '../storage/secure-storage.service';
import { NiveauxDuCycle, niveauxDuCycleDepuisApi, UserModel, utilisateurDepuisApi } from '../models';

/**
 * Accès réseau au profil - traduction de
 * `ProfilRemoteRepository` (`lib/domains/profil/infrastructure/repositories/profil_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class ProfilRepository {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(SecureStorageService);

  async getStats(): Promise<ProfilStats> {
    try {
      const [reponseProfil, reponseStreak] = await Promise.all([
        firstValueFrom(this.http.get('/api/profile')),
        firstValueFrom(this.http.get('/api/progression/stats')),
      ]);
      const payload = (reponseProfil as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? {};
      const stats = (data['stats'] as Record<string, unknown>) ?? {};
      const base = profilStatsDepuisApi(stats);

      const progressionPayload = (reponseStreak as Record<string, unknown>) ?? {};
      const progressionData = (progressionPayload['data'] as Record<string, unknown>) ?? {};
      const streak = typeof progressionData['streak'] === 'number'
        ? Math.round(progressionData['streak'])
        : base.streak;

      return { ...base, streak };
    } catch (e) {
      throw enFailure(e);
    }
  }

  /** Ce que la suppression exige : le PIN du compte, ou la recopie d'un mot. */
  async infosSuppression(): Promise<{ pinRequis: boolean; motConfirmation: string }> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/users/me/suppression'));
      const data = ((reponse as Record<string, unknown>)?.['data'] ?? {}) as Record<string, unknown>;
      return {
        pinRequis: data['pinRequis'] === true,
        motConfirmation: typeof data['motConfirmation'] === 'string' ? data['motConfirmation'] : 'SUPPRIMER',
      };
    } catch (e) {
      throw enFailure(e);
    }
  }

  async deleteAccount(confirmation: { pin?: string; confirmation?: string }): Promise<SuppressionRapport> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/users/me', { body: confirmation }));
      const payload = (reponse as Record<string, unknown>) ?? {};
      const data = (payload['data'] as Record<string, unknown>) ?? {};
      const rapport = (data['rapport'] as Record<string, unknown>) ?? {};
      return suppressionRapportDepuisApi(rapport);
    } catch (e) {
      throw enFailure(e);
    }
  }

  // ── Le profil de l'étudiant connecté : niveau et photo ─────────────────────

  /** Les niveaux entre lesquels ce compte peut changer. */
  async niveauxDuCycle(): Promise<NiveauxDuCycle> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/me/levels'));
      return niveauxDuCycleDepuisApi(donnees(reponse));
    } catch {
      return { niveaux: [] };
    }
  }

  /** Dépose une photo de profil. */
  async televerserAvatar(fichier: File): Promise<UserModel> {
    const formulaire = new FormData();
    formulaire.append('avatar', fichier, fichier.name);
    try {
      const reponse = await firstValueFrom(this.http.post('/api/profile/avatar', formulaire));
      const utilisateur = utilisateurDepuisApi(donneesUtilisateur(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw enFailure(e);
    }
  }

  /** Retire la photo de profil. */
  async supprimerAvatar(): Promise<UserModel> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/profile/avatar'));
      const utilisateur = utilisateurDepuisApi(donneesUtilisateur(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw enFailure(e);
    }
  }

  async changerNiveau(code: string): Promise<UserModel> {
    try {
      const reponse = await firstValueFrom(this.http.put('/api/profile', { niveau: code }));
      const utilisateur = utilisateurDepuisApi(donneesUtilisateur(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw enFailure(e);
    }
  }
}
