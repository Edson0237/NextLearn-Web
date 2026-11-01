import { metaDocument, noteDocument } from '../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { TraductionPipe } from '../../core/i18n/t.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentCard } from '../../shared/ui/document-card/document-card';
import { IconName } from '../../shared/ui/icon/icon-paths';
import { Icon } from '../../shared/ui/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { DocumentsRepository } from '../../core/bibliotheque';
import { HistoriqueRecherches } from '../../core/recherche/historique-recherches';
import { DocumentModel, DocumentType } from '../../core/bibliotheque';
import { AppRoutes } from '../../core/router/app-routes';
import { TypeDocumentPipe } from '../../shared/ui/type-document/presentation-type-document';

@Component({
  selector: 'nl-recherche',
  standalone: true,
  imports: [TypeDocumentPipe, TraductionPipe, CommonModule, FormsModule, DocumentCard, Icon, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recherche.html',
  styleUrl: './recherche.scss',
})
export class Recherche {
  private readonly router = inject(Router);
  private readonly docsRepo = inject(DocumentsRepository);
  protected readonly historique = inject(HistoriqueRecherches);

  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly results = signal<DocumentModel[]>([]);

  protected readonly showResults = computed(() => this.query().trim().length >= 2);

  constructor() {
    effect(() => {
      const q = this.query().trim();
      if (q.length < 2) {
        this.results.set([]);
        this.loading.set(false);
        return;
      }
      this.search(q);
    }, { allowSignalWrites: true });
  }

  private async search(q: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.docsRepo.search(q);
      this.results.set(docs);
      // Retenu seulement si la recherche a abouti : mémoriser une saisie en
      // cours de frappe remplirait la liste de moitiés de mots.
      if (docs.length > 0) this.historique.retenir(q);
    } catch (e) {
      this.error.set('Impossible de lancer la recherche.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/app', AppRoutes.home]);
  }

  protected rejouer(terme: string): void {
    this.query.set(terme);
  }

  protected oublier(terme: string, evenement: Event): void {
    evenement.stopPropagation();
    this.historique.oublier(terme);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }




  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }
}
