// API publique de core/scan : seulement ce que le reste de l'application consomme.

export { Numerisation, ScanTransfert } from './services/numerisation';
export type { PageNumerisee, Retouche } from './services/numerisation';
export { assemblerPdf } from './utils/pdf-assembleur';
export { verifierPdf } from './utils/verifier-pdf';
export { PLEIN_CADRE, quadValide } from './utils/geometrie';
export type { Point, Quad } from './utils/geometrie';
export { detecterCoins } from './utils/detection-bords';
export { REGLAGES_PAR_DEFAUT } from './utils/filtres-image';
export type { ModeScan, Reglages } from './utils/filtres-image';
