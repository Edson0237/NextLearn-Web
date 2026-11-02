import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiseAJourService } from '../services/mise-a-jour.service';

describe('MiseAJourService', () => {
  let versions: Subject<unknown>;
  let irrecuperable: Subject<unknown>;
  let sw: { isEnabled: boolean; versionUpdates: Subject<unknown>; unrecoverable: Subject<unknown>; checkForUpdate: ReturnType<typeof vi.fn>; activateUpdate: ReturnType<typeof vi.fn> };
  let recharger: ReturnType<typeof vi.fn<() => void>>;

  function creer(isEnabled = true) {
    sw.isEnabled = isEnabled;
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: sw }] });
    const s = TestBed.inject(MiseAJourService);
    recharger = vi.fn<() => void>();
    (s as unknown as { recharger: () => void }).recharger = recharger;
    return s;
  }

  const prete = () => versions.next({ type: 'VERSION_READY' });
  const vide = () => new Promise((r) => setTimeout(r));

  beforeEach(() => {
    sessionStorage.clear();
    versions = new Subject();
    irrecuperable = new Subject();
    sw = {
      isEnabled: true,
      versionUpdates: versions,
      unrecoverable: irrecuperable,
      checkForUpdate: vi.fn(async () => false),
      activateUpdate: vi.fn(async () => true),
    };
    history.replaceState({}, '', '/');
  });
  afterEach(() => TestBed.resetTestingModule());

  it('vérifie les nouvelles versions dès le démarrage', () => {
    creer();
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien quand le service worker est désactivé', () => {
    creer(false);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });

  it('sur une page publique, active et recharge d’office', async () => {
    creer();
    prete();
    await vide();
    expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('dans l’application, recharge d’office tant que l’utilisateur n’a rien touché', async () => {
    history.replaceState({}, '', '/app/home');
    creer();
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('dans l’application, une fois l’utilisateur à l’œuvre, propose au lieu d’imposer', async () => {
    history.replaceState({}, '', '/app/home');
    const s = creer();
    window.dispatchEvent(new Event('pointerdown'));
    prete();
    await vide();
    expect(recharger).not.toHaveBeenCalled();
    expect(s.disponible()).toBe(true);
  });

  it('le bandeau applique la mise à jour sur geste explicite', async () => {
    history.replaceState({}, '', '/app/home');
    const s = creer();
    window.dispatchEvent(new Event('pointerdown'));
    prete();
    await s.appliquer();
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('ne boucle pas : un second rechargement automatique rapproché devient un bandeau', async () => {
    const s = creer();
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);
    prete();
    await vide();
    expect(recharger).toHaveBeenCalledTimes(1);
    expect(s.disponible()).toBe(true);
  });

  it('recharge quand le cache du service worker est irrécupérable', () => {
    creer();
    irrecuperable.next({ reason: 'hash mismatch' });
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('une installation échouée n’annonce rien', () => {
    const s = creer();
    versions.next({ type: 'VERSION_INSTALLATION_FAILED' });
    expect(s.disponible()).toBe(false);
  });

  it('revérifie au retour de la connexion', () => {
    creer();
    window.dispatchEvent(new Event('online'));
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  describe('première occasion sûre', () => {
    async function prepareeEtEnAttente(chemin = '/app/home') {
      history.replaceState({}, '', chemin);
      const s = creer();
      window.dispatchEvent(new Event('pointerdown'));
      prete();
      await vide();
      expect(s.disponible()).toBe(true);
      expect(recharger).not.toHaveBeenCalled();
      return s;
    }

    it('un changement d’écran applique la version prête, sans geste de l’utilisateur', async () => {
      const s = await prepareeEtEnAttente();
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
      expect(recharger).toHaveBeenCalledTimes(1);
    });

    it('jamais sur un écran de saisie : scanner, dépôt, inscription, connexion, changement d’adresse', async () => {
      const s = await prepareeEtEnAttente();
      for (const url of ['/app/depots/scanner', '/app/depots/nouveau', '/app/register/otp', '/app/login', '/app/verification', '/app/compte/email?x=1']) {
        s.appliquerSiMomentSur(url);
      }
      await vide();
      expect(recharger).not.toHaveBeenCalled();
      expect(s.disponible()).toBe(true); // le bandeau reste proposé
    });

    it('rien à appliquer : un changement d’écran ne recharge pas', async () => {
      history.replaceState({}, '', '/app/home');
      const s = creer();
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });

    it('le retour dans l’application après une absence applique la version prête', async () => {
      const s = await prepareeEtEnAttente();
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        vi.setSystemTime(Date.now() + 60_000);
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      } finally {
        vi.useRealTimers();
      }
      await vide();
      expect(recharger).toHaveBeenCalledTimes(1);
      expect(s).toBeTruthy();
    });

    it('un simple va-et-vient de quelques secondes ne recharge pas', async () => {
      await prepareeEtEnAttente();
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });

    it('jamais deux rechargements automatiques à moins d’une minute', async () => {
      const s = await prepareeEtEnAttente();
      sessionStorage.setItem('nl_maj_rechargee_a', String(Date.now()));
      s.appliquerSiMomentSur('/app/bibliotheque');
      await vide();
      expect(recharger).not.toHaveBeenCalled();
    });
  });
});
