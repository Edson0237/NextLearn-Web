export interface JustificatifType {
  readonly id: string;
  readonly nom: string;
}

export interface VerificationState {
  readonly statut: 'non_soumis' | 'en_attente' | 'verifie' | 'rejete';
  readonly message?: string;
  readonly dateSoumission?: string;
}

export function justificatifTypeDepuisApi(json: Record<string, unknown>): JustificatifType {
  return {
    id: String(json['id'] ?? json['_id'] ?? ''),
    nom: String(json['nom'] ?? ''),
  };
}

export function verificationStateDepuisApi(json: Record<string, unknown>): VerificationState {
  return {
    statut: (json['statut'] ?? json['status'] ?? 'non_soumis') as VerificationState['statut'],
    message: json['message'] == null ? undefined : String(json['message']),
    dateSoumission: json['dateSoumission'] == null ? undefined : String(json['dateSoumission']),
  };
}
