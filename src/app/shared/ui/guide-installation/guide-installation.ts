import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { CasInstallation, casInstallation, navigateursProposes } from '../../../core/pwa';
import { Environnement, Navigateur, Systeme } from '../../../core/pwa';
import { InstallationService } from '../../../core/pwa';
import { Icon } from '../icon/icon';
import { PROCEDURES } from './etapes';

/** Un choix du sélecteur manuel : le système, avec sa clé de traduction. */
interface ChoixSysteme {
  readonly valeur: Systeme;
  readonly libelle: string;
}

const SYSTEMES: readonly ChoixSysteme[] = [
  { valeur: 'ios', libelle: 'installSysIphone' },
  { valeur: 'ipados', libelle: 'installSysIpad' },
  { valeur: 'android', libelle: 'installSysAndroid' },
  { valeur: 'windows', libelle: 'installSysWindows' },
  { valeur: 'macos', libelle: 'installSysMac' },
  { valeur: 'linux', libelle: 'installSysLinux' },
];

const LIBELLES_NAVIGATEUR: Record<Navigateur, string> = {
  chrome: 'installNavChrome',
  edge: 'installNavEdge',
  safari: 'installNavSafari',
  firefox: 'installNavFirefox',
  samsung: 'installNavSamsung',
  opera: 'installNavOpera',
  chromium: 'installNavChromium',
  inconnu: 'installNavAutre',
};

const LIBELLES_SYSTEME: Record<Systeme, string> = {
  android: 'installSysAndroid',
  ios: 'installSysIphone',
  ipados: 'installSysIpad',
  windows: 'installSysWindows',
  macos: 'installSysMac',
  linux: 'installSysLinux',
  chromeos: 'installSysChromeos',
  inconnu: 'installSysInconnu',
};

/**
 * Le guide d'installation : détecte l'appareil, propose le bouton natif quand
 * le navigateur en fournit un, sinon explique le geste.
 *
 * Il ne tient aucune logique d'installation : il lit `InstallationService`
 * (l'unique mécanisme) et traduit son état en écran. Il sert de page dans les
 * Réglages, de panneau depuis le bandeau et de bloc sur la page d'accueil
 * publique ; d'où l'absence de barre de titre ou de marge propre.
 *
 * Le bouton natif n'est offert que si l'environnement choisi est celui qu'on
 * a détecté : l'invitation du navigateur installe *cet* appareil, elle ne
 * peut pas installer un autre téléphone dont l'utilisateur consulterait le
 * mode d'emploi.
 */
@Component({
  selector: 'nl-guide-installation',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guide-installation.html',
  styleUrl: './guide-installation.scss',
})
export class GuideInstallation {
  protected readonly installation = inject(InstallationService);

  protected readonly systemes = SYSTEMES;

  /** Le choix manuel de l'utilisateur ; `null` tant qu'il se fie à la détection. */
  private readonly manuel = signal<Pick<Environnement, 'systeme' | 'navigateur'> | null>(null);
  protected readonly selecteurOuvert = signal(false);

  private readonly detecte = this.installation.environnement;

  protected readonly choisi = computed(() => this.manuel() ?? this.detecte());

  protected readonly cas = computed<CasInstallation>(() => casInstallation(this.choisi()));
  protected readonly procedure = computed(() => PROCEDURES[this.cas()]);

  /** La détection a reconnu au moins le système. */
  protected readonly reconnu = computed(() => this.detecte().systeme !== 'inconnu');

  protected readonly modifie = computed(() => this.manuel() !== null);

  /** Le bouton natif ne vaut que pour l'appareil sur lequel on est réellement. */
  protected readonly boutonNatif = computed(
    () => this.installation.invitationDisponible() && !this.modifie(),
  );

  protected readonly navigateursChoisis = computed(() => navigateursProposes(this.choisi().systeme));

  protected libelleSysteme(s: Systeme): string {
    return LIBELLES_SYSTEME[s];
  }

  protected libelleNavigateur(n: Navigateur): string {
    return LIBELLES_NAVIGATEUR[n];
  }

  protected choisirSysteme(systeme: Systeme): void {
    this.manuel.set({ systeme, navigateur: navigateursProposes(systeme)[0] });
  }

  protected choisirNavigateur(navigateur: Navigateur): void {
    this.manuel.set({ systeme: this.choisi().systeme, navigateur });
  }

  protected reinitialiser(): void {
    this.manuel.set(null);
  }

  protected basculerSelecteur(): void {
    this.selecteurOuvert.update((v) => !v);
  }

  protected async installer(): Promise<void> {
    await this.installation.proposer();
  }
}
