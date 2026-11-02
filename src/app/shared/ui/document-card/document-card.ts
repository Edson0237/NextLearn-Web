import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FavorisEtat } from '../../services/favoris-etat';
import { Icon } from '../icon/icon';
import { IconName } from '../icon/icon-paths';
import { Badge } from '../badge/badge';
import { Pressable } from '../../directives/pressable';
import { TraductionPipe, tr } from '../../../core/i18n';

/** Une métadonnée de la ligne du bas - pages, poids, date, téléchargements. */
export interface MetaDocument {
  icon: IconName;
  label: string;
}

/** Une étiquette de la ligne du haut - matière, niveau, statut. */
export interface EtiquetteDocument {
  readonly texte: string;
  readonly ton?: 'neutre' | 'primaire' | 'cyan' | 'ambre' | 'emeraude';
  readonly icone?: IconName;
}

/**
 * Carte de document.
 *
 * ## Ce qui change
 *
 * L'ancienne carte posait un titre, une matière et trois métadonnées en
 * ligne. Elle n'était pas fausse, elle était plate : rien n'y accrochait
 * l'œil, et deux documents de nature très différente s'y ressemblaient.
 *
 * La carte reprend la structure de la référence, qui tient en quatre étages :
 *
 * 1. **la vignette de type** (40×40, fond teinté, icône de la couleur du
 *    type) - c'est elle qu'on balaie du regard pour trier une liste ;
 * 2. **la rangée d'étiquettes** - code de matière, niveau, statut ;
 * 3. **le titre et sa ligne d'auteur** ;
 * 4. **la rangée de métadonnées**, séparée par un filet, avec la note à
 *    droite et le bouton d'action.
 *
 * ## Ce qu'elle ne fait toujours pas
 *
 * Elle ne connaît aucun modèle de domaine. L'appelant lui donne des chaînes
 * déjà choisies - c'est lui qui sait qu'un nombre de pages à zéro veut dire
 * « non mesuré » et ne doit pas s'afficher.
 */
@Component({
  selector: 'nl-document-card',
  standalone: true,
  imports: [Icon, Badge, Pressable, TraductionPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-card.html',
  styleUrl: './document-card.scss',
  host: {
    '[class.nl-doc-card--compacte]': 'compacte()',
  },
})
export class DocumentCard {
  protected readonly favoris = inject(FavorisEtat);

  constructor() {
    // Sans effet réseau si la liste est déjà là ; hors session, l'échec est muet.
    void this.favoris.charger();
  }

  protected estFavori(): boolean {
    const id = this.documentId();
    return !!id && this.favoris.estFavori(id);
  }

  protected basculerFavori(evenement: Event): void {
    // La carte entière ouvre la fiche : le bouton ne doit pas la déclencher.
    evenement.stopPropagation();
    const id = this.documentId();
    if (id) void this.favoris.basculer(id);
  }

  readonly title = input.required<string>();
  readonly subject = input.required<string>();
  readonly typeLabel = input.required<string>();
  readonly typeIcon = input.required<IconName>();
  /** Valeur CSS : `var(--type-cours)`, un hex, etc. */
  readonly typeColor = input.required<string>();
  /** Fond de la vignette, assorti à `typeColor`. */
  readonly typeBackground = input<string>('var(--bg-secondary)');

  readonly auteur = input<string>();
  /** Complément d'identité : enseignant, année, source. */
  readonly annee = input<string>();
  readonly etiquettes = input<readonly EtiquetteDocument[]>([]);
  readonly meta = input<readonly MetaDocument[]>([]);
  readonly note = input<number>();
  readonly nombreAvis = input<number>();
  /**
   * L'identifiant de la ressource : quand il est fourni, la carte porte son
   * bouton favori, géré ici (état partagé `FavorisEtat`) - les écrans n'ont
   * rien à brancher.
   */
  readonly documentId = input<string>();

  /** Fraction lue, entre 0 et 1. Affiche une jauge sous la carte. */
  readonly progress = input<number>();
  readonly offline = input(false);
  /** Mise en page resserrée, pour une rangée de suggestions. */
  readonly compacte = input(false);
  /** Bouton d'action rapide à droite de la rangée de métadonnées. */
  readonly actionIcone = input<IconName>();
  readonly actionLibelle = input<string>('');
  /**
   * Vrai quand l'action retire quelque chose.
   *
   * Sans ce drapeau, « retirer du hors-ligne » portait le cobalt de l'action
   * principale, et le bouton était en tout point celui qui télécharge sur
   * l'écran d'à côté - deux gestes opposés sous le même rond bleu.
   */
  readonly actionDestructive = input(false);
  /**
   * Avancement du téléchargement que porte l'action : l'icône et le nom
   * accessible suivent ce que l'application sait réellement du fichier.
   */
  readonly actionEtat = input<'repos' | 'encours' | 'lance' | 'fait'>('repos');

  readonly activate = output<void>();
  readonly action = output<void>();

  /**
   * La ligne sous le titre : qui l'a produit, et quand.
   *
   * La matière n'y figure plus - elle est déjà la première étiquette, et la
   * répéter deux lignes plus bas faisait lire trois fois la même chose sur
   * une carte de six lignes.
   */
  protected sousTitre(): string {
    return [this.auteur(), this.annee()].filter(Boolean).join(' • ');
  }

  /** Ce qu'annonce un lecteur d'écran : une phrase, pas cinq annonces. */
  protected resume(): string {
    const morceaux = [this.typeLabel(), this.title(), this.subject()];
    if (this.offline()) morceaux.push('disponible hors ligne');
    return morceaux.join(', ');
  }

  protected noteAffichee(): string {
    const n = this.note();
    return n == null ? '' : n.toFixed(1);
  }

  protected iconeAction(): IconName {
    switch (this.actionEtat()) {
      case 'fait': return 'check_circle';
      case 'encours': return 'sync';
      case 'lance': return 'schedule';
      default: return this.actionIcone() ?? 'download';
    }
  }

  protected libelleAction(): string {
    switch (this.actionEtat()) {
      case 'fait': return tr('dlTelechargeCourt', 'Téléchargé');
      case 'encours': return tr('chargementEnCours', 'Chargement en cours');
      case 'lance': return tr('dlLanceCourt', 'Téléchargement lancé');
      default: return this.actionLibelle();
    }
  }

  protected declencherAction(evenement: Event): void {
    // Sans cela, le clic remonterait jusqu'à la carte et ouvrirait la fiche
    // au lieu de télécharger.
    evenement.stopPropagation();
    this.action.emit();
  }
}
