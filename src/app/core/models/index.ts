// API publique de core/models : seulement ce que le reste de l'application consomme.

export { EtatVerification, StatutDemandeOtp, cycleVerificationDepuisJson, demandeOtpDepuisJson, enFile } from './demande-otp.model';
export type { CycleVerification, DemandeOtp } from './demande-otp.model';
export { DOMAINE_VIDE, EtatDomaine, reponseDomaineDepuisJson } from './domaine.model';
export type { ReponseDomaine } from './domaine.model';
export { Failure } from './failure.model';
export { DUREE_REPRISABLE_OTP_MS, ParcoursOtp, parcoursOtpDepuisCode } from './parcours-otp.model';
export { Cycle, Langue, NiveauEtude, cycleDepuisApi, cycleVersApi, initiales, libelleNiveau, niveauCourt, niveauDepuisTexte, niveauxDuCycleDepuisApi, nomComplet, utilisateurDepuisApi, utilisateurDepuisCache, utilisateurVersCache } from './user.model';
export type { NiveauxDuCycle, SectionAcademique, SectionPreference, UserModel } from './user.model';
export { VERIFICATION_AUCUNE, VerificationStatut, bloqueAcces, demandeAction, estApprouve, verificationDepuisJson, determinerDestinationVerification } from './verification.model';
export type { VerificationState, VerificationDestination } from './verification.model';
