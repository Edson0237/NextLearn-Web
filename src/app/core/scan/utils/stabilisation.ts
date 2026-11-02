import { Point, Quad } from './geometrie';

export interface OptionsStabilisation {
  /** Part de la nouvelle mesure dans le contour affiché (0 à 1) : plus bas = plus doux. */
  readonly lissage: number;
  /** Mesures concordantes avant d'afficher un contour. */
  readonly confirmations: number;
  /** Écart maximal (fraction de l'image) entre deux mesures pour qu'elles concordent. */
  readonly tolerance: number;
  /** Combien de temps un contour survit à une détection manquée, en ms. */
  readonly tenueMs: number;
}

const PAR_DEFAUT: OptionsStabilisation = { lissage: 0.35, confirmations: 3, tolerance: 0.05, tenueMs: 700 };

const ecart = (a: Quad, b: Quad): number => {
  let max = 0;
  for (let i = 0; i < 4; i++) max = Math.max(max, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  return max;
};

/**
 * Ce qui rend le contour affiché pendant la prise de vue **calme** : la détection
 * brute saute d'une image à l'autre (une main qui tremble, un reflet), et la
 * montrer telle quelle fait danser le cadre devant les yeux.
 *
 *  - un contour n'apparaît qu'après plusieurs mesures concordantes : un faux
 *    positif d'une image ne clignote pas ;
 *  - ensuite il glisse vers chaque nouvelle mesure (lissage exponentiel) au lieu
 *    d'y sauter ;
 *  - une détection manquée ne l'efface pas aussitôt : il tient quelques instants,
 *    ce qui évite le clignotement quand la page passe un instant dans l'ombre.
 */
export class StabilisateurCoins {
  private candidat: Quad | null = null;
  private concordances = 0;
  private affiche: Quad | null = null;
  private vuA = 0;

  constructor(private readonly options: OptionsStabilisation = PAR_DEFAUT) {}

  /** Intègre une mesure (ou son absence) et rend le contour à afficher, ou `null`. */
  mettre(mesure: Quad | null, maintenant: number): Quad | null {
    if (!mesure) {
      this.candidat = null;
      this.concordances = 0;
      if (this.affiche && maintenant - this.vuA > this.options.tenueMs) this.affiche = null;
      return this.affiche;
    }

    this.vuA = maintenant;
    if (this.candidat && ecart(this.candidat, mesure) <= this.options.tolerance) this.concordances++;
    else this.concordances = 1;
    this.candidat = mesure;

    if (this.affiche) {
      // Une mesure très différente du contour affiché n'est suivie qu'une fois confirmée : sinon le cadre saute.
      if (ecart(this.affiche, mesure) > this.options.tolerance * 3 && this.concordances < this.options.confirmations) {
        return this.affiche;
      }
      const k = this.options.lissage;
      this.affiche = this.affiche.map((p: Point, i) => ({
        x: p.x + (mesure[i].x - p.x) * k,
        y: p.y + (mesure[i].y - p.y) * k,
      })) as unknown as Quad;
      return this.affiche;
    }

    if (this.concordances >= this.options.confirmations) this.affiche = mesure;
    return this.affiche;
  }

  reinitialiser(): void {
    this.candidat = null;
    this.concordances = 0;
    this.affiche = null;
  }
}
