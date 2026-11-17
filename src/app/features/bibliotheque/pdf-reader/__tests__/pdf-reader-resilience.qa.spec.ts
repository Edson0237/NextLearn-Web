import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('ng2-pdf-viewer', () => ({
  PdfViewerModule: class MockPdfViewerModule {},
  PdfViewerComponent: class MockPdfViewerComponent {},
}));

import { DocumentsRepository, LectureProgressRepository, StockageHorsLigne } from '../../../../core/bibliotheque';
import { ProgressionRepository } from '../../../../core/progression';
import { HistoriqueNavigation } from '../../../../core/router';
import { NotificationsEtat } from '../../../../core/notifications';
import { PdfReader } from '../pdf-reader';

describe('QA Lecteur PDF PWA — Navigation, Bornes de pages & Résilience (NL-PDF-003..013)', () => {
  let docsRepoMock: any;
  let lectureRepoMock: any;
  let stockageMock: any;
  let historiqueMock: any;

  beforeEach(() => {
    docsRepoMock = {
      recordView: vi.fn().mockResolvedValue(undefined),
      urlLecture: vi.fn().mockResolvedValue({ url: 'blob:http://localhost/qa-pdf', mimeType: 'application/pdf', type: 'cours' }),
      getById: vi.fn().mockResolvedValue({ id: 'doc-qa', titre: 'Algèbre', type: 'cours' }),
    };
    lectureRepoMock = {
      getPour: vi.fn().mockResolvedValue(null),
      sauver: vi.fn().mockResolvedValue(undefined),
      enregistrer: vi.fn().mockResolvedValue(undefined),
    };
    stockageMock = {
      obtenirPourLecture: vi.fn().mockResolvedValue(null),
      urlLocale: vi.fn().mockResolvedValue(null),
      revoquerUrlLocale: vi.fn(),
    };
    historiqueMock = { retour: vi.fn() };
  });

  function createReader(id = 'doc-qa') {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id' ? id : null) },
              queryParamMap: { get: () => null },
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: DocumentsRepository, useValue: docsRepoMock },
        { provide: LectureProgressRepository, useValue: lectureRepoMock },
        { provide: ProgressionRepository, useValue: { enregistrerTempsEtude: vi.fn() } },
        { provide: StockageHorsLigne, useValue: stockageMock },
        { provide: HistoriqueNavigation, useValue: historiqueMock },
        { provide: NotificationsEtat, useValue: { marquerRessourceLue: vi.fn() } },
      ],
    });
    return TestBed.createComponent(PdfReader).componentInstance;
  }

  it('NL-PDF-002 / NL-PDF-003 : charge un PDF hors-ligne prioritairement et suit le changement de page', async () => {
    stockageMock.obtenirPourLecture.mockResolvedValue({
      id: 'doc-qa',
      url: 'blob:http://localhost/offline-qa',
      format: 'pdf',
      mimeType: 'application/pdf',
    });

    const reader = createReader();
    await reader.ngOnInit();

    expect((reader as any).error()).toBeNull();
    expect((reader as any).url()).toBe('blob:http://localhost/offline-qa');

    (reader as any).onLoaded({ numPages: 5 });
    expect((reader as any).totalPages()).toBe(5);

    (reader as any).surChangementDePage(3);
    expect((reader as any).page()).toBe(3);
  });

  it('NL-PDF-005 / NL-PDF-013 : affiche une erreur contrôlée si le chargement échoue et permet le retour', async () => {
    docsRepoMock.urlLecture.mockRejectedValueOnce(new Error('Stream timeout'));
    const reader = createReader();
    await reader.ngOnInit();

    expect((reader as any).error()).toBeTruthy();
    expect((reader as any).loading()).toBe(false);

    (reader as any).onError(new Error('PDF corrompu'));
    expect((reader as any).error()).toBeTruthy();

    (reader as any).goBack();
    expect(historiqueMock.retour).toHaveBeenCalled();
  });
});
