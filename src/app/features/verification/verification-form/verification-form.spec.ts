import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { VerificationForm } from './verification-form';
import { AuthService } from '../../../core/auth';
import { UserModel, NiveauEtude, Cycle, Langue } from '../../../core/models';
import { AppRoutes } from '../../../core/router';

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('VerificationForm', () => {
  const utilisateur: UserModel = {
    id: 'u1',
    email: 'atangana@yahoo.com',
    nom: 'Atangana',
    prenom: 'Paul',
    universite: 'Saint Jean Ingénieur (SJI)',
    filiere: 'Informatique',
    niveau: NiveauEtude.n3,
    cycle: Cycle.ingenieur,
    langue: Langue.fr,
  };

  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            state: () => ({ user: utilisateur }),
            sortir: () => Promise.resolve(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  });

  it('charge les types et redirige si le dossier est déjà en attente', async () => {
    const fixture = TestBed.createComponent(VerificationForm);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/references/justificatif-types').flush({
      data: [{ value: 'PV_REUSSITE', label: 'PV de réussite' }],
    });
    http.expectOne('/api/verification/requests/me').flush({
      data: { statut: 'en_attente', requis: true },
    });
    await tick();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/' + AppRoutes.verificationPending, { replaceUrl: true });
    http.verify();
  });

  it('redirige vers attente lors d’une réponse 409 conflict à la soumission', async () => {
    const fixture = TestBed.createComponent(VerificationForm);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/references/justificatif-types').flush({
      data: [{ value: 'PV_REUSSITE', label: 'PV de réussite' }],
    });
    http.expectOne('/api/verification/requests/me').flush({
      data: { statut: null, requis: true },
    });
    await tick();

    component['justificatifType'].set('PV_REUSSITE');
    component['file'].set(new File(['dummy'], 'justif.pdf', { type: 'application/pdf' }));

    const submitPromise = component['submit']();
    await tick();

    const req = http.expectOne('/api/verification/requests');
    expect(req.request.method).toBe('POST');
    req.flush(
      { error: { code: 'CONFLICT', message: 'Un dossier est déjà en cours de traitement.' } },
      { status: 409, statusText: 'Conflict' },
    );
    await submitPromise;
    await tick();

    http.expectOne('/api/verification/requests/me').flush({ data: { statut: 'en_attente', requis: true } });
    await tick();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/' + AppRoutes.verificationPending, { replaceUrl: true });
    http.verify();
  });

  it('affiche le message d’erreur retourné par le serveur en cas d’échec 400', async () => {
    const fixture = TestBed.createComponent(VerificationForm);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/references/justificatif-types').flush({ data: [] });
    http.expectOne('/api/verification/requests/me').flush({ data: { statut: null, requis: true } });
    await tick();

    component['justificatifType'].set('PV_REUSSITE');
    component['file'].set(new File(['dummy'], 'justif.pdf', { type: 'application/pdf' }));

    const submitPromise = component['submit']();
    await tick();

    const req = http.expectOne('/api/verification/requests');
    req.flush(
      { error: { code: 'BAD_REQUEST', message: 'Formats acceptés : PDF, JPG, PNG' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await submitPromise;
    await tick();

    expect(component['error']()).toBe('Formats acceptés : PDF, JPG, PNG');
    http.verify();
  });
});
