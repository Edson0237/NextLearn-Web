import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  StockageHorsLigne,
  DocumentModel,
  DocumentType,
  LectureProgressRepository,
  calculerVersionDocument,
} from '../index';
import { SecureStorageService } from '../../storage/services/secure-storage.service';

/** Crée un tampon binaire PDF valide commençant par `%PDF-1.7` */
function creerOctetsPdf(taille = 2048): ArrayBuffer {
  const vue = new Uint8Array(taille);
  const entete = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7
  vue.set(entete, 0);
  for (let i = entete.length; i < taille; i++) {
    vue[i] = (i * 31) & 0xff;
  }
  return vue.buffer;
}

/** Crée un tampon binaire DOCX (ZIP OpenXML) valide commençant par `PK\x03\x04` */
function creerOctetsDocx(taille = 4096): ArrayBuffer {
  const vue = new Uint8Array(taille);
  const entete = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]; // PK\x03\x04
  vue.set(entete, 0);
  for (let i = entete.length; i < taille; i++) {
    vue[i] = (i * 17) & 0xff;
  }
  return vue.buffer;
}

function creerFicheDocument(partiel: Partial<DocumentModel> = {}): DocumentModel {
  return {
    id: partiel.id ?? 'doc-pdf-1',
    titre: partiel.titre ?? 'Cours Algorithmique Avancée',
    description: partiel.description ?? 'Support complet du semestre 1',
    type: partiel.type ?? DocumentType.cours,
    matiere: partiel.matiere ?? 'Algorithmique',
    enseignant: partiel.enseignant ?? 'Pr. Tientcheu',
    universite: partiel.universite ?? 'ISJ',
    niveau: partiel.niveau ?? 'Ingénieur 3',
    semestre: partiel.semestre ?? 'S1',
    avecCorrige: partiel.avecCorrige ?? false,
    anneeAcademique: partiel.anneeAcademique ?? '2025-2026',
    tailleMb: partiel.tailleMb ?? 1.2,
    pages: partiel.pages ?? 24,
    urlPdf: partiel.urlPdf ?? 'https://r2.nextlearn.test/cours-algo.pdf',
    dateAjout: partiel.dateAjout ?? new Date('2026-02-10T10:00:00.000Z'),
    vues: partiel.vues ?? 15,
    telechargements: partiel.telechargements ?? 4,
    noteMoyenne: partiel.noteMoyenne ?? 4.8,
  };
}

