/**
 * L'enveloppe des réponses de l'API : `{ data: … }`.
 *
 * Rend le contenu utile d'une réponse, tolérant — une réponse déjà « à plat »
 * (sans `data`) est rendue telle quelle, une réponse vide donne un objet vide.
 * Une seule définition pour tous les dépôts de données.
 */
export function donnees(brut: unknown): Record<string, unknown> {
  if (brut && typeof brut === 'object') {
    const enveloppe = brut as Record<string, unknown>;
    const data = enveloppe['data'];
    if (data && typeof data === 'object') return data as Record<string, unknown>;
    return enveloppe;
  }
  return {};
}

/** Le profil utilisateur d'une réponse : sous `data.user` pour l'authentification, sous `data` ailleurs. */
export function donneesUtilisateur(brut: unknown): Record<string, unknown> {
  const data = donnees(brut);
  const interne = data['user'];
  return interne && typeof interne === 'object' ? (interne as Record<string, unknown>) : data;
}
