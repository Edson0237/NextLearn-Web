/** Les trois valeurs que l'API, l'application mobile et l'administration partagent. */
export type RecoursType = 'verification' | 'suspension' | 'depot';

export interface RecoursPossibilite {
  readonly type: RecoursType;
  readonly libelle: string;
  readonly cibleId?: string;
  /** La décision contestée, telle que le serveur la notifie. */
  readonly decision: string;
  /** Un recours est déjà en cours d'examen pour cette décision. */
  readonly dejaOuvert: boolean;
}

export interface EtatRecours {
  readonly delaiJours: number;
  readonly longueurMotifMinimale: number;
  readonly possibles: RecoursPossibilite[];
}

export interface Recours {
  readonly id: string;
  readonly type: RecoursType;
  readonly motif: string;
  readonly statut: 'en_attente' | 'en_revue' | 'accepte' | 'rejete';
  readonly dateDepot: string;
  readonly decisionContestee?: string;
  readonly reponse?: string;
}

export function etatRecoursDepuisApi(json: Record<string, unknown>): EtatRecours {
  const data = json ?? {};
  const possibles = Array.isArray(data['possibles']) ? (data['possibles'] as Record<string, unknown>[]) : [];
  return {
    delaiJours: typeof data['delaiJours'] === 'number' ? data['delaiJours'] : 60,
    longueurMotifMinimale:
      typeof data['longueurMotifMinimale'] === 'number' ? data['longueurMotifMinimale'] : 30,
    possibles: possibles.map((p) => ({
      type: String(p['type']) as RecoursType,
      libelle: String(p['libelle'] ?? ''),
      cibleId: p['cibleId'] == null ? undefined : String(p['cibleId']),
      decision: String(p['decision'] ?? ''),
      dejaOuvert: p['recoursDejaOuvert'] === true,
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
    decisionContestee: json['decisionContestee'] == null ? undefined : String(json['decisionContestee']),
    reponse: json['reponse'] == null ? undefined : String(json['reponse']),
  };
}
