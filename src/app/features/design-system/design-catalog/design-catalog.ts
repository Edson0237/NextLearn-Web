import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Button } from '../../../shared/ui/button/button';
import { Card } from '../../../shared/ui/card/card';
import { Chip } from '../../../shared/ui/chip/chip';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';

type Theme = 'light' | 'dark' | 'system';

/**
 * Page de démonstration du design system — Phase 2, point 6 du portage.
 *
 * Sert à comparer visuellement, côte à côte avec l'application Flutter,
 * chaque jeton et chaque composant déjà portés. Route temporaire
 * (`/app/design-system`) : elle ne survit pas au-delà de la Phase 4, où
 * les vrais écrans prennent sa place.
 *
 * Seul point d'entrée des styles d'application pour l'instant — c'est ici,
 * et nulle part ailleurs, que `.nl-app` reçoit ses jetons (voir
 * `design-catalog.scss`). La Phase 3 déplacera cette responsabilité vers la
 * coque applicative une fois qu'elle existera.
 */
@Component({
  selector: 'app-design-catalog',
  standalone: true,
  imports: [Button, Card, Chip, Skeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './design-catalog.html',
  styleUrl: './design-catalog.scss',
})
export class DesignCatalog {
  protected readonly theme = signal<Theme>('system');

  protected choisirTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  protected attributTheme(): string | null {
    return this.theme() === 'system' ? null : this.theme();
  }
}
