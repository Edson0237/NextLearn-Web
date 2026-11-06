import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('ng2-pdf-viewer', () => ({
  PdfViewerModule: class MockPdfViewerModule {},
  PdfViewerComponent: class MockPdfViewerComponent {},
}));

import { Failure } from '../../../../core/models';
import { DocumentsRepository } from '../../../../core/bibliotheque';
import { LectureProgressRepository } from '../../../../core/bibliotheque';
import { ProgressionRepository } from '../../../../core/progression';
import { StockageHorsLigne } from '../../../../core/bibliotheque';
import { HistoriqueNavigation } from '../../../../core/router';
import { NotificationsEtat } from '../../../../core/notifications';
import { PdfReader } from '../pdf-reader';

describe('PdfReader (Composant Lecteur Universel PDF & DOCX)', () => {
  let docsRepoMock: any;
  let lectureRepoMock: any;
  let progressionMock: any;
  let stockageMock: any;
  let historiqueMock: any;
  let notifEtatMock: any;
  let routeSnapshotMock: any;

  beforeEach(() => {
    docsRepoMock = {
      recordView: vi.fn(),
      urlLecture: vi.fn(),
      getById: vi.fn(),
    };
    lectureRepoMock = {
      getPour: vi.fn().mockResolvedValue(null),
      sauver: vi.fn().mockResolvedValue(undefined),
      enregistrer: vi.fn().mockResolvedValue(undefined),
    };
    progressionMock = {
      enregistrerTempsEtude: vi.fn().mockResolvedValue(undefined),
    };
    stockageMock = {
      obtenirPourLecture: vi.fn().mockResolvedValue(null),
      urlLocale: vi.fn().mockResolvedValue(null),
      revoquerUrlLocale: vi.fn(),
    };
    historiqueMock = {
      retour: vi.fn(),
    };
    notifEtatMock = {
      marquerRessourceLue: vi.fn(),
    };
    routeSnapshotMock = {
      paramMap: new Map([['id', 'doc-123']]),
      queryParamMap: new Map(),
    };
  });

  async function creerComposant(paramId: string | null = 'doc-123') {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id' ? paramId : null) },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: DocumentsRepository, useValue: docsRepoMock },
        { provide: LectureProgressRepository, useValue: lectureRepoMock },
        { provide: ProgressionRepository, useValue: progressionMock },
        { provide: StockageHorsLigne, useValue: stockageMock },
        { provide: HistoriqueNavigation, useValue: historiqueMock },
        { provide: NotificationsEtat, useValue: notifEtatMock },
      ],
    });

    const fixture = TestBed.createComponent(PdfReader);
    const instance = fixture.componentInstance;
    return { fixture, instance };
  }

  it('si l’identifiant du document est absent : affiche immédiatement une erreur', async () => {
    const { instance } = await creerComposant(null);
    await instance.ngOnInit();

    expect(instance['error']()).toBe('Document non spécifié.');
    expect(instance['loading']()).toBe(false);
  });

  it('charge en priorité la version locale enregistrée hors ligne (IndexedDB)', async () => {
    stockageMock.obtenirPourLecture.mockResolvedValue({
      url: 'blob:https://app.nextlearn.cm/local-file-uuid',
      format: 'pdf',
      tailleOctets: 50000,
    });

    const { instance } = await creerComposant('doc-offline');
    await instance.ngOnInit();

    expect(instance['url']()).toBe('blob:https://app.nextlearn.cm/local-file-uuid');
    expect(instance['format']()).toBe('pdf');
    expect(instance['loading']()).toBe(false);
    expect(docsRepoMock.recordView).toHaveBeenCalledWith('doc-offline');
    expect(docsRepoMock.urlLecture).not.toHaveBeenCalled();
  });

  it('obtient l’URL signée distante quand le document n’est pas en cache local', async () => {
    docsRepoMock.urlLecture.mockResolvedValue('https://r2.nextlearn.cm/documents/algebre.pdf?token=abc');

    const { instance } = await creerComposant('doc-remote');
    await instance.ngOnInit();

    expect(instance['url']()).toBe('https://r2.nextlearn.cm/documents/algebre.pdf?token=abc');
    expect(instance['format']()).toBe('pdf');
    expect(instance['loading']()).toBe(false);
    expect(docsRepoMock.recordView).toHaveBeenCalledWith('doc-remote');
  });

  it('détecte automatiquement le format docx si l’URL cible pointe sur un Word', async () => {
    docsRepoMock.urlLecture.mockResolvedValue('https://r2.nextlearn.cm/devoirs/physique.docx');

    const { instance } = await creerComposant('doc-word');
    await instance.ngOnInit();

    expect(instance['format']()).toBe('docx');
    expect(instance['url']()).toBe('https://r2.nextlearn.cm/devoirs/physique.docx');
  });

  it('affiche un message d’erreur clair si aucune URL n’est retournée par le serveur', async () => {
    docsRepoMock.urlLecture.mockResolvedValue(null);
    docsRepoMock.getById.mockResolvedValue(null);

    const { instance } = await creerComposant('doc-inexistant');
    await instance.ngOnInit();

    expect(instance['error']()).toBe('Impossible d\'obtenir l\'URL du document.');
    expect(instance['loading']()).toBe(false);
  });

  it('gère une exception Failure (403/404) avec le message de l’exception', async () => {
    docsRepoMock.urlLecture.mockRejectedValue(new Failure('Ce document appartient à une autre filière.', 403));

    const { instance } = await creerComposant('doc-interdit');
    await instance.ngOnInit();

    expect(instance['error']()).toBe('Ce document appartient à une autre filière.');
    expect(instance['loading']()).toBe(false);
  });

  it('navigation : surChangementDePage met à jour la page courante', async () => {
    docsRepoMock.urlLecture.mockResolvedValue('https://r2.nextlearn.cm/cours.pdf');
    const { instance } = await creerComposant('doc-nav');
    await instance.ngOnInit();

    instance['surChangementDePage'](3);
    expect(instance['page']()).toBe(3);
    expect(instance['pagesVues'].has(3)).toBe(true);
  });

  it('chargement réussi du PDF (onLoaded) : enregistre le nombre total de pages', async () => {
    const { instance } = await creerComposant('doc-total');
    instance['onLoaded']({ numPages: 42 });

    expect(instance['totalPages']()).toBe(42);
  });

  it('erreur de rendu PDF (onError) : bascule en mode secours fallback', async () => {
    const { instance } = await creerComposant('doc-err');
    instance['onError'](new Error('Corrupted PDF bytes'));

    expect(instance['fallback']()).toBe(true);
  });

  it('fermeture (goBack) : utilise l’historique de navigation vers la fiche', async () => {
    const { instance } = await creerComposant('doc-back');
    await instance.ngOnInit();

    instance['goBack']();
    expect(historiqueMock.retour).toHaveBeenCalled();
  });
});
