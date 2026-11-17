import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BibliothequeHome } from './bibliotheque-home';
import {
  ClasseBibliothequeService,
  DocumentsRepository,
  DocumentType,
  reponseCatalogueDepuisApi,
  ressourceVersDocumentModel,
  StockageHorsLigne,
} from '../../../core/bibliotheque';
import { AuthService } from '../../../core/auth';
import { ContexteService, CONTEXTE_OUVERT } from '../../../core/contexte';
import { FormatsService } from '../../../core/references';
import { BottomSheetRef, BOTTOM_SHEET_DATA, BottomSheetService } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { FiltresSheet } from '../filtres-sheet/filtres-sheet';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { NotificationsEtat } from '../../../core/notifications';
import { Fraicheur } from '../../../shared/services/fraicheur';
import { Failure, Langue, NiveauEtude } from '../../../core/models';

const USER = {
  id: 'u-bib-1',
  email: 'etu@enspy.cm',
  nom: 'Ndi',
  prenom: 'Paul',
  universite: 'ENSPY',
  filiere: 'Informatique',
  niveau: NiveauEtude.n3,
  langue: Langue.fr,
  sectionPreference: 'FRANCOPHONE' as const,
};

const RESSOURCE = {
  id: 'res-1',
  titre: 'Structures de données',
  description: 'Arbres et graphes',
  type: DocumentType.cours,
  matiere: 'Algorithmique',
  matiereId: 'mat-algo',
  niveau: 'N3',
  universite: 'ENSPY',
  filiere: 'Informatique',
  enseignant: 'Dr. Tchuente',
  anneeAcademique: '2025-2026',
  semestre: 'S1',
  fileSize: 1024,
  pages: 18,
  downloads: 12,
  views: 50,
  rating: 4.8,
  ratingsCount: 5,
  estDansProgramme: true,
};

