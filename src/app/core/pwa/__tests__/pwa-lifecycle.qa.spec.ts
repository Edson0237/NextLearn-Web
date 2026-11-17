import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MiseAJourService } from '../services/mise-a-jour.service';
import { InstallationService } from '../services/installation.service';

describe('QA Cycle de vie PWA & Mises à jour (NL-PWA / E2E-10)', () => {
  let versionUpdates$: Subject<VersionEvent>;
  let checkForUpdateSpy: () => Promise<boolean>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    versionUpdates$ = new Subject<VersionEvent>();
    checkForUpdateSpy = () => Promise.resolve(true);
  });

  it('E2E-10 : détecte VERSION_READY, bloque les boucles de rechargement rapide et n’entre jamais en boucle infinie', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        MiseAJourService,
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: versionUpdates$.asObservable(),
            unrecoverable: new Subject().asObservable(),
            checkForUpdate: checkForUpdateSpy,
            activateUpdate: () => Promise.resolve(true),
          },
        },
      ],
    });

    const maj = TestBed.inject(MiseAJourService);
    const reloadSpy = vi.spyOn(maj as any, 'recharger').mockImplementation(() => {});
    expect(maj.disponible()).toBe(false);

    // Simule un rechargement très récent pour activer la protection anti-boucle : l'invite doit s'afficher au lieu de recharger en boucle
    sessionStorage.setItem('nl_maj_rechargee_a', String(Date.now()));

    versionUpdates$.next({ type: 'VERSION_DETECTED', version: { hash: 'v2' } } as any);
    expect(maj.installationEnCours()).toBe(true);

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'v1' },
      latestVersion: { hash: 'v2' },
    } as any);
    expect(maj.installationEnCours()).toBe(false);
    expect(maj.disponible()).toBe(true);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('NL-PWA : InstallationService expose l’état initial sans erreur hors mode standalone', () => {
    TestBed.configureTestingModule({
      providers: [InstallationService],
    });
    const inst = TestBed.inject(InstallationService);
    expect(inst.dejaInstallee()).toBe(false);
    expect(typeof inst.bandeauVisible()).toBe('boolean');
  });
});
