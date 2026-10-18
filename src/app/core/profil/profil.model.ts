/**
 * Modèles du domaine Profil — traduction de
 * `lib/domains/profil/domain/repositories/profil_repository_interface.dart`.
 */

/**
 * Statistiques affichées sur le profil. Le streak vient du domaine
 * Progression (`/api/progression/stats`) pour éviter la divergence entre
 * les deux écrans — la source elle-même a unifié ce compteur ici.
 */
export interface ProfilStats {
  readonly docsTelecharges: number;
  readonly docsLus: number;
  readonly heuresEtude: number;
  readonly streak: number;
}

export function profilStatsDepuisApi(json: Record<string, unknown>): ProfilStats {
  return {
    docsTelecharges: Math.round((json['docsTelecharges'] as number) ?? 0),
    docsLus: Math.round((json['docsLus'] as number) ?? 0),
    heuresEtude: Math.round((json['heuresEtude'] as number) ?? 0),
    streak: Math.round((json['streak'] as number) ?? 0),
  };
}

/** Rapport rendu après une suppression définitive de compte. */
export interface SuppressionRapport {
  readonly elementsEffaces: number;
  readonly justificatifsPurges: number;
  readonly justificatifsEnEchec: number;
}

export function suppressionRapportDepuisApi(json: Record<string, unknown>): SuppressionRapport {
  const supprime = (json['supprime'] as Record<string, number>) ?? {};
  const elementsEffaces = Object.values(supprime).reduce((somme, v) => somme + (typeof v === 'number' ? v : 0), 0);
  return {
    elementsEffaces,
    justificatifsPurges: Math.round((json['justificatifsPurges'] as number) ?? 0),
    justificatifsEnEchec: Math.round((json['justificatifsEnEchec'] as number) ?? 0),
  };
}
