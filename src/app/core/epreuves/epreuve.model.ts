/**
 * Une épreuve — traduction de
 * `lib/domains/epreuves/domain/models/epreuve_model.dart`.
 */
export enum TypeEpreuve {
  cc = 'cc',
  sn = 'sn',
  /** Tout le fonds publié avant l'introduction du champ : un fait, pas un
   * repli commode. Ne ressort que sous « Tous ». */
  indefini = 'indefini',
}

const TYPE_API: Readonly<Record<TypeEpreuve, string>> = {
  [TypeEpreuve.cc]: 'CC',
  [TypeEpreuve.sn]: 'SN',
  [TypeEpreuve.indefini]: '',
};

export function typeEpreuveVersApi(t: TypeEpreuve): string {
  return TYPE_API[t];
}

export function typeEpreuveDepuisApi(brut: unknown): TypeEpreuve | undefined {
  const code = String(brut ?? '').trim().toUpperCase();
  if (code === '' || code === 'NULL') return undefined;
  switch (code) {
    case 'CC': return TypeEpreuve.cc;
    case 'SN': return TypeEpreuve.sn;
    default: return undefined;
  }
}

export interface EpreuveModel {
  readonly id: string;
  /** Nom affichable, résolu côté backend via populate. */
  readonly matiere: string;
  readonly annee: number;
  readonly universite: string;
  readonly niveau: string;
  readonly dureeMinutes: number;
  readonly avecCorrige: boolean;
  readonly urlPdf: string;
  readonly urlCorrigePdf?: string;
  readonly matiereId?: string;
  readonly universiteId?: string;
  readonly typeEpreuve?: TypeEpreuve;
  /** L'institution qui a proposé le sujet — distincte de `universite`, qui
   * ne fait que le diffuser (une école publie couramment des sujets venus
   * d'ailleurs : concours, université partenaire, annales nationales). */
  readonly enseigne?: string;
  readonly semestre?: string;
  readonly universel: boolean;
  readonly vues: number;
  readonly telechargements: number;
  readonly noteMoyenne: number;
}

function texteOuNul(brut: unknown): string | undefined {
  const texte = brut == null ? '' : String(brut).trim();
  return texte === '' ? undefined : texte;
}

function parseRef(valeur: unknown): { id?: string; nom?: string } {
  if (valeur == null) return {};
  if (typeof valeur === 'object') {
    const o = valeur as Record<string, unknown>;
    const id = o['_id'] ?? o['id'];
    return { id: id != null ? String(id) : undefined, nom: typeof o['nom'] === 'string' ? o['nom'] : undefined };
  }
  return { id: String(valeur) };
}

export function epreuveDepuisJson(json: Record<string, unknown>): EpreuveModel {
  const matiereRef = parseRef(json['matiereId']);
  const universiteRef = parseRef(json['universiteId']);
  return {
    id: String(json['_id'] ?? json['id']),
    matiere: matiereRef.nom ?? (matiereRef.id ? `Matière #${matiereRef.id}` : 'Matière'),
    annee: Number(json['annee']),
    universite: universiteRef.nom ?? (universiteRef.id ? `Université #${universiteRef.id}` : 'Université'),
    niveau: String(json['niveau'] ?? ''),
    dureeMinutes: Number(json['dureeMinutes'] ?? 0),
    avecCorrige: json['avecCorrige'] === true,
    urlPdf: typeof json['urlPdf'] === 'string' ? json['urlPdf'] : '',
    urlCorrigePdf: typeof json['urlCorrigePdf'] === 'string' ? json['urlCorrigePdf'] : undefined,
    matiereId: matiereRef.id,
    universiteId: universiteRef.id,
    typeEpreuve: typeEpreuveDepuisApi(json['typeEpreuve']),
    enseigne: texteOuNul(json['enseigne']),
    semestre: texteOuNul(json['semestre']),
    universel: json['universel'] === true,
    vues: Number(json['vues'] ?? 0),
    telechargements: Number(json['telechargements'] ?? 0),
    noteMoyenne: Number(json['noteMoyenne'] ?? 0),
  };
}
