import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentsRepository } from '../repositories/documents-repository';

describe('DocumentsRepository — Smart Document Loading', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('charge une page de documents avec pagination classique', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.getDocumentsPage({ page: 1, limit: 20 });
    const req = http.expectOne('/api/documents?page=1&limit=20&sort=recent');
    req.flush({
      data: [{ _id: 'd1', titre: 'Cours 1', type: 'COURS', niveau: 'N3', anneeAcademique: '2025', tailleMb: 1, pages: 10 }],
      meta: { page: 1, totalPages: 1, total: 1, sort: 'recent' },
    });

    const page = await promesse;
    expect(page.items.length).toBe(1);
    expect(page.items[0].titre).toBe('Cours 1');
    http.verify();
  });

  it('charge les documents avec curseur (getDocuments)', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.getDocuments({ matiereId: 'm1' }, 'cursor123', 20);
    const req = http.expectOne('/api/documents?limit=20&cursor=cursor123&matiereId=m1');
    req.flush({
      success: true,
      data: {
        documents: [
          { _id: 'doc1', titre: 'Algèbre', type: 'COURS', niveau: 'L1', anneeAcademique: '2026', tailleMb: 1.5, pages: 12 },
        ],
        pagination: {
          limit: 20,
          hasMore: true,
          nextCursor: 'cursorNext456',
        },
      },
    });

    const page = await promesse;
    expect(page.items.length).toBe(1);
    expect(page.items[0].titre).toBe('Algèbre');
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('cursorNext456');
    http.verify();
  });

  it('récupère les détails documentaires sans URL signée (getDocumentDetails)', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.getDocumentDetails('d1');
    const req = http.expectOne('/api/documents/d1');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        _id: 'd1',
        titre: 'Détail Cours',
        type: 'COURS',
        tailleMb: 2,
        pages: 20,
      },
    });

    const doc = await promesse;
    expect(doc).not.toBeNull();
    expect(doc?.titre).toBe('Détail Cours');
    http.verify();
  });

  it('demande un accès de lecture à la demande (requestDocumentReading)', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.requestDocumentReading('d1');
    const req = http.expectOne('/api/documents/d1/read');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      data: {
        readUrl: 'https://r2.test/secure.pdf?exp=300',
        expiresIn: 300,
        mimeType: 'application/pdf',
        format: 'pdf',
      },
    });

    const access = await promesse;
    expect(access.readUrl).toBe('https://r2.test/secure.pdf?exp=300');
    expect(access.expiresIn).toBe(300);
    expect(access.mimeType).toBe('application/pdf');
    http.verify();
  });

  it('demande un téléchargement avec downloadDocument', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.downloadDocument('d1');
    const req = http.expectOne('/api/documents/d1/download');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      data: {
        url: 'https://r2.test/download.pdf',
        expiresIn: 3600,
      },
    });

    const result = await promesse;
    expect(result.url).toBe('https://r2.test/download.pdf');
    expect(result.expiresIn).toBe(3600);
    http.verify();
  });
});
