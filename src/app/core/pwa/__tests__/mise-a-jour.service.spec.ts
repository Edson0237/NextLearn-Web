import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiseAJourService } from '../services/mise-a-jour.service';

describe('MiseAJourService', () => {
  let versions: Subject<unknown>;
  let irrecuperable: Subject<unknown>;
  let routerEvents: Subject<unknown>;
  let sw: {
    isEnabled: boolean;
    versionUpdates: Subject<unknown>;
    unrecoverable: Subject<unknown>;
    checkForUpdate: ReturnType<typeof vi.fn>;
    activateUpdate: ReturnType<typeof vi.fn>;
  };
  let recharger: ReturnType<typeof vi.fn<() => void>>;
  let onLineDescriptor: PropertyDescriptor | undefined;
  let visibilityDescriptor: PropertyDescriptor | undefined;

  function setOnLine(enLigne: boolean): void {
    Object.defineProperty(navigator, 'onLine', { value: enLigne, configurable: true });
  }

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  }

  function creer(isEnabled = true, avecRouter = false) {
    sw.isEnabled = isEnabled;
    const providers: unknown[] = [{ provide: SwUpdate, useValue: sw }];
    if (avecRouter) {
      providers.push({ provide: Router, useValue: { events: routerEvents } });
    }
    TestBed.configureTestingModule({ providers });
    const s = TestBed.inject(MiseAJourService);
    recharger = vi.fn<() => void>();
    (s as unknown as { recharger: () => void }).recharger = recharger;
    return s;
  }

  const prete = () => versions.next({ type: 'VERSION_READY' });
  const vide = () => new Promise((r) => setTimeout(r));

  beforeEach(() => {
    onLineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    sessionStorage.clear();
    localStorage.clear();
    versions = new Subject();
    irrecuperable = new Subject();
    routerEvents = new Subject();
    sw = {
      isEnabled: true,
      versionUpdates: versions,
      unrecoverable: irrecuperable,
      checkForUpdate: vi.fn(async () => false),
      activateUpdate: vi.fn(async () => true),
    };
    setOnLine(true);
    setVisibility('visible');
    history.replaceState({}, '', '/');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    if (onLineDescriptor) Object.defineProperty(navigator, 'onLine', onLineDescriptor);
    else delete (navigator as unknown as Record<string, unknown>)['onLine'];
    if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
    else delete (document as unknown as Record<string, unknown>)['visibilityState'];
  });

  it('vérifie les nouvelles versions dès le démarrage', () => {
    creer();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien quand le service worker est désactivé', () => {
    creer(false);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });

  it('sur une page publique, recharge directement sur VERSION_READY sans bloquer sur activateUpdate', async () => {
    creer();
    prete();
    await vide();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('dans l’application sans interaction active, recharge d’office automatiquement', async () => {
    history.replaceState({}, '', '/app/home');
    creer();
    prete();
    await vide();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('dans l’application après interaction, temporise jusqu’à la navigation puis applique sans activateUpdate', async () => {
    history.replaceState({}, '', '/app/home');
    const s = creer(true, true);
    window.dispatchEvent(new Event('pointerdown'));

    prete();
    await vide();
    expect(recharger).not.toHaveBeenCalled();
    expect(s.disponible()).toBe(true);

    routerEvents.next(new NavigationEnd(1, '/app/bibliotheque', '/app/bibliotheque'));
    await vide();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/app/depots/scanner',
    '/app/depots/nouveau',
    '/app/login',
    '/app/register',
    '/app/compte/email',
  ])('sur la zone sensible %s, temporise jusqu’à la sortie vers un écran sûr', async (routeSensible) => {
    history.replaceState({}, '', routeSensible);
    const s = creer();
    prete();
    await vide();
    expect(recharger).not.toHaveBeenCalled();
    expect(s.disponible()).toBe(true);

    s.appliquerSiMomentSur('/app/home');
    await vide();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('le bandeau applique la mise à jour sur geste explicite et bloque les doubles clics', async () => {
    history.replaceState({}, '', '/app/depots/scanner');
    const s = creer();
    prete();
    expect(s.disponible()).toBe(true);

    await s.appliquer();
    await s.appliquer();
    expect(sw.activateUpdate).not.toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(s.disponible()).toBe(false);
    expect(s.rechargementEnCours()).toBe(true);
  });

  it('ne boucle pas : un second rechargement automatique rapproché devient un bandeau', async () => {
    const s = creer();
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);

    // Simule un contexte ou la navigation ne s'est pas encore dechargee (rechargementEnCours reinitialise)
    (s as unknown as { rechargementEnCours: { set: (v: boolean) => void } }).rechargementEnCours.set(false);
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(s.disponible()).toBe(true);
  });

  it('recharge quand le cache du service worker est irrécupérable et évite les boucles', () => {
    const s = creer();
    irrecuperable.next({ reason: 'hash mismatch' });
    expect(recharger).toHaveBeenCalledTimes(1);

    irrecuperable.next({ reason: 'hash mismatch' });
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(s.disponible()).toBe(true);
  });

  it('suit VERSION_DETECTED puis réinitialise sans annoncer en cas de VERSION_INSTALLATION_FAILED', () => {
    const s = creer();
    versions.next({ type: 'VERSION_DETECTED' });
    expect(s.installationEnCours()).toBe(true);

    versions.next({ type: 'VERSION_INSTALLATION_FAILED' });
    expect(s.installationEnCours()).toBe(false);
    expect(s.disponible()).toBe(false);
  });

  it('protège checkForUpdate contre les déclenchements simultanés (focus + pageshow + visibilitychange)', async () => {
    let resoudre!: (v: boolean) => void;
    sw.checkForUpdate = vi.fn(
      () =>
        new Promise<boolean>((r) => {
          resoudre = r;
        }),
    );

    const s = creer();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(s.verificationEnCours()).toBe(true);

    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    document.dispatchEvent(new Event('visibilitychange'));

    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    resoudre(false);
    await vide();
    expect(s.verificationEnCours()).toBe(false);
  });

  it('gère une interruption réseau puis relance checkForUpdate au retour de la connexion', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const s = creer();
    await vide();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);

    versions.next({ type: 'VERSION_DETECTED' });
    expect(s.installationEnCours()).toBe(true);

    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(s.installationEnCours()).toBe(false);

    vi.setSystemTime(Date.now() + 2_000);
    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    await vide();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('après un échec VERSION_INSTALLATION_FAILED, retente sans attendre le délai normal au retour online', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    creer();
    await vide();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);

    versions.next({ type: 'VERSION_INSTALLATION_FAILED' });
    vi.setSystemTime(Date.now() + 2_000);
    window.dispatchEvent(new Event('online'));
    await vide();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('préserve la session et le stockage local lors d’un rechargement de mise à jour', async () => {
    localStorage.setItem('nl_session_token', 'jwt-test');
    history.replaceState({}, '', '/app/home');
    creer();
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('nl_session_token')).toBe('jwt-test');
  });

  describe('reprise premier plan (Android & iOS Safari / PWA)', () => {
    async function prepareeEtEnAttente(chemin = '/app/depots/scanner') {
      history.replaceState({}, '', chemin);
      const s = creer();
      prete();
      await vide();
      expect(s.disponible()).toBe(true);
      expect(recharger).not.toHaveBeenCalled();
      return s;
    }

    it('un changement d’écran applique la version prête sans appel bloquant à activateUpdate', async () => {
      const s = await prepareeEtEnAttente();
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(sw.activateUpdate).not.toHaveBeenCalled();
      expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('temporisé tant qu’on reste sur le scanner', async () => {
      const s = await prepareeEtEnAttente();
      s.appliquerSiMomentSur('/app/depots/scanner');
      await vide();
      expect(recharger).not.toHaveBeenCalled();
      expect(s.disponible()).toBe(true);
    });

    it('rien à appliquer : un changement d’écran ne recharge pas', async () => {
      history.replaceState({}, '', '/app/home');
      const s = creer();
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });

    it('le retour dans l’application après une absence via visibilitychange applique la version prête', async () => {
      await prepareeEtEnAttente();
      history.replaceState({}, '', '/app/home');
      vi.useFakeTimers({ toFake: ['Date'] });
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.setSystemTime(Date.now() + 60_000);
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await vide();
      expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('une restauration iOS BFCache (pageshow persisted) vérifie et applique la mise à jour', async () => {
      await prepareeEtEnAttente();
      history.replaceState({}, '', '/app/home');
      const appelsAvant = sw.checkForUpdate.mock.calls.length;

      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      await vide();
      expect(sw.checkForUpdate.mock.calls.length).toBeGreaterThan(appelsAvant);
      expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('un retour focus après longue inactivité sans visibilitychange("hidden") applique la mise à jour', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      await prepareeEtEnAttente();
      history.replaceState({}, '', '/app/home');
      vi.setSystemTime(Date.now() + 3_600_000);

      window.dispatchEvent(new Event('focus'));
      await vide();
      expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('un simple va-et-vient de quelques secondes ne recharge pas', async () => {
      await prepareeEtEnAttente();
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });

    it('jamais deux rechargements automatiques rapprochés', async () => {
      const s = await prepareeEtEnAttente();
      sessionStorage.setItem('nl_maj_rechargee_a', String(Date.now()));
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });
  });
});
