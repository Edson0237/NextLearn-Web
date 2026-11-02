import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATH } from '../../network/config/api-config';
import { donnees } from '../../network/utils/enveloppe-api';

/** Les deux documents dont l'acceptation ouvre un compte. */
export type DocumentJuridique = 'confidentialite' | 'conditions';

export type VersionsJuridiques = Readonly<Record<DocumentJuridique, string>>;

/**
 * Le consentement aux documents juridiques, côté client.
 *
 * S'inscrire ou se connecter vaut acceptation : l'écran l'annonce sous les
 * boutons (« En t'inscrivant ou en te connectant, tu acceptes… »), sans case à
 * cocher. Ce service déclare donc au serveur, avec chaque demande qui ouvre une
 * session, la version de chaque document que la personne vient de se voir
 * présenter. Il ne **prouve** rien : c'est le serveur qui exige, enregistre et
 * date l'acceptation. Une valeur rangée dans le navigateur ne vaut jamais
 * consentement.
 */
@Injectable({ providedIn: 'root' })
export class Consentements {
  private readonly http = inject(HttpClient);

  private versions: Promise<VersionsJuridiques | null> | null = null;
  private connues: VersionsJuridiques | undefined;

  /** Les versions déjà chargées, lues sans attendre. */
  versionsConnues(): VersionsJuridiques | undefined {
    return this.connues;
  }

  /** Les versions en vigueur, demandées au serveur (une seule fois en cas de succès). */
  charger(): Promise<VersionsJuridiques | null> {
    this.versions ??= firstValueFrom(this.http.get(`${AUTH_PATH}/legal-versions`))
      .then((reponse) => {
        const d = donnees(reponse);
        const c = d['confidentialite'];
        const t = d['conditions'];
        if (typeof c !== 'string' || typeof t !== 'string') return null;
        this.connues = { confidentialite: c, conditions: t };
        return this.connues;
      })
      .catch(() => {
        // Réessayé à la prochaine demande : un échec réseau ne se mémorise pas.
        this.versions = null;
        return null;
      });
    return this.versions;
  }
}
