import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { AppRoutes } from './app-routes';
import { authGuard } from './auth.guard';
import { AuthService } from '../auth/auth.service';
import { PendingDestinationService } from './pending-destination.service';

/**
 * Ce que ce test protège : la précédence exacte de `RouterNotifier.redirect`
 * (`app_router.dart`) — le point que l'audit Phase 1 avait lui-même signalé
 * comme « la logique de routage la plus fine à porter fonction par
 * fonction, pas en esprit ». Un ordre de conditions inversé laisserait
 * passer un lien profond pendant l'initialisation, ou enverrait un
 * compte verrouillé ailleurs qu'au PIN.
 */
describe('authGuard', () => {
  function monterRouteur() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'app',
            children: [
              {
                path: '',
                canActivateChild: [authGuard],
                children: [
                  { path: '', children: [] },
                  { path: AppRoutes.onboarding, children: [] },
                  { path: AppRoutes.login, children: [] },
                  { path: AppRoutes.loginOtp, children: [] },
                  { path: AppRoutes.unlock, children: [] },
                  { path: AppRoutes.resetPin, children: [] },
                  { path: AppRoutes.home, children: [] },
                  { path: AppRoutes.recours, children: [] },
                  { path: AppRoutes.verificationForm, children: [] },
                  { path: AppRoutes.verificationPending, children: [] },
                ],
              },
            ],
          },
        ]),
      ],
    });
    return {
      router: TestBed.inject(Router),
      location: TestBed.inject(Location),
      auth: TestBed.inject(AuthService),
    };
  }

  /** Force l'état directement — plus rapide et plus sûr que d'attendre
   * `init()` (délai de 1,5 s, appel réseau) pour chaque cas. */
  function forcerEtat(auth: AuthService, partiel: Record<string, unknown>): void {
    const prive = auth as unknown as { patch: (p: Record<string, unknown>) => void };
    prive.patch(partiel);
  }

  it('attend la fin de l’initialisation puis redirige depuis le splash', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, { isInitializing: true });

    const navigation = router.navigateByUrl('/app');
    forcerEtat(auth, { isInitializing: false, isFirstLaunch: true });

    await navigation;

    expect(location.path()).toBe(`/app/${AppRoutes.onboarding}`);
  });

  it('un compte neuf sans session part sur l’onboarding', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, { isInitializing: false, isFirstLaunch: true });

    await router.navigateByUrl('/app');

    expect(location.path()).toBe(`/app/${AppRoutes.onboarding}`);
  });

  it('un compte déjà vu sans session part sur la connexion', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, { isInitializing: false, isFirstLaunch: false });

    await router.navigateByUrl('/app');

    expect(location.path()).toBe(`/app/${AppRoutes.login}`);
  });

  it('un compte verrouillé ne peut atteindre que le PIN local', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, {
      isInitializing: false,
      user: { id: '1', email: 'a@b.cm', nom: 'N', prenom: 'P', universite: 'U', filiere: 'F', niveau: 'n1', langue: 'fr' },
      isLocked: true,
    });

    await router.navigateByUrl(`/app/${AppRoutes.home}`);

    expect(location.path()).toBe(`/app/${AppRoutes.unlock}`);
  });

  it('la récupération du PIN reste atteignable même verrouillé', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, {
      isInitializing: false,
      user: { id: '1', email: 'a@b.cm', nom: 'N', prenom: 'P', universite: 'U', filiere: 'F', niveau: 'n1', langue: 'fr' },
      isLocked: true,
    });

    await router.navigateByUrl(`/app/${AppRoutes.resetPin}`);

    expect(location.path()).toBe(`/app/${AppRoutes.resetPin}`);
  });

  it('une démarche OTP ouverte retient sur son écran', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, { isInitializing: false, parcoursOtp: 'connexion' });

    // Même en tentant d'aller ailleurs (ici, directement `/app`).
    await router.navigateByUrl('/app');

    expect(location.path()).toBe(`/app/${AppRoutes.loginOtp}`);
  });

  it('une fois authentifié, les routes publiques renvoient à l’accueil', async () => {
    const { router, location, auth } = monterRouteur();
    forcerEtat(auth, {
      isInitializing: false,
      user: { id: '1', email: 'a@b.cm', nom: 'N', prenom: 'P', universite: 'U', filiere: 'F', niveau: 'n1', langue: 'fr' },
    });

    await router.navigateByUrl(`/app/${AppRoutes.login}`);

    expect(location.path()).toBe(`/app/${AppRoutes.home}`);
  });

  it('reprend la destination en attente après authentification', async () => {
    const { router, location, auth } = monterRouteur();
    TestBed.inject(PendingDestinationService).set(AppRoutes.recours);
    forcerEtat(auth, { isInitializing: false, isFirstLaunch: false });

    // Non authentifié sur une route protégée : renvoyé vers la connexion
    // (la destination n'est pas encore consommée).
    await router.navigateByUrl(`/app/${AppRoutes.home}`);
    expect(location.path()).toBe(`/app/${AppRoutes.login}`);

    forcerEtat(auth, {
      user: { id: '1', email: 'a@b.cm', nom: 'N', prenom: 'P', universite: 'U', filiere: 'F', niveau: 'n1', langue: 'fr' },
    });
    // Un retour au splash, pas une re-navigation vers `/app/login` : le
    // routeur ignore par défaut une navigation vers l'URL déjà courante,
    // et ce n'est de toute façon pas ainsi qu'une connexion réussie
    // redéclenche la résolution de la destination en attente.
    await router.navigateByUrl('/app');

    expect(location.path()).toBe(`/app/${AppRoutes.recours}`);
  });
});
