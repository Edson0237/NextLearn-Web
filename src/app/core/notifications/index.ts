// API publique de core/notifications : seulement ce que le reste de l'application consomme.

export { categorieDeNotification, notificationDepuisApi, routeDeNotification } from './models/notification.model';
export type { CategorieNotification, NotificationModel } from './models/notification.model';
export { NotificationsRepository } from './repositories/notifications-repository';
export { NotificationsEtat } from './services/notifications-etat';
export { PreferenceNotifications } from './services/preference-notifications';
