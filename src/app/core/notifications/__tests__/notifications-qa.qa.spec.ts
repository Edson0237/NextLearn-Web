import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationsEtat } from '../services/notifications-etat';
import { NotificationsRepository } from '../repositories/notifications-repository';

describe('QA Notifications PWA — Compteur et Résilience (NL-NOTIF-005..009)', () => {
  let etat: NotificationsEtat;
  let repoMock: {
    getUnreadCount: ReturnType<typeof vi.fn>;
    marquerRessourceLue: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    repoMock = {
      getUnreadCount: vi.fn().mockResolvedValue(4),
      marquerRessourceLue: vi.fn().mockResolvedValue(2),
    };
    TestBed.configureTestingModule({
      providers: [
        NotificationsEtat,
        { provide: NotificationsRepository, useValue: repoMock },
      ],
    });
    etat = TestBed.inject(NotificationsEtat);
  });

  it('NL-NOTIF-005 : décrémente le compteur dès qu’une notification ou ressource est lue et remet à zéro sur toutLu', async () => {
    await etat.rafraichir();
    expect(etat.nonLues()).toBe(4);

    await etat.marquerRessourceLue('document', 'doc-1');
    expect(etat.nonLues()).toBe(2);
    expect(etat.version()).toBe(1);

    etat.retirer(1);
    expect(etat.nonLues()).toBe(1);

    etat.toutLu();
    expect(etat.nonLues()).toBe(0);
  });

  it('NL-NOTIF-009 : conserve silencieusement le dernier compteur connu si le serveur ou le réseau est indisponible', async () => {
    await etat.rafraichir();
    expect(etat.nonLues()).toBe(4);

    repoMock.getUnreadCount.mockRejectedValueOnce(new Error('Offline'));
    await expect(etat.rafraichir()).resolves.toBeUndefined();
    expect(etat.nonLues()).toBe(4);
  });
});
