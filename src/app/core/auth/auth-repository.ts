import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATH } from '../network/api-config';
import { SecureStorageService } from '../storage/secure-storage.service';
import { Failure } from '../models/failure.model';
import { UserModel, Cycle, NiveauEtude, cycleVersApi, niveauCourt, utilisateurDepuisApi, NiveauxDuCycle, niveauxDuCycleDepuisApi } from '../models/user.model';
import { DemandeOtp, demandeOtpDepuisJson, CycleVerification, cycleVerificationDepuisJson, EtatVerification } from '../models/demande-otp.model';
import { ParcoursOtp, parcoursOtpDepuisCode, DUREE_REPRISABLE_OTP_MS } from '../models/parcours-otp.model';
import { EtatDomaine, ReponseDomaine, reponseDomaineDepuisJson } from '../models/domaine.model';

/** Durée de repli hors ligne quand aucune échéance n'a encore été mise en cache. */
const OTP_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

/** `sha256(pin + '_nextlearn_salt')`, en hexadécimal — même sel que côté backend. */
async function hashPin(pin: string): Promise<string> {
  const octets = new TextEncoder().encode(`${pin}_nextlearn_salt`);
  const empreinte = await crypto.subtle.digest('SHA-256', octets);
  return Array.from(new Uint8Array(empreinte))
    .map((o) => o.toString(16).padStart(2, '0'))
    .join('');
}

/** Dépouille l'enveloppe `{ data: ... }` que rend systématiquement l'API. */
function donnees(brut: unknown): Record<string, unknown> {
  if (brut && typeof brut === 'object') {
    const enveloppe = brut as Record<string, unknown>;
    const data = enveloppe['data'];
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    return enveloppe;
  }
  return {};
}

