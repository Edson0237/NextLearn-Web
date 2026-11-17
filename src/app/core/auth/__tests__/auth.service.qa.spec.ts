import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth-repository';
import { VerrouPin } from '../services/verrou-pin';
import { VerrouillageApp } from '../../preferences/services/verrouillage-app';
import { VerificationService } from '../../verification/services/verification.service';
import { VerificationRepository } from '../../verification/repositories/verification-repository';
import { ProfilRepository } from '../../profil/repositories/profil-repository';
import { ClasseBibliothequeService } from '../../bibliotheque/services/classe-bibliotheque.service';
import { ContexteService } from '../../contexte/services/contexte.service';
import { NotificationsEtat } from '../../notifications/services/notifications-etat';
import { HistoriqueRecherches } from '../../recherche/services/historique-recherches';
import { StockageHorsLigne } from '../../bibliotheque/services/stockage-hors-ligne';
import { SessionExpiredService } from '../../network/services/session-expired.service';
import { AppRoutes } from '../../router/routes/app-routes';
import { Failure } from '../../models/failure.model';
import { Cycle, Langue, NiveauEtude, UserModel } from '../../models/user.model';
import { ParcoursOtp } from '../../models/parcours-otp.model';
import { Subject } from 'rxjs';

const userSample: UserModel = {
  id: 'u-qa-1',
  email: 'qa@univ-qa.test',
  nom: 'Tientcheu',
  prenom: 'Marin',
  universite: 'UQA',
  filiere: 'GL',
  niveau: NiveauEtude.n3,
  cycle: Cycle.licence,
  langue: Langue.fr,
  hasPin: true,
};