describe('BibliothequeHome Actions, Cache, Pagination & Filtres — QA Coverage Suite', () => {
  let routerStub: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
    events: typeof EMPTY;
  };

  beforeEach(() => {
    routerStub = {
      navigate: vi.fn(async () => true),
      navigateByUrl: vi.fn(async () => true),
      events: EMPTY,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('charge le catalogue v2, gère afficherPlus, pastilles/filtres, erreur requestId et repli hors ligne', async () => {
    const repPage1 = reponseCatalogueDepuisApi({
      total: 2,
      ressources: [
        {
          id: 'res-1',
          titre: 'Structures de données',
          type: 'COURS',
          matiere: { id: 'mat-algo', nom: 'Algorithmique' },
          enseignant: { id: 'ens-1', nom: 'Dr. Tchuente' },
          niveau: 'N3',
          semestre: 'S1',
          anneeAcademique: '2025-2026',
          fichier: { pages: 18, tailleMb: 1.2 },
        },
      ],
      facettes: {
        type: [{ valeur: 'COURS', label: 'Cours', n: 2 }],
        matiere: [{ valeur: 'mat-algo', label: 'Algorithmique', n: 2 }],
        enseignant: [{ valeur: 'Dr. Tchuente', label: 'Dr. Tchuente', n: 2 }],
        semestre: [{ valeur: 'S1', label: 'Semestre 1', n: 2 }],
      },
      pagination: { page: 1, limit: 20, hasMore: true, nextCursor: 'cur-2' },
    });
    const repPage2 = reponseCatalogueDepuisApi({
      total: 2,
      ressources: [
        {
          id: 'res-2',
          titre: 'Graphes avancés',
          type: 'COURS',
          matiere: { id: 'mat-algo', nom: 'Algorithmique' },
          niveau: 'N3',
          fichier: { pages: 10, tailleMb: 0.8 },
        },
      ],
      facettes: repPage1.facettes,
      pagination: { page: 2, limit: 20, hasMore: false, nextCursor: null },
    });

    const docsRepoStub = {
      catalogue: vi.fn().mockResolvedValue(repPage1),
      getDocuments: vi.fn(async () => ({ items: [], page: 1, totalPages: 1, total: 0, hasMore: false })),
      getDocumentsPage: vi.fn(async () => ({ items: [], page: 1, totalPages: 1, total: 0, hasMore: false })),
    };
    const stockageStub = {
      ids: signal(new Set<string>()),
      fiches: signal<any[]>([]),
      rafraichir: vi.fn(async () => undefined),
    };
    const sheetResult = {
      type: DocumentType.td,
      typeEpreuve: null,
      semestre: 'S1',
      matiere: 'mat-algo',
      enseignant: null,
      annee: null,
      section: 'ANGLOPHONE' as const,
      avecCorrige: true,
    };
    const sheetsStub = {
      open: vi.fn(() => ({ result: Promise.resolve(sheetResult), close: vi.fn() })),
    };

    TestBed.configureTestingModule({
      imports: [BibliothequeHome],
      providers: [
        { provide: Router, useValue: routerStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
            queryParams: EMPTY,
          },
        },
        { provide: AuthService, useValue: { state: signal({ user: USER }).asReadonly() } },
        { provide: DocumentsRepository, useValue: docsRepoStub },
        { provide: StockageHorsLigne, useValue: stockageStub },
        ClasseBibliothequeService,
        { provide: FormatsService, useValue: { actif: () => true, formats: signal([]) } },
        { provide: ContexteService, useValue: { contexte: signal(CONTEXTE_OUVERT) } },
        {
          provide: TelechargementEtat,
          useValue: {
            initialiser: vi.fn(async () => undefined),
            telecharger: vi.fn(async () => undefined),
            etat: vi.fn(() => 'repos'),
            progression: vi.fn(() => undefined),
            estDisponible: vi.fn(() => false),
          },
        },
        { provide: BottomSheetService, useValue: sheetsStub },
        { provide: NotificationsEtat, useValue: { nonLues: signal(0), version: signal(0), rafraichir: vi.fn(async () => undefined) } },
        { provide: Fraicheur, useValue: { tick: signal(0) } },
      ],
    });

    const fixture: ComponentFixture<BibliothequeHome> = TestBed.createComponent(BibliothequeHome);
    const cmp = fixture.componentInstance as any;
    fixture.detectChanges();
    await cmp.ngOnInit();
    await Promise.resolve();
    fixture.detectChanges();

    expect(cmp.documents()).toHaveLength(1);
    expect(cmp.hasMoreServer()).toBe(true);

    // Pagination serveur -> page 2
    docsRepoStub.catalogue.mockResolvedValueOnce(repPage2);
    await cmp.afficherPlus();
    expect(cmp.documents()).toHaveLength(2);

    // Sélections & pastilles + filtres sheet
    await cmp.ouvrirFiltres();
    expect(cmp.selectedType()).toBe(DocumentType.td);
    expect(cmp.selectedSemestre()).toBe('S1');
    expect(cmp.pastillesActives().length).toBeGreaterThan(0);

    cmp.retirerDernierFiltre();
    cmp.selectTri('populaire');
    cmp.revenirASectionProfil();
    cmp.actualiserCatalogue();
    cmp.openSearch();
    expect(routerStub.navigate).toHaveBeenCalled();

    // Erreur HTTP 400 avec requestId -> copierRequestId & contacterSupport
    docsRepoStub.catalogue.mockRejectedValueOnce(new Failure('Filtre invalide', 400, 'VALIDATION_ERROR', undefined, undefined, 'req-400'));
    await cmp.load(false, true);
    expect(cmp.errorRequestId()).toBe('req-400');
    await cmp.copierRequestId();
    expect(cmp.requestIdCopie()).toBe(true);
    await cmp.contacterSupport();
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    // Repli vers /api/documents puis stockage local en erreur 500
    docsRepoStub.catalogue.mockRejectedValueOnce(new Failure('Indisponible', 503));
    docsRepoStub.getDocuments.mockRejectedValueOnce(new Failure('Offline', 504));
    stockageStub.fiches.set([ressourceVersDocumentModel({ ...repPage1.ressources[0], id: 'doc-local-1', titre: 'Fiche Locale' })]);
    await cmp.load(false, true);
    expect(cmp.documents()[0].id).toBe('doc-local-1');
  });

  it('FiltresSheet rend toutes ses sections (formats, nature, semestre, matière, enseignant, année, corrigé)', () => {
    const closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [FiltresSheet],
      providers: [
        { provide: BottomSheetRef, useValue: { close: closeSpy } },
        {
          provide: BOTTOM_SHEET_DATA,
          useValue: {
            formats: [
              { type: null, label: 'Tous' },
              { type: DocumentType.cours, label: 'Cours' },
            ],
            matieres: [{ id: 'mat-algo', nom: 'Algorithmique' }],
            facettes: {
              type: [{ valeur: 'COURS', valeurFiltre: 'COURS', label: 'Cours', labelEn: 'Course', n: 3, selectionne: false }],
              typeEpreuve: [{ valeur: 'SN', valeurFiltre: 'SN', label: 'Session normale', labelEn: 'Final', n: 2, selectionne: false }],
              semestre: [{ valeur: 'S1', valeurFiltre: 'S1', label: 'Semestre 1', labelEn: 'S1', n: 3, selectionne: false }],
              matiere: [{ valeur: 'mat-algo', valeurFiltre: 'mat-algo', label: 'Algorithmique', labelEn: 'Algorithms', n: 3, selectionne: false }],
              enseignant: [{ valeur: 'Dr. Tchuente', valeurFiltre: 'Dr. Tchuente', label: 'Dr. Tchuente', labelEn: 'Dr. Tchuente', n: 2, selectionne: false }],
              annee: [{ valeur: '2025-2026', valeurFiltre: '2025-2026', label: '2025-2026', labelEn: '2025-2026', n: 3, selectionne: false }],
              avecCorrige: [{ valeur: true, valeurFiltre: true, label: 'Oui', labelEn: 'Yes', n: 1, selectionne: false }],
            },
            type: DocumentType.cours,
            typeEpreuve: 'SN',
            semestre: 'S1',
            matiere: 'mat-algo',
            enseignant: 'Dr. Tchuente',
            annee: '2025-2026',
            section: 'FRANCOPHONE',
            avecCorrige: true,
            compter: () => 3,
          },
        },
      ],
    });
    const fix = TestBed.createComponent(FiltresSheet);
    fix.detectChanges();
    const btns = fix.nativeElement.querySelectorAll('button');
    expect(btns.length).toBeGreaterThan(3);
  });
});
