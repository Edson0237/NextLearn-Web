import { Injectable, inject, signal } from '@angular/core';
import {
  DocumentModel,
  DocumentsRepository,
  OfflineRepository,
  StockageHorsLigne,
  detecterFormatDocument,
} from '../../core/bibliotheque';
import { tr } from '../../core/i18n';
import { ToastService } from '../ui/toast/toast';

/**
 * Ce que dit le bouton « Télécharger » d'une carte :
 * - `repos` : rien n'a été téléchargé sur cet appareil ;
 * - `encours` : le fichier est en route ;
 * - `lance` : le navigateur a reçu l'ordre, mais l'application ne peut pas
 *   confirmer qu'il est arrivé (le fichier n'est pas dans son stockage) ;
 * - `fait` : le fichier est dans le stockage hors ligne de l'application.
 */
export type EtatTelechargement = 'repos' | 'encours' | 'lance' | 'fait';

/**
 * Le téléchargement d'un document depuis une carte.
 *
 * Le bouton créait un lien `<a download>` vers une URL d'un autre domaine : le
 * navigateur ignore alors `download`, ouvre un onglet, et l'application ne sait
 * rien de ce qui s'est passé. Le fichier est désormais récupéré par
 * l'application elle-même et rangé dans `StockageHorsLigne` : c'est ce rangement,
 * et lui seul, qui permet d'afficher « Téléchargé ». Il rend aussi le document
 * lisible hors ligne, sans second geste.
 *
 * Un fichier présent seulement dans le dossier Téléchargements du système n'est
 * pas lisible par la PWA : il ne compte pas comme « fait ».
 */
@Injectable({ providedIn: 'root' })
export class TelechargementEtat {
  private readonly docs = inject(DocumentsRepository);
  private readonly offline = inject(OfflineRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly toast = inject(ToastService);

  private readonly enCours = signal<ReadonlySet<string>>(new Set());
  private readonly lances = signal<ReadonlySet<string>>(new Set());
  private inventaire: Promise<void> | null = null;

  /** Relit l'inventaire local une fois ; à appeler quand une liste s'affiche. */
  initialiser(): Promise<void> {
    return (this.inventaire ??= this.stockage.rafraichir());
  }

  etat(id: string): EtatTelechargement {
    if (this.stockage.ids().has(id)) return 'fait';
    if (this.enCours().has(id)) return 'encours';
    if (this.lances().has(id)) return 'lance';
    return 'repos';
  }

  async telecharger(doc: DocumentModel): Promise<void> {
    await this.initialiser();
    const etat = this.etat(doc.id);
    if (etat === 'encours') return;
    if (etat === 'fait') {
      this.toast.info(tr('dlDejaDisponible', 'Ce document est déjà disponible sur cet appareil.'));
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.toast.erreur(tr('dlHorsConnexion', 'Pas de connexion : le téléchargement est impossible pour le moment.'));
      return;
    }

    this.marquer(this.enCours, doc.id, true);
    try {
      const url = (await this.docs.urlLecture(doc.id).catch(() => null)) ?? doc.urlPdf;
      // Une clé de stockage nue (sans http) n'est pas un lien : l'ouvrir renverrait la PWA elle-même.
      if (!url || !/^https?:\/\//i.test(url)) {
        this.toast.erreur(tr('pwaPasDeFichierAssocie', 'Ce document n’a pas de fichier associé.'));
        return;
      }

      const range = await this.stockage.enregistrer(doc.id, url);
      if (range) {
        await this.stockage.enregistrerFiche(doc.id, doc);
        // Le marquage serveur ne sert qu'à retrouver sa liste d'un appareil à
        // l'autre : son échec n'annule pas un fichier bien rangé ici.
        await this.offline.markOffline(doc.id).catch(() => undefined);
        void this.docs.recordDownload(doc.id);
        await this.deposerSurAppareil(doc);
        this.toast.succes(tr('dlTelecharge', 'Document téléchargé et disponible hors ligne.'));
        return;
      }

      // Le navigateur a refusé de laisser l'application lire le fichier : on
      // confie le téléchargement au navigateur, sans prétendre qu'il a abouti.
      void this.docs.recordDownload(doc.id);
      this.lancerParLeNavigateur(doc, url);
      this.marquer(this.lances, doc.id, true);
      this.toast.info(tr('dlLance', 'Téléchargement lancé. Ouvre le fichier depuis les téléchargements de ton appareil.'));
    } catch {
      this.marquer(this.lances, doc.id, false);
      this.toast.erreur(tr('telechargementEchecSimple', 'Le téléchargement a échoué.'));
    } finally {
      this.marquer(this.enCours, doc.id, false);
    }
  }

  /** Enregistre aussi une copie visible dans les fichiers de l'appareil. */
  private async deposerSurAppareil(doc: DocumentModel): Promise<void> {
    const local = await this.stockage.urlLocale(doc.id);
    if (!local) return;
    const format = detecterFormatDocument({ url: doc.urlPdf });
    this.cliquer(local, doc.titre, false, format);
    setTimeout(() => URL.revokeObjectURL(local), 60_000);
  }

  private lancerParLeNavigateur(doc: DocumentModel, url: string): void {
    const format = detecterFormatDocument({ url: doc.urlPdf || url });
    this.cliquer(url, doc.titre, true, format);
  }

  private cliquer(href: string, titre: string, autreOnglet = false, extension = 'pdf'): void {
    const lien = window.document.createElement('a');
    lien.href = href;
    lien.download = `${titre}.${extension}`;
    lien.rel = 'noopener';
    if (autreOnglet) lien.target = '_blank';
    lien.click();
  }

  private marquer(cible: ReturnType<typeof signal<ReadonlySet<string>>>, id: string, present: boolean): void {
    const suivant = new Set(cible());
    if (present) suivant.add(id);
    else suivant.delete(id);
    cible.set(suivant);
  }
}
