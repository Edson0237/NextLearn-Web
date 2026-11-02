import { TestBed } from '@angular/core/testing';
import { NotificationsEtat } from '../services/notifications-etat';
import { NotificationsRepository } from '../repositories/notifications-repository';

/** La pastille suit l'état réel : ressource consultée, notification lue, tout lu, retour du réseau. */
describe('NotificationsEtat', () => {
  const repo = { getUnreadCount: vi.fn(), marquerRessourceLue: vi.fn() };
  let etat: NotificationsEtat;

  beforeEach(() => {
    repo.getUnreadCount.mockReset();
    repo.marquerRessourceLue.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: NotificationsRepository, useValue: repo }] });
    etat = TestBed.inject(NotificationsEtat);
  });

  it('consulter une ressource ramène la pastille au compte exact du serveur', async () => {
    repo.getUnreadCount.mockResolvedValue(3);
    await etat.rafraichir();
    expect(etat.nonLues()).toBe(3);
    repo.marquerRessourceLue.mockResolvedValue(2);
    await etat.marquerRessourceLue('document', 'd1');
    expect(etat.nonLues()).toBe(2);
    expect(repo.marquerRessourceLue).toHaveBeenCalledWith('document', 'd1');
  });

  it('prévient la liste des notifications seulement quand le compte a bougé', async () => {
    repo.getUnreadCount.mockResolvedValue(3);
    await etat.rafraichir();
    const v0 = etat.version();
    repo.marquerRessourceLue.mockResolvedValue(3); // aucune notification ne concernait cette ressource
    await etat.marquerRessourceLue('epreuve', 'e1');
    expect(etat.version()).toBe(v0);
    repo.marquerRessourceLue.mockResolvedValue(1);
    await etat.marquerRessourceLue('epreuve', 'e2');
    expect(etat.version()).toBe(v0 + 1);
  });

  it('un échec réseau ne casse rien et ne devine pas le compte', async () => {
    repo.getUnreadCount.mockResolvedValue(4);
    await etat.rafraichir();
    repo.marquerRessourceLue.mockRejectedValue(new Error('hors ligne'));
    await expect(etat.marquerRessourceLue('document', 'd1')).resolves.toBeUndefined();
    expect(etat.nonLues()).toBe(4);
  });

  it('une notification lue décrémente sans passer sous zéro, « tout lu » remet à zéro', async () => {
    repo.getUnreadCount.mockResolvedValue(1);
    await etat.rafraichir();
    etat.retirer();
    etat.retirer();
    expect(etat.nonLues()).toBe(0);
    etat.toutLu();
    expect(etat.nonLues()).toBe(0);
  });

  it('le retour du réseau resynchronise le compte', async () => {
    repo.getUnreadCount.mockResolvedValue(1);
    await etat.rafraichir();
    repo.getUnreadCount.mockResolvedValue(7);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(etat.nonLues()).toBe(7));
  });
});
