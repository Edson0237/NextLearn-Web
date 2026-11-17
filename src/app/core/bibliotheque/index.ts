// API publique de core/bibliotheque : seulement ce que le reste de l'application consomme.

export { DocumentType, enregistrerFormatsServeur, formatServeur, labelTypeDocument, metaDocument, noteDocument, typeConnu, typeDocumentDepuisApi } from './models/document.model';
export type { DocumentModel } from './models/document.model';
export {
  DIMENSIONS_CATALOGUE,
  FACETTES_VIDES,
  cleCacheCatalogue,
  codeFacetteString,
  reponseCatalogueDepuisApi,
  ressourceCarteDepuisApi,
  ressourceVersDocumentModel,
  sectionCatalogueDepuisPreference,
} from './models/catalogue.model';
export type {
  ClasseConsultation,
  ContexteClasseBibliotheque,
  DimensionCatalogue,
  Facettes,
  FiltreSectionCatalogue,
  FiltresActifsCatalogue,
  ModeClasse,
  ReponseCatalogue,
  RequeteCatalogue,
  RessourceCarte,
  TriCatalogue,
  ValeurFacette,
} from './models/catalogue.model';
export { ClasseBibliothequeService } from './services/classe-bibliotheque.service';
export { DocumentsRepository } from './repositories/documents-repository';
export { FavorisRepository } from './repositories/favoris-repository';
export { LectureProgressRepository, pourcentageLu } from './repositories/lecture-progress-repository';
export type { LectureProgress } from './repositories/lecture-progress-repository';
export { OfflineRepository } from './repositories/offline-repository';
export {
  StockageHorsLigne,
  calculerVersionDocument,
  formaterTailleOctets,
} from './services/stockage-hors-ligne';
export type {
  EnregistrementDocumentLocal,
  EtatStockageLocal,
  InfoDocumentLocal,
  LectureLocaleDocument,
  OptionsEnregistrementLocal,
  RaisonEchecStockage,
  ResultatEnregistrementLocal,
} from './services/stockage-hors-ligne';
export {
  detecterFormatDocument,
  detecterFormatParEntete,
  detecterFormatParMime,
  detecterFormatParUrl,
} from './utils/detection-format';
export type { FormatDocument } from './utils/detection-format';
