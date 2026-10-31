import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiseAJourService } from './mise-a-jour.service';

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
});
