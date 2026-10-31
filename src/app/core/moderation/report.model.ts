/**
 * Signalement de contenu — traduction de
 * `lib/domains/moderation/domain/repositories/report_repository_interface.dart`.
 *
 * Le catalogue des motifs n'est **pas** redéclaré ici : il vient de
 * `GET /api/reports/motifs`. Recopier un catalogue côté client est ce qui
 * avait laissé le type « Épreuve » absent du formulaire d'import.
 */

export interface MotifSignalement {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  /**
   * Ce motif retire le contenu dès le premier signalement. Sert à prévenir
   * l'utilisateur de la portée de ce qu'il déclenche.
   */
  readonly masquageImmediat: boolean;
}

export interface CatalogueMotifs {
  readonly motifs: readonly MotifSignalement[];
  /** Délai de traitement annoncé, pour ne pas laisser l'utilisateur sans repère. */
  readonly slaHeures: number;
}

export interface ResultatSignalement {
  readonly message: string;
  readonly slaHeures: number;
}

/** Les deux seuls types de contenu signalables (`ReportTargetType` côté API). */
export enum CibleSignalement {
  document = 'document',
  epreuve = 'epreuve',
}

export function motifDepuisApi(json: Record<string, unknown>): MotifSignalement {
  return {
    code: String(json['code'] ?? ''),
    label: String(json['label'] ?? ''),
    description: String(json['description'] ?? ''),
    masquageImmediat: json['masquageImmediat'] === true,
  };
}

/** Où en est la modération d'un signalement (`ReportStatus` côté API). */
export enum StatutSignalement {
  ouvert = 'ouvert',
  enExamen = 'en_examen',
  retenu = 'retenu',
  rejete = 'rejete',
}

/** Un signalement de contenu envoyé par l'étudiant. */
export interface MonSignalement {
  readonly id: string;
  readonly cibleType: CibleSignalement;
  readonly cibleTitre: string | null;
  readonly motifLabel: string;
  readonly status: StatutSignalement;
  readonly decisionMotif: string | null;
  readonly createdAt: Date;
}

export function monSignalementDepuisApi(j: Record<string, unknown>): MonSignalement {
  const statut = Object.values(StatutSignalement).find((s) => s === j['status']);
  return {
    id: String(j['id'] ?? ''),
    cibleType: j['cibleType'] === 'epreuve' ? CibleSignalement.epreuve : CibleSignalement.document,
    cibleTitre: typeof j['cibleTitre'] === 'string' ? j['cibleTitre'] : null,
    motifLabel: String(j['motifLabel'] ?? j['motif'] ?? ''),
    status: statut ?? StatutSignalement.ouvert,
    decisionMotif: typeof j['decisionMotif'] === 'string' && j['decisionMotif'] ? j['decisionMotif'] : null,
    createdAt: new Date(String(j['createdAt'] ?? Date.now())),
  };
}
