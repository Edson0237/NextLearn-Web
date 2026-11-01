// API publique de core/contributions : seulement ce que le reste de l'application consomme.

export { DepotLicence, DepotStatut, LICENCES_PROPOSEES, anneesAcademiquesProposees, libelleDepotStatut } from './models/depot.model';
export type { Depot } from './models/depot.model';
export { DepotRepository } from './repositories/depot-repository';
