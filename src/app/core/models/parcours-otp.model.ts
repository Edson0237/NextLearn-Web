/**
 * L'étape d'authentification laissée en plan — traduction de
 * `lib/domains/auth/domain/models/parcours_otp.dart`.
 *
 * Trois démarches passent par un code reçu par e-mail — s'inscrire, ouvrir
 * une session, récupérer un PIN oublié — et toutes trois obligent à
 * quitter l'application pour le relever. Sans mémoriser *laquelle* est en
 * cours, le retour perdait la démarche et forçait à redemander un code,
 * pris sur un quota quotidien.
 */
export enum ParcoursOtp {
  /** Code de vérification de l'adresse, à l'inscription. */
  inscription = 'inscription',
  /** Adresse vérifiée, PIN pas encore choisi. */
  definitionPin = 'pin',
  /** Second facteur d'une connexion dont le PIN est déjà validé. */
  connexion = 'connexion',
  /** Code de récupération d'un PIN oublié. */
  reinitialisation = 'reinitialisation',
}

/**
 * Combien de temps une démarche reste reprenable — quinze minutes, la
 * durée de vie du jeton temporaire côté serveur. Passé ce délai, le jeton
 * est refusé avant même que le code ne soit regardé.
 */
export const DUREE_REPRISABLE_OTP_MS = 15 * 60 * 1000;

export function parcoursOtpDepuisCode(code: string | null | undefined): ParcoursOtp | null {
  if (!code) return null;
  const trouve = Object.values(ParcoursOtp).find((p) => p === code);
  // Code inconnu (version antérieure, écriture corrompue) : on préfère
  // l'ignorer plutôt que d'enfermer sur un écran qu'on ne sait pas nommer.
  return trouve ?? null;
}
