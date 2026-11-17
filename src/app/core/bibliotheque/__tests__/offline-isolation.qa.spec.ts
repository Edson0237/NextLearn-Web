import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  StockageHorsLigne,
  DocumentModel,
  DocumentType,
  LectureProgressRepository,
} from '../index';
import { SecureStorageService } from '../../storage/services/secure-storage.service';

function pdfBytes(): ArrayBuffer {
  const arr = new Uint8Array(1024);
  arr.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0);
  return arr.buffer;
}

function docSample(id: string, titre: string): DocumentModel {
  return {
    id,
    titre,
    description: 'Support QA',
    type: DocumentType.cours,
    matiere: 'Architecture',
    enseignant: 'Pr QA',
    universite: 'Université QA',
    niveau: 'N3',
    avecCorrige: false,
    anneeAcademique: '2025-2026',
    tailleMb: 0.1,
    pages: 2,
    urlPdf: `https://example.test/${id}.pdf`,
    dateAjout: new Date('2026-10-01T10:00:00.000Z'),
    vues: 1,
    telechargements: 1,
    noteMoyenne: 5,
  };
}

describe('QA Isolation & Résilience Stockage Hors-Ligne PWA (NL-OFF-008 / 012 / 013)', () => {
  let service: StockageHorsLigne;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SecureStorageService,
        StockageHorsLigne,
        LectureProgressRepository,
      ],
    });
    service = TestBed.inject(StockageHorsLigne);
    await service.purgerToutLeStockageLocal();
  });

  it('NL-OFF-012 / NL-OFF-013 : un document sauvegardé par l’utilisateur A n’est jamais exposé à B ni après purge de déconnexion', async () => {
    const fetchOrig = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () =>
      new Response(pdfBytes(), { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
    );
    try {
      await service.definirUtilisateur('user-a-qa');
      const docA = docSample('doc-priv-a', 'Cours Confidentiel A');
      const saved = await service.telechargerEtEnregistrer(docA.id, docA.urlPdf, docA);
      expect(saved.ok).toBe(true);
      expect(await service.estDisponible('doc-priv-a')).toBe(true);

      // Bascule sur l'utilisateur B sur le même appareil
      await service.definirUtilisateur('user-b-qa');
      expect(await service.estDisponible('doc-priv-a')).toBe(false);
      expect(service.ids().size).toBe(0);
      expect(await service.obtenirPourLecture('doc-priv-a')).toBeNull();

      // Déconnexion complète avec purge
      await service.definirUtilisateur('user-a-qa');
      expect(await service.estDisponible('doc-priv-a')).toBe(true);
      await service.purgerToutLeStockageLocal();
      expect(await service.estDisponible('doc-priv-a')).toBe(false);
    } finally {
      globalThis.fetch = fetchOrig;
    }
  });

  it('NL-OFF-008 / NL-OFF-006 : annulation ou double téléchargement ne crée jamais de doublon ni de document incomplet', async () => {
    await service.definirUtilisateur('user-qa-dup');
    const ac = new AbortController();
    const fetchOrig = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      .mockImplementation(async () => new Response(pdfBytes(), { status: 200, headers: { 'Content-Type': 'application/pdf' } }));

    try {
      const docAbort = docSample('doc-abort', 'Annulé');
      const aborted = await service.telechargerEtEnregistrer(docAbort.id, docAbort.urlPdf, docAbort, { signal: ac.signal });
      expect(aborted.ok).toBe(false);
      expect(await service.estDisponible('doc-abort')).toBe(false);

      const docDup = docSample('doc-dup', 'Document Unique');
      const r1 = await service.enregistrer(docDup.id, docDup.urlPdf, docDup);
      const r2 = await service.enregistrer(docDup.id, docDup.urlPdf, docDup);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(service.enregistrements().filter((e) => e.id === 'doc-dup')).toHaveLength(1);
    } finally {
      globalThis.fetch = fetchOrig;
    }
  });
});
