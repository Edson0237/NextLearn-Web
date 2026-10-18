import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Failure } from '../models/failure.model';

export enum SupportTicketStatus {
  open = 'open',
  inProgress = 'inProgress',
  resolved = 'resolved',
}

export function statutTicketDepuisApi(s: string | null | undefined): SupportTicketStatus {
  switch (s) {
    case 'in_progress':
      return SupportTicketStatus.inProgress;
    case 'resolved':
      return SupportTicketStatus.resolved;
    default:
      return SupportTicketStatus.open;
  }
}

export function libelleStatutTicket(status: SupportTicketStatus): string {
  switch (status) {
    case SupportTicketStatus.open:
      return 'Ouvert';
    case SupportTicketStatus.inProgress:
      return 'En cours';
    case SupportTicketStatus.resolved:
      return 'Résolu';
  }
}

export interface SupportTicket {
  readonly id: string;
  readonly categorie: string;
  readonly sujet: string;
  readonly message: string;
  readonly status: SupportTicketStatus;
  readonly reponseAdmin?: string;
  readonly resolvedAt?: Date;
  readonly createdAt: Date;
}

export function ticketDepuisApi(json: Record<string, unknown>): SupportTicket {
  return {
    id: String(json['_id'] ?? json['id'] ?? ''),
    categorie: String(json['categorie'] ?? 'AUTRE'),
    sujet: String(json['sujet'] ?? ''),
    message: String(json['message'] ?? ''),
    status: statutTicketDepuisApi(json['status'] as string | undefined),
    reponseAdmin: json['reponseAdmin'] == null ? undefined : String(json['reponseAdmin']),
    resolvedAt: json['resolvedAt'] ? new Date(String(json['resolvedAt'])) : undefined,
    createdAt: new Date(String(json['createdAt'] ?? Date.now())),
  };
}

/**
 * Signalements et tickets support — traduction de
 * `SupportRemoteRepository` (`lib/domains/profil/infrastructure/repositories/support_remote_repository.dart`).
 */
@Injectable({ providedIn: 'root' })
export class SupportRepository {
  private readonly http = inject(HttpClient);

  async createTicket(categorie: string, sujet: string, message: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/support/tickets', { categorie, sujet, message }));
    } catch (e) {
      throw this.echec(e);
    }
  }

  async listMyTickets(): Promise<SupportTicket[]> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/support/tickets'));
      const data = (reponse as Record<string, unknown>)?.['data'];
      const liste = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
      return liste.map(ticketDepuisApi);
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }
}
