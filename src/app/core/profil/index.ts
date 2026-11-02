// API publique de core/profil : seulement ce que le reste de l'application consomme.

export type { ProfilStats, SuppressionRapport } from './models/profil.model';
export { ProfilRepository } from './repositories/profil-repository';
export { SessionRepository } from './repositories/session-repository';
export type { SessionAppareil } from './repositories/session-repository';
export { SupportRepository, SupportTicketStatus, libelleStatutTicket } from './repositories/support-repository';
export type { SupportTicket } from './repositories/support-repository';
export { ChangementEmailRepository } from './repositories/changement-email-repository';
export type { DemandeEmail, EtatDemande, MethodePreuve, StatutEmail } from './repositories/changement-email-repository';
