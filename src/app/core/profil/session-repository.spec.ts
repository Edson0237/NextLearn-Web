import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionRepository } from './session-repository';

describe('SessionRepository', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('liste les sessions', async () => {
    const repo = TestBed.inject(SessionRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.lister();
    const req = http.expectOne('/api/auth/sessions');
    req.flush({
      data: [
        { sessionId: 's1', appareil: 'Chrome / Windows', courante: true },
        { sessionId: 's2', appareil: 'iPhone', courante: false },
      ],
    });

    const liste = await promesse;
    expect(liste.length).toBe(2);
    expect(liste[0].courante).toBe(true);
    expect(liste[1].appareil).toBe('iPhone');
    http.verify();
  });

  it('révoque une session par ID', async () => {
    const repo = TestBed.inject(SessionRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.revoquer('s2');
    const req = http.expectOne('/api/auth/sessions/s2');
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await promesse;
    http.verify();
  });

  it('révoque les autres sessions et rend le nombre fermé', async () => {
    const repo = TestBed.inject(SessionRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.revoquerLesAutres();
    const req = http.expectOne('/api/auth/sessions');
    expect(req.request.method).toBe('DELETE');
    req.flush({ data: { fermees: 3 } });

    const ferme = await promesse;
    expect(ferme).toBe(3);
    http.verify();
  });
});
