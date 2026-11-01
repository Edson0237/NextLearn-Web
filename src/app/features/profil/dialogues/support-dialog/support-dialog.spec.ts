import { TestBed } from '@angular/core/testing';
import { SupportRepository } from '../../../../core/profil/support-repository';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { Failure } from '../../../../core/models';
import { SupportDialog } from './support-dialog';

describe('SupportDialog', () => {
  const repo = { createTicket: vi.fn() };
  const toast = { succes: vi.fn(), erreur: vi.fn() };

  function creer() {
    TestBed.configureTestingModule({
      providers: [{ provide: SupportRepository, useValue: repo }, { provide: ToastService, useValue: toast }],
    });
    return TestBed.createComponent(SupportDialog).componentInstance as any;
  }

  beforeEach(() => { repo.createTicket.mockReset(); toast.succes.mockReset(); toast.erreur.mockReset(); });

  it('n’envoie rien tant que le sujet ou le message manque', () => {
    const c = creer();
    expect(c.peutEnvoyer()).toBe(false);
    c.sujet.set('Connexion'); c.message.set('  ');
    expect(c.peutEnvoyer()).toBe(false);
    c.message.set('Je ne peux pas me connecter');
    expect(c.peutEnvoyer()).toBe(true);
  });

  it('envoie le ticket, ferme la fenêtre et confirme', async () => {
    repo.createTicket.mockResolvedValue(undefined);
    const c = creer();
    c.categorie.set('BUG'); c.sujet.set(' Page vide '); c.message.set(' Elle reste blanche ');
    let ferme = false;
    c.ferme.subscribe(() => (ferme = true));
    await c.envoyer();
    expect(repo.createTicket).toHaveBeenCalledWith('BUG', 'Page vide', 'Elle reste blanche');
    expect(ferme).toBe(true);
    expect(toast.succes).toHaveBeenCalled();
  });

  it('garde la fenêtre ouverte et dit pourquoi quand l’envoi échoue', async () => {
    repo.createTicket.mockRejectedValue(new Failure('Le serveur met du temps à répondre.'));
    const c = creer();
    c.sujet.set('a'); c.message.set('b');
    let ferme = false;
    c.ferme.subscribe(() => (ferme = true));
    await c.envoyer();
    expect(ferme).toBe(false);
    expect(toast.erreur).toHaveBeenCalledWith('Le serveur met du temps à répondre.');
    expect(c.envoi()).toBe(false);
  });
});
