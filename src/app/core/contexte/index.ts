// API publique de core/contexte : seulement ce que le reste de l'application consomme.

export { CONTEXTE_OUVERT, fonctionnaliteFermee, typeVisible } from './models/contexte.model';
export type { MatiereDuProgramme } from './models/contexte.model';
export { ContexteRepository } from './repositories/contexte-repository';
export { ContexteService } from './services/contexte.service';
