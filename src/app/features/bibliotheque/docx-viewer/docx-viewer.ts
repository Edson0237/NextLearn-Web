import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TraductionPipe } from '../../../core/i18n';

/**
 * Lecteur DOCX en lecture seule pour NextLearn Web
 *
 * Utilise docx-preview avec chargement différé (dynamic import) pour préserver
 * la taille du bundle initial et n'importer la bibliothèque que lors de la lecture d'un DOCX.
 */
@Component({
  selector: 'nl-docx-viewer',
  standalone: true,
  imports: [CommonModule, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './docx-viewer.html',
  styleUrl: './docx-viewer.scss',
})
export class DocxViewer implements AfterViewInit, OnDestroy {
  readonly url = input<string | undefined>(undefined);
  readonly pageInitiale = input<number>(1);

  readonly pageChange = output<number>();
  readonly totalCount = output<number>();
  readonly charge = output<void>();
  readonly erreur = output<string>();

  protected readonly docxContainer = viewChild<ElementRef<HTMLDivElement>>('docxContainer');

  protected readonly chargement = signal(true);
  protected readonly messageErreur = signal<string | null>(null);

  private observateurPages: IntersectionObserver | null = null;
  private renduEnCours = false;
  private urlRendue: string | null = null;
  private controleurRequete: AbortController | null = null;

  constructor() {
    // Réagit aux changements d'URL
    effect(() => {
      const u = this.url();
      if (u && u !== this.urlRendue && this.docxContainer()) {
        void this.chargerEtRendre(u);
      }
    });
  }

  ngAfterViewInit(): void {
    const u = this.url();
    if (u && !this.renduEnCours && u !== this.urlRendue) {
      void this.chargerEtRendre(u);
    }
  }

  ngOnDestroy(): void {
    this.nettoyer();
  }

  private nettoyer(): void {
    if (this.controleurRequete) {
      this.controleurRequete.abort();
      this.controleurRequete = null;
    }
    if (this.observateurPages) {
      this.observateurPages.disconnect();
      this.observateurPages = null;
    }
    const container = this.docxContainer()?.nativeElement;
    if (container) {
      container.innerHTML = '';
    }
    this.renduEnCours = false;
  }

  /**
   * Télécharge les octets du fichier DOCX et les rend via docx-preview
   */
  private async chargerEtRendre(url: string): Promise<void> {
    const container = this.docxContainer()?.nativeElement;
    if (!container) return;

    this.nettoyer();
    this.renduEnCours = true;
    this.chargement.set(true);
    this.messageErreur.set(null);

    this.controleurRequete = new AbortController();

    try {
      // 1. Récupération des données du document
      // Si c'est une URL d'objet blob locale ou distante
      const reponse = await fetch(url, {
        signal: this.controleurRequete.signal,
        credentials: 'omit',
      });

      if (!reponse.ok) {
        throw new Error(`Erreur réseau lors de la récupération (${reponse.status})`);
      }

      const octets = await reponse.arrayBuffer();
      if (octets.byteLength === 0) {
        throw new Error('Le document DOCX est vide.');
      }

      // 2. Chargement différé de la bibliothèque docx-preview
      const docx = await import('docx-preview');

      // Vider le conteneur avant rendu
      container.innerHTML = '';

      // 3. Rendu du document
      await docx.renderAsync(octets, container, undefined, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        className: 'nl-docx',
        trimXmlDeclaration: true,
      });

      this.urlRendue = url;
      this.chargement.set(false);
      this.charge.emit();

      // 4. Décompte des pages et mise en place de l'observateur de défilement
      this.configurerPages(container);
    } catch (err: unknown) {
      if (this.controleurRequete?.signal.aborted) {
        return;
      }
      console.error('[DocxViewer] Erreur de rendu DOCX', err);
      const texteErreur = err instanceof Error ? err.message : 'Impossible d’afficher ce document Word.';
      this.messageErreur.set(texteErreur);
      this.chargement.set(false);
      this.erreur.emit(texteErreur);
    } finally {
      this.renduEnCours = false;
    }
  }

  /**
   * Analyse les sections créées par docx-preview pour déterminer le nombre de pages
   * et suivre le défilement de l'utilisateur.
   */
  private configurerPages(container: HTMLElement): void {
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>(
        '.nl-docx-wrapper > section, .docx-wrapper > section, section.nl-docx, section.docx',
      ),
    );

    const nombrePages = sections.length > 0 ? sections.length : 1;
    this.totalCount.emit(nombrePages);

    if (sections.length > 1) {
      // Configuration de l'IntersectionObserver pour suivre la page visible
      this.observateurPages = new IntersectionObserver(
        (entrees) => {
          for (const entree of entrees) {
            if (entree.isIntersecting) {
              const index = sections.indexOf(entree.target as HTMLElement);
              if (index >= 0) {
                this.pageChange.emit(index + 1);
              }
            }
          }
        },
        {
          root: container,
          threshold: 0.3,
        },
      );

      for (const section of sections) {
        this.observateurPages.observe(section);
      }
    } else {
      this.pageChange.emit(1);
    }

    // Reprise de position si page initiale > 1
    const depart = this.pageInitiale();
    if (depart > 1 && depart <= sections.length) {
      const cible = sections[depart - 1];
      if (cible) {
        setTimeout(() => {
          cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }
}
