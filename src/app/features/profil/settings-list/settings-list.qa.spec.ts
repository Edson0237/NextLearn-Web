import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { SettingsList } from './settings-list';
import { AuthService } from '../../../core/auth';
import { InstallationService } from '../../../core/pwa';
import { FavorisEtat } from '../../../shared/services/favoris-etat';
import { ThemeService } from '../../../shared/services/theme';
import { EchelleTexte, PreferencesAccessibilite, VerrouillageApp } from '../../../core/preferences';
import { DocumentsRepository, LectureProgressRepository, StockageHorsLigne } from '../../../core/bibliotheque';
import { TraductionService } from '../../../core/i18n';
import { PreferenceNotifications } from '../../../core/notifications';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { Fraicheur } from '../../../shared/services/fraicheur';
import { Cycle, Langue, NiveauEtude } from '../../../core/models';

describe('QA SettingsList — Réglages, niveau, section, notifications, cache & déconnexion', () => {
  function setup(inline = true) {
    const authMock: any = {
      state: signal({
        user: {
          id: 'u1',
          email: 'etu@univ-qa.test',
          nom: 'Etu',
          prenom: 'QA',
          universite: 'UQA',
          filiere: 'GL',
          niveau: NiveauEtude.n3,
          cycle: Cycle.licence,
          langue: Langue.fr,
          hasPin: true,
          sectionPreference: 'FRANCOPHONE',
        },
      }).asReadonly(),
      niveauxDuCycle: vi.fn().mockResolvedValue({ niveaux: [{ code: 'N2', label: 'Licence 2' }, { code: 'N3', label: 'Licence 3' }] }),
      changerNiveau: vi.fn().mockResolvedValue(null),
      changerSection: vi.fn().mockResolvedValue(null),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    const verrouMock = { actif: signal(false), definir: vi.fn((v: boolean) => verrouMock.actif.set(v)) };
    const notifMock = {
      actives: signal(true),
      etatPush: signal<'actif' | 'refuse' | 'indisponible' | 'non-configure' | 'attente'>('actif'),
      definir: vi.fn().mockResolvedValue('actif'),
    };
    const accesMock = {
      reduireAnimations: signal<boolean | null>(null),
      echelleTexte: signal<EchelleTexte>(EchelleTexte.normale),
      definirReduction: vi.fn(),
      definirEchelle: vi.fn(),
    };
    const tradMock = {
      langue: signal<'fr' | 'en'>('fr').asReadonly(),
      preferenceCourante: signal<'fr' | 'en' | 'systeme'>('fr'),
      t: (_k: string, _p?: unknown, def?: string) => def ?? _k,
      definir: vi.fn().mockResolvedValue(undefined),
    };
    const toastMock = { succes: vi.fn(), erreur: vi.fn(), info: vi.fn() };
    const actionsMock = {
      choisir: vi.fn().mockResolvedValue('N2'),
      confirmer: vi.fn().mockResolvedValue(true),
    };
    const selectionsMock = {
      ouvrir: vi.fn().mockResolvedValue('ANGLOPHONE'),
    };

    TestBed.configureTestingModule({
      imports: [SettingsList],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: InstallationService, useValue: { dejaInstallee: () => false } },
        { provide: FavorisEtat, useValue: { charger: vi.fn(), ids: signal(new Set(['f1'])) } },
        { provide: ThemeService, useValue: { mode: signal('system'), set: vi.fn() } },
        { provide: PreferencesAccessibilite, useValue: accesMock },
        {
          provide: StockageHorsLigne,
          useValue: {
            rafraichir: vi.fn().mockResolvedValue(undefined),
            ids: signal(new Set(['d1', 'd2'])),
            fiches: signal([{ id: 'd1', titre: 'Algo' }]),
          },
        },
        {
          provide: LectureProgressRepository,
          useValue: {
            getAll: vi.fn().mockResolvedValue(
              new Map([
                ['d1', { documentId: 'd1', pageCourante: 2, totalPages: 10, derniereLecture: '2026-11-15T10:00:00Z', tempsTotalSecondes: 30 }],
              ]),
            ),
          },
        },
        { provide: DocumentsRepository, useValue: { getById: vi.fn().mockResolvedValue({ titre: 'Doc D' }) } },
        { provide: TraductionService, useValue: tradMock },
        { provide: PreferenceNotifications, useValue: notifMock },
        { provide: ToastService, useValue: toastMock },
        { provide: FeuilleActionService, useValue: actionsMock },
        { provide: FeuilleSelectionService, useValue: selectionsMock },
        { provide: Fraicheur, useValue: { tick: vi.fn() } },
        { provide: VerrouillageApp, useValue: verrouMock },
      ],
    });

    const fixture = TestBed.createComponent(SettingsList);
    fixture.componentRef.setInput('inline', inline);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance as any, authMock, verrouMock, notifMock, actionsMock, selectionsMock, toastMock, accesMock, tradMock, router };
  }

  it('construit les groupes de réglages inline et déclenche reprises, niveau et section', async () => {
    const { component, authMock, toastMock } = setup(true);
    await component.ngOnInit();
    await Promise.resolve();

    expect(component.groupes().length).toBeGreaterThanOrEqual(5);
    expect(component.libelleFichiers()).toBe('2 fichiers');
    expect(component.libelleLangue()).toBe('Français');
    expect(component.libelleReduction()).toBe('Suivre le système');

    await component.ouvrirChoixNiveau();
    expect(authMock.changerNiveau).toHaveBeenCalledWith('N2');
    expect(toastMock.succes).toHaveBeenCalled();

    await component.ouvrirChoixSection();
    expect(authMock.changerSection).toHaveBeenCalledWith('ANGLOPHONE');
  });

  it('couvre bascules notifications, verrouillage, langue, réduction d’animations, viderCache et déconnexion', async () => {
    const { component, authMock, verrouMock, notifMock, selectionsMock, toastMock, accesMock, tradMock } = setup(false);

    component.basculerVerrou();
    expect(verrouMock.definir).toHaveBeenCalledWith(true);
    component.pinCree();

    for (const [etat, expectedToast] of [
      ['actif', 'succes'],
      ['refuse', 'erreur'],
      ['indisponible', 'info'],
      ['non-configure', 'info'],
    ] as const) {
      notifMock.etatPush.set(etat === 'actif' ? 'attente' : etat);
      notifMock.definir.mockResolvedValueOnce(etat);
      await component.basculerNotifications();
      expect(toastMock[expectedToast]).toHaveBeenCalled();
    }

    selectionsMock.ouvrir.mockResolvedValueOnce('dark');
    await component.choisirTheme();

    selectionsMock.ouvrir.mockResolvedValueOnce('en');
    await component.choisirLangue();
    expect(tradMock.definir).toHaveBeenCalledWith('en');

    selectionsMock.ouvrir.mockResolvedValueOnce('oui');
    await component.choisirReduction();
    expect(accesMock.definirReduction).toHaveBeenCalledWith(true);

    selectionsMock.ouvrir.mockResolvedValueOnce(EchelleTexte.grande);
    await component.choisirEchelle();
    expect(accesMock.definirEchelle).toHaveBeenCalledWith(EchelleTexte.grande);

    const delMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: { keys: vi.fn().mockResolvedValue(['ngsw:api-lecture', 'nl-documents-hors-ligne-v1']), delete: delMock },
    });
    await component.viderCache();
    expect(delMock).toHaveBeenCalledWith('ngsw:api-lecture');
    expect(delMock).not.toHaveBeenCalledWith('nl-documents-hors-ligne-v1');

    await component.deconnecter();
    expect(authMock.logout).toHaveBeenCalled();
  });

  it('couvre chaque action de ligne, libellés de section/notifications et verrou sans PIN', async () => {
    const { component, verrouMock, notifMock, actionsMock, tradMock, authMock } = setup(true);
    await component.ngOnInit();
    await Promise.resolve();

    // Toutes les lignes (inline + compte + apparence + notifications + hors ligne + accessibilité + aide + à propos + session + danger)
    for (const grp of component.groupes()) {
      for (const ligne of grp.lignes) {
        ligne.action?.();
      }
    }
    await Promise.resolve();

    // Verrou sans PIN -> ouvre le dialog PIN, puis pinCree active le verrou
    authMock.state = signal({ user: { ...authMock.state().user, hasPin: false } }).asReadonly();
    verrouMock.actif.set(false);
    component.basculerVerrou();
    expect(component.modalPinVisible()).toBe(true);
    component.pinCree();
    expect(verrouMock.definir).toHaveBeenCalledWith(true);

    // Libellés notifications et langues/sections
    for (const etat of ['actif', 'refuse', 'indisponible', 'non-configure', 'attente'] as const) {
      notifMock.etatPush.set(etat);
      expect(component.libelleNotifications()).toBeTruthy();
    }
    notifMock.actives.set(false);
    expect(component.libelleNotifications()).toBeTruthy();

    for (const pref of ['FRANCOPHONE', 'ANGLOPHONE', 'TOUTES', null] as const) {
      expect(component.libelleSection(pref)).toBeTruthy();
    }
    for (const lng of ['fr', 'en', 'systeme'] as const) {
      tradMock.preferenceCourante.set(lng);
      expect(component.libelleLangue()).toBeTruthy();
    }

    // Réponse vide sur niveaux -> secours codes par cycle + Annulation confirmation
    authMock.niveauxDuCycle.mockResolvedValueOnce({ niveaux: [] });
    actionsMock.choisir.mockResolvedValueOnce('N2');
    await component.ouvrirChoixNiveau();
    expect(authMock.changerNiveau).toHaveBeenCalled();
  });
});
