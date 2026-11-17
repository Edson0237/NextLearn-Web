import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { EMPTY } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Home } from '../home';
import { ProfilHome } from '../../profil/profil-home/profil-home';
import { ChangerEmail } from '../../profil/changer-email/changer-email';
import { OfflineLibrary } from '../../bibliotheque/offline-library/offline-library';
import { OfflineScreen } from '../../../shared/ui/offline-screen/offline-screen';
import { SignalementSheet } from '../../../shared/ui/signalement/signalement-sheet';
import { BOTTOM_SHEET_DATA, BottomSheetRef } from '../../../shared/ui/bottom-sheet/bottom-sheet';
import { AuthService, GoogleIdentite } from '../../../core/auth';
import {
  DocumentType,
  DocumentsRepository,
  FavorisRepository,
  LectureProgressRepository,
  OfflineRepository,
  StockageHorsLigne,
} from '../../../core/bibliotheque';
import { ContexteRepository, CONTEXTE_OUVERT } from '../../../core/contexte';
import { ChangementEmailRepository, ProfilRepository } from '../../../core/profil';
import { FormatsService } from '../../../core/references';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { ToastService } from '../../../shared/ui/toast/toast';
import { TelechargementEtat } from '../../../shared/services/telechargement-etat';
import { NotificationsEtat } from '../../../core/notifications';
import { Cycle, NiveauEtude } from '../../../core/models';

const USER = {
  id: 'u-ui-1',
  email: 'etu@enspy.cm',
  nom: 'Kouam',
  prenom: 'Junior',
  universite: 'ENSPY',
  filiere: 'Informatique',
  niveau: NiveauEtude.n3,
  cycle: Cycle.ingenieur,
  isVerified: true,
  hasPin: true,
};

const DOC = {
  id: 'doc-ui-1',
  titre: 'Analyse Numérique',
  description: 'Support de cours',
  type: DocumentType.cours,
  matiere: 'Mathématiques',
  niveau: 'N3',
  universite: 'ENSPY',
  filiere: 'Informatique',
  fileName: 'analyse.pdf',
  fileSize: 4096,
  mimeType: 'application/pdf',
  pages: 14,
  downloads: 5,
  views: 20,
  rating: 4.2,
  ratingsCount: 3,
  isOfflineAvailable: true,
  createdAt: new Date(),
  uploaderName: 'Prof. Ndi',
};

