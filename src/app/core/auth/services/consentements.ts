import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATH } from '../../network/config/api-config';
import { donnees } from '../../network/utils/enveloppe-api';

/** Les deux documents dont l'acceptation ouvre un compte. */
export type DocumentJuridique = 'confidentialite' | 'conditions';

export type VersionsJuridiques = Readonly<Record<DocumentJuridique, string>>;

/**
 * Le consentement aux documents juridiques, côté client.
 *
 * Ce service ne **prouve** rien : les cases cochées ici ne servent qu'à dire au
 * serveur, avec la demande de connexion, quelles versions la personne vient de
 * lire. C'est le serveur qui exige, enregistre et date l'acceptation ; une
 * valeur rangée dans le navigateur ne vaut jamais consentement.
 *
 * Le même état sert à tous les parcours (code, PIN, Google) : cocher une fois
 * suffit pour la session en cours, quel que soit l'écran.
 */
@Injectable({ providedIn: 'root' })
export class Consentements {
  private readonly http = inject(HttpClient);

  readonly confidentialite = signal(false);
  readonly conditions = signal(false);
  readonly toutCoche = computed(() => this.confidentialite() && this.conditions());

  /** Vrai quand le serveur a refusé d'ouvrir une session faute d'acceptation. */
  readonly requis = signal(false);

  private versions: Promise<VersionsJuridiques | null> | null = null;

  definir(document: DocumentJuridique, coche: boolean): void {
    (document === 'confidentialite' ? this.confidentialite : this.conditions).set(coche);
  }

  /** Le serveur a dit « accepte d'abord » : les cases doivent apparaître. */
  exigerAffichage(): void {
    this.requis.set(true);
  }

  /** Les versions déclarées avec une demande de session, ou rien si tout n'est pas coché. */
  async declarer(): Promise<VersionsJuridiques | undefined> {
    if (!this.toutCoche()) return undefined;
    return (await this.lireVersions()) ?? undefined;
  }

  /** La session est ouverte : le serveur a enregistré, l'état local n'a plus lieu d'être. */
  reinitialiser(): void {
    this.confidentialite.set(false);
    this.conditions.set(false);
    this.requis.set(false);
  }

  private lireVersions(): Promise<VersionsJuridiques | null> {
    this.versions ??= firstValueFrom(this.http.get(`${AUTH_PATH}/legal-versions`))
      .then((reponse) => {
        const d = donnees(reponse);
        const c = d['confidentialite'];
        const t = d['conditions'];
        return typeof c === 'string' && typeof t === 'string' ? { confidentialite: c, conditions: t } : null;
      })
      .catch(() => {
        // Réessayé à la prochaine demande : un échec réseau ne se mémorise pas.
        this.versions = null;
        return null;
      });
    return this.versions;
  }
}
