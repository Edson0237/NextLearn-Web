import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { enFailure } from '../../network';
import { donnees } from '../../network/utils/enveloppe-api';

export type MethodePreuve = 'ancienne_adresse' | 'google' | 'ancienne_inaccessible';
export type EtatDemande = 'preuve' | 'nouvelle' | 'revue_admin' | 'justificatifs' | 'termine' | 'refuse' | 'expire' | 'annule';

export interface DemandeEmail {
  readonly id: string;
  readonly etat: EtatDemande;
  readonly methode: MethodePreuve;
  /** La nouvelle adresse, masquée par le serveur. */
  readonly nouvelEmail: string;
  readonly prochaineEtape: 'preuve' | 'nouvelle' | 'attente_admin' | 'justificatifs' | 'termine';
  readonly tentativesRestantes?: number;
  readonly messageAdmin?: string;
  /** Vrai à la fin d'une confirmation qui a changé l'adresse. */
  readonly termine?: boolean;
}

export interface StatutEmail {
  readonly email: string;
  readonly verifie: boolean;
  readonly methodes: { readonly ancienneAdresse: boolean; readonly google: boolean; readonly ancienneInaccessible: boolean };
  readonly demande: DemandeEmail | null;
}

/**
 * Le changement d'adresse e-mail, côté réseau.
 *
 * Rien n'est gardé sur l'appareil : ni code, ni état de la vérification. Le
 * serveur est la seule mémoire de la demande, ce qui permet de la reprendre
 * après une fermeture de l'application - et ces réponses ne doivent jamais se
 * retrouver dans un cache (voir `ngsw-config.json`, qui ne les liste pas).
 */
@Injectable({ providedIn: 'root' })
export class ChangementEmailRepository {
  private readonly http = inject(HttpClient);

  statut(): Promise<StatutEmail> {
    return this.appeler(() => this.http.get('/api/account/email'));
  }

  demarrer(nouvelEmail: string, methode: MethodePreuve): Promise<DemandeEmail> {
    return this.appeler(() => this.http.post('/api/account/email/demarrer', { nouvelEmail, methode }));
  }

  verifierPreuve(demandeId: string, code: string): Promise<DemandeEmail> {
    return this.appeler(() => this.http.post('/api/account/email/preuve', { demandeId, code }));
  }

  verifierPreuveGoogle(demandeId: string, idToken: string): Promise<DemandeEmail> {
    return this.appeler(() => this.http.post('/api/account/email/preuve-google', { demandeId, idToken }));
  }

  renvoyer(demandeId: string): Promise<DemandeEmail> {
    return this.appeler(() => this.http.post('/api/account/email/renvoyer', { demandeId }));
  }

  confirmer(demandeId: string, code: string): Promise<DemandeEmail> {
    return this.appeler(() => this.http.post('/api/account/email/confirmer', { demandeId, code }));
  }

  async annuler(demandeId: string): Promise<void> {
    await this.appeler(() => this.http.post('/api/account/email/annuler', { demandeId }));
  }

  private async appeler<T>(requete: () => import('rxjs').Observable<unknown>): Promise<T> {
    try {
      return donnees(await firstValueFrom(requete())) as unknown as T;
    } catch (e) {
      throw enFailure(e);
    }
  }
}
