import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthRepository } from '../repositories/auth-repository';
import { Consentements } from '../services/consentements';

/**
 * Le navigateur ne prouve rien : il déclare, le serveur exige. Ces tests
 * protègent ce que le client doit tenir de son côté - ne rien déclarer sans
 * deux cases cochées, déclarer les versions du serveur, et faire apparaître les
 * cases quand le serveur refuse faute d'acceptation.
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

  it('ne déclare rien tant que les deux cases ne sont pas cochées', async () => {
    expect(await cons.declarer()).toBeUndefined();
    cons.definir('confidentialite', true);
    expect(await cons.declarer()).toBeUndefined();
    http.expectNone('/api/auth/legal-versions');
  });

  it('déclare les versions du serveur, et elles partent avec une demande de session', async () => {
    cons.definir('confidentialite', true);
    cons.definir('conditions', true);
    const attente = repo.loginWithPin('c@isj.cm', '1234').catch(() => undefined);
    await vi.waitFor(() => http.expectOne('/api/auth/legal-versions').flush({ data: { confidentialite: 'v1', conditions: 'v2' } }));
    const req = await vi.waitFor(() => http.expectOne('/api/auth/login'));
    expect(req.request.body.consentements).toEqual({ confidentialite: 'v1', conditions: 'v2' });
    req.flush({ error: { code: 'consent_required', message: 'x' } }, { status: 403, statusText: 'Forbidden' });
    await attente;
  });

  it('un refus « consent_required » du serveur fait apparaître les cases', async () => {
    const attente = repo.loginWithPin('c@isj.cm', '1234').catch(() => undefined);
    http.expectOne('/api/auth/login').flush(
      { error: { code: 'consent_required', message: 'Accepte les documents.' } },
      { status: 403, statusText: 'Forbidden' },
    );
    await attente;
    expect(cons.requis()).toBe(true);
  });
});
