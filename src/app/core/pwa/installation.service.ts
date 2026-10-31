import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Environnement, ModeAffichage, detecterEnvironnement, lireModeAffichage, lireSourcesNavigateur } from './environnement';

/** L'événement Chrome, absent des types standard du DOM. */
interface InvitationInstallation extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Issue de la dernière invitation native : seulement ce que le navigateur a confirmé. */
export type ResultatInstallation = 'accepte' | 'refuse' | 'echec';

const CLE_REFUS = 'nl_install_refuse';

/**
 * Installation sur l'écran d'accueil - l'unique mécanisme de l'application.
 *
 * Android et les navigateurs Chromium proposent `beforeinstallprompt` : on
 * garde l'événement et on ne déclenche `prompt()` qu'au clic d'un utilisateur.
 * Safari, Firefox et les autres n'ont pas d'équivalent : il ne reste que le
 * geste à expliquer, ce que fait le guide (`nl-guide-installation`) à partir de
 * `environnement`.
 *
 * Une installation n'est jamais présumée : `dejaInstallee` ne passe à `true`
 * que sur `appinstalled` ou quand l'application s'ouvre en mode autonome. Un
 * clic sur « Installer » dont le navigateur confirme l'acceptation ne suffit pas.
 *
 * Un refus se retient pour le bandeau : reproposer à chaque visite ce qu'on
 * vient d'écarter est la définition d'un bandeau qu'on finit par ne plus voir.
 * Le guide, lui, reste accessible : c'est l'utilisateur qui vient le chercher.
 *
 * Le service est instancié au démarrage (voir `App`) : `beforeinstallprompt`
 * peut partir avant le premier écran, et un événement manqué ne revient pas.
 */
@Injectable({ providedIn: 'root' })
export class InstallationService {
  private readonly invitation = signal<InvitationInstallation | null>(null);
  private readonly refuse = signal(this.lireRefus());
  private readonly mode = signal<ModeAffichage>(lireModeAffichage());

  /** Appareil, système et navigateur détectés. Une estimation, pas une certitude. */
  readonly environnement = signal<Environnement>(detecterEnvironnement(lireSourcesNavigateur()));

  /** Mode autonome : l'application est déjà posée sur l'écran d'accueil. */
  readonly dejaInstallee = computed(() => this.installee() || this.mode() === 'autonome');
  private readonly installee = signal(false);

  /** Le navigateur a donné une invitation native, prête à être déclenchée. */
  readonly invitationDisponible = computed(() => this.invitation() !== null && !this.dejaInstallee());

  /** Issue de la dernière invitation déclenchée, ou `null` tant qu'il n'y en a pas eu. */
  readonly dernierResultat = signal<ResultatInstallation | null>(null);

  /** Pour le bandeau : invitation prête et pas encore écartée. */
  readonly peutProposer = computed(() => this.invitationDisponible() && !this.refuse());

  /** Pour le bandeau iOS : aucune API, seulement un geste à expliquer. */
  readonly besoinGuideIos = computed(() => {
    const { systeme } = this.environnement();
    return (systeme === 'ios' || systeme === 'ipados') && !this.dejaInstallee() && !this.refuse();
  });

  /** Le bandeau a quelque chose à dire (invitation prête, ou guide iOS). */
  readonly bandeauVisible = computed(() => this.peutProposer() || this.besoinGuideIos());

  constructor() {
    const surInvitation = (e: Event): void => {
      // Sans ça, Chrome affiche sa propre mini-barre au moment qu'il choisit.
      // On préfère proposer quand l'utilisateur le demande.
      e.preventDefault();
      this.invitation.set(e as InvitationInstallation);
    };
    const surInstallation = (): void => {
      this.invitation.set(null);
      this.installee.set(true);
      this.dernierResultat.set('accepte');
    };
    window.addEventListener('beforeinstallprompt', surInvitation);
    window.addEventListener('appinstalled', surInstallation);

    // L'application peut passer en mode autonome sans rechargement (installation
    // faite depuis le menu du navigateur) : on suit le changement.
    const media = window.matchMedia?.('(display-mode: standalone)');
    const surMode = (): void => this.mode.set(lireModeAffichage());
    media?.addEventListener?.('change', surMode);

    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', surInvitation);
      window.removeEventListener('appinstalled', surInstallation);
      media?.removeEventListener?.('change', surMode);
    });
  }

  /**
   * Déclenche l'invitation native. À n'appeler que depuis un geste explicite.
   * Rend `true` si le navigateur a confirmé le choix « installer ».
   */
  async proposer(): Promise<boolean> {
    const invitation = this.invitation();
    if (!invitation) return false;
    try {
      await invitation.prompt();
      const { outcome } = await invitation.userChoice;
      // L'événement ne sert qu'une fois ; un nouveau sera émis si le navigateur le décide.
      this.invitation.set(null);
      if (outcome === 'dismissed') {
        this.dernierResultat.set('refuse');
        this.memoriserRefus();
        return false;
      }
      this.dernierResultat.set('accepte');
      return true;
    } catch {
      this.dernierResultat.set('echec');
      return false;
    }
  }

  /** L'utilisateur écarte la proposition : le bandeau ne la représente plus. */
  memoriserRefus(): void {
    this.refuse.set(true);
    try {
      localStorage.setItem(CLE_REFUS, '1');
    } catch {
      // Stockage bloqué : le refus vaut au moins pour la session en cours.
    }
  }

  private lireRefus(): boolean {
    try {
      return localStorage.getItem(CLE_REFUS) === '1';
    } catch {
      return false;
    }
  }
}
