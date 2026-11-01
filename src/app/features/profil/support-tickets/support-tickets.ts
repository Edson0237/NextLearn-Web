import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { Location } from '@angular/common';
import { Icon } from '../../../shared/ui/icon/icon';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { ToastService } from '../../../shared/ui/toast/toast';
import { SupportRepository, SupportTicket, SupportTicketStatus, libelleStatutTicket } from '../../../core/profil';
import { ReportRepository } from '../../../core/moderation';
import { CibleSignalement, MonSignalement, StatutSignalement } from '../../../core/moderation';
import { tr } from '../../../core/i18n';
import { Failure } from '../../../core/models';

/**
 * Historique des tickets support - traduction de `SupportTicketsPage`
 * (`lib/domains/profil/presentation/pages/support_tickets/support_tickets_page.dart`).
 */
@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: [TraductionPipe, Icon, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support-tickets.html',
  styleUrl: './support-tickets.scss',
})
export class SupportTickets implements OnInit {
  private readonly location = inject(Location);
  private readonly repo = inject(SupportRepository);
  private readonly toast = inject(ToastService);
  private readonly reports = inject(ReportRepository);

  protected readonly tickets = signal<SupportTicket[]>([]);
  protected readonly signalements = signal<MonSignalement[]>([]);
  protected readonly CibleSignalement = CibleSignalement;
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
      const [tickets, signalements] = await Promise.all([
        this.repo.listMyTickets(),
        // Un échec de cette liste ne doit pas cacher les tickets.
        this.reports.mesSignalements().catch(() => [] as MonSignalement[]),
      ]);
      this.tickets.set(tickets);
      this.signalements.set(signalements);
    } catch (e) {
      this.erreur.set(e instanceof Failure ? e.message : 'Chargement impossible.');
    } finally {
      this.chargement.set(false);
    }
  }

  protected couleurStatut(status: SupportTicketStatus): string {
    switch (status) {
      case SupportTicketStatus.resolved: return '--tertiary';
      case SupportTicketStatus.inProgress: return '--warning';
      default: return '--primary';
    }
  }

  /** « Ouvert » laissait croire qu'un modérateur l'avait déjà ouvert : on dit où en est le dossier. */
  protected libelleSignalement(s: StatutSignalement): string {
    switch (s) {
      case StatutSignalement.enExamen: return tr('signalementStatutExamen', 'En cours d’examen');
      case StatutSignalement.retenu: return tr('signalementStatutRetenu', 'Retenu : contenu retiré');
      case StatutSignalement.rejete: return tr('signalementStatutRejete', 'Non retenu');
      default: return tr('signalementStatutAttente', 'En attente');
    }
  }

  protected couleurSignalement(s: StatutSignalement): string {
    switch (s) {
      case StatutSignalement.retenu: return '--tertiary';
      case StatutSignalement.enExamen: return '--warning';
      case StatutSignalement.rejete: return '--text-muted';
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
