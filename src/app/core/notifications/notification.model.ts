/**
 * Notification — aligné sur le modèle servi par l'API (`Notification.model.ts`
 * côté backend) et sur `NotificationModel` (`lib/domains/notifications/`).
 *
 * Le corps était lu sous la clé `message`, qui n'existe nulle part dans la
 * réponse : le champ s'appelle `corps`. Toutes les notifications
 * s'affichaient donc avec un titre et un corps vide. De même, `cibleRoute`
 * n'est pas un champ du serveur — la destination d'une notification voyage
 * dans `metadata`.
 */
export interface NotificationModel {
  readonly id: string;
  readonly titre: string;
  readonly corps: string;
  readonly type: string;
  readonly lu: boolean;
  /** Charge libre posée par le serveur : `documentId`, `epreuveId`, `route`… */
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export function notificationDepuisApi(json: Record<string, unknown>): NotificationModel {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  const brut = json['metadata'];
  return {
    id: texte(json['id'] ?? json['_id']),
    titre: texte(json['titre']),
    corps: texte(json['corps']),
    type: texte(json['type']),
    lu: Boolean(json['lu']),
    metadata:
      brut && typeof brut === 'object' && !Array.isArray(brut)
        ? (brut as Record<string, unknown>)
        : {},
    createdAt: texte(json['createdAt']),
  };
}

/**
 * La route interne vers laquelle mène une notification, si elle mène quelque
 * part. Relative à `/app`, comme tout le reste de l'application.
 *
 * Rien n'est deviné : seules les clés que le serveur pose réellement sont
 * reconnues, et un type inconnu ne produit aucune destination plutôt qu'un
 * lien au hasard.
 */
export function routeDeNotification(n: NotificationModel): string | null {
  const m = n.metadata;
  const id = (cle: string): string | null => {
    const v = m[cle];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };

  const route = id('route');
  if (route) return route.replace(/^\/+/, '');

  const documentId = id('documentId');
  if (documentId) return `bibliotheque/doc/${documentId}`;

  const epreuveId = id('epreuveId');
  if (epreuveId) return `epreuves/${epreuveId}`;

  const quizId = id('quizId');
  if (quizId) return `quiz/${quizId}`;

  return null;
}
