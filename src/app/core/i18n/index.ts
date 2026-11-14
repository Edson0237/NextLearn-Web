// API publique de core/i18n : seulement ce que le reste de l'application consomme.

export { TraductionPipe } from './pipes/t.pipe';
export { TraductionService, tr, langueCourante } from './services/traduction.service';
export type { Langue, PreferenceLangue } from './services/traduction.service';
