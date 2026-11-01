// API publique de core/progression : seulement ce que le reste de l'application consomme.

export { badgeDepuisApi, jourDepuisApi, matiereDepuisApi, statsDepuisApi } from './models/progression.model';
export type { BadgeModel, DayActivity, MatiereActivity, ProgressionStats, StudySession } from './models/progression.model';
export { ProgressionRepository } from './repositories/progression-repository';
