import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService, ThemeMode } from '../../../shared/services/theme';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService, ActionOption } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService, ChoixSelection } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { SupportRepository } from '../../../core/profil/support-repository';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';
import { Failure } from '../../../core/models/failure.model';

interface LigneReglage {
  readonly icone: string;
  readonly titre: string;
  readonly sousTitre: string;
  readonly valeur?: string;
  readonly destructive?: boolean;
  readonly action: () => void;
}

interface GroupeReglages {
  readonly titre: string;
  readonly lignes: readonly LigneReglage[];
}

/**
 * Liste unique des réglages — utilisée à la fois dans l'onglet Profil
 * (sous l'en-tête) et dans l'écran Paramètres dédié. Traduction de
 * `ListeReglages` (`parametres_page.dart`).
 */
@Component({
  selector: 'app-settings-list',
  standalone: true,
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-list.html',
  styleUrl: './settings-list.scss',
})
export class SettingsList {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);
  private readonly selections = inject(FeuilleSelectionService);
  private readonly support = inject(SupportRepository);

  readonly inline = input(false);

  protected readonly categoriesSupport = [
    { value: 'CONNEXION', label: 'Connexion' },
    { value: 'DOCUMENT', label: 'Document' },
    { value: 'COMPTE', label: 'Compte' },
    { value: 'BUG', label: 'Bug' },
    { value: 'AUTRE', label: 'Autre' },
  ];

  protected readonly user = computed(() => this.auth.state().user);
  protected readonly themeLabel = computed(() => {
    const m = this.theme.mode();
    if (m === 'light') return 'Clair';
    if (m === 'dark') return 'Sombre';
    return 'Système';
  });

  protected readonly modalPinVisible = signal(false);
  protected readonly pinAncien = signal('');
  protected readonly pinNouveau = signal('');
  protected readonly pinConfirmation = signal('');
  protected readonly pinErreur = signal<string | undefined>(undefined);
  protected readonly pinEnvoi = signal(false);

  protected readonly modalSupportVisible = signal(false);
  protected readonly supportCategorie = signal('CONNEXION');
  protected readonly supportSujet = signal('');
  protected readonly supportMessage = signal('');
  protected readonly supportEnvoi = signal(false);

  protected readonly groupes = computed<GroupeReglages[]>(() => {
    const u = this.user();
    return [
      {
        titre: 'Compte',
        lignes: [
          {
            icone: 'alternate_email', titre: 'E-mail', sousTitre: 'Rattachée à ton école',
            valeur: u?.email, action: () => void 0,
          },
          {
            icone: 'school', titre: 'Niveau', sousTitre: 'Ta promotion actuelle',
            valeur: u ? this.libelleNiveau(u.niveau, u.cycle) : undefined,
            action: () => void this.choisirNiveau(),
          },
          {
            icone: 'lock', titre: 'Code PIN', sousTitre: 'Changer le code de déverrouillage',
            action: () => this.ouvrirPinChange(),
          },
          {
            icone: 'devices', titre: 'Appareils connectés', sousTitre: 'Gérer tes sessions actives',
            action: () => void this.router.navigate(['/app', AppRoutes.sessions]),
          },
          {
            icone: 'delete_forever', titre: 'Supprimer mon compte', sousTitre: 'Action irréversible',
            destructive: true,
            action: () => void this.router.navigate(['/app', AppRoutes.deleteAccount]),
          },
        ],
      },
      {
        titre: 'Apparence',
        lignes: [
          {
            icone: 'settings', titre: 'Thème', sousTitre: 'Clair, sombre ou suivi du système',
            valeur: this.themeLabel(), action: () => void this.choisirTheme(),
          },
          {
            icone: 'language', titre: 'Langue', sousTitre: 'Français',
            valeur: 'Français', action: () => this.toast.info('Langue : bientôt disponible.'),
          },
        ],
      },
      {
        titre: 'Notifications',
        lignes: [
          {
            icone: 'notifications', titre: 'Notifications actives', sousTitre: 'Activer les alertes',
            action: () => this.toast.info('Notifications : bientôt disponibles.'),
          },
        ],
      },
      {
        titre: 'Hors ligne',
        lignes: [
          {
            icone: 'storage', titre: 'Documents hors ligne', sousTitre: 'Ceux téléchargés sur l\'appareil',
            valeur: '0 fichier', action: () => void this.router.navigate(['/app', AppRoutes.offlineLibrary]),
          },
          {
            icone: 'delete_sweep', titre: 'Vider le cache', sousTitre: 'Effacer les données temporaires',
            destructive: true,
            action: () => void this.viderCache(),
          },
        ],
      },
      {
        titre: 'Accessibilité',
        lignes: [
          {
            icone: 'animation', titre: 'Réduire les animations', sousTitre: 'Moins de mouvement à l\'écran',
            valeur: 'Suivre le système', action: () => this.toast.info('Réglage d\'accessibilité : bientôt.'),
          },
          {
            icone: 'format_size', titre: 'Taille du texte', sousTitre: 'Normale, grande ou très grande',
            valeur: 'Normale', action: () => this.toast.info('Taille du texte : bientôt.'),
          },
        ],
      },
      {
        titre: 'Aide et recours',
        lignes: [
          {
            icone: 'support_agent', titre: 'Signaler un problème', sousTitre: 'Ouvrir un ticket auprès de l\'équipe',
            action: () => this.ouvrirSupport(),
          },
          {
            icone: 'balance', titre: 'Contester une décision', sousTitre: 'Recours sur un refus de document',
            action: () => void this.router.navigate(['/app', AppRoutes.recours]),
          },
          {
            icone: 'list_alt', titre: 'Mes signalements', sousTitre: 'Historique de tes demandes',
            action: () => void this.router.navigate(['/app', AppRoutes.supportTickets]),
          },
        ],
      },
      {
        titre: 'À propos',
        lignes: [
          {
            icone: 'info', titre: 'À propos', sousTitre: 'Version et informations',
            valeur: '1.0.0', action: () => void this.router.navigate(['/app', AppRoutes.aPropos]),
          },
          {
            icone: 'privacy_tip', titre: 'Confidentialité', sousTitre: 'Politique de confidentialité',
            action: () => window.open('/confidentialite/', '_blank'),
          },
          {
            icone: 'gavel', titre: 'Conditions', sousTitre: 'Conditions d\'utilisation',
            action: () => window.open('/conditions/', '_blank'),
          },
        ],
      },
      {
        titre: 'Session',
        lignes: [
          {
            icone: 'logout', titre: 'Déconnexion', sousTitre: 'Quitter ce compte sur cet appareil',
            destructive: true, action: () => void this.deconnecter(),
          },
        ],
      },
    ];
  });

  private libelleNiveau(niveau: string, cycle?: string): string {
    const rang = { n1: 1, n2: 2, n3: 3, n4: 4, n5: 5 }[niveau] ?? 0;
    if (!rang) return niveau.toUpperCase();
    switch (cycle) {
      case 'master': return `Master ${rang - 3}`;
      case 'licencePro': return `Licence Pro ${rang}`;
      case 'licence': return `Licence ${rang}`;
      case 'ingenieur': return `Ingénieur ${rang}`;
      case 'prepa': return `Prépa ${rang}`;
      default: return `Niveau ${rang}`;
    }
  }

  protected async choisirNiveau(): Promise<void> {
    const disponibles = await this.auth.niveauxDuCycle();
    if (disponibles.niveaux.length <= 1) {
      this.toast.info('Aucun autre niveau disponible pour ton école.');
      return;
    }
    const actuel = this.user()?.niveau;
    const choices: ChoixSelection<string>[] = disponibles.niveaux.map((n) => ({
      value: n.code,
      label: n.label,
      description: n.code === actuel ? 'Niveau actuel' : undefined,
    }));
    const choisi = await this.selections.ouvrir<string>({
      title: 'Changer de niveau',
      choices,
      currentValue: actuel,
    });
    if (!choisi || choisi === actuel) return;
    const erreur = await this.auth.changerNiveau(choisi);
    if (!erreur) this.toast.succes('Niveau enregistré.');
  }

  private async choisirTheme(): Promise<void> {
    const choisi = await this.selections.ouvrir<ThemeMode>({
      title: 'Thème',
      choices: [
        { value: 'system', label: 'Système' },
        { value: 'light', label: 'Clair' },
        { value: 'dark', label: 'Sombre' },
      ],
      currentValue: this.theme.mode(),
    });
    if (choisi) this.theme.set(choisi);
  }

  private ouvrirPinChange(): void {
    this.pinAncien.set('');
    this.pinNouveau.set('');
    this.pinConfirmation.set('');
    this.pinErreur.set(undefined);
    this.pinEnvoi.set(false);
    this.modalPinVisible.set(true);
  }

  protected fermerPinChange(): void {
    this.modalPinVisible.set(false);
  }

  protected async validerPinChange(): Promise<void> {
    const ancien = this.pinAncien().trim();
    const nouveau = this.pinNouveau().trim();
    const confirmation = this.pinConfirmation().trim();

    let erreur: string | undefined;
    if (ancien.length !== 4) erreur = 'Saisis ton code actuel à 4 chiffres.';
    else if (nouveau.length !== 4 || !/^\d{4}$/.test(nouveau)) erreur = 'Le nouveau code doit comporter 4 chiffres.';
    else if (nouveau !== confirmation) erreur = 'Les codes ne correspondent pas.';
    else if (nouveau === ancien) erreur = 'Le nouveau code doit être différent de l\'ancien.';

    if (erreur) {
      this.pinErreur.set(erreur);
      return;
    }

    this.pinEnvoi.set(true);
    const fermees = await this.auth.changerPin(ancien, nouveau);
    this.pinEnvoi.set(false);
    if (fermees === null) {
      this.pinErreur.set(this.auth.state().error ?? 'Changement impossible.');
      return;
    }
    this.modalPinVisible.set(false);
    this.toast.succes(fermees > 0 ? `Code modifié. ${fermees} appareil(s) déconnecté(s).` : 'Code modifié.');
  }

  private ouvrirSupport(): void {
    this.supportCategorie.set('CONNEXION');
    this.supportSujet.set('');
    this.supportMessage.set('');
    this.supportEnvoi.set(false);
    this.modalSupportVisible.set(true);
  }

  protected fermerSupport(): void {
    this.modalSupportVisible.set(false);
  }

  protected async envoyerSupport(): Promise<void> {
    const sujet = this.supportSujet().trim();
    const message = this.supportMessage().trim();
    if (!sujet || !message) return;
    this.supportEnvoi.set(true);
    try {
      await this.support.createTicket(this.supportCategorie(), sujet, message);
      this.modalSupportVisible.set(false);
      this.toast.succes('Signalement envoyé.');
    } catch (e) {
      this.toast.erreur(e instanceof Failure ? e.message : 'Envoi impossible.');
    } finally {
      this.supportEnvoi.set(false);
    }
  }

  private async viderCache(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: 'Vider le cache ?',
      description: 'Les documents hors ligne ne seront pas supprimés.',
      confirmLabel: 'Vider',
      destructive: true,
    });
    if (!confirme) return;
    // La vraie purge du cache viendra avec l'infrastructure hors-ligne.
    this.toast.succes('Cache vidé.');
  }

  private async deconnecter(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: 'Déconnexion',
      description: 'Tu devras saisir à nouveau tes identifiants pour revenir.',
      confirmLabel: 'Déconnecter',
      destructive: true,
      icon: 'logout',
    });
    if (!confirme) return;
    await this.auth.logout();
    void this.router.navigate(['/app']);
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected saisirPin(champ: 'ancien' | 'nouveau' | 'confirmation', e: Event): void {
    const valeur = this.val(e).replace(/\D/g, '').slice(0, 4);
    if (champ === 'ancien') this.pinAncien.set(valeur);
    else if (champ === 'nouveau') this.pinNouveau.set(valeur);
    else this.pinConfirmation.set(valeur);
    this.pinErreur.set(undefined);
  }
}
