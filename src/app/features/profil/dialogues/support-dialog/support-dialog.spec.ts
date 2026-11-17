import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TraductionService } from '../../../../core/i18n';
import { SupportRepository } from '../../../../core/profil';
import { ToastService } from '../../../../shared/ui/toast/toast';
import { Failure } from '../../../../core/models';
import { SupportDialog } from './support-dialog';

describe('SupportDialog', () => {
  const repo = { createTicket: vi.fn() };
  const toast = { succes: vi.fn(), erreur: vi.fn() };

  function creer() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupportRepository, useValue: repo },
        { provide: ToastService, useValue: toast },
      ],
    });
    return TestBed.createComponent(SupportDialog).componentInstance as any;
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nl_langue', 'fr');
    repo.createTicket.mockReset();
    toast.succes.mockReset();
    toast.erreur.mockReset();
  });

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

  it('met immédiatement à jour les catégories de signalement lors du changement de langue FR -> EN', async () => {
    const c = creer();
    const traductions = TestBed.inject(TraductionService);
    const httpMock = TestBed.inject(HttpTestingController);

    expect(c.categories().map((x: { label: string }) => x.label)).toEqual([
      'Connexion',
      'Document',
      'Compte',
      "Bug de l'application",
      'Autre',
    ]);

    const promesse = traductions.definir('en');
    httpMock.expectOne('/i18n/en.json').flush({
      supportCatConnexion: 'Signing in',
      supportCatDocument: 'Document',
      supportCatCompte: 'My account',
      supportCatBug: 'App bug',
      supportCatAutre: 'Other',
    });
    await promesse;

    expect(c.categories().map((x: { label: string }) => x.label)).toEqual([
      'Signing in',
      'Document',
      'My account',
      'App bug',
      'Other',
    ]);

    const retourFr = traductions.definir('fr');
    httpMock.expectOne('/i18n/fr.json').flush({});
    await retourFr;
    httpMock.verify();
    localStorage.clear();
  });
});
