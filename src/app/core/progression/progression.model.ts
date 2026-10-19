export interface ProgressionStats {
  readonly docsTelecharges: number;
  readonly docsLus: number;
  readonly heuresEtude: number;
  readonly totalMinutes: number;
  readonly streak: number;
}

export interface DayActivity {
  readonly date: string;
  readonly minutes: number;
}

export interface MatiereActivity {
  readonly matiereId: string;
  readonly matiereNom: string;
  readonly minutes: number;
}

export interface BadgeModel {
  readonly id: string;
  readonly nom: string;
  readonly description: string;
  readonly icone: string;
  readonly decroche: boolean;
  readonly dateDecroche?: string;
}

export interface StudySession {
  readonly id: string;
  readonly documentId?: string;
  readonly documentTitre?: string;
  readonly dureeSecondes: number;
  readonly pagesLues: number;
  readonly date: string;
}

export function statsDepuisApi(json: Record<string, unknown>): ProgressionStats {
  const nombre = (v: unknown): number => (typeof v === 'number' ? v : 0);
  return {
    docsTelecharges: nombre(json['docsTelecharges']),
    docsLus: nombre(json['docsLus']),
    heuresEtude: nombre(json['heuresEtude']),
    totalMinutes: nombre(json['totalMinutes']),
    streak: nombre(json['streak']),
  };
}

export function badgeDepuisApi(json: Record<string, unknown>): BadgeModel {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  return {
    id: texte(json['id'] ?? json['_id']),
    nom: texte(json['nom']),
    description: texte(json['description']),
    icone: texte(json['icone']),
    decroche: Boolean(json['decroche'] ?? json['unlocked']),
    dateDecroche: json['dateDecroche'] == null ? undefined : String(json['dateDecroche']),
  };
}

export function sessionDepuisApi(json: Record<string, unknown>): StudySession {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  return {
    id: texte(json['id'] ?? json['_id']),
    documentId: json['documentId'] == null ? undefined : String(json['documentId']),
    documentTitre: json['documentTitre'] == null ? undefined : String(json['documentTitre']),
    dureeSecondes: typeof json['dureeSecondes'] === 'number' ? json['dureeSecondes'] : 0,
    pagesLues: typeof json['pagesLues'] === 'number' ? json['pagesLues'] : 0,
    date: texte(json['date']),
  };
}
