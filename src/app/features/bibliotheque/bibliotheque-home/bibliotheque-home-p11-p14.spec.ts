import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BibliothequeHome } from './bibliotheque-home';
import {
  ClasseBibliothequeService,
  DocumentsRepository,
  ReponseCatalogue,
  RequeteCatalogue,
  StockageHorsLigne,
} from '../../../core/bibliotheque';
import { AuthService } from '../../../core/auth';
import { ContexteService } from '../../../core/contexte';
import { FormatsService } from '../../../core/references';
import { Cycle, Langue, NiveauEtude, SectionPreference, UserModel } from '../../../core/models';
import { Fraicheur } from '../../../shared/services/fraicheur';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { BottomSheetService } from '../../../shared/ui/bottom-sheet/bottom-sheet';

function creerUser(overrides: Partial<UserModel> = {}): UserModel {
  return {
    id: 'etu-1',
    nom: 'Mbarga',
    prenom: 'Claire',
    email: 'claire@isj.cm',
    universite: 'Saint Jean Ingénieur',
    cycle: Cycle.ingenieur,
    filiere: 'ISI',
    niveau: NiveauEtude.n3,
    langue: Langue.fr,
    sectionPreference: 'FRANCOPHONE',
    ...overrides,
  };
}

const REPONSE_CATALOGUE: ReponseCatalogue = {
  ressources: [],
  total: 1,
  pagination: { limit: 20, page: 1, hasMore: false, nextCursor: null },
  filtresActifs: {
    type: [],
    typeEpreuve: [],
    semestre: [],
    matiere: [],
    enseignant: [],
    annee: [],
    section: [],
    avecCorrige: null,
    q: null,
    tri: 'recent',
  },
  facettes: {
    type: [],
    typeEpreuve: [
      { valeur: null, valeurFiltre: 'NON_PRECISE', label: 'Non précisé', labelEn: 'Not specified', n: 1, selectionne: false },
    ],
    semestre: [],
    matiere: [],
    enseignant: [],
    annee: [],
    section: [],
    avecCorrige: [],
  },
};

