import { Injectable, computed, signal } from '@angular/core';

/** L'événement Chrome, absent des types standard du DOM. */
interface InvitationInstallation extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLE_REFUS = 'nl_install_refuse';

/**
 * Installation sur l'écran d'accueil.
 *
 * Android et Chrome proposent `beforeinstallprompt` : l'événement était
 * ignoré, donc l'invitation native ne s'affichait jamais et aucun bouton ne
 * la remplaçait - la seule voie restante était le menu du navigateur, que
 * personne ne va chercher.
 *
 * iOS n'a pas d'équivalent : Safari n'expose aucune API d'installation. La
 * seule chose honnête est d'expliquer le geste (« Partager → Sur l'écran
 * d'accueil »), et seulement à qui n'a pas déjà installé l'application.
 *
 * Un refus se retient : reproposer à chaque visite ce qu'on vient d'écarter
 * est la définition d'un bandeau qu'on finit par ne plus voir.
 */
@Injectable({ providedIn: 'root' })
export class InstallationService {
  private readonly invitation = signal<InvitationInstallation | null>(null);
  private readonly refuse = signal(this.lireRefus());

  /** Mode autonome : l'application est déjà posée sur l'écran d'accueil. */
  readonly dejaInstallee = signal(this.detecterModeAutonome());

  /** Android/Chrome : une invitation native est prête à être déclenchée. */
  readonly peutProposer = computed(
    () => this.invitation() !== null && !this.refuse() && !this.dejaInstallee(),
  );

  /** iOS : aucune API, seulement un geste à expliquer. */
  readonly besoinGuideIos = computed(
    () => this.estIos() && !this.dejaInstallee() && !this.refuse(),
  );

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Sans ça, Chrome affiche sa propre mini-barre au moment qu'il choisit.
      // On préfère proposer au moment où l'application a fait ses preuves.
      e.preventDefault();
      this.invitation.set(e as InvitationInstallation);
    });

    window.addEventListener('appinstalled', () => {
      this.invitation.set(null);
      this.dejaInstallee.set(true);
    });
  }

  /** Déclenche l'invitation native. Rend `true` si l'installation a été acceptée. */
  async proposer(): Promise<boolean> {
    const invitation = this.invitation();
    if (!invitation) return false;
    try {
      await invitation.prompt();
      const { outcome } = await invitation.userChoice;
      this.invitation.set(null);
      if (outcome === 'dismissed') this.memoriserRefus();
      return outcome === 'accepted';
    } catch {
      return false;
    }
  }

  /** L'utilisateur écarte la proposition : on ne la represente plus. */
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

  private detecterModeAutonome(): boolean {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    // Safari iOS n'implémente pas `display-mode` : il expose son propre
    // `navigator.standalone`.
    const safari = (navigator as unknown as { standalone?: boolean }).standalone === true;
    return standalone || safari;
  }

  private estIos(): boolean {
    const ua = navigator.userAgent;
    const iphoneOuIpad = /iPad|iPhone|iPod/.test(ua);
    // iPadOS se présente comme un Mac depuis iOS 13 ; l'écran tactile le
    // trahit.
    const ipadModerne = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iphoneOuIpad || ipadModerne;
  }
}
