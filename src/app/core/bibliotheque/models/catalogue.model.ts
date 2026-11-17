import { DocumentModel, DocumentType, typeDocumentDepuisApi } from './document.model';
import { SectionAcademique, SectionPreference } from '../../models/user.model';

export const DIMENSIONS_CATALOGUE = [
  'type',
  'typeEpreuve',
  'semestre',
  'matiere',
  'enseignant',
  'annee',
  'section',
  'avecCorrige',
] as const;

export type DimensionCatalogue = (typeof DIMENSIONS_CATALOGUE)[number];

export type TriCatalogue = 'recent' | 'annee' | 'populaire' | 'alpha';

/** Classe consultée dans la Bibliothèque (Chantier P11 — §10.1 & §6.2). */
export interface ClasseConsultation {
  readonly universiteId: string;
  readonly universiteNom?: string;
  /** Contexte d'interface/référentiel ; jamais envoyé à GET /api/v2/catalogue (§6.1 & §6.2). */
  readonly cycle?: string | null;
  readonly cycleLabel?: string;
  readonly filiereId: string;
  readonly filiereNom?: string;
  readonly niveau: string;
  readonly niveauLabel?: string;
}

export type FiltreSectionCatalogue = SectionAcademique | null;

/**
 * Convertit la préférence linguistique persistante du compte (`FRANCOPHONE`, `ANGLOPHONE`, `TOUTES`)
 * en valeur de filtre `section` pour `GET /api/v2/catalogue` (§3.8 & §5.2).
 * - Français → `'FRANCOPHONE'`
 * - Anglais  → `'ANGLOPHONE'`
 * - Les deux (`'TOUTES'`) → `null` (paramètre `section` omis)
 */
export function sectionCatalogueDepuisPreference(
  pref?: SectionPreference | string | null,
): FiltreSectionCatalogue {
  if (!pref) return null;
  const norm = String(pref).trim().toUpperCase();
  if (norm === 'FRANCOPHONE' || norm === 'FR' || norm === 'FRANCAIS') return 'FRANCOPHONE';
  if (norm === 'ANGLOPHONE' || norm === 'EN' || norm === 'ANGLAIS') return 'ANGLOPHONE';
  return null;
}

export type ModeClasse = 'profil' | 'alternative';

export interface ContexteClasseBibliotheque {
  readonly mode: ModeClasse;
  readonly classe: ClasseConsultation | null;
}

/** Forme unique d'une ressource dans `GET /api/v2/catalogue` (Chantier P5). */
export interface RessourceCarte {
  readonly id: string;
  readonly titre: string;
  readonly type: string | null;
  readonly typeEpreuve: string | null;
  readonly matiere: { readonly id: string; readonly nom: string } | null;
  readonly enseignant: { readonly id: string; readonly nom: string } | null;
  readonly anneeAcademique: string | null;
  readonly semestre: string | null;
  readonly niveau: string | null;
  readonly section: 'FRANCOPHONE' | 'ANGLOPHONE' | null;
  readonly avecCorrige: boolean;
  readonly dureeMinutes: number | null;
  readonly fichier: { readonly pages: number | null; readonly tailleMb: number | null };
  readonly dateAjout: string | null;
}

export interface ValeurFacette {
  readonly valeur: string | boolean | null;
  readonly valeurFiltre?: string | boolean;
  readonly label: string;
  readonly labelEn: string;
  readonly n: number;
  readonly selectionne: boolean;
}

/**
 * Retourne l'identifiant de filtre d'une facette textuelle (`valeurFiltre` prioritaire
 * sur `valeur` afin de supporter `'NON_PRECISE'` lorsque `valeur` vaut `null` — commit `750587f`).
 */
export function codeFacetteString(f: ValeurFacette): string | null {
  if (typeof f.valeurFiltre === 'string' && f.valeurFiltre.length > 0) {
    return f.valeurFiltre;
  }
  if (typeof f.valeur === 'string' && f.valeur.length > 0) {
    return f.valeur;
  }
  return null;
}

export type Facettes = Record<DimensionCatalogue, readonly ValeurFacette[]>;

export interface RequeteCatalogue {
  readonly universiteId?: string;
  readonly filiereId?: string | readonly string[];
  readonly niveau?: string;
  readonly type?: string | readonly string[];
  readonly typeEpreuve?: string | readonly string[];
  readonly semestre?: string | readonly string[];
  readonly matiere?: string | readonly string[];
  readonly enseignant?: string | readonly string[];
  readonly annee?: string | readonly string[];
  readonly section?: string | readonly string[];
  readonly avecCorrige?: boolean | null;
  readonly q?: string | null;
  readonly tri?: TriCatalogue;
  readonly cursor?: string | null;
  readonly page?: number;
  readonly limit?: number;
}

