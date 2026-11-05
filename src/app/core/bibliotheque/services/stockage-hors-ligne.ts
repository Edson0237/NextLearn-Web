import { inject, Injectable, signal } from '@angular/core';
import { SecureStorageService } from '../../storage/services/secure-storage.service';
import { DocumentModel, DocumentType, typeDocumentDepuisApi } from '../models/document.model';
import {
  detecterFormatDocument,
  detecterFormatParEntete,
} from '../utils/detection-format';

const NOM_BASE_IDB = 'nl-stockage-local-db';
const VERSION_BASE_IDB = 1;
const STORE_DOCUMENTS = 'documents_locaux';

/** Ancien Cache Storage global non scopé par compte : purgé systématiquement pour éviter toute fuite inter-comptes. */
const NOM_CACHE_HERITE = 'nl-documents-hors-ligne';

export type EtatStockageLocal = 'complet' | 'en_cours' | 'interrompu' | 'erreur';

export type RaisonEchecStockage =
  | 'quota'
  | 'reseau'
  | 'integrite'
  | 'annule'
  | 'non_authentifie'
  | 'inconnu';

/**
 * Structure complète stockée dans IndexedDB pour chaque document téléchargé.
 * Isolée logiquement par utilisateur via la clé composite `${userId}:${id}`.
 */
export interface EnregistrementDocumentLocal {
  readonly cle: string;
  readonly id: string;
  readonly userId: string;
  readonly nom: string;
  readonly format: 'pdf' | 'docx';
  readonly mimeType: string;
  readonly tailleOctets: number;
  readonly dateTelechargement: string;
  readonly version: string;
  readonly contenu: ArrayBuffer;
  readonly etat: EtatStockageLocal;
  readonly fiche?: Record<string, unknown>;
}

/**
 * Projection légère exposée à l'interface utilisateur (sans le tampon binaire `contenu`
 * pour ne pas alourdir les signaux Angular en mémoire vive).
 */
export interface InfoDocumentLocal {
  readonly id: string;
  readonly userId: string;
  readonly nom: string;
  readonly format: 'pdf' | 'docx';
  readonly mimeType: string;
  readonly tailleOctets: number;
  readonly dateTelechargement: string;
  readonly version: string;
  readonly etat: EtatStockageLocal;
  readonly document?: DocumentModel;
}

export interface LectureLocaleDocument {
  readonly id: string;
  readonly url: string;
  readonly format: 'pdf' | 'docx';
  readonly mimeType: string;
  readonly nom: string;
  readonly tailleOctets: number;
  readonly dateTelechargement: string;
  readonly version: string;
}

export interface OptionsEnregistrementLocal {
  readonly signal?: AbortSignal;
  readonly onProgression?: (pourcentage: number) => void;
  readonly version?: string;
}

export interface ResultatEnregistrementLocal {
  readonly ok: boolean;
  readonly raison?: RaisonEchecStockage;
  readonly info?: InfoDocumentLocal;
}

/** Calcule un identifiant de version déterministe à partir des métadonnées du document. */
export function calculerVersionDocument(doc?: Partial<DocumentModel> | null): string {
  if (!doc) return 'v1';
  const date =
    doc.dateAjout instanceof Date && !Number.isNaN(doc.dateAjout.getTime())
      ? doc.dateAjout.toISOString()
      : String(doc.dateAjout ?? '');
  const taille = typeof doc.tailleMb === 'number' ? doc.tailleMb.toFixed(3) : '0';
  const pages = typeof doc.pages === 'number' ? doc.pages : 0;
  return `${date}|${taille}|${pages}`;
}

/** Formate une taille en octets de manière lisible (Ko / Mo). */
export function formaterTailleOctets(octets: number): string {
  if (!Number.isFinite(octets) || octets <= 0) return '0 Ko';
  if (octets < 1024) return `${octets} o`;
  const ko = octets / 1024;
  if (ko < 1024) return `${Math.round(ko)} Ko`;
  const mo = octets / (1024 * 1024);
  return `${mo.toFixed(1).replace('.', ',')} Mo`;
}

function mimePourFormat(format: 'pdf' | 'docx', mimeServeur?: string | null): string {
  if (format === 'docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (mimeServeur && /application\/pdf/i.test(mimeServeur)) {
    return 'application/pdf';
  }
  return 'application/pdf';
}

function estErreurQuota(err: unknown): boolean {
  if (!err) return false;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014
    );
  }
  const nom = (err as { name?: string })?.name ?? '';
  const message = (err as { message?: string })?.message ?? '';
  return (
    /QuotaExceededError|NS_ERROR_DOM_QUOTA_REACHED/i.test(nom) ||
    /quota/i.test(message)
  );
}

function estErreurAnnulation(err: unknown): boolean {
  if (!err) return false;
  const nom = (err as { name?: string })?.name ?? '';
  return nom === 'AbortError';
}

