import { ErrorHandler, Injectable, inject } from '@angular/core';
import { GlobalErrorService } from './global-error.service';
import { estErreurBenigne } from './erreur-benigne';

/** Après un retour sur la page, les requêtes coupées par la suspension échouent encore un instant. */
const DELAI_RETOUR_MS = 2000;

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

  constructor() {
    const retour = (): void => {
      if (document.visibilityState === 'visible') this.retourLe = Date.now();
    };
    document.addEventListener('visibilitychange', retour);
    window.addEventListener('pageshow', retour);
  }

  handleError(error: unknown): void {
    const pageVisible =
      document.visibilityState === 'visible' && Date.now() - this.retourLe > DELAI_RETOUR_MS;

    if (estErreurBenigne(error, pageVisible)) {
      // eslint-disable-next-line no-console
      console.warn('[ErrorHandler] erreur ignorée (réseau ou page en arrière-plan)', error);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[ErrorHandler]', error);
    this.global.signaler(error);
  }
}
