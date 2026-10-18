/**
 * Les listes dont vivent les formulaires (inscription, dépôt, vérification)
 * — traduction de `lib/domains/references/domain/models/` et de
 * `IReferencesRepository`. Toutes viennent du back-office : rien n'est
 * déclaré en dur ici, une liste écrite dans le code serait une décision
 * soustraite à l'administration.
 */

export interface Universite {
  readonly id: string;
  readonly nom: string;
  readonly ville?: string;
}

export interface FiliereOption {
  readonly id: string;
  readonly nom: string;
}

export interface MatiereOption {
  readonly id: string;
  readonly nom: string;
}

/** Option `{value, label}` à laquelle le backend ajoute parfois `id` — le
 * code est ce qui circule (comptes, documents), le libellé se renomme
 * librement depuis le back-office. */
export interface OptionReference {
  readonly id?: string;
  readonly value: string;
  readonly label: string;
}

export interface TypeContenuOption {
  readonly value: string;
  readonly label: string;
  readonly collection: string;
}

export interface JustificatifType {
  readonly value: string;
  readonly label: string;
  readonly description: string;
}

function texte(json: Record<string, unknown>, cle: string): string {
  return String(json[cle] ?? '');
}

export function universiteDepuisJson(json: Record<string, unknown>): Universite {
  return {
    id: String(json['_id'] ?? json['id']),
    nom: texte(json, 'nom'),
    ville: json['ville'] != null ? String(json['ville']) : undefined,
  };
}

export function filiereDepuisJson(json: Record<string, unknown>): FiliereOption {
  return { id: String(json['_id'] ?? json['id']), nom: texte(json, 'nom') };
}

export function matiereDepuisJson(json: Record<string, unknown>): MatiereOption {
  return { id: String(json['_id'] ?? json['id']), nom: texte(json, 'nom') };
}

export function optionDepuisJson(json: Record<string, unknown>): OptionReference {
  return {
    id: json['id'] != null ? String(json['id']) : undefined,
    value: texte(json, 'value'),
    label: texte(json, 'label'),
  };
}

export function typeContenuDepuisJson(json: Record<string, unknown>): TypeContenuOption {
  return {
    value: texte(json, 'value'),
    label: texte(json, 'label'),
    collection: json['collection'] != null ? String(json['collection']) : 'documents',
  };
}

export function justificatifTypeDepuisJson(json: Record<string, unknown>): JustificatifType {
  return { value: texte(json, 'value'), label: texte(json, 'label'), description: texte(json, 'description') };
}
