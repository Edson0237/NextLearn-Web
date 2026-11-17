import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor, SessionExpiredService } from '../index';
import { SecureStorageService } from '../../storage';

describe('authInterceptor - fin de session avec motif (Chantier P2)', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let storage: SecureStorageService;
  let sessionExpired: SessionExpiredService;
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    storage = TestBed.inject(SecureStorageService);
    sessionExpired = TestBed.inject(SessionExpiredService);
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    controller.verify();
    localStorage.clear();
  });

  it('transmet le motif précis du refresh en 401 et ne boucle jamais', async () => {
    storage.saveToken('expired-jwt', new Date(Date.now() + 60_000));
    storage.saveRefreshToken('refresh-123');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session fermée par sécurité : un ancien jeton a été réutilisé. Reconnecte-toi.',
        },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promesse = firstValueFrom(http.get('/api/profile'));
    const req = controller.expectOne('/api/profile');
    req.flush(
      { error: { code: 'UNAUTHORIZED', message: 'Token expiré' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(promesse).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sessionExpired.consommerMotif()).toBe(
      'Session fermée par sécurité : un ancien jeton a été réutilisé. Reconnecte-toi.',
    );
    // Une fois consommé, le motif est effacé
    expect(sessionExpired.consommerMotif()).toBeNull();
  });

  it('traduit « Refresh token invalide ou révoqué » en « Ta session s’est terminée. Reconnecte-toi. »', async () => {
    storage.saveToken('expired-jwt', new Date(Date.now() + 60_000));
    storage.saveRefreshToken('refresh-banal');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token invalide ou révoqué',
        },
      }),
    }) as unknown as typeof fetch;

    const promesse = firstValueFrom(http.get('/api/profile'));
    const req = controller.expectOne('/api/profile');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(promesse).rejects.toMatchObject({ status: 401 });
    expect(sessionExpired.consommerMotif()).toBe('Ta session s’est terminée. Reconnecte-toi.');
  });
});
