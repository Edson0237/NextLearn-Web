import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReportRepository } from '../repositories/report-repository';
import { CibleSignalement } from '../models/report.model';

describe('QA Signalements PWA — ReportRepository (NL-REPORT-001..005)', () => {
  let repo: ReportRepository;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReportRepository],
    });
    repo = TestBed.inject(ReportRepository);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('NL-REPORT-001 / NL-REPORT-003 : charge le catalogue des motifs et transmet une précision libre non tronquée', async () => {
    const pMotifs = repo.getMotifs();
    const reqM = httpMock.expectOne('/api/reports/motifs');
    reqM.flush({
      data: {
        slaHeures: 24,
        motifs: [{ code: 'AUTRE', label: 'Autre', description: 'Préciser', masquageImmediat: false }],
      },
    });
    const cat = await pMotifs;
    expect(cat.slaHeures).toBe(24);
    expect(cat.motifs[0].code).toBe('AUTRE');

    const commentaire = '   Erreur page 7 : énoncé tronqué et exercice 3 manquant.   ';
    const pSend = repo.signaler({
      cibleType: CibleSignalement.document,
      cibleId: 'doc-99',
      motif: 'AUTRE',
      commentaire,
    });
    const reqS = httpMock.expectOne('/api/reports');
    expect(reqS.request.method).toBe('POST');
    expect(reqS.request.body).toEqual({
      cibleType: 'document',
      cibleId: 'doc-99',
      motif: 'AUTRE',
      commentaire: commentaire.trim(),
    });
    reqS.flush({ data: { message: 'Signalement transmis.', slaHeures: 24 } });

    const res = await pSend;
    expect(res.slaHeures).toBe(24);
  });
});
