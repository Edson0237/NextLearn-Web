import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { Otp } from './otp';
import { AuthService } from '../../../core/auth';
import { VerificationService } from '../../../core/verification';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { AuthState, ETAT_INITIAL } from '../../../core/auth/models/auth.model';
import { ParcoursOtp, StatutDemandeOtp } from '../../../core/models';

describe('QA Otp Component — Saisie 6 chiffres, collage, file d’attente & abandon', () => {
  function setup(isLogin2fa = false, initialState: Partial<AuthState> = {}) {
    const stateSig = signal<AuthState>({ ...ETAT_INITIAL, isInitializing: false, ...initialState });
    const authMock: any = {
      state: stateSig.asReadonly(),
      verifyOtp: vi.fn().mockResolvedValue(true),
      verifyLoginOtp: vi.fn().mockResolvedValue(true),
      resendOtp: vi.fn().mockResolvedValue(true),
      rafraichirDemandeOtp: vi.fn().mockResolvedValue(undefined),
      abandonnerParcoursOtp: vi.fn(),
    };
    const verifMock = {
      state: signal({ requis: false, statut: 'approuve', tentatives: 0, resoumissionsRestantes: 3 }).asReadonly(),
    };
    const feuilleMock = {
      confirmer: vi.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      imports: [Otp],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: VerificationService, useValue: verifMock },
        { provide: FeuilleActionService, useValue: feuilleMock },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { isLogin2fa } } } },
      ],
    });

    const fixture = TestBed.createComponent(Otp);
    const router = TestBed.inject(Router);
    const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance as any,
      stateSig,
      authMock,
      feuilleMock,
      navUrlSpy,
      navSpy,
    };
  }

  it('valide les chiffres saisis, déclenche verifyOtp au 6e et redirige après succès', async () => {
    const { component, authMock, navUrlSpy } = setup(false);

    // Code incomplet -> message d'erreur local
    await component.verifier();
    expect(component.erreur()).toBeTruthy();

    for (let i = 0; i < 6; i++) {
      component.saisirChiffre(i, `x${i + 1}`);
    }
    await Promise.resolve();
    await Promise.resolve();

    expect(authMock.verifyOtp).toHaveBeenCalledWith('123456');
    expect(navUrlSpy).toHaveBeenCalledWith('/app/home');
  });

  it('gère le collage d’un code à 6 chiffres et le rejet serveur sur login 2FA', async () => {
    const { component, stateSig, authMock } = setup(true, { parcoursOtp: ParcoursOtp.connexion });
    authMock.verifyLoginOtp.mockResolvedValueOnce(false);
    stateSig.update((s) => ({ ...s, error: 'Code erroné QA' }));

    const preventDefault = vi.fn();
    component.surCollage({
      clipboardData: { getData: () => '98-76-54' },
      preventDefault,
    } as unknown as ClipboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();

    expect(authMock.verifyLoginOtp).toHaveBeenCalledWith('987654');
    expect(component.erreur()).toBe('Code erroné QA');
    expect(component.chiffres()).toEqual(['', '', '', '', '', '']);
  });

  it('gère exception réseau, renvoi et confirmation/annulation d’abandon', async () => {
    const { component, authMock, feuilleMock, navSpy } = setup(true);
    authMock.verifyLoginOtp.mockRejectedValueOnce(new Error('Offline OTP'));
    component.chiffres.set(['1', '1', '1', '1', '1', '1']);
    await component.verifier();
    expect(component.erreur()).toBe('Offline OTP');

    await component.renvoyer();
    expect(authMock.resendOtp).toHaveBeenCalled();

    feuilleMock.confirmer.mockResolvedValueOnce(false);
    await component.demanderAbandon();
    expect(authMock.abandonnerParcoursOtp).not.toHaveBeenCalled();

    feuilleMock.confirmer.mockResolvedValueOnce(true);
    await component.demanderAbandon();
    expect(authMock.abandonnerParcoursOtp).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalled();
  });

  it('rend la file d’attente OTP, estime le délai et actualise proprement sans fuite au destroy', async () => {
    const { fixture, component, stateSig, authMock } = setup(false, {
      demandeOtp: {
        statut: StatutDemandeOtp.enAttente,
        message: 'Patiente',
        position: 3,
        personnesDevant: 2,
        joursEstimes: undefined,
        dejaEnvoye: false,
      },
    });
    fixture.detectChanges();

    expect(component.enFileAttente).toBe(true);
    expect(component.traitementEstime()).toBe('bientôt');
    stateSig.update((s) => ({ ...s, demandeOtp: { ...s.demandeOtp!, joursEstimes: 0 } }));
    expect(component.traitementEstime()).toBe("aujourd'hui");
    stateSig.update((s) => ({ ...s, demandeOtp: { ...s.demandeOtp!, joursEstimes: 1 } }));
    expect(component.traitementEstime()).toBe('demain');
    stateSig.update((s) => ({ ...s, demandeOtp: { ...s.demandeOtp!, joursEstimes: 3 } }));
    expect(component.traitementEstime()).toBe('dans 3 jours');

    await component.actualiserPosition();
    expect(authMock.rafraichirDemandeOtp).toHaveBeenCalled();
    component.ngOnDestroy();
  });
});
