export interface NotificationModel {
  readonly id: string;
  readonly titre: string;
  readonly message: string;
  readonly type: string;
  readonly lu: boolean;
  readonly cibleRoute?: string;
  readonly createdAt: string;
}

export function notificationDepuisApi(json: Record<string, unknown>): NotificationModel {
  const texte = (v: unknown, defaut = ''): string => (v == null ? defaut : String(v));
  return {
    id: texte(json['id'] ?? json['_id']),
    titre: texte(json['titre']),
    message: texte(json['message']),
    type: texte(json['type']),
    lu: Boolean(json['lu'] ?? json['read']),
    cibleRoute: json['cibleRoute'] == null ? undefined : String(json['cibleRoute']),
    createdAt: texte(json['createdAt'] ?? json['date']),
  };
}
