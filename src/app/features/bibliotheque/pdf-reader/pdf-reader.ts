import { NotificationsEtat } from '../../../core/notifications';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, OnInit, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { Icon } from '../../../shared/ui/icon/icon';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { LectureProgressRepository } from '../../../core/bibliotheque';
import { ProgressionRepository } from '../../../core/progression';
import { StockageHorsLigne } from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router';
import { HistoriqueNavigation } from '../../../core/router';

/**
 * Le moteur de rendu de pdf.js, servi depuis notre propre domaine.
 *
 * `ng2-pdf-viewer` le charge sinon depuis jsdelivr. Deux conséquences, et la
 * seconde est la plus gênante pour cette application : une dépendance tierce
 * au moment précis où l'on ouvre un document, et **rien ne s'affiche hors
 * ligne** - c'est-à-dire dans la situation où l'on vient justement chercher
 * un document téléchargé. En production, le fichier manquait tout court : le
 * chemin par défaut de pdf.js (`./pdf.worker.mjs`) se résout relativement à
 * l'URL de la page, donc sur une route qui n'existe pas.
 *
 * L'affectation doit précéder la construction du composant de visualisation,
 * qui lit cette valeur dans son constructeur : au niveau du module, elle est
 * exécutée au chargement du morceau de code, donc avant.
 */
(window as unknown as { pdfWorkerSrc?: string }).pdfWorkerSrc = '/pdf.worker.min.mjs';

/**
 * Durée minimale d'une session d'étude, en secondes -
 * `StudySessionController.minimumDurationSeconds` côté Flutter.
 *
 * En deçà, on a ouvert puis refermé : compter cette seconde-là gonflerait les
 * statistiques de lecture de tout le monde sans que personne n'ait lu.
 */
const DUREE_MINIMALE_SESSION_S = 5;

