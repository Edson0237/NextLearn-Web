/**
 * État d'une demande de code OTP, tel que le serveur le décrit —
 * traduction de `lib/domains/auth/domain/models/demande_otp.dart`.
 *
 * Rien n'est calculé côté client : ni la position, ni le quota restant.
 * Un client qui l'estimerait de son côté afficherait un chiffre faux dès
 * qu'un autre appareil demanderait un code.
 */
export enum StatutDemandeOtp {
  /** Le code est parti. L'écran de saisie a un sens. */
  envoye = 'envoye',
  /** La demande attend son tour. Aucun code n'existe encore. */
  enAttente = 'en_attente',
  /** Refusée — plafond individuel atteint, ou file fermée. */
  refuse = 'refuse',
  /** Aucune demande en cours pour ce compte. */
  aucune = 'aucune',
}

export interface DemandeOtp {
  readonly statut: StatutDemandeOtp;
  readonly message: string;
  /** Rang dans la file, 1 = servi au prochain créneau. */
  readonly position?: number;
  readonly personnesDevant?: number;
  /** Jour de traitement estimé, `AAAA-MM-JJ`. */
  readonly traitementEstimeLe?: string;
  /** Journées de quota à attendre. 0 = aujourd'hui. */
  readonly joursEstimes?: number;
  /** Secondes avant qu'un nouveau code puisse être demandé. */
  readonly renvoiPossibleDans?: number;
  /** Un code est déjà parti et reste valable : aucun nouveau n'a été envoyé. */
  readonly dejaEnvoye: boolean;
  readonly code?: string;
}

export function enFile(d: DemandeOtp): boolean {
  return d.statut === StatutDemandeOtp.enAttente;
}

export function estPartie(d: DemandeOtp): boolean {
  return d.statut === StatutDemandeOtp.envoye;
}

function statutDepuis(brut: unknown): StatutDemandeOtp {
  switch (brut) {
    case 'envoye': return StatutDemandeOtp.envoye;
    case 'en_attente': return StatutDemandeOtp.enAttente;
    case 'refuse': return StatutDemandeOtp.refuse;
    default: return StatutDemandeOtp.aucune;
  }
}

/** `null` quand il n'y a rien à montrer — pas de demande, pas de message. */
export function demandeOtpDepuisJson(brut: unknown): DemandeOtp | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const json = brut as Record<string, unknown>;
  const statut = statutDepuis(json['statut']);
  if (statut === StatutDemandeOtp.aucune && json['message'] == null) return null;

  const entier = (v: unknown): number | undefined => {
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  return {
    statut,
    message: json['message'] == null ? '' : String(json['message']),
    position: entier(json['position']),
    personnesDevant: entier(json['personnesDevant']),
    traitementEstimeLe:
      json['traitementEstimeLe'] == null ? undefined : String(json['traitementEstimeLe']),
    joursEstimes: entier(json['joursEstimes']),
    renvoiPossibleDans: entier(json['renvoiPossibleDans']),
    dejaEnvoye: json['dejaEnvoye'] === true,
    code: json['code'] == null ? undefined : String(json['code']),
  };
}

// ── Cycle de vérification académique ────────────────────────────────────

/** Où en est le compte vis-à-vis de sa vérification périodique. */
export enum EtatVerification {
  /** Rien à faire. */
  aJour = 'a_jour',
  /** La revérification est possible. L'accès n'est pas coupé. */
  fenetreOuverte = 'fenetre_ouverte',
  /** Échéance dépassée, mais le retard vient du quota NextLearn. Accès maintenu. */
  grace = 'grace',
  /** Échéance dépassée. Une revérification est exigée. */
  expire = 'expire',
}

export interface CycleVerification {
  readonly etat: EtatVerification;
  readonly echeanceLe: Date;
  readonly fenetreOuverteLe: Date;
  readonly joursRestants: number;
  readonly graceJusquau?: Date;
  readonly retardDuAuQuota: boolean;
  readonly demandeEnCours?: DemandeOtp | null;
}

function etatVerificationDepuis(brut: unknown): EtatVerification {
  switch (brut) {
    case 'fenetre_ouverte': return EtatVerification.fenetreOuverte;
    case 'grace': return EtatVerification.grace;
    case 'expire': return EtatVerification.expire;
    default: return EtatVerification.aJour;
  }
}

export function cycleVerificationDepuisJson(json: Record<string, unknown>): CycleVerification {
  const date = (v: unknown): Date => {
    const d = new Date(String(v ?? ''));
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };
  const dateOuNull = (v: unknown): Date | undefined => {
    if (v == null) return undefined;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  return {
    etat: etatVerificationDepuis(json['etat']),
    echeanceLe: date(json['echeanceLe']),
    fenetreOuverteLe: date(json['fenetreOuverteLe']),
    joursRestants: typeof json['joursRestants'] === 'number' ? json['joursRestants'] : 0,
    graceJusquau: dateOuNull(json['graceJusquau']),
    retardDuAuQuota: json['retardDuAuQuota'] === true,
    demandeEnCours: demandeOtpDepuisJson(json['demandeEnCours']),
  };
}
