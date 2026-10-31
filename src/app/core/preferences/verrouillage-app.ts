import { Injectable, signal } from '@angular/core';

/** La clé sous laquelle la préférence est conservée. */
const CLE = 'nl_verrouillage_app';

/**
 * Faut-il redemander le PIN à chaque ouverture de l'application ?
 *
 * ## Pourquoi ce réglage existe
 *
 * Le PIN était réclamé à **chaque** ouverture, sans que personne ne l'ait
 * demandé. Sur un téléphone personnel — déjà protégé par le code de
 * l'appareil — cela ajoutait une serrure derrière une porte fermée, quatre
 * ou cinq fois par jour.
 *
 * Il reste pourtant des cas où la serrure a un sens : un téléphone qui passe
 * de main en main dans une promotion, un poste partagé en salle info. D'où
 * un réglage, **désactivé par défaut** : qui en a besoin l'active, les
 * autres n'y pensent jamais.
 *
 * ## Ce que ce verrou protège, et ce qu'il ne protège pas
 *
 * Il protège l'affichage, pas les données : quelqu'un qui tient l'appareil
 * déverrouillé peut lire le stockage local. C'est une gêne volontaire à
 * hauteur du risque — un camarade curieux —, pas une mesure contre un
 * adversaire outillé.
 */
@Injectable({ providedIn: 'root' })
export class VerrouillageApp {
  private readonly _actif = signal(this.lire());

  /** Vrai si l'étudiant a demandé que l'application se verrouille. */
  readonly actif = this._actif.asReadonly();

  definir(actif: boolean): void {
    this._actif.set(actif);
    try {
      localStorage.setItem(CLE, actif ? '1' : '0');
    } catch {
      // Stockage indisponible : le réglage vaut pour cette session, ce qui
      // reste préférable à une erreur affichée pour une préférence.
    }
  }

  private lire(): boolean {
    try {
      // Absent vaut « désactivé » : c'est le défaut, et c'est aussi ce que
      // lit un compte existant qui n'a jamais vu ce réglage. Personne ne se
      // retrouve verrouillé par une mise à jour.
      return localStorage.getItem(CLE) === '1';
    } catch {
      return false;
    }
  }
}
