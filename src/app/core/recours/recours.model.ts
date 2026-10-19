export type RecoursType = 'rejet_document' | 'suspension_compte' | 'refus_inscription';

export interface RecoursPossibilite {
  readonly type: RecoursType;
  readonly libelle: string;
  readonly cibleId?: string;
}

export interface EtatRecours {
  readonly delaiJours: number;
  readonly possibles: RecoursPossibilite[];
}

export interface Recours {
  readonly id: string;
  readonly type: RecoursType;
  readonly motif: string;
  readonly statut: 'en_attente' | 'accepte' | 'rejete';
  readonly dateDepot: string;
}

export function etatRecoursDepuisApi(json: Record<string, unknown>): EtatRecours {
  const data = json ?? {};
  const possibles = Array.isArray(data['possibles']) ? (data['possibles'] as Record<string, unknown>[]) : [];
  return {
    delaiJours: typeof data['delaiJours'] === 'number' ? data['delaiJours'] : 30,
    possibles: possibles.map((p) => ({
      type: String(p['type']) as RecoursType,
      libelle: String(p['libelle'] ?? ''),
      cibleId: p['cibleId'] == null ? undefined : String(p['cibleId']),
    })),
  };
}

export function recoursDepuisApi(json: Record<string, unknown>): Recours {
  return {
    id: String(json['id'] ?? json['_id']),
    type: String(json['type']) as RecoursType,
    motif: String(json['motif'] ?? ''),
    statut: String(json['statut'] ?? 'en_attente') as Recours['statut'],
    dateDepot: String(json['dateDepot'] ?? json['createdAt'] ?? ''),
  };
}
