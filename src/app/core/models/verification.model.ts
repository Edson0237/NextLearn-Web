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

  // Si approuvé côté serveur ou côté profil : jamais bloqué
  if (
    userStatus === 'approuve' ||
    userStatus === 'approved' ||
    estApprouve(v.statut) ||
    (!v.requis && userStatus !== 'requis')
  ) {
    return false;
  }

  if (userStatus) {
    return true;
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

  const userStatus = user?.verificationStatus ? String(user.verificationStatus).toLowerCase().trim() : null;

  // 1. Dossier approuvé (côté serveur ou profil local) ou compte standard sans contrainte : accès libre !
  if (
    userStatus === 'approuve' ||
    userStatus === 'approved' ||
    estApprouve(verif.statut) ||
    (!verif.requis && userStatus !== 'requis')
  ) {
    return null;
  }

  // 2. Dossier en cours de revue / attente de décision administrative
  if (
    verif.statut === VerificationStatut.enAttente ||
    verif.statut === VerificationStatut.enRevue ||
    userStatus === 'en_attente' ||
    userStatus === 'pending' ||
    userStatus === 'en_revue' ||
    userStatus === 'in_review'
  ) {
    return 'verification/attente';
  }

  // 3. Dossier demandant une action de l'étudiant (dépôt initial, complément ou resoumission)
  if (
    (verif.requis && demandeAction(verif.statut)) ||
    userStatus === 'requis' ||
    userStatus === 'infos_complementaires_requises' ||
    userStatus === 'rejete' ||
    userStatus === 'rejected'
  ) {
    return 'verification';
  }

  // 4. Par défaut, si requis mais non approuvé
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
