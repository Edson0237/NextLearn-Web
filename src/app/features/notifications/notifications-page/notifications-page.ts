import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { NotificationsRepository } from '../../../core/notifications/notifications-repository';
import { NotificationsEtat } from '../../../core/notifications/notifications-etat';
import { NotificationModel, routeDeNotification } from '../../../core/notifications/notification.model';
import { AppRoutes } from '../../../core/router/app-routes';

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

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notifications = signal<NotificationModel[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await this.notifRepo.getNotifications();
      this.notifications.set(list);
      // Resynchronise la pastille : la liste vient d'arriver, autant que le
      // compte de la cloche soit celui du serveur et non un chiffre ancien.
      void this.etat.rafraichir();
    } catch (e) {
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