function ficheVersObjet(doc: DocumentModel, tailleOctets?: number): Record<string, unknown> {
  const tailleMbCalculee =
    tailleOctets && tailleOctets > 0
      ? Math.round((tailleOctets / (1024 * 1024)) * 100) / 100
      : doc.tailleMb;
  return {
    id: doc.id,
    titre: doc.titre,
    description: doc.description,
    type: doc.type,
    matiere: doc.matiere,
    enseignant: doc.enseignant,
    universite: doc.universite,
    niveau: doc.niveau,
    semestre: doc.semestre,
    dureeMinutes: doc.dureeMinutes,
    avecCorrige: doc.avecCorrige,
    urlCorrigePdf: doc.urlCorrigePdf,
    anneeAcademique: doc.anneeAcademique,
    tailleMb: doc.tailleMb > 0 ? doc.tailleMb : tailleMbCalculee,
    pages: doc.pages,
    urlPdf: doc.urlPdf,
    thumbnailUrl: doc.thumbnailUrl,
    dateAjout: doc.dateAjout instanceof Date ? doc.dateAjout.toISOString() : String(doc.dateAjout ?? ''),
    vues: doc.vues,
    telechargements: doc.telechargements,
    noteMoyenne: doc.noteMoyenne,
    matiereId: doc.matiereId,
    enseignantId: doc.enseignantId,
    universiteId: doc.universiteId,
  };
}

function objetVersFiche(json: Record<string, unknown>, tailleOctets?: number): DocumentModel {
  const tailleMbJson = typeof json['tailleMb'] === 'number' ? json['tailleMb'] : 0;
  const tailleMbRepli =
    tailleOctets && tailleOctets > 0
      ? Math.round((tailleOctets / (1024 * 1024)) * 100) / 100
      : 0;
  return {
    id: String(json['id'] ?? ''),
    titre: String(json['titre'] ?? ''),
    description: String(json['description'] ?? ''),
    type: typeDocumentDepuisApi(String(json['type'] ?? DocumentType.autre)),
    matiere: String(json['matiere'] ?? 'Matière'),
    enseignant: String(json['enseignant'] ?? 'Non renseigné'),
    universite: String(json['universite'] ?? 'Non renseignée'),
    niveau: String(json['niveau'] ?? ''),
    semestre: json['semestre'] ? String(json['semestre']) : undefined,
    dureeMinutes: typeof json['dureeMinutes'] === 'number' ? json['dureeMinutes'] : undefined,
    avecCorrige: json['avecCorrige'] === true,
    urlCorrigePdf: json['urlCorrigePdf'] ? String(json['urlCorrigePdf']) : undefined,
    anneeAcademique: String(json['anneeAcademique'] ?? ''),
    tailleMb: tailleMbJson > 0 ? tailleMbJson : tailleMbRepli,
    pages: typeof json['pages'] === 'number' ? json['pages'] : 0,
    urlPdf: String(json['urlPdf'] ?? ''),
    thumbnailUrl: json['thumbnailUrl'] ? String(json['thumbnailUrl']) : undefined,
    dateAjout: json['dateAjout'] ? new Date(String(json['dateAjout'])) : new Date(),
    vues: typeof json['vues'] === 'number' ? json['vues'] : 0,
    telechargements: typeof json['telechargements'] === 'number' ? json['telechargements'] : 0,
    noteMoyenne: typeof json['noteMoyenne'] === 'number' ? json['noteMoyenne'] : 0,
    matiereId: json['matiereId'] ? String(json['matiereId']) : undefined,
    enseignantId: json['enseignantId'] ? String(json['enseignantId']) : undefined,
    universiteId: json['universiteId'] ? String(json['universiteId']) : undefined,
  };
}

function versInfoDocumentLocal(rec: EnregistrementDocumentLocal): InfoDocumentLocal {
  const document = rec.fiche ? objetVersFiche(rec.fiche, rec.tailleOctets) : undefined;
  return {
    id: rec.id,
    userId: rec.userId,
    nom: rec.nom,
    format: rec.format,
    mimeType: rec.mimeType,
    tailleOctets: rec.tailleOctets,
    dateTelechargement: rec.dateTelechargement,
    version: rec.version,
    etat: rec.etat,
    document,
  };
}

/**
 * Stockage local persistant basé sur IndexedDB pour les documents (PDF et DOCX)
 * téléchargés dans NextLearn PWA.
 *
 * Garanties :
 * - Stockage binaire (`ArrayBuffer`) + métadonnées complètes dans IndexedDB (`nl-stockage-local-db`).
 * - Isolation logique stricte par utilisateur (`userId`) : chaque utilisateur ne voit et ne
 *   peut ouvrir que ses propres documents téléchargés.
 * - Conservation des documents lors de la déconnexion (`logout`) : la déconnexion masque
 *   simplement la portée active sans supprimer les fichiers d'IndexedDB ; à la reconnexion,
 *   l'utilisateur retrouve immédiatement ses documents.
 * - Nettoyage automatique au démarrage des enregistrements temporaires ou interrompus
 *   (`etat !== 'complet'`), sans jamais supprimer un document complet sans accord explicite.
 * - Révocation propre des `Blob URL` créées via `URL.createObjectURL()`.
 */
