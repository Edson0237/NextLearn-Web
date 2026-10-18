import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { NiveauEtude } from '../models/user.model';

/**
 * Ce que ces tests protègent : le garde de `register()` (des infos
 * d'inscription perdues doivent produire un message qui dit quoi faire,
 * jamais une erreur générique qui laisse croire à une panne serveur), et
 * le fait qu'une connexion réussie efface complètement l'état d'avant
 * (`AuthState` neuf, pas une rustine sur l'ancien).
 */
describe('AuthService', () => {
  function creer() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    localStorage.clear();
    const service = TestBed.inject(AuthService);
    const controller = TestBed.inject(HttpTestingController);
    return { service, controller };
  }

  it('démarre en initialisation, puis se stabilise sans session', async () => {
    const { service, controller } = creer();
    expect(service.state().isInitializing).toBe(true);

    // Pas de requête HTTP attendue : sans jeton stocké, `restoreSession`
    // ne part jamais en réseau.
    await new Promise((r) => setTimeout(r, 1600));

    expect(service.state().isInitializing).toBe(false);
    expect(service.state().user).toBeUndefined();
    controller.verify();
  }, 3000);

  it('register refuse d’envoyer des informations incomplètes', async () => {
    const { service, controller } = creer();
    await new Promise((r) => setTimeout(r, 1600));

    service.savePersonalInfo('a@b.cm', 'Nkeng', 'Awa');
    // Les informations académiques manquent volontairement.

    const ok = await service.register();

    expect(ok).toBe(false);
    expect(service.state().error).toContain('perdues');
    controller.expectNone('/api/auth/register');
    controller.verify();
  }, 3000);

  it('register part bien quand toutes les informations sont là', async () => {
    const { service, controller } = creer();
    await new Promise((r) => setTimeout(r, 1600));

    service.savePersonalInfo('a@b.cm', 'Nkeng', 'Awa');
    service.saveAcademicInfo('ISJ', 'ISI', NiveauEtude.n3);

    const promesse = service.register();
    const requete = controller.expectOne('/api/auth/register');
    requete.flush({ data: { tempToken: 'jeton-temporaire' } });

    expect(await promesse).toBe(true);
    expect(service.state().parcoursOtp).toBe('inscription');
    controller.verify();
  }, 3000);

  it('logout repart d’un état entièrement neuf', async () => {
    const { service, controller } = creer();
    await new Promise((r) => setTimeout(r, 1600));

    service.savePersonalInfo('a@b.cm', 'Nkeng', 'Awa');

    const promesse = service.logout();
    controller.expectOne('/api/auth/logout').flush({});
    await promesse;

    expect(service.state().pendingEmail).toBeUndefined();
    expect(service.state().user).toBeUndefined();
    controller.verify();
  }, 3000);
});
