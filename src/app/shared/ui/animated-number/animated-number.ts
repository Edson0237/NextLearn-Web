import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

/** Décélération marquée — `Curves.easeOutExpo` côté Flutter. */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/**
 * Un nombre qui monte jusqu'à sa valeur — traduction de `NombreAnime`
 * (`lib/shared/widgets/nombre_anime.dart`).
 *
 * Ne recompte qu'au changement réel de `value` (un quiz refait, par
 * exemple) — jamais à une simple reconstruction du composant parent
 * (changement de thème, clavier qui s'ouvre). Et pas du tout si
 * `prefers-reduced-motion` est actif : la valeur s'affiche directement.
 *
 * `aria-label` porte toujours la valeur finale, jamais la valeur
 * intermédiaire en cours de décompte — un lecteur d'écran annoncerait
 * sinon une suite de nombres sans intérêt.
 */
@Component({
  selector: 'nl-animated-number',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [attr.aria-label]="value() + suffix()">{{ affiche() }}{{ suffix() }}</span>`,
  host: { role: 'text' },
})
export class AnimatedNumber {
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input.required<number>();
  readonly suffix = input('');
  readonly durationMs = input(900);

  protected readonly affiche = signal(0);

  private annulee = false;
  private dernierValeurLancee: number | undefined;

  constructor() {
    effect(() => {
      const cible = this.value();
      // Premier rendu, ou valeur réellement changée : on compte. Un
      // changement qui ne touche pas `value` ne redéclenche jamais cet
      // effet, puisque c'est le seul signal qu'il lit.
      if (this.dernierValeurLancee === cible) return;
      this.dernierValeurLancee = cible;
      this.lancer(cible);
    });

    this.destroyRef.onDestroy(() => {
      this.annulee = true;
    });
  }

  private lancer(cible: number): void {
    if (this.reduireLeMouvement()) {
      this.affiche.set(cible);
      return;
    }

    const duree = this.durationMs();
    const depart = performance.now();

    const etape = (maintenant: number) => {
      if (this.annulee) return;
      const t = Math.min(1, (maintenant - depart) / duree);
      this.affiche.set(Math.round(cible * easeOutExpo(t)));
      if (t < 1) requestAnimationFrame(etape);
    };
    requestAnimationFrame(etape);
  }

  private reduireLeMouvement(): boolean {
    return typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
