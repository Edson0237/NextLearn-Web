import { Component, inject, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FatalError } from './shared/ui/fatal-error/fatal-error';
import { ToastHost } from './shared/ui/toast/toast-host';
import { GlobalErrorService } from './core/error-handling/global-error.service';

/**
 * Coque racine, réduite au routage depuis que la vitrine et l'application
 * partagent le même projet (un seul domaine — voir
 * docs/pwa-migration/AUDIT_PHASE1.md, §0). Tout le contenu qui vivait ici
 * est passé dans `features/vitrine/`, qui n'est plus que l'une des routes.
 *
 * Porte les deux overlays globaux, communs à la vitrine et à
 * l'application : `FatalError`, substitué à tout le reste quand
 * `AppErrorHandler` capture une erreur (voir ce fichier pour la
 * différence avec `ErrorWidget.builder` côté Flutter), et `ToastHost`,
 * toujours présent pour afficher le message courant de `ToastService`.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FatalError, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly global = inject(GlobalErrorService);
  protected readonly erreurFatale = this.global.fatal;
  protected readonly modeDebug = isDevMode();
}
