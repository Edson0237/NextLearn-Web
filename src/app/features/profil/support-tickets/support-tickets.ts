import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Icon } from '../../../shared/ui/icon/icon';
import { ToastService } from '../../../shared/ui/toast/toast';
import { SupportRepository, SupportTicket, SupportTicketStatus, libelleStatutTicket } from '../../../core/profil/support-repository';
import { Failure } from '../../../core/models/failure.model';

/**
 * Historique des tickets support — traduction de `SupportTicketsPage`
 * (`lib/domains/profil/presentation/pages/support_tickets/support_tickets_page.dart`).
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-tickets.html',
  styleUrl: './support-tickets.scss',
})
export class SupportTickets implements OnInit {
  private readonly location = inject(Location);
  private readonly repo = inject(SupportRepository);
  private readonly toast = inject(ToastService);

  protected readonly tickets = signal<SupportTicket[]>([]);
  protected readonly chargement = signal(false);
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly statusLibelle = libelleStatutTicket;

  ngOnInit(): void {
    void this.charger();
  }

  protected async charger(): Promise<void> {
    this.chargement.set(true);
    this.erreur.set(undefined);
    try {
      this.tickets.set(await this.repo.listMyTickets());
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Chargement impossible.');
    } finally {
      this.chargement.set(false);
    }
  }

  protected couleurStatut(status: SupportTicketStatus): string {
    switch (status) {
      case SupportTicketStatus.resolved: return '--success';
      case SupportTicketStatus.inProgress: return '--warning';
      default: return '--primary';
    }
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(date);
  }

  protected retour(): void {
    this.location.back();
  }
}
