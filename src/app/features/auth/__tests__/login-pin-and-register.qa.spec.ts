import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginPin } from '../login-pin/login-pin';
import { Register } from '../register/register';
import { GoogleBouton } from '../../../shared/ui/google-bouton/google-bouton';
import {
  AuthRepository,
  AuthService,
  GithubIdentite,
  GoogleIdentite,
} from '../../../core/auth';
import { SecureStorageService } from '../../../core/storage';
import { SessionExpiredService } from '../../../core/network';
import { ReferencesRepository } from '../../../core/references';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { ToastService } from '../../../shared/ui/toast/toast';
import { EtatDomaine } from '../../../core/models';

describe('LoginPin, Register & GoogleBouton — QA Coverage Suite', () => {
  let routerStub: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };
  let authStub: any;
  let googleStub: any;
  let githubStub: any;

  beforeEach(() => {
    localStorage.clear();
    routerStub = {
      navigate: vi.fn(async () => true),
      navigateByUrl: vi.fn(async () => true),
    };
    authStub = {
      state: signal({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
        isFirstLaunch: false,
        needsOtpVerification: false,
        error: null,
      }),
      profilGoogle: signal(null),
      profilGithub: signal(null),
      codeErreurInscription: signal(null),
      connexionGoogle: vi.fn(async () => null),
      identifierConnexion: vi.fn(async () => 'pin'),
      loginWithPin: vi.fn(async () => 'session'),
      savePersonalInfo: vi.fn(),
      saveAcademicInfo: vi.fn(),
      saveJustificatif: vi.fn(),
      register: vi.fn(async () => true),
      inscriptionGoogle: vi.fn(async () => null),
      inscriptionGithub: vi.fn(async () => null),
      abandonnerInscriptionGoogle: vi.fn(),
      abandonnerInscriptionGithub: vi.fn(),
      abandonnerInscription: vi.fn(),
    };
    googleStub = {
      disponible: signal(false),
      desactive: signal(true),
      preparer: vi.fn(async () => false),
      afficherBouton: vi.fn(),
    };
    githubStub = {
      disponible: signal(false),
      desactive: signal(true),
      preparer: vi.fn(async () => false),
      redirigerVersGithub: vi.fn(async () => undefined),
      masquerSiNonConfigure: vi.fn(),
    };
  });

  it('LoginPin couvre divulgation email, identifierConnexion (pin/otp/google/erreur) et saisie PIN 4 chiffres', async () => {
    TestBed.configureTestingModule({
      imports: [LoginPin],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authStub },
        { provide: GoogleIdentite, useValue: googleStub },
        { provide: GithubIdentite, useValue: githubStub },
        {
          provide: SessionExpiredService,
          useValue: { consommerMotif: () => 'Session expirée.' },
        },
      ],
    });

    const fixture: ComponentFixture<LoginPin> = TestBed.createComponent(LoginPin);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    expect(cmp.motifFinSession()).toBe('Session expirée.');
    cmp.deplierEmail();
    expect(cmp.showEmailField()).toBe(true);

    // Adresse invalide
    cmp.email.set('invalide');
    await cmp.continuerAvecEmail();
    expect(cmp.erreur()).toContain('valide');

    // Branche PIN
    cmp.email.set('alice@enspy.cm');
    authStub.identifierConnexion.mockResolvedValueOnce('pin');
    await cmp.continuerAvecEmail();
    expect(cmp.etape()).toBe('pin');

    // 4 chiffres -> session ouverte + résultat succès -> navigation accueil
    cmp.onChiffre('1');
    cmp.onChiffre('2');
    cmp.onBackspace();
    cmp.onChiffre('2');
    cmp.onChiffre('3');
    cmp.onChiffre('4');
    await vi.waitFor(() => expect(cmp.resultat()?.etat).toBe('succes'));
    cmp.continuer();
    expect(routerStub.navigate).toHaveBeenCalled();

    // Branche 2FA + Google + Échec PIN
    authStub.loginWithPin.mockResolvedValueOnce('otp');
    cmp.email.set('alice@enspy.cm');
    await cmp.soumettre('2580');
    expect(cmp.resultat()?.titre).toBe('PIN vérifié');
    cmp.continuer();
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    authStub.loginWithPin.mockResolvedValueOnce('google');
    await cmp.soumettre('2580');
    expect(cmp.verificationGoogle()).toBe(true);

    authStub.loginWithPin.mockResolvedValueOnce(null);
    await cmp.soumettre('9999');
    expect(cmp.resultat()?.etat).toBe('echec');
    cmp.reessayer();
    expect(cmp.resultat()).toBeNull();

    // Retour OTP/Google depuis identifierConnexion
    authStub.identifierConnexion.mockResolvedValueOnce('otp');
    await cmp.continuerAvecEmail();
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    authStub.identifierConnexion.mockResolvedValueOnce('google');
    await cmp.continuerAvecEmail();
    expect(cmp.verificationGoogle()).toBe(true);

    cmp.changerAdresse();
    expect(cmp.etape()).toBe('email');
    cmp.replierEmail();
    expect(cmp.showEmailField()).toBe(false);
    cmp.allerReinitialisation();
    cmp.allerInscription();
  });

  it('Register déroule cascade École/Cycle/Niveau/Filière, justificatif et repli use_google_auth', async () => {
    const feuillesStub = { ouvrir: vi.fn() };
    const refsStub = {
      getUniversites: vi.fn(async () => [{ id: 'u-1', nom: 'ENSPY', estDefaut: true }]),
      getCycles: vi.fn(async () => [{ id: 'c-1', value: 'INGENIEUR', label: 'Ingénieur' }]),
      getNiveaux: vi.fn(async () => [{ id: 'l-1', value: 'N3', label: '3e année' }]),
      getFilieres: vi.fn(async () => [{ id: 'f-1', nom: 'Informatique' }]),
      getJustificatifTypes: vi.fn(async () => [{ code: 'CARTE_ETUDIANT', label: 'Carte étudiant' }]),
    };
    const authRepoStub = {
      verifierDomaine: vi.fn(async () => ({ etat: EtatDomaine.reconnu, google: false })),
    };

    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authStub },
        { provide: AuthRepository, useValue: authRepoStub },
        { provide: ReferencesRepository, useValue: refsStub },
        { provide: FeuilleSelectionService, useValue: feuillesStub },
        { provide: GoogleIdentite, useValue: googleStub },
        { provide: GithubIdentite, useValue: githubStub },
      ],
    });

    const fixture: ComponentFixture<Register> = TestBed.createComponent(Register);
    fixture.detectChanges();
    await Promise.resolve();
    const cmp = fixture.componentInstance as any;

    cmp.deplierEmail();
    expect(cmp.showEmailField()).toBe(true);
    cmp.prenom.set('Alice');
    cmp.nom.set('Nguema');
    cmp.surSaisieEmail('alice@enspy.cm');
    await cmp.suivant();
    fixture.detectChanges();
    expect(cmp.etape()).toBe(1);

    // Sélection cascade
    feuillesStub.ouvrir.mockResolvedValueOnce('u-1');
    await cmp.choisirUniversite();
    await Promise.resolve();

    feuillesStub.ouvrir.mockResolvedValueOnce('INGENIEUR');
    await cmp.choisirCycle();
    await Promise.resolve();

    feuillesStub.ouvrir.mockResolvedValueOnce('l-1');
    await cmp.choisirNiveau();
    await Promise.resolve();

    feuillesStub.ouvrir.mockResolvedValueOnce('f-1');
    await cmp.choisirFiliere();

    // Soumission finale OK -> /app/otp
    await cmp.suivant();
    expect(authStub.register).toHaveBeenCalledWith(false);
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    // Cas use_google_auth -> revient étape 0 repliée
    authStub.register.mockResolvedValueOnce(false);
    authStub.codeErreurInscription.set('use_google_auth');
    await cmp.soumettreInscription();
    expect(cmp.etape()).toBe(0);
    expect(cmp.showEmailField()).toBe(false);

    // Étape 3 avec justificatif (hors domaine)
    cmp.domaine.set({ etat: EtatDomaine.refuse });
    cmp.etape.set(2);
    fixture.detectChanges();
    cmp.justificatifType.set('CARTE_ETUDIANT');
    const file = new File([new Uint8Array([1, 2, 3])], 'carte.pdf', { type: 'application/pdf' });
    cmp.surFichierChoisi({ target: { files: [file] } });
    authStub.register.mockResolvedValueOnce(true);
    await cmp.suivant();
    expect(authStub.saveJustificatif).toHaveBeenCalled();

    // Mode Google & Mode GitHub + CONFLIT 409
    cmp.modeGoogle.set(true);
    cmp.universiteId.set('u-1');
    cmp.filiereId.set('f-1');
    cmp.niveau.set('N3');
    await cmp.validerEtape2();
    expect(authStub.inscriptionGoogle).toHaveBeenCalled();

    cmp.modeGoogle.set(false);
    cmp.modeGithub.set(true);
    authStub.inscriptionGithub.mockResolvedValueOnce({ statusCode: 409, code: 'CONFLICT', message: 'Email déjà utilisé' });
    await cmp.validerEtape2();
    expect(cmp.conflitEmailExistant()).toBe('Email déjà utilisé');

    cmp.precedent();
    expect(authStub.abandonnerInscriptionGithub).toHaveBeenCalled();
    cmp.allerConnexion();
  });

  it('GoogleBouton rend l aperçu puis exécute surJeton (account_banned et erreur)', async () => {
    googleStub.disponible.set(true);
    googleStub.desactive.set(false);
    googleStub.preparer.mockResolvedValue(true);

    TestBed.configureTestingModule({
      imports: [GoogleBouton],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: GoogleIdentite, useValue: googleStub },
      ],
    });
    const fixture = TestBed.createComponent(GoogleBouton);
    fixture.detectChanges();
    await Promise.resolve();
    const cmp = fixture.componentInstance as any;

    authStub.connexionGoogle.mockResolvedValueOnce({ code: 'account_banned', message: 'Compte banni' });
    await cmp.surJeton('tok-1');
    expect(cmp.refusCompte()).toBe('Compte banni');

    authStub.connexionGoogle.mockResolvedValueOnce({ code: 'domain_not_allowed', message: 'Domaine interdit' });
    await cmp.surJeton('tok-2');
    expect(cmp.erreur()).toBe('Domaine interdit');
  });
});
