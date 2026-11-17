import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authGuard } from '../guards/auth.guard';
import { AppRoutes } from '../routes/app-routes';
import { PendingDestinationService } from '../services/pending-destination.service';
import { AuthService } from '../../auth/services/auth.service';
import { AuthState, ETAT_INITIAL } from '../../auth/models/auth.model';
import { VerificationService } from '../../verification/services/verification.service';
import { NiveauEtude, UserModel, Langue } from '../../models';

function stateSnapshot(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

const dummyRoute = {} as ActivatedRouteSnapshot;

const fakeStudent: UserModel = {
  id: 'etu-1',
  email: 'etu@univ-qa.test',
  nom: 'Etudiant',
  prenom: 'QA',
  universite: 'Université QA Alpha',
  filiere: 'Génie Logiciel QA',
  niveau: NiveauEtude.n3,
  langue: Langue.fr,
};

describe('QA Contrôle d’accès & Gardes de routage PWA (NL-AUTH-020 / NL-ADMIN-025)', () => {
  let authStateSignal = signal<AuthState>({ ...ETAT_INITIAL, isInitializing: false, isFirstLaunch: false });
  let verifStateSignal = signal<any>({ statut: 'approuve', verificationRequise: false });
  let pendingService: PendingDestinationService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authStateSignal = signal<AuthState>({ ...ETAT_INITIAL, isInitializing: false, isFirstLaunch: false });
    verifStateSignal = signal<any>({ statut: 'approuve', verificationRequise: false });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        PendingDestinationService,
        { provide: AuthService, useValue: { state: authStateSignal.asReadonly() } },
        { provide: VerificationService, useValue: { state: verifStateSignal.asReadonly() } },
      ],
    });
    pendingService = TestBed.inject(PendingDestinationService);
    router = TestBed.inject(Router);
  });

  const evalGuard = (url: string) =>
    TestBed.runInInjectionContext(() => authGuard(dummyRoute, stateSnapshot(url)));

  it('NL-AUTH-020 : redirige toute route privée vers login sans session et mémorise un lien profond document', () => {
    for (const priv of ['/app/home', '/app/bibliotheque', '/app/profil', '/app/depots/nouveau', '/app/offline']) {
      const res = evalGuard(priv);
      expect(res instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(res as UrlTree)).toBe(`/app/${AppRoutes.login}`);
    }

    const deepDoc = evalGuard('/app/bibliotheque/doc/doc-42');
    expect(deepDoc instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(deepDoc as UrlTree)).toBe(`/app/${AppRoutes.login}`);
    expect(pendingService.consommer()).toBe('bibliotheque/doc/doc-42');
  });

  it('autorise toujours les textes légaux sans compte connecté', () => {
    expect(evalGuard('/app/legal/document/confidentialite')).toBe(true);
    expect(evalGuard('/app/legal/document/conditions')).toBe(true);
  });

  it('NL-AUTH-012 : redirige un étudiant en vérification requise/attente vers l’écran de vérification, jamais vers la bibliothèque', () => {
    authStateSignal.set({
      ...ETAT_INITIAL,
      isInitializing: false,
      isFirstLaunch: false,
      user: { ...fakeStudent, verificationStatus: 'requis' },
    });
    verifStateSignal.set({ statut: 'requis', verificationRequise: true });

    const res = evalGuard('/app/bibliotheque');
    expect(res instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(res as UrlTree)).toBe(`/app/${AppRoutes.verificationForm}`);
  });

  it('verrou local actif bloque toutes les routes privées jusqu’au déverrouillage PIN', () => {
    authStateSignal.set({
      ...ETAT_INITIAL,
      isInitializing: false,
      isFirstLaunch: false,
      isLocked: true,
      user: fakeStudent,
    });

    const blocked = evalGuard('/app/bibliotheque');
    expect(blocked instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(blocked as UrlTree)).toBe(`/app/${AppRoutes.unlock}`);

    expect(evalGuard('/app/unlock')).toBe(true);
  });
});
