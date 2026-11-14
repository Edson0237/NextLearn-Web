import { tr } from '../../i18n';
import { traduireOptionReference } from '../../references/utils/traduire-reference';
/**
 * Modèle Document - traduction de `DocumentModel`
 * (`lib/domains/bibliotheque/domain/models/document_model.dart`).
 */

export enum DocumentType {
  cours = 'cours',
  td = 'td',
  synthese = 'synthese',
  epreuve = 'epreuve',
  annales = 'annales',
  corrige = 'corrige',
  rapport = 'rapport',
  expose = 'expose',
  tp = 'tp',
  autre = 'autre',
}

export function typeDocumentDepuisApi(valeur: string): DocumentType {
  const apiVersType: Record<string, DocumentType> = {
    COURS: DocumentType.cours,
    TD: DocumentType.td,
    SYNTHESE: DocumentType.synthese,
    EPREUVE: DocumentType.epreuve,
    ANNALES: DocumentType.annales,
    CORRIGE: DocumentType.corrige,
    RAPPORT: DocumentType.rapport,
    EXPOSE: DocumentType.expose,
    TP: DocumentType.tp,
  };
  const connu = apiVersType[valeur?.toUpperCase()];
  if (connu) return connu;
  // Un format créé dans l'administration, que l'application ne nomme pas :
  // on garde son identifiant plutôt que de le noyer dans « Document » - son
  // libellé et sa couleur viennent du serveur (`enregistrerFormatsServeur`).
  const slug = String(valeur ?? '').trim().toLowerCase();
  return (slug === '' ? DocumentType.autre : slug) as DocumentType;
}

const TYPES_CONNUS: ReadonlySet<string> = new Set(Object.values(DocumentType));

/** Vrai pour un format que l'application sait dessiner (icône et couleur à elle). */
export function typeConnu(type: string): boolean {
  return TYPES_CONNUS.has(type);
}

/**
 * Les formats déclarés par le serveur, pour ceux que l'application ne connaît
 * pas : libellé et couleur y sont lus à l'affichage. Alimenté par
 * `FormatsService` dès que la liste arrive.
 */
const formatsServeur = new Map<string, { label: string; couleur?: string }>();

export function enregistrerFormatsServeur(liste: readonly { slug: string; label: string; couleur?: string }[]): void {
  formatsServeur.clear();
  for (const f of liste) formatsServeur.set(f.slug.toLowerCase(), { label: f.label, couleur: f.couleur });
}


export function labelTypeDocument(type: DocumentType): string {
  switch (type) {
    case DocumentType.cours: return traduireOptionReference('COURS', 'Cours');
    case DocumentType.td: return 'TD';
    case DocumentType.synthese: return traduireOptionReference('SYNTHESE', 'Synthèse');
    case DocumentType.epreuve: return traduireOptionReference('EPREUVE', 'Épreuve');
    case DocumentType.annales: return traduireOptionReference('ANNALES', 'Annales');
    case DocumentType.corrige: return traduireOptionReference('CORRIGE', 'Corrigé');
    case DocumentType.rapport: return traduireOptionReference('RAPPORT', 'Rapport');
    case DocumentType.expose: return traduireOptionReference('EXPOSE', 'Exposé');
    case DocumentType.tp: return 'TP';
    case DocumentType.autre: return 'Document';
    default: {
      const inconnu = formatsServeur.get(String(type))?.label;
      if (inconnu) return traduireOptionReference(String(type), inconnu);
      const brut = String(type);
      return brut.charAt(0).toUpperCase() + brut.slice(1);
    }
  }
}

/**
 * Ce que le serveur déclare pour un format que l'application ne connaît pas
 * (libellé, couleur d'administration). Lu par la présentation - qui décide
 * seule de l'icône et des teintes ; ce modèle ne sait rien de l'interface.
 */
export function formatServeur(type: string): { label: string; couleur?: string } | undefined {
  return formatsServeur.get(String(type));
}

