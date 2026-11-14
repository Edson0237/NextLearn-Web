// API publique de core/references : seulement ce que le reste de l'application consomme.

export { typeContenuDepuisJson } from './models/references.model';
export type { FiliereOption, JustificatifType, MatiereOption, OptionReference, TypeContenuOption, Universite } from './models/references.model';
export { ReferencesRepository } from './repositories/references-repository';
export { FormatsService } from './services/formats.service';
export { traduireFiliere, traduireOptionReference, traduireJustificatif } from './utils/traduire-reference';
