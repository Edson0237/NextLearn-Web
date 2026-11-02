import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthRepository } from '../repositories/auth-repository';
import { Consentements } from '../services/consentements';

/**
 * S'inscrire ou se connecter vaut acceptation : le client déclare au serveur les
 * versions en vigueur avec chaque demande qui ouvre une session, et le serveur
 * exige et enregistre. Une demande qui n'en ouvre pas n'en porte pas.
 */
describe('Consentements (client)', () => {
  let cons: Consentements;
  let repo: AuthRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    localStorage.clear();
    cons = TestBed.inject(Consentements);
    repo = TestBed.inject(AuthRepository);
    http = TestBed.inject(HttpTestingController);
  });

  it('déclare les versions déjà chargées, sans détour réseau', async () => {
    void cons.charger();
    http.expectOne('/api/auth/legal-versions').flush({ data: { confidentialite: 'v1', conditions: 'v2' } });
    await vi.waitFor(() => expect(cons.versionsConnues()).toBeDefined());
    const attente = repo.loginWithPin('c@isj.cm', '1234').catch(() => undefined);
    const req = http.expectOne('/api/auth/login');
    expect(req.request.body.consentements).toEqual({ confidentialite: 'v1', conditions: 'v2' });
    req.flush({ error: { code: 'x', message: 'x' } }, { status: 401, statusText: 'Unauthorized' });
    await attente;
  });

  it('parti avant les versions : refusé faute de consentement, il repart une fois avec elles', async () => {
    const attente = repo.loginWithPin('c@isj.cm', '1234').catch(() => undefined);
    const premiere = http.expectOne('/api/auth/login');
    expect(premiere.request.body.consentements).toBeUndefined();
    premiere.flush({ error: { code: 'consent_required', message: 'Accepte.' } }, { status: 403, statusText: 'Forbidden' });
    (await vi.waitFor(() => http.expectOne('/api/auth/legal-versions'))).flush({ data: { confidentialite: 'v1', conditions: 'v2' } });
    const seconde = await vi.waitFor(() => http.expectOne('/api/auth/login'));
    expect(seconde.request.body.consentements).toEqual({ confidentialite: 'v1', conditions: 'v2' });
    seconde.flush({ error: { code: 'x', message: 'x' } }, { status: 401, statusText: 'Unauthorized' });
    await attente;
  });

  it('une demande qui n’ouvre pas de session ne porte pas de consentement', async () => {
    const attente = repo.rafraichirDemandeOtp();
    await attente;
    http.expectNone('/api/auth/legal-versions');
    expect(cons.versionsConnues()).toBeUndefined();
  });
});