export interface DocumentModel {
  readonly id: string;
  readonly titre: string;
  readonly description: string;
  readonly type: DocumentType;
  readonly matiere: string;
  readonly enseignant: string;
  readonly universite: string;
  readonly niveau: string;
  readonly semestre?: string;
  readonly section?: 'FRANCOPHONE' | 'ANGLOPHONE';
  readonly dureeMinutes?: number;
  readonly avecCorrige: boolean;
  readonly urlCorrigePdf?: string;
  readonly anneeAcademique: string;
  readonly tailleMb: number;
  readonly pages: number;
  readonly urlPdf: string;
  readonly thumbnailUrl?: string;
  readonly dateAjout: Date;
  readonly vues: number;
  readonly telechargements: number;
  readonly noteMoyenne: number;
  readonly matiereId?: string;
  readonly enseignantId?: string;
  readonly universiteId?: string;
}

export function documentDepuisApi(json: Record<string, unknown>): DocumentModel {
  const matiereRef = parseRef(json['matiereId']);
  const enseignantRef = parseRef(json['enseignantId']);
  const universiteRef = parseRef(json['universiteId']);
  return {
    id: String(json['_id'] ?? json['id'] ?? ''),
    titre: String(json['titre'] ?? ''),
    description: String(json['description'] ?? ''),
    type: typeDocumentDepuisApi(String(json['type'] ?? '')),
    matiere: matiereRef.nom ?? (matiereRef.id ? `Matière #${matiereRef.id}` : 'Matière'),
    // Mêmes replis que `DocumentModel.fromJson` côté Flutter : « Enseignant »
    // et « Université » affirmaient un libellé là où la donnée manque.
    enseignant:
      enseignantRef.nom ??
      (enseignantRef.id
        ? `Enseignant #${enseignantRef.id}`
        : tr('communNonRenseigne', 'Non renseigné')),
    universite:
      universiteRef.nom ??
      (universiteRef.id
        ? `Université #${universiteRef.id}`
        : tr('communNonRenseignee', 'Non renseignée')),
    niveau: String(json['niveau'] ?? ''),
    semestre: json['semestre'] ? String(json['semestre']) : undefined,
    section:
      json['section'] === 'FRANCOPHONE' || json['section'] === 'ANGLOPHONE'
        ? json['section']
        : undefined,
    dureeMinutes: typeof json['dureeMinutes'] === 'number' ? Math.round(json['dureeMinutes']) : undefined,
    avecCorrige: json['avecCorrige'] === true,
    urlCorrigePdf: json['urlCorrigePdf'] ? String(json['urlCorrigePdf']) : undefined,
    anneeAcademique: String(json['anneeAcademique'] ?? ''),
    tailleMb: typeof json['tailleMb'] === 'number' ? json['tailleMb'] : 0,
    pages: typeof json['pages'] === 'number' ? Math.round(json['pages']) : 0,
    urlPdf: String(json['urlPdf'] ?? ''),
    thumbnailUrl: json['thumbnailUrl'] ? String(json['thumbnailUrl']) : undefined,
    dateAjout: json['dateAjout'] ? new Date(String(json['dateAjout'])) : new Date(),
    vues: typeof json['vues'] === 'number' ? Math.round(json['vues']) : 0,
    telechargements: typeof json['telechargements'] === 'number' ? Math.round(json['telechargements']) : 0,
    noteMoyenne: typeof json['noteMoyenne'] === 'number' ? json['noteMoyenne'] : 0,
    matiereId: matiereRef.id,
    enseignantId: enseignantRef.id,
    universiteId: universiteRef.id,
  };
}

function parseRef(value: unknown): { id?: string; nom?: string } {
  if (value == null) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    return {
      id: map['_id'] ? String(map['_id']) : (map['id'] ? String(map['id']) : undefined),
      nom: map['nom'] ? String(map['nom']) : undefined,
    };
  }
  return { id: String(value) };
}

