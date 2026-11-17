// API publique de core/profil : seulement ce que le reste de l'application consomme.

export type { ProfilStats, SuppressionRapport } from './models/profil.model';
export {
  nettoyerModificationProfilEtude,
  profilEtudeDepuisApi,
} from './models/profil-etude.model';
export type {
  CompletudeProfilEtude,
  CompteProfilEtude,
  EtudeProfilData,
  FormatPrefereEtude,
  LangueDocumentEtude,
  ManquantProfilEtude,
  ModificationProfilEtude,
  ObjectifEtude,
  ProfilEtude,
} from './models/profil-etude.model';
export { ProfilRepository } from './repositories/profil-repository';
export { SessionRepository, sessionDepuisApi } from './repositories/session-repository';
export type { SessionAppareil, TypeAppareilSession } from './repositories/session-repository';
export { SupportRepository, SupportTicketStatus, libelleStatutTicket } from './repositories/support-repository';
export type { SupportTicket } from './repositories/support-repository';
export { ChangementEmailRepository } from './repositories/changement-email-repository';
export type { DemandeEmail, EtatDemande, MethodePreuve, StatutEmail } from './repositories/changement-email-repository';
