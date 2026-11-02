// API publique de core/epreuves : seulement ce que le reste de l'application consomme.

export { TypeEpreuve, typeEpreuveVersApi, typeEpreuveCourt, typeEpreuveCle } from './models/epreuve.model';
export type { EpreuveModel } from './models/epreuve.model';
export { EpreuvesRepository } from './repositories/epreuves-repository';
