import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icon-paths';
import { Chip } from '../chip/chip';
import { ReadingProgressBar } from '../progress-bar/progress-bar';
import { Pressable } from '../../directives/pressable';

/** Une métadonnée affichée sur la carte — enseignant, pages, poids. */
export interface MetaDocument {
  icon: IconName;
  label: string;
}

/**
 * Carte de document — traduction de `DocumentCard`
 * (`lib/shared/widgets/document_card.dart`).
 *
 * Domaine-agnostique, comme `Card`/`Chip` avant elle : aucun `DocumentModel`
 * importé. L'appelant (Phase 4, quand le vrai modèle existera) fournit le
 * titre, la matière, la couleur/icône du type et les métadonnées déjà
 * filtrées — c'est lui qui sait qu'un champ à zéro veut dire « non mesuré »
 * et ne doit pas apparaître, pas ce composant.
 *
 * Non porté ici : le `Hero` (survol animé entre la carte et sa fiche,
 * `avecHero`/`etiquetteHeroDocument`). La View Transitions API en est
 * l'équivalent web le plus proche, mais elle se pose au niveau du routeur
 * — Phase 3/4, pas Phase 2.
 */
@Component({
  selector: 'nl-document-card',
  standalone: true,
  imports: [Icon, Chip, ReadingProgressBar, Pressable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-card.html',
  styleUrl: './document-card.scss',
  host: {
    '[class.nl-doc-card--horizontal]': 'horizontal()',
  },
})
export class DocumentCard {
  readonly title = input.required<string>();
  readonly subject = input.required<string>();
  readonly typeLabel = input.required<string>();
  readonly typeIcon = input.required<IconName>();
  /** Valeur CSS : `var(--type-cours)`, un hex, etc. */
  readonly typeColor = input.required<string>();
  readonly meta = input<readonly MetaDocument[]>([]);
  readonly progress = input<number>();
  readonly offline = input(false);
  readonly horizontal = input(false);

  readonly activate = output<void>();

  /** Ce qu'annonce un lecteur d'écran à la place de la carte — une seule
   * phrase plutôt que cinq annonces successives. */
  protected resume(): string {
    const morceaux = [this.typeLabel(), this.title(), this.subject()];
    if (this.offline()) morceaux.push('disponible hors ligne');
    return morceaux.join(', ');
  }
}
