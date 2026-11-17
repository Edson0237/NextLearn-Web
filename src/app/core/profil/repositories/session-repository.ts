import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Appareil } from '../../auth/services/appareil';
import { enFailure } from '../../network';

export type TypeAppareilSession = 'mobile' | 'tablette' | 'ordinateur' | 'inconnu';

/** Un appareil connecté au compte. */
export interface SessionAppareil {
  readonly sessionId: string;
  readonly appareil: string;
  /** La session utilisée en ce moment même. */
  readonly courante: boolean;
  readonly navigateur?: string;
  readonly os?: string;
  readonly type?: TypeAppareilSession;
  readonly pays?: string;
  readonly ip?: string;
  readonly derniereActivite?: Date;
  readonly creeeLe?: Date;
  readonly expireLe?: Date;
}

function textePropre(valeur: unknown): string | undefined {
  if (typeof valeur !== 'string') return undefined;
  const t = valeur.trim();
  return t.length > 0 ? t : undefined;
}

function dateOptionnelle(valeur: unknown): Date | undefined {
  if (!valeur) return undefined;
  const d = new Date(String(valeur));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function sessionDepuisApi(json: Record<string, unknown>): SessionAppareil {
  const navigateur = textePropre(json['navigateur']);
  const os = textePropre(json['os']);
  const appareilBrut = textePropre(json['appareil']);
  const compose = [navigateur, os].filter(Boolean).join(' · ');
  const appareil = appareilBrut ?? (compose.length > 0 ? compose : 'Appareil inconnu');

  const typeBrut = json['type'];
  const type: TypeAppareilSession | undefined =
    typeBrut === 'mobile' || typeBrut === 'tablette' || typeBrut === 'ordinateur' || typeBrut === 'inconnu'
      ? typeBrut
      : undefined;

  return {
    sessionId: String(json['sessionId'] ?? ''),
    appareil,
    courante: json['courante'] === true,
    navigateur,
    os,
    type,
    pays: textePropre(json['pays']),
    ip: textePropre(json['ip']),
    derniereActivite: dateOptionnelle(json['derniereActiviteLe']),
    creeeLe: dateOptionnelle(json['creeeLe']),
    expireLe: dateOptionnelle(json['expireLe']),
  };
}

/**
 * Accès réseau aux sessions actives - traduction de
 * `SessionRemoteRepository` (`lib/domains/profil/infrastructure/repositories/session_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class SessionRepository {
  private readonly http = inject(HttpClient);
  private readonly appareil = inject(Appareil);

  /**
   * L'identifiant de cet appareil, pour que le serveur sache laquelle des
   * sessions listées est celle-ci. Envoyé sur ces seuls appels : un en-tête
   * non standard déclenche une vérification CORS préalable (voir
   * `auth.interceptor.ts`), inutile sur les autres routes.
   */
  private get entetes(): Record<string, string> {
    const id = this.appareil.identifiant();
    return id ? { 'X-Device-Id': id } : {};
  }

  async lister(): Promise<SessionAppareil[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/auth/sessions', { headers: this.entetes }));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(sessionDepuisApi);
    } catch (e) {
      throw enFailure(e);
    }
  }

  async revoquer(sessionId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`/api/auth/sessions/${sessionId}`));
    } catch (e) {
      throw enFailure(e);
    }
  }

  /** Déconnecte tous les autres appareils, en gardant celui-ci. */
  async revoquerLesAutres(): Promise<number> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/auth/sessions', { headers: this.entetes }));
      const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
      const fermees = data?.['fermees'];
      return typeof fermees === 'number' ? fermees : 0;
    } catch (e) {
      throw enFailure(e);
    }
  }

}