@Injectable({ providedIn: 'root' })
export class StockageHorsLigne {
  private readonly secureStorage = inject(SecureStorageService);

  private readonly _ids = signal<ReadonlySet<string>>(new Set());
  private readonly _fiches = signal<readonly DocumentModel[]>([]);
  private readonly _enregistrements = signal<readonly InfoDocumentLocal[]>([]);
  private readonly _idUtilisateurActif = signal<string | null>(null);

  /** Vrai si le stockage local (IndexedDB ou repli mémoire/cache) est disponible. */
  readonly disponible = true;

  /** Les identifiants des documents complets disponibles localement pour l'utilisateur actif. */
  readonly ids = this._ids.asReadonly();

  /** Les fiches complètes des documents enregistrés localement pour l'utilisateur actif. */
  readonly fiches = this._fiches.asReadonly();

  /** Les métadonnées détaillées (taille exacte, format, date, version) des documents locaux. */
  readonly enregistrements = this._enregistrements.asReadonly();

  /** Identifiant du compte actuellement actif (`null` si déconnecté). */
  readonly idUtilisateurActif = this._idUtilisateurActif.asReadonly();

  /**
   * Portée utilisateur définie explicitement par `AuthRepository` / `AuthService` ou les tests :
   * - `undefined` : non définie explicitement (résolution automatique via `SecureStorageService`)
   * - `null` : utilisateur explicitement déconnecté (aucun document visible)
   * - `string` : identifiant de l'utilisateur connecté
   */
  private utilisateurExplicite: string | null | undefined = undefined;

  /** Promesse de connexion IndexedDB mise en cache. */
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  /**
   * Repli en mémoire vive lorsque IndexedDB est indisponible ou bloqué
   * (ex. environnement de test minimaliste ou navigation ultra-restreinte).
   */
  private readonly memoireFallback = new Map<string, EnregistrementDocumentLocal>();

  /** Suivi des Blob URLs créées afin de garantir leur révocation (`URL.revokeObjectURL`). */
  private readonly urlsParDocument = new Map<string, Set<string>>();
  private readonly toutesUrlsActives = new Set<string>();

  constructor() {
    void this.initialiserAuDemarrage();
  }

  private async initialiserAuDemarrage(): Promise<void> {
    await this.supprimerCacheHeriteGlobal();
    await this.nettoyerFichiersTemporaires();
    await this.inventorier();
  }