function normaliserCritereCache(v?: string | readonly string[] | null): string {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  return [...v]
    .map((x) => x.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

/**
 * Construit une clé de cache déterministe isolée par utilisateur, mode de classe,
 * classe (université, filière, niveau), filtres, recherche, tri et pagination (§9.3).
 */
export function cleCacheCatalogue(
  userId: string,
  modeClasse: ModeClasse,
  requete: RequeteCatalogue,
): string {
  const estAlternative =
    modeClasse === 'alternative' &&
    Boolean(requete.universiteId && requete.filiereId && requete.niveau);
  return [
    userId || 'anonyme',
    estAlternative ? 'alternative' : 'profil',
    estAlternative ? normaliserCritereCache(requete.universiteId) : 'profil-default',
    estAlternative ? normaliserCritereCache(requete.filiereId) : 'profil-default',
    estAlternative ? normaliserCritereCache(requete.niveau).toUpperCase() : 'profil-default',
    normaliserCritereCache(requete.type).toUpperCase(),
    normaliserCritereCache(requete.typeEpreuve).toUpperCase(),
    normaliserCritereCache(requete.semestre).toUpperCase(),
    normaliserCritereCache(requete.matiere),
    normaliserCritereCache(requete.enseignant),
    normaliserCritereCache(requete.annee),
    normaliserCritereCache(requete.section).toUpperCase(),
    typeof requete.avecCorrige === 'boolean' ? String(requete.avecCorrige) : 'unset',
    (requete.q ?? '').trim().toLowerCase(),
    requete.tri ?? 'recent',
    requete.cursor ?? '',
    String(requete.page ?? 1),
    String(requete.limit ?? 20),
  ].join(':');
}

export interface FiltresActifsCatalogue {
  readonly type: readonly string[];
  readonly typeEpreuve: readonly string[];
  readonly semestre: readonly string[];
  readonly matiere: readonly string[];
  readonly enseignant: readonly string[];
  readonly annee: readonly string[];
  readonly section: readonly string[];
  readonly avecCorrige: boolean | null;
  readonly q: string | null;
  readonly tri: TriCatalogue;
}

export interface ReponseCatalogue {
  readonly ressources: readonly RessourceCarte[];
  readonly total: number;
  readonly pagination: {
    readonly limit: number;
    readonly page: number;
    readonly hasMore: boolean;
    readonly nextCursor: string | null;
  };
  readonly filtresActifs: FiltresActifsCatalogue;
  readonly facettes: Facettes;
}

export const FACETTES_VIDES: Facettes = {
  type: [],
  typeEpreuve: [],
  semestre: [],
  matiere: [],
  enseignant: [],
  annee: [],
  section: [],
  avecCorrige: [],
};

function texteOuNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function refOuNull(v: unknown): { readonly id: string; readonly nom: string } | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const obj = v as Record<string, unknown>;
  const id = texteOuNull(obj['id'] ?? obj['_id']);
  const nom = texteOuNull(obj['nom']);
  return id && nom ? { id, nom } : null;
}

export function ressourceCarteDepuisApi(json: Record<string, unknown>): RessourceCarte {
  const fichierRaw =
    json['fichier'] && typeof json['fichier'] === 'object' && !Array.isArray(json['fichier'])
      ? (json['fichier'] as Record<string, unknown>)
      : {};
  const secRaw = texteOuNull(json['section']);
  const section: 'FRANCOPHONE' | 'ANGLOPHONE' | null =
    secRaw === 'FRANCOPHONE' || secRaw === 'ANGLOPHONE' ? secRaw : null;

  return {
    id: String(json['id'] ?? json['_id'] ?? ''),
    titre: String(json['titre'] ?? ''),
    type: texteOuNull(json['type']),
    typeEpreuve: texteOuNull(json['typeEpreuve']),
    matiere: refOuNull(json['matiere']),
    enseignant: refOuNull(json['enseignant']),
    anneeAcademique: texteOuNull(json['anneeAcademique']),
    semestre: texteOuNull(json['semestre']),
    niveau: texteOuNull(json['niveau']),
    section,
    avecCorrige: json['avecCorrige'] === true,
    dureeMinutes: nombreOuNull(json['dureeMinutes']),
    fichier: {
      pages: nombreOuNull(fichierRaw['pages'] ?? json['pages']),
      tailleMb: nombreOuNull(fichierRaw['tailleMb'] ?? json['tailleMb']),
    },
    dateAjout: texteOuNull(json['dateAjout']),
  };
}

function facetteDepuisApi(json: Record<string, unknown>): ValeurFacette {
  const valBrute = json['valeur'];
  const valeur: string | boolean | null =
    typeof valBrute === 'string' || typeof valBrute === 'boolean' ? valBrute : null;
  const valFiltreBrute = json['valeurFiltre'];
  const valeurFiltre: string | boolean | undefined =
    typeof valFiltreBrute === 'string' || typeof valFiltreBrute === 'boolean'
      ? valFiltreBrute
      : valeur ?? 'NON_PRECISE';
  const label = typeof json['label'] === 'string' ? json['label'] : String(valeur ?? 'Non précisé');
  const labelEn = typeof json['labelEn'] === 'string' ? json['labelEn'] : label;
  const n = typeof json['n'] === 'number' && Number.isFinite(json['n']) ? Math.max(0, Math.round(json['n'])) : 0;
  return {
    valeur,
    valeurFiltre,
    label,
    labelEn,
    n,
    selectionne: json['selectionne'] === true,
  };
}

function tableauChaines(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];
}

