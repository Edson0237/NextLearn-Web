import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService, GoogleIdentite } from '../../../core/auth';
import { Failure } from '../../../core/models';
import { ChangementEmailRepository, DemandeEmail, StatutEmail } from '../../../core/profil';
import { ToastService } from '../../../shared/ui/toast/toast';
import { ChangerEmail } from './changer-email';

const statut = (demande: DemandeEmail | null = null, email = 'camille@isj.cm'): StatutEmail => ({
  email, verifie: true, methodes: { ancienneAdresse: true, google: false, ancienneInaccessible: true }, demande,
});
const demande = (prochaineEtape: DemandeEmail['prochaineEtape'], extra: Partial<DemandeEmail> = {}): DemandeEmail => ({
  id: 'd1', etat: 'preuve', methode: 'ancienne_adresse', nouvelEmail: 'ca****@yahoo.fr', prochaineEtape, ...extra,
});

describe('ChangerEmail', () => {
  const repo = {
    statut: vi.fn(), demarrer: vi.fn(), verifierPreuve: vi.fn(), verifierPreuveGoogle: vi.fn(),
    renvoyer: vi.fn(), confirmer: vi.fn(), annuler: vi.fn(),
  };
  const auth = { majEmail: vi.fn() };

  async function creer() {
    TestBed.configureTestingModule({
      providers: [
        { provide: ChangementEmailRepository, useValue: repo },
        { provide: AuthService, useValue: auth },
        { provide: GoogleIdentite, useValue: { desactive: signal(false), preparer: async () => false } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ToastService, useValue: { succes: vi.fn(), erreur: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ChangerEmail);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance as any;
  }

  beforeEach(() => Object.values(repo).forEach((f) => f.mockReset()));

  it('sans demande en cours : affiche l’adresse actuelle et propose de la modifier', async () => {
    repo.statut.mockResolvedValue(statut());
    const c = await creer();
    expect(c.ecran()).toBe('accueil');
  });

  it('reprend la demande là où le serveur l’attend (après fermeture de l’application)', async () => {
    repo.statut.mockResolvedValue(statut(demande('nouvelle', { etat: 'nouvelle' })));
    const c = await creer();
    expect(c.ecran()).toBe('nouvelle');
  });

  it('une demande en attente d’un administrateur n’annonce aucun changement', async () => {
    repo.statut.mockResolvedValue(statut(demande('attente_admin', { etat: 'revue_admin', methode: 'ancienne_inaccessible' })));
    const c = await creer();
    expect(c.ecran()).toBe('attente');
    expect(auth.majEmail).not.toHaveBeenCalled();
  });

  it('refuse d’envoyer une adresse mal formée', async () => {
    repo.statut.mockResolvedValue(statut());
    const c = await creer();
    c.nouvelEmail.set('pas-une-adresse');
    await c.demarrer();
    expect(repo.demarrer).not.toHaveBeenCalled();
    c.nouvelEmail.set('camille@yahoo.fr');
    repo.demarrer.mockResolvedValue(demande('preuve'));
    await c.demarrer();
    expect(repo.demarrer).toHaveBeenCalledWith('camille@yahoo.fr', 'ancienne_adresse');
    expect(c.ecran()).toBe('preuve');
  });

  it('un code incorrect affiche le message du serveur et reste sur l’étape', async () => {
    repo.statut.mockResolvedValue(statut(demande('preuve')));
    const c = await creer();
    c.code.set('123456');
    repo.verifierPreuve.mockRejectedValue(new Failure('Code incorrect. 4 tentative(s) restante(s).', 400, 'EMAIL_CHANGE_CODE_INCORRECT'));
    await c.verifierPreuve();
    expect(c.erreur()).toMatch(/Code incorrect/);
    expect(c.ecran()).toBe('preuve');
  });

  it('une demande expirée renvoie à l’état réel du serveur', async () => {
    repo.statut.mockResolvedValueOnce(statut(demande('preuve')));
    const c = await creer();
    c.code.set('123456');
    repo.verifierPreuve.mockRejectedValue(new Failure('Ce code a expiré.', 410, 'EMAIL_CHANGE_EXPIREE'));
    repo.statut.mockResolvedValue(statut());
    await c.verifierPreuve();
    expect(c.ecran()).toBe('accueil');
  });

  it('la confirmation réussie met à jour l’adresse locale, pas avant', async () => {
    repo.statut.mockResolvedValueOnce(statut(demande('nouvelle', { etat: 'nouvelle' })));
    const c = await creer();
    c.code.set('654321');
    repo.confirmer.mockResolvedValue({ ...demande('termine', { etat: 'termine' }), termine: true });
    repo.statut.mockResolvedValue(statut(null, 'camille@yahoo.fr'));
    await c.confirmer();
    expect(auth.majEmail).toHaveBeenCalledWith('camille@yahoo.fr');
    expect(c.ecran()).toBe('succes');
  });

  it('seuls six chiffres sont acceptés comme code', async () => {
    repo.statut.mockResolvedValue(statut(demande('preuve')));
    const c = await creer();
    c.surCode({ target: { value: '12ab34 56789' } } as unknown as Event);
    expect(c.code()).toBe('123456');
  });
});
