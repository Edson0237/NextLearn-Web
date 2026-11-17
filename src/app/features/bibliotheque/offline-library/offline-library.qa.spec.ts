import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineLibrary } from './offline-library';
import {
  DocumentModel,
  DocumentsRepository,
  DocumentType,
  FavorisRepository,
  LectureProgressRepository,
  OfflineRepository,
  StockageHorsLigne,
} from '../../../core/bibliotheque';
import { TraductionService } from '../../../core/i18n';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';

const docLocal: DocumentModel = {
  id: 'doc-off-1',
  titre: 'Analyse Numérique Offline',
  description: 'Cours local',
  type: DocumentType.cours,
  matiere: 'Mathématiques',
  enseignant: 'Pr QA',
  universite: 'UQA',
  niveau: 'N3',
  avecCorrige: false,
  anneeAcademique: '2025-2026',
  tailleMb: 1.2,
  pages: 12,
  urlPdf: '',
  dateAjout: new Date('2026-10-01T10:00:00Z'),
  vues: 5,
  telechargements: 2,
  noteMoyenne: 4.5,
};

describe('QA OfflineLibrary — Affichage immédiat hors ligne, onglets & suppression (NL-BUG-2026-005)', () => {
  const origDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');

  function setOnline(v: boolean) {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => v });
  }

  afterEach(() => {
    if (origDesc) Object.defineProperty(Navigator.prototype, 'onLine', origDesc);
  });

  function setup() {
    const offlineRepoMock = {
      getOfflineIds: vi.fn().mockResolvedValue(new Set(['doc-off-1'])),
      removeOffline: vi.fn().mockResolvedValue(undefined),
    };
    const favorisMock = {
      getFavorites: vi.fn().mockResolvedValue([docLocal]),
    };
    const stockageMock = {
      rafraichir: vi.fn().mockResolvedValue(undefined),
      ids: signal(new Set(['doc-off-1'])),
      fiches: signal([docLocal]),
      estimation: vi.fn().mockResolvedValue({ utilise: 3000, quota: 1000000, utiliseApp: 3000 }),
      infoDocument: vi.fn().mockReturnValue({ format: 'pdf', tailleOctets: 3000, dateTelechargement: '2026-11-16T10:00:00Z' }),
      supprimer: vi.fn().mockResolvedValue(undefined),
    };
    const lecturesMock = {
      getAll: vi.fn().mockResolvedValue(
        new Map([['doc-off-1', { documentId: 'doc-off-1', pageCourante: 3, totalPages: 12, derniereLecture: '2026-11-16T10:00:00Z', tempsTotalSecondes: 90 }]]),
      ),
    };

    TestBed.configureTestingModule({
      imports: [OfflineLibrary],
      providers: [
        provideRouter([]),
        { provide: OfflineRepository, useValue: offlineRepoMock },
        { provide: FavorisRepository, useValue: favorisMock },
        { provide: DocumentsRepository, useValue: {} },
        { provide: StockageHorsLigne, useValue: stockageMock },
        { provide: LectureProgressRepository, useValue: lecturesMock },
        { provide: ToastService, useValue: { succes: vi.fn(), erreur: vi.fn(), info: vi.fn() } },
        { provide: FeuilleActionService, useValue: { confirmer: vi.fn().mockResolvedValue(true) } },
        { provide: TraductionService, useValue: { langue: signal('fr').asReadonly(), aDesMessages: signal(true).asReadonly(), t: (_k: string, _p?: unknown, def?: string) => def ?? _k } },
      ],
    });

    const fixture = TestBed.createComponent(OfflineLibrary);
    const router = TestBed.inject(Router);
    const navUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return {
      fixture,
      component: fixture.componentInstance as any,
      offlineRepoMock,
      favorisMock,
      stockageMock,
      navUrlSpy,
    };
  }

  it('hors ligne : affiche immédiatement IndexedDB sans appeler getOfflineIds() ni getFavorites()', async () => {
    setOnline(false);
    const { component, offlineRepoMock, favorisMock, navUrlSpy } = setup();

    await component.load();

    expect(component.loading()).toBe(false);
    expect(component.liste()).toHaveLength(1);
    expect(component.liste()[0].titre).toBe('Analyse Numérique Offline');
    expect(offlineRepoMock.getOfflineIds).not.toHaveBeenCalled();
    expect(favorisMock.getFavorites).not.toHaveBeenCalled();

    component.openDocument(docLocal);
    expect(navUrlSpy).toHaveBeenCalledWith(expect.stringContaining('/read?title='));
  });

  it('en ligne : gère les onglets, le filtre de recherche et le retrait du stockage local', async () => {
    setOnline(true);
    const { component, stockageMock } = setup();

    await component.ngOnInit();
    expect(component.liste()).toHaveLength(1);

    component.choisir('favoris');
    expect(component.liste()).toHaveLength(1);
    component.choisir('historique');
    expect(component.liste()).toHaveLength(1);
    component.choisir('telecharges');

    component.recherche.set('inexistant');
    expect(component.liste()).toHaveLength(0);
    component.recherche.set('');

    await component.remove(docLocal);
    expect(stockageMock.supprimer).toHaveBeenCalledWith('doc-off-1');
  });
});
