import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Une liste que l'on rafraîchit en tirant vers le bas — traduction de
 * `ListeRafraichissable` (`liste_rafraichissable.dart`).
 *
 * ## Une simplification réelle, pas un oubli
 *
 * Côté Flutter, `RefreshIndicator` exige un enfant défilable pour
 * reconnaître le geste — d'où `estVide`, qui enveloppe un état vide dans
 * un défilement forcé pour que tirer reste possible sur une liste sans
 * rien à faire défiler.
 *
 * Cette contrainte ne s'applique pas ici : le geste est reconnu par
 * Pointer Events sur l'hôte lui-même (démarre au bord haut, mesure le
 * déplacement vertical), pas par la physique native du défilement. Un
 * contenu vide peut donc être tiré exactement comme un contenu plein,
 * sans artifice — `estVide` n'a pas d'équivalent ici parce que le
 * problème qu'il résolvait ne se pose pas.
 *
 * `refreshing` est une entrée, pilotée par l'appelant : comme pour
 * `OfflineScreen`, un `output()` ne se « attend » pas comme le
 * `Future<void> Function()` Flutter — l'indicateur reste donc affiché
 * tant que l'appelant garde `refreshing` à vrai, pas tant qu'une promesse
 * que ce composant ne reçoit jamais n'est pas résolue.
 */
@Component({
  selector: 'nl-refreshable',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nl-refresh__indicateur" [class.nl-refresh__indicateur--visible]="tire() || refreshing()"
         [style.opacity]="indicateurOpacite()" [style.transform]="indicateurTransform()">
      <span class="nl-refresh__spin" [class.nl-refresh__spin--actif]="refreshing()"></span>
    </div>
    <div class="nl-refresh__contenu" [style.transform]="contenuTransform()">
      <ng-content />
    </div>
  `,
  styleUrl: './refreshable.scss',
  host: { class: 'nl-refreshable' },
})
export class Refreshable {
  private readonly element = inject(ElementRef<HTMLElement>);

  readonly refreshing = input(false);
  /** Distance à parcourir pour déclencher, en pixels logiques. */
  readonly threshold = input(72);

  readonly refresh = output<void>();

  private readonly distance = signal(0);
  protected readonly tire = signal(false);

  private depart: { y: number; pointerId: number } | undefined;

  protected readonly indicateurOpacite = (): number =>
    Math.min(1, this.distance() / this.threshold());

  protected readonly indicateurTransform = (): string =>
    `translateY(${Math.min(this.distance(), this.threshold() * 1.4)}px) rotate(${this.distance() * 2}deg)`;

  protected readonly contenuTransform = (): string =>
    this.tire() || this.refreshing()
      ? `translateY(${Math.min(this.distance(), this.threshold())}px)`
      : '';

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.refreshing() || this.depart) return;
    // Le geste ne s'arme qu'au bord haut — sinon tirer vers le bas au
    // milieu d'une liste déclencherait un rafraîchissement à chaque
    // défilement remonté trop vite.
    if (this.element.nativeElement.scrollTop > 0) return;
    this.depart = { y: event.clientY, pointerId: event.pointerId };
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.depart || event.pointerId !== this.depart.pointerId) return;
    const delta = event.clientY - this.depart.y;
    if (delta <= 0) {
      this.distance.set(0);
      this.tire.set(false);
      return;
    }
    this.tire.set(true);
    // Résistance croissante : les cent premiers pixels tirés comptent
    // pleinement, au-delà l'indicateur ralentit — ce qui évite qu'un
    // tiré très long ne paraisse infini ou désynchronisé du doigt.
    this.distance.set(delta <= 100 ? delta : 100 + (delta - 100) * 0.4);
  }

  @HostListener('pointerup')
  @HostListener('pointercancel')
  onPointerEnd(): void {
    if (!this.depart) return;
    this.depart = undefined;
    this.tire.set(false);
    if (this.distance() >= this.threshold()) this.refresh.emit();
    this.distance.set(0);
  }
}