export enum DocumentSort {
  recent = 'recent',
  popular = 'popular',
  alphabetical = 'alphabetical',
}

export function labelDocumentSort(sort: DocumentSort): string {
  switch (sort) {
    case DocumentSort.recent: return 'Récents';
    case DocumentSort.popular: return 'Populaires';
    case DocumentSort.alphabetical: return 'A-Z';
  }
}

export interface DocumentPage {
  readonly items: readonly DocumentModel[];
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly sortApplied?: string;
  readonly nextCursor?: string | null;
  readonly hasMore?: boolean;
}

export interface DocumentReadAccess {
  readonly readUrl: string;
  readonly expiresIn: number;
  readonly mimeType: string;
  readonly format: 'pdf' | 'docx';
  readonly size?: number;
}

export function pageDocumentsDepuisApi(json: Record<string, unknown>): DocumentPage {
  const rawData = json['data'];
  let rawList: Record<string, unknown>[] = [];
  let pagination: Record<string, unknown> | undefined;

  if (Array.isArray(rawData)) {
    rawList = rawData as Record<string, unknown>[];
  } else if (rawData && typeof rawData === 'object') {
    const obj = rawData as Record<string, unknown>;
    if (Array.isArray(obj['documents'])) {
      rawList = obj['documents'] as Record<string, unknown>[];
    }
    if (obj['pagination'] && typeof obj['pagination'] === 'object') {
      pagination = obj['pagination'] as Record<string, unknown>;
    }
  }

  if (
    !pagination &&
    json['pagination'] &&
    typeof json['pagination'] === 'object'
  ) {
    pagination = json['pagination'] as Record<string, unknown>;
  }

  const meta = (json['meta'] as Record<string, unknown>) ?? pagination ?? {};
  const page = typeof meta['page'] === 'number' ? meta['page'] : 1;
  const totalPages = typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 1;
  const hasMore =
    pagination && typeof pagination['hasMore'] === 'boolean'
      ? Boolean(pagination['hasMore'])
      : page < totalPages;
  const nextCursor = pagination?.['nextCursor'] ? String(pagination['nextCursor']) : null;

  return {
    items: rawList.map(documentDepuisApi),
    page,
    totalPages,
    total: typeof meta['total'] === 'number' ? meta['total'] : rawList.length,
    sortApplied: meta['sort'] ? String(meta['sort']) : undefined,
    hasMore,
    nextCursor,
  };
}

/**
 * Les métadonnées d'une carte de ressource : pages, poids, et vues.
 *
 * Pages et poids sont toujours là (« - » tant qu'ils sont inconnus), pour que
 * deux cartes voisines aient la même forme. Les **vues** n'apparaissent qu'à
 * partir de la première : « 0 vue » n'apprend rien et fait croire à un
 * document délaissé. Même règle pour la note, voir `noteDocument`.
 */
export function metaDocument(doc: Pick<DocumentModel, 'pages' | 'tailleMb' | 'vues'>): { icon: 'description' | 'attach_file' | 'visibility'; label: string }[] {
  const meta: { icon: 'description' | 'attach_file' | 'visibility'; label: string }[] = [
    { icon: 'description', label: doc.pages > 0 ? `${doc.pages} p.` : '- p.' },
    { icon: 'attach_file', label: doc.tailleMb > 0 ? `${doc.tailleMb.toFixed(1)} Mo` : '- Mo' },
  ];
  if ((doc.vues ?? 0) > 0) meta.push({ icon: 'visibility', label: String(doc.vues) });
  return meta;
}

/** La note moyenne à montrer sur une carte : seulement s'il y a au moins une note. */
export function noteDocument(doc: Pick<DocumentModel, 'noteMoyenne'>): number | undefined {
  return (doc.noteMoyenne ?? 0) > 0 ? doc.noteMoyenne : undefined;
}
