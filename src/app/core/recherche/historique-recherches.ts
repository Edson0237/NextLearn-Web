import { Injectable, signal } from '@angular/core';

const CLE = 'nl_recherches_recentes';

/**
 * Les dernières recherches, conservées sur l'appareil - traduction de
 * `HistoriqueRecherches` (`historique_recherches.dart`).
 *
 * ## Pourquoi les garder
 *
 * Une recherche se refait. On cherche « thermodynamique » la veille d'un
 * contrôle, on rouvre l'application le lendemain, et il faut la retaper - avec
 * les mêmes fautes de frappe. Les reproposer épargne une saisie au clavier sur
 * un écran de téléphone, le geste le plus coûteux de cette page.
 *
 * ## Pourquoi seulement sur l'appareil
 *
 * Ce que quelqu'un cherche en dit long : une matière qu'il ne maîtrise pas, un
 * rattrapage qu'il prépare. Rien de cela n'a besoin de quitter l'appareil, donc
 * rien ne le quitte - pas d'envoi au serveur, et la liste disparaît avec les
 * données du site.
 */
@Injectable({ providedIn: 'root' })
export class HistoriqueRecherches {
  /** Au-delà, une recherche est si ancienne qu'on ne la reconnaît plus. */
  static readonly capacite = 20;
  /** Cinq lignes tiennent sous le clavier ; davantage ferait défiler un écran
   *  qui n'est censé qu'aiguiller. */
  static readonly nombreAffiche = 5;

  readonly recentes = signal<readonly string[]>(this.lire());

  /** Les plus récentes d'abord, limitées à ce qui s'affiche. */
  aAfficher(): readonly string[] {
    return this.recentes().slice(0, HistoriqueRecherches.nombreAffiche);
  }

  retenir(terme: string): void {
    const propre = terme.trim();
    if (propre.length < 2) return;
    const sansDoublon = this.recentes().filter(
      (r) => r.toLowerCase() !== propre.toLowerCase(),
    );
    this.ecrire([propre, ...sansDoublon].slice(0, HistoriqueRecherches.capacite));
  }

  oublier(terme: string): void {
    this.ecrire(this.recentes().filter((r) => r !== terme));
  }

  vider(): void {
    this.ecrire([]);
  }

  private ecrire(valeurs: readonly string[]): void {
    this.recentes.set(valeurs);
    try {
      localStorage.setItem(CLE, JSON.stringify(valeurs));
    } catch {
      // Stockage bloqué : l'historique ne survivra pas à la session, ce qui
      // vaut mieux qu'un écran de recherche qui refuse de s'ouvrir.
    }
  }

  private lire(): string[] {
    try {
      const brut = localStorage.getItem(CLE);
      if (!brut) return [];
      const json: unknown = JSON.parse(brut);
      // Ce qui sort du stockage est vérifié plutôt que transtypé : une entrée
      // écrite par une version antérieure ne doit pas casser l'écran.
      return Array.isArray(json) ? json.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
}