@Component({
  selector: 'nl-pdf-reader',
  standalone: true,
  imports: [TraductionPipe, CommonModule, Icon, PdfViewerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pdf-reader.html',
  styleUrl: './pdf-reader.scss',
})
export class PdfReader implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly historique = inject(HistoriqueNavigation);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly lectureRepo = inject(LectureProgressRepository);
  private readonly progression = inject(ProgressionRepository);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly url = signal<string | undefined>(undefined);
  protected readonly safeUrl = signal<SafeResourceUrl | null>(null);
  protected readonly fallback = signal(false);
  protected readonly documentId = signal<string>('');
  /** Page affichée, et nombre total une fois le document analysé. */
  protected readonly page = signal(1);
  protected readonly totalPages = signal(0);
  private fallbackTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Début de la session de lecture, pour en mesurer la durée à la sortie. */
  private readonly debut = Date.now();
  /** Pages réellement affichées : une session de 40 pages tournées vite n'est
   *  pas une session d'une page restée ouverte une heure. */
  private readonly pagesVues = new Set<number>();
  private sauvegardeEnAttente: ReturnType<typeof setTimeout> | null = null;
  /** URL d'objet d'une copie locale, à révoquer en sortant. */
  private urlObjet: string | null = null;

  private readonly notifEtat = inject(NotificationsEtat);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.documentId.set(id);
    // Ouvert directement (lien, notification, historique) : consulté, donc plus « nouveau ».
    if (id) void this.notifEtat.marquerRessourceLue('document', id);
    if (!id) {
      this.error.set('Document non spécifié.');
      this.loading.set(false);
      return;
    }

    // La page où l'on s'était arrêté, demandée avant le document lui-même :
    // pdf.js lit `[page]` au premier rendu, et la poser après ferait sauter
    // l'affichage de la page 1 à la bonne page sous les yeux du lecteur.
    const reprise = await this.lectureRepo.getPour(id);
    if (reprise && reprise.pageCourante > 1) {
      this.page.set(reprise.pageCourante);
      if (reprise.totalPages > 0) this.totalPages.set(reprise.totalPages);
    }
    this.pagesVues.add(this.page());

    // La copie locale d'abord : c'est la seule qui s'ouvre sans réseau, et
    // elle évite une URL signée de plus quand le document est déjà là.
    const locale = await this.stockage.urlLocale(id);
    if (locale) {
      this.urlObjet = locale;
      this.setUrl(locale);
      void this.docsRepo.recordView(id);
      this.loading.set(false);
      return;
    }

    try {
      const fresh = await this.docsRepo.urlLecture(id);
      const finalUrl = fresh || this.route.snapshot.queryParamMap.get('url') || undefined;
      if (finalUrl) {
        this.setUrl(finalUrl);
        void this.docsRepo.recordView(id);
      } else {
        const doc = await this.docsRepo.getById(id);
        if (doc?.urlPdf) {
          this.setUrl(doc.urlPdf);
          void this.docsRepo.recordView(id);
        } else {
          this.error.set('Impossible d\'obtenir l\'URL du document.');
        }
      }
    } catch (e) {
      this.error.set('Impossible d\'ouvrir le document.');
    } finally {
      this.loading.set(false);
    }
  }

  private setUrl(url: string): void {
    this.url.set(url);
    this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
    this.fallbackTimeout = setTimeout(() => {
      this.fallback.set(true);
    }, 8000);
  }

  protected goBack(): void {
    // Reculer, et non empiler une seconde fiche : voir `HistoriqueNavigation`.
    const fiche = '/app/' + AppRoutes.docDetailPath(this.documentId());
    this.historique.retour(fiche, (url) => !url.endsWith(`/${this.documentId()}`));
  }

  protected openInNewTab(): void {
    const url = this.url();
    if (url) window.open(url, '_blank');
  }

  protected onError(error: unknown): void {
    console.error('[PdfReader] erreur lecteur PDF intégré', error);
    this.clearFallbackTimeout();
    this.fallback.set(true);
  }

  protected onLoaded(pdf?: { numPages?: number }): void {
    this.clearFallbackTimeout();
    if (pdf?.numPages) this.totalPages.set(pdf.numPages);
  }

  /** Page affichée par le lecteur : mémorisée, puis enregistrée au calme. */
  protected surChangementDePage(page: number): void {
    if (!page || page === this.page()) return;
    this.page.set(page);
    this.pagesVues.add(page);
    this.planifierSauvegarde();
  }

  /**
   * Enregistre la position, une seule fois par salve.
   *
   * Tourner dix pages d'affilée déclencherait dix requêtes dont neuf seraient
   * périmées à l'arrivée. Une seconde de calme suffit à n'envoyer que la
   * dernière.
   */
  private planifierSauvegarde(): void {
    if (this.sauvegardeEnAttente) clearTimeout(this.sauvegardeEnAttente);
    this.sauvegardeEnAttente = setTimeout(() => void this.enregistrerPosition(), 1000);
  }

  private async enregistrerPosition(): Promise<void> {
    const id = this.documentId();
    if (!id) return;
    await this.lectureRepo.enregistrer({
      documentId: id,
      pageCourante: this.page(),
      totalPages: this.totalPages(),
    });
  }

  /**
   * À la fermeture : la position exacte, puis la session d'étude.
   *
   * Les deux sont distinctes et le restent : la position sert à reprendre la
   * lecture, la session alimente la progression (temps passé, pages lues).
   * Flutter les sépare de la même façon, et une seule des deux a un seuil
   * minimal.
   */
  ngOnDestroy(): void {
    if (this.sauvegardeEnAttente) clearTimeout(this.sauvegardeEnAttente);
    this.clearFallbackTimeout();
    // Une URL d'objet non révoquée retient le fichier entier en mémoire.
    if (this.urlObjet) URL.revokeObjectURL(this.urlObjet);

    const id = this.documentId();
    if (!id) return;

    void this.enregistrerPosition();

    const secondes = Math.round((Date.now() - this.debut) / 1000);
    const pages = this.pagesVues.size;
    if (secondes < DUREE_MINIMALE_SESSION_S || pages === 0) return;

    void this.progression
      .createStudySession({
        documentId: id,
        dureeSecondes: secondes,
        pagesLues: pages,
        date: new Date(),
      })
      .catch(() => undefined);
  }

  private clearFallbackTimeout(): void {
    if (this.fallbackTimeout) {
      clearTimeout(this.fallbackTimeout);
      this.fallbackTimeout = null;
    }
  }
}
