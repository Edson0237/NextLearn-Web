import { Injectable } from '@angular/core';
import { UserModel, utilisateurDepuisCache, utilisateurVersCache } from '../models/user.model';

/**
 * Stockage des jetons et de l'état d'authentification — traduction de
 * `SecureStorageService` (`lib/core/storage/secure_storage_service.dart`).
 *
 * ## La décision que ce fichier ne peut pas éviter (audit Phase 1, §2, Q2)
 *
 * `flutter_secure_storage` s'appuie sur le Keychain iOS et le Keystore
 * Android — une zone protégée par le système. **Il n'y a rien d'équivalent
 * sur le web.** Ce fichier écrit dans `localStorage`, en clair, lisible par
 * n'importe quel script qui s'exécute sur la page — exactement le risque
 * qu'un vol par injection de script (XSS) chercherait à exploiter.
 *
 * Deux alternatives existent et ont été écartées, pas oubliées :
 * - Un cookie `httpOnly` pour le refresh token exigerait une modification
 *   du backend (`nextlearn_api_v1`) et un déploiement same-origin — hors de
 *   portée de ce dépôt tant que cette modification n'est pas faite et
 *   confirmée.
 * - Une Content Security Policy stricte réduirait la surface XSS sans
 *   supprimer le risque — à poser en Phase 5, pas ici.
 *
 * En l'état, le risque est accepté et documenté, pas caché : la politique
 * de confidentialité devra le mentionner si ce choix reste définitif.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private readonly cle = {
    token: 'nl_jwt_token',
    tokenExpiry: 'nl_jwt_expiry',
    refreshToken: 'nl_refresh_token',
    user: 'nl_user_data',
    firstLaunch: 'nl_first_launch',
    lastOtp: 'nl_last_otp_verified_at',
    pinAttempts: 'nl_pin_failed_attempts',
    pinLockedUntil: 'nl_pin_locked_until',
    tempToken: 'nl_temp_token',
    parcoursOtp: 'nl_otp_parcours',
    parcoursOtpEcheance: 'nl_otp_parcours_echeance',
    pinHash: 'nl_pin_hash',
    echeanceVerif: 'echeance_verification',
  } as const;

  private lire(cle: string): string | null {
    try {
      return localStorage.getItem(cle);
    } catch {
      return null;
    }
  }

  private ecrire(cle: string, valeur: string): void {
    try {
      localStorage.setItem(cle, valeur);
    } catch {
      // Stockage plein ou bloqué (navigation privée) : la session continue
      // pour l'onglet courant, elle ne survivra simplement pas à sa fermeture.
    }
  }

  private effacer(cle: string): void {
    try {
      localStorage.removeItem(cle);
    } catch {
      // Rien à faire de plus : l'absence d'écriture n'est pas une absence
      // de lecture, la clé reste visible mais n'est plus utilisée.
    }
  }

  // ── Jeton d'accès ────────────────────────────────────────────────────────
  saveToken(token: string, expiry: Date): void {
    this.ecrire(this.cle.token, token);
    this.ecrire(this.cle.tokenExpiry, expiry.toISOString());
  }

  getToken(): string | null {
    return this.lire(this.cle.token);
  }

  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const brut = this.lire(this.cle.tokenExpiry);
    if (!brut) return false;
    const expiry = new Date(brut);
    return !Number.isNaN(expiry.getTime()) && Date.now() < expiry.getTime();
  }

  clearToken(): void {
    this.effacer(this.cle.token);
    this.effacer(this.cle.tokenExpiry);
  }

  // ── Jeton temporaire (inscription, 2FA, PIN oublié) ─────────────────────
  // Volontairement séparé du jeton d'accès : un rafraîchissement déclenché
  // en arrière-plan ne doit jamais écraser un jeton de réinitialisation en
  // cours d'usage — ils n'ont ni la même portée ni le même destinataire.
  saveTempToken(token: string): void {
    this.ecrire(this.cle.tempToken, token);
  }

  getTempToken(): string | null {
    return this.lire(this.cle.tempToken);
  }

  clearTempToken(): void {
    this.effacer(this.cle.tempToken);
    this.effacer(this.cle.parcoursOtp);
    this.effacer(this.cle.parcoursOtpEcheance);
  }

  // ── Étape du parcours en cours ───────────────────────────────────────────
  saveParcoursOtp(parcours: string, echeance: Date): void {
    this.ecrire(this.cle.parcoursOtp, parcours);
    this.ecrire(this.cle.parcoursOtpEcheance, echeance.toISOString());
  }

  getParcoursOtp(): string | null {
    return this.lire(this.cle.parcoursOtp);
  }

  getEcheanceParcoursOtp(): Date | null {
    const brut = this.lire(this.cle.parcoursOtpEcheance);
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ── Refresh token ────────────────────────────────────────────────────────
  saveRefreshToken(token: string): void {
    this.ecrire(this.cle.refreshToken, token);
  }

  getRefreshToken(): string | null {
    return this.lire(this.cle.refreshToken);
  }

  clearRefreshToken(): void {
    this.effacer(this.cle.refreshToken);
  }

  // ── Utilisateur ──────────────────────────────────────────────────────────
  saveUser(user: UserModel): void {
    this.ecrire(this.cle.user, JSON.stringify(utilisateurVersCache(user)));
  }

  getUser(): UserModel | null {
    const brut = this.lire(this.cle.user);
    if (!brut) return null;
    try {
      return utilisateurDepuisCache(JSON.parse(brut) as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  clearUser(): void {
    this.effacer(this.cle.user);
  }

  // ── PIN ──────────────────────────────────────────────────────────────────
  savePinHash(hash: string): void {
    this.ecrire(this.cle.pinHash, hash);
  }

  getPinHash(): string | null {
    return this.lire(this.cle.pinHash);
  }

  clearPin(): void {
    this.effacer(this.cle.pinHash);
  }

  // ── Dernière vérification OTP ────────────────────────────────────────────
  saveLastOtpVerifiedAt(moment: Date): void {
    this.ecrire(this.cle.lastOtp, moment.toISOString());
  }

  getLastOtpVerifiedAt(): Date | null {
    const brut = this.lire(this.cle.lastOtp);
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ── Échéance de vérification, telle que fixée par le serveur ────────────
  saveEcheanceVerification(moment: Date): void {
    this.ecrire(this.cle.echeanceVerif, moment.toISOString());
  }

  getEcheanceVerification(): Date | null {
    const brut = this.lire(this.cle.echeanceVerif);
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // ── Tentatives de PIN ────────────────────────────────────────────────────
  getPinAttempts(): number {
    const brut = this.lire(this.cle.pinAttempts);
    const n = Number(brut);
    return Number.isFinite(n) ? n : 0;
  }

  savePinAttempts(count: number): void {
    this.ecrire(this.cle.pinAttempts, String(count));
  }

  getPinLockedUntil(): Date | null {
    const brut = this.lire(this.cle.pinLockedUntil);
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  savePinLockedUntil(until: Date): void {
    this.ecrire(this.cle.pinLockedUntil, until.toISOString());
  }

  clearPinAttempts(): void {
    this.effacer(this.cle.pinAttempts);
    this.effacer(this.cle.pinLockedUntil);
  }

  // ── Premier lancement ────────────────────────────────────────────────────
  isFirstLaunch(): boolean {
    return this.lire(this.cle.firstLaunch) === null;
  }

  markLaunched(): void {
    this.ecrire(this.cle.firstLaunch, 'done');
  }

  // ── Tout effacer ─────────────────────────────────────────────────────────
  clearAll(): void {
    this.clearToken();
    this.clearRefreshToken();
    this.clearUser();
    this.clearPin();
    this.effacer(this.cle.lastOtp);
    this.clearPinAttempts();
    this.clearTempToken();
  }
}
