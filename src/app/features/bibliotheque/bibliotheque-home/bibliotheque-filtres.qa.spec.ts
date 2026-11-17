import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BibliothequeHome } from './bibliotheque-home';
import {
  DocumentType,
  DocumentsRepository,
  FACETTES_VIDES,
  ReponseCatalogue,
  RequeteCatalogue,
  StockageHorsLigne,
} from '../../../core/bibliotheque';
import { AuthService } from '../../../core/auth';
import { ContexteService, CONTEXTE_OUVERT } from '../../../core/contexte';
import { FormatsService } from '../../../core/references';
import { TraductionService } from '../../../core/i18n';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';

function reponseVide(req: RequeteCatalogue = {}): ReponseCatalogue {
  return {
    ressources: [],
    total: 0,
    pagination: { limit: 20, page: 1, hasMore: false, nextCursor: null },
    filtresActifs: {
      type: req.type ? [String(req.type)] : [],
      typeEpreuve: req.typeEpreuve ? [String(req.typeEpreuve)] : [],
      semestre: [],
      matiere: req.matiere ? [String(req.matiere)] : [],
      enseignant: [],
      annee: [],
      section: [],
      avecCorrige: null,
      q: req.q ?? null,
      tri: 'recent',
    },
    facettes: FACETTES_VIDES,
  };
}

describe('QA Bibliothèque PWA — Filtres, Seuil de recherche et Réinitialisation (NL-LIB-002..016)', () => {
  let fixture: ComponentFixture<BibliothequeHome>;
  let component: BibliothequeHome;
  const catalogueMock = vi.fn<(req?: RequeteCatalogue) => Promise<ReponseCatalogue>>();

  beforeEach(async () => {
    vi.useFakeTimers();
    catalogueMock.mockReset();
    catalogueMock.mockImplementation(async (req) => reponseVide(req));

    await TestBed.configureTestingModule({
      imports: [BibliothequeHome],
      providers: [
        provideRouter([]),
        {
          provide: DocumentsRepository,
          useValue: { catalogue: catalogueMock, getDocuments: vi.fn() },
        },
        {
          provide: StockageHorsLigne,
          useValue: {
            disponible: true,
            ids: signal(new Set<string>()),
            fiches: signal([]),
            rafraichir: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TelechargementEtat,
          useValue: {
            initialiser: vi.fn().mockResolvedValue(undefined),
            etat: () => 'repos',
            telecharger: vi.fn(),
          },
        },
        { provide: AuthService, useValue: { state: signal({ isInitializing: false, user: undefined }) } },
        {
          provide: ContexteService,
          useValue: {
            contexte: signal(CONTEXTE_OUVERT),
            matieres: signal([]),
            typeVisible: () => true,
          },
        },
        {
          provide: FormatsService,
          useValue: { formats: signal([{ type: DocumentType.cours, label: 'Cours' }]) },
        },
        {
          provide: TraductionService,
          useValue: {
            langue: signal('fr'),
            aDesMessages: signal(true),
            t: (_k: string, _p?: unknown, def?: string) => def ?? _k,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BibliothequeHome);
    component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(100);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('NL-LIB-006 / NL-LIB-007 : ne déclenche pas de requête serveur pour 1 caractère mais interroge dès 2 caractères', async () => {
    const initialCalls = catalogueMock.mock.calls.length;

    (component as any).searchQuery.set('a');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(450);
    expect(catalogueMock.mock.calls.length).toBe(initialCalls);

    (component as any).searchQuery.set('al');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(450);
    expect(catalogueMock.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(catalogueMock.mock.calls.at(-1)?.[0]?.q).toBe('al');
  });

  it('NL-LIB-008 / NL-LIB-009 : gère un résultat vide sans erreur technique puis réinitialise les filtres actifs', async () => {
    (component as any).selectType(DocumentType.cours);
    await vi.advanceTimersByTimeAsync(50);
    expect((component as any).error()).toBeNull();
    expect((component as any).documents()).toEqual([]);

    (component as any).reinitialiser();
    await vi.advanceTimersByTimeAsync(50);
    expect((component as any).selectedType()).toBeNull();
  });

  it('NL-LIB-016 : capture une erreur réseau sur le chargement initial sans planter le composant', async () => {
    catalogueMock.mockRejectedValueOnce(new Error('Network down'));
    await component.ngOnInit();
    expect((component as any).error()).toBeTruthy();
    expect((component as any).loading()).toBe(false);
  });
});
