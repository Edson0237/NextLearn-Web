import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Ce que ces tests protègent : `handleGoogleAuthResponse` est le **seul**
 * endroit qui route sur la réponse de `POST /auth/google` — quel que soit
 * l'écran d'où part l'appel —, et il ne route que sur `status`.
 */
describe('AuthService — réponses de /auth/google', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let aller: ReturnType<typeof vi.fn>;
  let allerParUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    aller = vi.fn(async () => true);
    allerParUrl = vi.fn(async () => true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: aller, navigateByUrl: allerParUrl } },
      ],
    });
    localStorage.clear();
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    await new Promise((r) => setTimeout(r, 1600)); // fin de l'initialisation (aucune session à restaurer)
  });

  const session = (extra: object = {}) => ({
    status: 'authenticated', accessToken: 'a', refreshToken: 'r', expiresIn: 900,
    user: { id: 'u1', email: 'c@isj.cm', nom: 'D', prenom: 'C', universite: 'ISJ', filiere: 'Info', niveau: 'N2' },
    ...extra,
  });

  async function appeler(reponse: { status: number; corps: object }) {
    const p = service.connexionGoogle('jeton-assez-long-pour-passer');
    const req = http.expectOne('/api/auth/google');
    if (reponse.status === 200) req.flush({ data: reponse.corps });
    else req.flush({ error: reponse.corps }, { status: reponse.status, statusText: 'x' });
    return p;
  }

  it('authenticated sans verificationStatus → accueil, une fois l’état de vérification lu', async () => {
    const p = service.connexionGoogle('jeton-assez-long-pour-passer');
    http.expectOne('/api/auth/google').flush({ data: session() });
    // Lu AVANT de naviguer : un compte « requis » (adresse non institutionnelle) doit être aiguillé par la garde.
    await vi.waitFor(() => http.expectOne('/api/verification/requests/me').flush({ data: { requis: false, statut: null } }));
    expect(await p).toBeNull();
    expect(aller).toHaveBeenCalledWith(['/app', 'home']);
    expect(service.state().user?.email).toBe('c@isj.cm');
  });

  it('authenticated + pending → page d’attente, pas l’accueil', async () => {
    const p = service.connexionGoogle('jeton-assez-long-pour-passer');
    http.expectOne('/api/auth/google').flush({ data: session({ verificationStatus: 'pending' }) });
    // L'état de vérification est lu AVANT de naviguer : la garde de routage s'y fie.
    await vi.waitFor(() => http.expectOne('/api/verification/requests/me').flush({ data: { requis: true, statut: 'en_attente' } }));
    await p;
    expect(allerParUrl).toHaveBeenCalledWith('/app/verification/attente');
    expect(aller).not.toHaveBeenCalledWith(['/app', 'home']);
  });

  it('pin_required → choix du PIN', async () => {
    await appeler({ status: 200, corps: { status: 'pin_required', userId: 'u1', tempToken: 'tt', expiresIn: 900 } });
    expect(allerParUrl).toHaveBeenCalledWith('/app/register/pin-setup');
  });

  it('new_profile_incomplete → « Plus qu’une étape », identité gardée en mémoire', async () => {
    await appeler({
      status: 200,
      corps: { status: 'new_profile_incomplete', email: 'c@isj.cm', googleSub: 'g-1', tempToken: 'tt', expiresIn: 900, profil: { prenom: 'Camille', nom: 'Djomo' } },
    });
    expect(aller).toHaveBeenCalledWith(['/app', 'register']);
    expect(service.profilGoogle()).toMatchObject({ email: 'c@isj.cm', googleSub: 'g-1' });
  });

  it('domain_not_allowed → rend le refus à afficher sous le bouton, sans naviguer', async () => {
    const refus = await appeler({ status: 403, corps: { code: 'domain_not_allowed', message: 'Ce compte Google n’appartient pas à un établissement autorisé.' } });
    expect(refus).toMatchObject({ code: 'domain_not_allowed' });
    expect(refus?.message).toContain('établissement autorisé');
    expect(aller).not.toHaveBeenCalled();
    expect(allerParUrl).not.toHaveBeenCalled();
  });

  it('account_banned → rend le refus avec son code, que le bouton montre en plein écran', async () => {
    const refus = await appeler({ status: 403, corps: { code: 'account_banned', message: 'Votre compte a été banni. Contactez un administrateur.' } });
    expect(refus).toMatchObject({ code: 'account_banned', message: 'Votre compte a été banni. Contactez un administrateur.' });
    expect(service.state().user).toBeUndefined();
  });

  it('register : le verrou du serveur (use_google_auth) est exposé à l’écran, avec son message', async () => {
    service.savePersonalInfo('camille@isj.cm', 'Djomo', 'Camille');
    service.saveAcademicInfo('ISJ', 'Info', 'n2' as never);
    const p = service.register(false);
    http.expectOne('/api/auth/register').flush(
      { error: { code: 'use_google_auth', message: 'Cette adresse est gérée par Google : utilise « Continuer avec Google ».' } },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(await p).toBe(false);
    expect(service.codeErreurInscription()).toBe('use_google_auth');
    expect(service.state().error).toContain('Continuer avec Google');
  });
});