describe('QA AuthService — Parcours complets, verrou PIN & cold-boot hors ligne', () => {
  const origDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

  function setOnline(v: boolean) {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => v });
  }

  afterEach(() => {
    vi.useRealTimers();
    if (origDesc) Object.defineProperty(Navigator.prototype, 'onLine', origDesc);
    localStorage.clear();
  });

  function setup(overrides: { repo?: Partial<Record<string, any>>; locked?: boolean; hasSession?: boolean } = {}) {
    const expired$ = new Subject<string | undefined>();
    const repoMock: any = {
      isFirstLaunch: vi.fn().mockReturnValue(false),
      restoreSession: vi.fn().mockResolvedValue(overrides.hasSession ? { userId: userSample.id } : null),
      isOtpStillFresh: vi.fn().mockResolvedValue(true),
      hasLocalPin: vi.fn().mockReturnValue(true),
      getCurrentUser: vi.fn().mockReturnValue(overrides.hasSession ? userSample : null),
      parcoursOtpEnCours: vi.fn().mockReturnValue(null),
      verifyOtp: vi.fn().mockResolvedValue(undefined),
      setupPin: vi.fn().mockResolvedValue(undefined),
      verifyLoginOtp: vi.fn().mockResolvedValue(undefined),
      resendOtp: vi.fn().mockResolvedValue(undefined),
      rafraichirDemandeOtp: vi.fn().mockResolvedValue({ statut: 'envoye' }),
      register: vi.fn().mockResolvedValue(undefined),
      connexionGoogle: vi.fn().mockResolvedValue({ status: 'authenticated' }),
      inscriptionGoogle: vi.fn().mockResolvedValue({ status: 'pin_required' }),
      connexionGithub: vi.fn().mockResolvedValue({ status: 'authenticated' }),
      inscriptionGithub: vi.fn().mockResolvedValue({ status: 'authenticated' }),
      identifierConnexion: vi.fn().mockResolvedValue('pin'),
      loginWithPin: vi.fn().mockResolvedValue(false),
      verifyLocalPin: vi.fn().mockResolvedValue(true),
      requestPinReset: vi.fn().mockResolvedValue(undefined),
      confirmPinReset: vi.fn().mockResolvedValue(userSample),
      changerPin: vi.fn().mockResolvedValue(2),
      saveUser: vi.fn(),
      abandonnerParcoursOtp: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      forgetDevice: vi.fn().mockResolvedValue(undefined),
      derniereDemandeOtp: { statut: 'envoye' },
      profilGoogleEnAttente: null,
      profilGithubEnAttente: null,
      ...(overrides.repo ?? {}),
    };

    const verrouPinMock = {
      bloqueJusqua: vi.fn().mockReturnValue(null),
      enregistrerEchec: vi.fn(),
      effacerEchecs: vi.fn(),
    };

    const verifServiceMock = {
      state: vi.fn().mockReturnValue({ requis: false, statut: 'approuve', tentatives: 0, resoumissionsRestantes: 3 }),
      syncFromUser: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ requis: false, statut: 'approuve', tentatives: 0, resoumissionsRestantes: 3 }),
      reset: vi.fn(),
    };

    const verifRepoMock = { submit: vi.fn().mockResolvedValue({}) };
    const profilRepoMock = {
      niveauxDuCycle: vi.fn().mockResolvedValue({ niveaux: [{ code: 'N3', label: 'L3' }] }),
      changerNiveau: vi.fn().mockResolvedValue({ ...userSample, universite: '', filiere: '', niveau: NiveauEtude.n4 }),
      changerSection: vi.fn().mockResolvedValue({ ...userSample, universite: '', filiere: '' }),
      televerserAvatar: vi.fn().mockResolvedValue({ ...userSample, avatarUrl: 'https://img/a.jpg' }),
      supprimerAvatar: vi.fn().mockResolvedValue({ ...userSample, avatarUrl: undefined }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: AuthRepository, useValue: repoMock },
        { provide: VerrouPin, useValue: verrouPinMock },
        { provide: VerrouillageApp, useValue: { actif: () => overrides.locked ?? false } },
        { provide: VerificationService, useValue: verifServiceMock },
        { provide: VerificationRepository, useValue: verifRepoMock },
        { provide: ProfilRepository, useValue: profilRepoMock },
        { provide: ClasseBibliothequeService, useValue: { revenirAMaClasse: vi.fn(), invaliderCache: vi.fn(), reinitialiserSession: vi.fn() } },
        { provide: ContexteService, useValue: { charger: vi.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsEtat, useValue: { reinitialiser: vi.fn() } },
        { provide: HistoriqueRecherches, useValue: { vider: vi.fn() } },
        { provide: StockageHorsLigne, useValue: { revoquerToutesUrlsLocales: vi.fn() } },
        { provide: SessionExpiredService, useValue: { expired$ } },
      ],
    });

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const service = TestBed.inject(AuthService);
    const httpMock = TestBed.inject(HttpTestingController);
    return {
      service,
      repoMock,
      verrouPinMock,
      verifServiceMock,
      verifRepoMock,
      profilRepoMock,
      navSpy,
      navUrlSpy,
      expired$,
      httpMock,
    };
  }

  it('NL-BUG-2026-005 : init() hors ligne n’attend pas verification.refresh() et conserve la session locale', async () => {
    vi.useFakeTimers();
    setOnline(false);
    const { service, verifServiceMock } = setup({ hasSession: true, locked: true });
    await vi.advanceTimersByTimeAsync(1600);

    expect(service.state().isInitializing).toBe(false);
    expect(service.state().user?.id).toBe(userSample.id);
    expect(service.state().isLocked).toBe(true);
    expect(verifServiceMock.syncFromUser).toHaveBeenCalledWith(userSample);
    expect(verifServiceMock.refresh).not.toHaveBeenCalled();
  });

  it('verifyOtp, verifyLoginOtp, resendOtp, rafraichirDemandeOtp et setupPin avec justificatif PDF/PNG', async () => {
    vi.useFakeTimers();
    const { service, repoMock, verifRepoMock } = setup();
    await vi.advanceTimersByTimeAsync(250);
    repoMock.getCurrentUser.mockReturnValue(userSample);

    service.savePersonalInfo('a@b.test', 'Nom', 'Prenom');
    service.saveAcademicInfo('UQA', 'GL', NiveauEtude.n3, Cycle.licence);
    service.saveJustificatif({
      matricule: '26M001',
      type: 'carte_etudiant',
      fileName: 'carte.pdf',
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(await service.verifyOtp('123456')).toBe(true);
    expect(verifRepoMock.submit).toHaveBeenCalled();

    repoMock.verifyOtp.mockRejectedValueOnce(new Failure('Code faux'));
    expect(await service.verifyOtp('000000')).toBe(false);
    expect(service.state().error).toBe('Code faux');

    expect(await service.verifyLoginOtp('654321')).toBe(true);
    repoMock.verifyLoginOtp.mockRejectedValueOnce(new Failure('Expiré'));
    expect(await service.verifyLoginOtp('000000')).toBe(false);

    expect(await service.resendOtp()).toBe(true);
    repoMock.derniereDemandeOtp = { statut: 'refuse' };
    expect(await service.resendOtp()).toBe(false);
    repoMock.resendOtp.mockRejectedValueOnce(new Error('fail'));
    expect(await service.resendOtp()).toBe(false);

    await service.rafraichirDemandeOtp();
    expect(service.state().demandeOtp).toBeTruthy();

    service.saveJustificatif({
      matricule: '26M002',
      type: 'recu',
      fileName: 'recu.png',
      bytes: new Uint8Array([4, 5]),
    });
    expect(await service.setupPin('7492')).toBe(true);
    repoMock.setupPin.mockRejectedValueOnce(new Failure('PIN invalide'));
    expect(await service.setupPin('1234')).toBe(false);
  });

  it('couvre OAuth Google/GitHub, identifierConnexion, loginWithPin et gestion d’erreurs', async () => {
    vi.useFakeTimers();
    const { service, repoMock, verifServiceMock, navSpy, navUrlSpy } = setup({ hasSession: true });
    await vi.advanceTimersByTimeAsync(1600);

    expect(await service.connexionGoogle('tok')).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/app', AppRoutes.home]);

    repoMock.connexionGoogle.mockResolvedValueOnce({ status: 'new_profile_incomplete', profil: { email: 'g@t.test', googleSub: '1', prenom: 'P', nom: 'N', institutionnel: true } });
    expect(await service.connexionGoogle('tok2')).toBeNull();
    expect(service.profilGoogle()?.email).toBe('g@t.test');
    service.abandonnerInscriptionGoogle();
    expect(service.profilGoogle()).toBeNull();

    await service.handleGoogleAuthResponse({ status: 'pin_required' });
    expect(navUrlSpy).toHaveBeenCalledWith('/app/' + AppRoutes.pinSetup);

    verifServiceMock.refresh.mockResolvedValueOnce({ statut: 'en_attente' });
    repoMock.connexionGoogle.mockResolvedValueOnce({ status: 'authenticated' });
    await service.connexionGoogle('tok3');
    expect(navUrlSpy).toHaveBeenCalled();

    repoMock.connexionGoogle.mockRejectedValueOnce(new Failure('Refus', 403, 'domain_not_allowed'));
    expect((await service.connexionGoogle('bad'))?.code).toBe('domain_not_allowed');

    expect(await service.inscriptionGoogle({ universite: 'U', filiere: 'F', niveau: 'N3' })).toBeNull();
    repoMock.inscriptionGoogle.mockRejectedValueOnce(new Failure('KO'));
    expect(await service.inscriptionGoogle({ universite: 'U', filiere: 'F', niveau: 'N3' })).toBe('KO');

    expect(await service.connexionGithub('code', 'redir')).toBeNull();
    repoMock.connexionGithub.mockResolvedValueOnce({ status: 'new_profile_incomplete', profil: { email: 'gh@t.test', githubId: '2', login: 'qa', prenom: 'P', nom: 'N', institutionnel: true } });
    await service.connexionGithub('code2', 'redir');
    service.abandonnerInscriptionGithub();
    repoMock.connexionGithub.mockRejectedValueOnce(new Failure('GH err', 429, undefined, 30));
    expect((await service.connexionGithub('bad', 'r'))?.retryAfterSeconds).toBe(30);
    expect(await service.inscriptionGithub({ universite: 'U', filiere: 'F', niveau: 'N3' })).toBeNull();

    repoMock.identifierConnexion.mockResolvedValueOnce('otp');
    expect(await service.identifierConnexion('qa@t.test')).toBe('otp');
    repoMock.identifierConnexion.mockRejectedValueOnce(new Failure('Down'));
    expect(await service.identifierConnexion('qa@t.test')).toBe('echec');

    repoMock.loginWithPin.mockResolvedValueOnce('google');
    expect(await service.loginWithPin('qa@t.test', '7492')).toBe('google');
    repoMock.loginWithPin.mockResolvedValueOnce(true);
    expect(await service.loginWithPin('qa@t.test', '7492')).toBe('otp');
    repoMock.loginWithPin.mockResolvedValueOnce(false);
    expect(await service.loginWithPin('qa@t.test', '7492')).toBe('session');
    repoMock.loginWithPin.mockRejectedValueOnce(new Failure('Trop de tentatives', 403, 'PIN_TEMPORARILY_LOCKED'));
    expect(await service.loginWithPin('qa@t.test', '0000')).toBe('echec');
  });

  it('couvre unlockWithPin, resetPin, changerPin, changerNiveau, changerSection, avatar et statut verif', async () => {
    vi.useFakeTimers();
    const { service, repoMock, verrouPinMock, profilRepoMock } = setup({ hasSession: true });
    await vi.advanceTimersByTimeAsync(1600);

    expect(await service.unlockWithPin('7492')).toBe(true);
    repoMock.verifyLocalPin.mockResolvedValueOnce(false);
    expect(await service.unlockWithPin('0000')).toBe(false);
    verrouPinMock.bloqueJusqua.mockReturnValue(new Date(Date.now() + 90_000));
    expect(service.isPinLocked()).toBe(true);
    expect(await service.unlockWithPin('7492')).toBe(false);
    service.unlockWithBiometrics();
    expect(service.state().isLocked).toBe(false);

    expect(await service.requestPinReset('qa@t.test')).toBe(true);
    repoMock.requestPinReset.mockRejectedValueOnce(new Failure('Bad'));
    expect(await service.requestPinReset('qa@t.test')).toBe(false);

    expect(await service.confirmPinReset('123456', '7492')).toBe(true);
    repoMock.confirmPinReset.mockRejectedValueOnce(new Failure('Expired'));
    expect(await service.confirmPinReset('000000', '7492')).toBe(false);

    expect(await service.changerPin('7492', '9182')).toBe(2);
    repoMock.changerPin.mockRejectedValueOnce(new Failure('Wrong'));
    expect(await service.changerPin('0000', '9182')).toBeNull();

    expect((await service.niveauxDuCycle()).niveaux).toHaveLength(1);
    expect(await service.changerNiveau('N4')).toBeNull();
    profilRepoMock.changerNiveau.mockRejectedValueOnce(new Failure('Err niveau'));
    expect(await service.changerNiveau('N5')).toBe('Err niveau');

    expect(await service.changerSection('FRANCOPHONE')).toBeNull();
    profilRepoMock.changerSection.mockRejectedValueOnce(new Failure('Err section'));
    expect(await service.changerSection('ANGLOPHONE')).toBe('Err section');

    expect(await service.changerAvatar(new File(['a'], 'a.jpg'))).toBeNull();
    expect(await service.supprimerAvatar()).toBeNull();

    service.updateVerificationStatus('en_attente');
    service.marquerCompteVerifie();
    service.abandonnerParcoursOtp();
    service.clearError();
    await service.forgetDevice();
    expect(service.state().user).toBeUndefined();
  });
});
