import { Fraicheur } from '../../../shared/services/fraicheur';
import { metaDocument, noteDocument } from '../../../core/bibliotheque';
import { ChangeDetectionStrategy, Component, effect, untracked, computed, inject, OnInit, signal } from '@angular/core';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { TraductionPipe } from '../../../core/i18n';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { DocumentCard } from '../../../shared/ui/document-card/document-card';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque';
import { ContexteService } from '../../../core/contexte';
import { DocumentModel, DocumentType } from '../../../core/bibliotheque';
import { AppRoutes } from '../../../core/router';
import { TypeDocumentPipe } from '../../../shared/ui/type-document/presentation-type-document';

import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';

@Component({
  selector: 'nl-matiere',
  standalone: true,
  imports: [TypeDocumentPipe, CascadeEnter, TraductionPipe, CommonModule, DocumentCard, DocumentSkeleton, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matiere.html',
  styleUrl: './matiere.scss',
})
export class Matiere implements OnInit {
  private readonly fraicheur = inject(Fraicheur);
  private premierTick = true;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly matiereId = signal<string>('');
  protected readonly matiereNom = signal<string>('Matière');

  protected readonly filtered = computed(() => {
    const id = this.matiereId();
    return this.documents().filter((d) => d.matiereId === id);
  });

  constructor() {
    // Relecture silencieuse quand l'application revient, que la connexion revient, ou toutes les cinq minutes.
    effect(() => {
      this.fraicheur.tick();
      untracked(() => {
        if (this.premierTick) { this.premierTick = false; return; }
        void this.load(true);
      });
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.matiereId.set(id);
    const ctxMatiere = this.contexte.matieres().find((m) => m.id === id);
    this.matiereNom.set(ctxMatiere?.nom ?? 'Matière');
    await this.load();
  }

  async load(silencieux = false): Promise<void> {
    if (!silencieux) {
      this.loading.set(true);
      this.error.set(null);
    }
    try {
      const page = await this.docsRepo.getDocuments({ matiereId: this.matiereId() }, undefined, 50);
      this.documents.set([...page.items]);
      const first = page.items.find((d) => d.matiereId === this.matiereId());
      if (first) this.matiereNom.set(first.matiere);
    } catch (e) {
      if (silencieux) return; // une erreur passagère ne remplace pas ce qui est affiché
      this.error.set('Impossible de charger les documents.');
    } finally {
      this.loading.set(false);
    }
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.docDetailPath(doc.id));
  }

  protected goBack(): void {
    void this.router.navigateByUrl('/app/' + AppRoutes.matieres);
  }




  protected metaFor(doc: DocumentModel) {
    return metaDocument(doc);
  }

  protected noteFor(doc: DocumentModel): number | undefined {
    return noteDocument(doc);
  }
}
