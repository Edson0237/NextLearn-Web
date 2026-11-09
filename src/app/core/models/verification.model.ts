/**
 * Statut du dossier de vérification académique - traduction de
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
  const normalise = String(s ?? '').toLowerCase().trim();
  switch (normalise) {
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
export function bloqueAcces(v: VerificationState, user?: { role?: string; verificationStatus?: string } | null): boolean {
  if (user?.role && user.role !== 'etudiant' && user.role !== 'user') return false;
  const userStatus = user?.verificationStatus ? String(user.verificationStatus).toLowerCase().trim() : null;
  if (userStatus) {
    return userStatus !== 'approuve' && userStatus !== 'approved';
  }
  return v.requis && !estApprouve(v.statut);
}

export type VerificationDestination = 'verification' | 'verification/attente';

/**
 * Détermine si le compte nécessite une étape de vérification académique.
 * Retourne le chemin de redirection ('verification' ou 'verification/attente'),
 * ou `null` si le compte est valide / standard (accès libre).
 */
export function determinerDestinationVerification(
  user: { role?: string; verificationStatus?: string } | undefined | null,
  verif: VerificationState,
): VerificationDestination | null {
  if (user?.role && user.role !== 'etudiant' && user.role !== 'user') {
    return null;
  }

  // 1. Contrôle par le statut porté sur l'utilisateur
  const userStatus = user?.verificationStatus ? String(user.verificationStatus).toLowerCase().trim() : null;
  if (userStatus) {
    if (userStatus === 'approuve' || userStatus === 'approved') {
      return null;
    }
    if (
      userStatus === 'requis' ||
      userStatus === 'infos_complementaires_requises' ||
      userStatus === 'rejete' ||
      userStatus === 'rejected'
    ) {
      return 'verification';
    }
    if (
      userStatus === 'en_attente' ||
      userStatus === 'pending' ||
      userStatus === 'en_revue' ||
      userStatus === 'in_review'
    ) {
      return 'verification/attente';
    }
  }

  // 2. Contrôle par le service de vérification
  if (verif.requis && !estApprouve(verif.statut)) {
    return demandeAction(verif.statut) ? 'verification' : 'verification/attente';
  }

  return null;
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
