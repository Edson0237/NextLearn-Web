import { inject, Injectable } from '@angular/core';
import { SecureStorageService } from '../../storage/services/secure-storage.service';

/**
 * Le blocage temporaire après des PIN erronés, sur cet appareil.
 *
 * Quatre essais sont libres ; au-delà, le délai double à chaque échec - 30 s,
 * 1 min, 2 min, 4 min… plafonné à 15 minutes. Le décompte et l'échéance sont
 * rangés dans le stockage local : fermer l'application ne remet rien à zéro.
 *
 * Ce garde-fou protège le déverrouillage local ; le serveur a le sien (blocage
 * du compte après des connexions échouées) et ne dépend pas de celui-ci.
 */
@Injectable({ providedIn: 'root' })
export class VerrouPin {
  private readonly storage = inject(SecureStorageService);

  /** Nombre d'échecs tolérés avant le premier blocage temporaire. */
  static readonly TENTATIVES_LIBRES = 4;
  private static readonly DELAI_MIN_S = 30;
  private static readonly DELAI_MAX_S = 900;

  /** Jusqu'à quand le PIN est refusé, ou `null` si le verrou est levé. */
  bloqueJusqua(): Date | null {
    const until = this.storage.getPinLockedUntil();
    if (!until) return null;
    if (Date.now() > until.getTime()) return null;
    return until;
  }

  /** Compte un échec, pose le blocage s'il y a lieu, et rend le nombre d'échecs. */
  enregistrerEchec(): number {
    const tentatives = this.storage.getPinAttempts() + 1;
    this.storage.savePinAttempts(tentatives);

    if (tentatives > VerrouPin.TENTATIVES_LIBRES) {
      const palier = tentatives - VerrouPin.TENTATIVES_LIBRES;
      const secondes = Math.min(Math.max(VerrouPin.DELAI_MIN_S * 2 ** (palier - 1), VerrouPin.DELAI_MIN_S), VerrouPin.DELAI_MAX_S);
      this.storage.savePinLockedUntil(new Date(Date.now() + secondes * 1000));
    }
    return tentatives;
  }

  /** Remet le compteur à zéro (PIN juste, ou PIN changé). */
  effacerEchecs(): void {
    this.storage.clearPinAttempts();
  }
}