  /**
   * Supprime l'ancien cache Cache Storage 'nl-documents-hors-ligne' pour garantir
   * qu'aucun document résiduel non scopé ne subsiste ou ne fuite vers un autre compte.
   */
  private async supprimerCacheHeriteGlobal(): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
      if (await caches.has(NOM_CACHE_HERITE)) {
        await caches.delete(NOM_CACHE_HERITE);
      }
    } catch {
      // Ignoré si indisponible
    }
  }

  /**
   * Purge les caches dynamiques de l'API stockés par le Service Worker (ngsw)
   * pour éviter que des données JSON d'un compte précédent soient servies au nouveau.
   */
  private async purgerCachesDynamiquesServiceWorker(): Promise<void> {
    if (typeof caches === 'undefined') return;
    try {
      const noms = await caches.keys();
      for (const nom of noms) {
        if (nom.includes('dynamic:api') || nom.includes('nl-documents-hors-ligne')) {
          await caches.delete(nom);
        }
      }
    } catch {
      // Ignoré
    }
  }

  /**
   * Résout l'identifiant de l'utilisateur actif.
   * Rend `null` si l'utilisateur s'est explicitement déconnecté.
   */
  utilisateurActif(): string | null {
    if (this.utilisateurExplicite !== undefined) {
      return this.utilisateurExplicite;
    }
    const user = this.secureStorage.getUser();
    if (user?.id) {
      return user.id;
    }
    return 'anonyme';
  }

  /**
   * Change l'utilisateur actif (à la connexion, restauration de session ou déconnexion).
   * - Si `userId` est fourni : exécute le filet de sécurité inter-comptes (`verifierEtIsolerCompte`)
   *   qui compare `userId` avec le dernier compte actif connu (`nl_active_account_id`) et purge
   *   immédiatement toute donnée résiduelle appartenant à un compte différent avant de charger
   *   les données du compte entrant. Si c'est le même compte qui reste connecté, conserve
   *   ses documents hors ligne intacts.
   * - Si `userId === null` : révoque les URLs Blob et réinitialise immédiatement l'inventaire.
   */
  async definirUtilisateur(userId: string | null): Promise<void> {
    const normalise = userId && userId.trim().length > 0 ? userId.trim() : null;
    this.revoquerToutesUrlsLocales();
    this.utilisateurExplicite = normalise;
    this._idUtilisateurActif.set(normalise);

    if (normalise) {
      await this.verifierEtIsolerCompte(normalise);
    } else {
      this._ids.set(new Set());
      this._fiches.set([]);
      this._enregistrements.set([]);
    }
    await this.inventorier();
  }

  /**
   * Filet de sécurité à la connexion / ouverture de session :
   * Compare l'identifiant du compte entrant (`userId`) avec `nl_active_account_id` stocké
   * localement :
   * - Si un compte précédent différent était actif et qu'aucun autre mécanisme n'a purgé,
   *   isole et nettoie les traces de session précédentes.
   * - Met à jour le dernier compte actif.
   */
  async verifierEtIsolerCompte(userId: string): Promise<boolean> {
    const propre = userId.trim();
    if (!propre) return false;

    const dernierCompte = this.secureStorage.getActiveAccountId();
    const changementDeCompte = dernierCompte !== null && dernierCompte !== propre;

    await this.supprimerCacheHeriteGlobal();

    if (changementDeCompte) {
      this.secureStorage.purgerTracesActiviteLocale();
      await this.purgerCachesDynamiquesServiceWorker();
    }

    this.secureStorage.saveActiveAccountId(propre);
    return changementDeCompte;
  }

  /**
   * Purge totale appelée lors de la déconnexion (`logout`) ou de la suppression de compte
   * (`forgetDevice` / `deleteAccount`) :
   * - Révoque toutes les URLs Blob actives.
   * - Vide intégralement le magasin IndexedDB `documents_locaux` et le repli mémoire.
   * - Supprime le cache hérité `nl-documents-hors-ligne` et les caches API du Service Worker.
   * - Réinitialise immédiatement les signaux (`ids`, `fiches`, `enregistrements`) à zéro.
   */
  async purgerToutLeStockageLocal(): Promise<void> {
    this.revoquerToutesUrlsLocales();
    this.utilisateurExplicite = null;
    this._idUtilisateurActif.set(null);
    this._ids.set(new Set());
    this._fiches.set([]);
    this._enregistrements.set([]);
    this.memoireFallback.clear();

    const db = await this.ouvrirBase();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
          const store = tx.objectStore(STORE_DOCUMENTS);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    await this.supprimerCacheHeriteGlobal();
    await this.purgerCachesDynamiquesServiceWorker();
    this.secureStorage.clearActiveAccountId();
  }

  private cleComposite(userId: string, documentId: string): string {
    return `${userId}:${documentId}`;
  }

  // ── Accès bas niveau IndexedDB (avec repli mémoire transparent) ──────────

  private ouvrirBase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const requete = indexedDB.open(NOM_BASE_IDB, VERSION_BASE_IDB);

        requete.onupgradeneeded = () => {
          const db = requete.result;
          if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
            const store = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'cle' });
            store.createIndex('par_utilisateur', 'userId', { unique: false });
            store.createIndex('par_document', 'id', { unique: false });
            store.createIndex('par_etat', 'etat', { unique: false });
          }
        };

        requete.onsuccess = () => {
          const db = requete.result;
          db.onversionchange = () => {
            db.close();
            this.dbPromise = null;
          };
          resolve(db);
        };

        requete.onerror = () => {
          this.dbPromise = null;
          resolve(null);
        };

        requete.onblocked = () => {
          this.dbPromise = null;
          resolve(null);
        };
      } catch {
        this.dbPromise = null;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async ecrireEnregistrement(rec: EnregistrementDocumentLocal): Promise<void> {
    const db = await this.ouvrirBase();
    if (!db) {
      this.memoireFallback.set(rec.cle, rec);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
        const store = tx.objectStore(STORE_DOCUMENTS);
        const req = store.put(rec);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('Transaction IndexedDB annulée'));
      } catch (err) {
        reject(err);
      }
    });
  }

  private async lireEnregistrement(cle: string): Promise<EnregistrementDocumentLocal | null> {
    const db = await this.ouvrirBase();
    if (!db) {
      return this.memoireFallback.get(cle) ?? null;
    }

    return new Promise<EnregistrementDocumentLocal | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORE_DOCUMENTS);
        const req = store.get(cle);
        req.onsuccess = () => {
          resolve((req.result as EnregistrementDocumentLocal | undefined) ?? null);
        };
        req.onerror = () => resolve(this.memoireFallback.get(cle) ?? null);
      } catch {
        resolve(this.memoireFallback.get(cle) ?? null);
      }
    });
  }

  private async supprimerEnregistrementParCle(cle: string): Promise<void> {
    this.memoireFallback.delete(cle);
    const db = await this.ouvrirBase();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_DOCUMENTS, 'readwrite');
        const store = tx.objectStore(STORE_DOCUMENTS);
        store.delete(cle);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async listerEnregistrementsUtilisateur(
    userId: string,
  ): Promise<EnregistrementDocumentLocal[]> {
    const db = await this.ouvrirBase();
    if (!db) {
      return [...this.memoireFallback.values()].filter((r) => r.userId === userId);
    }

    return new Promise<EnregistrementDocumentLocal[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORE_DOCUMENTS);
        if (store.indexNames.contains('par_utilisateur')) {
          const index = store.index('par_utilisateur');
          const req = index.getAll(IDBKeyRange.only(userId));
          req.onsuccess = () => {
            const res = Array.isArray(req.result)
              ? (req.result as EnregistrementDocumentLocal[])
              : [];
            resolve(res);
          };
          req.onerror = () => resolve([]);
        } else {
          const req = store.getAll();
          req.onsuccess = () => {
            const tous = Array.isArray(req.result)
              ? (req.result as EnregistrementDocumentLocal[])
              : [];
            resolve(tous.filter((r) => r.userId === userId));
          };
          req.onerror = () => resolve([]);
        }
      } catch {
        resolve([]);
      }
    });
  }

  private async listerTousEnregistrements(): Promise<EnregistrementDocumentLocal[]> {
    const db = await this.ouvrirBase();
    if (!db) {
      return [...this.memoireFallback.values()];
    }

    return new Promise<EnregistrementDocumentLocal[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_DOCUMENTS, 'readonly');
        const store = tx.objectStore(STORE_DOCUMENTS);
        const req = store.getAll();
        req.onsuccess = () => {
          resolve(
            Array.isArray(req.result) ? (req.result as EnregistrementDocumentLocal[]) : [],
          );
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  // ── Nettoyage des fichiers temporaires & migration ───────────────────────

  /**
   * Supprime tous les enregistrements incomplets (`en_cours`, `interrompu`, `erreur`)
   * laissés par un téléchargement interrompu ou une fermeture brutale de l'application.
   * Ne supprime jamais un document dont l'état est `'complet'`.
   */
  async nettoyerFichiersTemporaires(): Promise<number> {
    const tous = await this.listerTousEnregistrements();
    let supprimes = 0;
    for (const rec of tous) {
      if (rec.etat !== 'complet' || !rec.contenu || rec.tailleOctets <= 0) {
        await this.supprimerEnregistrementParCle(rec.cle);
        supprimes++;
      }
    }
    return supprimes;
  }

  // ── Inventaire et vérification de disponibilité ──────────────────────────

  private async inventorier(): Promise<void> {
    const userId = this.utilisateurActif();
    if (!userId) {
      this._ids.set(new Set());
      this._fiches.set([]);
      this._enregistrements.set([]);
      return;
    }

    const bruts = await this.listerEnregistrementsUtilisateur(userId);
    const complets = bruts
      .filter((r) => r.etat === 'complet' && r.tailleOctets > 0 && !!r.contenu)
      .sort((a, b) => (a.dateTelechargement < b.dateTelechargement ? 1 : -1));

    const idsSet = new Set<string>();
    const fichesList: DocumentModel[] = [];
    const infosList: InfoDocumentLocal[] = [];

    for (const rec of complets) {
      idsSet.add(rec.id);
      const info = versInfoDocumentLocal(rec);
      infosList.push(info);
      if (info.document) {
        fichesList.push(info.document);
      }
    }

    this._ids.set(idsSet);
    this._fiches.set(fichesList);
    this._enregistrements.set(infosList);
  }

  /** Relit l'état d'IndexedDB pour l'utilisateur courant. */
  async rafraichir(): Promise<void> {
    await this.inventorier();
  }

  /**
   * Vérifie si un document est disponible hors ligne pour l'utilisateur actif.
   * Si `versionAttendue` est fournie, vérifie également que la version locale correspond.
   */
  async estDisponible(id: string, versionAttendue?: string): Promise<boolean> {
    const userId = this.utilisateurActif();
    if (!userId || !id) return false;
    const rec = await this.lireEnregistrement(this.cleComposite(userId, id));
    if (!rec || rec.etat !== 'complet' || !rec.contenu || rec.tailleOctets <= 0) {
      return false;
    }
    if (versionAttendue && rec.version !== versionAttendue) {
      return false;
    }
    return true;
  }

  /** Retourne les métadonnées locales d'un document pour l'utilisateur actif, ou `null`. */
  infoDocument(id: string): InfoDocumentLocal | null {
    return this._enregistrements().find((e) => e.id === id) ?? null;
  }

  /**
   * Vérifie l'intégrité binaire d'un fichier téléchargé :
   * - Taille strictement positive
   * - Correspondance avec `Content-Length` si communiqué par le serveur
   * - Signature binaire valide (`%PDF-` pour PDF ou `PK\x03\x04` pour DOCX)
   */
  verifierIntegriteBinaire(
    octets: ArrayBuffer,
    options?: { tailleAttendue?: number | null; typeMime?: string | null; url?: string | null },
  ): { valide: boolean; format: 'pdf' | 'docx' } {
    if (!octets || octets.byteLength < 4) {
      return { valide: false, format: 'pdf' };
    }

    const tailleAttendue = options?.tailleAttendue ?? null;
    if (
      typeof tailleAttendue === 'number' &&
      Number.isFinite(tailleAttendue) &&
      tailleAttendue > 0 &&
      octets.byteLength !== tailleAttendue
    ) {
      return { valide: false, format: 'pdf' };
    }

    const entete = new Uint8Array(octets, 0, Math.min(8, octets.byteLength));
    const formatEntete = detecterFormatParEntete(entete);
    if (formatEntete === 'pdf' || formatEntete === 'docx') {
      return { valide: true, format: formatEntete };
    }

    // Rejeter explicitement les réponses HTML ou JSON déguisées
    const debutTexte = new TextDecoder('utf-8', { fatal: false })
      .decode(new Uint8Array(octets, 0, Math.min(64, octets.byteLength)))
      .trim()
      .toLowerCase();
    if (
      debutTexte.startsWith('<!doctype') ||
      debutTexte.startsWith('<html') ||
      debutTexte.startsWith('<?xml') ||
      debutTexte.startsWith('{') ||
      debutTexte.startsWith('[')
    ) {
      return { valide: false, format: 'pdf' };
    }

    return { valide: false, format: 'pdf' };
  }

  // ── Téléchargement et enregistrement dans IndexedDB ──────────────────────

  /**
   * Télécharge un document depuis son URL signée Cloudflare R2, suit la progression
   * flux par flux, vérifie l'intégrité du fichier et l'enregistre dans IndexedDB.
   */
  async telechargerEtEnregistrer(
    id: string,
    url: string,
    fiche?: DocumentModel,
    options?: OptionsEnregistrementLocal,
  ): Promise<ResultatEnregistrementLocal> {
    const userId = this.utilisateurActif();
    if (!userId) {
      return { ok: false, raison: 'non_authentifie' };
    }

    const version = options?.version ?? calculerVersionDocument(fiche);
    const cle = this.cleComposite(userId, id);

    // Éviter tout téléchargement en double si la même version complète existe déjà
    const existant = await this.lireEnregistrement(cle);
    if (
      existant &&
      existant.etat === 'complet' &&
      existant.tailleOctets > 0 &&
      existant.contenu &&
      existant.version === version
    ) {
      if (fiche && !existant.fiche) {
        const enrichi: EnregistrementDocumentLocal = {
          ...existant,
          nom: fiche.titre || existant.nom,
          fiche: ficheVersObjet(fiche, existant.tailleOctets),
        };
        await this.ecrireEnregistrement(enrichi);
        await this.inventorier();
        return { ok: true, info: versInfoDocumentLocal(enrichi) };
      }
      options?.onProgression?.(100);
      await this.inventorier();
      return { ok: true, info: versInfoDocumentLocal(existant) };
    }

    // Marqueur temporaire 'en_cours' (sera remplacé par 'complet' ou nettoyé en cas d'échec)
    const marqueurEnCours: EnregistrementDocumentLocal = {
      cle,
      id,
      userId,
      nom: fiche?.titre ?? `Document ${id}`,
      format: 'pdf',
      mimeType: 'application/pdf',
      tailleOctets: 0,
      dateTelechargement: new Date().toISOString(),
      version,
      contenu: new ArrayBuffer(0),
      etat: 'en_cours',
      fiche: fiche ? ficheVersObjet(fiche) : undefined,
    };

    try {
      await this.ecrireEnregistrement(marqueurEnCours);
    } catch (err) {
      if (estErreurQuota(err)) {
        return { ok: false, raison: 'quota' };
      }
    }

    try {
      options?.onProgression?.(5);
      const reponse = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: options?.signal,
      });

      if (!reponse.ok) {
        await this.supprimerEnregistrementParCle(cle);
        return { ok: false, raison: 'reseau' };
      }

      const typeMime = reponse.headers.get('content-type') ?? '';
      if (/text\/html|application\/json/i.test(typeMime)) {
        await this.supprimerEnregistrementParCle(cle);
        return { ok: false, raison: 'integrite' };
      }

      const longueurHeader = reponse.headers.get('content-length');
      const tailleAttendue =
        longueurHeader && /^\d+$/.test(longueurHeader.trim())
          ? Number(longueurHeader.trim())
          : null;

      const octets = await this.lireFluxAvecProgression(
        reponse,
        tailleAttendue,
        options?.onProgression,
        options?.signal,
      );

      const verification = this.verifierIntegriteBinaire(octets, {
        tailleAttendue,
        typeMime,
        url,
      });

      if (!verification.valide) {
        await this.supprimerEnregistrementParCle(cle);
        return { ok: false, raison: 'integrite' };
      }

      const formatFinal = verification.format;
      const mimeFinal = mimePourFormat(formatFinal, typeMime);
      const enregistrementComplet: EnregistrementDocumentLocal = {
        cle,
        id,
        userId,
        nom: fiche?.titre || `Document ${id}`,
        format: formatFinal,
        mimeType: mimeFinal,
        tailleOctets: octets.byteLength,
        dateTelechargement: new Date().toISOString(),
        version,
        contenu: octets,
        etat: 'complet',
        fiche: fiche ? ficheVersObjet(fiche, octets.byteLength) : existant?.fiche,
      };

      await this.ecrireEnregistrement(enregistrementComplet);
      options?.onProgression?.(100);
      await this.inventorier();

      return {
        ok: true,
        info: versInfoDocumentLocal(enregistrementComplet),
      };
    } catch (err) {
      // Toujours nettoyer l'enregistrement 'en_cours' si le téléchargement échoue ou est annulé
      await this.supprimerEnregistrementParCle(cle);
      // Si une ancienne version complète existait avant la tentative de mise à jour, la restaurer
      if (existant && existant.etat === 'complet' && existant.tailleOctets > 0) {
        try {
          await this.ecrireEnregistrement(existant);
          await this.inventorier();
        } catch {
          // Ignoré
        }
      }

      if (estErreurAnnulation(err) || options?.signal?.aborted) {
        return { ok: false, raison: 'annule' };
      }
      if (estErreurQuota(err)) {
        return { ok: false, raison: 'quota' };
      }
      return { ok: false, raison: 'reseau' };
    }
  }

  /**
   * Lit le corps de la réponse HTTP en suivant la progression réelle via `ReadableStream`
   * lorsque disponible, avec repli sur `reponse.arrayBuffer()`.
   */
  private async lireFluxAvecProgression(
    reponse: Response,
    tailleAttendue: number | null,
    onProgression?: (pourcentage: number) => void,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    if (!reponse.body || typeof reponse.body.getReader !== 'function') {
      onProgression?.(50);
      const buffer = await reponse.arrayBuffer();
      onProgression?.(95);
      return buffer;
    }

    const lecteur = reponse.body.getReader();
    const morceaux: Uint8Array[] = [];
    let recu = 0;

    try {
      while (true) {
        if (signal?.aborted) {
          await lecteur.cancel();
          const abortErr = new Error('Téléchargement interrompu');
          abortErr.name = 'AbortError';
          throw abortErr;
        }

        const { done, value } = await lecteur.read();
        if (done) break;
        if (value && value.byteLength > 0) {
          morceaux.push(value);
          recu += value.byteLength;
          if (tailleAttendue && tailleAttendue > 0) {
            const pct = Math.min(95, Math.max(5, Math.round((recu / tailleAttendue) * 95)));
            onProgression?.(pct);
          } else {
            // Progression graduelle asymptotique quand Content-Length est absent
            const pctEstime = Math.min(90, 10 + Math.round((1 - Math.exp(-recu / (512 * 1024))) * 80));
            onProgression?.(pctEstime);
          }
        }
      }
    } finally {
      try {
        lecteur.releaseLock();
      } catch {
        // Déjà libéré
      }
    }

    const total = new Uint8Array(recu);
    let decalage = 0;
    for (const morceau of morceaux) {
      total.set(morceau, decalage);
      decalage += morceau.byteLength;
    }
    return total.buffer;
  }

  /**
   * Méthode de compatibilité booléenne : télécharge et enregistre un document dans IndexedDB.
   */
  async enregistrer(
    id: string,
    url: string,
    fiche?: DocumentModel,
    options?: OptionsEnregistrementLocal,
  ): Promise<boolean> {
    const resultat = await this.telechargerEtEnregistrer(id, url, fiche, options);
    return resultat.ok;
  }

  /**
   * Associe ou met à jour la fiche de métadonnées d'un document déjà présent dans IndexedDB.
   */
  async enregistrerFiche(id: string, fiche: DocumentModel): Promise<void> {
    const userId = this.utilisateurActif();
    if (!userId || !id) return;
    const cle = this.cleComposite(userId, id);
    const existant = await this.lireEnregistrement(cle);
    if (!existant) return;
    await this.ecrireEnregistrement({
      ...existant,
      nom: fiche.titre || existant.nom,
      fiche: ficheVersObjet(fiche, existant.tailleOctets),
    });
    await this.inventorier();
  }

  // ── Ouverture et lecture locale (Blob URL gérée) ─────────────────────────

  /**
   * Prépare un document stocké localement pour la lecture dans le lecteur interne
   * (PDF ou DOCX) sans aucun appel réseau.
   * Retourne l'URL objet (`blob:...`), le format détecté et les métadonnées.
   */
  async obtenirPourLecture(id: string): Promise<LectureLocaleDocument | null> {
    const userId = this.utilisateurActif();
    if (!userId || !id) return null;

    const rec = await this.lireEnregistrement(this.cleComposite(userId, id));
    if (!rec || rec.etat !== 'complet' || !rec.contenu || rec.tailleOctets <= 0) {
      return null;
    }

    const blob = new Blob([rec.contenu], { type: rec.mimeType || mimePourFormat(rec.format) });
    const url = URL.createObjectURL(blob);

    let setDoc = this.urlsParDocument.get(id);
    if (!setDoc) {
      setDoc = new Set<string>();
      this.urlsParDocument.set(id, setDoc);
    }
    setDoc.add(url);
    this.toutesUrlsActives.add(url);

    return {
      id: rec.id,
      url,
      format: rec.format,
      mimeType: rec.mimeType,
      nom: rec.nom,
      tailleOctets: rec.tailleOctets,
      dateTelechargement: rec.dateTelechargement,
      version: rec.version,
    };
  }

  /**
   * Rend une `blob:` URL pointant vers la copie locale de l'utilisateur actif,
   * ou `null` si ce document n'est pas enregistré localement.
   * L'appelant (ou `revoquerUrlLocale`) révoque l'URL à la fermeture du lecteur.
   */
  async urlLocale(id: string): Promise<string | null> {
    const lecture = await this.obtenirPourLecture(id);
    return lecture?.url ?? null;
  }

  /** Révoque explicitement une URL Blob créée par `urlLocale` ou `obtenirPourLecture`. */
  revoquerUrlLocale(url: string | null | undefined): void {
    if (!url) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignoré si déjà révoquée
    }
    this.toutesUrlsActives.delete(url);
    for (const [docId, setUrls] of this.urlsParDocument.entries()) {
      setUrls.delete(url);
      if (setUrls.size === 0) {
        this.urlsParDocument.delete(docId);
      }
    }
  }

  /** Révoque toutes les URLs Blob associées à un document donné. */
  private revoquerUrlsDuDocument(id: string): void {
    const setUrls = this.urlsParDocument.get(id);
    if (!setUrls) return;
    for (const url of setUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignoré
      }
      this.toutesUrlsActives.delete(url);
    }
    this.urlsParDocument.delete(id);
  }

  /** Révoque toutes les URLs Blob actives (ex. lors d'un changement d'utilisateur ou nettoyage). */
  revoquerToutesUrlsLocales(): void {
    for (const url of this.toutesUrlsActives) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignoré
      }
    }
    this.toutesUrlsActives.clear();
    this.urlsParDocument.clear();
  }

  // ── Suppression et gestion de l'espace de stockage ───────────────────────

  /** Retire un document du stockage local de l'utilisateur actif. */
  async supprimer(id: string): Promise<void> {
    const userId = this.utilisateurActif();
    if (!userId || !id) return;
    this.revoquerUrlsDuDocument(id);
    await this.supprimerEnregistrementParCle(this.cleComposite(userId, id));
    await this.inventorier();
  }

  /**
   * Efface tous les documents téléchargés de l'utilisateur actif uniquement
   * (action explicite « Libérer de l'espace » / « Vider mes téléchargements »).
   * N'affecte pas les documents des autres comptes utilisateurs sur l'appareil.
   */
  async vider(): Promise<void> {
    const userId = this.utilisateurActif();
    if (!userId) return;
    this.revoquerToutesUrlsLocales();
    const enregistrements = await this.listerEnregistrementsUtilisateur(userId);
    for (const rec of enregistrements) {
      await this.supprimerEnregistrementParCle(rec.cle);
    }
    await this.inventorier();
  }

  /**
   * Espace occupé par les téléchargements de l'utilisateur et quota disponible sur l'appareil,
   * en octets. Combine la somme exacte des fichiers stockés dans IndexedDB (`utiliseApp`)
   * et l'estimation globale du navigateur (`navigator.storage.estimate()`).
   */
  async estimation(): Promise<{
    utilise: number;
    quota: number;
    utiliseApp: number;
    nombreDocuments: number;
  }> {
    const enregistrements = this._enregistrements();
    const utiliseApp = enregistrements.reduce((acc, r) => acc + (r.tailleOctets || 0), 0);
    const nombreDocuments = enregistrements.length;

    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        return {
          utilise: Math.max(est.usage ?? 0, utiliseApp),
          quota: est.quota ?? 0,
          utiliseApp,
          nombreDocuments,
        };
      } catch {
        // Repli sur utiliseApp
      }
    }
    return {
      utilise: utiliseApp,
      quota: 0,
      utiliseApp,
      nombreDocuments,
    };
  }

  /**
   * Demande au navigateur de marquer le stockage de l'origine comme persistant
   * afin d'éviter toute éviction automatique par le système d'exploitation.
   */
  async demanderPersistance(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    try {
      if (navigator.storage.persisted && (await navigator.storage.persisted())) {
        return true;
      }
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}
