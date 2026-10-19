import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DocumentCard } from '../../../shared/ui/document-card/document-card';
import { Icon } from '../../../shared/ui/icon/icon';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Button } from '../../../shared/ui/button/button';
import { DocumentsRepository } from '../../../core/bibliotheque/documents-repository';
import { ContexteService } from '../../../core/contexte/contexte.service';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../../core/bibliotheque/document.model';
import { AppRoutes } from '../../../core/router/app-routes';

@Component({
  selector: 'nl-bibliotheque-home',
  standalone: true,
  imports: [CommonModule, FormsModule, DocumentCard, Icon, EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bibliotheque-home.html',
  styleUrl: './bibliotheque-home.scss',
})
export class BibliothequeHome implements OnInit {
  private readonly router = inject(Router);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly contexte = inject(ContexteService);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documents = signal<DocumentModel[]>([]);
  protected readonly selectedType = signal<DocumentType | null>(null);
  protected readonly selectedMatiere = signal<string | null>(null);
  protected readonly searchActive = signal(false);
  protected readonly searchQuery = signal('');

  protected readonly tabs = [
    { type: null, label: 'Tous' },
    { type: DocumentType.cours, label: 'Cours' },
    { type: DocumentType.td, label: 'TD' },
    { type: DocumentType.synthese, label: 'Synthèse' },
    { type: DocumentType.epreuve, label: 'Épreuve' },
  ] as const;

  protected readonly filteredDocuments = signal<DocumentModel[]>([]);

  constructor() {
    effect(() => {
      const type = this.selectedType();
      const matiereId = this.selectedMatiere();
      const query = this.searchQuery().toLowerCase().trim();
      let list = this.documents();
      if (type) {
        list = list.filter((d) => d.type === type);
      }
      if (matiereId) {
        list = list.filter((d) => d.matiereId === matiereId);
      }
      if (query.length >= 2) {
        list = list.filter((d) => d.titre.toLowerCase().includes(query) || d.matiere.toLowerCase().includes(query));
      }
      this.filteredDocuments.set(list);
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const docs = await this.docsRepo.getDocuments();
      this.documents.set(docs);
    } catch (e) {
      this.error.set('Impossible de charger les documents.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectType(type: DocumentType | null): void {
    this.selectedType.set(type);
  }

  protected selectMatiere(id: string | null): void {
    this.selectedMatiere.set(id);
  }

  protected openSearch(): void {
    void this.router.navigate(['/', AppRoutes.recherche]);
  }

  protected openCatalogue(): void {
    void this.router.navigate(['/', AppRoutes.matieres]);
  }

  protected openFavoris(): void {
    void this.router.navigate(['/', AppRoutes.favoris]);
  }

  protected openOffline(): void {
    void this.router.navigate(['/', AppRoutes.offlineLibrary]);
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigate(['/', AppRoutes.documentDetail.replace(':id', doc.id)]);
  }

  protected matiereOptions(): { id: string; nom: string }[] {
    const map = new Map<string, string>();
    for (const d of this.documents()) {
      if (d.matiereId) map.set(d.matiereId, d.matiere);
    }
    return [...map.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom));
  }

  protected typeIcon(type: DocumentType | null): string {
    if (!type) return 'menu_book';
    switch (type) {
      case DocumentType.cours: return 'menu_book';
      case DocumentType.td: return 'edit_note';
      case DocumentType.synthese: return 'summarize';
      case DocumentType.epreuve: return 'assignment';
      default: return 'description';
    }
  }

  protected typeColor(type: DocumentType | null): string {
    return type ? couleurTypeDocument(type) : 'var(--primary)';
  }

  protected typeLabel(type: DocumentType | null): string {
    return type ? labelTypeDocument(type) : 'Document';
  }

  protected metaFor(doc: DocumentModel) {
    const meta = [];
    if (doc.enseignant) meta.push({ icon: 'person' as const, label: doc.enseignant });
    if (doc.pages > 0) meta.push({ icon: 'description' as const, label: `${doc.pages} p.` });
    if (doc.tailleMb > 0) meta.push({ icon: 'download' as const, label: `${doc.tailleMb.toFixed(1)} Mo` });
    return meta;
  }
}
