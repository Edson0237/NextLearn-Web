import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationModel, notificationDepuisApi } from './notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsRepository {
  private readonly http = inject(HttpClient);

  async getNotifications(): Promise<NotificationModel[]> {
    const reponse = await firstValueFrom(this.http.get('/api/notifications', { params: { limit: '50' } }));
    const data = (reponse as Record<string, unknown>)?.['data'];
    const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
    return raw.map(notificationDepuisApi);
  }

  async getUnreadCount(): Promise<number> {
    const reponse = await firstValueFrom(this.http.get('/api/notifications/unread-count'));
    const data = (reponse as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined;
    return typeof data?.['count'] === 'number' ? data['count'] : 0;
  }

  async markAsRead(id: string): Promise<void> {
    await firstValueFrom(this.http.put(`/api/notifications/${id}/read`, {}));
  }

  async markAllAsRead(): Promise<void> {
    await firstValueFrom(this.http.put('/api/notifications/read-all', {}));
  }
}
