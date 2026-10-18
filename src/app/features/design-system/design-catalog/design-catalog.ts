import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Button } from '../../../shared/ui/button/button';
import { Card } from '../../../shared/ui/card/card';
import { Chip } from '../../../shared/ui/chip/chip';
import { Skeleton } from '../../../shared/ui/skeleton/skeleton';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Illustration } from '../../../shared/ui/illustration/illustration';
import { IconButton } from '../../../shared/ui/icon-button/icon-button';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { DocumentCard, MetaDocument } from '../../../shared/ui/document-card/document-card';
import { DocumentSkeleton } from '../../../shared/ui/document-skeleton/document-skeleton';
import { ReadingProgressBar } from '../../../shared/ui/progress-bar/progress-bar';
import { StreakBadge } from '../../../shared/ui/streak-badge/streak-badge';
import { OfflineBanner } from '../../../shared/ui/offline-banner/offline-banner';
import { AnimatedNumber } from '../../../shared/ui/animated-number/animated-number';
import { PinInput } from '../../../shared/ui/pin-input/pin-input';
import { Refreshable } from '../../../shared/ui/refreshable/refreshable';
import { ToastHost } from '../../../shared/ui/toast/toast-host';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FatalError } from '../../../shared/ui/fatal-error/fatal-error';
import { OfflineScreen } from '../../../shared/ui/offline-screen/offline-screen';
import { CascadeEnter } from '../../../shared/directives/cascade-enter';
import { FeuilleActionService } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { ThemeService } from '../../../shared/services/theme';

/**
 * Page de démonstration du design system — Phase 2, point 6 du portage.
 *
 * Sert à comparer visuellement, côte à côte avec l'application Flutter,
 * chaque jeton et chaque composant portés jusqu'ici (les 21 recensés en
 * Phase 1, voir PHASE2_STATUS.md). Route temporaire
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
  imports: [
    Button, Card, Chip, Skeleton, EmptyState, Icon, Illustration, IconButton,
    Avatar, DocumentCard, DocumentSkeleton, ReadingProgressBar, StreakBadge,
    OfflineBanner, AnimatedNumber, PinInput, Refreshable, ToastHost,
    FatalError, OfflineScreen, CascadeEnter,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './design-catalog.html',
  styleUrl: './design-catalog.scss',
})
export class DesignCatalog {
  private readonly toast = inject(ToastService);
  private readonly feuilleAction = inject(FeuilleActionService);
  private readonly feuilleSelection = inject(FeuilleSelectionService);
  protected readonly themeService = inject(ThemeService);

  protected readonly pin = signal('');
  protected readonly pinError = signal<string | undefined>(undefined);
  protected readonly compteur = signal(0);
  protected readonly rafraichissement = signal(false);
  protected readonly ecranVolet = signal<'catalogue' | 'erreur-fatale' | 'hors-ligne'>('catalogue');

  protected readonly iconesDemo: readonly IconName[] = [
    'arrow_back', 'close', 'check', 'search', 'refresh', 'cloud_done',
    'fingerprint', 'backspace', 'menu_book', 'science',
  ];

  protected readonly metaDemo: MetaDocument[] = [
    { icon: 'person', label: 'Dr. Mballa' },
    { icon: 'description', label: '24 pages' },
    { icon: 'cloud', label: '2.4 Mo' },
  ];

  protected attributTheme(): string | null {
    return this.themeService.attribute();
  }

  protected choisirTheme(mode: 'light' | 'dark' | 'system'): void {
    this.themeService.set(mode);
  }

  protected surChiffre(d: string): void {
    this.pin.set((this.pin() + d).slice(0, 4));
    this.pinError.set(undefined);
  }

  protected surEffacement(): void {
    this.pin.set(this.pin().slice(0, -1));
  }

  protected relancerCompteur(): void {
    this.compteur.set(this.compteur() === 0 ? 1280 : 0);
  }

  protected surRafraichissement(): void {
    this.rafraichissement.set(true);
    setTimeout(() => {
      this.rafraichissement.set(false);
      this.toast.succes('Liste mise à jour');
    }, 1200);
  }

  protected async ouvrirConfirmation(): Promise<void> {
    const confirme = await this.feuilleAction.confirmer({
      title: 'Supprimer ce document ?',
      description: 'Cette action est définitive et ne peut pas être annulée.',
      confirmLabel: 'Supprimer',
      destructive: true,
      icon: 'error',
    });
    this.toast[confirme ? 'succes' : 'info'](confirme ? 'Document supprimé' : 'Annulé');
  }

  protected async ouvrirListeActions(): Promise<void> {
    const valeur = await this.feuilleAction.choisir<string>({
      title: 'Partager',
      options: [
        { label: 'Copier le lien', value: 'copier', icon: 'description' },
        { label: 'Signaler', value: 'signaler', icon: 'error', destructive: true },
      ],
    });
    if (valeur) this.toast.info(`Choisi : ${valeur}`);
  }

  protected async ouvrirSelection(): Promise<void> {
    const valeur = await this.feuilleSelection.ouvrir<string>({
      title: 'Choisir une filière',
      currentValue: 'isi',
      choices: [
        { value: 'isi', label: 'Ingénierie des systèmes informatiques' },
        { value: 'gc', label: 'Génie civil' },
        { value: 'gm', label: 'Génie mécanique' },
        { value: 'gi', label: 'Génie informatique' },
        { value: 'rt', label: 'Réseaux et télécommunications' },
        { value: 'ee', label: 'Électricité et électronique' },
        { value: 'bio', label: 'Génie biomédical' },
        { value: 'agro', label: 'Agro-industrie' },
        { value: 'mines', label: 'Mines et géologie' },
      ],
    });
    if (valeur) this.toast.info(`Filière choisie : ${valeur}`);
  }
}
