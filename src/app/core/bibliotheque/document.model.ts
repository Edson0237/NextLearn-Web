/**
 * Modèle Document — traduction de `DocumentModel`
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
  return apiVersType[valeur?.toUpperCase()] ?? DocumentType.autre;
}

export function labelTypeDocument(type: DocumentType): string {
  switch (type) {
    case DocumentType.cours: return 'Cours';
    case DocumentType.td: return 'TD';
    case DocumentType.synthese: return 'Synthèse';
    case DocumentType.epreuve: return 'Épreuve';
    case DocumentType.annales: return 'Annales';
    case DocumentType.corrige: return 'Corrigé';
    case DocumentType.rapport: return 'Rapport';
    case DocumentType.expose: return 'Exposé';
    case DocumentType.tp: return 'TP';
    case DocumentType.autre: return 'Document';
  }
}

export function couleurTypeDocument(type: DocumentType): string {
  switch (type) {
    case DocumentType.cours: return '#7fa9ee';
    case DocumentType.td: return '#5fd08a';
    case DocumentType.epreuve: return '#f3796b';
    case DocumentType.synthese: return '#b093f5';
    case DocumentType.annales: return '#efb44b';
    case DocumentType.corrige: return '#4fc9bc';
    case DocumentType.rapport: return '#f07cb0';
    case DocumentType.expose: return '#f59155';
    case DocumentType.tp: return '#93a6bc';
    case DocumentType.autre: return '#9aa0a6';
  }
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
    enseignant: enseignantRef.nom ?? (enseignantRef.id ? `Enseignant #${enseignantRef.id}` : 'Enseignant'),
    universite: universiteRef.nom ?? (universiteRef.id ? `Université #${universiteRef.id}` : 'Université'),
    niveau: String(json['niveau'] ?? ''),
    semestre: json['semestre'] ? String(json['semestre']) : undefined,
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
    case DocumentSort.alphabetical: return 'A–Z';
  }
}

export interface DocumentPage {
  readonly items: readonly DocumentModel[];
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly sortApplied?: string;
}

export function pageDocumentsDepuisApi(json: Record<string, unknown>): DocumentPage {
  const data = Array.isArray(json['data']) ? (json['data'] as Record<string, unknown>[]) : [];
  const meta = (json['meta'] as Record<string, unknown>) ?? {};
  return {
    items: data.map(documentDepuisApi),
    page: typeof meta['page'] === 'number' ? meta['page'] : 1,
    totalPages: typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 1,
    total: typeof meta['total'] === 'number' ? meta['total'] : data.length,
    sortApplied: meta['sort'] ? String(meta['sort']) : undefined,
  };
}
