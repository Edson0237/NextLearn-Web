/**
 * Ce que le serveur répond quand on lui soumet un domaine e-mail —
 * traduction de `lib/domains/auth/domain/models/domaine_institutionnel.dart`.
 *
 * La réponse n'autorise rien : elle rend le formulaire agréable à remplir
 * (dire tout de suite qu'une adresse ne sera pas acceptée), mais c'est
 * `register()` qui refait le contrôle côté serveur et décide.
 */
export enum EtatDomaine {
  vide = 'vide',
  formatInvalide = 'formatInvalide',
  verification = 'verification',
  refuse = 'refuse',
  reconnu = 'reconnu',
  /** Le serveur n'a pas répondu — on ne bloque pas pour autant. */
  indisponible = 'indisponible',
}

export interface ReponseDomaine {
  readonly etat: EtatDomaine;
  readonly institution?: string;
  readonly message?: string;
}

export const DOMAINE_VIDE: ReponseDomaine = { etat: EtatDomaine.vide };

export function reponseDomaineDepuisJson(json: Record<string, unknown>): ReponseDomaine {
  const autorise = json['allowed'] === true;
  return {
    etat: autorise ? EtatDomaine.reconnu : EtatDomaine.refuse,
    institution: json['institutionName'] != null ? String(json['institutionName']) : undefined,
    message: json['message'] != null ? String(json['message']) : undefined,
  };
}
