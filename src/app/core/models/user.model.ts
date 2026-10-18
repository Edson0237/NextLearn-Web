/**
 * Modèle utilisateur et référentiels académiques — traduction de
 * `lib/core/models/user_model.dart`.
 */

/** Niveaux d'étude, alignés sur le référentiel backend (N1..N5). */
export enum NiveauEtude {
  n1 = 'n1',
  n2 = 'n2',
  n3 = 'n3',
  n4 = 'n4',
  n5 = 'n5',
}

/** Cycles proposés par les écoles Saint Jean. */
export enum Cycle {
  prepa = 'prepa',
  ingenieur = 'ingenieur',
  licence = 'licence',
  licencePro = 'licencePro',
  master = 'master',
}

export enum Langue {
  fr = 'fr',
  en = 'en',
}

const RANG: Readonly<Record<NiveauEtude, number>> = {
  [NiveauEtude.n1]: 1,
  [NiveauEtude.n2]: 2,
  [NiveauEtude.n3]: 3,
  [NiveauEtude.n4]: 4,
  [NiveauEtude.n5]: 5,
};

export function rangNiveau(n: NiveauEtude): number {
  return RANG[n];
}

/** Valeur attendue par le backend (`N1`..`N5`). */
export function niveauCourt(n: NiveauEtude): string {
  return `N${rangNiveau(n)}`;
}

/**
 * Libellé contextualisé par le cycle — un niveau seul ne veut rien dire :
 * « N4 » est la quatrième année d'ingénieur chez l'un et le Master 1 chez
 * l'autre.
 */
export function libelleNiveau(n: NiveauEtude, cycle?: Cycle | null): string {
  const rang = rangNiveau(n);
  switch (cycle) {
    case Cycle.master: return `Master ${rang - 3}`;
    case Cycle.licencePro: return `Licence Pro ${rang}`;
    case Cycle.licence: return `Licence ${rang}`;
    case Cycle.ingenieur: return `Ingénieur ${rang}`;
    case Cycle.prepa: return `Prépa ${rang}`;
    default: return `Niveau ${rang}`;
  }
}

const NIVEAU_LEGACY: Readonly<Record<string, NiveauEtude>> = {
  L1: NiveauEtude.n1, L2: NiveauEtude.n2, L3: NiveauEtude.n3,
  M1: NiveauEtude.n4, M2: NiveauEtude.n5,
};

export function niveauDepuisTexte(s: string): NiveauEtude {
  const normalise = s.toLowerCase();
  const trouve = Object.values(NiveauEtude).find((v) => v === normalise);
  if (trouve) return trouve;
  // Tolère l'ancienne notation L1..M2 le temps que les comptes migrent.
  return NIVEAU_LEGACY[s.toUpperCase()] ?? NiveauEtude.n1;
}

const CYCLE_API: Readonly<Record<Cycle, string>> = {
  [Cycle.prepa]: 'PREPA',
  [Cycle.ingenieur]: 'INGENIEUR',
  [Cycle.licence]: 'LICENCE',
  [Cycle.licencePro]: 'LICENCE_PRO',
  [Cycle.master]: 'MASTER',
};

export function cycleVersApi(c: Cycle): string {
  return CYCLE_API[c];
}

export function cycleDepuisApi(s: string | null | undefined): Cycle | undefined {
  switch (s) {
    case 'PREPA': return Cycle.prepa;
    case 'INGENIEUR': return Cycle.ingenieur;
    case 'LICENCE': return Cycle.licence;
    case 'LICENCE_PRO': return Cycle.licencePro;
    case 'MASTER': return Cycle.master;
    default: return undefined;
  }
}

export function langueDepuisTexte(s: string | null | undefined): Langue {
  return s === 'en' ? Langue.en : Langue.fr;
}

export interface UserModel {
  readonly id: string;
  readonly email: string;
  readonly nom: string;
  readonly prenom: string;
  readonly universite: string;
  readonly filiere: string;
  readonly niveau: NiveauEtude;
  /** Désambiguïse le niveau à l'affichage. */
  readonly cycle?: Cycle;
  readonly langue: Langue;
  readonly avatarUrl?: string;
  readonly verificationStatus?: string;
}

export function nomComplet(u: UserModel): string {
  return `${u.prenom} ${u.nom}`;
}

export function initiales(u: UserModel): string {
  const p = u.prenom.length > 0 ? u.prenom[0].toUpperCase() : '';
  const n = u.nom.length > 0 ? u.nom[0].toUpperCase() : '';
  return `${p}${n}`;
}

/** Depuis la réponse du backend — tolérant aux champs manquants. */
export function utilisateurDepuisApi(json: Record<string, unknown>): UserModel {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  return {
    id: texte(json['id']),
    email: texte(json['email']),
    nom: texte(json['nom']),
    prenom: texte(json['prenom']),
    universite: texte(json['universite']),
    filiere: texte(json['filiere']),
    niveau: niveauDepuisTexte(texte(json['niveau'], 'N1')),
    cycle: cycleDepuisApi(json['cycle'] == null ? undefined : String(json['cycle'])),
    langue: langueDepuisTexte(json['langue'] == null ? undefined : String(json['langue'])),
    avatarUrl: json['avatarUrl'] == null ? undefined : String(json['avatarUrl']),
    verificationStatus:
      json['verificationStatus'] == null ? undefined : String(json['verificationStatus']),
  };
}

/** Depuis le cache local (`toMap`/`fromMap` côté Flutter). */
export function utilisateurDepuisCache(json: Record<string, unknown>): UserModel {
  return utilisateurDepuisApi(json);
}

export function utilisateurVersCache(u: UserModel): Record<string, unknown> {
  return {
    id: u.id, email: u.email, nom: u.nom, prenom: u.prenom,
    universite: u.universite, filiere: u.filiere, niveau: u.niveau,
    cycle: u.cycle ? cycleVersApi(u.cycle) : undefined,
    langue: u.langue, avatarUrl: u.avatarUrl, verificationStatus: u.verificationStatus,
  };
}
