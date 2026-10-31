import { Cycle, NiveauEtude, UserModel } from '../models/user.model';
import { DemandeOtp } from '../models/demande-otp.model';
import { ParcoursOtp } from '../models/parcours-otp.model';

/** Justificatif retenu le temps de l'inscription, jusqu'à la validation du PIN. */
/**
 * L'issue d'une tentative de connexion.
 *
 * `'session'` n'existait pas : la connexion passait forcément par un code.
 * Depuis que le serveur reconnaît les appareils, elle peut aboutir d'un
 * coup, et l'écran doit savoir s'il enchaîne sur la saisie du code ou sur
 * l'accueil.
 */
/** `google` : l'appareil est nouveau et l'adresse est gérée par Google — la preuve passe par le bouton Google, aucun code ne part. */
export type ResultatConnexion = 'session' | 'otp' | 'google' | 'echec';

export interface PendingJustificatif {
  readonly type: string;
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly matricule?: string;
}

/** État d'authentification — traduction d'`AuthState` (`auth_provider.dart`). */
export interface AuthState {
  readonly user?: UserModel;
  /** Opération en cours (login, OTP, register…) — pour les spinners de boutons.
   * NE déclenche PAS de redirection vers le splash. */
  readonly isLoading: boolean;
  /** Démarrage de l'app uniquement — restaure la session. Le routeur reste
   * sur le splash tant que ce drapeau est vrai. */
  readonly isInitializing: boolean;
  /** Session valide mais verrouillée : juste retaper le PIN pour rouvrir. */
  readonly isLocked: boolean;
  readonly error?: string;
  readonly isFirstLaunch: boolean;
  readonly demandeOtp?: DemandeOtp;
  readonly parcoursOtp?: ParcoursOtp;

  // Données temporaires pendant l'inscription multi-étapes.
  readonly pendingEmail?: string;
  readonly pendingNom?: string;
  readonly pendingPrenom?: string;
  readonly pendingUniversite?: string;
  readonly pendingFiliere?: string;
  readonly pendingNiveau?: NiveauEtude;
  readonly pendingCycle?: Cycle;
  readonly pendingJustificatif?: PendingJustificatif;
}

export const ETAT_INITIAL: AuthState = {
  isLoading: false,
  isInitializing: true,
  isLocked: false,
  isFirstLaunch: false,
};

export function estAuthentifie(s: AuthState): boolean {
  return s.user !== undefined;
}