describe('Home, ProfilHome, ChangerEmail, OfflineLibrary, OfflineScreen & SignalementSheet — QA UI Suite', () => {
  let routerStub: {
    navigate: ReturnType<typeof vi.fn>;
    navigateByUrl: ReturnType<typeof vi.fn>;
    events: typeof EMPTY;
  };
  let authStub: any;

  beforeEach(() => {
    routerStub = {
      navigate: vi.fn(async () => true),
      navigateByUrl: vi.fn(async () => true),
      events: EMPTY,
    };
    authStub = {
      state: signal({
        user: USER,
        isAuthenticated: true,
        isLoading: false,
        isInitializing: false,
        isFirstLaunch: false,
        needsOtpVerification: false,
        error: null,
      }),
      niveauxDuCycle: vi.fn(async () => ({
        niveaux: [
          { code: 'N3', label: '3e année' },
          { code: 'N4', label: '4e année' },
        ],
      })),
      changerNiveau: vi.fn(async () => null),
      changerAvatar: vi.fn(async () => null),
      supprimerAvatar: vi.fn(async () => null),
      majEmail: vi.fn(),
      logout: vi.fn(async () => undefined),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('Home charge les rangées, compose les reprises et bascule sur IndexedDB en erreur réseau', async () => {
    const docsStub = {
      getRecommended: vi.fn(async () => [DOC]),
      getPopular: vi.fn(async () => [DOC]),
      getRecent: vi.fn(async () => [DOC]),
    };
    const progMap = new Map([
      [
        'doc-ui-1',
        {
          documentId: 'doc-ui-1',
          pageCourante: 4,
          totalPages: 14,
          derniereLecture: new Date().toISOString(),
        },
      ],
    ]);
    const stockageStub = {
      disponible: true,
      ids: signal(new Set(['doc-ui-1'])),
      fiches: signal([DOC]),
      rafraichir: vi.fn(async () => undefined),
    };
    const selectionsStub = { ouvrir: vi.fn(async () => DocumentType.cours) };

    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authStub },
        { provide: DocumentsRepository, useValue: docsStub },
        { provide: ProfilRepository, useValue: { getStats: vi.fn(async () => ({ docsTelecharges: 1, docsLus: 2, heuresEtude: 3, streak: 4 })) } },
        { provide: ContexteRepository, useValue: { charger: vi.fn(async () => CONTEXTE_OUVERT) } },
        { provide: LectureProgressRepository, useValue: { getAll: vi.fn(async () => progMap) } },
        { provide: StockageHorsLigne, useValue: stockageStub },
        { provide: FormatsService, useValue: { actif: () => true, formats: signal([]) } },
        { provide: TelechargementEtat, useValue: { initialiser: vi.fn(async () => undefined), telecharger: vi.fn(async () => undefined), pourDocument: signal(undefined) } },
        { provide: FeuilleSelectionService, useValue: selectionsStub },
        { provide: NotificationsEtat, useValue: { nonLues: signal(0), version: signal(0), rafraichir: vi.fn(async () => undefined) } },
      ],
    });

    const fixture: ComponentFixture<Home> = TestBed.createComponent(Home);
    const cmp = fixture.componentInstance as any;
    await cmp.ngOnInit();
    fixture.detectChanges();

    expect(cmp.recommended()).toHaveLength(1);
    expect(cmp.reprises()).toHaveLength(1);
    expect(cmp.streak()).toBe(4);

    await cmp.ouvrirAutresFormats();
    expect(routerStub.navigate).toHaveBeenCalled();

    // Repli local sur IndexedDB si le réseau échoue
    docsStub.getRecommended.mockRejectedValueOnce(new Error('offline'));
    await cmp.load();
    expect(cmp.error()).toBeNull();
    expect(cmp.recommended()).toHaveLength(1);

    cmp.openDocument(DOC);
    cmp.reprendre(cmp.reprises()[0]);
    cmp.openProfil();
    cmp.openSearch();
    cmp.openFavoris();
    cmp.openOffline();
    cmp.openDepot();
    cmp.openNotifications();
  });

  it('ProfilHome affiche les stats, gère photo de profil et changement de niveau', async () => {
    const actionsStub = { choisir: vi.fn() };
    const stockageStub = {
      disponible: true,
      ids: signal(new Set(['doc-ui-1'])),
      rafraichir: vi.fn(async () => undefined),
    };
    const profilRepoStub = {
      getStats: vi.fn(async () => ({ docsTelecharges: 1, docsLus: 5, heuresEtude: 2, streak: 3 })),
    };

    TestBed.configureTestingModule({
      imports: [ProfilHome],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authStub },
        { provide: ProfilRepository, useValue: profilRepoStub },
        { provide: StockageHorsLigne, useValue: stockageStub },
        { provide: FeuilleActionService, useValue: actionsStub },
        { provide: NotificationsEtat, useValue: { nonLues: signal(0), version: signal(0), rafraichir: vi.fn(async () => undefined) } },
      ],
    });

    const fixture = TestBed.createComponent(ProfilHome);
    fixture.detectChanges();
    await Promise.resolve();
    const cmp = fixture.componentInstance as any;

    expect(cmp.horsLigne()).toBe(1);
    expect(cmp.nomComplet()).toBe('Junior Kouam');

    actionsStub.choisir.mockResolvedValueOnce('N4');
    await cmp.ouvrirChoixNiveau();
    expect(authStub.changerNiveau).toHaveBeenCalledWith('N4');

    const imgFile = new File(['png'], 'avatar.png', { type: 'image/png' });
    cmp.onFileSelected({ target: { files: [imgFile], value: 'x' } });
    expect(cmp.fichierACadrer()).toBe(imgFile);
    await cmp.onCropped(imgFile);
    expect(authStub.changerAvatar).toHaveBeenCalledWith(imgFile);

    cmp.onCropCancelled();
    cmp.openNotifications();
    cmp.openFavoris();
  });

  it('ChangerEmail déroule accueil -> démarrage -> preuve -> confirmation -> succès', async () => {
    const emailRepoStub = {
      statut: vi
        .fn()
        .mockResolvedValueOnce({
          email: 'etu@enspy.cm',
          verifie: true,
          methodes: { ancienneAdresse: true, google: false, ancienneInaccessible: true },
          demande: null,
        })
        .mockResolvedValue({
          email: 'nouveau@enspy.cm',
          verifie: true,
          methodes: { ancienneAdresse: true, google: false, ancienneInaccessible: true },
          demande: null,
        }),
      demarrer: vi.fn(async () => ({
        id: 'dem-1',
        etat: 'preuve',
        methode: 'ancienne_adresse',
        nouvelEmail: 'nou***@enspy.cm',
        prochaineEtape: 'preuve',
      })),
      verifierPreuve: vi.fn(async () => ({
        id: 'dem-1',
        etat: 'nouvelle',
        methode: 'ancienne_adresse',
        nouvelEmail: 'nou***@enspy.cm',
        prochaineEtape: 'nouvelle',
      })),
      confirmer: vi.fn(async () => ({
        id: 'dem-1',
        etat: 'termine',
        methode: 'ancienne_adresse',
        nouvelEmail: 'nouveau@enspy.cm',
        prochaineEtape: 'termine',
        termine: true,
      })),
      renvoyer: vi.fn(async () => ({
        id: 'dem-1',
        etat: 'preuve',
        methode: 'ancienne_adresse',
        nouvelEmail: 'nou***@enspy.cm',
        prochaineEtape: 'preuve',
      })),
      annuler: vi.fn(async () => undefined),
    };

    TestBed.configureTestingModule({
      imports: [ChangerEmail],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authStub },
        { provide: ChangementEmailRepository, useValue: emailRepoStub },
        { provide: GoogleIdentite, useValue: { preparer: vi.fn(async () => false), afficherBouton: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(ChangerEmail);
    fixture.detectChanges();
    await vi.waitFor(() => expect((fixture.componentInstance as any).ecran()).toBe('accueil'));
    const cmp = fixture.componentInstance as any;

    cmp.commencer();
    fixture.detectChanges();
    expect(cmp.ecran()).toBe('formulaire');

    cmp.surEmail({ target: { value: 'nouveau@enspy.cm' } });
    await cmp.demarrer();
    fixture.detectChanges();
    expect(cmp.ecran()).toBe('preuve');

    await cmp.renvoyer();
    cmp.surCode({ target: { value: '123456' } });
    await cmp.verifierPreuve();
    fixture.detectChanges();
    expect(cmp.ecran()).toBe('nouvelle');

    cmp.surCode({ target: { value: '654321' } });
    await cmp.confirmer();
    fixture.detectChanges();
    expect(cmp.ecran()).toBe('succes');
    expect(cmp.adresseFinale()).toBe('nouveau@enspy.cm');
    expect(authStub.majEmail).toHaveBeenCalledWith('nouveau@enspy.cm');

    await cmp.annuler();
    cmp.retour();
  });

  it('OfflineLibrary (en ligne), SignalementSheet et OfflineScreen exécutent leurs templates et actions', async () => {
    const actionsStub = { confirmer: vi.fn(async () => true) };
    const stockageStub = {
      disponible: true,
      ids: signal(new Set(['doc-ui-1'])),
      fiches: signal([DOC]),
      infoDocument: vi.fn(() => ({
        id: 'doc-ui-1',
        tailleOctets: 4096,
        dateTelechargement: Date.now(),
        format: 'pdf',
      })),
      rafraichir: vi.fn(async () => undefined),
      supprimer: vi.fn(async () => undefined),
      vider: vi.fn(async () => undefined),
      estimation: vi.fn(async () => ({ utilise: 4096, quota: 1_000_000, utiliseApp: 4096 })),
    };
    const offRepoStub = {
      getOfflineIds: vi.fn(async () => new Set(['doc-ui-1'])),
      removeOffline: vi.fn(async () => undefined),
    };

    TestBed.configureTestingModule({
      imports: [OfflineLibrary],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: StockageHorsLigne, useValue: stockageStub },
        { provide: OfflineRepository, useValue: offRepoStub },
        { provide: DocumentsRepository, useValue: { getById: vi.fn(async () => DOC) } },
        { provide: FavorisRepository, useValue: { getFavorites: vi.fn(async () => [DOC]) } },
        { provide: LectureProgressRepository, useValue: { getAll: vi.fn(async () => new Map()) } },
        { provide: FeuilleActionService, useValue: actionsStub },
      ],
    });

    const offFixture = TestBed.createComponent(OfflineLibrary);
    await (offFixture.componentInstance as any).ngOnInit();
    offFixture.detectChanges();
    const offCmp = offFixture.componentInstance as any;

    expect(offCmp.offlineDocuments()).toHaveLength(1);
    offCmp.choisir('favoris');
    offFixture.detectChanges();
    expect(offCmp.compte('favoris')).toBe(1);
    offCmp.choisir('historique');
    offFixture.detectChanges();
    offCmp.choisir('telecharges');
    offFixture.detectChanges();
    offCmp.openDocument(DOC);
    expect(routerStub.navigateByUrl).toHaveBeenCalled();

    await offCmp.remove(DOC);
    expect(stockageStub.supprimer).toHaveBeenCalledWith('doc-ui-1');
    await offCmp.libererEspace();
    expect(stockageStub.vider).toHaveBeenCalled();
    offCmp.goBack();

    // SignalementSheet
    TestBed.resetTestingModule();
    const closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [SignalementSheet],
      providers: [
        { provide: BottomSheetRef, useValue: { close: closeSpy } },
        {
          provide: BOTTOM_SHEET_DATA,
          useValue: {
            titre: 'Signaler',
            motifs: [
              { code: 'DOUBLON', label: 'Doublon' },
              { code: 'AUTRE', label: 'Autre' },
            ],
            information: 'Traitement 72h',
            motifsMasquants: ['DOUBLON'],
          },
        },
      ],
    });
    const sigFixture = TestBed.createComponent(SignalementSheet);
    sigFixture.detectChanges();
    const sigCmp = sigFixture.componentInstance as any;

    sigCmp.envoyer();
    expect(sigCmp.erreur()).toBe('signalementChoisirMotif');
    sigCmp.choisir('AUTRE');
    sigCmp.explication.set('abc');
    sigCmp.envoyer();
    expect(sigCmp.erreur()).toBe('signalementExpliquerObligatoire');
    sigCmp.explication.set('Contenu erroné sur le chapitre 2');
    sigCmp.envoyer();
    expect(closeSpy).toHaveBeenCalledWith({
      motif: 'AUTRE',
      commentaire: 'Contenu erroné sur le chapitre 2',
    });

    // OfflineScreen
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [OfflineScreen] });
    const scrFixture = TestBed.createComponent(OfflineScreen);
    scrFixture.componentRef.setInput('canContinueAnyway', true);
    scrFixture.detectChanges();
    expect(scrFixture.nativeElement.querySelectorAll('button').length).toBe(2);
  });
});
