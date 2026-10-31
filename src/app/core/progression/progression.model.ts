/**
 * Progression — aligné sur ce que l'API renvoie réellement
 * (`/api/progression/*`) et sur les modèles Flutter
 * (`progression_repository_interface.dart`, `badge_model.dart`).
 *
 * Trois charges utiles étaient lues sous des clés inexistantes :
 * `docsTelecharges`/`heuresEtude` (qui vivent sur `/api/users/me`, pas sur
 * `/api/progression/stats`), `date` au lieu de `day`, `matiereId`/`matiereNom`
 * au lieu de `matiere`, et un badge décrit par `nom`/`icone`/`decroche` quand
 * le serveur envoie `type`/`titre`/`description`/`earnedAt`. Chaque section du
 * tableau de bord s'affichait donc vide ou à zéro, avec des données bien
 * présentes dans la réponse.
 */

export interface ProgressionStats {
  readonly totalMinutes: number;
  readonly sessionCount: number;
  readonly streak: number;
  readonly docsLus: number;
  /** Matière la plus travaillée, ou `null` si aucune session. */
  readonly matiereTop: string | null;
  /** L'action du jour est-elle déjà faite ? Sert à nuancer l'affichage de la série. */
  readonly streakDoneToday: boolean;
}

export interface DayActivity {
  /** Jour, au format ISO (`2026-10-21`) — clé `day` côté API. */
  readonly day: string;
  readonly minutes: number;
}

export interface MatiereActivity {
  readonly matiere: string;
  readonly minutes: number;
}

export interface BadgeModel {
  /** Code technique du badge (`STREAK_30`, `semaine_parfaite`…). */
  readonly type: string;
  readonly titre: string;
  readonly description: string;
  /** Date d'obtention. Un badge renvoyé par l'API est, par définition, acquis. */
  readonly earnedAt: string;
}

export interface StudySession {
  readonly id: string;
  readonly documentId?: string;
  readonly documentTitre?: string;
  readonly dureeSecondes: number;
  readonly pagesLues: number;
  readonly date: string;
}

const nombre = (v: unknown): number => (typeof v === 'number' ? v : 0);
const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));

export function statsDepuisApi(json: Record<string, unknown>): ProgressionStats {
  return {
    totalMinutes: nombre(json['totalMinutes']),
    sessionCount: nombre(json['sessionCount']),
    streak: nombre(json['streak']),
    docsLus: nombre(json['docsLus']),
    matiereTop: json['matiereTop'] == null ? null : String(json['matiereTop']),
    streakDoneToday: json['streakDoneToday'] === true,
  };
}

export function jourDepuisApi(json: Record<string, unknown>): DayActivity {
  return { day: texte(json['day']), minutes: nombre(json['minutes']) };
}

export function matiereDepuisApi(json: Record<string, unknown>): MatiereActivity {
  return { matiere: texte(json['matiere'], 'Autre'), minutes: nombre(json['minutes']) };
}

export function badgeDepuisApi(json: Record<string, unknown>): BadgeModel {
  return {
    type: texte(json['type']),
    titre: texte(json['titre'], 'Badge'),
    description: texte(json['description']),
    earnedAt: texte(json['earnedAt']),
  };
}

export function sessionDepuisApi(json: Record<string, unknown>): StudySession {
  return {
    id: texte(json['id'] ?? json['_id']),
    documentId: json['documentId'] == null ? undefined : String(json['documentId']),
    documentTitre: json['documentTitre'] == null ? undefined : String(json['documentTitre']),
    dureeSecondes: nombre(json['dureeSecondes']),
    pagesLues: nombre(json['pagesLues']),
    date: texte(json['date']),
  };
}
