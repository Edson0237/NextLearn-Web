import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n/t.pipe';
import { Router } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { PageBar } from '../../../shared/ui/page-bar/page-bar';
import { AppRoutes } from '../../../core/router/app-routes';
import { VERSION_APP } from '../../../core/version';

interface Valeur {
  readonly icone: IconName;
  readonly titre: string;
  readonly corps: string;
  /** La teinte de la vignette, prise à la palette des types de document. */
  readonly teinte: string;
  readonly fond: string;
}

interface Membre {
  readonly nom: string;
  readonly initiales: string;
  readonly photo: string;
  readonly role: string;
  readonly competences: string;
}

interface Coordonnee {
  readonly icone: IconName;
  readonly libelle: string;
  readonly valeur: string;
  /** Un lien, quand la valeur s'ouvre ; sinon la ligne est une simple information. */
  readonly lien?: string;
}

/**
 * La page « À propos » - traduction d'`APropos`
 * (`lib/domains/legal/presentation/pages/a_propos_page.dart`).
 *
 * ## Ce qui était faux dans la version précédente
 *
 * Elle écrivait en dur, en français, des textes que l'application possède
 * déjà **traduits** (`aproposValeur*`, `aproposRole*`, `aproposCompetences*`) :
 * en anglais, la page restait donc à moitié française. Elle omettait aussi
 * trois sections que la version mobile porte - l'origine du projet, la
 * mission, l'avenir - et, surtout, deux mentions que les contrôles de
 * publication regardent de près :
 *
 *  - **l'éditeur**, tel que le nomment les conditions d'utilisation : une
 *    personne physique, pas une structure. Afficher un nom de collectif ici
 *    donnerait deux éditeurs différents dans la même application ;
 *  - **le contact légal**, l'adresse par laquelle s'exercent les droits
 *    d'accès et d'effacement - distincte de l'adresse générale, et celle que
 *    désigne la politique de confidentialité.
 */
@Component({
  selector: 'nl-a-propos',
  standalone: true,
  imports: [TraductionPipe, Icon, Avatar, PageBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './a-propos.html',
  styleUrl: './a-propos.scss',
})
export class APropos {
  private readonly router = inject(Router);

  protected readonly version = VERSION_APP;

  // Les teintes viennent des jetons de la charte (`--type-*`) : une valeur
  // n'a pas de couleur propre, elle emprunte celle d'un format de document,
  // ce qui garde la page dans le vocabulaire du reste de l'application.
  protected readonly valeurs: readonly Valeur[] = [
    {
      icone: 'cloud_download',
      titre: 'aproposValeurAccessibilite',
      corps: 'aproposValeurAccessibiliteCorps',
      teinte: 'var(--type-td)',
      fond: 'var(--type-td-soft)',
    },
    {
      icone: 'lightbulb',
      titre: 'aproposValeurInnovation',
      corps: 'aproposValeurInnovationCorps',
      teinte: 'var(--type-epreuve)',
      fond: 'var(--type-epreuve-soft)',
    },
    {
      icone: 'groups',
      titre: 'aproposValeurCommunaute',
      corps: 'aproposValeurCommunauteCorps',
      teinte: 'var(--type-synthese)',
      fond: 'var(--type-synthese-soft)',
    },
    {
      icone: 'verified',
      titre: 'aproposValeurExcellence',
      corps: 'aproposValeurExcellenceCorps',
      teinte: 'var(--type-corrige)',
      fond: 'var(--type-corrige-soft)',
    },
  ];

  // Des vignettes de 192 px, et non les portraits de la vitrine : l'un pèse
  // près de 500 Ko, pour un rond de 56 px affiché sur un réseau mobile.
  protected readonly equipe: readonly Membre[] = [
    {
      nom: 'Marvin Tientcheu',
      initiales: 'MT',
      photo: '/images/equipe/marvin.jpg',
      role: 'aproposRoleFondateur',
      competences: 'aproposCompetencesFondateur',
    },
    {
      nom: 'Giovanni Charles',
      initiales: 'GC',
      photo: '/images/equipe/giovanni.jpg',
      role: 'aproposRoleArchitecture',
      competences: 'aproposCompetencesArchitecture',
    },
    {
      nom: 'Mbouh Edson',
      initiales: 'ME',
      photo: '/images/equipe/edson.jpg',
      role: 'aproposRolePedagogie',
      competences: 'aproposCompetencesPedagogie',
    },
  ];

  // Les valeurs - adresses, nom de l'éditeur - ne se traduisent pas ; seuls
  // les libellés qui les désignent le sont.
  protected readonly coordonnees: readonly Coordonnee[] = [
    { icone: 'language', libelle: 'aproposLigneSite', valeur: 'nextlearn.cm', lien: 'https://nextlearn.cm' },
    {
      icone: 'mail',
      libelle: 'aproposLigneEmail',
      valeur: 'nextlearncm@gmail.com',
      lien: 'mailto:nextlearncm@gmail.com',
    },
    { icone: 'location_on', libelle: 'aproposLigneLieu', valeur: 'aproposLieuValeur' },
    { icone: 'person', libelle: 'aproposLigneEditeur', valeur: 'Tientcheu Siani Joel Marvin' },
    {
      icone: 'gavel',
      libelle: 'aproposLigneContactLegal',
      valeur: 'tientcheumarvin@gmail.com',
      lien: 'mailto:tientcheumarvin@gmail.com',
    },
  ];

  protected goBack(): void {
    void this.router.navigate(['/app', AppRoutes.profil]);
  }

  /** Les libellés de lieu sont des clés ; les autres valeurs sont littérales. */
  protected estCle(valeur: string): boolean {
    return valeur.startsWith('apropos');
  }
}
