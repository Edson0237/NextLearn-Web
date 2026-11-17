import { HttpClient, HttpHeaders, HttpRequest, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DELAIS_BACKOFF_5XX,
  SessionExpiredService,
  authInterceptor,
  estRequeteRejouable,
} from '..';
import { SecureStorageService } from '../../storage';

describe('authInterceptor - backoff 5xx (P14)', () => {
  it('expose les délais exponentiels par défaut [1000, 2000, 4000, 8000]', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(DELAIS_BACKOFF_5XX)).toEqual([1000, 2000, 4000, 8000]);
  });

  it('estRequeteRejouable autorise uniquement GET/HEAD/OPTIONS sans FormData ni /auth/refresh', () => {
    expect(estRequeteRejouable(new HttpRequest('GET', '/api/v2/catalogue'))).toBe(true);
    expect(estRequeteRejouable(new HttpRequest('HEAD', '/api/health'))).toBe(true);
    expect(estRequeteRejouable(new HttpRequest('OPTIONS', '/api/v2/catalogue'))).toBe(true);
    expect(estRequeteRejouable(new HttpRequest('GET', '/api/auth/refresh'))).toBe(false);
    expect(estRequeteRejouable(new HttpRequest('POST', '/api/submissions', new FormData()))).toBe(false);
    expect(estRequeteRejouable(new HttpRequest('POST', '/api/auth/login', {}))).toBe(false);
    expect(estRequeteRejouable(new HttpRequest('PUT', '/api/v2/me/section', {}))).toBe(false);
    expect(estRequeteRejouable(new HttpRequest('DELETE', '/api/favoris/1'))).toBe(false);
  });

  function setup(delais: readonly number[] = [1, 1, 1, 1]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: DELAIS_BACKOFF_5XX, useValue: delais },
        {
          provide: SecureStorageService,
          useValue: {
            getToken: () => 'jwt-test',
            getTempToken: () => null,
            getRefreshToken: () => null,
            saveToken: () => {},
            saveRefreshToken: () => {},
            clearToken: () => {},
          },
        },
        {
          provide: SessionExpiredService,
          useValue: { signaler: vi.fn(), consommerNotification: vi.fn() },
        },
      ],
    });
    return {
      http: TestBed.inject(HttpClient),
      controller: TestBed.inject(HttpTestingController),
    };
  }

  it('réessaie jusqu à 4 fois une requête GET sur 503 puis réussit à la 5e tentative', async () => {
    const { http, controller } = setup([1, 2, 4, 8]);
    const promesse = firstValueFrom(http.get<{ ok: boolean }>('/api/v2/catalogue'));

    for (let i = 0; i < 4; i++) {
      const req = controller.expectOne('/api/v2/catalogue');
      req.flush({ error: { message: 'Indisponible' } }, { status: 503, statusText: 'Service Unavailable' });
      await new Promise((r) => setTimeout(r, 15));
    }

    const derniere = controller.expectOne('/api/v2/catalogue');
    derniere.flush({ ok: true });

    await expect(promesse).resolves.toEqual({ ok: true });
    controller.verify();
  });

  it('ne réessaie pas un POST FormData sur 503 (dépôt de contribution)', async () => {
    const { http, controller } = setup([1, 2, 4, 8]);
    const fd = new FormData();
    fd.append('titre', 'TD 1');
    const promesse = firstValueFrom(http.post('/api/contributions', fd));

    const req = controller.expectOne('/api/contributions');
    req.flush({ error: { message: 'Erreur serveur' } }, { status: 503, statusText: 'Service Unavailable' });

    await expect(promesse).rejects.toMatchObject({ status: 503 });
    controller.verify();
  });

  it('ne réessaie pas automatiquement une erreur 429 Too Many Requests sur GET', async () => {
    const { http, controller } = setup([1, 2, 4, 8]);
    const promesse = firstValueFrom(http.get('/api/v2/catalogue'));

    const req = controller.expectOne('/api/v2/catalogue');
    req.flush(
      { error: { code: 'RATE_LIMITED', message: 'Trop de requêtes' } },
      { status: 429, statusText: 'Too Many Requests', headers: new HttpHeaders({ 'Retry-After': '10' }) },
    );

    await expect(promesse).rejects.toMatchObject({ status: 429 });
    controller.verify();
  });
});
