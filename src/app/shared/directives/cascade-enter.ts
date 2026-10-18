import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';

/**
 * L'entrée décalée d'un élément dans une liste qui vient de se remplir —
 * traduction d'`ApparitionCascade` (`lib/shared/widgets/apparition_cascade.dart`).
 *
 * `[nlCascadeEnter]="index"` plutôt qu'un composant enveloppant : la
 * directive pose les propriétés CSS sur l'hôte lui-même, sans ajouter de
 * nœud DOM — `@keyframes` et `prefers-reduced-motion` sont dans
 * `_motion.scss`.
 *
 * Même plafond que côté Flutter : au-delà de 8 éléments, le délai cesse de
 * croître (`var(--cascade-pas) * min(index, 8)`), pour qu'une liste de
 * cinquante cartes ne mette pas deux secondes à finir d'apparaître.
 *
 * Réservée aux mêmes listes que côté Flutter : courtes et entièrement
 * visibles. Dans une liste virtualisée, un élément qui apparaît en
 * défilant rejouerait l'effet longtemps après le chargement.
 */
@Directive({
  selector: '[nlCascadeEnter]',
  standalone: true,
  host: {
    class: 'nl-cascade-enter',
    '[style.--cascade-index]': 'indexPlafonne()',
  },
})
export class CascadeEnter implements OnInit {
  private readonly element = inject(ElementRef<HTMLElement>);

  readonly nlCascadeEnter = input.required<number>();

  protected indexPlafonne(): number {
    return Math.min(this.nlCascadeEnter(), 8);
  }

  ngOnInit(): void {
    // La clé Flutter (`ValueKey('cascade-$index')`) évite de rejouer
    // l'animation sur un élément qui n'a fait que se déplacer. Le DOM n'a
    // pas cette notion de clé de réconciliation par défaut ; `data-index`
    // documente l'intention pour qui relit le rendu, la stabilité réelle
    // dépend de la liste appelante (ne pas détruire/recréer les nœuds au
    // réordonnancement).
    this.element.nativeElement.dataset['cascadeIndex'] = String(this.nlCascadeEnter());
  }
}
