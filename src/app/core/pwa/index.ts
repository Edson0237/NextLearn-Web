// API publique de core/pwa : seulement ce que le reste de l'application consomme.

export { InstallationService } from './services/installation.service';
export { MiseAJourService } from './services/mise-a-jour.service';
export { casInstallation, navigateursProposes } from './utils/cas-installation';
export type { CasInstallation } from './utils/cas-installation';
export type { Environnement, Navigateur, Systeme } from './utils/environnement';
