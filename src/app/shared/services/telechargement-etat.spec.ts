import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  DocumentModel,
  DocumentsRepository,
  OfflineRepository,
  StockageHorsLigne,
  ResultatEnregistrementLocal,
} from '../../core/bibliotheque';
import { ToastService } from '../ui/toast/toast';
import { TelechargementEtat, MAX_TELECHARGEMENTS_SIMULTANES } from './telechargement-etat';

const doc = {
  id: 'd1',
  titre: 'Analyse Mathématique',
  urlPdf: 'https://exemple.test/a.pdf',
  dateAjout: new Date('2026-01-01T00:00:00Z'),
  tailleMb: 1.5,
  pages: 12,
} as DocumentModel;

describe('TelechargementEtat (Gestionnaire centralisé de téléchargement interne)', () => {
  const ids = signal<ReadonlySet<string>>(new Set());
  const stockage = {
    ids,
    rafraichir: vi.fn(async () => undefined),
    estDisponible: vi.fn(async () => true),
    telechargerEtEnregistrer: vi.fn(
      async (
        _id: string,
        _url: string,
        _fiche?: DocumentModel,
        opts?: { onProgression?: (pct: number) => void },
      ): Promise<ResultatEnregistrementLocal> => {
        opts?.onProgression?.(50);
        opts?.onProgression?.(100);
        return { ok: true };
      },
    ),
    demanderPersistance: vi.fn(async () => true),
    supprimer: vi.fn(async () => undefined),
    urlLocale: vi.fn(async () => null),
  };
  const docs = {
    urlLecture: vi.fn(async () => 'https://exemple.test/signe.pdf'),
    recordDownload: vi.fn(async () => undefined),
  };
  const offline = {
    markOffline: vi.fn(async () => undefined),
    removeOffline: vi.fn(async () => undefined),
  };
  const toast = { succes: vi.fn(), info: vi.fn(), erreur: vi.fn() };

  beforeEach(() => {
    ids.set(new Set());
    vi.clearAllMocks();
    stockage.estDisponible.mockResolvedValue(true);
    stockage.telechargerEtEnregistrer.mockImplementation(
      async (
        _id: string,
        _url: string,
        _fiche?: DocumentModel,
        opts?: { onProgression?: (pct: number) => void },
      ): Promise<ResultatEnregistrementLocal> => {
        opts?.onProgression?.(50);
        opts?.onProgression?.(100);
        return { ok: true };
      },
    );

    TestBed.configureTestingModule({
      providers: [
        { provide: StockageHorsLigne, useValue: stockage },
        { provide: DocumentsRepository, useValue: docs },
        { provide: OfflineRepository, useValue: offline },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('ne déclare « fait » que lorsque le fichier est dans le stockage local IndexedDB', () => {
    const service = TestBed.inject(TelechargementEtat);
    expect(service.etat('d1')).toBe('repos');
    expect(service.estDisponible('d1')).toBe(false);
    ids.set(new Set(['d1']));
    expect(service.etat('d1')).toBe('fait');
    expect(service.estDisponible('d1')).toBe(true);
    expect(service.progression('d1')).toBe(100);
  });

  it('ne déclenche jamais le téléchargement classique du navigateur (<a download>)', async () => {
    const spyCreateElement = vi.spyOn(window.document, 'createElement');
    await TestBed.inject(TelechargementEtat).telecharger(doc);
    const ancresCreees = spyCreateElement.mock.calls.filter(([tag]) => tag.toLowerCase() === 'a');
    expect(ancresCreees.length).toBe(0);
    spyCreateElement.mockRestore();
  });

  it('un document déjà téléchargé dans la même version n’est pas téléchargé une seconde fois', async () => {
    ids.set(new Set(['d1']));
    stockage.estDisponible.mockResolvedValue(true);
    await TestBed.inject(TelechargementEtat).telecharger(doc);
    expect(stockage.telechargerEtEnregistrer).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('un échec de rangement ne laisse jamais l’état « fait » et affiche une erreur', async () => {
    stockage.telechargerEtEnregistrer.mockResolvedValue({ ok: false, raison: 'reseau' });
    const service = TestBed.inject(TelechargementEtat);
    await service.telecharger(doc);
    expect(service.etat('d1')).toBe('repos');
    expect(service.etat('d1')).not.toBe('fait');
    expect(toast.erreur).toHaveBeenCalled();
  });

  it('gère explicitement le dépassement de quota (QuotaExceededError)', async () => {
    stockage.telechargerEtEnregistrer.mockResolvedValue({ ok: false, raison: 'quota' });
    const service = TestBed.inject(TelechargementEtat);
    await service.telecharger(doc);
    expect(toast.erreur).toHaveBeenCalledWith(
      expect.stringContaining('Espace de stockage insuffisant'),
    );
  });

  it('gère explicitement un fichier corrompu ou invalide (erreur d’intégrité)', async () => {
    stockage.telechargerEtEnregistrer.mockResolvedValue({ ok: false, raison: 'integrite' });
    const service = TestBed.inject(TelechargementEtat);
    await service.telecharger(doc);
    expect(toast.erreur).toHaveBeenCalledWith(
      expect.stringContaining('incomplet ou invalide'),
    );
  });

  it('limite le nombre de téléchargements simultanés à MAX_TELECHARGEMENTS_SIMULTANES', async () => {
    let resoudreBloques: (() => void)[] = [];
    stockage.telechargerEtEnregistrer.mockImplementation(
      () =>
        new Promise<ResultatEnregistrementLocal>((resolve) => {
          resoudreBloques.push(() => resolve({ ok: true }));
        }),
    );

    const service = TestBed.inject(TelechargementEtat);
    const promesses: Promise<void>[] = [];
    for (let i = 1; i <= MAX_TELECHARGEMENTS_SIMULTANES; i++) {
      promesses.push(
        service.telecharger({ ...doc, id: `doc-${i}`, titre: `Doc ${i}` } as DocumentModel),
      );
    }

    // Laisser les promesses démarrer jusqu'à telechargerEtEnregistrer
    await new Promise((r) => setTimeout(r, 10));
    expect(service.nombreEnCours()).toBe(MAX_TELECHARGEMENTS_SIMULTANES);

    // Le 4e téléchargement simultané est refusé proprement
    await service.telecharger({ ...doc, id: 'doc-trop', titre: 'Doc Trop' } as DocumentModel);
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining('3 téléchargements simultanés'),
    );

    resoudreBloques.forEach((fn) => fn());
    await Promise.all(promesses);
    expect(service.nombreEnCours()).toBe(0);
  });

  it('permet de supprimer un document du stockage local et met à jour le serveur', async () => {
    const service = TestBed.inject(TelechargementEtat);
    await service.supprimer('d1');
    expect(stockage.supprimer).toHaveBeenCalledWith('d1');
    expect(offline.removeOffline).toHaveBeenCalledWith('d1');
    expect(toast.succes).toHaveBeenCalled();
  });

  it('un succès enregistre le fichier avec ses métadonnées dans IndexedDB et le marquage serveur', async () => {
    await TestBed.inject(TelechargementEtat).telecharger(doc);
    expect(stockage.telechargerEtEnregistrer).toHaveBeenCalledWith(
      'd1',
      'https://exemple.test/signe.pdf',
      doc,
      expect.objectContaining({
        onProgression: expect.any(Function),
      }),
    );
    expect(offline.markOffline).toHaveBeenCalledWith('d1');
    expect(toast.succes).toHaveBeenCalled();
  });
});
