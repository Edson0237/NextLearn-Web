import { DocumentType, typeConnu } from '../bibliotheque';

export interface MatiereDuProgramme {
  readonly id: string;
  readonly nom: string;
  readonly couleur: string;
  readonly troncCommun: boolean;
  readonly visible: boolean;
}

export interface ContexteEtudiant {
  readonly resolu: boolean;
  readonly matieres: readonly MatiereDuProgramme[];
  readonly typesVisibles: readonly string[];
  readonly fonctionnalites: readonly string[];
  /** Les fonctionnalités que l'administration a explicitement fermées. */
  readonly fonctionnalitesFermees: readonly string[];
  readonly modePortee: string;
}

export const CONTEXTE_OUVERT: ContexteEtudiant = {
  resolu: false,
  matieres: [],
  typesVisibles: [],
  fonctionnalites: [],
  fonctionnalitesFermees: [],
  modePortee: 'class_only',
};

export function contexteEtudiantDepuisApi(json: Record<string, unknown>): ContexteEtudiant {
  const vraisDe = (brut: unknown): string[] => {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return [];
    return Object.entries(brut)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
  };

  const fausDe = (brut: unknown): string[] => {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return [];
    return Object.entries(brut)
      .filter(([, v]) => v === false)
      .map(([k]) => k);
  };

  const brutMatieres = Array.isArray(json['subjects']) ? json['subjects'] as unknown[] : [];
  const matieres = brutMatieres
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      id: String(m['id'] ?? ''),
      nom: String(m['name'] ?? ''),
      couleur: String(m['color'] ?? '#4F8EF7'),
      troncCommun: m['isTroncCommun'] === true,
      visible: m['visible'] !== false,
    }))
    .filter((m) => m.visible);

  const portee = json['scope'];
  return {
    resolu: json['resolved'] === true,
    matieres,
    typesVisibles: vraisDe(json['contentTypes']),
    fonctionnalites: vraisDe(json['features']),
    fonctionnalitesFermees: fausDe(json['features']),
    modePortee: portee && typeof portee === 'object' && !Array.isArray(portee)
      ? String((portee as Record<string, unknown>)['mode'] ?? 'class_only')
      : 'class_only',
  };
}

export function typeVisible(contexte: ContexteEtudiant, type: DocumentType): boolean {
  // Le contexte ne règle que les neuf formats nommés : un format créé depuis
  // l'administration n'y figure pas, et n'est donc jamais « masqué » par lui.
  if (!typeConnu(type)) return true;
  return contexte.typesVisibles.length === 0 || contexte.typesVisibles.includes(type);
}

export function fonctionnaliteOuverte(contexte: ContexteEtudiant, nom: string): boolean {
  return contexte.fonctionnalites.includes(nom);
}

/**
 * Une fonctionnalité fermée **par l'administration**.
 *
 * Distinct de `!fonctionnaliteOuverte` : tant que le contexte n'est pas chargé
 * (ou si le serveur ne répond pas), la liste des ouvertes est vide, et tout
 * lire comme « fermé » masquerait la recherche, les dépôts et le hors ligne
 * à quelqu'un dont le réseau tousse. On ne cache que ce qui est dit fermé.
 */
export function fonctionnaliteFermee(contexte: ContexteEtudiant, nom: string): boolean {
  return contexte.fonctionnalitesFermees.includes(nom);
}
