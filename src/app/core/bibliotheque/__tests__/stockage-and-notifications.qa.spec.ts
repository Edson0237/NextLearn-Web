import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { StockageHorsLigne } from '..';
import { documentDepuisApi } from '../models/document.model';
import { SecureStorageService } from '../../storage';
import { NotificationsPage } from '../../../features/notifications/notifications-page/notifications-page';
import { NotificationsEtat, NotificationsRepository, NotificationModel } from '../../notifications';

const DOC = documentDepuisApi({
  _id: 'doc-st-1',
  titre: 'Probabilités',
  description: 'Cours L3',
  type: 'COURS',
  matiere: 'Mathématiques',
  niveau: 'N3',
  universite: 'ENSPY',
  filiere: 'Informatique',
  fileSize: 16,
  pages: 10,
});

describe('StockageHorsLigne & NotificationsPage — QA Coverage Suite', () => {
  const indexedDbDesc = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const fetchOrig = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    // Force memoireFallback deterministe sous jsdom sans IndexedDB reel
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  });

  afterEach(() => {
    globalThis.fetch = fetchOrig;
    if (indexedDbDesc) Object.defineProperty(globalThis, 'indexedDB', indexedDbDesc);
    else delete (globalThis as { indexedDB?: unknown }).indexedDB;
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('StockageHorsLigne valide signatures PDF/DOCX, télécharge, isole par compte et lit localement', async () => {
    const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-local-1');
    const revokeUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    TestBed.configureTestingModule({});
    const storage = TestBed.inject(SecureStorageService);
    const stockage = TestBed.inject(StockageHorsLigne);

    // 1. Intégrité binaire
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]).buffer;
    const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]).buffer;
    const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html></html>').buffer;

    expect(stockage.verifierIntegriteBinaire(pdfBytes, { tailleAttendue: 8 })).toEqual({
      valide: true,
      format: 'pdf',
    });
    expect(stockage.verifierIntegriteBinaire(docxBytes)).toEqual({
      valide: true,
      format: 'docx',
    });
    expect(stockage.verifierIntegriteBinaire(htmlBytes).valide).toBe(false);
    expect(stockage.verifierIntegriteBinaire(pdfBytes, { tailleAttendue: 99 }).valide).toBe(false);

    // 2. Utilisateur u1 -> téléchargement avec ReadableStream
    await stockage.definirUtilisateur('u1');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(pdfBytes));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn(
      async () =>
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'application/pdf', 'content-length': '8' },
        }),
    ) as unknown as typeof fetch;

    const progress: number[] = [];
    const resOk = await stockage.telechargerEtEnregistrer('doc-st-1', 'https://cdn.local/p.pdf', DOC, {
      version: 'v1',
      onProgression: (p) => progress.push(p),
    });
    expect(resOk.ok).toBe(true);
    expect(progress).toContain(100);
    expect(await stockage.estDisponible('doc-st-1', 'v1')).toBe(true);
    expect(await stockage.estDisponible('doc-st-1', 'v2')).toBe(false);
    expect(stockage.infoDocument('doc-st-1')?.tailleOctets).toBe(8);

    // Doublon même version -> instantané sans fetch supplémentaire
    expect(await stockage.enregistrer('doc-st-1', 'https://cdn.local/p.pdf', DOC, { version: 'v1' })).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await stockage.enregistrerFiche('doc-st-1', { ...DOC, titre: 'Proba v2' });
    expect(stockage.fiches()[0].titre).toBe('Proba v2');

    // Lecture locale + révocation URL
    const lecture = await stockage.obtenirPourLecture('doc-st-1');
    expect(lecture?.url).toBe('blob:mock-local-1');
    expect(await stockage.urlLocale('doc-st-1')).toBe('blob:mock-local-1');
    stockage.revoquerUrlLocale('blob:mock-local-1');
    expect(createUrlSpy).toHaveBeenCalled();
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-local-1');

    // Estimation & erreur intégrité HTML / réseau 500
    const est = await stockage.estimation();
    expect(est.utiliseApp).toBe(8);
    expect(await stockage.demanderPersistance()).toBe(false);

    globalThis.fetch = vi.fn(
      async () =>
        new Response('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ) as unknown as typeof fetch;
    const resHtml = await stockage.telechargerEtEnregistrer('doc-bad', 'https://cdn.local/bad.pdf');
    expect(resHtml).toEqual({ ok: false, raison: 'integrite' });

    globalThis.fetch = vi.fn(async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
    const res500 = await stockage.telechargerEtEnregistrer('doc-500', 'https://cdn.local/500.pdf');
    expect(res500).toEqual({ ok: false, raison: 'reseau' });

    // Isolation changement de compte u1 -> u2
    const purgerSpy = vi.spyOn(storage, 'purgerTracesActiviteLocale');
    await stockage.definirUtilisateur('u2');
    expect(purgerSpy).toHaveBeenCalled();
    expect(stockage.ids().size).toBe(0);

    // Retour sur u1 -> supprimer & vider
    await stockage.definirUtilisateur('u1');
    await stockage.supprimer('doc-st-1');
    expect(stockage.ids().size).toBe(0);
    await stockage.nettoyerFichiersTemporaires();
    await stockage.vider();
    await stockage.purgerToutLeStockageLocal();
  });

  it('NotificationsPage charge, ouvre route interne/externe, marque lu et supprime', async () => {
    const routerStub = {
      navigate: vi.fn(async () => true),
      navigateByUrl: vi.fn(async () => true),
    };
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const notifs: NotificationModel[] = [
      {
        id: 'n1',
        titre: 'Doc publié',
        corps: 'Algèbre disponible',
        type: 'NOUVEAU_COURS',
        lu: false,
        createdAt: today,
        metadata: { documentId: 'doc-1' },
      },
      {
        id: 'n2',
        titre: 'Info externe',
        corps: 'Voir portail',
        type: 'SUPPORT',
        lu: true,
        createdAt: yesterday,
        metadata: { url: 'https://nextlearn.cm/info' },
      },
    ];
    const repoStub = {
      getNotifications: vi.fn(async () => notifs),
      markAsRead: vi.fn(async () => undefined),
      markAllAsRead: vi.fn(async () => undefined),
      deleteNotification: vi.fn(async () => undefined),
    };
    const etatStub = {
      version: signal(0),
      nonLues: signal(1),
      rafraichir: vi.fn(async () => undefined),
      toutLu: vi.fn(),
      retirer: vi.fn(),
    };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: NotificationsRepository, useValue: repoStub },
        { provide: NotificationsEtat, useValue: etatStub },
      ],
    });

    const fixture = TestBed.createComponent(NotificationsPage);
    const cmp = fixture.componentInstance as any;
    await cmp.ngOnInit();
    fixture.detectChanges();

    expect(cmp.notifications()).toHaveLength(2);
    expect(cmp.quand(today)).toBeTruthy();
    expect(cmp.quand(yesterday)).toBeTruthy();
    expect(cmp.iconeDe(notifs[0])).toBe('description');
    expect(cmp.libelleCategorie(notifs[0])).toBeTruthy();

    await cmp.open(notifs[0]);
    expect(repoStub.markAsRead).toHaveBeenCalledWith('n1');
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    await cmp.open(notifs[1]);
    expect(openSpy).toHaveBeenCalledWith('https://nextlearn.cm/info', '_blank', 'noopener');

    await cmp.supprimerNotification(notifs[0], { stopPropagation: vi.fn() } as unknown as Event);
    await cmp.markAllAsRead();
    expect(etatStub.toutLu).toHaveBeenCalled();
    cmp.goBack();
  });
});
