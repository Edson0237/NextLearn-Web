/**
 * Un document proposé par un étudiant, et son sort — traduction de
 * `lib/domains/contributions/domain/models/depot_model.dart`.
 */
export enum DepotStatut {
  enAttente = 'enAttente',
  enRevue = 'enRevue',
  publie = 'publie',
  refuse = 'refuse',
}

export function depotStatutDepuisApi(valeur: unknown): DepotStatut {
  switch (valeur) {
    case 'en_revue': return DepotStatut.enRevue;
    case 'publie': return DepotStatut.publie;
    case 'refuse': return DepotStatut.refuse;
    // Un statut inconnu (ajouté côté serveur après cette version) ne doit
    // pas casser l'écran : on le traite comme « en attente », le plus
    // prudent — on n'annonce ni publication ni refus.
    default: return DepotStatut.enAttente;
  }
}

export function libelleDepotStatut(s: DepotStatut): string {
  switch (s) {
    case DepotStatut.enAttente: return 'En attente de relecture';
    case DepotStatut.enRevue: return 'En cours de relecture';
    case DepotStatut.publie: return 'Publié';
    case DepotStatut.refuse: return 'Refusé';
  }
}

/**
 * Régime de droits déclaré par le déposant — la seule information qui
 * permette de répondre à un ayant droit qui réclame le retrait d'un
 * document. Sans valeur par défaut : cocher à sa place reviendrait à
 * faire signer quelque chose que personne n'a lu.
 */
export enum DepotLicence {
  auteur = 'auteur',
  autorise = 'autorise',
  institutionnel = 'institutionnel',
  inconnue = 'inconnue',
}

export const LICENCES_PROPOSEES: readonly { readonly valeur: DepotLicence; readonly titre: string; readonly explication: string }[] = [
  { valeur: DepotLicence.auteur, titre: "C'est moi qui l'ai écrit", explication: 'Tes propres notes, ta synthèse, ton résumé de cours.' },
  { valeur: DepotLicence.autorise, titre: "J'ai l'accord de l'auteur", explication: "L'enseignant ou l'auteur t'a autorisé à le partager." },
  { valeur: DepotLicence.institutionnel, titre: 'Document distribué par mon école', explication: "Polycopié, sujet ou support remis officiellement par l'école." },
  {
    valeur: DepotLicence.inconnue,
    titre: "Je ne sais pas d'où il vient",
    explication: "Un fichier qui circule entre étudiants. Dis-le : le document sera relu avec plus d'attention, et tu ne seras pas tenu responsable de son origine.",
  },
];

export interface Depot {
  readonly id: string;
  readonly titre: string;
  readonly description: string;
  readonly type: string;
  readonly statut: DepotStatut;
  readonly licence: DepotLicence;
  readonly motifRefus?: string;
  readonly creeLe?: Date;
}

export function depotDepuisJson(json: Record<string, unknown>): Depot {
  return {
    id: String(json['_id'] ?? json['id'] ?? ''),
    titre: String(json['titre'] ?? ''),
    description: String(json['description'] ?? ''),
    type: String(json['type'] ?? ''),
    statut: depotStatutDepuisApi(json['status']),
    licence: (Object.values(DepotLicence) as string[]).includes(String(json['licence']))
      ? (json['licence'] as DepotLicence)
      : DepotLicence.inconnue,
    motifRefus: typeof json['motifRefus'] === 'string' ? json['motifRefus'] : undefined,
    creeLe: json['createdAt'] ? new Date(String(json['createdAt'])) : undefined,
  };
}

/** Première année académique couverte par la bibliothèque — une borne
 * fixe, pas une fenêtre glissante : le fonds contient des épreuves plus
 * anciennes que cinq ans. */
const PREMIERE_ANNEE_ACADEMIQUE = 2016;

/** Années académiques à proposer, la courante en tête. Bascule en
 * septembre : entre janvier et août, l'année en cours a commencé à
 * l'automne précédent. */
export function anneesAcademiquesProposees(maintenant: Date): string[] {
  const debut = maintenant.getMonth() + 1 >= 9 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  const nombre = debut - PREMIERE_ANNEE_ACADEMIQUE + 1;
  return Array.from({ length: nombre }, (_, i) => `${debut - i}-${debut - i + 1}`);
}
