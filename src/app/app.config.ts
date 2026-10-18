import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/network/auth.interceptor';
import { TabReuseStrategy } from './core/router/tab-reuse-strategy';
import { AppErrorHandler } from './core/error-handling/app-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: RouteReuseStrategy, useClass: TabReuseStrategy },
    { provide: ErrorHandler, useClass: AppErrorHandler },
  ],
};