describe('BibliothequeHome - SectionModal, Profil sync, NON_PRECISE & économie données', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('nl_langue', 'fr');
  });

  function setup(initialUser: UserModel) {
    const appelsCatalogue: RequeteCatalogue[] = [];
    const authState = signal({
      user: initialUser as UserModel | null,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      locked: false,
      requiresOtp: false,
    });
    const docsRepo = {
      catalogue: vi.fn(async (req: RequeteCatalogue) => {
        appelsCatalogue.push(req);
        return REPONSE_CATALOGUE;
      }),
      getDocuments: vi.fn(async () => ({ items: [], total: 0, page: 1, hasMore: false })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'app/bibliotheque', component: BibliothequeHome },
          { path: 'app/profil', children: [] },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: new Map(),
              paramMap: new Map(),
            },
          },
        },
        // Remplacement de queryParamMap par un wrapper compatible get/has
      ],
    });

    // Ré-initialisation propre avec ActivatedRoute complet + stubs
    TestBed.resetTestingModule();
    const videQp = {
      has: () => false,
      get: () => null,
      getAll: () => [],
      keys: [],
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'app/bibliotheque', component: BibliothequeHome },
          { path: 'app/profil', children: [] },
        ]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: videQp, paramMap: videQp } } },
        { provide: AuthService, useValue: { state: authState.asReadonly() } },
        { provide: DocumentsRepository, useValue: docsRepo },
        {
          provide: StockageHorsLigne,
          useValue: {
            ids: signal(new Set<string>()).asReadonly(),
            fiches: signal([]).asReadonly(),
            rafraichir: vi.fn(async () => {}),
          },
        },
        {
          provide: TelechargementEtat,
          useValue: {
            initialiser: vi.fn(async () => {}),
            etat: () => 'repos',
            telecharger: vi.fn(async () => {}),
          },
        },
        { provide: Fraicheur, useValue: { tick: signal(0).asReadonly() } },
        { provide: ContexteService, useValue: { typeVisible: () => true } },
        { provide: FormatsService, useValue: { formats: signal(null).asReadonly() } },
        { provide: BottomSheetService, useValue: { open: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(BibliothequeHome);
    const controller = TestBed.inject(HttpTestingController);
    const classeBiblio = TestBed.inject(ClasseBibliothequeService);
    const router = TestBed.inject(Router);
    return {
      fixture,
      component: fixture.componentInstance,
      authState,
      docsRepo,
      appelsCatalogue,
      controller,
      classeBiblio,
      router,
    };
  }

  it('bloque le chargement tant que SectionPromptModal attend la préférence initiale puis charge selon choix FR/EN/TOUTES', async () => {
    const { component, authState, appelsCatalogue } = setup(creerUser({ sectionPreference: undefined }));
    await component.ngOnInit();

    expect(component['enAttenteChoixSection']()).toBe(true);
    expect(appelsCatalogue.length).toBe(0);

    authState.update((s) => ({ ...s, user: creerUser({ sectionPreference: 'FRANCOPHONE' }) }));
    TestBed.flushEffects();
    await new Promise((r) => setTimeout(r, 0));

    expect(component['enAttenteChoixSection']()).toBe(false);
    expect(appelsCatalogue.at(-1)?.section).toBe('FRANCOPHONE');

    authState.update((s) => ({ ...s, user: creerUser({ sectionPreference: 'TOUTES' as SectionPreference }) }));
    TestBed.flushEffects();
    await new Promise((r) => setTimeout(r, 0));

    expect(appelsCatalogue.at(-1)?.section).toBeUndefined();
  });

  it('isole le filtre temporaire de section dans la Bibliothèque et permet de revenir à la section Profil', async () => {
    const { component, authState, appelsCatalogue } = setup(creerUser({ sectionPreference: 'FRANCOPHONE' }));
    await component.ngOnInit();

    component['selectSection']('ANGLOPHONE');
    await new Promise((r) => setTimeout(r, 0));

    expect(component['filtreSectionTemporaire']()).toBe(true);
    expect(authState().user?.sectionPreference).toBe('FRANCOPHONE');
    expect(appelsCatalogue.at(-1)?.section).toBe('ANGLOPHONE');

    component.revenirASectionProfil();
    await new Promise((r) => setTimeout(r, 0));

    expect(component['filtreSectionTemporaire']()).toBe(false);
    expect(component['selectedSection']()).toBe('FRANCOPHONE');
    // Le retour réutilise le cache applicatif sans refaire d'appel réseau inutile (§9.4)
    expect(appelsCatalogue.length).toBe(2);

    // L'actualisation forcée interroge le réseau avec la section Profil restaurée
    component['actualiserCatalogue']();
    await new Promise((r) => setTimeout(r, 0));
    expect(appelsCatalogue.at(-1)?.section).toBe('FRANCOPHONE');
  });

  it('changement de niveau depuis Profil réinitialise le catalogue, garde sectionPreference, n envoie aucun paramètre de classe et n altère pas l URL quand détaché sur /app/profil', async () => {
    localStorage.setItem(
      'nl_classe_consultation_etu-1',
      JSON.stringify({ universiteId: 'u2', filiereId: 'f2', niveau: 'N1' }),
    );
    const { authState, classeBiblio, router, appelsCatalogue } = setup(
      creerUser({ niveau: NiveauEtude.n3, sectionPreference: 'ANGLOPHONE' }),
    );
    await router.navigateByUrl('/app/profil');
    const navSpy = vi.spyOn(router, 'navigate');

    authState.update((s) => ({
      ...s,
      user: creerUser({ niveau: NiveauEtude.n4, sectionPreference: 'ANGLOPHONE' }),
    }));
    TestBed.flushEffects();
    await new Promise((r) => setTimeout(r, 0));

    expect(classeBiblio.contexte().mode).toBe('profil');
    expect(localStorage.getItem('nl_classe_consultation_etu-1')).toBeNull();
    expect(authState().user?.sectionPreference).toBe('ANGLOPHONE');
    expect(appelsCatalogue.at(-1)?.section).toBe('ANGLOPHONE');
    expect(appelsCatalogue.at(-1)?.universiteId).toBeUndefined();
    expect(appelsCatalogue.at(-1)?.filiereId).toBeUndefined();
    expect(appelsCatalogue.at(-1)?.niveau).toBeUndefined();
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('expose les facettes NON_PRECISE et réduit limit à 10 quand nl_economie_donnees est actif', async () => {
    localStorage.setItem('nl_economie_donnees', '1');
    const { component, appelsCatalogue } = setup(creerUser());
    await component.ngOnInit();

    expect(appelsCatalogue[0]?.limit).toBe(10);
    expect(component['naturesEpreuve']()).toEqual([
      { value: 'NON_PRECISE', label: 'Non précisé', n: 1 },
    ]);

    component['selectTypeEpreuve']('NON_PRECISE');
    await new Promise((r) => setTimeout(r, 0));
    expect(appelsCatalogue.at(-1)?.typeEpreuve).toBe('NON_PRECISE');
  });
});
