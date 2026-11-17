import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('BibliothequeHome - Catalogue v2 / Explorer (Chantier P5)', () => {
  let fixture: ComponentFixture<BibliothequeHome>;
  let component: BibliothequeHome;
  const catalogueMock = vi.fn<(req?: RequeteCatalogue) => Promise<ReponseCatalogue>>();

  const reponseSimulee = (req: RequeteCatalogue = {}): ReponseCatalogue => ({
    ressources: [
      {
        id: 'doc-sn-1',
        titre: 'Analyse 1 - SN (2024-2025)',
        type: 'EPREUVE',
        typeEpreuve: 'SN',
        matiere: { id: 'mat-analyse', nom: 'Analyse 1' },
        enseignant: { id: 'ens-mballa', nom: 'Dr Paul MBALLA' },
        anneeAcademique: '2024-2025',
        semestre: 'S1',
        niveau: 'N1',
        section: 'FRANCOPHONE',
        avecCorrige: true,
        dureeMinutes: 120,
        fichier: { pages: 4, tailleMb: 1.2 },
        dateAjout: '2026-10-02T08:00:00.000Z',
      },
      {
        id: 'doc-sn-1', // doublon intentionnel pour vérifier le dédoublonnage par id
        titre: 'Analyse 1 - SN (2024-2025)',
        type: 'EPREUVE',
        typeEpreuve: 'SN',
        matiere: { id: 'mat-analyse', nom: 'Analyse 1' },
        enseignant: { id: 'ens-mballa', nom: 'Dr Paul MBALLA' },
        anneeAcademique: '2024-2025',
        semestre: 'S1',
        niveau: 'N1',
        section: 'FRANCOPHONE',
        avecCorrige: true,
        dureeMinutes: 120,
        fichier: { pages: 4, tailleMb: 1.2 },
        dateAjout: '2026-10-02T08:00:00.000Z',
      },
    ],
    total: 42,
    pagination: {
      limit: 20,
      page: 1,
      hasMore: false,
      nextCursor: null,
    },
    filtresActifs: {
      type: req.type ? [String(req.type)] : [],
      typeEpreuve: req.typeEpreuve ? [String(req.typeEpreuve)] : [],
      semestre: req.semestre ? [String(req.semestre)] : [],
      matiere: req.matiere ? [String(req.matiere)] : [],
      enseignant: req.enseignant ? [String(req.enseignant)] : [],
      annee: req.annee ? [String(req.annee)] : [],
      section: req.section ? [String(req.section)] : [],
      avecCorrige: req.avecCorrige ?? null,
      q: req.q ?? null,
      tri: req.tri ?? 'recent',
    },
    facettes: {
      ...FACETTES_VIDES,
      type: [{ valeur: 'EPREUVE', label: 'Épreuve', labelEn: 'Exam', n: 42, selectionne: false }],
      typeEpreuve: [
        { valeur: 'SN', label: 'Session normale', labelEn: 'Final exam', n: 25, selectionne: req.typeEpreuve === 'SN' },
        { valeur: 'CC', label: 'Contrôle continu', labelEn: 'Continuous assessment', n: 17, selectionne: req.typeEpreuve === 'CC' },
      ],
      matiere: [{ valeur: 'mat-analyse', label: 'Analyse 1', labelEn: 'Analyse 1', n: 14, selectionne: req.matiere === 'mat-analyse' }],
      enseignant: [{ valeur: 'ens-mballa', label: 'Dr Paul MBALLA', labelEn: 'Dr Paul MBALLA', n: 9, selectionne: false }],
    },
  });

  beforeEach(async () => {
    catalogueMock.mockReset();
    catalogueMock.mockImplementation(async (req) => reponseSimulee(req));

    await TestBed.configureTestingModule({
      imports: [BibliothequeHome],
      providers: [
        provideRouter([]),
        {
          provide: DocumentsRepository,
          useValue: {
            catalogue: catalogueMock,
            getDocuments: vi.fn(),
          },
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
        {
          provide: AuthService,
          useValue: {
            state: signal({ isInitializing: false, user: undefined }),
          },
        },
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
          useValue: {
            formats: signal([{ type: DocumentType.epreuve, label: 'Épreuve' }]),
          },
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
  });

  it('utilise les compteurs n et total du serveur et dédoublonne les ressources par id', () => {
    expect((component as any).documents().length).toBe(1);
    expect((component as any).totalAffiche()).toBe(42);
    expect((component as any).compteType(DocumentType.epreuve)).toBe(42);
    expect((component as any).compteMatiere('mat-analyse')).toBe(14);
  });

  it('donne la même requête et la même liste quel que soit l’ordre des filtres, et permet de retirer le dernier filtre', async () => {
    // Ordre 1 : Nature SN puis Matière mat-analyse
    (component as any).selectTypeEpreuve('SN');
    (component as any).selectMatiere('mat-analyse');
    const appelOrdre1 = catalogueMock.mock.calls[catalogueMock.mock.calls.length - 1][0];

    // Réinitialiser
    (component as any).reinitialiser();

    // Ordre 2 : Matière mat-analyse puis Nature SN
    (component as any).selectMatiere('mat-analyse');
    (component as any).selectTypeEpreuve('SN');
    const appelOrdre2 = catalogueMock.mock.calls[catalogueMock.mock.calls.length - 1][0];

    expect(appelOrdre1).toEqual(appelOrdre2);
    expect((component as any).pastillesActives().length).toBe(2);

    // Retirer le dernier filtre posé (SN) garde le filtre matière
    (component as any).retirerDernierFiltre();
    expect((component as any).selectedTypeEpreuve()).toBeNull();
    expect((component as any).selectedMatiere()).toBe('mat-analyse');
  });

  it('n’envoie aucun paramètre de classe et n’affiche ni bandeau Ma classe ni bouton Changer de classe', async () => {
    const appelInitial = catalogueMock.mock.calls[0][0] ?? {};
    expect(appelInitial.universiteId).toBeUndefined();
    expect(appelInitial.filiereId).toBeUndefined();
    expect(appelInitial.niveau).toBeUndefined();

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.nl-biblio__classe')).toBeNull();
    expect(el.textContent ?? '').not.toMatch(/Changer de classe/i);
  });

  it('§9.2 : en cas de changements rapides A -> B -> A, ignore la réponse tardive de B', async () => {
    let resoudreB!: (val: ReponseCatalogue) => void;
    const promesseB = new Promise<ReponseCatalogue>((r) => {
      resoudreB = r;
    });

    catalogueMock.mockImplementationOnce(() => promesseB);
    (component as any).selectTypeEpreuve('SN');

    // Avant que B ne réponde, un nouveau rechargement A répond immédiatement
    catalogueMock.mockImplementationOnce(async () => ({
      ...reponseSimulee(),
      total: 11,
      ressources: [
        {
          ...reponseSimulee().ressources[0],
          id: 'doc-classe-a',
          titre: 'Ressource Classe A',
        },
      ],
    }));
    (component as any).selectTypeEpreuve(null);
    await Promise.resolve();
    await Promise.resolve();

    // La réponse tardive de B arrive ensuite : elle doit être ignorée
    resoudreB({
      ...reponseSimulee(),
      total: 99,
      ressources: [
        {
          ...reponseSimulee().ressources[0],
          id: 'doc-classe-b-obsolete',
          titre: 'Ressource Classe B Obsolète',
        },
      ],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect((component as any).totalAffiche()).toBe(11);
    expect((component as any).documents().map((d: any) => d.id)).toEqual(['doc-classe-a']);
  });

  it('§5.2 & §9.1 : conserve avecCorrige=false et empêche deux appels simultanés de page suivante', async () => {
    (component as any).selectedAvecCorrige.set(false);
    await component.load(false, true);
    const dernierAppel = catalogueMock.mock.calls[catalogueMock.mock.calls.length - 1][0] ?? {};
    expect(dernierAppel.avecCorrige).toBe(false);

    // Simulation de pagination avec hasMore = true
    (component as any).hasMoreServer.set(true);
    (component as any).nextCursor.set('cur-page-2');

    let resoudrePage2!: (val: ReponseCatalogue) => void;
    catalogueMock.mockImplementationOnce(
      () =>
        new Promise<ReponseCatalogue>((r) => {
          resoudrePage2 = r;
        }),
    );

    const nbAppelsAvant = catalogueMock.mock.calls.length;
    const p1 = (component as any).afficherPlus();
    const p2 = (component as any).afficherPlus(); // second clic immédiat ignoré
    expect(catalogueMock.mock.calls.length).toBe(nbAppelsAvant + 1);

    resoudrePage2(reponseSimulee());
    await Promise.all([p1, p2]);
  });
});
