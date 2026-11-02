import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild, computed } from '@angular/core';
import { TraductionPipe } from '../../../core/i18n';
import { PLEIN_CADRE, Point, Quad, quadValide } from '../../../core/scan';
import { Icon } from '../../../shared/ui/icon/icon';

/**
 * Le recadrage à la main : la photo entière, et quatre poignées à glisser sur
 * les coins de la page. C'est la voie de secours quand la détection se trompe -
 * elle ne rend jamais un cadre inutilisable (quadrilatère croisé ou plat) :
 * « Appliquer » reste grisé tant que les coins ne forment pas une page.
 */
@Component({
  selector: 'nl-recadrage',
  standalone: true,
  imports: [TraductionPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rec__scene">
      <div #cadre class="rec__cadre">
        <img [src]="source()" alt="" draggable="false" />
        <svg class="rec__contour" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <polygon [attr.points]="points()" />
        </svg>
        @for (c of coins(); track $index; let i = $index) {
          <button
            type="button"
            class="rec__poignee"
            [style.left.%]="c.x * 100"
            [style.top.%]="c.y * 100"
            [attr.aria-label]="'scanPoignee' | t: { numero: i + 1 }"
            (pointerdown)="saisir($event, i)"
            (pointermove)="glisser($event, i)"
            (pointerup)="lacher($event)"
            (pointercancel)="lacher($event)"></button>
        }
      </div>
    </div>
    @if (!valide()) {
      <p class="rec__alerte" role="alert">{{ 'scanCadreInvalide' | t }}</p>
    }
    <div class="rec__actions">
      <button type="button" class="rec__outil" (click)="coins.set(plein)">
        <nl-icon name="open_in_full" [size]="18" /> {{ 'scanPleinCadre' | t }}
      </button>
      <button type="button" class="rec__outil" (click)="detecter.emit()">
        <nl-icon name="refresh" [size]="18" /> {{ 'scanDetectionAuto' | t }}
      </button>
    </div>
  `,
  styleUrl: './recadrage.scss',
})
export class Recadrage {
  readonly source = input.required<string>();
  /** Les coins de départ. */
  readonly depart = input.required<Quad>();
  /** L'utilisateur demande de relancer la détection ; le parent répond via `appliquerCoins`. */
  readonly detecter = output<void>();
  /** Les coins courants, à chaque déplacement. */
  readonly change = output<Quad>();

  protected readonly plein = PLEIN_CADRE;
  protected readonly coins = signal<Quad>(PLEIN_CADRE);
  protected readonly valide = computed(() => quadValide(this.coins(), 0.04));
  protected readonly points = computed(() => this.coins().map((p) => `${p.x},${p.y}`).join(' '));
  private readonly cadre = viewChild.required<ElementRef<HTMLElement>>('cadre');

  constructor() {
    // Les coins de départ arrivent en entrée ; on les copie pour pouvoir les déplacer.
    queueMicrotask(() => this.coins.set(this.depart()));
  }

  /** Le parent impose de nouveaux coins (résultat de la détection). */
  appliquerCoins(c: Quad): void {
    this.coins.set(c);
    this.change.emit(c);
  }

  protected saisir(e: PointerEvent, _i: number): void {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  protected glisser(e: PointerEvent, i: number): void {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const r = this.cadre().nativeElement.getBoundingClientRect();
    const p: Point = {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
    const suivant = this.coins().map((c, k) => (k === i ? p : c)) as unknown as Quad;
    this.coins.set(suivant);
    this.change.emit(suivant);
  }

  protected lacher(e: PointerEvent): void {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  /** Les coins courants valent-ils d'être appliqués ? */
  get applicable(): boolean {
    return this.valide();
  }
}
