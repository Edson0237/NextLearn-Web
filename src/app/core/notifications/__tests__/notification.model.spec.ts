import { categorieDeNotification, notificationDepuisApi, routeDeNotification } from '../models/notification.model';

const notif = (type: string, metadata: Record<string, unknown> = {}) =>
  notificationDepuisApi({ _id: 'n1', userId: 'u1', titre: 't', corps: 'c', type, lu: false, createdAt: '2026-11-02T10:00:00Z', metadata });

describe('notifications : catégorie et destination', () => {
  it('distingue un nouveau document, une décision et une réponse du support', () => {
    expect(categorieDeNotification(notif('NOUVEAU_COURS', { documentId: 'd1' }))).toBe('document');
    expect(categorieDeNotification(notif('EPREUVE', { epreuveId: 'e1' }))).toBe('document');
    expect(categorieDeNotification(notif('INFO', { categorie: 'decision', route: 'recours' }))).toBe('decision');
    expect(categorieDeNotification(notif('SUPPORT', { route: 'support/tickets' }))).toBe('support');
  });

  it('un type inconnu reste une simple information', () => {
    expect(categorieDeNotification(notif('MAINTENANCE'))).toBe('info');
  });

  it('mène à la ressource concernée', () => {
    expect(routeDeNotification(notif('NOUVEAU_COURS', { documentId: 'd1' }))).toBe('bibliotheque/doc/d1');
    expect(routeDeNotification(notif('SUPPORT', { route: '/support/tickets', ticketId: 't1' }))).toBe('support/tickets');
    expect(routeDeNotification(notif('INFO'))).toBeNull();
  });
});
