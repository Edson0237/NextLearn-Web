/**
 * Statut du dossier de vérification académique — traduction de
 * `lib/domains/verification/domain/models/verification_model.dart`.
 */
export enum VerificationStatut {
  requis = 'requis',
  enAttente = 'en_attente',
  enRevue = 'en_revue',
  infosComplementairesRequises = 'infos_complementaires_requises',
  approuve = 'approuve',
  rejete = 'rejete',
}

export function statutVerificationDepuisApi(s: string | null | undefined): VerificationStatut {
  switch (s) {
    case 'en_attente': return VerificationStatut.enAttente;
    case 'en_revue': return VerificationStatut.enRevue;
    case 'infos_complementaires_requises': return VerificationStatut.infosComplementairesRequises;
    case 'approuve': return VerificationStatut.approuve;
    case 'rejete': return VerificationStatut.rejete;
    default: return VerificationStatut.requis;
  }
}

/** Le dossier est-il tranché favorablement ? Seul ce cas ouvre l'accès. */
export function estApprouve(s: VerificationStatut): boolean {
  return s === VerificationStatut.approuve;
}

/** L'étudiant doit-il agir (premier dépôt, complément ou resoumission) ? */
export function demandeAction(s: VerificationStatut): boolean {
  return (
    s === VerificationStatut.requis ||
    s === VerificationStatut.infosComplementairesRequises ||
    s === VerificationStatut.rejete
  );
}

export interface VerificationState {
  /** `false` = compte standard, aucun dossier attendu. */
  readonly requis: boolean;
  readonly statut: VerificationStatut;
  readonly motifRejet?: string;
  readonly messageComplement?: string;
  readonly tentatives: number;
  readonly resoumissionsRestantes: number;
  readonly submittedAt?: Date;
}

/** L'accès au contenu est-il verrouillé faute de dossier validé ? */
export function bloqueAcces(v: VerificationState): boolean {
  return v.requis && !estApprouve(v.statut);
}

/** Compte standard : aucun dossier, aucun blocage. */
export const VERIFICATION_AUCUNE: VerificationState = {
  requis: false,
  statut: VerificationStatut.approuve,
  tentatives: 0,
  resoumissionsRestantes: 0,
};

export function verificationDepuisJson(json: Record<string, unknown>): VerificationState {
  const motifTexte = json['motifRejetTexte'];
  const motif =
    typeof motifTexte === 'string' && motifTexte.length > 0
      ? motifTexte
      : (json['motifRejetCode'] as string | undefined);
  const soumisLe = json['submittedAt'] ? new Date(String(json['submittedAt'])) : undefined;

  return {
    requis: json['requis'] === true,
    statut: statutVerificationDepuisApi(json['statut'] as string | undefined),
    motifRejet: motif,
    messageComplement: json['messageComplement'] as string | undefined,
    tentatives: typeof json['tentatives'] === 'number' ? json['tentatives'] : 0,
    resoumissionsRestantes:
      typeof json['resoumissionsRestantes'] === 'number' ? json['resoumissionsRestantes'] : 0,
    submittedAt: soumisLe && !Number.isNaN(soumisLe.getTime()) ? soumisLe : undefined,
  };
}
