import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocumentCard } from '../../../shared/ui/document-card/document-card';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { OfflineRepository } from '../../../core/bibliotheque/offline-repository';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-offline-library',
  standalone: true,
  imports: [CommonModule, DocumentCard, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './offline-library.html',
  styleUrl: './offline-library.scss',
})
export class OfflineLibrary implements OnInit {
  private readonly router = inject(Router);
  private readonly offlineRepo = inject(OfflineRepository);
  private readonly docsRepo = inject(DocumentsRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly offlineIds = signal<Set<string>>(new Set());

  protected readonly offlineDocuments = computed(() => {
    const ids = this.offlineIds();
    return this.documents().filter((d) => ids.has(d.id));
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [ids, docs] = await Promise.all([
        this.offlineRepo.getOfflineIds(),
        this.docsRepo.getDocuments(),
      ]);
      this.offlineIds.set(ids);
      this.documents.set(docs);
    } catch (e) {
      this.error.set('Impossible de charger les documents hors-ligne.');
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

  protected async remove(doc: DocumentModel, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.offlineRepo.removeOffline(doc.id);
      const ids = new Set(this.offlineIds());
      ids.delete(doc.id);
      this.offlineIds.set(ids);
    } catch {
      // Silencieux.
    }
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
