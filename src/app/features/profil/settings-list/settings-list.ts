import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { FavorisEtat } from '../../../shared/services/favoris-etat';
import { ThemeService, ThemeMode } from '../../../shared/services/theme';
import {
  EchelleTexte,
  LIBELLES_ECHELLE,
  PreferencesAccessibilite,
} from '../../../core/preferences/preferences-accessibilite';
import { StockageHorsLigne } from '../../../core/bibliotheque/stockage-hors-ligne';
import { PreferenceLangue, TraductionService, tr } from '../../../core/i18n/traduction.service';
import { PreferenceNotifications } from '../../../core/notifications/preference-notifications';
import { ToastService } from '../../../shared/ui/toast/toast';
import { FeuilleActionService, ActionOption } from '../../../shared/ui/bottom-sheet/feuille-action';
import { FeuilleSelectionService, ChoixSelection } from '../../../shared/ui/bottom-sheet/feuille-selection';
import { IconName } from '../../../shared/ui/icon/icon-paths';
import { Icon } from '../../../shared/ui/icon/icon';
import { AppRoutes } from '../../../core/router/app-routes';
import { VerrouillageApp } from '../../../core/preferences/verrouillage-app';
import { VERSION_APP } from '../../../core/version';
import { PinDialog } from '../dialogues/pin-dialog/pin-dialog';
import { SupportDialog } from '../dialogues/support-dialog/support-dialog';

