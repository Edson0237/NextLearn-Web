import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentsRepository } from './documents-repository';

describe('DocumentsRepository', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('charge une page de documents', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.getDocumentsPage({ page: 1, limit: 20 });
    const req = http.expectOne('/api/documents?page=1&limit=20&sort=recent');
    req.flush({
      data: [{ _id: 'd1', titre: 'Cours 1', type: 'COURS', niveau: 'N3', anneeAcademique: '2025', tailleMb: 1, pages: 10, urlPdf: '' }],
      meta: { page: 1, totalPages: 1, total: 1, sort: 'recent' },
    });

    const page = await promesse;
    expect(page.items.length).toBe(1);
    expect(page.items[0].titre).toBe('Cours 1');
    http.verify();
  });

  it('demande une URL de lecture fraîche', async () => {
    const repo = TestBed.inject(DocumentsRepository);
    const http = TestBed.inject(HttpTestingController);

    const promesse = repo.urlLecture('d1');
    const req = http.expectOne('/api/documents/d1/signed-url');
    req.flush({ data: { url: 'https://fresh.test/doc.pdf' } });

    const url = await promesse;
    expect(url).toBe('https://fresh.test/doc.pdf');
    http.verify();
  });
});
