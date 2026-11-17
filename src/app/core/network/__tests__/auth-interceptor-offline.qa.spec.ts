import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor, DELAIS_BACKOFF_5XX, SessionExpiredService } from '..';
import { SecureStorageService } from '../../storage';
import { LectureProgressRepository, StockageHorsLigne } from '../../bibliotheque';

describe('QA Réseau & Miroir Hors-Ligne (NL-BUG-2026-005)', () => {
  const originalOnLineDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

  function setOnline(val: boolean): void {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => val,
    });
  }

  afterEach(() => {
    if (originalOnLineDesc) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnLineDesc);
    }
    localStorage.clear();
  });

  it('ne réessaie jamais un HTTP 504 sur GET lorsque navigator.onLine est faux (zéro délai 15 s)', async () => {
    setOnline(false);
    const expiredSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: DELAIS_BACKOFF_5XX, useValue: [1000, 2000, 4000, 8000] },
        {
          provide: SecureStorageService,
          useValue: {
            getToken: () => 'jwt-qa',
            getRefreshToken: () => 'ref-qa',
            saveToken: () => {},
            saveRefreshToken: () => {},
            clearToken: () => {},
          },
        },
        {
          provide: SessionExpiredService,
          useValue: { notify: expiredSpy, expired$: { subscribe: () => {} } },
        },
      ],
    });

    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    const p = firstValueFrom(http.get('/api/verification/requests/me'));
    const req = controller.expectOne('/api/verification/requests/me');
    req.flush({ error: { message: 'Gateway Timeout' } }, { status: 504, statusText: 'Gateway Timeout' });

    await expect(p).rejects.toMatchObject({ status: 504 });
    controller.verify();
    expect(expiredSpy).not.toHaveBeenCalled();
  });

  it('LectureProgressRepository lit immédiatement le miroir local sans appel réseau hors ligne', async () => {
    setOnline(false);
    localStorage.setItem(
      'nl_lecture_progress:etu-qa',
      JSON.stringify({
        'doc-1': {
          documentId: 'doc-1',
          pageCourante: 4,
          totalPages: 10,
          derniereLecture: '2026-11-16T10:00:00.000Z',
          tempsTotalSecondes: 60,
        },
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        LectureProgressRepository,
        {
          provide: StockageHorsLigne,
          useValue: { utilisateurActif: () => 'etu-qa' },
        },
      ],
    });

    const repo = TestBed.inject(LectureProgressRepository);
    const controller = TestBed.inject(HttpTestingController);

    const all = await repo.getAll();
    expect(all.get('doc-1')?.pageCourante).toBe(4);

    const one = await repo.getPour('doc-1');
    expect(one?.pageCourante).toBe(4);

    controller.expectNone('/api/progress/lecture');
    controller.expectNone('/api/progress/lecture/doc-1');
    controller.verify();
  });
});