interface LigneReglage {
  readonly icone: IconName;
  readonly titre: string;
  readonly sousTitre: string;
  readonly valeur?: string;
  readonly destructive?: boolean;
  /**
   * L'état d'un interrupteur, quand la ligne en porte un.
   *
   * Présent, la ligne se rend avec un interrupteur et sans chevron :
   * elle bascule une préférence au lieu de mener ailleurs, et doit le dire
   * avant d'être touchée.
   */
  readonly bascule?: () => boolean;
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
  imports: [Icon, PinDialog, SupportDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-list.html',
  styleUrl: './settings-list.scss',
})
export class SettingsList implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly verrouillage = inject(VerrouillageApp);
  private readonly theme = inject(ThemeService);
  private readonly acces = inject(PreferencesAccessibilite);
  private readonly stockage = inject(StockageHorsLigne);
  private readonly favorisEtat = inject(FavorisEtat);
  private readonly traductions = inject(TraductionService);
  private readonly notifications = inject(PreferenceNotifications);

  async ngOnInit(): Promise<void> {
    // Les compteurs de « Mes ressources » : favoris du compte, fichiers de cet appareil.
    void this.favorisEtat.charger();
    // L'inventaire local n'est pas connu d'avance : sans cette relecture, le
    // compteur annoncerait « 0 fichier » à quelqu'un qui vient d'en
    // télécharger trois.
    await this.stockage.rafraichir();
  }
  private readonly toast = inject(ToastService);
  private readonly actions = inject(FeuilleActionService);
  private readonly selections = inject(FeuilleSelectionService);

  readonly inline = input(false);


  protected readonly user = computed(() => this.auth.state().user);
  /**
   * Le compte a-t-il un PIN ? Il est facultatif. `hasPin` inconnu (profil
   * gardé par une version plus ancienne) vaut « oui » : c'était la règle, et
   * demander le code actuel est le comportement sûr.
   */
  protected readonly aUnPin = computed(() => this.user()?.hasPin !== false);
  protected readonly themeLabel = computed(() => {
    const m = this.theme.mode();
    if (m === 'light') return 'Clair';
    if (m === 'dark') return 'Sombre';
    return 'Système';
  });

  protected readonly modalPinVisible = signal(false);

  protected readonly modalSupportVisible = signal(false);

  /**
   * « Mes ressources » : bibliothèque, téléchargés, favoris — rendus par les
   * mêmes lignes que « Compte » et « Apparence », pour ne faire qu'une seule
   * liste de réglages. Réservé au profil : la page des réglages n'en a pas
   * l'usage.
   */
  private readonly groupeRessources = computed<GroupeReglages>(() => ({
    titre: tr('profilMesRessources', 'Mes ressources'),
    lignes: [
      {
        icone: 'library_books', titre: tr('profilMaBibliotheque', 'Bibliothèque'), sousTitre: tr('pwaParcourirMatieres', 'Parcourir les matières'),
        action: () => void this.router.navigate(['/app', AppRoutes.bibliotheque]),
      },
      {
        icone: 'cloud_download', titre: tr('profilMesTelechargements', 'Téléchargés'), sousTitre: tr('pwaDocumentsTelecharges', 'Ceux téléchargés sur l\'appareil'),
        valeur: String(this.stockage.ids().size),
        action: () => void this.router.navigate(['/app', AppRoutes.offlineLibrary]),
      },
      {
        icone: 'bookmark', titre: tr('profilMesFavoris', 'Favoris'), sousTitre: tr('pwaRessourcesGardees', 'Les ressources que tu as gardées'),
        valeur: String(this.favorisEtat.ids().size),
        action: () => void this.router.navigate(['/app', AppRoutes.favoris]),
      },
    ],
  }));

  protected readonly groupes = computed<GroupeReglages[]>(() => {
    const u = this.user();
    return [
      ...(this.inline() ? [this.groupeRessources()] : []),
      {
        titre: tr('profilCompte', 'Compte'),
        lignes: [
          {
            icone: 'alternate_email', titre: tr('aproposLigneEmail', 'E-mail'), sousTitre: tr('pwaRattacheeEcole', 'Rattachée à ton école'),
            valeur: u?.email, action: () => void 0,
          },
          {
            icone: 'school', titre: tr('docNiveau', 'Niveau'), sousTitre: tr('pwaPromotionActuelle', 'Ta promotion actuelle'),
            valeur: u ? this.libelleNiveau(u.niveau, u.cycle) : undefined,
            action: () => void this.choisirNiveau(),
          },
          {
            icone: 'lock', titre: tr('pwaCodePin', 'Code PIN'),
            sousTitre: this.aUnPin()
              ? tr('pwaChangerCodeDeverrouillage', 'Changer le code de déverrouillage')
              : tr('pinFacultatifAide', 'Facultatif : protège l’ouverture de l’application'),
            action: () => this.ouvrirPinChange(),
          },
          // Le verrou demande le PIN à l'ouverture : sans PIN, il n'a rien à demander.
          ...(this.aUnPin()
            ? [{
                icone: 'lock_open' as const,
                titre: tr('reglageVerrouillage', 'Verrouiller l’application'),
                sousTitre: tr('reglageVerrouillageAide', 'Demander le PIN à chaque ouverture'),
                bascule: () => this.verrouillage.actif(),
                action: () => this.verrouillage.definir(!this.verrouillage.actif()),
              }]
            : []),
          {
            icone: 'devices', titre: tr('sessionsTitre', 'Appareils connectés'), sousTitre: tr('pwaGererSessions', 'Gérer tes sessions actives'),
            action: () => void this.router.navigateByUrl('/app/' + AppRoutes.sessions),
          },
          {
            icone: 'delete_forever', titre: tr('suppressionTitre', 'Supprimer mon compte'), sousTitre: tr('pwaActionIrreversible', 'Action irréversible'),
            destructive: true,
            action: () => void this.router.navigateByUrl('/app/' + AppRoutes.deleteAccount),
          },
        ],
      },
      {
        titre: tr('profilApparence', 'Apparence'),
        lignes: [
          {
            icone: 'settings', titre: tr('pwaTheme', 'Thème'), sousTitre: tr('pwaThemeSousTitre', 'Clair, sombre ou suivi du système'),
            valeur: this.themeLabel(), action: () => void this.choisirTheme(),
          },
          {
            icone: 'language',
            titre: this.traductions.t('langue', undefined, 'Langue'),
            sousTitre: this.traductions.t('parametresLangueSousTitre', undefined, 'Français ou anglais'),
            valeur: this.libelleLangue(),
            action: () => void this.choisirLangue(),
          },
        ],
      },
      {
        titre: tr('homeNotifications', 'Notifications'),
        lignes: [
          {
            icone: 'notifications',
            titre: tr('parametresNotificationsActives', 'Notifications actives'),
            sousTitre: tr('parametresNotificationsSousTitre', 'Activer les alertes'),
            valeur: this.libelleNotifications(),
            action: () => void this.basculerNotifications(),
          },
        ],
      },
      {
        titre: tr('biblioHorsLigne', 'Hors ligne'),
        lignes: [
          {
            icone: 'storage', titre: tr('titreHorsLigne', 'Documents hors ligne'), sousTitre: tr('pwaDocumentsTelecharges', 'Ceux téléchargés sur l\'appareil'),
            valeur: this.libelleFichiers(),
            action: () => void this.router.navigate(['/app', AppRoutes.offlineLibrary]),
          },
          {
            icone: 'delete_sweep', titre: tr('profilViderCache', 'Vider le cache'), sousTitre: tr('pwaEffacerDonneesTemporaires', 'Effacer les données temporaires'),
            destructive: true,
            action: () => void this.viderCache(),
          },
        ],
      },
      {
        titre: tr('aproposValeurAccessibilite', 'Accessibilité'),
        lignes: [
          {
            icone: 'animation', titre: tr('parametresReduireAnimations', 'Réduire les animations'), sousTitre: tr('pwaMoinsDeMouvement', 'Moins de mouvement à l\'écran'),
            valeur: this.libelleReduction(), action: () => void this.choisirReduction(),
          },
          {
            icone: 'format_size', titre: tr('parametresTailleTexte', 'Taille du texte'), sousTitre: tr('pwaNormaleGrandeTresGrande', 'Normale, grande ou très grande'),
            valeur: LIBELLES_ECHELLE[this.acces.echelleTexte()], action: () => void this.choisirEchelle(),
          },
        ],
      },
      {
        titre: tr('parametresGroupeAide', 'Aide et recours'),
        lignes: [
          {
            icone: 'support_agent', titre: tr('profilSignalerProbleme', 'Signaler un problème'), sousTitre: tr('pwaOuvrirTicket', 'Ouvrir un ticket auprès de l\'équipe'),
            action: () => this.ouvrirSupport(),
          },
          {
            icone: 'balance', titre: tr('recoursTitre', 'Contester une décision'), sousTitre: tr('pwaRecoursSurRefus', 'Recours sur un refus de document'),
            action: () => void this.router.navigate(['/app', AppRoutes.recours]),
          },
          {
            icone: 'list_alt', titre: tr('titreMesSignalements', 'Mes signalements'), sousTitre: tr('pwaHistoriqueDemandes', 'Historique de tes demandes'),
            action: () => void this.router.navigateByUrl('/app/' + AppRoutes.supportTickets),
          },
        ],
      },
      {
        titre: tr('legalAPropos', 'À propos'),
        lignes: [
          {
            icone: 'info', titre: tr('legalAPropos', 'À propos'), sousTitre: tr('pwaVersionEtInfos', 'Version et informations'),
            valeur: VERSION_APP, action: () => void this.router.navigateByUrl('/app/' + AppRoutes.aPropos),
          },
          {
            icone: 'privacy_tip', titre: tr('pwaConfidentialite', 'Confidentialité'), sousTitre: tr('legalConfidentialite', 'Politique de confidentialité'),
            action: () => window.open('/confidentialite/', '_blank'),
          },
          {
            icone: 'gavel', titre: tr('pwaConditions', 'Conditions'), sousTitre: tr('legalConditions', 'Conditions d\'utilisation'),
            action: () => window.open('/conditions/', '_blank'),
          },
        ],
      },
      {
        titre: tr('parametresGroupeSession', 'Session'),
        lignes: [
          {
            icone: 'logout', titre: tr('pwaDeconnexion', 'Déconnexion'), sousTitre: tr('pwaQuitterCompte', 'Quitter ce compte sur cet appareil'),
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
      this.toast.info(tr('pwaAucunAutreNiveau', 'Aucun autre niveau disponible pour ton école.'));
      return;
    }
    const actuel = this.user()?.niveau;
    const choices: ChoixSelection<string>[] = disponibles.niveaux.map((n) => ({
      value: n.code,
      label: n.label,
      description: n.code === actuel ? 'Niveau actuel' : undefined,
    }));
    const choisi = await this.selections.ouvrir<string>({
      title: tr('pwaChangerNiveau', 'Changer de niveau'),
      choices,
      currentValue: actuel,
    });
    if (!choisi || choisi === actuel) return;
    const erreur = await this.auth.changerNiveau(choisi);
    if (!erreur) this.toast.succes(tr('pwaNiveauEnregistre', 'Niveau enregistré.'));
  }

  private async choisirTheme(): Promise<void> {
    const choisi = await this.selections.ouvrir<ThemeMode>({
      title: tr('pwaTheme', 'Thème'),
      choices: [
        { value: 'system', label: tr('pwaSysteme', 'Système') },
        { value: 'light', label: tr('themeClair', 'Clair') },
        { value: 'dark', label: tr('themeSombre', 'Sombre') },
      ],
      currentValue: this.theme.mode(),
    });
    if (choisi) this.theme.set(choisi);
  }

  private ouvrirPinChange(): void {
    this.modalPinVisible.set(true);
  }

  private ouvrirSupport(): void {
    this.modalSupportVisible.set(true);
  }

  /** Combien de documents sont réellement posés sur cet appareil. */
  protected libelleFichiers(): string {
    const n = this.stockage.ids().size;
    return `${n} fichier${n > 1 ? 's' : ''}`;
  }

  protected libelleNotifications(): string {
    if (!this.notifications.actives()) return tr('parametresDesactive', 'Désactivé');
    switch (this.notifications.etatPush()) {
      case 'actif':
        return tr('parametresActive', 'Activé');
      case 'refuse':
        return tr('pwaPushRefuse', 'Bloqué par le navigateur');
      case 'indisponible':
        return tr('pwaPushIndisponible', 'Indisponible ici');
      case 'non-configure':
        return tr('pwaPushNonConfigure', 'Pas encore disponible');
      default:
        // Préférence posée, permission jamais demandée : on le dit, au lieu d'afficher « Activé ».
        return typeof Notification !== 'undefined' && Notification.permission === 'default'
          ? tr('pwaPushAActiver', 'Touche pour activer')
          : tr('parametresActive', 'Activé');
    }
  }

  /**
   * Bascule la réception des notifications.
   *
   * Le message qui suit dit ce qui s'est réellement passé : une permission
   * refusée, un navigateur qui ne sait pas faire et un canal pas encore
   * configuré sont trois situations différentes, et aucune n'est une panne.
   */
  private async basculerNotifications(): Promise<void> {
    // La ligne annonce « Activé » dès que la préférence est posée, alors que le
    // navigateur n'a peut-être jamais été sollicité (permission en attente). Dans
    // ce cas, toucher la ligne doit **demander la permission**, pas couper une
    // notification qui n'a jamais été allumée.
    const enAttente = this.notifications.actives() && this.notifications.etatPush() !== 'actif';
    const actives = enAttente ? true : !this.notifications.actives();
    const etat = await this.notifications.definir(actives);

    if (!actives) {
      this.toast.info(tr('parametresNotificationsCoupees', 'Notifications coupées.'));
      return;
    }
    switch (etat) {
      case 'actif':
        this.toast.succes(tr('pwaPushActive', 'Notifications activées.'));
        break;
      case 'refuse':
        this.toast.erreur(
          tr('pwaPushRefuseDetail', 'Ton navigateur bloque les notifications pour ce site.'),
        );
        break;
      case 'indisponible':
        this.toast.info(
          tr('pwaPushIndisponibleDetail', 'Installe l’application sur ton écran d’accueil pour les recevoir.'),
        );
        break;
      default:
        this.toast.info(
          tr('pwaPushNonConfigureDetail', 'Les notifications ne sont pas encore ouvertes sur le web.'),
        );
    }
  }

  protected libelleLangue(): string {
    switch (this.traductions.preferenceCourante()) {
      case 'fr':
        return this.traductions.t('langueFrancais', undefined, 'Français');
      case 'en':
        return this.traductions.t('langueAnglais', undefined, 'English');
      default:
        return this.traductions.t('langueSuivreSysteme', undefined, 'Suivre le système');
    }
  }

  private async choisirLangue(): Promise<void> {
    const choisi = await this.selections.ouvrir<PreferenceLangue>({
      title: this.traductions.t('langue', undefined, 'Langue'),
      choices: [
        {
          value: 'systeme',
          label: this.traductions.t('langueSuivreSysteme', undefined, 'Suivre le système'),
        },
        { value: 'fr', label: this.traductions.t('langueFrancais', undefined, 'Français') },
        { value: 'en', label: this.traductions.t('langueAnglais', undefined, 'English') },
      ],
      currentValue: this.traductions.preferenceCourante(),
    });
    if (choisi) await this.traductions.definir(choisi);
  }

  protected libelleReduction(): string {
    const choix = this.acces.reduireAnimations();
    if (choix === null) return 'Suivre le système';
    return choix ? 'Activé' : 'Désactivé';
  }

  private async choisirReduction(): Promise<void> {
    const choisi = await this.selections.ouvrir<'systeme' | 'oui' | 'non'>({
      title: tr('parametresReduireAnimations', 'Réduire les animations'),
      choices: [
        { value: 'systeme', label: tr('langueSuivreSysteme', 'Suivre le système'), description: tr('pwaCommeReglageTelephone', 'Comme le réglage du téléphone') },
        { value: 'oui', label: tr('parametresActive', 'Activé'), description: tr('pwaAucuneAnimation', 'Aucune animation') },
        { value: 'non', label: tr('parametresDesactive', 'Désactivé'), description: tr('pwaAnimationsCompletes', 'Animations complètes') },
      ],
      currentValue:
        this.acces.reduireAnimations() === null
          ? 'systeme'
          : this.acces.reduireAnimations()
            ? 'oui'
            : 'non',
    });
    if (!choisi) return;
    this.acces.definirReduction(choisi === 'systeme' ? null : choisi === 'oui');
  }

  private async choisirEchelle(): Promise<void> {
    const choisi = await this.selections.ouvrir<EchelleTexte>({
      title: tr('parametresTailleTexte', 'Taille du texte'),
      choices: (Object.values(EchelleTexte) as EchelleTexte[]).map((e) => ({
        value: e,
        label: LIBELLES_ECHELLE[e],
      })),
      currentValue: this.acces.echelleTexte(),
    });
    if (choisi) this.acces.definirEchelle(choisi);
  }

  private async viderCache(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: tr('pwaViderCacheQuestion', 'Vider le cache ?'),
      description: tr('pwaHorsLigneNonSupprimes', 'Les documents hors ligne ne seront pas supprimés.'),
      confirmLabel: tr('profilVider', 'Vider'),
      destructive: true,
    });
    if (!confirme) return;
    // Purge réelle : les réponses d'API mises en cache par le service worker
    // et les images, mais **pas** le cache des documents hors ligne — c'est
    // ce que la boîte de confirmation promet, et c'est ce qu'elle fait
    // désormais. L'action se contentait d'un message de succès.
    try {
      const noms = await caches.keys();
      await Promise.all(
        noms
          .filter((nom) => !nom.startsWith('nl-documents-hors-ligne'))
          .map((nom) => caches.delete(nom)),
      );
      this.toast.succes(tr('profilCacheVideSimple', 'Cache vidé.'));
    } catch {
      this.toast.erreur(tr('pwaCacheNonVide', 'Le cache n’a pas pu être vidé.'));
    }
  }

  private async deconnecter(): Promise<void> {
    const confirme = await this.actions.confirmer({
      title: tr('pwaDeconnexion', 'Déconnexion'),
      description: tr('pwaSaisirIdentifiantsANouveau', 'Tu devras saisir à nouveau tes identifiants pour revenir.'),
      confirmLabel: tr('profilDeconnecter', 'Déconnecter'),
      destructive: true,
      icon: 'logout',
    });
    if (!confirme) return;
    await this.auth.logout();
    void this.router.navigate(['/app']);
  }
}
