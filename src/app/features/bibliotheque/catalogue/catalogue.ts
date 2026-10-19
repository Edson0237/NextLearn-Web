import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { ContexteService } from '../../../core/contexte/contexte.service';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-catalogue',
  standalone: true,
  imports: [CommonModule, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalogue.html',
  styleUrl: './catalogue.scss',
})
export class Catalogue implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly propres = signal<{ id: string; nom: string; couleur: string; count: number }[]>([]);
  protected readonly communes = signal<{ id: string; nom: string; couleur: string; count: number }[]>([]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.docsRepo.getDocuments();
      this.documents.set(docs);
      this.groupMatieres(docs);
    } catch (e) {
      this.error.set('Impossible de charger le catalogue.');
    } finally {
      this.loading.set(false);
    }
  }

  private groupMatieres(docs: DocumentModel[]): void {
    const contexteMatieres = this.contexte.matieres();
    const parId = new Map<string, { id: string; nom: string; couleur: string; count: number; troncCommun: boolean }>();

    if (contexteMatieres.length > 0) {
      for (const m of contexteMatieres) {
        parId.set(m.id, { id: m.id, nom: m.nom, couleur: m.couleur, count: 0, troncCommun: m.troncCommun });
      }
    }

    for (const d of docs) {
      if (!d.matiereId) continue;
      if (parId.has(d.matiereId)) {
        const existing = parId.get(d.matiereId)!;
        existing.count++;
      } else {
        parId.set(d.matiereId, { id: d.matiereId, nom: d.matiere, couleur: '#4F8EF7', count: 1, troncCommun: false });
      }
    }

    const all = [...parId.values()].sort((a, b) => a.nom.localeCompare(b.nom));
    this.propres.set(all.filter((m) => !m.troncCommun));
    this.communes.set(all.filter((m) => m.troncCommun));
  }

  protected openMatiere(id: string): void {
    void this.router.navigate(['/', AppRoutes.matiere.replace(':id', id)]);
  }

  protected openBibliotheque(): void {
    void this.router.navigate(['/', AppRoutes.bibliotheque]);
  }

  protected openSearch(): void {
    void this.router.navigate(['/', AppRoutes.recherche]);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/', AppRoutes.favoris]);
  }

  protected openOffline(): void {
    void this.router.navigate(['/', AppRoutes.offlineLibrary]);
  }
}
