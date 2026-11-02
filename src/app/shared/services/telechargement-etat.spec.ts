import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DocumentModel, DocumentsRepository, OfflineRepository, StockageHorsLigne } from '../../core/bibliotheque';
import { ToastService } from '../ui/toast/toast';
import { TelechargementEtat } from './telechargement-etat';

const doc = { id: 'd1', titre: 'Analyse', urlPdf: 'https://exemple.test/a.pdf' } as DocumentModel;

describe('TelechargementEtat', () => {
  const ids = signal<ReadonlySet<string>>(new Set());
  const stockage = {
    ids,
    rafraichir: vi.fn(async () => undefined),
    enregistrer: vi.fn(async () => true),
    enregistrerFiche: vi.fn(async () => undefined),
    urlLocale: vi.fn(async () => null),
  };
  const docs = { urlLecture: vi.fn(async () => 'https://exemple.test/signe.pdf'), recordDownload: vi.fn(async () => undefined) };
  const offline = { markOffline: vi.fn(async () => undefined) };
  const toast = { succes: vi.fn(), info: vi.fn(), erreur: vi.fn() };

  beforeEach(() => {
    ids.set(new Set());
    vi.clearAllMocks();
    stockage.enregistrer.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: StockageHorsLigne, useValue: stockage },
        { provide: DocumentsRepository, useValue: docs },
        { provide: OfflineRepository, useValue: offline },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('ne déclare « fait » que lorsque le fichier est dans le stockage local', () => {
    const service = TestBed.inject(TelechargementEtat);
    expect(service.etat('d1')).toBe('repos');
    ids.set(new Set(['d1']));
    expect(service.etat('d1')).toBe('fait');
  });

  it('un document déjà disponible n’est pas retéléchargé', async () => {
    ids.set(new Set(['d1']));
    await TestBed.inject(TelechargementEtat).telecharger(doc);
    expect(stockage.enregistrer).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalled();
  });

  it('un échec de rangement ne laisse jamais l’état « fait »', async () => {
    stockage.enregistrer.mockResolvedValue(false);
    const service = TestBed.inject(TelechargementEtat);
    await service.telecharger(doc);
    expect(service.etat('d1')).toBe('lance');
    expect(service.etat('d1')).not.toBe('fait');
  });

  it('un succès enregistre la fiche et le marquage serveur', async () => {
    await TestBed.inject(TelechargementEtat).telecharger(doc);
    expect(stockage.enregistrerFiche).toHaveBeenCalledWith('d1', doc);
    expect(offline.markOffline).toHaveBeenCalledWith('d1');
    expect(toast.succes).toHaveBeenCalled();
  });
});