export function reponseCatalogueDepuisApi(enveloppe: Record<string, unknown>): ReponseCatalogue {
  const data =
    enveloppe['data'] && typeof enveloppe['data'] === 'object' && !Array.isArray(enveloppe['data'])
      ? (enveloppe['data'] as Record<string, unknown>)
      : enveloppe;

  const rawRessources = Array.isArray(data['ressources'])
    ? (data['ressources'] as Record<string, unknown>[])
    : [];
  const ressources = rawRessources.map(ressourceCarteDepuisApi);

  const pagRaw =
    data['pagination'] && typeof data['pagination'] === 'object'
      ? (data['pagination'] as Record<string, unknown>)
      : {};
  const limit = typeof pagRaw['limit'] === 'number' && pagRaw['limit'] > 0 ? pagRaw['limit'] : 20;
  const page = typeof pagRaw['page'] === 'number' && pagRaw['page'] > 0 ? pagRaw['page'] : 1;
  const hasMore = pagRaw['hasMore'] === true;
  const nextCursor = typeof pagRaw['nextCursor'] === 'string' && pagRaw['nextCursor'].trim() ? pagRaw['nextCursor'] : null;

  const total =
    typeof data['total'] === 'number' && Number.isFinite(data['total'])
      ? Math.max(0, Math.round(data['total']))
      : ressources.length;

  const faRaw =
    data['filtresActifs'] && typeof data['filtresActifs'] === 'object'
      ? (data['filtresActifs'] as Record<string, unknown>)
      : {};
  const triBrut = faRaw['tri'];
  const tri: TriCatalogue =
    triBrut === 'annee' || triBrut === 'populaire' || triBrut === 'alpha' ? triBrut : 'recent';

  const facRaw =
    data['facettes'] && typeof data['facettes'] === 'object'
      ? (data['facettes'] as Record<string, unknown>)
      : {};
  const facettes: Record<DimensionCatalogue, readonly ValeurFacette[]> = { ...FACETTES_VIDES };
  for (const dim of DIMENSIONS_CATALOGUE) {
    const liste = facRaw[dim];
    facettes[dim] = Array.isArray(liste)
      ? (liste as Record<string, unknown>[]).map(facetteDepuisApi)
      : [];
  }

  return {
    ressources,
    total,
    pagination: { limit, page, hasMore, nextCursor },
    filtresActifs: {
      type: tableauChaines(faRaw['type']),
      typeEpreuve: tableauChaines(faRaw['typeEpreuve']),
      semestre: tableauChaines(faRaw['semestre']),
      matiere: tableauChaines(faRaw['matiere']),
      enseignant: tableauChaines(faRaw['enseignant']),
      annee: tableauChaines(faRaw['annee']),
      section: tableauChaines(faRaw['section']),
      avecCorrige: typeof faRaw['avecCorrige'] === 'boolean' ? faRaw['avecCorrige'] : null,
      q: typeof faRaw['q'] === 'string' ? faRaw['q'] : null,
      tri,
    },
    facettes,
  };
}

/** Convertit une `RessourceCarte` du Catalogue v2 en `DocumentModel` pour les composants de carte et le hors-ligne. */
export function ressourceVersDocumentModel(r: RessourceCarte): DocumentModel {
  return {
    id: r.id,
    titre: r.titre,
    description: '',
    type: r.type ? typeDocumentDepuisApi(r.type) : DocumentType.epreuve,
    typeEpreuve: r.typeEpreuve ?? undefined,
    matiere: r.matiere?.nom ?? 'Matière',
    matiereId: r.matiere?.id,
    enseignant: r.enseignant?.nom ?? 'Non renseigné',
    enseignantId: r.enseignant?.id,
    universite: '',
    niveau: r.niveau ?? '',
    semestre: r.semestre ?? undefined,
    section: r.section ?? undefined,
    dureeMinutes: r.dureeMinutes ?? undefined,
    avecCorrige: r.avecCorrige,
    anneeAcademique: r.anneeAcademique ?? '',
    tailleMb: r.fichier.tailleMb ?? 0,
    pages: r.fichier.pages ?? 0,
    urlPdf: '',
    dateAjout: r.dateAjout ? new Date(r.dateAjout) : new Date(),
    vues: 0,
    telechargements: 0,
    noteMoyenne: 0,
  };
}
