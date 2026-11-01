// API publique de core/i18n : seulement ce que le reste de l'application consomme.

export { TraductionPipe } from './pipes/t.pipe';
export { TraductionService, tr } from './services/traduction.service';
export type { PreferenceLangue } from './services/traduction.service';
