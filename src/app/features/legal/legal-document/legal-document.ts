import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';

type LegalDocKey = 'confidentialite' | 'conditions';

@Component({
  selector: 'nl-legal-document',
  standalone: true,
  imports: [CommonModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './legal-document.html',
  styleUrl: './legal-document.scss',
})
export class LegalDocument {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly doc = signal<LegalDocKey | null>(null);
  protected readonly title = signal('');

  constructor() {
    const key = (this.route.snapshot.paramMap.get('doc') ?? '') as LegalDocKey;
    this.doc.set(['confidentialite', 'conditions'].includes(key) ? key : null);
    this.title.set(key === 'confidentialite' ? 'Politique de confidentialité' : key === 'conditions' ? 'Conditions d\'utilisation' : 'Document légal');
  }

  protected goBack(): void {
    void this.router.navigate(['/', AppRoutes.profil]);
  }
}