/**
 * Accès réseau + orchestration du stockage pour l'authentification —
 * traduction d'`AuthRemoteRepository`
 * (`lib/domains/auth/infrastructure/repositories/auth_remote_repository.dart`).
 *
 * Chaque méthode HTTP convertit ses erreurs en `Failure` via
 * `Failure.depuisErreurHttp`, jamais en laissant fuiter une
 * `HttpErrorResponse` brute jusqu'à `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(SecureStorageService);

  /** L'état de la dernière demande de code, tel que le serveur l'a rendu. */
  derniereDemandeOtp: DemandeOtp | null = null;

  private echeanceParcours(): Date {
    return new Date(Date.now() + DUREE_REPRISABLE_OTP_MS);
  }

  private retenirDemande(data: Record<string, unknown>): DemandeOtp | null {
    this.derniereDemandeOtp = demandeOtpDepuisJson(data['otp']);
    return this.derniereDemandeOtp;
  }

  private async poster(chemin: string, corps: unknown): Promise<Record<string, unknown>> {
    try {
      const reponse = await firstValueFrom(this.http.post(`${AUTH_PATH}${chemin}`, corps));
      return donnees(reponse);
    } catch (e) {
      throw this.echec(e);
    }
  }

  private echec(e: unknown): Failure {
    if (e instanceof HttpErrorResponse) return Failure.depuisErreurHttp(e, true);
    return new Failure('Une erreur est survenue.');
  }

  // ── Étape en cours ───────────────────────────────────────────────────────
  /**
   * L'étape d'authentification laissée en plan, s'il y en a une.
   * L'échéance décide, pas la seule présence du jeton temporaire — sans
   * elle, l'écran de saisie serait repris indéfiniment pour un code mort.
   */
  parcoursOtpEnCours(): ParcoursOtp | null {
    const jeton = this.storage.getTempToken();
    if (!jeton) return null;

    const echeance = this.storage.getEcheanceParcoursOtp();
    if (!echeance || Date.now() > echeance.getTime()) {
      this.storage.clearTempToken();
      return null;
    }
    return parcoursOtpDepuisCode(this.storage.getParcoursOtp());
  }

  abandonnerParcoursOtp(): void {
    this.derniereDemandeOtp = null;
    this.storage.clearTempToken();
  }

  async rafraichirDemandeOtp(): Promise<DemandeOtp | null> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) return null;
    try {
      const reponse = await firstValueFrom(
        this.http.get(`${AUTH_PATH}/otp/status`, { params: { tempToken } }),
      );
      this.derniereDemandeOtp = demandeOtpDepuisJson(donnees(reponse));
      return this.derniereDemandeOtp;
    } catch {
      // Une consultation d'état qui échoue ne doit rien casser : l'écran
      // garde ce qu'il affichait plutôt que de basculer sur une erreur.
      return this.derniereDemandeOtp;
    }
  }

  async etatVerification(): Promise<CycleVerification | null> {
    try {
      const reponse = await firstValueFrom(this.http.get(`${AUTH_PATH}/verification-status`));
      return cycleVerificationDepuisJson(donnees(reponse));
    } catch {
      return null;
    }
  }

  /**
   * Le serveur reconnaît-il ce domaine e-mail comme institutionnel ? Ne
   * lève jamais — une coupure réseau rend `indisponible`, pas une erreur à
   * afficher : le formulaire d'inscription ne doit pas bloquer pour un
   * contrôle qui n'est qu'indicatif (`register()` retranche de toute façon).
   */
  async verifierDomaine(email: string): Promise<ReponseDomaine> {
    try {
      const reponse = await firstValueFrom(
        this.http.get(`${AUTH_PATH}/institution-domain/check`, { params: { email } }),
      );
      return reponseDomaineDepuisJson(donnees(reponse));
    } catch {
      return { etat: EtatDomaine.indisponible };
    }
  }

  // ── Inscription ──────────────────────────────────────────────────────────
  async register(infos: {
    email: string; nom: string; prenom: string; universite: string; filiere: string;
    niveau: NiveauEtude; cycle?: Cycle; sansEmailInstitutionnel?: boolean;
  }): Promise<void> {
    const data = await this.poster('/register', {
      email: infos.email, nom: infos.nom, prenom: infos.prenom,
      universite: infos.universite, filiere: infos.filiere,
      niveau: niveauCourt(infos.niveau),
      ...(infos.cycle ? { cycle: cycleVersApi(infos.cycle) } : {}),
      ...(infos.sansEmailInstitutionnel ? { sansEmailInstitutionnel: true } : {}),
    });

    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure("Impossible d'obtenir le jeton temporaire du serveur.");
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.inscription, this.echeanceParcours());
    this.storage.markLaunched();
    this.retenirDemande(data);
  }

  async verifyOtp(code: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/verify-otp', { tempToken, code });
    const suivant = data['tempToken'];
    if (typeof suivant !== 'string' || suivant.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton de validation.');
    }
    this.storage.saveTempToken(suivant);
    // L'adresse est vérifiée, le PIN reste à choisir.
    this.storage.saveParcoursOtp(ParcoursOtp.definitionPin, this.echeanceParcours());
  }

  async setupPin(pin: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/setup-pin', { tempToken, pin });
    await this.ouvrirSession(data, pin);
    this.storage.clearTempToken();
  }

  async loginWithPin(email: string, pin: string): Promise<void> {
    const data = await this.poster('/login', { email, pin });
    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton temporaire.');
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.connexion, this.echeanceParcours());
    // Le backend n'émet ce jeton qu'après avoir validé le PIN : on peut donc
    // mémoriser son empreinte pour les déverrouillages locaux ultérieurs.
    this.storage.savePinHash(await hashPin(pin));
    this.retenirDemande(data);
  }

  async verifyLoginOtp(code: string): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/verify-2fa', { tempToken, code });
    await this.ouvrirSession(data);
    this.storage.clearTempToken();
  }

  async resendOtp(): Promise<void> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/resend-otp', { tempToken });
    const nouveau = data['tempToken'];
    if (typeof nouveau !== 'string' || nouveau.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de nouveau jeton.');
    }
    this.storage.saveTempToken(nouveau);
    this.retenirDemande(data);
  }

  /** Écrit la session (jetons + utilisateur) rendue par une réponse d'auth,
   * et l'empreinte du PIN si on le connaît (setupPin le possède, pas verify-2fa). */
  private async ouvrirSession(data: Record<string, unknown>, pin?: string): Promise<void> {
    const accessToken = data['accessToken'];
    const refreshToken = data['refreshToken'];
    const userData = data['user'];
    if (
      typeof accessToken !== 'string' || typeof refreshToken !== 'string' ||
      !userData || typeof userData !== 'object'
    ) {
      throw new Failure('La réponse du serveur ne contient pas les informations de session.');
    }
    this.storage.saveToken(accessToken, new Date(Date.now() + 15 * 60 * 1000));
    this.storage.saveRefreshToken(refreshToken);
    this.storage.saveUser(utilisateurDepuisApi(userData as Record<string, unknown>));
    if (pin) this.storage.savePinHash(await hashPin(pin));
    // Point de départ des 30 jours pendant lesquels le PIN seul rouvre la session.
    this.storage.saveLastOtpVerifiedAt(new Date());
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${AUTH_PATH}/logout`, {}));
    } catch {
      // Réseau absent, jeton déjà expiré, serveur indisponible : la session
      // locale doit tomber malgré tout.
    }
    this.storage.clearToken();
    this.storage.clearRefreshToken();
    this.storage.clearTempToken();
  }

  async forgetDevice(): Promise<void> {
    this.storage.clearAll();
  }

  // ── Session restaurée au démarrage ──────────────────────────────────────
  getCurrentUser(): UserModel | null {
    return this.storage.getUser();
  }

  isFirstLaunch(): boolean {
    return this.storage.isFirstLaunch();
  }

  hasLocalPin(): boolean {
    const hash = this.storage.getPinHash();
    return !!hash && hash.length > 0;
  }

  async verifyLocalPin(pin: string): Promise<boolean> {
    const stored = this.storage.getPinHash();
    if (!stored) return false;
    return stored === (await hashPin(pin));
  }

  /**
   * La vérification du compte tient-elle encore ? Le serveur est la
   * source de vérité ; hors ligne, on retombe sur l'échéance mise en
   * cache, et à défaut sur la durée de repli.
   */
  async isOtpStillFresh(): Promise<boolean> {
    const etat = await this.etatVerification();
    if (etat) {
      const echeance =
        etat.graceJusquau && etat.graceJusquau.getTime() > etat.echeanceLe.getTime()
          ? etat.graceJusquau
          : etat.echeanceLe;
      this.storage.saveEcheanceVerification(echeance);
      return etat.etat !== EtatVerification.expire;
    }

    const echeance = this.storage.getEcheanceVerification();
    if (echeance) return Date.now() < echeance.getTime();

    const dernier = this.storage.getLastOtpVerifiedAt();
    if (!dernier) return false;
    return Date.now() - dernier.getTime() < OTP_VALIDITY_MS;
  }

  async restoreSession(): Promise<{ userId: string } | null> {
    if (!this.storage.isTokenValid()) {
      // L'access token a expiré depuis la dernière ouverture : on tente un
      // rafraîchissement silencieux avant de forcer une reconnexion. Ce
      // rafraîchissement passe par l'intercepteur HTTP lui-même (toute
      // requête authentifiée le déclenche) — ici, on se contente de vérifier
      // qu'un refresh token existe encore, et on laisse la requête suivante
      // (vérification de l'OTP ci-après) le déclencher au besoin.
      if (!this.storage.getRefreshToken()) return null;
    }
    const token = this.storage.getToken();
    const user = this.storage.getUser();
    if (!token && !this.storage.getRefreshToken()) return null;
    if (!user) return null;
    return { userId: user.id };
  }

  // ── Réinitialisation du PIN ──────────────────────────────────────────────
  async requestPinReset(email: string): Promise<void> {
    const data = await this.poster('/reset-pin', { email });
    const tempToken = data['tempToken'];
    if (typeof tempToken !== 'string' || tempToken.length === 0) {
      throw new Failure('Le serveur n’a pas renvoyé de jeton de réinitialisation.');
    }
    this.storage.saveTempToken(tempToken);
    this.storage.saveParcoursOtp(ParcoursOtp.reinitialisation, this.echeanceParcours());
    this.retenirDemande(data);
  }

  /** Rend l'utilisateur si le serveur ouvre la session dans la foulée, sinon `null`. */
  async confirmPinReset(code: string, newPin: string): Promise<UserModel | null> {
    const tempToken = this.storage.getTempToken();
    if (!tempToken) throw new Failure('Cette démarche a expiré. Recommencez.');

    const data = await this.poster('/confirm-reset-pin', { tempToken, code, newPin });

    this.storage.clearTempToken();
    this.storage.clearPinAttempts();

    const accessToken = data['accessToken'];
    const refreshToken = data['refreshToken'];
    const userData = data['user'];
    if (
      typeof accessToken !== 'string' || typeof refreshToken !== 'string' ||
      !userData || typeof userData !== 'object'
    ) {
      // Repli pour un serveur antérieur à ce changement : on repart d'un
      // appareil propre, l'écran renvoie vers la connexion.
      this.storage.clearToken();
      this.storage.clearRefreshToken();
      this.storage.clearPin();
      return null;
    }

    this.storage.saveToken(accessToken, new Date(Date.now() + 15 * 60 * 1000));
    this.storage.saveRefreshToken(refreshToken);
    const utilisateur = utilisateurDepuisApi(userData as Record<string, unknown>);
    this.storage.saveUser(utilisateur);
    this.storage.savePinHash(await hashPin(newPin));
    this.storage.saveLastOtpVerifiedAt(new Date());
    return utilisateur;
  }

  /** Rend le nombre d'autres appareils déconnectés au passage. */
  async changerPin(ancienPin: string, nouveauPin: string): Promise<number> {
    const data = await this.poster('/change-pin', { ancienPin, nouveauPin });
    // L'empreinte locale sert au déverrouillage hors ligne : la laisser sur
    // l'ancien code rendrait le nouveau PIN refusé à la prochaine ouverture.
    this.storage.savePinHash(await hashPin(nouveauPin));
    this.storage.clearPinAttempts();
    const fermees = data['sessionsFermees'];
    return typeof fermees === 'number' ? fermees : 0;
  }

  /** Les niveaux entre lesquels ce compte peut changer. */
  async niveauxDuCycle(): Promise<NiveauxDuCycle> {
    try {
      const reponse = await firstValueFrom(this.http.get('/api/me/levels'));
      return niveauxDuCycleDepuisApi(donnees(reponse));
    } catch {
      return { niveaux: [] };
    }
  }

  /** Dépose une photo de profil. */
  async televerserAvatar(fichier: File): Promise<UserModel> {
    const formulaire = new FormData();
    formulaire.append('avatar', fichier, fichier.name);
    try {
      const reponse = await firstValueFrom(this.http.post('/api/profile/avatar', formulaire));
      const utilisateur = utilisateurDepuisApi(donnees(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw this.echec(e);
    }
  }

  /** Retire la photo de profil. */
  async supprimerAvatar(): Promise<UserModel> {
    try {
      const reponse = await firstValueFrom(this.http.delete('/api/profile/avatar'));
      const utilisateur = utilisateurDepuisApi(donnees(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw this.echec(e);
    }
  }

  // ── Verrouillage après échecs de PIN ─────────────────────────────────────
  /** Nombre d'échecs tolérés avant le premier blocage temporaire. */
  private static readonly TENTATIVES_LIBRES = 4;

  pinLockedUntil(): Date | null {
    const until = this.storage.getPinLockedUntil();
    if (!until) return null;
    if (Date.now() > until.getTime()) return null;
    return until;
  }

  /** Délai croissant : 30 s, 1 min, 2 min, 4 min… plafonné à 15 minutes. */
  registerPinFailure(): number {
    const tentatives = this.storage.getPinAttempts() + 1;
    this.storage.savePinAttempts(tentatives);

    if (tentatives > AuthRepository.TENTATIVES_LIBRES) {
      const palier = tentatives - AuthRepository.TENTATIVES_LIBRES;
      const secondes = Math.min(Math.max(30 * 2 ** (palier - 1), 30), 900);
      this.storage.savePinLockedUntil(new Date(Date.now() + secondes * 1000));
    }
    return tentatives;
  }

  clearPinFailures(): void {
    this.storage.clearPinAttempts();
  }

  // ── Profil ────────────────────────────────────────────────────────────────
  async changerNiveau(code: string): Promise<UserModel> {
    try {
      const reponse = await firstValueFrom(this.http.put('/api/profile', { niveau: code }));
      const utilisateur = utilisateurDepuisApi(donnees(reponse));
      this.storage.saveUser(utilisateur);
      return utilisateur;
    } catch (e) {
      throw this.echec(e);
    }
  }
}
