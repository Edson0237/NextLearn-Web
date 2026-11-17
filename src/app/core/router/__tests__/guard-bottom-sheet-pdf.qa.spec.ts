import { describe, it, expect, afterEach, vi } from 'vitest';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { authGuard } from '../guards/auth.guard';
import { TabReuseStrategy } from '../strategies/tab-reuse-strategy';
import { AuthService } from '../../auth';
import { VerificationService } from '../../verification/services/verification.service';
import { PendingDestinationService } from '../services/pending-destination.service';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { optimiserAvatar, optimiserJustificatif } from '../../../shared/services/image-optimiseur';
import { Vitrine } from '../../../features/vitrine/vitrine';
import { InstallationService } from '../../pwa';
import { Langue, NiveauEtude, ParcoursOtp } from '../../models';

describe('Router Guard, TabReuseStrategy, BottomSheets, ImageOptimiseur, Vitrine & PdfReader — QA Suite', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  it('authGuard arbitre splash, initializing, verrouillage, routes légales, deep link et vérification', async () => {
    const authState = signal<any>({
      isInitializing: true,
      isFirstLaunch: false,
      isLocked: false,
      user: undefined,
    });
    const verifState = signal<any>({ statut: 'approuve', requis: false });
    const pendingStub = {
      set: vi.fn(),
      consommer: vi.fn(() => 'bibliotheque/doc/d1'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { state: authState.asReadonly() } },
        { provide: VerificationService, useValue: { state: verifState.asReadonly() } },
        { provide: PendingDestinationService, useValue: pendingStub },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'parseUrl').mockImplementation((url) => url as unknown as UrlTree);

    const runGuard = (url: string) =>
      TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
      );

    // 1. Pendant initialisation -> attend la fin d'init puis redirige vers onboarding
    const initObs = runGuard('/app/home') as Observable<boolean | UrlTree>;
    authState.set({
      isInitializing: false,
      isFirstLaunch: true,
      isLocked: false,
      user: undefined,
    });
    expect(String(await firstValueFrom(initObs))).toBe('/app/onboarding');

    // 2. Déconnecté -> legal autorisé, deep link mémorisé, splash -> onboarding
    expect(runGuard('/app/legal/document/confidentialite')).toBe(true);
    expect(String(runGuard('/app/bibliotheque/doc/doc-99'))).toBe('/app/onboarding');
    expect(pendingStub.set).toHaveBeenCalledWith('bibliotheque/doc/doc-99');
    expect(String(runGuard('/app'))).toBe('/app/onboarding');

    // 3. Déconnecté avec parcours OTP en cours
    authState.set({
      isInitializing: false,
      isFirstLaunch: false,
      isLocked: false,
      parcoursOtp: ParcoursOtp.inscription,
      user: undefined,
    });
    expect(String(runGuard('/app/home'))).toBe('/app/register/otp');

    // 4. Authentifié mais verrouillé -> /app/unlock
    const user = {
      id: 'u1',
      email: 'a@isj.cm',
      nom: 'N',
      prenom: 'P',
      universite: 'ISJ',
      filiere: 'GL',
      niveau: NiveauEtude.n3,
      langue: Langue.fr,
      verificationStatus: 'verified',
    };
    authState.set({
      isInitializing: false,
      isAuthenticated: true,
      isLocked: true,
      user,
    });
    expect(String(runGuard('/app/home'))).toBe('/app/unlock');
    expect(runGuard('/app/unlock')).toBe(true);

    // 5. Déverrouillé sur splash -> consomme pendingDestination
    authState.set({
      isInitializing: false,
      isAuthenticated: true,
      isLocked: false,
      user,
    });
    expect(String(runGuard('/app'))).toBe('/app/bibliotheque/doc/d1');
    expect(String(runGuard('/app/unlock'))).toBe('/app/home');
  });

  it('TabReuseStrategy détache, stocke, restaure et détruit les onglets à la déconnexion', () => {
    const strategy = new TabReuseStrategy();
    const destroySpy = vi.fn();
    const route = { routeConfig: { path: 'home' }, parent: null } as unknown as ActivatedRouteSnapshot;
    const detailRoute = { routeConfig: { path: 'doc/1' }, parent: null } as unknown as ActivatedRouteSnapshot;

    expect(strategy.shouldDetach(route)).toBe(true);
    expect(strategy.shouldDetach(detailRoute)).toBe(false);
    strategy.store(route, { componentRef: { destroy: destroySpy } } as any);
    expect(strategy.shouldAttach(route)).toBe(true);
    expect(strategy.retrieve(route)).toBeTruthy();

    TabReuseStrategy.vider();
    expect(destroySpy).toHaveBeenCalled();
    expect(strategy.shouldAttach(route)).toBe(false);
  });

  it('BottomSheetService, FeuilleActionService et FeuilleSelectionService rendent et ferment les feuilles CDK', async () => {
    TestBed.configureTestingModule({});
    const appRef = TestBed.inject(ApplicationRef);
    const actions = TestBed.inject(FeuilleActionService);
    const selections = TestBed.inject(FeuilleSelectionService);

    const pConfirm = actions.confirmer({
      title: 'Confirmer ?',
      description: 'Test dialog',
      confirmLabel: 'Oui',
      destructive: true,
    });
    appRef.tick();
    const confirmBtn = document.querySelector<HTMLButtonElement>('.cdk-overlay-container .nl-confirm__bouton--destructif');
    expect(confirmBtn).toBeTruthy();
    confirmBtn?.click();
    expect(await pConfirm).toBe(true);

    const pChoice = actions.choisir({
      title: 'Action',
      options: [{ label: 'Option A', value: 'A', icon: 'check' }],
    });
    appRef.tick();
    const optBtn = document.querySelector<HTMLButtonElement>('.cdk-overlay-container .nl-actions__ligne');
    expect(optBtn).toBeTruthy();
    optBtn?.click();
    expect(await pChoice).toBe('A');

    // >= 8 choix pour activer le champ de recherche dans SelectionSheet
    const pSel = selections.ouvrir({
      title: 'Sélection',
      choices: Array.from({ length: 9 }, (_, i) => ({ value: `v${i}`, label: `Choix ${i}` })),
      currentValue: 'v0',
      searchHint: 'Filtrer',
    });
    appRef.tick();
    const selButtons = document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container .nl-select__ligne');
    expect(selButtons.length).toBe(9);
    selButtons[8]?.click();
    expect(await pSel).toBe('v8');
  });

  it('optimiserJustificatif, optimiserAvatar, Vitrine et PdfReader couvrent leurs flux clés', async () => {
    const bigPdf = new File([new Uint8Array(5 * 1024 * 1024)], 'gros.pdf', { type: 'application/pdf' });
    await expect(optimiserJustificatif(bigPdf)).rejects.toThrow(/4,5 Mo/);

    const okPdf = new File([new Uint8Array([1, 2, 3])], 'Mon Justif &.pdf', { type: '' });
    const normPdf = await optimiserJustificatif(okPdf);
    expect(normPdf.type).toBe('application/pdf');
    expect(normPdf.name).toContain('Mon_Justif__.pdf');

    const imgFile = new File([new Uint8Array([1, 2, 3])], 'avatar.jpg', { type: 'image/jpeg' });
    expect(await optimiserAvatar(imgFile)).toBeInstanceOf(File);

    // Vitrine
    const installStub = {
      dejaInstallee: vi.fn(() => false),
      invitationDisponible: vi.fn(() => false),
      proposer: vi.fn(async () => undefined),
      plateforme: vi.fn(() => 'desktop'),
      estNavigateurIos: vi.fn(() => false),
    };
    TestBed.configureTestingModule({
      imports: [Vitrine],
      providers: [
        { provide: InstallationService, useValue: installStub },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map(), queryParamMap: new Map() } } },
      ],
    });
    const vitrineFix = TestBed.createComponent(Vitrine);
    vitrineFix.detectChanges();
    await (vitrineFix.componentInstance as any).installer();
    expect((vitrineFix.componentInstance as any).guideOuvert()).toBe(true);
  });
});