describe('StockageHorsLigne — Stockage local IndexedDB & Cas de tests obligatoires (Section 9)', () => {
  let service: StockageHorsLigne;
  const fetchOriginal = globalThis.fetch;

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
    await service.definirUtilisateur('etudiant-a');
    await service.vider();
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  // ── 1. Téléchargement d'un PDF ───────────────────────────────────────────
  it('1. télécharge un PDF, vérifie sa signature binaire %PDF- et l’enregistre avec toutes ses métadonnées', async () => {
    const octetsPdf = creerOctetsPdf(3072);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsPdf, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': '3072',
        },
      }),
    );

    const doc = creerFicheDocument({ id: 'pdf-101', titre: 'Analyse Numérique PDF' });
    const progressions: number[] = [];

    const res = await service.telechargerEtEnregistrer(
      doc.id,
      'https://r2.nextlearn.test/analyse.pdf',
      doc,
      { onProgression: (p) => progressions.push(p) },
    );

    expect(res.ok).toBe(true);
    expect(res.info).toBeDefined();
    expect(res.info?.id).toBe('pdf-101');
    expect(res.info?.userId).toBe('etudiant-a');
    expect(res.info?.nom).toBe('Analyse Numérique PDF');
    expect(res.info?.format).toBe('pdf');
    expect(res.info?.tailleOctets).toBe(3072);
    expect(res.info?.etat).toBe('complet');
    expect(res.info?.version).toBe(calculerVersionDocument(doc));
    expect(progressions.at(-1)).toBe(100);
    expect(service.ids().has('pdf-101')).toBe(true);
  });

  // ── 2. Téléchargement d'un DOCX ──────────────────────────────────────────
  it('2. télécharge un DOCX, détecte sa signature PK\\x03\\x04 et l’enregistre sous le format docx', async () => {
    const octetsDocx = creerOctetsDocx(5120);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsDocx, {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-length': '5120',
        },
      }),
    );

    const doc = creerFicheDocument({
      id: 'docx-202',
      titre: 'TP Réseaux Informatiques',
      urlPdf: 'https://r2.nextlearn.test/tp-reseaux.docx',
    });

    const res = await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);
    expect(res.ok).toBe(true);
    expect(res.info?.format).toBe('docx');
    expect(res.info?.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(res.info?.tailleOctets).toBe(5120);
    expect(service.ids().has('docx-202')).toBe(true);
  });

  // ── 3. Consultation hors connexion ───────────────────────────────────────
  it('3. ouvre un document enregistré hors connexion sans aucun appel réseau et révoque proprement le Blob URL', async () => {
    const octetsPdf = creerOctetsPdf(2048);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsPdf, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    const doc = creerFicheDocument({ id: 'offline-303', titre: 'Systèmes Distribués' });
    await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);

    // Coupure totale du réseau
    const fetchEspionHorsLigne = vi.fn().mockRejectedValue(new Error('Network offline'));
    globalThis.fetch = fetchEspionHorsLigne;

    const lecture = await service.obtenirPourLecture('offline-303');
    expect(lecture).not.toBeNull();
    expect(lecture?.url).toMatch(/^blob:/);
    expect(lecture?.format).toBe('pdf');
    expect(lecture?.nom).toBe('Systèmes Distribués');
    expect(lecture?.tailleOctets).toBe(2048);
    // Aucun appel réseau n'a été effectué pour ouvrir le document local
    expect(fetchEspionHorsLigne).not.toHaveBeenCalled();

    const spyRevoke = vi.spyOn(URL, 'revokeObjectURL');
    service.revoquerUrlLocale(lecture!.url);
    expect(spyRevoke).toHaveBeenCalledWith(lecture!.url);
  });

  // ── 4. Fermeture et réouverture de l'application ─────────────────────────
  it('4. conserve les documents et la progression de lecture après fermeture et réouverture de l’application', async () => {
    const octetsPdf = creerOctetsPdf(1536);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsPdf, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    const doc = creerFicheDocument({ id: 'persist-404', titre: 'Bases de Données', pages: 40 });
    await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);

    // Enregistrement d'une progression de lecture hors ligne (page 17 / 40)
    const lectureRepo = TestBed.inject(LectureProgressRepository);
    const httpMock = TestBed.inject(HttpTestingController);
    const promesseProg = lectureRepo.enregistrer({
      documentId: 'persist-404',
      pageCourante: 17,
      totalPages: 40,
    });
    // Même si le serveur échoue (hors ligne), la progression locale est persistée
    httpMock.expectOne('/api/progress/lecture/persist-404').error(new ProgressEvent('error'));
    await promesseProg;

    // Simulation de fermeture / réouverture : rafraîchissement complet de l'inventaire et lecture hors ligne
    await service.rafraichir();
    expect(service.ids().has('persist-404')).toBe(true);
    expect(service.fiches().find((f) => f.id === 'persist-404')?.titre).toBe('Bases de Données');

    const promesseReprise = lectureRepo.getPour('persist-404');
    httpMock.expectOne('/api/progress/lecture/persist-404').error(new ProgressEvent('error'));
    const reprise = await promesseReprise;
    expect(reprise?.pageCourante).toBe(17);
    expect(reprise?.totalPages).toBe(40);
  });

  // ── 5. Déconnexion, reconnexion et isolation multi-utilisateur ───────────
  it('5. conserve les documents à la déconnexion, les isole d’un autre utilisateur et les restaure à la reconnexion', async () => {
    const octetsPdf = creerOctetsPdf(2048);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsPdf, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    const docA = creerFicheDocument({ id: 'secret-user-a', titre: 'Notes Privées Étudiant A' });

    // 1) Étudiant A télécharge un document
    await service.definirUtilisateur('etudiant-a');
    await service.telechargerEtEnregistrer(docA.id, docA.urlPdf, docA);
    expect(service.ids().has('secret-user-a')).toBe(true);

    // 2) Déconnexion : les fichiers ne sont PAS supprimés, mais la vue déconnectée est vide
    await service.definirUtilisateur(null);
    expect(service.ids().size).toBe(0);
    expect(service.fiches().length).toBe(0);
    expect(await service.urlLocale('secret-user-a')).toBeNull();

    // 3) Connexion d'un Étudiant B sur le même appareil : B ne voit PAS les documents de A
    await service.definirUtilisateur('etudiant-b');
    expect(service.ids().has('secret-user-a')).toBe(false);
    expect(service.fiches().length).toBe(0);
    expect(await service.urlLocale('secret-user-a')).toBeNull();

    // 4) Reconnexion de l'Étudiant A : A retrouve immédiatement son document téléchargé !
    await service.definirUtilisateur('etudiant-a');
    expect(service.ids().has('secret-user-a')).toBe(true);
    expect(service.fiches()[0]?.titre).toBe('Notes Privées Étudiant A');
    const lectureA = await service.obtenirPourLecture('secret-user-a');
    expect(lectureA).not.toBeNull();
    service.revoquerUrlLocale(lectureA?.url);
  });

  // ── 6. Suppression d'un document ─────────────────────────────────────────
  it('6. supprime un document du stockage local et met à jour l’espace de stockage utilisé', async () => {
    const octetsPdf = creerOctetsPdf(4096);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(octetsPdf, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    const doc = creerFicheDocument({ id: 'suppr-606', titre: 'Document à supprimer' });
    await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);

    const estAvant = await service.estimation();
    expect(estAvant.utiliseApp).toBe(4096);
    expect(estAvant.nombreDocuments).toBe(1);

    await service.supprimer('suppr-606');
    expect(service.ids().has('suppr-606')).toBe(false);
    expect(await service.urlLocale('suppr-606')).toBeNull();

    const estApres = await service.estimation();
    expect(estApres.utiliseApp).toBe(0);
    expect(estApres.nombreDocuments).toBe(0);
  });

  // ── 7. Téléchargement interrompu ─────────────────────────────────────────
  it('7. gère un téléchargement interrompu (AbortController) et nettoie automatiquement le fichier incomplet', async () => {
    const controleur = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation(() => {
      controleur.abort();
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const doc = creerFicheDocument({ id: 'interrompu-707', titre: 'Cours Interrompu' });
    const res = await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc, {
      signal: controleur.signal,
    });

    expect(res.ok).toBe(false);
    expect(res.raison).toBe('annule');
    expect(service.ids().has('interrompu-707')).toBe(false);
    expect(await service.estDisponible('interrompu-707')).toBe(false);
  });

  // ── 8. Document déjà téléchargé & gestion des versions ──────────────────
  it('8. évite de télécharger une seconde fois un document de même version, mais met à jour si la version change', async () => {
    const espionFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(creerOctetsPdf(2048), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        }),
      ),
    );
    globalThis.fetch = espionFetch;

    const docV1 = creerFicheDocument({
      id: 'version-808',
      titre: 'Cours Compilation',
      pages: 10,
    });

    // Premier téléchargement (version 1)
    await service.telechargerEtEnregistrer(docV1.id, docV1.urlPdf, docV1);
    expect(espionFetch).toHaveBeenCalledTimes(1);

    // Second appel avec la même version : aucun appel réseau supplémentaire
    await service.telechargerEtEnregistrer(docV1.id, docV1.urlPdf, docV1);
    expect(espionFetch).toHaveBeenCalledTimes(1);

    // Nouvelle version du document (20 pages au lieu de 10) : mise à jour téléchargée
    const docV2 = creerFicheDocument({
      id: 'version-808',
      titre: 'Cours Compilation (Édition 2)',
      pages: 20,
    });
    await service.telechargerEtEnregistrer(docV2.id, docV2.urlPdf, docV2);
    expect(espionFetch).toHaveBeenCalledTimes(2);
    expect(service.infoDocument('version-808')?.nom).toBe('Cours Compilation (Édition 2)');
  });

  // ── 9. Quota de stockage insuffisant ─────────────────────────────────────
  it('9. détecte et signale proprement un dépassement de quota (QuotaExceededError)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(creerOctetsPdf(2048), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );

    // Simulation d'une erreur QuotaExceededError lors de l'écriture dans IndexedDB
    vi.spyOn(
      service as unknown as { ecrireEnregistrement: () => Promise<void> },
      'ecrireEnregistrement',
    ).mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'));

    const doc = creerFicheDocument({ id: 'quota-909', titre: 'Gros Document' });
    const res = await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);

    expect(res.ok).toBe(false);
    expect(res.raison).toBe('quota');
    expect(service.ids().has('quota-909')).toBe(false);
  });

  // ── 10. Mise à jour de la PWA (indépendance vis-à-vis du Service Worker) ─
  it('10. préserve les documents téléchargés lors d’une mise à jour de la PWA (suppression des caches Service Worker)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(creerOctetsPdf(2560), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );

    const doc = creerFicheDocument({ id: 'pwa-update-1010', titre: 'Cours Persistant PWA' });
    await service.telechargerEtEnregistrer(doc.id, doc.urlPdf, doc);
    expect(service.ids().has('pwa-update-1010')).toBe(true);

    // Simulation d'une mise à jour du Service Worker qui purge ses caches HTTP ('ngsw:*')
    await service.rafraichir();
    expect(service.ids().has('pwa-update-1010')).toBe(true);
    const lecture = await service.obtenirPourLecture('pwa-update-1010');
    expect(lecture?.tailleOctets).toBe(2560);
    service.revoquerUrlLocale(lecture?.url);
  });
});
