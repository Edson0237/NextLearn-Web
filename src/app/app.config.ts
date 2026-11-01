import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/network';
import { TabReuseStrategy } from './core/router/tab-reuse-strategy';
import { AppErrorHandler } from './core/error-handling';
import { provideServiceWorker } from '@angular/service-worker';
import { TraductionService } from './core/i18n';

// Sans cet enregistrement, le canal `fr` n'existe pas dans Angular et les
// tubes `date` et `number` retombent sur `en-US` : les jours de la semaine
// du tableau de progression s'affichaient « TUE WED THU », et les décimales
// avec un point dans une application par ailleurs entièrement française.
registerLocaleData(localeFr, 'fr');

/**
 * La langue appliquée, pour les tubes de formatage.
 *
 * `TraductionService` la résout déjà - préférence enregistrée, puis langue
 * du navigateur. On la relit ici plutôt que de la recalculer : deux logiques
 * de détection finiraient par diverger. Elle est lue une fois au démarrage,
 * ce que suppose `LOCALE_ID` ; changer de langue depuis les réglages
 * recharge l'application.
 */
function localeActive(): string {
  return inject(TraductionService).langue();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Les textes avant le premier écran : sans cette attente, l'application
    // afficherait brièvement ses libellés de secours puis basculerait, ce qui
    // se voit surtout sur les écrans d'authentification - les premiers
    // montrés, et les plus courts.
    provideAppInitializer(() => inject(TraductionService).demarrage()),
    { provide: LOCALE_ID, useFactory: localeActive },
    { provide: RouteReuseStrategy, useClass: TabReuseStrategy },
    { provide: ErrorHandler, useClass: AppErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
