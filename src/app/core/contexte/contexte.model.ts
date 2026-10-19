import { DocumentType } from '../bibliotheque/document.model';

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
  readonly modePortee: string;
}

export const CONTEXTE_OUVERT: ContexteEtudiant = {
  resolu: false,
  matieres: [],
  typesVisibles: [],
  fonctionnalites: [],
  modePortee: 'class_only',
};

export function contexteEtudiantDepuisApi(json: Record<string, unknown>): ContexteEtudiant {
  const vraisDe = (brut: unknown): string[] => {
    if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return [];
    return Object.entries(brut)
      .filter(([, v]) => v === true)
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
    modePortee: portee && typeof portee === 'object' && !Array.isArray(portee)
      ? String((portee as Record<string, unknown>)['mode'] ?? 'class_only')
      : 'class_only',
  };
}

export function typeVisible(contexte: ContexteEtudiant, type: DocumentType): boolean {
  return contexte.typesVisibles.length === 0 || contexte.typesVisibles.includes(type);
}

export function fonctionnaliteOuverte(contexte: ContexteEtudiant, nom: string): boolean {
  return contexte.fonctionnalites.includes(nom);
}
