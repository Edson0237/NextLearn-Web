import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Coque racine, réduite au routage depuis que la vitrine et l'application
 * partagent le même projet (un seul domaine — voir
 * docs/pwa-migration/AUDIT_PHASE1.md, §0). Tout le contenu qui vivait ici
 * est passé dans `features/vitrine/`, qui n'est plus que l'une des routes.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
