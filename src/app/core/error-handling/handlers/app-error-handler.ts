import { DestroyRef, ErrorHandler, Injectable, inject } from '@angular/core';
import { GlobalErrorService } from '../services/global-error.service';
import { estErreurBenigne, estErreurChargementModule } from '../utils/erreur-benigne';

/** Après un retour sur la page, les requêtes coupées par la suspension échouent encore un instant. */
const DELAI_RETOUR_MS = 2000;
const CLE_RECHARGE_MODULE = 'nl_module_recharge_a';
/** Délai minimal entre deux rechargements automatiques sur perte d'un module paresseux. */
const DELAI_ANTI_BOUCLE_MODULE_MS = 15_000;

/**
 * Filet de sécurité global - traduction d'`installerFiletErreurs`
 * (`lib/shared/widgets/ecran_erreur_fatale.dart`).
 *
 * ## Une différence de plateforme, pas un oubli
 *
 * `ErrorWidget.builder` remplace côté Flutter le *sous-arbre* qui vient de
 * tomber, en laissant le reste de l'application intacte. Angular n'a pas
 * d'équivalent par composant : `ErrorHandler` est un point de capture
 * global, appelé pour toute erreur non rattrapée ailleurs (détection de
 * changements, callback asynchrone). Afficher `FatalError` ici remplace
 * donc *toute* la page (voir `App`, qui lit `GlobalErrorService.fatal()`),
 * pas seulement l'écran en cause.
 *
 * Ce que Flutter réussissait en plus - préserver la navigation déjà en
 * place pendant qu'un seul écran s'effondre - demanderait des limites
 * d'erreur par route, hors de portée d'`ErrorHandler` seul ; à revisiter
 * si ce filet se révèle trop grossier à l'usage.
 *
 * La console garde tout, quoi qu'on affiche : masquer `console.error`
 * échangerait une page blanche contre un silence, un marché pire encore.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly global = inject(GlobalErrorService);
  private retourLe = 0;
  private suspendue = false;

  constructor() {
    const destroyRef = inject(DestroyRef, { optional: true });
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    // Sur Safari iOS, le menu `•••`, la feuille Partager et « Sur l'écran d'accueil »
    // déclenchent `blur` / `focus` sans toujours passer `visibilityState` à `'hidden'`.
    const surVisibilite = (): void => {
      if (document.visibilityState === 'hidden') {
        this.suspendue = true;
        return;
      }
      if (this.suspendue) this.retourLe = Date.now();
      this.suspendue = false;
    };
    const surSuspension = (): void => {
      this.suspendue = true;
    };
    const surReprise = (evenement?: Event): void => {
      const bfCache = Boolean((evenement as { persisted?: boolean } | undefined)?.persisted);
      if (this.suspendue || bfCache) this.retourLe = Date.now();
      this.suspendue = false;
    };

    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('pagehide', surSuspension);
    window.addEventListener('blur', surSuspension);
    window.addEventListener('pageshow', surReprise);
    window.addEventListener('focus', surReprise);

    destroyRef?.onDestroy(() => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('pagehide', surSuspension);
      window.removeEventListener('blur', surSuspension);
      window.removeEventListener('pageshow', surReprise);
      window.removeEventListener('focus', surReprise);
    });
  }

  handleError(error: unknown): void {
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    const pageVisible =
      !this.suspendue && visible && Date.now() - this.retourLe > DELAI_RETOUR_MS;

    if (estErreurBenigne(error, pageVisible)) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorHandler] erreur ignorée (réseau ou page en arrière-plan)', error);
      return;
    }

    if (estErreurChargementModule(error) && this.peutRechargerModule()) {
      this.memoriserRechargementModule();
      // eslint-disable-next-line no-console
      console.warn('[ErrorHandler] module paresseux introuvable, rechargement de la page', error);
      this.recharger();
      return;
    }

    // eslint-disable-next-line no-console
    console.error('[ErrorHandler]', error);
    this.global.signaler(error);
  }

  protected enLigne(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  }

  protected recharger(): void {
    document.location.reload();
  }

  private peutRechargerModule(): boolean {
    if (!this.enLigne()) return false;
    try {
      const precedent = Number(sessionStorage.getItem(CLE_RECHARGE_MODULE));
      return !(precedent > 0 && Date.now() - precedent < DELAI_ANTI_BOUCLE_MODULE_MS);
    } catch {
      return false;
    }
  }

  private memoriserRechargementModule(): void {
    try {
      sessionStorage.setItem(CLE_RECHARGE_MODULE, String(Date.now()));
    } catch {
      // Ignoré si le stockage de session n'est plus accessible.
    }
  }
}
