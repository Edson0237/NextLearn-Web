import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppRoutes } from '../router/app-routes';
import { AuthRepository } from './auth-repository';
import { SessionExpiredService } from '../network/session-expired.service';
import { VerificationService } from '../verification/verification.service';
import { AuthState, ETAT_INITIAL, PendingJustificatif, ResultatConnexion } from './auth.model';
import { VerrouillageApp } from '../preferences/verrouillage-app';
import { Cycle, NiveauEtude, NiveauxDuCycle } from '../models/user.model';
import { ProfilGoogle, ReponseGoogle } from './auth-repository';
import { ParcoursOtp } from '../models/parcours-otp.model';
import { StatutDemandeOtp } from '../models/demande-otp.model';
import { Failure } from '../models/failure.model';
import { ProfilRepository } from '../profil/profil-repository';
import { VerrouPin } from './verrou-pin';

/** Délai minimum pour que l'animation du splash ait le temps de se jouer. */
const SPLASH_MIN_MS = 1500;

function attendre(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * État et logique d'authentification - traduction d'`AuthNotifier`
 * (`lib/domains/auth/presentation/providers/auth_provider.dart`). C'est le
 * cœur de l'architecture de la Phase 3 : le routeur applicatif (Phase 3,
 * voir `app.routes.ts`) lit `state()` pour décider où rediriger, exactement
 * comme `RouterNotifier.redirect` lit `AuthState` côté Flutter.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repo = inject(AuthRepository);
  private readonly profilRepo = inject(ProfilRepository);
  private readonly verrouPin = inject(VerrouPin);
  private readonly verrouillage = inject(VerrouillageApp);
  private readonly verification = inject(VerificationService);
  private readonly router = inject(Router);

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
      // Le verrou local ne se referme plus de lui-même. Il était posé dès
      // qu'un PIN existait, c'est-à-dire toujours : rouvrir ses cours
      // demandait quatre chiffres, plusieurs fois par jour, derrière le code
      // de l'appareil qui les protégeait déjà. Il ne vaut désormais que si
      // l'étudiant l'a demandé - téléphone partagé, poste de salle info.
      const locked = !!user && this.repo.hasLocalPin() && this.verrouillage.actif();
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
      // L'adresse est vérifiée : le compte est prêt, la session s'ouvre. Le PIN
      // n'est plus une étape obligatoire - on peut en créer un plus tard, dans
      // les réglages.
      await this.repo.setupPin(undefined);
      const user = this.repo.getCurrentUser() ?? undefined;
      void this.verification.refresh();
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
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
      // Un renvoi peut n'avoir rien envoyé (quota, délai) - c'est le
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
  /** Le code du dernier refus d'inscription (`use_google_auth`…), pour que l'écran réagisse autrement qu'en affichant un message. */
  readonly codeErreurInscription = signal<string | undefined>(undefined);

  async register(sansEmailInstitutionnel = false): Promise<boolean> {
    this.codeErreurInscription.set(undefined);
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
      this.codeErreurInscription.set(e instanceof Failure ? e.code : undefined);
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
      // (nécessite le module de vérification) - non câblé ici.
      void this.verification.refresh();
      this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
      return true;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e) });
      return false;
    }
  }

  // ── Login PIN (étape 1) ───────────────────────────────────────────────────
  /**
   * Connexion par e-mail et PIN.
   *
   * Trois issues, là où il n'y en avait que deux :
   *
   * - `'session'` - l'appareil est déjà connu du serveur, la session est
   *   ouverte, il n'y a plus rien à saisir ;
   * - `'otp'` - appareil inconnu, un code est parti par e-mail ;
   * - `'echec'` - identifiants refusés ou réseau absent.
   *
   * Un booléen ne suffisait plus : « réussi » ne dit pas si l'écran suivant
   * est la saisie du code ou l'accueil.
   */
  /**
   * « Se connecter avec Google » : envoie le jeton d'identité remis par Google
   * et applique la réponse - **depuis n'importe quel écran** (inscription,
   * connexion, confirmation d'un appareil nouveau). Rend `null`, ou le refus à
   * montrer (code et message du serveur : `domain_not_allowed`,
   * `account_banned`…).
   */
  async connexionGoogle(idToken: string): Promise<{ code?: string; message: string } | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      await this.handleGoogleAuthResponse(await this.repo.connexionGoogle(idToken));
      return null;
    } catch (e) {
      const message = this.messageErreur(e, 'Connexion Google impossible. Réessaie.');
      this.patch({ isLoading: false, error: message });
      return { code: e instanceof Failure ? e.code : undefined, message };
    }
  }

  /**
   * **Le** gestionnaire des réponses de `POST /auth/google` : il route sur le
   * seul champ `status`. Aucun écran ne duplique cette logique - ils appellent
   * `connexionGoogle` et c'est tout.
   *
   *  - `new_profile_incomplete` → l'écran « Plus qu'une étape » (parcours scolaire),
   *    l'identité Google gardée en mémoire pour l'appel suivant ;
   *  - `pin_required`           → le choix du PIN ;
   *  - `authenticated`          → session ouverte et appareil mémorisé (côté
   *    serveur) ; l'accueil, ou la page d'attente si un justificatif attend.
   */
  async handleGoogleAuthResponse(reponse: ReponseGoogle): Promise<void> {
    switch (reponse.status) {
      case 'new_profile_incomplete':
        this.profilGoogle.set(reponse.profil);
        this.patch({ isLoading: false });
        await this.router.navigate(['/app', AppRoutes.register]);
        return;
      case 'pin_required':
        this.patch({ isLoading: false, parcoursOtp: ParcoursOtp.definitionPin });
        await this.router.navigateByUrl('/app/' + AppRoutes.pinSetup);
        return;
      case 'authenticated': {
        const user = this.repo.getCurrentUser() ?? undefined;
        this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
        if (reponse.verificationStatus === 'pending') {
          // On attend l'état de vérification avant de naviguer : la garde de
          // routage s'y fie, et le lire après renverrait vers l'accueil.
          await this.verification.refresh();
          await this.router.navigateByUrl('/app/' + AppRoutes.verificationPending);
        } else {
          // L'état de vérification se lit AVANT de naviguer : un compte « requis »
          // (adresse Google non institutionnelle) doit être aiguillé vers le
          // dépôt du justificatif, et la garde de routage s'en remet à cet état.
          await this.verification.refresh();
          await this.router.navigate(['/app', AppRoutes.home]);
        }
        return;
      }
    }
  }

  /**
   * L'identité Google en attente d'un parcours académique, s'il y en a une.
   *
   * Un signal, et non une lecture du dépôt : le bouton Google peut être touché
   * **depuis la page d'inscription elle-même**, qui ne se recrée pas - elle doit
   * réagir à l'arrivée de l'identité, pas la lire une seule fois à sa création.
   */
  readonly profilGoogle = signal<ProfilGoogle | null>(null);

  abandonnerInscriptionGoogle(): void {
    this.repo.profilGoogleEnAttente = null;
    this.profilGoogle.set(null);
  }

  /** Crée le compte d'une première visite Google ; rend `true` quand il reste à choisir le PIN. */
  async inscriptionGoogle(infos: { universite: string; filiere: string; niveau: string; cycle?: string }): Promise<string | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const reponse = await this.repo.inscriptionGoogle(infos);
      this.profilGoogle.set(null);
      // `pin_required` : le compte existe, il reste à choisir le PIN.
      await this.handleGoogleAuthResponse(reponse);
      return null;
    } catch (e) {
      const message = this.messageErreur(e, 'Inscription impossible. Réessaie.');
      this.patch({ isLoading: false, error: message });
      return message;
    }
  }

  /**
   * Première étape de la connexion : l'e-mail seul. Dit comment poursuivre -
   * saisir son PIN, saisir le code reçu par e-mail, ou passer par Google.
   */
  async identifierConnexion(email: string): Promise<'pin' | 'otp' | 'google' | 'echec'> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const methode = await this.repo.identifierConnexion(email);
      if (methode === 'otp') {
        this.patch({
          isLoading: false,
          demandeOtp: this.repo.derniereDemandeOtp ?? undefined,
          parcoursOtp: ParcoursOtp.connexion,
        });
      } else {
        this.patch({ isLoading: false });
      }
      return methode;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Connexion impossible. Réessaie.') });
      return 'echec';
    }
  }

  async loginWithPin(email: string, pin: string): Promise<ResultatConnexion> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const otpAttendu = await this.repo.loginWithPin(email, pin);

      // Appareil nouveau, adresse gérée par Google : le PIN est bon, il reste à
      // confirmer l'appareil avec le bouton Google. Aucun code n'est parti.
      if (otpAttendu === 'google') {
        this.patch({ isLoading: false });
        return 'google';
      }

      if (!otpAttendu) {
        // Appareil connu : la session existe déjà côté dépôt, l'état doit la
        // refléter - sans quoi la garde de routage renverrait au login.
        const user = this.repo.getCurrentUser() ?? undefined;
        void this.verification.refresh();
        this._state.set({ ...ETAT_INITIAL, isInitializing: false, user });
        return 'session';
      }

      // Le backend exige encore le second facteur avant une vraie session.
      this.patch({
        isLoading: false,
        demandeOtp: this.repo.derniereDemandeOtp ?? undefined,
        parcoursOtp: ParcoursOtp.connexion,
      });
      return 'otp';
    } catch (e) {
      const reseau = e instanceof Failure && e.estErreurReseau;
      this.patch({
        isLoading: false,
        error: reseau ? this.messageErreur(e) : 'Identifiants incorrects.',
      });
      return 'echec';
    }
  }

  // ── Déverrouillage local ──────────────────────────────────────────────────
  async unlockWithPin(pin: string): Promise<boolean> {
    this.patch({ isLoading: true, error: undefined });
    try {
      // Un verrou en cours prime sur toute vérification : sans ça, le
      // délai imposé après plusieurs échecs ne servirait à rien.
      const verrou = this.verrouPin.bloqueJusqua();
      if (verrou) {
        this.patch({ isLoading: false, error: this.messageVerrou(verrou) });
        return false;
      }

      const ok = await this.repo.verifyLocalPin(pin);
      if (!ok) {
        this.verrouPin.enregistrerEchec();
        const nouveauVerrou = this.verrouPin.bloqueJusqua();
        this.patch({
          isLoading: false,
          error: nouveauVerrou ? this.messageVerrou(nouveauVerrou) : 'PIN incorrect.',
        });
        return false;
      }

      this.verrouPin.effacerEchecs();
      this.patch({ isLoading: false, isLocked: false });
      return true;
    } catch {
      this.patch({ isLoading: false, error: 'Impossible de vérifier le PIN. Réessayez.' });
      return false;
    }
  }

  /** Consulté par la biométrie, qui ne doit pas offrir un moyen de contourner le verrou. */
  isPinLocked(): boolean {
    return this.verrouPin.bloqueJusqua() !== null;
  }

  /** Le système d'exploitation a déjà prouvé l'identité du porteur - ou, sur
   * le web, WebAuthn l'a fait ; le PIN n'est pas revérifié ici. */
  unlockWithBiometrics(): void {
    this.patch({ isLocked: false, error: undefined });
    this.verrouPin.effacerEchecs();
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
  async changerPin(ancienPin: string | undefined, nouveauPin: string): Promise<number | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const fermees = await this.repo.changerPin(ancienPin, nouveauPin);
      this.patch({ isLoading: false, user: this.repo.getCurrentUser() ?? this._state().user });
      return fermees;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Changement impossible.') });
      return null;
    }
  }

  /** Les niveaux entre lesquels ce compte peut changer. */
  async niveauxDuCycle(): Promise<NiveauxDuCycle> {
    return this.profilRepo.niveauxDuCycle();
  }

  /** Change le niveau et met le profil local à jour. */
  async changerNiveau(code: string): Promise<string | null> {
    this.patch({ isLoading: true, error: undefined });
    try {
      const utilisateur = await this.profilRepo.changerNiveau(code);
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
      const utilisateur = await this.profilRepo.televerserAvatar(fichier);
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
      const utilisateur = await this.profilRepo.supprimerAvatar();
      this.patch({ isLoading: false, user: utilisateur });
      return null;
    } catch (e) {
      this.patch({ isLoading: false, error: this.messageErreur(e, 'Photo non retirée.') });
      return this.messageErreur(e, 'Photo non retirée.');
    }
  }

  /** Seule sortie des écrans de code - efface le jeton temporaire et rend
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
