import { Injectable, inject, signal } from '@angular/core';
import {
  DocumentModel,
  DocumentsRepository,
  OfflineRepository,
  StockageHorsLigne,
  calculerVersionDocument,
} from '../../core/bibliotheque';
import { tr } from '../../core/i18n';
import { ToastService } from '../ui/toast/toast';

/**
 * État d'un téléchargement interne de document dans la PWA :
 * - `repos` : le document n'est pas enregistré dans le stockage local ;
 * - `encours` : téléchargement et écriture vers IndexedDB en cours ;
 * - `lance` : conservé par compatibilité de type pour les composants UI ;
 * - `fait` : le document est intégralement stocké dans IndexedDB et disponible hors ligne.
 */
export type EtatTelechargement = 'repos' | 'encours' | 'lance' | 'fait';

/** Nombre maximal de téléchargements simultanés autorisés pour préserver la mémoire et le réseau. */
export const MAX_TELECHARGEMENTS_SIMULTANES = 3;

/**
 * Gestionnaire centralisé de téléchargement interne (Cloudflare R2 → IndexedDB).
 *
 * Règles d'architecture :
 * - Ne déclenche JAMAIS le téléchargement classique du navigateur (aucun `<a download>`).
 * - Récupère l'URL présignée R2 via l'API, lit le flux binaire avec suivi de progression,
 *   vérifie l'intégrité du fichier (PDF ou DOCX) et l'enregistre dans IndexedDB.
 * - Limite le nombre de téléchargements simultanés et permet l'annulation propre.
 */
@Injectable({ providedIn: 'root' })
export class TelechargementEtat {
  private readonly docs = inject(DocumentsRepository);
  private readonly offline = inject(OfflineRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly toast = inject(ToastService);

  private readonly enCours = signal<ReadonlySet<string>>(new Set());
  private readonly progressions = signal<ReadonlyMap<string, number>>(new Map());
  private readonly controleurs = new Map<string, AbortController>();
  private inventaire: Promise<void> | null = null;

  /** Relit l'inventaire local au démarrage ou à l'ouverture d'un écran. */
  initialiser(): Promise<void> {
    return (this.inventaire = this.stockage.rafraichir());
  }

  /** État courant du téléchargement pour un document donné. */
  etat(id: string): EtatTelechargement {
    if (this.stockage.ids().has(id)) return 'fait';
    if (this.enCours().has(id)) return 'encours';
    return 'repos';
  }

  /** Indique si le document est déjà enregistré et consultable hors ligne. */
  estDisponible(id: string): boolean {
    return this.stockage.ids().has(id);
  }

  /** Progression du téléchargement en cours (`0` à `100`). Rend `100` si déjà téléchargé. */
  progression(id: string): number {
    if (this.stockage.ids().has(id)) return 100;
    return this.progressions().get(id) ?? 0;
  }

  /** Nombre de téléchargements actuellement en cours. */
  nombreEnCours(): number {
    return this.enCours().size;
  }

  /** Annule un téléchargement en cours et nettoie les données partielles. */
  annuler(id: string): void {
    const ctrl = this.controleurs.get(id);
    if (ctrl) {
      ctrl.abort();
      this.controleurs.delete(id);
    }
    this.marquer(this.enCours, id, false);
    this.definirProgression(id, null);
  }

  /** Supprime un document du stockage local de l'application. */
  async supprimer(id: string): Promise<void> {
    this.annuler(id);
    await this.stockage.supprimer(id);
    await this.offline.removeOffline(id).catch(() => undefined);
    this.toast.succes(
      tr('dlRetireHorsLigne', 'Document supprimé de vos téléchargements hors ligne.'),
    );
  }

  /**
   * Télécharge un document depuis Cloudflare R2 et l'enregistre dans IndexedDB
   * pour une consultation interne hors connexion.
   */
  async telecharger(doc: DocumentModel): Promise<void> {
    await this.initialiser();

    if (this.enCours().has(doc.id)) {
      return;
    }

    const version = calculerVersionDocument(doc);
    const dejaPresent =
      this.stockage.ids().has(doc.id) &&
      (await this.stockage.estDisponible(doc.id, version));

    if (dejaPresent) {
      this.toast.info(
        tr('dlDejaDisponible', 'Ce document est déjà disponible dans « Mes téléchargements ».'),
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.toast.erreur(
        tr('dlHorsConnexion', 'Pas de connexion : le téléchargement est impossible pour le moment.'),
      );
      return;
    }

    if (this.enCours().size >= MAX_TELECHARGEMENTS_SIMULTANES) {
      this.toast.info(
        tr(
          'dlLimiteSimultanee',
          'Un maximum de 3 téléchargements simultanés est autorisé. Patientez quelques instants.',
        ),
      );
      return;
    }

    const controleur = new AbortController();
    this.controleurs.set(doc.id, controleur);
    this.marquer(this.enCours, doc.id, true);
    this.definirProgression(doc.id, 0);

    try {
      const url = (await this.docs.urlLecture(doc.id).catch(() => null)) ?? doc.urlPdf;
      if (!url || !/^https?:\/\//i.test(url)) {
        this.toast.erreur(tr('pwaPasDeFichierAssocie', 'Ce document n’a pas de fichier associé.'));
        return;
      }

      const resultat = await this.stockage.telechargerEtEnregistrer(doc.id, url, doc, {
        signal: controleur.signal,
        version,
        onProgression: (pct) => this.definirProgression(doc.id, pct),
      });

      if (resultat.ok) {
        void this.stockage.demanderPersistance();
        await this.offline.markOffline(doc.id).catch(() => undefined);
        void this.docs.recordDownload(doc.id);
        this.toast.succes(
          tr('dlTelecharge', 'Document enregistré dans « Mes téléchargements » (disponible hors ligne).'),
        );
        return;
      }

      if (resultat.raison === 'annule') {
        this.toast.info(tr('dlAnnule', 'Téléchargement annulé.'));
        return;
      }

      if (resultat.raison === 'quota') {
        this.toast.erreur(
          tr(
            'dlQuotaDepasse',
            'Espace de stockage insuffisant. Supprimez d’anciens documents dans « Mes téléchargements » pour libérer de l’espace.',
          ),
        );
        return;
      }

      if (resultat.raison === 'integrite') {
        this.toast.erreur(
          tr(
            'dlFichierInvalide',
            'Le fichier téléchargé est incomplet ou invalide. Veuillez réessayer.',
          ),
        );
        return;
      }

      this.toast.erreur(tr('telechargementEchecSimple', 'Le téléchargement a échoué. Vérifiez votre connexion.'));
    } catch {
      this.toast.erreur(tr('telechargementEchecSimple', 'Le téléchargement a échoué.'));
    } finally {
      this.controleurs.delete(doc.id);
      this.marquer(this.enCours, doc.id, false);
      this.definirProgression(doc.id, null);
    }
  }

  private definirProgression(id: string, valeur: number | null): void {
    const suivant = new Map(this.progressions());
    if (valeur === null) {
      suivant.delete(id);
    } else {
      suivant.set(id, Math.max(0, Math.min(100, Math.round(valeur))));
    }
    this.progressions.set(suivant);
  }

  private marquer(
    cible: ReturnType<typeof signal<ReadonlySet<string>>>,
    id: string,
    present: boolean,
  ): void {
    const suivant = new Set(cible());
    if (present) suivant.add(id);
    else suivant.delete(id);
    cible.set(suivant);
  }
}
