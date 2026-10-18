import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Otp } from './otp';
import { AuthService } from '../../../core/auth/auth.service';
import { ParcoursOtp } from '../../../core/models/parcours-otp.model';

/**
 * Ce que ce test protège : `estConnexion()` doit lire la démarche
 * mémorisée (`AuthState.parcoursOtp`), jamais le drapeau de la route. La
 * source documente l'incident précis que cet ordre évite — un jeton de
 * connexion envoyé à la vérification d'inscription, refusé par le serveur
 * sur le type du jeton sans jamais lire les six chiffres, affichant « code
 * incorrect » à quelqu'un qui avait saisi le bon code.
 */
describe('Otp — estConnexion', () => {
  function creer(isLogin2faParRoute: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { isLogin2fa: isLogin2faParRoute } } } },
      ],
    });
    const fixture = TestBed.createComponent(Otp);
    return { component: fixture.componentInstance, auth: TestBed.inject(AuthService) };
  }

  function forcerParcours(auth: AuthService, parcours: ParcoursOtp | undefined): void {
    (auth as unknown as { patch: (p: Record<string, unknown>) => void }).patch({ parcoursOtp: parcours });
  }

  it('une démarche de connexion mémorisée prime sur une route d’inscription', () => {
    const { component, auth } = creer(false);
    forcerParcours(auth, ParcoursOtp.connexion);
    expect(component['estConnexion']()).toBe(true);
  });

  it('une démarche d’inscription mémorisée prime sur une route de 2FA', () => {
    const { component, auth } = creer(true);
    forcerParcours(auth, ParcoursOtp.inscription);
    expect(component['estConnexion']()).toBe(false);
  });

  it('sans démarche mémorisée, retombe sur le drapeau de la route (inscription)', () => {
    const { component } = creer(false);
    expect(component['estConnexion']()).toBe(false);
  });

  it('sans démarche mémorisée, retombe sur le drapeau de la route (2FA)', () => {
    const { component } = creer(true);
    expect(component['estConnexion']()).toBe(true);
  });
});
