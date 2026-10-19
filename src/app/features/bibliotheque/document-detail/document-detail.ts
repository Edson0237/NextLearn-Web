import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-document-detail',
  standalone: true,
  imports: [CommonModule, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-detail.html',
  styleUrl: './document-detail.scss',
})
export class DocumentDetail implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly document = signal<DocumentModel | null>(null);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    await this.load(id);
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const doc = await this.docsRepo.getById(id);
      this.document.set(doc);
      if (doc) void this.docsRepo.recordView(doc.id);
    } catch (e) {
      this.error.set('Impossible de charger ce document.');
    } finally {
      this.loading.set(false);
    }
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.bibliotheque]);
  }

  protected async openDocument(): Promise<void> {
    const doc = this.document();
    if (!doc) return;
    const url = await this.docsRepo.urlLecture(doc.id);
    const finalUrl = url || doc.urlPdf;
    if (finalUrl) {
      window.open(finalUrl, '_blank');
      void this.docsRepo.recordDownload(doc.id);
    }
  }

  protected share(): void {
    const doc = this.document();
    if (!doc) return;
    if (navigator.share) {
      void navigator.share({ title: doc.titre, text: doc.description, url: window.location.href });
    } else {
      void navigator.clipboard.writeText(window.location.href);
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
}
