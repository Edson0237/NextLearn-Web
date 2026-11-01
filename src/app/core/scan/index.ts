// API publique de core/scan : seulement ce que le reste de l'application consomme.

export { Numerisation, ScanTransfert } from './services/numerisation';
export type { PageNumerisee } from './services/numerisation';
export { assemblerPdf } from './utils/pdf-assembleur';
