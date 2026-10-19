import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentsRepository } from '../../core/bibliotheque/documents-repository';
import { ProfilRepository } from '../../core/profil/profil-repository';
import { DocumentModel, DocumentType, labelTypeDocument, couleurTypeDocument } from '../../core/bibliotheque/document.model';
import { UserModel, libelleNiveau } from '../../core/models/user.model';
import { DocumentCard } from '../../shared/ui/document-card/document-card';
import { Icon } from '../../shared/ui/icon/icon';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { Button } from '../../shared/ui/button/button';
import { AnimatedNumber } from '../../shared/ui/animated-number/animated-number';
import { AppRoutes } from '../../core/router/app-routes';

@Component({
  selector: 'nl-home',
  standalone: true,
  imports: [CommonModule, DocumentCard, Icon, EmptyState, Button, AnimatedNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly docsRepo = inject(DocumentsRepository);
  private readonly profilRepo = inject(ProfilRepository);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly recommended = signal<DocumentModel[]>([]);
  protected readonly popular = signal<DocumentModel[]>([]);
  protected readonly recent = signal<DocumentModel[]>([]);
  protected readonly streak = signal(0);

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly subtitle = computed(() => {
    const u = this.user();
    if (!u) return 'Bienvenue sur NextLearn';
    return [libelleNiveau(u.niveau, u.cycle), u.filiere].filter(Boolean).join(' · ');
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [rec, pop, recents, stats] = await Promise.all([
        this.docsRepo.getRecommended(),
        this.docsRepo.getPopular(),
        this.docsRepo.getRecent(),
        this.profilRepo.getStats().catch(() => null),
      ]);
      this.recommended.set(rec);
      this.popular.set(pop);
      this.recent.set(recents);
      this.streak.set(stats?.streak ?? 0);
    } catch (e) {
      this.error.set('Impossible de charger l\'accueil.');
    } finally {
      this.loading.set(false);
    }
  }

  protected openDocument(doc: DocumentModel): void {
    void this.router.navigate(['/', AppRoutes.documentDetail.replace(':id', doc.id)]);
  }

  protected openBibliotheque(type?: DocumentType): void {
    void this.router.navigate(['/', AppRoutes.bibliotheque], { state: { type } });
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

  protected openDepot(): void {
    void this.router.navigate(['/', AppRoutes.depotForm]);
  }

  protected openNotifications(): void {
    void this.router.navigate(['/', AppRoutes.notifications]);
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
