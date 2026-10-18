import { TestBed } from '@angular/core/testing';
import { AnimatedNumber } from './animated-number';

/**
 * Ce que ce test protège : le seul garde-fou de `NombreAnime` qui ne se
 * voit pas à l'œil — « il ne rejoue pas à chaque reconstruction ». Une
 * page qui se reconstruit (thème, clavier) ne doit pas faire repartir le
 * chiffre de zéro ; seul un changement réel de `value` le doit.
 *
 * `fixture.componentRef.setInput(...)`, pas un hôte qui réassigne sa
 * propre propriété : muter une expression déjà vérifiée par un
 * `detectChanges()` précédent, puis la revérifier, déclenche un
 * `ExpressionChangedAfterItHasBeenCheckedError` sur ce projet (zoneless +
 * effects) — `setInput` est le chemin que Angular prévoit pour ce cas en
 * test, et ne s'y heurte pas.
 *
 * `requestAnimationFrame` est remplacé par un appel synchrone immédiat :
 * l'animation réelle (easeOutExpo sur 900ms) n'est pas ce qui est en jeu
 * ici, et une dépendance au temps réel rendrait ce test fragile sans rien
 * prouver de plus.
 */
describe('AnimatedNumber', () => {
  let appelsRaf: number;

  beforeEach(() => {
    appelsRaf = 0;
    // Toujours un horodatage largement au-delà de la durée de l'animation :
    // `t` atteint 1 dès le premier appel, et la récursion s'arrête — sans
    // ça, `etape` se rappellerait indéfiniment puisque ce mock ne fait
    // jamais réellement avancer le temps entre deux images.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      appelsRaf++;
      cb(performance.now() + 10_000);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche la valeur finale en légende, pas une valeur intermédiaire', () => {
    const h = TestBed.createComponent(AnimatedNumber);
    h.componentRef.setInput('value', 42);
    h.componentRef.setInput('suffix', '%');
    h.detectChanges();

    const span = h.nativeElement.querySelector('span') as HTMLElement;
    expect(span.getAttribute('aria-label')).toBe('42%');
  });

  it('ne recompte pas si la valeur reconstruit à l’identique', () => {
    const h = TestBed.createComponent(AnimatedNumber);
    h.componentRef.setInput('value', 42);
    h.detectChanges();
    const premierCompte = appelsRaf;
    expect(premierCompte).toBeGreaterThan(0);

    // La même valeur reposée : rien ne doit relancer l'animation.
    h.componentRef.setInput('value', 42);
    h.detectChanges();
    h.detectChanges();

    expect(appelsRaf).toBe(premierCompte);
  });

  it('recompte quand la valeur change réellement', () => {
    const h = TestBed.createComponent(AnimatedNumber);
    h.componentRef.setInput('value', 42);
    h.detectChanges();
    const premierCompte = appelsRaf;

    h.componentRef.setInput('value', 99);
    h.detectChanges();

    expect(appelsRaf).toBeGreaterThan(premierCompte);
    const span = h.nativeElement.querySelector('span') as HTMLElement;
    expect(span.getAttribute('aria-label')).toBe('99');
  });
});
