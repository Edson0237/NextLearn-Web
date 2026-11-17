import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthRepository, configGithubDepuisApi } from '../repositories/auth-repository';
import { SecureStorageService } from '../../storage/services/secure-storage.service';
import { StockageHorsLigne } from '../../bibliotheque/services/stockage-hors-ligne';
import { Consentements } from '../services/consentements';
import { AUTH_PATH } from '../../network/config/api-config';
import {
  Cycle,
  EtatDomaine,
  EtatVerification,
  Failure,
  Langue,
  NiveauEtude,
  ParcoursOtp,
} from '../../models';

const USER_JSON = {
  id: 'u-repo-1',
  email: 'alice@polytechnique.cm',
  nom: 'Nguema',
  prenom: 'Alice',
  universite: 'ENSPY',
  filiere: 'Informatique',
  niveau: 'N3',
  cycle: 'ingenieur',
  role: 'etudiant',
  isVerified: true,
  hasPin: true,
  verificationStatus: 'verified',
};

describe('AuthRepository — QA Coverage Suite', () => {
  let repo: AuthRepository;
  let httpMock: HttpTestingController;
  let storage: SecureStorageService;
  let stockageStub: {
    definirUtilisateur: ReturnType<typeof vi.fn>;
    purgerToutLeStockageLocal: ReturnType<typeof vi.fn>;
  };
  let consentementsStub: {
    versionsConnues: ReturnType<typeof vi.fn>;
    charger: ReturnType<typeof vi.fn>;
  };

  const originalOnLineDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

  const setOnline = (val: boolean) => {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => val,
    });
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setOnline(true);

    stockageStub = {
      definirUtilisateur: vi.fn(async () => undefined),
      purgerToutLeStockageLocal: vi.fn(async () => undefined),
    };
    consentementsStub = {
      versionsConnues: vi.fn(() => undefined),
      charger: vi.fn(async () => true),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StockageHorsLigne, useValue: stockageStub },
        { provide: Consentements, useValue: consentementsStub },
      ],
    });

    repo = TestBed.inject(AuthRepository);
    httpMock = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(SecureStorageService);
  });

  afterEach(() => {
    httpMock.verify();
    if (originalOnLineDesc) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnLineDesc);
    }
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('parcoursOtpEnCours gère absence, échéance expirée et parcours valide', () => {
    expect(repo.parcoursOtpEnCours()).toBeNull();

    storage.saveTempToken('tmp-expired');
    storage.saveParcoursOtp(ParcoursOtp.inscription, new Date(Date.now() - 10_000));
    expect(repo.parcoursOtpEnCours()).toBeNull();
    expect(storage.getTempToken()).toBeNull();

    storage.saveTempToken('tmp-active');
    storage.saveParcoursOtp(ParcoursOtp.connexion, new Date(Date.now() + 60_000));
    expect(repo.parcoursOtpEnCours()).toBe(ParcoursOtp.connexion);

    repo.abandonnerParcoursOtp();
    expect(repo.derniereDemandeOtp).toBeNull();
    expect(storage.getTempToken()).toBeNull();
  });

  it('rafraichirDemandeOtp gère absence de jeton, succès et erreur silencieuse', async () => {
    expect(await repo.rafraichirDemandeOtp()).toBeNull();

    storage.saveTempToken('tmp-otp');
    const pOk = repo.rafraichirDemandeOtp();
    httpMock.expectOne((r) => r.url === `${AUTH_PATH}/otp/status`).flush({
      data: { statut: 'envoye', message: 'Code envoyé', renvoiPossibleDans: 30 },
    });
    const demande = await pOk;
    expect(demande?.message).toBe('Code envoyé');

    const pErr = repo.rafraichirDemandeOtp();
    httpMock
      .expectOne((r) => r.url === `${AUTH_PATH}/otp/status`)
      .flush({}, { status: 500, statusText: 'Err' });
    expect(await pErr).toEqual(demande);
  });

  it('isOtpStillFresh et etatVerification gèrent en ligne, 404 avec cache et hors ligne', async () => {
    setOnline(false);
    expect(await repo.etatVerification()).toBeNull();
    expect(await repo.isOtpStillFresh()).toBe(true);

    setOnline(true);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const pActive = repo.isOtpStillFresh();
    httpMock.expectOne(`${AUTH_PATH}/verification-status`).flush({
      data: {
        etat: EtatVerification.aJour,
        echeanceLe: future,
        fenetreOuverteLe: future,
        joursRestants: 5,
        retardDuAuQuota: false,
      },
    });
    expect(await pActive).toBe(true);

    const p404 = repo.isOtpStillFresh();
    httpMock.expectOne(`${AUTH_PATH}/verification-status`).flush({}, { status: 404, statusText: 'Not found' });
    expect(await p404).toBe(true);

    storage.clearAll();
    const p404NoCache = repo.isOtpStillFresh();
    httpMock.expectOne(`${AUTH_PATH}/verification-status`).flush({}, { status: 404, statusText: 'Not found' });
    expect(await p404NoCache).toBe(false);
  });

  it('verifierDomaine distingue domaine reconnu et erreur réseau indisponible', async () => {
    const pOk = repo.verifierDomaine('a@polytechnique.cm');
    httpMock.expectOne((r) => r.url === `${AUTH_PATH}/institution-domain/check`).flush({
      data: { allowed: true, google: false, institutionName: 'ENSPY' },
    });
    expect((await pOk).etat).toBe(EtatDomaine.reconnu);

    const pDown = repo.verifierDomaine('a@polytechnique.cm');
    httpMock
      .expectOne((r) => r.url === `${AUTH_PATH}/institution-domain/check`)
      .error(new ProgressEvent('error'));
    expect((await pDown).etat).toBe(EtatDomaine.indisponible);
  });

  it('register, retry consent_required, verifyOtp et setupPin ouvrent puis ferment la session', async () => {
    const pReg = repo.register({
      email: 'alice@polytechnique.cm',
      nom: 'Nguema',
      prenom: 'Alice',
      universite: 'ENSPY',
      filiere: 'Informatique',
      niveau: NiveauEtude.n3,
      cycle: Cycle.ingenieur,
    });
    httpMock.expectOne(`${AUTH_PATH}/register`).flush({
      data: { tempToken: 'tmp-reg-1', otp: { statut: 'envoye', message: 'OTP envoyé' } },
    });
    await pReg;
    expect(storage.getTempToken()).toBe('tmp-reg-1');

    const pVerify = repo.verifyOtp('123456');
    httpMock.expectOne(`${AUTH_PATH}/verify-otp`).flush({
      data: { tempToken: 'tmp-pin-2' },
    });
    await pVerify;
    expect(storage.getParcoursOtp()).toBe(ParcoursOtp.definitionPin);

    // Retry consent_required sur setup-pin
    const pPin = repo.setupPin('2580');
    httpMock.expectOne(`${AUTH_PATH}/setup-pin`).flush(
      { error: { code: 'consent_required', message: 'Consentements requis' } },
      { status: 403, statusText: 'Forbidden' },
    );
    await vi.waitFor(() => {
      const req = httpMock.expectOne(`${AUTH_PATH}/setup-pin`);
      req.flush({
        data: {
          accessToken: 'acc-1',
          refreshToken: 'ref-1',
          user: USER_JSON,
        },
      });
    });
    await pPin;
    expect(storage.getToken()).toBe('acc-1');
    expect(storage.getTempToken()).toBeNull();
    expect(stockageStub.definirUtilisateur).toHaveBeenCalledWith('u-repo-1');
  });

  it('identifierConnexion et loginWithPin couvrent pin, otp, google et session directe', async () => {
    const pIdPin = repo.identifierConnexion('alice@polytechnique.cm');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({ data: { pinRequis: true } });
    expect(await pIdPin).toBe('pin');

    const pIdGoogle = repo.identifierConnexion('g@polytechnique.cm');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({ data: { methode: 'google' } });
    expect(await pIdGoogle).toBe('google');

    const pIdOtp = repo.identifierConnexion('o@polytechnique.cm');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({
      data: { tempToken: 'tmp-login-otp', otp: { statut: 'envoye', message: 'Code' } },
    });
    expect(await pIdOtp).toBe('otp');

    const pPinSession = repo.loginWithPin('alice@polytechnique.cm', '2580');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({
      data: { otpRequis: false, accessToken: 'acc-p', refreshToken: 'ref-p', user: USER_JSON },
    });
    expect(await pPinSession).toBe(false);
    expect(repo.hasLocalPin()).toBe(true);
    expect(await repo.verifyLocalPin('2580')).toBe(true);
    expect(await repo.verifyLocalPin('0000')).toBe(false);

    const pPinGoogle = repo.loginWithPin('g@polytechnique.cm', '2580');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({
      data: { otpRequis: true, methode: 'google' },
    });
    expect(await pPinGoogle).toBe('google');

    const pPinOtp = repo.loginWithPin('alice@polytechnique.cm', '2580');
    httpMock.expectOne(`${AUTH_PATH}/login`).flush({
      data: { otpRequis: true, tempToken: 'tmp-2fa' },
    });
    expect(await pPinOtp).toBe(true);
  });

  it('Google & GitHub config, connexion, inscription et erreurs de jeton', async () => {
    expect(configGithubDepuisApi({ enabled: false })).toEqual({ enabled: false });
    expect(
      configGithubDepuisApi({ enabled: true, clientId: 'gh-1', scope: 'user:email', authorizeUrl: 'https://gh.local/auth' }),
    ).toEqual({
      enabled: true,
      clientId: 'gh-1',
      scope: 'user:email',
      authorizeUrl: 'https://gh.local/auth',
    });

    const pG = repo.configGoogle();
    httpMock.expectOne(`${AUTH_PATH}/google/config`).flush({ data: { enabled: true, clientId: 'cid-g' } });
    expect(await pG).toEqual({ enabled: true, clientId: 'cid-g' });

    const pGErr = repo.configGoogle();
    httpMock.expectOne(`${AUTH_PATH}/google/config`).error(new ProgressEvent('err'));
    expect(await pGErr).toEqual({ enabled: false, injoignable: true });

    const pGhErr = repo.configGithub();
    httpMock.expectOne(`${AUTH_PATH}/github/config`).error(new ProgressEvent('err'));
    expect(await pGhErr).toEqual({ enabled: false, injoignable: true });

    const pGNew = repo.connexionGoogle('id-tok-1');
    httpMock.expectOne(`${AUTH_PATH}/google`).flush({
      data: {
        status: 'new_profile_incomplete',
        tempToken: 'tmp-g-inc',
        email: 'new@gmail.com',
        googleSub: 'sub-1',
        profil: { prenom: 'N', nom: 'P', institutionnel: false },
      },
    });
    const rGNew = await pGNew;
    expect(rGNew.status).toBe('new_profile_incomplete');

    const pGIns = repo.inscriptionGoogle({ universite: 'ENSPY', filiere: 'Info', niveau: 'N3' });
    httpMock.expectOne(`${AUTH_PATH}/google/inscription`).flush({
      data: { status: 'authenticated', verificationStatus: 'pending', accessToken: 'ag', refreshToken: 'rg', user: USER_JSON },
    });
    expect(await pGIns).toEqual({ status: 'authenticated', verificationStatus: 'pending' });

    const pGhNew = repo.connexionGithub('code-gh', 'https://app/cb', 'verif');
    httpMock.expectOne(`${AUTH_PATH}/github`).flush({
      data: {
        status: 'new_profile_incomplete',
        tempToken: 'tmp-gh-inc',
        email: 'gh@ext.org',
        githubId: '99',
        profil: { login: 'octo', prenom: 'O', nom: 'C', institutionnel: false },
      },
    });
    expect((await pGhNew).status).toBe('new_profile_incomplete');

    const pGhIns = repo.inscriptionGithub({ universite: 'ENSPY', filiere: 'Info', niveau: 'N3' });
    httpMock.expectOne(`${AUTH_PATH}/github/inscription`).flush({
      data: { status: 'authenticated', accessToken: 'agh', refreshToken: 'rgh', user: USER_JSON },
    });
    expect(await pGhIns).toEqual({ status: 'authenticated' });
  });

  it('verifyLoginOtp, resendOtp, resetPin, changerPin, restoreSession et logout/forgetDevice', async () => {
    storage.saveTempToken('tmp-2fa');
    const pResend = repo.resendOtp();
    httpMock.expectOne(`${AUTH_PATH}/resend-otp`).flush({
      data: { tempToken: 'tmp-2fa-2', otp: { statut: 'envoye', message: 'Renvoyé' } },
    });
    await pResend;

    const p2fa = repo.verifyLoginOtp('654321');
    httpMock.expectOne(`${AUTH_PATH}/verify-2fa`).flush({
      data: { accessToken: 'a-2fa', refreshToken: 'r-2fa', user: USER_JSON },
    });
    await p2fa;
    expect(await repo.restoreSession()).toEqual({ userId: 'u-repo-1' });

    expect(repo.majEmailLocal('nouveau@polytechnique.cm')?.email).toBe('nouveau@polytechnique.cm');
    expect(repo.getCurrentUser()?.email).toBe('nouveau@polytechnique.cm');
    repo.saveUser({
      id: 'u-repo-1',
      email: 'maj@polytechnique.cm',
      nom: 'Nguema',
      prenom: 'Alice',
      universite: 'ENSPY',
      filiere: 'Info',
      niveau: NiveauEtude.n3,
      langue: Langue.fr,
    });
    expect(repo.isFirstLaunch()).toBe(true);

    const pResetReq = repo.requestPinReset('alice@polytechnique.cm');
    httpMock.expectOne(`${AUTH_PATH}/reset-pin`).flush({
      data: { tempToken: 'tmp-reset' },
    });
    await pResetReq;

    const pResetConf = repo.confirmPinReset('111222', '9876');
    httpMock.expectOne(`${AUTH_PATH}/confirm-reset-pin`).flush({
      data: { accessToken: 'a-rst', refreshToken: 'r-rst', user: USER_JSON },
    });
    expect((await pResetConf)?.id).toBe('u-repo-1');

    const pChg = repo.changerPin('9876', '4321');
    httpMock.expectOne(`${AUTH_PATH}/change-pin`).flush({ data: { sessionsFermees: 2 } });
    expect(await pChg).toBe(2);

    const pLogout = repo.logout(true);
    httpMock.expectOne(`${AUTH_PATH}/logout`).error(new ProgressEvent('offline'));
    await pLogout;
    expect(storage.getToken()).toBeNull();
    expect(stockageStub.purgerToutLeStockageLocal).toHaveBeenCalled();

    await repo.forgetDevice();
    await expect(repo.verifyOtp('123456')).rejects.toBeInstanceOf(Failure);
  });
});
