import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { SecureStorageService } from '../storage/secure-storage.service';
import { SessionExpiredService } from './session-expired.service';

/**
 * Ce que ce test protège : les deux comportements les plus faciles à
 * casser par accident — ne jamais joindre de jeton sur les routes
 * pré-auth (`/auth/login`, etc., qui portent le leur dans le corps), et ne
 * jamais déclarer une session expirée pour quelqu'un qui n'en a jamais
 * ouvert une (pas de refresh token = rien à expirer).
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let storage: SecureStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(SecureStorageService);
    localStorage.clear();
  });

  afterEach(() => {
    controller.verify();
  });

  it('joint le jeton sur une route ordinaire', () => {
    storage.saveToken('mon-jeton', new Date(Date.now() + 60_000));

    http.get('/api/documents').subscribe();

    const requete = controller.expectOne('/api/documents');
    expect(requete.request.headers.get('Authorization')).toBe('Bearer mon-jeton');
    requete.flush({});
  });

  it('ne joint aucun jeton sur /auth/login', () => {
    storage.saveToken('mon-jeton', new Date(Date.now() + 60_000));

    http.post('/auth/login', {}).subscribe();

    const requete = controller.expectOne('/auth/login');
    expect(requete.request.headers.has('Authorization')).toBe(false);
    requete.flush({});
  });

  it('ne déclare pas de session expirée sans refresh token (401 pré-auth)', () => {
    // Aucun refresh token : c'est exactement le cas de quelqu'un qui tape
    // un code OTP faux avant d'avoir jamais été connecté.
    const sessionExpired = TestBed.inject(SessionExpiredService);
    const espion = vi.fn();
    sessionExpired.expired$.subscribe(espion);

    http.post('/auth/verify-otp', { code: '000000' }).subscribe({ error: () => {} });

    const requete = controller.expectOne('/auth/verify-otp');
    requete.flush({ error: { message: 'Code invalide' } }, { status: 401, statusText: 'Unauthorized' });

    expect(espion).not.toHaveBeenCalled();
  });

  it('transmet le 401 d’une route pré-auth sans tenter de rafraîchir', () => {
    // `/auth/verify-otp` est exclue du rafraîchissement : un code faux n'a
    // rien à voir avec une session à renouveler.
    const fetchEspion = vi.spyOn(globalThis, 'fetch');

    http.post('/auth/verify-otp', {}).subscribe({ error: () => {} });
    controller.expectOne('/auth/verify-otp').flush(
      { error: { message: 'Code invalide' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(fetchEspion).not.toHaveBeenCalled();
    fetchEspion.mockRestore();
  });
});
