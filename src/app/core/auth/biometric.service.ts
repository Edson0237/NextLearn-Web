import { Injectable } from '@angular/core';

/**
 * Déverrouillage biométrique — traduction de `BiometricService`
 * (`lib/core/security/biometric_service.dart`).
 *
 * **Volontairement un stub pour l'instant** : le contrat Flutter lui-même
 * est « jamais d'exception, juste `false` » (le service capture déjà
 * `MissingPluginException` sur le web) — cette dégradation silencieuse
 * est donc le comportement normal documenté, pas une impasse de ce
 * portage. L'équivalent web (WebAuthn / Credential Management API) reste
 * un risque non tranché de l'audit Phase 1 (§... iOS 16.4+, PWA installée
 * requise, jamais garanti) : décider où la clé se crée — à la pose du PIN,
 * ailleurs — et comment elle se révoque dépasse la construction d'un
 * écran et attend une décision dédiée.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async authenticate(): Promise<boolean> {
    return false;
  }
}
