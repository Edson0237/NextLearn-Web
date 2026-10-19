import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocumentCard } from '../../../shared/ui/document-card/document-card';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { FavorisRepository } from '../../../core/bibliotheque/favoris-repository';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-favoris',
  standalone: true,
  imports: [CommonModule, DocumentCard, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favoris.html',
  styleUrl: './favoris.scss',
})
export class Favoris implements OnInit {
  private readonly router = inject(Router);
  private readonly favorisRepo = inject(FavorisRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.favorisRepo.getFavorites();
      this.documents.set(docs);
    } catch (e) {
      this.error.set('Impossible de charger les favoris.');
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
      await this.favorisRepo.removeFavorite(doc.id);
      this.documents.set(this.documents().filter((d) => d.id !== doc.id));
    } catch {
      // Silencieux : on garde la liste telle quelle.
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
