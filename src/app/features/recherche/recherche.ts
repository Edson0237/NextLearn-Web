import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentCard } from '../../shared/ui/document-card/document-card';
import { Icon } from '../../shared/ui/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { DocumentsRepository } from '../../core/bibliotheque/documents-repository';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../core/bibliotheque/document.model';
import { AppRoutes } from '../../core/router/app-routes';

@Component({
  selector: 'nl-recherche',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentCard, Icon, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recherche.html',
  styleUrl: './recherche.scss',
})
export class Recherche {
  private readonly router = inject(Router);
  private readonly docsRepo = inject(DocumentsRepository);

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
    } catch (e) {
      this.error.set('Impossible de lancer la recherche.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.home]);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigate(['/', AppRoutes.documentDetail.replace(':id', doc.id)]);
  }

  protected typeIcon(type: DocumentType): string {
    switch (type) {
      case DocumentType.cours: return 'menu_book';
      case DocumentType.td: return 'edit_note';
      case DocumentType.synthese: return 'summarize';
      case DocumentType.epreuve: return 'assignment';
      default: return 'description';
    }
  }

  protected typeColor(type: DocumentType): string {
    return couleurTypeDocument(type);
  }

  protected typeLabel(type: DocumentType): string {
    return labelTypeDocument(type);
  }

  protected metaFor(doc: DocumentModel) {
    const meta = [];
    if (doc.enseignant) meta.push({ icon: 'person' as const, label: doc.enseignant });
    if (doc.pages > 0) meta.push({ icon: 'description' as const, label: `${doc.pages} p.` });
    if (doc.tailleMb > 0) meta.push({ icon: 'download' as const, label: `${doc.tailleMb.toFixed(1)} Mo` });
    return meta;
  }
}
