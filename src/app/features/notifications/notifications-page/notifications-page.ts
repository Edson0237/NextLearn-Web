import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { NotificationsRepository } from '../../../core/notifications/notifications-repository';
import { NotificationModel } from '../../../core/notifications/notification.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-notifications-page',
  standalone: true,
  imports: [CommonModule, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly router = inject(Router);
  private readonly notifRepo = inject(NotificationsRepository);

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
    } catch (e) {
      this.error.set('Impossible de charger les notifications.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.home]);
  }

  protected async markAllAsRead(): Promise<void> {
    try {
      await this.notifRepo.markAllAsRead();
      this.notifications.set(this.notifications().map((n) => ({ ...n, lu: true })));
    } catch {
      // Silencieux.
    }
  }

  protected async open(n: NotificationModel): Promise<void> {
    if (!n.lu) {
      try {
        await this.notifRepo.markAsRead(n.id);
        this.notifications.set(this.notifications().map((x) => x.id === n.id ? { ...x, lu: true } : x));
      } catch {
        // Silencieux.
      }
    }
    if (n.cibleRoute) {
      void this.router.navigateByUrl(n.cibleRoute);
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
