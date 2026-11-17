import { metaDocument, noteDocument, DocumentsRepository } from '../../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { TraductionPipe, tr } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DocumentCard } from '../../../shared/ui/document-card/document-card';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { FavorisRepository } from '../../../core/bibliotheque';
import { DocumentModel, DocumentType } from '../../../core/bibliotheque';
import { Failure } from '../../../core/models';
import { AppRoutes } from '../../../core/router';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FavorisEtat } from '../../../shared/services/favoris-etat';

import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';

@Component({
  selector: 'nl-favoris',
  standalone: true,
  imports: [TypeDocumentPipe, CascadeEnter, TraductionPipe, CommonModule, DocumentCard, DocumentSkeleton, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favoris.html',
  styleUrl: './favoris.scss',
})
export class Favoris implements OnInit {
  private readonly router = inject(Router);
  private readonly favorisRepo = inject(FavorisRepository);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly favorisEtat = inject(FavorisEtat);
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);

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
    void this.router.navigate(['/app', AppRoutes.home]);
  }

  protected async openDocument(doc: DocumentModel): Promise<void> {
    try {
      if (typeof (this.docsRepo as { getDocumentDetails?: unknown }).getDocumentDetails === 'function') {
        const detail = await this.docsRepo.getDocumentDetails(doc.id);
        if (!detail) {
          await this.gererFavoriRetire(doc);
          return;
        }
      }
      void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
    } catch (e) {
      if (e instanceof Failure && e.statusCode === 404) {
        await this.gererFavoriRetire(doc);
        return;
      }
      void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
    }
  }

  private async gererFavoriRetire(doc: DocumentModel): Promise<void> {
    this.documents.update((liste) => liste.filter((d) => d.id !== doc.id));
    this.toast.info(tr('docPlusDisponible', 'Ce document n’est plus disponible.'));
    const retirer = await this.actions.confirmer({
      title: tr('docPlusDisponible', 'Ce document n’est plus disponible'),
      description: `« ${doc.titre} » a été retiré du catalogue. Veux-tu le retirer de tes favoris ?`,
      confirmLabel: tr('docRetirerFavoris', 'Retirer des favoris'),
      destructive: true,
    });
    if (retirer) {
      await this.favorisRepo.removeFavorite(doc.id).catch(() => undefined);
      void this.favorisEtat.charger();
    }
  }

  protected async remove(doc: DocumentModel, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.favorisRepo.removeFavorite(doc.id);
      this.documents.set(this.documents().filter((d) => d.id !== doc.id));
      void this.favorisEtat.charger();
    } catch {
      // Silencieux : on garde la liste telle quelle.
    }
  }




  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }
}
