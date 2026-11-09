import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { TraductionPipe, tr } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { NotificationsRepository } from '../../../core/notifications';
import { NotificationsEtat } from '../../../core/notifications';
import { categorieDeNotification, NotificationModel, routeDeNotification } from '../../../core/notifications';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { AppRoutes } from '../../../core/router';

import { ToastService } from '../../../shared/ui/toast/toast';

@Component({
  selector: 'nl-notifications-page',
  standalone: true,
  imports: [CascadeEnter, TraductionPipe, CommonModule, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly notifRepo = inject(NotificationsRepository);
  private readonly etat = inject(NotificationsEtat);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notifications = signal<NotificationModel[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  constructor() {
    // Une ressource consultée ailleurs a pu marquer des notifications comme lues : la liste suit.
    let premier = true;
    effect(() => {
      this.etat.version();
      untracked(() => {
        if (premier) { premier = false; return; }
        void this.load(true);
      });
    });
  }

  async load(silencieux = false): Promise<void> {
    if (!silencieux) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const list = await this.notifRepo.getNotifications();
      this.notifications.set(list);
      // Resynchronise la pastille : la liste vient d'arriver, autant que le
      // compte de la cloche soit celui du serveur et non un chiffre ancien.
      void this.etat.rafraichir();
    } catch (e) {
      if (silencieux) return;
      this.error.set('Impossible de charger les notifications.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/app', AppRoutes.home]);
  }

  protected async markAllAsRead(): Promise<void> {
    try {
      await this.notifRepo.markAllAsRead();
      this.notifications.set(this.notifications().map((n) => ({ ...n, lu: true })));
      this.etat.toutLu();
    } catch {
      // Silencieux.
    }
  }

  protected async supprimerNotification(n: NotificationModel, event?: Event): Promise<void> {
    event?.stopPropagation();
    try {
      await this.notifRepo.deleteNotification(n.id);
      this.notifications.update((list) => list.filter((item) => item.id !== n.id));
      if (!n.lu) {
        this.etat.retirer();
      }
      this.toast.succes('Notification supprimée');
    } catch {
      this.toast.erreur('Impossible de supprimer la notification');
    }
  }

  protected async open(n: NotificationModel): Promise<void> {
    if (!n.lu) {
      try {
        await this.notifRepo.markAsRead(n.id);
        this.notifications.set(this.notifications().map((x) => x.id === n.id ? { ...x, lu: true } : x));
        this.etat.retirer();
      } catch {
        // Silencieux.
      }
    }
    // La destination vit dans `metadata`, pas dans un champ `cibleRoute` que
    // le serveur n'a jamais envoyé - et elle est relative à `/app`, comme
    // toute route de cette application.
    const route = routeDeNotification(n);
    if (route) {
      void this.router.navigateByUrl(`/app/${route}`);
      return;
    }
    // Une campagne peut mener vers un lien externe : seuls http(s) sont ouverts.
    const lien = n.metadata['url'];
    if (typeof lien === 'string' && /^https?:\/\//.test(lien)) {
      window.open(lien, '_blank', 'noopener');
    }
  }

  protected iconeDe(n: NotificationModel): IconName {
    switch (categorieDeNotification(n)) {
      case 'document': return 'description';
      case 'decision': return 'gavel';
      case 'support': return 'support_agent';
      default: return 'notifications';
    }
  }

  protected libelleCategorie(n: NotificationModel): string {
    switch (categorieDeNotification(n)) {
      case 'document': return tr('notifsCatDocument', 'Nouveau document');
      case 'decision': return tr('notifsCatDecision', 'Décision');
      case 'support': return tr('notifsCatSupport', 'Support');
      default: return tr('notifsCatInfo', 'Information');
    }
  }

  /** « Aujourd'hui, 14:30 », « Hier », « 12 oct. » : la date réelle, pas seulement une tranche. */
  protected quand(dateStr: string): string {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const maintenant = new Date();
    const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    const heure = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (d >= debutJour) return `${tr('notifsAujourdhui', 'Aujourd’hui')}, ${heure}`;
    if (d >= new Date(debutJour.getTime() - 24 * 60 * 60 * 1000)) return `${tr('notifsHier', 'Hier')}, ${heure}`;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === maintenant.getFullYear() ? undefined : 'numeric' });
  }

  protected groupTitle(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (d >= startOfDay) return 'Aujourd\'hui';
    const startOfWeek = new Date(startOfDay.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (d >= startOfWeek) return 'Cette semaine';
    return 'Plus ancien';
  }
}
