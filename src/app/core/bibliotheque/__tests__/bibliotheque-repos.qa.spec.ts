import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DocumentsRepository } from '../repositories/documents-repository';
import { FavorisRepository } from '../repositories/favoris-repository';
import { OfflineRepository } from '../repositories/offline-repository';
import { StockageHorsLigne } from '../services/stockage-hors-ligne';
import { DocumentSort, DocumentType } from '../models/document.model';
import { FavorisEtat } from '../../../shared/services/favoris-etat';
import { ToastService } from '../../../shared/ui/toast/toast';

const DOC_RAW = {
  _id: 'doc-1',
  titre: 'Algèbre Linéaire',
  description: 'Cours complet',
  type: 'COURS',
  matiere: 'Mathématiques',
  niveau: 'N1',
  universite: 'ENSPY',
  filiere: 'Informatique',
  fileName: 'algebre.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  downloadsCount: 10,
  viewsCount: 25,
  averageRating: 4.5,
  ratingsCount: 2,
};

describe('Bibliotheque Repositories & FavorisEtat — QA Coverage Suite', () => {
  let docsRepo: DocumentsRepository;
  let favRepo: FavorisRepository;
  let offRepo: OfflineRepository;
  let favEtat: FavorisEtat;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let stockageStub: {
    rafraichir: ReturnType<typeof vi.fn>;
    infoDocument: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    stockageStub = {
      rafraichir: vi.fn(async () => undefined),
      infoDocument: vi.fn(() => undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StockageHorsLigne, useValue: stockageStub },
      ],
    });
    docsRepo = TestBed.inject(DocumentsRepository);
    favRepo = TestBed.inject(FavorisRepository);
    offRepo = TestBed.inject(OfflineRepository);
    favEtat = TestBed.inject(FavorisEtat);
    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('DocumentsRepository.catalogue construit les paramètres et gère AbortSignal', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(docsRepo.catalogue({}, aborted.signal)).rejects.toThrow();

    const pCat = docsRepo.catalogue({
      universiteId: 'u-1',
      filiereId: ['f-1', 'f-2'],
      niveau: 'N3',
      type: [DocumentType.cours],
      typeEpreuve: 'CC',
      semestre: 'S1',
      matiere: 'Mathématiques',
      enseignant: 'Dr. Kamga',
      annee: '2025-2026',
      section: 'francophone',
      avecCorrige: true,
      q: '  algebre   lineaire ',
      tri: 'populaire',
      page: 2,
      limit: 15,
    });
    const req = httpMock.expectOne((r) => r.url === '/api/v2/catalogue');
    expect(req.request.params.get('universiteId')).toBe('u-1');
    expect(req.request.params.get('filiereId')).toBe('f-1,f-2');
    expect(req.request.params.get('niveau')).toBe('N3');
    expect(req.request.params.get('type')).toBe('COURS');
    expect(req.request.params.get('avecCorrige')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ data: { items: [], facettes: {}, pagination: {} } });
    await pCat;

    const controller = new AbortController();
    const pAbortedMidFlight = docsRepo.catalogue({ tri: 'recent', cursor: 'c-1' }, controller.signal);
    httpMock.expectOne((r) => r.url === '/api/v2/catalogue');
    controller.abort();
    await expect(pAbortedMidFlight).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('DocumentsRepository gère lecture, téléchargement, recherche, notes et urlLecture fallback', async () => {
    const pList = docsRepo.getDocuments({ type: 'COURS', search: 'alg' }, 'cur-1', 10);
    httpMock.expectOne((r) => r.url === '/api/documents').flush({ data: [DOC_RAW], meta: { hasMore: false } });
    expect((await pList).items).toHaveLength(1);

    const pDet = docsRepo.getById('doc-1');
    httpMock.expectOne('/api/documents/doc-1').flush({ data: DOC_RAW });
    expect((await pDet)?.titre).toBe('Algèbre Linéaire');

    const pRead = docsRepo.requestDocumentReading('doc-1');
    httpMock.expectOne('/api/documents/doc-1/read').flush({
      data: { readUrl: 'https://cdn.local/doc.pdf', expiresIn: 180, mimeType: 'application/pdf', format: 'pdf', fileSize: 2048 },
    });
    expect(await pRead).toEqual({
      readUrl: 'https://cdn.local/doc.pdf',
      expiresIn: 180,
      mimeType: 'application/pdf',
      format: 'pdf',
      size: 2048,
    });

    const pDl = docsRepo.downloadDocument('doc-1');
    httpMock.expectOne('/api/documents/doc-1/download').flush({ data: { url: 'https://cdn.local/dl.pdf', expiresIn: 600 } });
    expect(await pDl).toEqual({ url: 'https://cdn.local/dl.pdf', expiresIn: 600 });

    const pPage = docsRepo.getDocumentsPage({ page: 2, sort: DocumentSort.popular, type: 'COURS', semestre: 'S1' });
    httpMock.expectOne((r) => r.url === '/api/documents').flush({ data: [DOC_RAW], meta: {} });
    expect((await pPage).items).toHaveLength(1);

    const pSearchPage = docsRepo.searchPage('math', { page: 1, sort: DocumentSort.recent, semestre: 'S1' });
    httpMock.expectOne((r) => r.url === '/api/documents/search').flush({ data: [DOC_RAW], meta: {} });
    expect((await pSearchPage).items).toHaveLength(1);

    const pSearch = docsRepo.search('math');
    httpMock.expectOne((r) => r.url === '/api/documents/search').flush({ data: [DOC_RAW] });
    expect(await pSearch).toHaveLength(1);

    const pRec = docsRepo.getRecommended();
    httpMock.expectOne('/api/documents/recommended').flush({ data: [DOC_RAW] });
    expect(await pRec).toHaveLength(1);

    const pPop = docsRepo.getPopular();
    httpMock.expectOne('/api/documents/popular').flush({ data: [DOC_RAW] });
    expect(await pPop).toHaveLength(1);

    const pRecent = docsRepo.getRecent();
    httpMock.expectOne('/api/documents/recent').flush({ data: [DOC_RAW] });
    expect(await pRecent).toHaveLength(1);

    const pView = docsRepo.recordView('doc-1');
    httpMock.expectOne('/api/documents/doc-1/view').error(new ProgressEvent('ignore'));
    await pView;

    const pRate = docsRepo.rate('doc-1', 5);
    httpMock.expectOne('/api/documents/doc-1/rate').flush({ data: {} });
    await pRate;

    const pUrlFallback = docsRepo.urlLecture('doc-1');
    httpMock.expectOne('/api/documents/doc-1/read').flush({}, { status: 404, statusText: 'Not found' });
    await vi.waitFor(() => {
      httpMock.expectOne('/api/documents/doc-1/signed-url').flush({ data: { url: 'https://signed.local/doc.pdf' } });
    });
    expect(await pUrlFallback).toBe('https://signed.local/doc.pdf');

    const pUrlNull = docsRepo.urlLecture('doc-1');
    httpMock.expectOne('/api/documents/doc-1/read').flush({}, { status: 404, statusText: 'Not found' });
    await vi.waitFor(() => {
      httpMock.expectOne('/api/documents/doc-1/signed-url').flush({}, { status: 410, statusText: 'Gone' });
    });
    expect(await pUrlNull).toBeNull();

    const pRecDl = docsRepo.recordDownload('doc-1');
    httpMock.expectOne('/api/documents/doc-1/download').error(new ProgressEvent('ignore'));
    await pRecDl;

    expect(await docsRepo.getOfflineDocument('doc-1')).toBeNull();
    expect(stockageStub.rafraichir).toHaveBeenCalled();
  });

  it('FavorisRepository & OfflineRepository gèrent succès, 409 et 404 idempotents', async () => {
    const pFavs = favRepo.getFavorites();
    httpMock.expectOne('/api/favorites').flush({
      data: [{ documentId: DOC_RAW }, { documentId: 'invalid-string' }],
    });
    expect(await pFavs).toHaveLength(1);

    const pAdd409 = favRepo.addFavorite('doc-1');
    httpMock.expectOne('/api/favorites/doc-1').flush({}, { status: 409, statusText: 'Conflict' });
    await pAdd409;

    const pRem404 = favRepo.removeFavorite('doc-1');
    httpMock.expectOne('/api/favorites/doc-1').flush({}, { status: 404, statusText: 'Not Found' });
    await pRem404;

    const pOff = offRepo.getOfflineIds();
    httpMock.expectOne('/api/offline/documents').flush({
      data: [{ documentId: { _id: 'd-1' } }, { documentId: { id: 'd-2' } }, { documentId: 'd-3' }, { documentId: null }],
    });
    expect(Array.from(await pOff)).toEqual(['d-1', 'd-2', 'd-3']);

    const pMark409 = offRepo.markOffline('d-1');
    httpMock.expectOne('/api/offline/d-1').flush({}, { status: 409, statusText: 'Conflict' });
    await pMark409;

    const pUnmark404 = offRepo.removeOffline('d-1');
    httpMock.expectOne('/api/offline/d-1').flush({}, { status: 404, statusText: 'Not Found' });
    await pUnmark404;
  });

  it('FavorisEtat charge une fois, bascule en mode optimiste et annule sur erreur', async () => {
    const errSpy = vi.spyOn(toast, 'erreur');
    const pLoad = favEtat.charger();
    httpMock.expectOne('/api/favorites').flush({ data: [{ documentId: DOC_RAW }] });
    await pLoad;
    expect(favEtat.estFavori('doc-1')).toBe(true);

    // Bascule optimiste (retire puis remet sur échec 500)
    const pFail = favEtat.basculer('doc-1');
    expect(favEtat.estFavori('doc-1')).toBe(false);
    httpMock.expectOne('/api/favorites/doc-1').flush({}, { status: 500, statusText: 'Err' });
    await pFail;
    expect(favEtat.estFavori('doc-1')).toBe(true);
    expect(errSpy).toHaveBeenCalled();

    favEtat.oublier();
    expect(favEtat.estFavori('doc-1')).toBe(false);
  });
});
