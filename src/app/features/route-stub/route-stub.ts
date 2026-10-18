import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Remplaçant générique pour les 31 écrans de la Phase 4.
 *
 * La Phase 3 porte l'architecture — routage complet, gardes, état
 * d'authentification — pas le contenu des écrans, qui demande de lire
 * chaque fichier Flutter correspondant « écran par écran » (c'est
 * explicitement la Phase 4 du portage). Plutôt que 31 composants vides,
 * un seul composant générique, paramétré par les `data` de la route, qui
 * prouve que routage et gardes fonctionnent de bout en bout sans
 * prétendre qu'une interface existe là où elle n'existe pas encore.
 */
@Component({
  selector: 'app-route-stub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-stub">
      <p class="nl-stub__ecran">{{ ecran() }}</p>
      <p class="nl-stub__source">Phase 4 — {{ source() }}</p>
    </div>
  `,
  styles: [`
    .nl-stub {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; min-height: 60dvh; text-align: center;
      padding: 24px; gap: 8px; color: var(--text-muted, #64748b);
      font-family: var(--font-family-body, system-ui);
    }
    .nl-stub__ecran { font-size: 1.1rem; font-weight: 600; color: var(--text-primary, #10202e); }
  `],
})
export class RouteStub {
  private readonly route = inject(ActivatedRoute);

  protected readonly ecran = toSignal(
    this.route.data.pipe(map((d) => (d['ecran'] as string) ?? 'Écran')),
    { initialValue: 'Écran' },
  );
  protected readonly source = toSignal(
    this.route.data.pipe(map((d) => (d['source'] as string) ?? '')),
    { initialValue: '' },
  );
}
