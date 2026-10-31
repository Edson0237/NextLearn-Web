import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TraductionPipe } from '../../core/i18n/t.pipe';
import { InstallationService } from '../../core/pwa/installation.service';
import { GuideInstallation } from '../../shared/ui/guide-installation/guide-installation';
import { Icon } from '../../shared/ui/icon/icon';
import { IconName } from '../../shared/ui/icon/icon-paths';

/** Une carte « pourquoi NextLearn ». */
interface Atout {
  readonly icone: IconName;
  readonly titre: string;
  readonly texte: string;
}

/** Une étape du « comment ça marche ». */
interface Etape {
  readonly titre: string;
  readonly texte: string;
}

/**
 * La page d'accueil publique : un seul but, mener le visiteur dans la PWA.
 *
 * NextLearn n'est sur aucun magasin d'applications - l'application *est* ce
 * site. La page ne propose donc pas de « télécharger » : un grand bouton
 * ouvre l'application (`/app`), et, quand le navigateur sait installer la PWA,
 * un second la pose sur l'écran d'accueil. Tout le reste (trois atouts, trois
 * étapes) n'est là que pour lever le doute avant ce clic, pas pour retenir.
 *
 * Elle ne charge aucune ressource externe : ni police ni feuille d'icônes
 * tierces - la police est auto-hébergée, les icônes sont celles de
 * l'application. Une page publique ne doit pas faire fuiter l'adresse IP du
 * visiteur vers un CDN que la politique de confidentialité ne mentionne pas.
 */
@Component({
  selector: 'app-vitrine',
  standalone: true,
  imports: [RouterLink, Icon, TraductionPipe, GuideInstallation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'nl-overlay' },
  templateUrl: './vitrine.html',
  styleUrl: './vitrine.scss',
})
export class Vitrine implements OnInit {
  private readonly router = inject(Router);
  protected readonly installation = inject(InstallationService);

  /** Le guide d'installation, ouvert quand le navigateur n'a pas d'invitation native à déclencher. */
  protected readonly guideOuvert = signal(false);

  /**
   * « Comment ça marche » et l'appel final sont écrits mais masqués pour l'instant.
   * Passer à `true` suffit à les rendre ; rien d'autre à rétablir.
   */
  protected readonly sectionsFinalesVisibles = false;

  /** « Pourquoi choisir NextLearn ? » : écrite, masquée pour l'instant, rendue en passant à `true`. */
  protected readonly atoutsVisibles = false;

  protected readonly annee = new Date().getFullYear();

  protected readonly atouts: readonly Atout[] = [
    { icone: 'menu_book', titre: 'vitrineAtout1Titre', texte: 'vitrineAtout1Texte' },
    { icone: 'cloud_off', titre: 'vitrineAtout2Titre', texte: 'vitrineAtout2Texte' },
    { icone: 'verified', titre: 'vitrineAtout3Titre', texte: 'vitrineAtout3Texte' },
  ];

  protected readonly etapes: readonly Etape[] = [
    { titre: 'vitrineEtape1Titre', texte: 'vitrineEtape1Texte' },
    { titre: 'vitrineEtape2Titre', texte: 'vitrineEtape2Texte' },
    { titre: 'vitrineEtape3Titre', texte: 'vitrineEtape3Texte' },
  ];

  ngOnInit(): void {
    // L'application déjà installée s'ouvre sur `/app` (voir `start_url`) ; ce
    // n'est qu'un filet pour qui atterrirait ici depuis l'icône d'un ancien
    // raccourci : pas de page de présentation devant quelqu'un qui l'a déjà.
    if (this.installation.dejaInstallee()) {
      void this.router.navigateByUrl('/app', { replaceUrl: true });
    }
  }

  /** Installer : l'invitation native quand elle existe, sinon le guide qui explique le geste. */
  protected async installer(): Promise<void> {
    if (this.installation.invitationDisponible()) {
      await this.installation.proposer();
    } else {
      this.guideOuvert.update((ouvert) => !ouvert);
    }
  }
}
