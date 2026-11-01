import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthRepository } from '../repositories/auth-repository';
import { SecureStorageService } from '../../storage';
import { ParcoursOtp } from '../../models';

/**
 * Ce que ces tests protègent : « Se connecter avec Google » n'ouvre une session
 * que quand le serveur le dit, ne garde rien d'une première visite qui n'a pas
 * abouti, et n'envoie jamais l'identité autrement que par le jeton du serveur.
 */
describe('AuthRepository - connexion Google', () => {
  let repo: AuthRepository;
  let http: HttpTestingController;
  let storage: SecureStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    localStorage.clear();
    repo = TestBed.inject(AuthRepository);
    http = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(SecureStorageService);
  });

  const reponseSession = {
    status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900,
    user: { id: 'u1', email: 'c@isj.cm', nom: 'Djomo', prenom: 'Camille', universite: 'ISJ', filiere: 'Info', niveau: 'N2' },
  };

  it('ne propose Google que si le serveur l’active ET donne un identifiant client', async () => {
    const a = repo.configGoogle();
    http.expectOne('/api/auth/google/config').flush({ data: { enabled: true, clientId: 'id.apps.googleusercontent.com' } });
    expect(await a).toEqual({ enabled: true, clientId: 'id.apps.googleusercontent.com' });

    const b = repo.configGoogle();
    http.expectOne('/api/auth/google/config').flush({ data: { enabled: true } });
    expect((await b).enabled).toBe(false);
  });

  it('reste muet quand le serveur est injoignable : l’écran garde le parcours par code', async () => {
    const c = repo.configGoogle();
    http.expectOne('/api/auth/google/config').error(new ProgressEvent('error'));
    expect(await c).toEqual({ enabled: false });
  });

  it('authenticated : ouvre la session et envoie l’appareil avec le jeton', async () => {
    const p = repo.connexionGoogle('jeton-google');
    const req = http.expectOne('/api/auth/google');
    expect(req.request.body.idToken).toBe('jeton-google');
    expect(req.request.body.deviceId).toBeTruthy();
    req.flush({ data: reponseSession });
    expect(await p).toEqual({ status: 'authenticated' });
    expect(storage.getToken()).toBe('a');
    expect(storage.getUser()?.email).toBe('c@isj.cm');
  });

  it('authenticated + verificationStatus pending : le statut est transmis à l’aiguilleur', async () => {
    const p = repo.connexionGoogle('jeton');
    http.expectOne('/api/auth/google').flush({ data: { ...reponseSession, verificationStatus: 'pending' } });
    expect(await p).toEqual({ status: 'authenticated', verificationStatus: 'pending' });
  });

  it('new_profile_incomplete : garde l’identité en attente, sans ouvrir de session', async () => {
    const p = repo.connexionGoogle('jeton');
    http.expectOne('/api/auth/google').flush({
      data: { status: 'new_profile_incomplete', email: 'camille@isj.cm', googleSub: 'g-1', tempToken: 'tt', expiresIn: 900, profil: { prenom: 'Camille', nom: 'Djomo' } },
    });
    const issue = await p;
    expect(issue.status).toBe('new_profile_incomplete');
    expect(storage.getToken()).toBeFalsy();
    expect(repo.profilGoogleEnAttente?.tempToken).toBe('tt');
    expect(repo.profilGoogleEnAttente?.profil).toMatchObject({ email: 'camille@isj.cm', googleSub: 'g-1', prenom: 'Camille' });
  });

  it('pin_required : prépare le choix du PIN avec le jeton du serveur', async () => {
    const p = repo.connexionGoogle('jeton');
    http.expectOne('/api/auth/google').flush({ data: { status: 'pin_required', userId: 'u1', tempToken: 'tt-pin', expiresIn: 900 } });
    expect(await p).toEqual({ status: 'pin_required' });
    expect(storage.getTempToken()).toBe('tt-pin');
    expect(storage.getParcoursOtp()).toBe(ParcoursOtp.definitionPin);
  });

  it('termine l’inscription avec le jeton signé et le seul parcours scolaire : ni adresse, ni identifiant Google', async () => {
    const a = repo.connexionGoogle('jeton');
    http.expectOne('/api/auth/google').flush({
      data: { status: 'new_profile_incomplete', email: 'c@isj.cm', googleSub: 'g-1', tempToken: 'tt', expiresIn: 900, profil: { prenom: 'C', nom: 'D' } },
    });
    await a;

    const b = repo.inscriptionGoogle({ universite: 'ISJ', filiere: 'Info', niveau: 'N2' });
    const req = http.expectOne('/api/auth/google/inscription');
    // Le tampon de l'appareil accompagne la demande ; l'identité, elle, n'y est jamais.
    expect(req.request.body).toMatchObject({ tempToken: 'tt', universite: 'ISJ', filiere: 'Info', niveau: 'N2' });
    expect(req.request.body.email).toBeUndefined();
    expect(req.request.body.googleSub).toBeUndefined();
    // Le PIN est facultatif : l'inscription ouvre directement la session.
    req.flush({
      data: {
        status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900,
        user: { id: 'u2', email: 'c@isj.cm', nom: 'D', prenom: 'C', universite: 'ISJ', filiere: 'Info', niveau: 'N2', hasPin: false },
      },
    });
    expect(await b).toEqual({ status: 'authenticated' });
    expect(repo.profilGoogleEnAttente).toBeNull();
    expect(storage.getTempToken()).toBeFalsy();
    expect(storage.getUser()?.hasPin).toBe(false);
  });

  it('refuse de terminer une inscription dont l’identité a expiré', async () => {
    await expect(repo.inscriptionGoogle({ universite: 'x', filiere: 'y', niveau: 'N1' })).rejects.toThrow();
  });

  it('appareil nouveau d’une adresse Google : aucun code, aucune démarche OTP mémorisée', async () => {
    const p = repo.loginWithPin('c@isj.cm', '7391');
    http.expectOne('/api/auth/login').flush({ data: { otpRequis: true, methode: 'google', tempToken: 'x', expiresIn: 600 } });
    expect(await p).toBe('google');
    expect(storage.getTempToken()).toBeFalsy();
  });
});
