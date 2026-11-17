// API publique de core/auth : seulement ce que le reste de l'application consomme.

export { estAuthentifie } from './models/auth.model';
export type { AuthState } from './models/auth.model';
export { AuthRepository, configGithubDepuisApi } from './repositories/auth-repository';
export type { ConfigGithub, ProfilGithub, ProfilGoogle, ReponseGithub, ReponseGoogle } from './repositories/auth-repository';
export { Appareil } from './services/appareil';
export { AuthService } from './services/auth.service';
export { BiometricService } from './services/biometric.service';
export { GoogleIdentite } from './services/google-identite';
export { GithubIdentite, calculerPkceChallengeS256, genererEtatOAuth, genererPkceVerifier, versBase64Url } from './services/github-identite';
export type { RetourOAuthGithub } from './services/github-identite';
export { validerPin } from './services/pin-policy';
export { Consentements } from './services/consentements';
