import { inject, Injectable, signal } from '@angular/core';
import { AuthRepository } from './auth-repository';
import { SessionExpiredService } from '../network/session-expired.service';
import { VerificationService } from '../verification/verification.service';
import { AuthState, ETAT_INITIAL, PendingJustificatif } from './auth.model';
import { Cycle, NiveauEtude, NiveauxDuCycle } from '../models/user.model';
import { ParcoursOtp } from '../models/parcours-otp.model';
import { StatutDemandeOtp } from '../models/demande-otp.model';
import { Failure } from '../models/failure.model';

/** Délai minimum pour que l'animation du splash ait le temps de se jouer. */
const SPLASH_MIN_MS = 1500;

function attendre(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * État et logique d'authentification — traduction d'`AuthNotifier`
 * (`lib/domains/auth/presentation/providers/auth_provider.dart`). C'est le
 * cœur de l'architecture de la Phase 3 : le routeur applicatif (Phase 3,
 * voir `app.routes.ts`) lit `state()` pour décider où rediriger, exactement
 * comme `RouterNotifier.redirect` lit `AuthState` côté Flutter.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repo = inject(AuthRepository);
  private readonly verification = inject(VerificationService);

  private readonly _state = signal<AuthState>(ETAT_INITIAL);
  readonly state = this._state.asReadonly();

  constructor() {
    inject(SessionExpiredService).expired$.subscribe(() => void this.logout());
    void this.init();
  }

  private patch(partiel: Partial<AuthState>): void {
    this._state.set({ ...this._state(), ...partiel });
  }

  private async init(): Promise<void> {
    const minSplash = attendre(SPLASH_MIN_MS);
    try {
      const isFirst = this.repo.isFirstLaunch();
      const session = await this.repo.restoreSession();

      if (!session) {
        // Pas de session, mais peut-être une démarche ouverte : quelqu'un
        // qui vient de quitter l'application pour relever son code doit
        // retrouver l'écran où il l'attendait, pas l'écran de connexion.
        const parcours = this.repo.parcoursOtpEnCours() ?? undefined;
        await minSplash;
        this._state.set({ ...ETAT_INITIAL, isInitializing: false, isFirstLaunch: isFirst, parcoursOtp: parcours });
        return;
      }

      // La session tient encore (refresh token valable), mais l'OTP ne
      // vaut que trente jours : au-delà, reconnexion complète e-mail + PIN
      // + code.
      if (!(await this.repo.isOtpStillFresh())) {
        await this.repo.logout();
        await minSplash;
        this._state.set({
          ...ETAT_INITIAL, isInitializing: false, isFirstLaunch: isFirst,
          parcoursOtp: this.repo.parcoursOtpEnCours() ?? undefined,
        });
        return;
      }

      const user = this.repo.getCurrentUser() ?? undefined;
      // Dans cette fenêtre : le PIN local suffit à rouvrir l'app.
      const locked = !!user && this.repo.hasLocalPin();
      if (user) void this.verification.refresh();
      await minSplash;
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user, isLocked: locked });
    } catch {
      await minSplash;
      // Repli sûr : montrer l'onboarding plutôt qu'une connexion cassée.
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, isFirstLaunch: true });
    }
  }

  // ── Inscription : étapes 1 et 2 ───────────────────────────────────────────
  savePersonalInfo(email: string, nom: string, prenom: string): void {
    this.patch({ pendingEmail: email, pendingNom: nom, pendingPrenom: prenom, error: undefined });
  }

  saveAcademicInfo(universite: string, filiere: string, niveau: NiveauEtude, cycle?: Cycle): void {
    this.patch({ pendingUniversite: universite, pendingFiliere: filiere, pendingNiveau: niveau, pendingCycle: cycle, error: undefined });
  }

  /** Retenu jusqu'à la validation du PIN, qui établit la session nécessaire au dépôt. */
  saveJustificatif(justificatif: PendingJustificatif): void {
    this.patch({ pendingJustificatif: justificatif, error: undefined });
  }

  // ── OTP (inscription) ────────────────────────────────────────────────────
  async verifyOtp(code: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.verifyOtp(code);
      this.patch({ isLoading: false, parcoursOtp: ParcoursOtp.definitionPin });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Code incorrect.') });
      return false;
    }
  }

  async resendOtp(): Promise<boolean> {
    try {
      await this.repo.resendOtp();
      this.patch({ demandeOtp: this.repo.derniereDemandeOtp ?? undefined });
      // Un renvoi peut n'avoir rien envoyé (quota, délai) — c'est le
      // serveur qui le dit, pas nous.
      return this.repo.derniereDemandeOtp
        ? this.repo.derniereDemandeOtp.statut !== StatutDemandeOtp.refuse
        : true;
    } catch {
      return false;
    }
  }

  async rafraichirDemandeOtp(): Promise<void> {
    const etat = await this.repo.rafraichirDemandeOtp();
    if (etat) this.patch({ demandeOtp: etat });
  }

  // ── OTP (2e facteur du login) ────────────────────────────────────────────
  async verifyLoginOtp(code: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.verifyLoginOtp(code);
      const user = this.repo.getCurrentUser() ?? undefined;
      void this.verification.refresh();
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Code incorrect.') });
      return false;
    }
  }

  // ── Inscription finale ────────────────────────────────────────────────────
  async register(sansEmailInstitutionnel = false): Promise<boolean> {
    const s = this._state();
    if (!s.pendingEmail || !s.pendingNom || !s.pendingPrenom || !s.pendingUniversite ||
        !s.pendingFiliere || !s.pendingNiveau) {
      this.patch({ isLoading: false, error: 'Vos informations ont été perdues. Reprenez depuis le début.' });
      return false;
    }
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.register({
        email: s.pendingEmail, nom: s.pendingNom, prenom: s.pendingPrenom,
        universite: s.pendingUniversite, filiere: s.pendingFiliere,
        niveau: s.pendingNiveau, cycle: s.pendingCycle, sansEmailInstitutionnel,
      });
      // Pas d'authentification ici : l'OTP et le PIN restent à poser avant
      // une session complète.
      this.patch({
        isLoading: false,
        demandeOtp: this.repo.derniereDemandeOtp ?? undefined,
        parcoursOtp: ParcoursOtp.inscription,
      });
      return true;
    } catch (e) {
      // Un 409 ne signifie plus « inscription impossible » : le serveur
      // reprend les inscriptions laissées en cours. La bonne suite est de
      // se connecter, pas de recommencer.
      const conflit = e instanceof Failure && e.statusCode === 409;
      this.patch({
        isLoading: false,
        error: conflit ? 'Ce compte existe déjà. Connectez-vous.' : this.messageErreur(e),
      });
      return false;
    }
  }

  // ── PIN setup (établit la session) ───────────────────────────────────────
  async setupPin(pin: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.setupPin(pin);
      const user = this.repo.getCurrentUser() ?? undefined;
      // Le dépôt du justificatif retenu depuis l'inscription est Phase 4
      // (nécessite le module de vérification) — non câblé ici.
      void this.verification.refresh();
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e) });
      return false;
    }
  }

  // ── Login PIN (étape 1) ───────────────────────────────────────────────────
  async loginWithPin(email: string, pin: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.loginWithPin(email, pin);
      // Pas d'authentification ici : le backend exige encore le second
      // facteur (verifyLoginOtp) avant une vraie session.
      this.patch({
        isLoading: false,
        demandeOtp: this.repo.derniereDemandeOtp ?? undefined,
        parcoursOtp: ParcoursOtp.connexion,
      });
      return true;
    } catch (e) {
      const reseau = e instanceof Failure && e.estErreurReseau;
      this.patch({
        isLoading: false,
        error: reseau ? this.messageErreur(e) : 'Identifiants incorrects.',
      });
      return false;
    }
  }

  // ── Déverrouillage local ──────────────────────────────────────────────────
  async unlockWithPin(pin: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      // Un verrou en cours prime sur toute vérification : sans ça, le
      // délai imposé après plusieurs échecs ne servirait à rien.
      const verrou = this.repo.pinLockedUntil();
      if (verrou) {
        this.patch({ isLoading: false, error: this.messageVerrou(verrou) });
        return false;
      }

      const ok = await this.repo.verifyLocalPin(pin);
      if (!ok) {
        this.repo.registerPinFailure();
        const nouveauVerrou = this.repo.pinLockedUntil();
        this.patch({
          isLoading: false,
          error: nouveauVerrou ? this.messageVerrou(nouveauVerrou) : 'PIN incorrect.',
        });
        return false;
      }

      this.repo.clearPinFailures();
      this.patch({ isLoading: false, isLocked: false });
      return true;
    } catch {
      this.patch({ isLoading: false, error: 'Impossible de vérifier le PIN. Réessayez.' });
      return false;
    }
  }

  /** Consulté par la biométrie, qui ne doit pas offrir un moyen de contourner le verrou. */
  isPinLocked(): boolean {
    return this.repo.pinLockedUntil() !== null;
  }

  /** Le système d'exploitation a déjà prouvé l'identité du porteur — ou, sur
   * le web, WebAuthn l'a fait ; le PIN n'est pas revérifié ici. */
  unlockWithBiometrics(): void {
    this.patch({ isLocked: false, error: undefined });
    this.repo.clearPinFailures();
  }

  private messageVerrou(until: Date): string {
    const resteMs = until.getTime() - Date.now();
    const minutes = Math.ceil(resteMs / 60_000);
    if (minutes >= 1) return `Trop de tentatives. Réessayez dans ${minutes} min.`;
    const secondes = Math.ceil(resteMs / 1000);
    return `Trop de tentatives. Réessayez dans ${secondes} s.`;
  }

  // ── Réinitialisation du PIN ───────────────────────────────────────────────
  async requestPinReset(email: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.repo.requestPinReset(email);
      this.patch({
        isLoading: false,
        demandeOtp: this.repo.derniereDemandeOtp ?? undefined,
        parcoursOtp: ParcoursOtp.reinitialisation,
      });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Identifiants invalides.') });
      return false;
    }
  }

  /** La session s'ouvre dans la foulée quand le serveur la rend. */
  async confirmPinReset(code: string, newPin: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const user = await this.repo.confirmPinReset(code, newPin);
      if (user) void this.verification.refresh();
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user: user ?? undefined });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Code incorrect ou expiré.') });
      return false;
    }
  }

  /** Rend le nombre d'autres appareils déconnectés, ou `null` en cas d'échec. */
  async changerPin(ancienPin: string, nouveauPin: string): Promise<number | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const fermees = await this.repo.changerPin(ancienPin, nouveauPin);
      this.patch({ isLoading: false });
      return fermees;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Changement impossible.') });
      return null;
    }
  }

  /** Les niveaux entre lesquels ce compte peut changer. */
  async niveauxDuCycle(): Promise<NiveauxDuCycle> {
    return this.repo.niveauxDuCycle();
  }

  /** Change le niveau et met le profil local à jour. */
  async changerNiveau(code: string): Promise<string | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const utilisateur = await this.repo.changerNiveau(code);
      this.patch({ isLoading: false, user: utilisateur });
      return null;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Niveau non enregistré.') });
      return this.messageErreur(e, 'Niveau non enregistré.');
    }
  }

  /** Dépose une photo de profil. */
  async changerAvatar(fichier: File): Promise<string | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const utilisateur = await this.repo.televerserAvatar(fichier);
      this.patch({ isLoading: false, user: utilisateur });
      return null;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Photo non enregistrée.') });
      return this.messageErreur(e, 'Photo non enregistrée.');
    }
  }

  /** Retire la photo de profil. */
  async supprimerAvatar(): Promise<string | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const utilisateur = await this.repo.supprimerAvatar();
      this.patch({ isLoading: false, user: utilisateur });
      return null;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Photo non retirée.') });
      return this.messageErreur(e, 'Photo non retirée.');
    }
  }

  /** Seule sortie des écrans de code — efface le jeton temporaire et rend
   * la navigation libre. */
  abandonnerParcoursOtp(): void {
    this.repo.abandonnerParcoursOtp();
    this.patch({ parcoursOtp: undefined, demandeOtp: undefined, error: undefined, isLoading: false });
  }

  // ── Déconnexion ───────────────────────────────────────────────────────────
  async logout(): Promise<void> {
    try {
      await this.repo.logout();
    } catch {
      // Ignoré volontairement : la session locale doit tomber quoi qu'il arrive.
    }
    this.verification.reset();
    this._state.set({ ...ETAT_INITIAL, isInitializing: false });
  }

  /** « Ce n'est pas moi » : oublie totalement le compte sur cet appareil. */
  async forgetDevice(): Promise<void> {
    try {
      await this.repo.forgetDevice();
    } catch {
      // Idem : on repart d'un état propre même si l'effacement a échoué.
    }
    this.verification.reset();
    this._state.set({ ...ETAT_INITIAL, isInitializing: false });
  }

  clearError(): void {
    this.patch({ error: undefined });
  }

  private messageErreur(e: unknown, repli = 'Une erreur est survenue.'): string {
    if (e instanceof Failure) return e.message || repli;
    return repli;
  }
}
